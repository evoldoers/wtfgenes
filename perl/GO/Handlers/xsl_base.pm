# $Id: xsl_base.pm,v 1.1 2004/03/04 23:18:09 bradmars Exp $
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

package GO::Handlers::xsl_base;
use base qw(GO::Handlers::base);
use XML::LibXML;
use XML::LibXSLT;

use strict;


sub e_obo {
    my $self = shift;
    my $obo_stag = shift;
    
    my $parser = XML::LibXML->new();
    my $source = $parser->parse_string($obo_stag->xml);
    
    my $xslt = XML::LibXSLT->new();
    my $file_name = $ENV{'XSLT_FILE'};
    my $styledoc = $parser->parse_file($file_name);
    my $stylesheet = $xslt->parse_stylesheet($styledoc);

    my $results = $stylesheet->transform($source);
    print $stylesheet->output_string($results);

}

1;
