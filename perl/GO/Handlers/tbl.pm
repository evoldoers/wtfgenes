# $Id: tbl.pm,v 1.3 2004/11/24 02:28:00 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::tbl     - 

=head1 SYNOPSIS

  use GO::Handlers::tbl

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS - 

=cut

# makes objects from parser events

package GO::Handlers::tbl;
use base qw(GO::Handlers::base);
use strict;


sub e_term {
    my $self = shift;
    my $t = shift;
    my $def = $t->get_def;
    my $defstr = '';
    if ($def) {
	$defstr = $def->get_defstr;
    }
    my @syns = $t->get_synonym;
    my @synstrs = map {$_->get_synonym_text} @syns;
    my @cols =
      ($t->get_id,
       $t->get_name,
       $defstr,
       join('; ', @synstrs));
    $self->print(join("\t", @cols));
    $self->print("\n");
    return;
}

sub e_prod {
    my $self = shift;
    my $p = shift;
    my $proddb = $self->up(1)->sget_proddb;
    my @cols =
      ($proddb,
       $p->get_prodacc,
       $p->get_prodsymbol,
       $p->get_prodtype,
       $p->get_prodtaxa,
       join('; ', map { ($_->get_is_not ? "NOT:" : "").$_->get_termacc  } $p->get_assoc),
      );
    $self->print(join("\t", @cols));
    $self->print("\n");
    return;

}


1;
