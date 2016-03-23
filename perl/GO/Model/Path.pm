# $Id: Path.pm,v 1.5 2004/11/29 20:18:17 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself


package GO::Model::Path;

=head1 NAME

  GO::Model::Path;

=head1 SYNOPSIS

=head1 DESCRIPTION

represents a path between two nodes in a graph

  TODO: have the path be built of relationships rather than terms, so
  we can get the edgetypes in here

=cut


use Carp;
use Exporter;
use GO::Utils qw(rearrange);
use GO::Model::Root;
use strict;
use vars qw(@ISA);

@ISA = qw(GO::Model::Root Exporter);


sub _valid_params {
    return qw(link_list);
}


=head2 link_list

  Usage   -
  Returns - arrayref of alternating type, GO::Model::Term
  Args    -

=cut


=head2 term_list

  Usage   -
  Returns - arrayref of GO::Model::Term
  Args    -

gets/sets an ordered list of terms in the path

L<GO::Model::Term>

=cut

sub term_list {
    my $self = shift;
    my $links = $self->link_list || [];
    my @terms = ();
    for (my $i=1; $i<@$links; $i+=2) {
	push(@terms, $links->[$i]);
    }
    \@terms;
}


# add_link - private
sub add_link {
    my $self = shift;
    if (!$self->{link_list}) {
	$self->{link_list} = [];
    }
    push(@{$self->{link_list}}, shift, shift) if @_;
    $self->{link_list};
}


=head2 length

  Usage   - print $path->length
  Returns - int
  Args    -

=cut

sub length {
    my $self = shift;
    return scalar(@{$self->{link_list} || []})/2;
}


=head2 to_text

  Usage   -
  Returns -
  Args    -

=cut

sub to_text {
    my $self = shift;
    my $use = shift;
    my $links = $self->link_list || [];
    my @parts = ();
    for (my $i=0; $i<@$links; $i+=2) {
	my $t = $links->[$i+1];
	push(@parts, "[$links->[$i]]", $use && $use eq 'acc' ? $t->acc : $t->name);
    }
    return
      join(' ', @parts);
}

=head2 duplicate

  Usage   -
  Returns -
  Args    -

=cut

sub duplicate {
    my $self = shift;
    my $dup = $self->new;
    $dup->link_list([@{$self->link_list || []}]);
    $dup;
}


1;
