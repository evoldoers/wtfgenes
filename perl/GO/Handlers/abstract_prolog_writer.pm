
package GO::Handlers::abstract_prolog_writer;
use base qw(GO::Handlers::base Exporter);
use strict;

sub out {
    my $self = shift;
    $self->print("@_");
}

sub cmt {
    my $self = shift;
    my $cmt = shift;
    $self->out(" % $cmt") if $cmt;
    return;
}

sub prologquote {
    my $s = shift;
    my $force = shift;
    if (ref($s)) {
        if (ref($s) ne 'HASH') {
            sprintf("[%s]",
                    join(',',map{prologquote($_)} @$s));
        }
        else {
            my @keys = keys %$s;
            if (@keys == 1) {
                my $functor = $keys[0];
                my $args = $s->{$functor};
                sprintf("$functor(%s)",
                        join(', ', map {prologquote($_)} @$args));
            }
            else {
                warn "@keys != 1 - ignoring";
            }
        }
    }
    else {
        $s = '' unless defined $s;
        if ($s =~ /^[\-]?[0-9]+$/ && !$force) {
            return $s;
        }
        $s =~ s/\'/\'\'/g;
        "'$s'";
    }
}

sub nl {
    shift->print("\n");
}

sub fact {
    my $self = shift;
    my $pred = shift;
    my @args = @{shift||[]};
    my $cmt = shift;
    $self->out(sprintf("$pred(%s).",
		       join(', ', map {prologquote($_)} @args)));
    $self->cmt($cmt);
    $self->nl;
}

# ensure all fields are quoted
sub factq {
    my $self = shift;
    my $pred = shift;
    my @args = @{shift||[]};
    my $cmt = shift;
    $self->out(sprintf("$pred(%s).",
		       join(', ', map {prologquote($_,1)} @args)));
    $self->cmt($cmt);
    $self->nl;
}

1;
