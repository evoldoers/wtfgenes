# $Id: obo_godb_flat.pm,v 1.13 2008/10/30 17:50:55 benhitz Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::obo_godb_flat    - 

=head1 SYNOPSIS

  use GO::Handlers::obo_godb_flat

=cut

=head1 DESCRIPTION

transforms OBO XML events into flat tables for mysql to load
part of the association bulk loading pipeline


=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::obo_godb_flat;
use Data::Stag qw(:all);
use Data::Dumper;
use GO::Parsers::ParserEventNames;
use base qw(GO::Handlers::base);
use strict qw(vars refs);


use constant DELIMITER => "\t"; # separates fields

sub init {

    my $self = shift;

    $self->SUPER::init();

    $self->{tables} = {
	dbxref       => [ qw(id xref_dbname xref_key xref_keytype xref_desc) ], # must append many dbxrefs
	term         => [ qw(id name term_type acc is_obsolete is_root is_relation) ], # must append SO terms, qualifiers
	gene_product => [ qw(id symbol dbxref_id species_id  type_id full_name) ],
	association  => [ qw(id term_id gene_product_id is_not role_group assocdate source_db_id) ],
	db           => [ qw(id name fullname datatype generic_url url_syntax url_example uri_prefix) ], # last 4 all null in current load
	evidence     => [ qw(id code association_id dbxref_id seq_acc) ],
	association_qualifier => [ qw(id association_id term_id value) ], # must append 
	species               => [ qw(id ncbi_taxa_id common_name lineage_string genus species parent_id left_value right_value taxonomic_rank) ],
	# linking tables
	gene_product_synonym => [ qw(gene_product_id product_synonym)],
	evidence_dbxref      => [ qw(evidence_id dbxref_id) ],
	association_species_qualifier => [ qw(id association_id species_id) ],
	};
    
    $self->{fhs}  = { map (("$_.txt" => 0), keys %{$self->{tables}}) };

    $self->{pk} = { map (($_ => 0), keys %{$self->{tables}} ) };

}
    
sub apph {
    my $self = shift;
    $self->{apph} = shift if @_;
    return $self->{apph};
}
    

sub _obo_escape {
    my $s=shift;
    $s =~ s/\\/\\\\/;
    $s =~ s/([\{\}])/\\$1/g;
    $s;
}


sub safe {
    my $word = shift;
    $word =~ s/ /_/g;
    $word =~ s/\-/_/g;
    $word =~ s/\'/prime/g;
    $word =~ tr/a-zA-Z0-9_//cd;
    $word =~ s/^([0-9])/_$1/;
    $word;
}

sub quote {
    my $word = shift;
    #$word =~ s/,/\\,/g;  ## no longer required
    $word =~ s/\"/\\\"/g;
    "\"$word\"";
}



