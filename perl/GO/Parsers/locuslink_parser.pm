# $Id: locuslink_parser.pm,v 1.1 2004/01/27 23:52:24 cmungall Exp $
#
# Adapterd from BioPerl module for Bio::SeqIO::locuslink
#
# POD documentation - main docs before the code

=head1 NAME

GO::Parsers::locuslink_parser - 

=head1 SYNOPSIS

=head1 DESCRIPTION

=cut

package GO::Parsers::locuslink_parser;

use strict;
use vars qw(@ISA);

use base qw(GO::Parsers::base_parser);

sub _initialize {
    my($self,@args) = @_;
    $self->SUPER::_initialize(@args);  
}


sub transitions {
    return
      qw(
         NM                transcript
         NG                0
         CONTIG            0
         EVID              evidence
         ACCNUM            accession
         OFFICIAL_SYMBOL   0
         BUTTON            url
         DB_DESCR          dbxref
         /DB_LINK          dbxref
        );
}

sub compounds {
    return
      (
       STS => [qw(sts_acc chr_num unk symbol type src)],
       GO  => [qw(aspect term evcode go_acc src unk)],
       EXTANNOT  => [qw(aspect term evcode src unk)],
       CDD => [qw(domain domain_acc num unk score)],
       NG => [qw(acc u1 u2 u3 u4)],
       CONTIG => [qw(contig_acc u1 u2 u3 u4 strand chr_num src)],
       XM  => [qw(acc gi)],
       XP  => [qw(acc gi)],
       XG  => [qw(acc gi)],
       ACCNUM  => [qw(acc gi)],
       PROT  => [qw(acc gi)],
       MAP => [qw(map_loc link code)],
       SUMFUNC => [qw(descr src)],
       GRIF => [qw(grif_pmid descr)],
       COMP => [qw(comp_acc symbol2 chr_num2 map_pos2 locusacc2 chr_num1 symbol1 src)],
      );
}

sub record_tag {'locusset'}

sub parse_fh {
    my $self = shift;
    my $fh = shift;
    $self->start_event('locusset');
    my (%record,@results,$search,$ref,$cddref);
    my ($PRESENT,@keep);

    # LOCUSLINK entries begin w/ >>
    local $/=">>";

    # slurp in a whole entry and return if no more entries
    return unless my $entry = <$fh>;

    # if its the first entry you have to slurp it in again
    if ($entry eq '>>'){ #first entry
        return unless $entry = <$fh>;
    }

    if (!($entry=~/LOCUSID/)){
        $self->throw("No LOCUSID in first line of record. ".
                     "Not LocusLink in my book.");
    }

    my %transitions = $self->transitions;
    my %compounds = $self->compounds;
#    my %grouped = ();
#    foreach (keys %transitions) {
#        if (/\;/) {
#            my $t = $transitions{$_};
#            my (@keylist) = split(/\;/, $_);
#            foreach (@keylist) {
#                $transitions{$_} = $t;
#                $grouped{$_} = $t;
#            }
#        }
#    }

    $self->start_event('locus');
    my $level = 0;
    my @lines = split(/\n/, $entry);
    foreach (@lines) {
        if (/(\w+):\s*(.*)/) {
            my ($k, $v) = (uc($1), $2);
            my $transition = $transitions{$k};
            if (defined $transition) {
                if (!$transition) {
                    if ($level) {
                        #$self->throw("uh oh $_") unless $level;
                        $self->end_event($level);
                    }
                    $level = 0;
                }
                elsif ($transition eq $level) {
                    $self->end_event($level);
                    $self->start_event($level);
                }
                else {
                    if ($level) {
                        $self->end_event($level);
                        $level = 0;
                    }
                    $self->start_event($transition);
                    $level = $transition;
                }
            }
            # for grouped keys, every key must be part of
            # group to remain part of the same super-element
#            if ($level &&
#                $grouped{$level}) {



#                if (!$grouped{$k} ||
#                    $grouped{$k} ne $grouped{$level}) {
#                    $self->end_event($level);
#                    $level = 0;
#                }
#            }

            if ($compounds{$k}) {
                my (@vals) = split(/\|/, $v);
                my @pairs = ([defline=>$v]);
                foreach (@{$compounds{$k}}) {
                    my $v = shift @vals;
                    push(@pairs, [$_ => $v]) unless $v eq 'na';
                }
                $self->event(lc($k) => [@pairs]);
            }
            else {
                $self->event(lc($k), $v);
            }

            my $end = $transitions{'/'.$k};
            if ($end) {
                $self->end_event($end);
                $level = 0;
            }
        }
    }
    if ($level) {
        $self->end_event($level);
    }
    $self->end_event('locus');
    $self->end_event('locusset');
    return;
}

1;
