# $Id: go_ids_parser.pm,v 1.2 2007/08/03 01:52:23 sjcarbon Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::go_ids_parser;

=head1 NAME

  GO::Parsers::go_ids_parser  - syntax parsing of flat files containing GO IDs.

=head1 SYNOPSIS


=head1 DESCRIPTION

do not use this class directly; use L<GO::Parser>

This generates Stag/XML event streams from files containing GO IDs.
Lines from such a file might be:

GO:0000003 GO:0000166   GO:0000228
GO:0000229
GO:0003674
GO:0003676 GO:0003677
GO:0003682

GO:0003700
GO:0003723 GO:0003774 GO:0003779 GO:0005634
GO:0005635
GO:0005654

See
L<http://www.godatabase.org/dev/xml/dtd/go_ids-parser-events.dtd>
For the DTD of the event stream that is generated

=cut

use Exporter;
use base qw(GO::Parsers::base_parser Exporter);
#use Text::Balanced qw(extract_bracketed);
use GO::Parsers::ParserEventNames;

use Carp;
use FileHandle;
use strict;


##
sub dtd {
  'go_ids-parser-events.dtd';
}


##
sub parse_fh {

  my ($self, $fh) = @_;

  #my $file = $self->file;

  my $term;
  my $line_no = 0;
  my %done = (); # Don't bother with things already done.

  $self->start_event(OBO);
  #$self->fire_source_event($file);

  while (<$fh>) {

    $line_no++;

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

    ## Skip if not there or comment.
    next if ! $_;
    next if /^\!/;

    # some files use string NULL - we just use empty string as null
    s/\\NULL//g;

    $self->line($_);
    $self->line_no($line_no);


    ## Remove leadng and trailing whitespace.
    s/^[\s\n]+//;
    s/[\s\n]+$//;
    my @accs = split /\s+/;
    for( my $i = 0; $i < @accs; $i++ ){

      my $acc = $accs[$i];

      ## Massage a bit more.
      if( $acc ){

	next if	$done{$acc}; # skip if done

	##
	if( $self->acc_not_found($acc) ){
	  $self->parse_err("No such ACC: $acc");
	  next;
	}

	$self->start_event(TERM);
	$self->event(ID, $acc);
	$self->end_event(TERM);
	$done{$acc} = 1;
      }
    }
  }

  # This is causing problems during direct fh access.
  $fh->close;
  $self->pop_stack_to_depth(0);
}


1;
