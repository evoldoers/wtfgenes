# $Id: GraphIterator.pm,v 1.11 2008/01/22 23:54:46 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself


package GO::Model::GraphIterator;

=head1 NAME

  GO::Model::GraphIterator;

=head1 SYNOPSIS

  $it = $graph->create_iterator;
  # returns a GO::Model::GraphIterator object

  while (my $ni = $it->next_node_instance) {
    $depth = $ni->depth;
    $term = $ni->term;
    $reltype = $ni->parent_rel->type;
    printf 
      "%s %8s Term = %s (%s)  // depth=%d\n",
          "----" x $depth,
          $reltype,
	  $term->name,
	  $term->public_acc,
          $depth;
  }

=head1 DESCRIPTION

=head1 SEE ALSO

L<GO::Model::Graph>

L<GO::Model::GraphNodeInstance>

=cut


use Carp;
use strict;
use Exporter;
use GO::Utils qw(rearrange);
use GO::Model::Graph;
use GO::Model::GraphNodeInstance;
use FileHandle;
use Exporter;
use Data::Dumper;
use vars qw(@EXPORT_OK %EXPORT_TAGS);

use base qw(GO::Model::Root Exporter);

sub _valid_params {
    return qw(graph acc order sort_by sort_by_list noderefs direction no_duplicates reltype_filter visited arcs_visited compact subset_h);
}

=head2 order

  Usage   - $graphiter->order("breadth");
  Returns - string
  Args    - string

gets/sets traversal order; breadth or depth; default is depth

=cut

=head2 direction

  Usage   - $graphiter->direction("up");
  Returns - string
  Args    - string

gets/sets direction; default is "down"

=cut

=head2 compact

  Usage   - $graphiter->compact(1);
  Returns - bool
  Args    - bool

set this if you dont want relationships to be traversed twice;
this gives a more compact tree representation of the graph

=cut

=head2 reltype_filter

  Usage   - $graphiter->reltype_filter(qw(is_a part_of))
  Returns - array
  Args    - array

by default, all relationship types are treated as transitive, and will
be traversed by the iterator

sometimes you dont want to traverse all relations, even if they are
transitive. For example, when answering the query "find all genes
expressed in the embryo" you way want subtypes of embryo and parts of
the embryo but not things that develop_from the embryo.

For more details, see
L<http://sourceforge.net/mailarchive/forum.php?thread_id=9448679&forum_id=43082>

=cut

sub _initialize {
    my $self = shift;
    my $acc;
    if (!ref($_[0])) {
        $acc = shift;
    }
    $self->SUPER::_initialize(@_);
    $acc = $self->acc unless $acc;
    $self->reset_cursor($acc);
}


=head2 reset_cursor

  Usage   -
  Returns -
  Args    -

=cut

sub reset_cursor {
    my $self = shift;
    my $acc = shift;

    $self->visited({});

    $self->arcs_visited({});

    my $terms;
    if ($acc) {
        $terms = [$self->graph->get_term($acc) || confess("$acc not in graph")];
    }
    else {
        if (!$self->direction || $self->direction ne "up") {
            $terms = $self->graph->get_top_nodes;
#            foreach (@$terms) {
#                printf "TOP: %s\n", $_->acc;
#            }
        }
        else {
            $terms = $self->graph->get_leaf_nodes;
        }
    }

    my $sort_by = $self->sort_by || "alphabetical";
    my $sort_by_list = $self->sort_by_list || [];
    #    print "<PRE>sort_by_list has ".scalar(@$sort_by_list)." elements , number of terms to sort = ".scalar(@$terms)."</PRE>\n"
    #      if ($sort_by eq 'pos_in_list');
    my %fh = 
      (
       "alphabetical" => sub {lc($a->name) cmp lc($b->name)},
       "pos_in_list" => sub {_sortby_pos_in_list($sort_by_list, $a, $b)}
      );
    my $sortf = $fh{$sort_by};
    confess("Dont know $sort_by") unless $sortf;
    my @sorted_terms = sort $sortf @$terms;

    my @noderefs =
      map { 
          GO::Model::GraphNodeInstance->new({term=>$_, depth=>0}) 
        } @sorted_terms;
    $self->noderefs(\@noderefs);
}


=head2 next_node

  Usage   -
  Returns - GO::Model::Term
  Args    -

=cut

sub next_node {
    my $self = shift;
    my $ni = $self->next_node_instance;
    return $ni ? $ni->term : undef;
}


=head2 next_node_instance

  Usage   -
  Returns - GO::Model::GraphNodeInstance
  Args    -

=cut