sub e_prod {
    my $self = shift;
    my $prod = shift;

    my $proddb = $self->up_to('dbset')->get_proddb;

#    $self->file('gene_product.txt'); done in add_gene_product

    my $gp_id = $self->add_gene_product($prod, $proddb);
    
    my @assocs = $prod->get_assoc;

    for my $assoc (@assocs) {

	# first dump the ASSOCIATION table
	$self->dump_table('association', [
					  ++$self->{pk}{association},
					  $self->get_term_id($assoc->get_termacc),
					  $gp_id,
					  stag_get($assoc, IS_NOT),
					  '\N', # role_group current always NULL
					  $assoc->sget_assocdate,
					  $self->get_sourcedb_id($assoc->sget_source_db)
					  ]);
 
	# now the qualifiers

	for my $qual ($assoc->get_qualifier) {
	    $self->dump_table('association_qualifier', [
							++$self->{pk}{association_qualifier},
							$self->{pk}{association},
							$self->get_term_id($qual, 'association_qualifier'),
							'\N', # value is currently always NULL
							]);

	}

	# get species qualifier for dual taxon species
	for my $species_qual ($assoc->get_species_qualifier) {
	    $self->dump_table('association_species_qualifier', [
							++$self->{pk}{association_species_qualifier},
							$self->{pk}{association},
							$self->get_taxon_id($species_qual),
							]);

	}

	# now evidence and evidence dbxref
	for my $ev ($assoc->get_evidence) {
	    
            # prioritize PMIDs
            my ($ref) = grep {$_ =~ /^PMID/} $ev->get_ref();
            if (!$ref) {
                $ref = $ev->sget_ref;
            }
	    $self->dump_table('evidence', [
					   ++$self->{pk}{evidence},
					   $ev->sget_evcode,
					   $self->{pk}{association},
					   $self->get_dbxref_id($ref), # only the first one here
					   $ev->sget_with || "",  # put only the first one here, I dunno why
					   ]);

	    for my $ref ($ev->get_ref) {

		next; # skip whole loop until we figure this out.
		$self->dump_table('evidence_dbxref', [
						      $self->{pk}{evidence},
						      $self->get_dbxref_id($ref),
						      ]);
	    }

	    for my $with ($ev->get_with) {

		$self->dump_table('evidence_dbxref', [
						      $self->{pk}{evidence},
						      $self->get_dbxref_id($with),
						      ]);
	    }

				     
	}
	
    }
    
}


sub add_gene_product {

    my $self = shift;
    my $prod = shift;
    my $proddb = shift;

    my $acc = $prod->get_prodacc;

    if ($self->apph->dbxref2gpid_h->{uc($proddb)}->{uc($acc)}) {
    # check to see if we've already added it
    # unique key for gene product is actually dbxref_id, but need the gp_id
    } else {
#	warn "$proddb, $acc, does not exist, creating";
    
	# if not, write a line to gene_product.txt
	# new dbxref_id is added by get_dbxref_id.
	$self->dump_table('gene_product', [
					   ++$self->{pk}{gene_product},
					   $prod->sget_prodsymbol,
					   $self->get_dbxref_id($proddb, $acc),
					   $self->get_taxon_id($prod->get_prodtaxa),
#					   '\N', # currently no secondary species ids
					   $self->get_term_id($prod->get_prodtype, 'sequence'),
					   $prod->sget_prodname || "", # that should be full name.
					   ]);

	$self->apph->dbxref2gpid_h->{uc($proddb)}->{uc($acc)} = $self->{pk}{gene_product};

	# add synoyms if necessary

	for my $syn ($prod->get_prodsyn) {
	
	    $self->dump_table('gene_product_synonym', [
						       $self->{pk}{gene_product}, 
						       $syn,
						       ]);
	}

    }

    return $self->apph->dbxref2gpid_h->{uc($proddb)}->{uc($acc)};
    
}

sub get_dbxref_id {

    my $self = shift;
    my $dbname = shift;
    my $key = shift;

    if (!$key) {

        if ($dbname =~ /^([^:]+):+(\S+)/) {
	    $dbname = $1;
	    $key = $2;
	} 

    }



    if (!$dbname || !$key) {
	warn "Must supply dbname and key: ($dbname),($key) attempting to write $self->{_file}\n";
	return 0;

    }

    my $ucKey = uc($key);
    my $ucDb  = uc($dbname);

    # mysql will handle case-insensitivity, but perl keeps seperate

    return $self->apph->dbxref2id_h->{$ucDb}->{$ucKey} if $self->apph->dbxref2id_h->{$ucDb}->{$ucKey};

    # doesn't exist, add it to dbxref file and hash
    my $oldfile = $self->file;

    $self->dump_table('dbxref', [
				 ++$self->{pk}{dbxref},
				 $dbname,
				 $key,
				 '\N',
				 '\N',
				 ]);


    $self->file($oldfile); # set filename back

    $self->apph->dbxref2id_h->{$ucDb}->{$ucKey} = $self->{pk}{dbxref};  # return the id


}
			     
