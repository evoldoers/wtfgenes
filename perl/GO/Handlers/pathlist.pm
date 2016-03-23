package GO::Handlers::pathlist;
use base qw(GO::Handlers::obj);
use strict;

sub e_obo {
    my $self = shift;
    my $g = $self->g;
    $self->export_graph($g);
}

sub export_graph {
    my $self = shift;
    my $g = shift;

    $g->iterate(sub {
		     my $n=shift->term;
		     my $paths = $g->paths_to_top($n->acc);
		     foreach my $path (@$paths) {
			 $self->print($n->acc . " ");
			 $self->print($path->to_text('acc'));
			 $self->print("\n");
		     }
		 });
}

1;
