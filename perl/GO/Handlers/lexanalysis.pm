# stag-handle.pl -p GO::Parsers::GoOntParser -m <THIS> function/function.ontology

package GO::Handlers::lexanalysis;
use base qw(Data::Stag::Writer Exporter);
use strict;


sub e_term {
    my ($self, $term) = @_;
    my $name = $term->get_name;
    my $ont = $term->get_ontology;
    return if $term->get_is_obsolete;
    my @words = split(/[\W_]/, $name);

    for (my $i=0; $i < @words; $i++) {
#	my $w = $words[$i];
#	$self->fact(windex => [$ont, $i, ($i-@words)+1, $w, $name]);
	for (my $j = 0; $j<3; $j++) {
	    if ($i+$j < @words) {
		my @set = @words[($i..($i+$j))];
		my $size = $j+1;
		$self->fact("w$size"=> [$i, ($i+$j+1)-@words, @set, $ont, $name]);
	    }
	}
    }
    $self->nl;
    return;
}

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

sub prologquote {
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
    $self->out(sprintf("$pred(%s).",
		       join(', ', map {prologquote($_)} @args)));
    $self->cmt($cmt);
    $self->nl;
}

1;
