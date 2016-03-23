#!/usr/bin/perl -w

BEGIN {
    use Cwd 'abs_path';
    my $path = abs_path($0);
    $path =~ s/\/[^\/]+$//;
    push @INC, $path;
}

use GO::Parser;

my $file = "goslim_generic.obo";
my $acc = 'GO:0006397';

my $parser = new GO::Parser({handler=>'obj'});
$parser->parse("goslim_generic.obo");
my $graph = $parser->handler->graph;
my $term = $graph->get_term($acc);

my $ancestor_terms = $graph->get_recursive_parent_terms($term->acc);
foreach my $anc_term (@$ancestor_terms) {
    printf "  Ancestor term: %s %s\n", $anc_term->acc, $anc_term->name;
}

my @term = ($term);
while (@term) {
    my $t = shift @term;
    my @p = @{$graph->get_parent_terms($t->acc)};
    warn "Parents of ", $t->acc, " ... ", join(" ",map($_->acc,@p)), "\n";
    push @term, @p;
}
