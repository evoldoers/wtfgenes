# $Id: xrf_abbs_parser.pm,v 1.2 2007/01/24 01:16:20 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::xrf_abbs_parser;

=head1 NAME

  GO::Parsers::xrf_abbs_parser     - syntax parsing of GO xrf_abbs flat files

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

Parses this file:

L<http://www.geneontology.org/doc/GO.xrf_abbs>


=cut

use Exporter;
use base qw(GO::Parsers::generic_tagval_parser);
use strict qw(subs vars refs);

sub _class { 'GOMetaModel:Database' }
sub _id_column {'abbreviation'}
sub _map_property_type { shift;return "GOMetaModel:".shift }

1;
