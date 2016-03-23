# $Id: go_ont.pm,v 1.1 2004/01/27 23:52:24 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::go_ont     - 

=head1 SYNOPSIS

  use GO::Handlers::go_ont

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::go_ont;
use base qw(GO::Handlers::obj);
use strict;

sub e_obo {
    my $self = shift;
    my $g = $self->g;

    $g->to_text_output(-fmt=>'gotext',
		       -fh=>$self->safe_fh,
		      );
}

1;
