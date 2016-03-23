# $Id: mgi_assoc_parser.pm,v 1.3 2006/08/05 20:26:12 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::mgi_assoc_parser;

=head1 NAME

  GO::Parsers::mgi_assoc_parser - parses MGI gene assoc stanza files

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=head1 DESCRIPTION

This is an EXPERIMENTAL module for converting MGIs in-house stanza format

this is richer than go_assoc files as it allows combinatorial assocs

these are represented with the go-assoc xml <in> element

=head1 AUTHOR

=cut

use Exporter;
use base qw(GO::Parsers::base_parser Exporter);
use GO::Parsers::ParserEventNames;

use Carp;
use FileHandle;
use strict;

sub dtd {
    'go_assoc-parser-events.dtd';
}

sub ev_filter {
    my $self = shift;
    $self->{_ev_filter} = shift if @_;
    return $self->{_ev_filter};
}



sub skip_uncurated {
    my $self = shift;
    $self->{_skip_uncurated} = shift if @_;
    return $self->{_skip_uncurated};
}

sub _parse_ids {
    my $txt = shift;
    $txt =~ s/^:+//;
    $txt =~ s/^\s+//;
    my @parts = split(/\|/,$txt);
    return grep {$_} map {if (/(\w+:\S+)/){$1}else {()}} @parts;
}

sub parse_fh {
    my ($self, $fh) = @_;
    my $file = $self->file;


    $self->start_event(ASSOCS);
    $self->start_event(DBSET);
    $self->event(PRODDB, 'mgi');

    my $curr_gene = '';
    while (<$fh>) {
        # UNICODE causes problems for XML and DB
        # delete 8th bit
        tr [\200-\377]
          [\000-\177];   # see 'man perlop', section on tr/
        # weird ascii characters should be excluded
        tr/\0-\10//d;   # remove weird characters; ascii 0-8
                        # preserve \11 (9 - tab) and \12 (10-linefeed)
        tr/\13\14//d;   # remove weird characters; 11,12
                        # preserve \15 (13 - carriage return)
        tr/\16-\37//d;  # remove 14-31 (all rest before space)
        tr/\177//d;     # remove DEL character

	chomp;
	if (/^\!/) {
	    next;
	}
	if (!$_) {
	    next;
	}

        if (/^MGI gene:\s(\S+);\s+(\S+)/) {
            if ($1 ne $curr_gene) {
                $self->pop_stack_to_depth(2);
                $self->start_event(PROD);
                $self->event(PRODACC, $1);
                $self->event(PRODSYMBOL, $2);
                $self->event(PRODTYPE, 'gene');
                $curr_gene = $1;
            }
        }
        if (/^GO term:\s(.*);\s+(\S+)/) {
	    $self->start_event(ASSOC);
	    $self->event(TERMACC, $2);
            while (<>) {
                chomp;
                last unless $_;
                if (/^GO evidence:\s*(.*)/) {
                    my $evtxt = $1;
                    foreach (split(/\s+\|\s+/,$evtxt)) {
                        $self->start_event(EVIDENCE);
                        $self->event(EVCODE, $_);
                        $self->end_event(EVIDENCE);
                    }
                }
                elsif (/^anatomy:(.*)/) {
                    my @ids = _parse_ids($1);
                    $self->event(property_value=>[[type=>'located_in'],
                                                  [to=>$_]]) foreach @ids;
                }
                elsif (/^cell type:(.*)/) {
                    my @ids = _parse_ids($1);
                    $self->event(property_value=>[[type=>'located_in'],
                                                  [to=>$_]]) foreach @ids;
                }
                else {
                }
            }
	    $self->end_event(ASSOC);
        }
    }
    $fh->close;

    $self->pop_stack_to_depth(0);
}


1;

