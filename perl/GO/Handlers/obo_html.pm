# $Id: obo_html.pm,v 1.2 2004/09/07 23:51:03 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::obo_html     - 

=head1 SYNOPSIS

  use GO::Handlers::obo_html

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::obo_html;
use base qw(GO::Handlers::xsl_base);
use strict;

our $d = `dirname $0`;
chomp $d;
$ENV{XSLT_FILE} = "$d/../xml/xsl/obo_html.xsl";

1;
