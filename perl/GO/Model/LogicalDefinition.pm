# $Id: LogicalDefinition.pm,v 1.1 2006/04/05 22:47:57 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Model::LogicalDefinition;

=head1 NAME

  GO::Model::LogicalDefinition;

=head1 SYNOPSIS

=head1 DESCRIPTION

=cut


use Carp qw(cluck confess);
use Exporter;
use GO::Utils qw(rearrange);
use GO::Model::Root;
use strict;
use vars qw(@ISA);

@ISA = qw(GO::Model::Root Exporter);

sub _valid_params {
    return qw(intersection_list);
}

=head2 intersection_list

 Usage   -
 Returns -
 Args    -

Each element of the list is itself a list

This list is of length 1 or 2.

  [$generic_term_acc]
  [$relation,$differentiating_term_acc]

=cut


=head2 generic_term_acc

  Usage   -
  Synonyms - genus_acc
  Returns -
  Args    -

the ID of the generic term, also known as 'genus'

=cut

sub generic_term_acc {
    my $self = shift;
    if (@_) {
        my $acc = shift;
        my $diffs = $self->differentia;
        push(@{$self->intersection_list},$acc);
        return $acc;
    }
    my @direct_accs =
      grep {scalar(@$_) == 1} @{$self->intersection_list};
    if (@direct_accs > 1) {
        $self->throw("multiple generic terms");
    }
    if (@direct_accs) {
        return $direct_accs[0]->[0]; 
    }
    # no genus
    return;
}
*genus_acc = \&generic_term_acc;

=head2 differentia

Usage   -
 Returns -
 Args    -

=cut

sub differentia {
    my $self = shift;
    if (@_) {
        my $diffs = shift;
        my $genus = $self->generic_term_acc;
        $self->intersection_list([$genus, $diffs]);
        return $diffs;
    }
    my @diffs =
      grep {scalar(@$_) > 1} @{$self->intersection_list};
    return \@diffs;
}

1;
