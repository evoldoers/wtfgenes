# $Id: references_parser.pm,v 1.1 2006/12/06 02:59:07 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::references_parser;

=head1 NAME

  GO::Parsers::references_parser     - syntax parsing of GO.refences files

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

Parses this file:

L<http://www.geneontology.org/doc/GO.references>


=cut

use Exporter;
use base qw(GO::Parsers::generic_tagval_parser);
use strict qw(subs vars refs);

sub _class { 'GOModel:References' }
sub _id_column {'go_ref_id'}
1;
