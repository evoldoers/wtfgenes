# $Id: DB.pm,v 1.1 2007/01/24 01:16:20 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Model::DB;

=head1 NAME

  GO::Model::DB;

=head1 SYNOPSIS

=head1 DESCRIPTION

Fields: name fullname datatype generic_url url_syntax url_example


=cut


use Carp qw(cluck confess);
use Exporter;
use GO::Utils qw(rearrange);
use GO::Model::Root;
use strict;
use vars qw(@ISA);

@ISA = qw(GO::Model::Root Exporter);

sub _valid_params {
    return qw(name fullname datatype generic_url url_syntax url_example);
}


1;
