# $Id: obj.pm,v 1.24 2008/01/17 20:08:14 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::obj     - parses GO files into GO object model

=head1 SYNOPSIS

  use GO::Handlers::obj

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS

=cut

# makes objects from parser events

package GO::Handlers::obj;
use Data::Stag qw(:all);
use GO::Parsers::ParserEventNames;
use base qw(GO::Handlers::base);
use strict qw(vars refs);

my $TRACE = $ENV{GO_TRACE};

sub init {
    my $self = shift;
    $self->SUPER::init;

    use GO::ObjCache;
    my $apph = GO::ObjCache->new;
    $self->{apph} = $apph;

    use GO::Model::Graph;
    my $g = $self->apph->create_graph_obj;
    $self->{g} = $g;
    return;
}


=head2 graph

  Usage   - my $terms = $obj_handler->graph->get_all_terms;
  Synonym - g
  Synonym - ontology
  Returns - GO::Model::Graph object
  Args    -

as files are parsed, objects are created; depending on what kind of
datatype is being parsed, the classes of the created objects will be
different - eg GO::Model::Term, GO::Model::Association etc

the way to access all of thses is through the top level graph object

eg

  $parser = GO::Parser->new({handler=>'obj'});
  $parser->parse(@files);
  my $graph = $parser->graph;

=cut

sub g {
    my $self = shift;
    $self->{g} = shift if @_;
    return $self->{g};
}

*graph = \&g;
*ontology = \&g;

sub apph {
    my $self = shift;
    $self->{apph} = shift if @_;
    return $self->{apph};
}

sub root_term {
    my $self = shift;
    $self->{_root_term} = shift if @_;
    return $self->{_root_term};
}

# 20041029 - not currently used
sub add_root {
    my $self = shift;
    my $g = $self->g;

    my $root = $self->apph->create_term_obj;
    $root->name('root');
    $root->acc('root');
    $g->add_term($root);
    $self->root_term($root);
    $self->root_to_be_added(1);
    $root;
}

# -- HANDLER METHODS --

sub e_obo {
    my $self = shift;
    my $g = $self->g;
    return ();
}

sub e_typedef {
    my $self = shift;
    my $t = shift;
    $self->stanza('Typedef', $t);
}

sub e_term {
    my $self = shift;
    my $t = shift;
    $self->stanza('Term', $t);
}

sub e_instance {
    my $self = shift;
    my $t = shift;
    $self->stanza('Instance', $t);
}

sub stanza {
    my $self = shift;
    my $stanza = lc(shift);
    my $tree = shift;
    my $acc = stag_get($tree, ID);
    if (!$acc) {
        $self->throw( "NO ACC: $@\n" );
    }
    my $term;
    eval {
        $term = $self->g->get_term($acc);
    };
    if ($@) {
        $self->throw( "ARG:$@" );
    }
    # no point adding term twice; we
    # assume the details are the same
    return $term if $term && $self->strictorder;

    $term = $self->apph->create_term_obj;

    if ($stanza eq 'typedef') {
        $term->is_relationship_type(1);
    }
    if ($stanza eq 'instance') {
        $term->is_instance(1);
    }

    my %h = ();
    foreach my $sn (stag_kids($tree)) {
        my $k = $sn->name;
        my $v = $sn->data;

        if ($k eq RELATIONSHIP) {
            my $obj = stag_get($sn, TO);
            $self->g->add_relationship($obj, $term->acc, stag_get($sn, TYPE));
        }
        elsif ($k eq IS_A) {
            $self->g->add_relationship($v, $term->acc, IS_A);
        }
        elsif ($k eq INSTANCE_OF) {
            $self->g->add_relationship($v, $term->acc, INSTANCE_OF);
        }
        elsif ($k eq DEF) {
            my $defstr = stag_get($sn, DEFSTR);
	    my @xrefs = stag_get($sn, DBXREF);
	    $term->definition($defstr);
	    $term->add_definition_dbxref($self->dbxref($_)) foreach @xrefs;
        }
        elsif ($k eq SYNONYM) {
            my $synstr = stag_get($sn, SYNONYM_TEXT);
            my $type = stag_find($sn, 'scope');
	    my @xrefs = stag_get($sn, DBXREF);
	    $term->add_synonym_by_type($type ? lc($type) : '', $synstr);
#	    $term->add_definition_dbxref($_) foreach @xrefs;
        }
        elsif ($k eq ALT_ID) {
	    $term->add_alt_id($v);
        }
        elsif ($k eq CONSIDER) {
	    $term->add_consider($v);
        }
        elsif ($k eq REPLACED_BY) {
	    $term->add_replaced_by($v);
        }
        elsif ($k eq ALT_ID) {
	    $term->add_alt_id($v);
        }
        elsif ($k eq XREF_ANALOG || $k eq XREF) {
            my $xref =
	      $self->apph->create_xref_obj(stag_pairs($sn));
            $term->add_dbxref($xref);
        }
        elsif ($k eq XREF_UNKNOWN) {
            my $xref =
	      $self->apph->create_xref_obj(stag_pairs($sn));
            $term->add_dbxref($xref);
        }
        elsif ($k eq ID) {
            $term->acc($v);
        }
        elsif ($k eq NAMESPACE) {
            $term->namespace($v);
        }
        elsif ($k eq NAME) {
            $term->name($v);
        }
        elsif ($k eq SUBSET) {
            $term->add_subset($v);
        }
        elsif ($k eq COMMENT) {
            $term->comment($v);
        }
        elsif ($k eq IS_ROOT) {
            $term->is_root($v);
        }
        elsif ($k eq BUILTIN) {
            # ignore
        }
        elsif ($k eq PROPERTY_VALUE) {
            # ignore
        }
        elsif ($k eq IS_METADATA_TAG) {
            # ignore
        }
        elsif ($k eq IS_OBSOLETE) {
            $term->is_obsolete($v);
        }
        elsif ($k eq IS_TRANSITIVE ||
               $k eq IS_SYMMETRIC  ||
               $k eq IS_ANTI_SYMMETRIC  ||
               $k eq IS_REFLEXIVE  ||
               $k eq INVERSE_OF ||
               $k eq TRANSITIVE_OVER ||
               $k eq DOMAIN ||
               $k eq RANGE) {
            my $m = lc($k);
            $term->$m($v);
        }
        elsif ($term->can("add_$k")) {
            # CONVENIENCE METHOD - map directly to object method
            warn("add method for $k");
            my $m = "add_$k";
            $term->$m($v);
        }
        elsif ($term->can($k)) {
            warn("add method for $k");
            # CONVENIENCE METHOD - map directly to object method
            $term->$k($v);
        }
        elsif ($k eq INTERSECTION_OF) {
            my $rel = stag_get($sn, TYPE);
            my $obj = stag_get($sn, TO);
            my $isect = [$rel,$obj];
            my $ns = stag_find($sn, 'namespace');
            if (!$rel) {
                shift @$isect;
            }
            my $ldef = $term->logical_definition;
            if (!$ldef) {
                $ldef = $self->apph->create_logical_definition_obj();
                $term->logical_definition($ldef);
            }
            $ldef->namespace($ns) if ($ns);
            $ldef->add_intersection($isect);
        }
        elsif ($k eq UNION_OF) {
            my $obj = stag_get($sn, TO);
            $term->add_equivalent_to_union_of_term($obj);
        }
        elsif ($k eq DISJOINT_FROM) {
            $term->add_disjoint_from_term($v);
        }
        else {
#            warn("add method for $k");
            $term->stag->add($k, $v);

#            $self->throw("don't know what to do with $k");
#            print "no $k\n";
        }
    }
    if ($self->root_to_be_added &&
	!$term->is_obsolete &&
        $stanza eq 'term') {
	my $parents = $self->g->get_parent_relationships($term->acc);
	if (!@$parents) {
	    my $root = $self->root_term || $self->throw("no root term");
            $self->g->add_relationship($root, $term->acc, IS_A);
	}
    }

#    $term->type($self->{ontology_type}) unless $term->type;
    if (!$term->name) {
#        warn("no name; using acc ".$term->acc);
#        $term->name($term->acc);
    }

    $self->g->add_term($term);
    printf STDERR "Added term %s %s\n", $term->acc, $term->name 
      if $TRACE;
#    $term;
    return ();
}

