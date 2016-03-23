# $Id: ObjCache.pm,v 1.3 2005/05/20 18:46:57 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::ObjCache;

=head1 NAME

  GO::ObjCache;

=head1 DESCRIPTION

This is a kind of L<GO::ObjFactory> - you should not need to use this
method directly

=cut

use Carp;
use strict;
use Exporter;
use GO::Utils qw(rearrange);
#use strict;
use FileHandle;
use Exporter;
use vars qw(@ISA);
use strict;

use base qw(GO::Model::Graph GO::ObjFactory);

sub _valid_params {
    return qw(dbh);
}

sub _initialize {
    my $self = shift;
    $self->SUPER::_initialize(@_);
}

sub apph {
    my $self = shift;
    $self->{apph} = shift if @_;
    return $self->{apph} || $self;
}

sub n_deep_associations {
    my $self = shift;
    my $acc = shift;
    $self->extend_down([$acc]);   # make sure all terms loaded
    $self->SUPER::n_deep_associations($acc);
}

sub deep_association_list {
    my $self = shift;
    my $acc = shift;
    $self->extend_down([$acc]);   # make sure all terms loaded
    $self->SUPER::deep_association_list($acc);
}

#------

sub extend_graph_by_acc {
    my $self = shift;
    my $graph = shift;
    my $acc = shift;
    my $depth = shift;

    my $term = $self->get_term($acc);
    $self->extend_up($graph, [$acc]);
    $self->extend_down($graph, [$acc], $depth);

}

sub extend_up {
    my $self = shift;
    my $graph = shift;
    my @accs = @{shift || []};
    my $i=0;
    while ($i < scalar(@accs)) {
	my $acc = $accs[$i];
	$i++;
	my $term = $self->get_term($acc);
	$graph->add_term($term);
	my $parent_rels = $self->get_parent_relationships($acc);
	foreach my $rel (@$parent_rels) {
	    $graph->add_relationship($rel);
	    if (!(grep {$_ == $rel->acc1} @accs)) {
		# only put new accs in
		push(@accs, $rel->acc1);
	    }
	}
    } @accs;
}

sub extend_down {
    my $self = shift;
    my $graph = shift;
    my @accs = @{shift || []};
    my $max_depth = shift;

    my $i=0;
    while ($i < scalar(@accs)) {
	printf STDERR
	  "======== %d %d %s\n",
	  $i,
	  $#accs,
	  join(", ", @accs);
	my $acc = $accs[$i];
	$i++;
	my $term = $self->get_term($acc);
	$graph->add_term($term);
	my $child_rels = $self->get_child_relationships($acc);
	foreach my $rel (@$child_rels) {
	    $graph->add_relationship($rel);
	    if (!(grep {$_ == $rel->acc2} @accs)) {
		# only put new accs in
		push(@accs, $rel->acc2);
	    }
	}
    } @accs;
    
}

sub get_deep_product_count { 0 }

1;
