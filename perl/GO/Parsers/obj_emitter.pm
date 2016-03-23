# $Id: obj_emitter.pm,v 1.3 2006/08/13 02:02:37 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::obj_emitter;

=head1 NAME

GO::Parsers::obj_emitter     - 

=head1 SYNOPSIS

do not use this class directly; use GO::Parser

=head1 DESCRIPTION

This is not a file parser - it takes a L<GO::Model::Graph> object as
inputs and fires OBO XML events

=cut

use Exporter;
use base qw(GO::Parsers::base_parser);
use GO::Parsers::ParserEventNames;
use GO::Model::Graph;

use Carp;
use FileHandle;

use strict;

our @TAGS =
  qw(id
     name
     alt_id*
     namespace
     comment
     def
     subset*
     is_a*
     relationship*
     is_root
     is_obsolete
     is_transitive
     synonym*
     xref_analog*
     xref_unknown*
    );

sub dtd {
    'obo-parser-events.dtd';
}

sub emit_graph {
    my ($self, $g) = @_;

    $self->start_event(OBO);
    $self->fire_source_event($self->file || "object");
    $self->start_event(HEADER);
    $self->end_event(HEADER);

    $g->iterate(sub {
                    my $ni = shift;
                    $self->emit_term($ni->term, $g);
                    return;
                });
    $self->end_event(OBO);
}

sub emit_term {
    my ($self, $t, $g) = @_;
    my $stanza = TERM;
    if ($t->is_relationship_type) {
        $stanza = TYPEDEF;
    }
    $self->start_event($stanza);

    my $parent_rels = $g->get_parent_relationships($t->acc);
    foreach my $xtag (@TAGS) {
        my $multiple = 0;
        my $tag = $xtag;
        if ($xtag =~ /(.*)\*$/) {
            $tag = $1;
            $multiple = 1;
        }

        if ($tag eq ID) {
            $self->event(ID, $t->acc);
        }
        elsif ($tag eq IS_ROOT) {
            $self->event(IS_ROOT, 1)
              unless @$parent_rels;
        }
        elsif ($tag eq IS_OBSOLETE) {
            $self->event(IS_OBSOLETE, 1)
              if $t->is_obsolete;
        }
        elsif ($tag eq IS_TRANSITIVE ||
               $tag eq IS_SYMMETRIC  ||
               $tag eq IS_ANTI_SYMMETRIC  ||
               $tag eq IS_REFLEXIVE  ||
               $tag eq INVERSE_OF) {
            # obo extensions - not dealt with yet
        }
        elsif ($tag eq XREF_ANALOG || $tag eq XREF_UNKNOWN) {
            $self->event($tag=>dbxref($_))
              foreach @{$t->dbxref_list || []};
        }
        elsif ($tag eq DEF) {
            my $xrefs = $t->definition_dbxref_list || [];
            $self->event(DEF, 
                         [[DEFSTR, $t->definition],
                          map {
                              [DBXREF,dbxref($_)]
                          } @$xrefs
                         ]);
        }
        elsif ($tag eq SYNONYM) {
            my $sh = $t->synonyms_by_type_idx || {};
            foreach my $type (keys %$sh) {
                foreach my $val (@{$sh->{$type} || []}) {
                    $self->event(SYNONYM,
                                 [['@'=>[[scope=>$type]]],
                                  [SYNONYM_TEXT,$val]]);
                }
            }
        }
        elsif ($tag eq IS_A) {
            foreach (grep {$_->type eq 'is_a'} @$parent_rels) {
                $self->event(IS_A, $_->parent_acc)
            }
        }
        elsif ($tag eq RELATIONSHIP) {
            foreach (grep {$_->type ne 'is_a'} @$parent_rels) {
                $self->event(RELATIONSHIP,
                             [[TYPE,$_->type],
                              [TO,$_->parent_acc]
                             ]);
            }
                
        }
        else {
            if ($multiple) {
                my $method = $tag.'_list';
                my $vals = $t->$method();
                $self->event($tag, $_)
                  foreach @$vals;
            }
            else {
                if ($t->can($tag)) {
                    my $v = $t->$tag();
                    $self->event($tag, $v) if defined $v;
                }
                else {
                    warn("no method for: $tag");
                }
            }
        }
    }

    $self->end_event($stanza);
}

sub dbxref {
    my $xref = shift || confess;
    my $name = $xref->name;
    return 
      [[acc=>$xref->acc],
       [dbname=>$xref->dbname],
       $name ? [name=>$xref->name] : ()
      ];
}

1;