sub get_term_id {

    # note this hopeless fails if 2 terms in different CVs have the same name!

    my $self = shift;
    my $term = shift;
    my $termType = shift;
    my $acc = shift || $term;

    $term = lc($term) unless $term =~ /^GO:/; # sometimes people use Gene instead of gene

    return $self->apph->acc2id_h->{$term} if $self->apph->acc2id_h->{$term};

    die "No term type specified for $term, and not in hash" if !$termType;

    # doesn't exist, add it to dbxref file and hash
    my $oldfile = $self->file;

    $self->dump_table('term', [
			       ++$self->{pk}{term},
			       $term,
			       $termType,
			       $acc,
			       0,  # never is_obsolete
			       0,  # never is_root
                               0,  # never a relationship type
			       ]);

    $self->file($oldfile); # set file name back;

    $self->apph->acc2id_h->{$term} = $self->{pk}{term};  # return the id


}
    
sub get_sourcedb_id {

    my $self = shift;
    my $db = shift;
 
    return $self->apph->source2id_h->{uc($db)} if $self->apph->source2id_h->{uc($db)};

    # doesn't exist, add it to file and hash
    my $oldfile = $self->file;

    $self->dump_table('db', [
			     ++$self->{pk}{db},
			     $db,
			     '\N',
			     '\N',
			     '\N',   
			     '\N',  
			     '\N',  
			     '\N',  
			     ]);

    $self->file($oldfile); # set file name back

    $self->apph->source2id_h->{uc($db)} = $self->{pk}{db};  # return the id


}
sub get_taxon_id {

    my $self = shift;
    my $taxonId = shift || '';
    
    return $self->apph->taxon2id_h->{$taxonId} if $self->apph->taxon2id_h->{$taxonId};
    warn "Could not find id in db for taxon $taxonId, adding\n";

    my $oldfile = $self->file;
    
    $self->dump_table('species', [
				  ++$self->{pk}{species},
				  $taxonId,
				  '\N',  # name unknown
				  '\N',  # lineage unknown
				  '\N',  # genuss unknown
				  '\N',  # species unknown
				  '\N',  # parent_id unknown
				  '\N',  # left  unknown
				  '\N',  # right  unknown
				  '\N',  # taxonomic rank  unknown
				  ]);

    $self->file($oldfile); # set file name back;

    $self->apph->taxon2id_h->{$taxonId} = $self->{pk}{species};  # return the id

}    

sub file {
# overrides Data::Stag::Writer file
# with no arguments, returns current filename
# with argument, sets file handle to file handle from {fhs} hash
# if file handle not open, opens with safe_fh
# returns "new" file name.
    my $self = shift;

    my $fh = $self->{fhs}; # hash of filehandles

    # create the keys if they don't exist, suppresses warnings
    # first time this is called, might be STDOUT or something
    $self->{_file} = undef unless $self->{_file}; 
    $self->{_fh} = undef unless $self->{_fh};

    if (@_) {
	
	$self->{_file} = shift;
	$self->{_fh} = undef;
    }

    if  ( !$self->{_file} || !$fh->{$self->{_file}} ) {

#	print STDERR "opening file $self->{_file}...\n";
	$fh->{$self->{_file}} = $self->safe_fh;

    }
    
    $self->{_fh} = $fh->{$self->{_file}} if exists $self->{_file};

    return $self->{_file};

}

sub close_files {

    my $self = shift;
    for my $fh (values %{$self->{fhs}}) {

	close($fh) if $fh && $fh ;
    }

#    close($self->{_fh}) if $self->{_fh};
}

sub tables {

    $_[0]->{tables};

}

sub dump_table {

    my $self = shift;
    my $tab = shift;
    my $fieldsRef = shift;

    die "Don't know anything about $tab" if ( !$self->{tables}->{$tab} || !scalar (@{ $self->{tables}->{$tab} }) );

    die "Tried to write wrong number of fields $tab" if scalar(@$fieldsRef) != scalar(@{ $self->{tables}->{$tab} });

    $self->file("$tab.txt");

    $self->write(join(DELIMITER, @$fieldsRef));
    $self->write("\n");
}

1;

