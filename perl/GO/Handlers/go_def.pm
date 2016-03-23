# $Id: go_def.pm,v 1.3 2005/03/22 04:51:08 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::go_def     - 

=head1 SYNOPSIS

  use GO::Handlers::go_def

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::go_def;
use GO::Parsers::ParserEventNames;
use Data::Stag qw(:all);
use base qw(GO::Handlers::base);
use strict;


sub e_term {
    my $self = shift;
    my $t = shift;
    my $n = stag_get($t, NAME);
    my $def = stag_get($t, DEF);
    if ($def) {
        $self->tag(term => $n);
        $self->tag(goid => stag_sget($t, ID));
        $self->tag(definition => stag_sget($def, DEFSTR));
        $self->tag(definition_reference => stag_sget($_,DBNAME).':'.stag_sget($_,ACC)) foreach stag_get($def, DBXREF);
        $self->tag(comment => stag_sget($t, COMMENT));

        $self->print("\n");
    }
    return;

}

sub tag {
    my $self = shift;
    my ($t, $v) = @_;
    return unless $v;
    $self->printf("%s: %s\n", $t, $v);
    return;
}


1;
