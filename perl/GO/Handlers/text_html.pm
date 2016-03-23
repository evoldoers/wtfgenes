# $Id: text_html.pm,v 1.5 2004/07/02 17:46:48 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::text_html     - 

=head1 SYNOPSIS

  use GO::Handlers::text_html

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::text_html;
use base qw(GO::Handlers::xsl_base);
use strict;

$ENV{XSLT_FILE} = "$ENV{GO_ROOT}/xml/xsl/text_html.xsl";

1;

