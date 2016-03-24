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
my $compress = 0;

GetOptions ("go=s" => \$go_filename,
	    "compress" => \$compress)
    or die("Error in command line arguments\n");

$go_filename = $ARGV[0] if @ARGV;

my $go_open_str = $go_filename =~ /\.gz$/ ? "gzip -cd $go_filename |" : "< $go_filename";

my $parser = new GO::Parser({handler=>'obj'});
$parser->parse($go_open_str);
my $graph = $parser->handler->graph;

sub mapTerms {
    my ($callback) = @_;
    my $iter = $graph->create_iterator;
    my @result;
    my %seen;
    while (my $ni = $iter->next_node_instance) {
	my $term = $ni->term;
	if ($term->acc =~ /^GO:/ && $seen{$term->acc}++ == 0) {
	    my @parents = @{$graph->get_parent_terms($term->acc)};
	    push @result, &$callback ($term->acc, [map ($_->acc, @parents)]);
	}
    }
    return @result;
}

my %termIdx;
my $nTerms = 0;
mapTerms (sub { $termIdx{$_[0]} = ++$nTerms });
my @t = mapTerms (sub { "[\"$_[0]\"" . join ("", map (",$_", $compress ? (sort {$a<=>$b} map ($termIdx{$_}, @{$_[1]})) : map(" \"$_\"", @{$_[1]}))) . "]" });

print "[", join (",\n ", @t), "]\n";
