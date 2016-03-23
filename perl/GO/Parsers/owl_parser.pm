# $Id: owl_parser.pm,v 1.3 2005/04/19 04:35:50 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::owl_parser;

=head1 NAME

  GO::Parsers::owl_parser.pm     - turns OWL XML into event stream

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

this parser does a direct translation of XML to events, passed on to the handler

=head1 AUTHOR

=cut

use Exporter;
use base qw(GO::Parsers::base_parser Data::Stag::XMLParser);

sub xslt { 'owl_to_oboxml' }


1;
