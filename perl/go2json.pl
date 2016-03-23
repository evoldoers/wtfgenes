#!/usr/bin/perl -w

BEGIN {
    use Cwd 'abs_path';
    my $path = abs_path($0);
    $path =~ s/\/[^\/]+$//;
    push @INC, $path;
}

use GO::Parser;
use Getopt::Long;
my $go_filename = "goslim_generic.obo";

GetOptions ("go=s" => \$go_filename)
    or die("Error in command line arguments\n");

my $parser = new GO::Parser({handler=>'obj'});
$parser->parse($go_filename);
my $graph = $parser->handler->graph;

my $iter = $graph->create_iterator;
print "[\n";
while (my $ni = $iter->next_node_instance) {
    my $term = $ni->term;
    if ($term->acc =~ /^GO:/) {
	my @parents = @{$graph->get_parent_terms($term->acc)};
	print ' ["', $term->acc, '"', map (', "' . $_->acc . '"', @parents), "]\n";
    }
}
print "]\n";