sub dbxref {
    my $self = shift;
    my $x = shift;
    $self->apph->create_xref_obj(stag_pairs($x))
}


sub e_proddb {
    my $self = shift;
    $self->proddb(shift->data);
    return;
}

sub e_prod {
    my $self = shift;
    my $tree = shift;
    my $g = $self->g;
    my $prod =
      $self->apph->create_gene_product_obj({symbol=>stag_sget($tree, PRODSYMBOL),
                                            type=>stag_sget($tree, PRODTYPE),
                                            full_name=>stag_sget($tree, PRODNAME),
                                            speciesdb=>$self->proddb,
                                      });
    my @syns = stag_get($tree, PRODSYN);
    $prod->xref->xref_key(stag_sget($tree, PRODACC));
    $prod->synonym_list(\@syns);
    my @assocs = stag_get($tree, ASSOC);
    my $taxid = stag_get($tree, PRODTAXA);
    my $species;
    if ($taxid) {
        $species =       
          $self->apph->create_species_obj({ncbi_taxa_id=>$taxid});
        $prod->species($species);

    }
    foreach my $assoc (@assocs) {
        my $acc = stag_get($assoc, TERMACC);
        if (!$acc) {
            $self->message("no accession given");
            next;
        }

        
        my $t = $g->get_term($acc);
        if (!$t) {
            if (!$self->strictorder) {
                $t = $self->apph->create_term_obj({acc=>$acc});
                $self->g->add_term($t);
            }
            else {
                $self->message("no such term $acc");
                next;
            }
        }
        my $aspect = stag_get($assoc, ASPECT);
        if ($aspect) {
            $t->set_namespace_by_code($aspect);
        }

        my @evs = stag_get($assoc, EVIDENCE);
        my $ao =
          $self->apph->create_association_obj({gene_product=>$prod,
                                               is_not=>stag_sget($assoc, IS_NOT),
                                              });
        my $date = stag_get($assoc,ASSOCDATE);
        $ao->assocdate($date) if $date;

        my $assigned_by = stag_get($assoc,SOURCE_DB);
        $ao->assigned_by($assigned_by) if $assigned_by;

        foreach my $ev (@evs) {
            my $eo =
              $self->apph->create_evidence_obj({
                                                code=>stag_sget($ev, EVCODE),
                                               });
            my @seq_xrefs = stag_get($ev, WITH),
            my @refs = stag_get($ev, REF);
            map { $eo->add_seq_xref($_) } @seq_xrefs;
            map { $eo->add_pub_xref($_) } @refs;
            $ao->add_evidence($eo);
        }
        $t->add_association($ao);
    }
    return;
}

1;
