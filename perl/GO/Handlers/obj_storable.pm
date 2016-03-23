package GO::Handlers::obj_storable;
use base qw(GO::Handlers::obj);
use strict;
use FileHandle;
use Storable qw(store_fd);

sub e_obo {
    my $self = shift;
    my $fh = $self->fh;
    if (!$fh) {
        my $f = $self->file;
        if ($f) {
            $fh = FileHandle->new(">$f") ||
              $self->throw("cannot write to: $f");
        }
        else {
            $self->throw("$self requires file or fh");
        }
    }
    my $g = $self->g;
    store_fd $g, $fh;
    return;
}

1;
