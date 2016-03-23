# $Id: go_assoc_parser.pm,v 1.22 2009/08/17 00:46:16 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::go_assoc_parser;

=head1 NAME

  GO::Parsers::go_assoc_parser     - syntax parsing of GO gene-association flat files

=head1 SYNOPSIS


=head1 DESCRIPTION

do not use this class directly; use L<GO::Parser>

This generates Stag/XML event streams from GO association files.
Examples of these files can be found at http://www.geneontology.org,
an example of lines from an association file:

  SGD     S0004660        AAC1            GO:0005743      SGD:12031|PMID:2167309 TAS             C       ADP/ATP translocator    YMR056C gene    taxon:4932 20010118
  SGD     S0004660        AAC1            GO:0006854      SGD:12031|PMID:2167309 IDA             P       ADP/ATP translocator    YMR056C gene    taxon:4932 20010118

See L<http://www.geneontology.org/GO.annotation.shtml#file>

See
L<http://www.godatabase.org/dev/xml/dtd/go_assoc-parser-events.dtd>
For the DTD of the event stream that is generated

The following stag-schema describes the events that are generated in
parsing an assoc file:

  (assocs
   (dbset+
     (proddb "s")
     (prod+
       (prodacc "s")
       (prodsymbol "s")
       (prodtype "s")
       (prodtaxa "i")
       (assoc+
         (assocdate "i")
         (source_db "s")
         (termacc "s")
         (is_not "i")
         (aspect "s")
         (evidence+
           (evcode "s")
           (ref "s")))))) 

=cut

use Exporter;
use base qw(GO::Parsers::base_parser Exporter);
#use Text::Balanced qw(extract_bracketed);
use GO::Parsers::ParserEventNames;
use GO::Parser;

use Carp;
use FileHandle;
use strict;

sub dtd {
    'go_assoc-parser-events.dtd';
}

sub ev_filter {
    my $self = shift;
    $self->{_ev_filter} = shift if @_;
    return $self->{_ev_filter};
}



sub skip_uncurated {
    my $self = shift;
    $self->{_skip_uncurated} = shift if @_;
    return $self->{_skip_uncurated};
}

