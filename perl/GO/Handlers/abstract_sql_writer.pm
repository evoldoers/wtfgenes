
package GO::Handlers::abstract_sql_writer;
use base qw(Data::Stag::Writer Exporter);
use strict;

sub out {
    my $self = shift;
    print "@_";
}

sub cmt {
    my $self = shift;
    my $cmt = shift;
    $self->out(" % $cmt") if $cmt;
    return;
}

sub sqlquote {
    my $s = shift;
    $s =~ s/\'/\\\'/g;
    "'$s'";
}

sub nl {
    shift->print("\n");
}

sub fact {
    my $self = shift;
    my $pred = shift;
    my @args = @{shift||[]};
    my $cmt = shift;
    $self->out(sprintf("INSERT INTO $pred VALUES (%s); ",
		       join(', ', map {sqlquote($_)} @args)));
    $self->cmt($cmt);
    $self->nl;
}


1;
