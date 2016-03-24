#!/usr/bin/perl -w

BEGIN {
    use Cwd 'abs_path';
    my $path = abs_path($0);
    $path =~ s/\/[^\/]+$//;
    push @INC, $path;
}

use Getopt::Long;

my $assocs_file = "";
my $evidence_codes = "EXP,IDA,IPI,IMP,IGI,TAS";
my $use_symbol = 0;

GetOptions ("goa=s" => \$assocs_file,
	    "evidence=s" => \$evidence_codes,
	    "symbol" => \$use_symbol)
    or die("Error in command line arguments\n");

$assocs_file = $ARGV[0] if @ARGV;

my %evidence_ok = map (($_ => 1), split (",", $evidence_codes));

my $assocs_open_str = $assocs_file =~ /\.gz$/ ? "gzip -cd $assocs_file |" : "< $assocs_file";
open GOA, $assocs_open_str or die $!;
my $bang = chr(33);  # ugh, workaround for emacs font coloring issue (yeah... i know)
my @assocs;
while (<GOA>) {
    next if /^\s*$bang/;
    chomp;
    my @f = split /\t/, $_;
    if (@f >= 7) {
	my ($db_id, $symbol, $qualifier, $go_id, $evidence_code) = @f[1,2,3,4,6];
	if ($evidence_ok{$evidence_code}) {
	    if ($qualifier ne "NOT") {
		my $id = $use_symbol ? $symbol : $db_id;
		push @assocs, "[\"$id\",\"$go_id\"]";
	    }
	}
    }
}
close GOA;
print "[", join(",\n ",@assocs),"]\n";