sub parse_fh {
    my ($self, $fh) = @_;
    my $file = $self->file;

    my $product;
    my $term;
    my $assoc;
    my $line_no = 0;

    my $obo_parser; # an OBO parser may be required for parsing the PROPERTIES column

    my @COLS = (0..16);
    my ($PRODDB,
        $PRODACC,
        $PRODSYMBOL,
        $QUALIFIER,
        $TERMACC,
        $REF,
        $EVCODE,
        $WITH,
        $ASPECT,
        $PRODNAME,
        $PRODSYN,
        $PRODTYPE,
        $PRODTAXA,
        $ASSOCDATE,
	$SOURCE_DB,
        $PROPERTIES,   # GAF2.0
        $ISOFORM,      # GAF2.0
       ) = @COLS;

    my @mandatory_cols = ($PRODDB, $PRODACC, $TERMACC, $EVCODE);

    #    <assocs>
    #      <dbset>
    #        <db>fb</db>
    #        <prod>
    #          <prodacc>FBgn0027087</>
    #          <prodsym>Aats-his</>
    #          <prodtype>gene</>
    #          <prodtaxa>7227</>
    #          <prodsynonym>...</>
    #          <assoc>
    #            <termacc>GO:0004821</termacc>
    #            <evidence>
    #              <code>NAS</code>
    #              <ref>FB:FBrf0105495</ref>
    #              <with>...</with>
    #            </evidence>
    #          </assoc>
    #        </prod>
    #      </dbset>
    #    <assocs>
 
    $self->start_event(ASSOCS);
    $self->fire_source_event($file);

    my @last = map {''} @COLS;

    my $skip_uncurated = $self->skip_uncurated;
    my $ev = $self->ev_filter;
    my %evyes = ();
    my %evno = ();
    if ($ev) {
	if ($ev =~ /\!(.*)/) {
	    $evno{$1} = 1;
	}
	else {
	    $evyes{$ev} = 1;
	}
    }

    my $taxa_warning;

    my $line;
    my @vals;
    my @stack = ();
    while (<$fh>) {
        # UNICODE causes problems for XML and DB
        # delete 8th bit
        tr [\200-\377]
          [\000-\177];   # see 'man perlop', section on tr/
        # weird ascii characters should be excluded
        tr/\0-\10//d;   # remove weird characters; ascii 0-8
                        # preserve \11 (9 - tab) and \12 (10-linefeed)
        tr/\13\14//d;   # remove weird characters; 11,12
                        # preserve \15 (13 - carriage return)
        tr/\16-\37//d;  # remove 14-31 (all rest before space)
        tr/\177//d;     # remove DEL character

        $line_no++;
	chomp;
	if (/^\!/) {
	    next;
	}
	if (!$_) {
	    next;
	}
        # some files use string NULL - we just use empty string as null
        s/\\NULL//g;
        $line = $_;

        $self->line($line);
        $self->line_no($line_no);

	@vals = split(/\t/, $line);

	# normalise columns, and set $h
	for (my $i=0; $i<@COLS;$i++) {
	    if (defined($vals[$i])) {

		# remove trailing and
		# leading blanks
		$vals[$i] =~ s/^\s*//;
		$vals[$i] =~ s/\s*$//;

		# sometimes - is used for null
		$vals[$i] =~ s/^\-$//;

		# TAIR seem to be
		# doing a mysql dump...
		$vals[$i] =~ s/\\NULL//;
	    }
	    if (!defined($vals[$i]) ||
		length ($vals[$i]) == 0) {

		if ( grep {$i == $_} @mandatory_cols) {
		    $self->parse_err("no value defined for col ".($i+1)." in line_no $line_no line\n$line\n");
		    next;
		}
                $vals[$i] = '';
	    }
	}

        my ($proddb,
            $prodacc,
            $prodsymbol,
            $qualifier,
            $termacc,
            $ref,
            $evcode,
            $with,
            $aspect,
            $prodname,
            $prodsyn,
            $prodtype,
            $prodtaxa,
            $assocdate,
            $source_db,
            $properties,                     # GAF2.0
            $isoform) = @vals;               # GAF2.0

        # backward compatibility GAF2.0 -> GAF1.0
        $properties = '' unless defined $properties;
        $isoform = '' unless defined $isoform;

        $assocdate = '' unless defined $assocdate;
        $source_db = '' unless defined $source_db;

#	if (!grep {$aspect eq $_} qw(P C F)) {
#	    $self->parse_err("Aspect column says: \"$aspect\" - aspect must be P/C/F");
#	    next;
#	}
        if ($self->acc_not_found($termacc)) {
	    $self->parse_err("No such ID: $termacc");
	    next;
        }
	if (!($ref =~ /:/)) {
            # ref does not have a prefix - we assume it is medline
	    $ref = "medline:$ref";
	}
	if ($skip_uncurated && $evcode eq "IEA") {
	    next;
	}
	if (%evyes && !$evyes{$evcode}) {
	    next;
	}
	if (%evno && $evno{$evcode}) {
	    next;
	}
        my @prodtaxa_ids = split(/\|/,$prodtaxa);
        @prodtaxa_ids =
          map {
              s/taxonid://gi;
              s/taxon://gi;
              if ($_ !~ /\d+/) {
                  if (!$taxa_warning) {
                      $taxa_warning = 1;
                      $self->parse_err("No NCBI TAXON wrong fmt: $_");
                      $_ = "";
                  }
              }
              $_;
          } @prodtaxa_ids;
        @prodtaxa_ids = grep {$_} @prodtaxa_ids;
        my $main_taxon_id = shift @prodtaxa_ids;
        if (!$main_taxon_id) {
            if (!$taxa_warning) {
                $taxa_warning = 1;
                $self->parse_err("No NCBI TAXON specified; ignoring");
            }
        }
        

        # check for new element; shift a level
	my $new_dbset = $proddb ne $last[$PRODDB];
	my $new_prodacc =
	  $prodacc ne $last[$PRODACC] || $new_dbset;
	my $new_assoc =
            ($termacc ne $last[$TERMACC]) ||
            $new_prodacc ||
            ($qualifier ne $last[$QUALIFIER]) ||
            ($source_db ne $last[$SOURCE_DB]) ||
            ($assocdate ne $last[$ASSOCDATE]) ||
            ($isoform ne $last[$ISOFORM]);

        #if (!$new_prodacc && ($prodtaxa ne $last[$PRODTAXA])) {
	## Before we declare an error, let's make sure that we're not
	## talking about secondary taxons...
	my $chopped_taxa = $prodtaxa;
	my $chopped_prev_taxa = $last[$PRODTAXA];
	$chopped_taxa =~ s/\|.+//;
	$chopped_prev_taxa =~ s/\|.+//;
        if (!$new_prodacc && ($chopped_taxa ne $chopped_prev_taxa)) {
            # two identical gene products with the same taxon
            # IGNORE!
	    $self->parse_err("different taxa ($prodtaxa, $last[$PRODTAXA]) for same product $prodacc");
            next;
        }

	# close finished events
	if ($new_assoc) {
	    $self->pop_stack_to_depth(3) if $last[$TERMACC];
	    #	    $self->end_event("assoc") if $last[$TERMACC];
	}
	if ($new_prodacc) {
	    $self->pop_stack_to_depth(2) if $last[$PRODACC];
	    #	    $self->end_event("prod") if $last[$PRODACC];
	}
	if ($new_dbset) {
	    $self->pop_stack_to_depth(1) if $last[$PRODDB];
	    #	    $self->end_event("dbset") if $last[$PRODDB];
	}
	# open new events
	if ($new_dbset) {
	    $self->start_event(DBSET);
	    $self->event(PRODDB, $proddb);
	}
	if ($new_prodacc) {
	    $self->start_event(PROD);
	    $self->event(PRODACC, $prodacc);
	    $self->event(PRODSYMBOL, $prodsymbol);
	    $self->event(PRODNAME, $prodname) if $prodname;
	    $self->event(PRODTYPE, $prodtype) if $prodtype;
            if ($main_taxon_id) {
                $self->event(PRODTAXA, $main_taxon_id);
            }
	    my $syn = $prodsyn;
	    if ($syn) {
		my @syns = split(/\|/, $syn);
		my %ucheck = ();
		@syns = grep {
		    if ($ucheck{lc($_)}) {
			0;
		    }
		    else {
			$ucheck{lc($_)} = 1;
			1;
		    }
		} @syns;
		map {
		    $self->event(PRODSYN, $_);
		} @syns;
	    }
	}
	if ($new_assoc) {
	    my $assocdate = $assocdate;
	    $self->start_event(ASSOC);
	    if ($assocdate) {
		if ($assocdate && length($assocdate) == 8) {
		    $self->event(ASSOCDATE, $assocdate);
		}
		else {
		    $self->parse_err("ASSOCDATE wrong format (must be YYYYMMDD): $assocdate");
		}
	    }
	    $self->event(SOURCE_DB, $source_db)
		    if $source_db;
	    $self->event(TERMACC, $termacc);
            my @quals = map lc,split(/[\|]\s*/,$qualifier || '');
	    my $is_not = grep {/^not$/i} @quals;
	    $self->event(IS_NOT, $is_not || '0');
	    $self->event(QUALIFIER, $_) foreach @quals;
            $self->event(SPECIES_QUALIFIER, $_) foreach @prodtaxa_ids; # all REMAINING (after "|') tax ids are qualifiers
	    $self->event(ASPECT, $aspect);
            if ($isoform) {
                $self->event(ISOFORM, $isoform);
            }
            if ($properties) {
                my @properties_list = split(/\|/,$properties);
                if (!$obo_parser) {
                    $obo_parser = GO::Parser->new({format=>'obo_text'});
                }
                foreach my $p (@properties_list) {
                    my $diffs = $obo_parser->parse_differentia($p);
                    $self->event(PROPERTIES, $diffs);
                }
            }
	}
	$self->start_event(EVIDENCE);
	$self->event(EVCODE, $evcode);
	if ($with) {
            # TODO: discriminate between pipes and commas
            # (semicolon is there for legacy reasons - check if this can be removed)
	    my @with_accs = split(/\s*[\|\;\,]\s*/, $with);
	    $self->event(WITH, $_)
	      foreach (grep (/:/, @with_accs));  
	    # we have found errors where the : was left out, this just skips

	    # no longer checks for cardinality errors

	}
        my @refs = split(/\|/, $ref);
	map {
	    $self->event(REF, $_)
        } @refs;
	$self->end_event(EVIDENCE);
	#@last = @vals;
        @last =
          (
           $proddb,
           $prodacc,
           $prodsymbol,
           $qualifier,
           $termacc,
           $ref,
           $evcode,
           $with,
           $aspect,
           $prodname,
           $prodsyn,
           $prodtype,
           $prodtaxa,
           $assocdate,
           $source_db,
           $properties,
           $isoform,
          );
    }
    $fh->close;

    $self->pop_stack_to_depth(0);
}


1;

# 2.864 orig/handler
# 2.849 opt/handler
# 1.986 orig/xml
# 1.310 opt/xml
