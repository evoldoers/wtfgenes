# $Id: summary.pm,v 1.3 2004/11/24 02:28:00 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::summary     - 

=head1 SYNOPSIS

=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS - 

=cut

package GO::Handlers::summary;
use base qw(GO::Handlers::base);

sub init {
    my $self = shift;
    $self->{i} = 0;
    $self->{counts} = {};
}

sub count {
    my $self = shift;
    my $type = shift;
    if (!$self->{counts}->{$type}) {
	$self->{counts}->{$type} = 0;
    }
    $self->{counts}->{$type}++;
}

sub start_event {
    my $self = shift;
    my $ev = shift;
    return;
}

sub end_event {
    my $self = shift;
    my $ev = shift;
    $self->count($ev);
    if ($ev eq "assocs") {
	print "TOTAL ASSOCS  : $self->{counts}->{assoc}\n";
	print "TOTAL PRODUCTS: $self->{counts}->{prod}\n";
	print "TOTAL DBSETS  : $self->{counts}->{dbset}\n";
    }
    if ($ev eq "obo") {
	print "TOTAL TERMS   : $self->{counts}->{term}\n";
	print "TOTAL DEFS    : $self->{counts}->{def}\n" if $self->{counts}->{def};
	print "TOTAL SYNS    : $self->{counts}->{synonym}\n";
	print "TOTAL RELS    : $self->{counts}->{relationship}\n" if $self->{counts}->{relationship};
	print "TOTAL XREFS   : $self->{counts}->{xref_analog}\n";
    }
    if ($ev eq "defs") {
	print "TOTAL DEFS    : $self->{counts}->{def}\n";
    }
    if ($ev eq "dbxrefs") {
	print "TOTAL TERMXREFS : $self->{counts}->{termdbxref}\n";
    }
    #return $self->SUPER::end_event($ev);
    return;
}

#sub e_term {
#    my $self = shift;
#    my $term = shift;
#    my $ns = shift;
#    return;
#}

sub event {
    my $self = shift;
    my $ev = shift;
    my @args = @_;
    my $arg = $args[0];
    if (!ref($arg)) {
    }
    else {
        $self->start_event($ev);
        $self->evbody(@args);
        $self->end_event($ev);
    }
}

1;
