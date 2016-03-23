# $Id: go_xref.pm,v 1.1 2004/01/27 23:52:24 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::go_xref     - 

=head1 SYNOPSIS

  use GO::Handlers::go_xref

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::go_xref;
use base qw(GO::Handlers::base);
use strict;


sub e_term {
    my $self = shift;
    my $t = shift;
    my $name = $t->sget_name;
    my $id = $t->sget_id;
    foreach ($t->get_xref_analog) {
	$self->printf("%s:%s > $name ; $id\n",
		      $_->sget_dbname, $_->sget_acc);
    }
    return;
}


1;
