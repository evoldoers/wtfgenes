package Data::Stag::JSONWriter;

=head1 NAME

  Data::Stag::JSONWriter - writes stag events into JSON files

=head1 SYNOPSIS


=cut

=head1 DESCRIPTION

=head1 PUBLIC METHODS -

=cut

use strict;
use base qw(Data::Stag::Writer);
use Data::Stag::Util qw(rearrange);
use JSON;

use vars qw($VERSION);
$VERSION="0.14";

sub fmtstr {
    return 'json';
}

sub end_stag {
    my $self = shift;
    my $stag = shift;
    my $obj = $self->stag2json($stag);

    my $json = JSON->new->allow_nonref;
    my $json_text = $json->pretty->encode( $obj );
    $self->addtext($json_text);
    return;
}

sub stag2json {
    my $self = shift;
    my $stag = shift;
    my $obj = {};
    if ($stag->isterminal) {
        return $stag->data;
    }
    else {
        my @nodes = $stag->subnodes;
        foreach my $n (@nodes) {
            my $v = $self->stag2json($n);
            if ($obj->{$n->name}) {
                if (ref($obj->{$n->name}) eq 'ARRAY') {
                    push(@{$obj->{$n->name}}, $v);
                }
                else {
                    $obj->{$n->name} = [$obj->{$n->name}, $v];
                }
            }
            else {
                # first
                $obj->{$n->name} = $v;
            }
        }
    }
    return $obj;
}


1;
