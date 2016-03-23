package GO::Parsers::obj_yaml_parser;
use strict;
use base qw(GO::Parsers::obj_emitter GO::Parsers::base_parser);
use GO::Model::Graph;
use YAML;

sub parse_fh {
    my ($self, $fh) = @_;
    my $str = join('',<$fh>);
    $fh->close;
    my $g = Load($str);
    $self->emit_graph($g);
    return $g;
}


1;
