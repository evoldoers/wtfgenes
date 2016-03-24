#!/usr/bin/perl -w

sub add_term {
    if (defined $t) {
	push @term, "[\"$t\"" . join ("", map (", \"$_\"", @p)) . "]";
	$t = undef;
	@p = ();
    }
}

while (<>) {
    if (/^\[Term\]/) {
	add_term();
    } elsif (/^id: (GO:\d+)/) {
	$t = $1;
    } elsif (/^is_a: (GO:\d+)/) {
	push @p, $1;
    } elsif (/^is_obsolete/) {
	$t = undef;
	$p = ();
    }
}
add_term();

print "[", join (",\n ", @term), "]\n";