sub next_node_instance {
    my $self = shift;
    if (!$self->noderefs) {
        $self->reset_cursor;
    }
    my $noderefs = $self->noderefs;
    if (!@$noderefs) {
        return;
    }
    my $order = $self->order || "depth";
    my $noderef = shift @$noderefs;
    my $term = $noderef->term;
    my $depth = $noderef->depth;
    my @child_relns = ();
    my $dir = 
      (!$self->direction || $self->direction ne "up") ? "down" : "up";

    # default is to traverse a distance of 1 in the DAG
    # however, if subset_h is set, we want to traverse the
    # transitive distance to the next node in the specified subset
    my $subset_h = $self->subset_h;
    my @accs = ($term->acc);   # current IDs

    # iterate to next node - usually just 1 iteration, unless subset_h is set
    while (@accs) {
        my @this_child_relns = ();
        my $acc = shift @accs;
        if ($dir eq "down") {
            @this_child_relns = 
              @{$self->graph->get_child_relationships($acc)};
            if ($subset_h) {
                @this_child_relns =
                  grep {
                      if ($subset_h->{$_->acc2}) {
                          $_->acc1($term->acc);
                          1;
                      }
                      else {
                          push(@accs, $_->acc2);
                          0;
                      }
                  } @this_child_relns;
            }
        }
        elsif ($dir eq "up") {
            @this_child_relns = 
              @{$self->graph->get_parent_relationships($acc)};
            if ($subset_h) {
                @this_child_relns =
                  grep {
                      my $keep;
                      if ($subset_h->{$_->acc1}) {
                          $_->acc2($term->acc);
                          $keep=1;
                      }
                      else {
                          push(@accs, $_->acc1);
                          $keep=0;
                      }
                      $keep;
                  } @this_child_relns;
            }
        }
        else {
            die $dir;
        }
        push(@child_relns, @this_child_relns);
    }
    
    if ($self->reltype_filter) {
        my %filh = ();
        my $fs = $self->reltype_filter;
        $fs = [$fs] unless ref($fs);
        %filh = map {lc($_)=>1} @$fs;
	@child_relns =
          grep { $filh{lc($_->type)} } @child_relns;
    }

    if ($self->compact) {
        @child_relns =
          grep { !$self->arcs_visited->{$_->as_str} } @child_relns;
    }

    my @new = ();

    foreach (@child_relns) {
        $self->arcs_visited->{$_->as_str} = 1;
        my $t = $self->graph->get_term($dir ne "up" ? $_->acc2 : $_->acc1);
        if ($t) {
            my $h =
              {
               term=>$t,
               depth=>($depth+1), 
               parent_rel=>$_,
              };
            push(@new,
                 GO::Model::GraphNodeInstance->new($h));
        }
    } 
    
    my $sort_by = $self->sort_by || "alphabetical";
    my $sort_by_list = $self->sort_by_list || [];

    my %fh = 
      (
       "alphabetical" => sub {lc($a->term->name) cmp lc($b->term->name)},
       "pos_in_list" => sub {_sortby_pos_in_list($sort_by_list, $a->term, $b->term)}
      );
    my $sortf = $fh{$sort_by};
    confess("Dont know $sort_by") unless $sortf;

    @new = sort $sortf @new;

    my $visited = $self->visited;

    if ($self->no_duplicates) {
        # don't visit nodes twice
        @new = grep {!$visited->{$_->term->acc}} @new;
    }
    foreach (@new) {
        $visited->{$_->term->acc} = 1;
    }

    if ($order eq "breadth") {
	push(@$noderefs, @new);
    }
    else {
        # depth first:
	splice(@$noderefs, 0, 0, @new);
    }
    return $noderef;
}


=head2 flatten

  Usage   -
  Returns -
  Args    -

=cut

sub flatten {
    my $self = shift;
    my ($bracket, $fmt) =
      rearrange([qw(bracket fmt)], @_);

    my $str = "";
    $fmt ||= "%s";
    my $depth = 0;

    my $ob = $bracket ? substr($bracket, 0, 1) : "(";
    my $cb = $bracket ? substr($bracket, -1, 1) : ")";

    sub diffchr {
        my ($dd, $ob, $cb) = @_;
        my $ch;
        if ($dd < 0) {
            $ch = "$cb" x -$dd;
        }
        elsif ($dd > 0) {
            $ch = "$ob" x $dd;
        }
        else {
            $ch = "";
        }
    }

    while (my $ni = $self->next_node_instance) {
        my $dd = $ni->depth - $depth;

        my $ch = diffchr($dd, $ob, $cb);
        $depth = $ni->depth;
        $str .= 
          sprintf(" $ch $fmt",
                  $ni->term->public_acc,
                  $ni->term->name,
                  $ni->term->definition);
    }

    $str .= diffchr(-$depth, $ob, $cb);
    return $str;
}


=head2 _sortby_pos_in_list

Careful, this sort function work on Term objects, not GraphNodeInstance
objects.  Comparison is done by the name of the term.

=cut

sub _sortby_pos_in_list
  {
      my ($t_list, $t_a, $t_b) = @_;
      #    print "<PRE>_sortby called (".join(",",map {$_->name} @$t_list).") // ".$t_a->name." // ".$t_b->name."</PRE>\n";
      my $inf = 100000000;

      # First see which is first in list
      my $a_pos = _term_pos_in_list($t_list, $t_a);
      my $b_pos = _term_pos_in_list($t_list, $t_b);

      # If one is bigger than the other, return the bigger one.
      my $res = 0;
      my $name_cmp = lc($t_a->name) cmp lc($t_b->name);
      if (($a_pos >= 0) && ($b_pos >= 0))
        {
            # Both are in list
            if ($a_pos != $b_pos) {
                $res = ($a_pos <=> $b_pos);
            } else {
                $res = $name_cmp;
            }
        }
      elsif (($a_pos < 0) && ($b_pos < 0))
        {
            # Neither are in the list
            $res = $name_cmp;
        }
      else
        {
            # One is in the list and the other isn't
            $res = ($a_pos >= 0) ? 1 : -1;
        }

      return $res;
  }

sub _term_pos_in_list
  {
      my ($t_list, $t) = @_;

      # First see which is first in list
      my $out = -1;
      my $num_terms = scalar(@$t_list);
      for (my $i = 0; $i < $num_terms; $i++) {
          my $cur_t = @{$t_list}[$i];
          return $i if (lc($cur_t->name) eq lc($t->name));
      }

      return $out;
  }




1;
