# $Id: godb_prestore.pm,v 1.9 2005/03/22 22:38:11 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::godb_prestore  - transforms OBO XML to GODB XML

=head1 SYNOPSIS

  

=head1 DESCRIPTION

This is a transform for turning OBO XML events into XML events that
are isomorphic to the GO Database (ie XML element names match GO DB
table and column names).

This transformation is suitable for direct loading into a db using the
generic DBIx::DBStag loader (see http://stag.sourceforge.net)

This perl transform may later be replaced by an XSL transform (for
speed)

=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::godb_prestore;
use Data::Stag qw(:all);
use base qw(GO::Handlers::base);

use strict;
use Carp;
use Data::Dumper;
use Data::Stag qw(:all);
use GO::Parsers::ParserEventNames;  # XML constants for elements

sub EMITS {
    qw(
       dbstag_metadata
       source_audit
       term
       gene_product
      )
}

sub is_transform { 1 }

sub dbstag_mapping {
    return([
            "type/term_synonym.synonym_type_id=term.id",
            "term1/term2term.term1_id=term.id",
            "term2/term2term.term2_id=term.id",
            "type/term2term.relationship_type_id=term.id",
            "type/gene_product.type_id=term.id",
            "source_db/association.source_db_id=db.id",
            ]
           );
}

sub e_source {
    my $self = shift;
    my $source = shift;
    stag_name($source, 'source_audit');
    return $source;
}

sub e_header {
    my ($self, $hdr) = @_;
    [dbstag_metadata=>[
                       map {[map=>$_]} @{$self->dbstag_mapping}
                      ]
    ];
}

sub e_term {
    my ($self, $term) = @_;
    my $id = stag_get($term, ID) || $self->throw($term->sxpr);
    warn("DEPRECATED - use XSL instead");
    stag_set($term, ACC, $id);
    my $name_h = $self->{name_h};
    my $name = stag_get($term, NAME);
    my $ont = stag_get($term, NAMESPACE);
    my $is_obs = stag_get($term, IS_OBSOLETE);
 
    my @extra_events = ();
    my @is_as = stag_get($term, IS_A);
    my @rels = (stag_get($term, RELATIONSHIP),
                map {[relationship=>[[to=>$_],[type=>'is_a']]]} @is_as);
    if ($is_obs) {
        my $obs = "obsolete_$ont";
        @rels = ([relationship=>[[to=>$obs],
                                 [type=>'is_a']]]);
        if ($obs eq $id) {
            # place root obs under root
            @rels = ([relationship=>[[to=>$self->{__added_root} || 'all'],
                                     [type=>'is_a']]]);
        }
        if (!$self->{"__added_obsnode_$ont"}) {
            $self->{"__added_obsnode_$ont"} = $obs;
            push(@extra_events,
                 $self->e_term(Data::Stag->new(term=>[[id=>$obs],
                                                      [name=>$obs],
                                                      [namespace=>$ont],
                                                      [is_obsolete=>1],
                                                     ]
                                              )
                              )
                );
        }
        # in go format, obsolete nodes may have 'fake' parentage;
        # either to root (for root obsolete term) or to root 
        # obsolete term;
        # here we replace this with $obs
    }
    my @cvrels =
      map {
          my $to = stag_get($_=>TO);
          my $type = stag_get($_=>TYPE);
          Data::Stag->new(term2term=>[
				      [term1=>[[term=>[[acc=>$to]]]]],
				      [term2=>[[term=>[[acc=>$id]]]]],
				      _type($type, 'relationship'),
				     ]
                         );
      } @rels;

    if ($name && !@cvrels) {
        # add 'all' node;
        # only for named node (to avoid adding root when parsing defs)
        # and when there are no parents
        # GO DB relies on having one single root node
        my $all = $self->{__added_root};
        if ($all) {
        }
        else {
            my $alldef = 'This term is the most general term possible.';
            $all = 'all';
            $self->{__added_root} = $all;
            @cvrels = 
              (Data::Stag->new(term=>[
                                      [acc=>'all'],
                                      [name=>'all'],
                                      [term_definition=>[
                                                         [term_definition=>$alldef],
                                                        ]],
                                      [is_root=>1],
                                      [term_type=>'universal'],
                                     ])
              );
        }
        push(@cvrels,
             Data::Stag->new(term2term=>[
                                         [term1=>[[term=>[[acc=>$all]]]]],
                                         [term2=>[[term=>[[acc=>$id]]]]],
                                         _type('is_a', 'relationship'),
                                        ]
                            )
            );
    }

    my $def = stag_get($term, DEF);
    my @alt_ids = stag_get($term, ALT_ID);
    my @syns = stag_get($term, SYNONYM);

    my $comment = stag_find($term, COMMENT);   # comment can be under term or def
    my $t = time;
    my $nuterm = 
      Data::Stag->new(term=> 
                      [
                       [acc=>$id],
                       $name ? [NAME=>$name] : (),,
                       $ont ? [term_type=>$ont] : (),
                       defined $is_obs ? [is_obsolete=>$is_obs && $is_obs ne 'false' ? 1:0] : (),
                       $name ? [term_audit=>[
                                             [term_loadtime=>$t]
                                            ]] : (),
                      ]
                     );
    my @term_dbxrefs =
      map {
	  Data::Stag->new(term_dbxref=>[[dbxref=>[_xref_stags($_)]]])
      } stag_get($term, XREF_ANALOG);
    if ($def || $comment) {
	stag_set($nuterm, term_definition=> 
                 [
                  ($def ? [term_definition=>stag_sget($def, DEFSTR)]:()),
                  ($comment ? [term_comment=>$comment] : ()),
                 ]);
        if ($def) {
            push(@term_dbxrefs,
                 Data::Stag->new(term_dbxref=>[[is_for_definition=>1],
                                               [dbxref=>[_xref_stags($_)]]]))
              foreach stag_get($def, DBXREF);
        }
    }
    stag_add($nuterm, TERM_DBXREF, $_) foreach @term_dbxrefs;
    stag_add($nuterm, term_synonym=>
             [
              [acc_synonym=>$_],
              [term_synonym=>$_],
              _type('acc','synonym'),
             ])
      foreach @alt_ids;

    foreach (@syns) {
	my $type = stag_sget($_, TYPE);
	stag_add($nuterm, term_synonym=>
                 [
                  $type ? _type($type,'synonym') : (),
                  [term_synonym=>stag_sget($_, SYNONYM_TEXT)]
                 ]);
    }
    return (@extra_events,$nuterm,@cvrels);
}

sub e_typedef {
    my ($self, $t) = @_;
    my $id = stag_get($t, ID);
    return
      Data::Stag->new(term=>[
			     [acc=>$id],
			     [name=>$id]
			    ]);
}

sub e_prod {
    my ($self, $prod) = @_;
    my $proddb = stag_sget($self->up(1), PRODDB);
    my $full_name = stag_sget($prod, PRODNAME);
    my @gpstags =
      (
       [symbol=>stag_sget($prod, PRODSYMBOL)],
       ($full_name ? [full_name=>$full_name] : ()),
       [dbxref=>[[xref_dbname=>$proddb],
		 [xref_key=>stag_sget($prod, PRODACC)]]],
       [species=>[[ncbi_taxa_id=>stag_sget($prod, PRODTAXA)]]],
       _type(stag_sget($prod,TYPE) || 'gene', 'gene_product'),
       (map {
	   [gene_product_synonym=>[[product_synonym=>$_]]]
       } stag_get($prod,PRODSYN)),
      );
    my @assocs = stag_get($prod,ASSOC);
    foreach my $assoc (@assocs) {
        my @quals = stag_sget($assoc,QUALIFIER);
        my $source_db = stag_sget($assoc, SOURCE_DB);
	push(@gpstags,
	     [association=>[
			    [term=>[[acc=>stag_sget($assoc,TERMACC)]]],
			    [is_not=>stag_sget($assoc,IS_NOT)],
                            (map {
                                [association_qualifier=>[[term=>[[acc=>$_]]]]]
                            } @quals),
#			    ($qual ? [qualifier=>[[term=>[[acc=>$qual]]]]]: ()),
			    ($source_db ? [source_db=>[[db=>[[name=>$source_db]]]]] : ()),
			    [assocdate=>stag_sget($assoc,ASSOCDATE)],
			    (map {
				my @withs = stag_get($_,WITH);
				[evidence=>[
					    [code=>stag_sget($_,EVCODE)],
					    (scalar(@withs) ? [seq_acc=>join('|',@withs)] : ()),
					    _xref(stag_sget($_,REF)),
					    scalar(@withs) ?
                                            [evidence_dbxref=>[
							       (map {
								   _xref($_)
							       } @withs)
							      ]] : (),
					   ]]
			    } stag_get($assoc,EVIDENCE))
			   ]
	     ]
	    );
							  
    }
    return Data::Stag->new(gene_product=>[@gpstags]);
}

sub _xref_stags {
    my $x = shift;
    ([xref_key=>stag_sget($x,ACC)],
     [xref_dbname=>stag_sget($x,DBNAME)]);
}

sub _type {
    my $type = shift;
    my $ont = shift;
    [type=>[[term=>[
		    [acc=>$type],
		    [name=>$type],
		    [term_type=>$ont],
		   ]
	    ]]
    ];

}

sub _xref {
    my $id = shift;
    my ($dbname,$acc);
    if ($id =~ /(\w+):(\S+)/) {
        $dbname = $1;
        $acc = $2;
    }
    else {
        $dbname = '';
        $acc = $id;
    }
    return 
      [dbxref=>[
                [xref_dbname=>$dbname],
                [xref_key=>$acc]
               ]
      ];
}


1;
