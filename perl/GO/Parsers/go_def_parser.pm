# $Id: go_def_parser.pm,v 1.6 2005/03/22 22:38:32 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::go_def_parser;

=head1 NAME

  GO::Parsers::go_def_parser     - syntax parsing of GO .def flat files

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

This generates Stag event streams from one of the various GO flat file
formats (ontology, defs, xref, associations). See GO::Parser for details

Examples of these files can be found at http://www.geneontology.org

A description of the event streams generated follows; Stag or an XML
handler can be used to catch these events


=head1 GO DEFINITION FILES

These have a suffix .defs or .definitions

 

=head1 AUTHOR

=cut

use Exporter;
use base qw(GO::Parsers::base_parser);
use GO::Parsers::ParserEventNames;  # declare XML constants

use Carp;
use FileHandle;
use strict qw(subs vars refs);

sub dtd {
    'go_def-parser-events.dtd';
}


sub parse_fh {
    my ($self, $fh) = @_;
    my $file = $self->file;

    $self->start_event(OBO);
    my $lnum = 0;
    my $in_def=0;
    while (my $line = <$fh>) {
        chomp $line;
	++$lnum;
        next if $line =~ /^\!/;
	next if !$line;
	if ($line =~ /^term:\s+(.*)/) {
	    $self->pop_stack_to_depth(1);
	    $self->start_event(TERM);
            $self->event(NAME, $1);
	    $in_def = 0;
	}
	elsif ($line =~ /^goid:\s+(\S+)/) {
	    if ($in_def) {
		$self->parse_err("goid in definition");
	    }
	    $self->event(ID,$1);
	}
	elsif ($line =~ /^(\w+):\s+(.*)/) {
	    my ($k, $v) = ($1,$2);
	    if (!$in_def) {
		$in_def = 1;
		$self->start_event(DEF);
	    }
            if ($k eq 'definition_reference') {
                my ($db, $acc) = ('', $v);
                if ($v =~ /(.*)?:(\S+)/) {
                    ($db,$acc) = ($1,$2);
                }
                $self->event(DBXREF,[[acc=>$acc],[dbname=>$db]]);
                next;
            }
	    $k =~ s/^definition$/defstr/;
	    $self->event($k=>$v);
	    if ($k eq 'comment') {
		my $stag = $self->parse_comment($v);
		$self->event(@$stag) if $stag;
	    }
	}
	else {
	    $self->parse_err("trailing text");
	}
    }
    $self->pop_stack_to_depth(0);  # end event obo
}

sub parse_comment {
    my $self = shift;
    my $v = shift;
    my $stag;
    if ($v =~ /This term was made obsolete because (.*) To update annotations, (\w+) (.*)/) {
	my $reason = $1;
	my $update_type = $2;
	my $nu = $3;
	my @nu_ids = ();
	while ($nu =~ / ; (\S+)\'/) {
	    push(@nu_ids, $1);
	    $nu =~ s/ ; (\S+)\'//;
	}
	$stag = [obsolete_data=>[
				 [reason=>$reason],
				 [update_type=>$update_type],
				 (map {[id=>$_]} @nu_ids),
				]];
    }
    return $stag;
}

1;
