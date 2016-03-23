package GO::Parsers::obj_storable_parser;
use GO::Parsers::ParserEventNames;
use strict;
use base qw(GO::Parsers::obj_emitter GO::Parsers::base_parser);
use GO::Model::Graph;
use Storable qw(fd_retrieve);

sub parse_fh {
    my ($self, $fh) = @_;
#    my $t=time;
#    print STDERR "RETRIEVING FROM CACHE $t\n"; 
    my $g = fd_retrieve($fh);
    if ($self->handler->isa("GO::Handler::obj")) {
        $self->handler->g($g);
        $self->start_event(OBO);
        $self->end_event(OBO);
    }
    else {
        $self->emit_graph($g);
    }
#    my $t2 = time;
#    my $td = $t2-$t;
#    print STDERR "GOT FROM CACHE $t2 [$td]\n"; 
    return $g;
}


1;
