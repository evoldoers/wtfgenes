# $Id: Property.pm,v 1.2 2004/11/24 02:28:02 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Model::Property;

=head1 NAME

  GO::Model::Property;

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
    return qw(acc name domain_acc range_acc textrule);
}


1;
