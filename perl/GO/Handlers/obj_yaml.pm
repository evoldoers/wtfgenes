package GO::Handlers::obj_yaml;
use base qw(GO::Handlers::obj);
use strict;
use YAML;

sub e_obo {
    my $self = shift;
    my $g = $self->g;
    $self->print(Dump $g);
    return;
}

1;
