# $Id: go_xref_parser.pm,v 1.9 2010/02/15 17:34:57 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::go_xref_parser;

=head1 NAME

  GO::Parsers::go_xref_parser     - syntax parsing of GO xref flat files (eg eg2go, metacyc2go)

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

This generates Stag event streams from one of the various GO flat file
formats (ontology, defs, xref, associations). See GO::Parser for details

Examples of these files can be found at http://www.geneontology.org

A description of the event streams generated follows; Stag or an XML
handler can be used to catch these events

=head1 GO XREF FILES

These files have a filename *2go; eg metacyc2go

  (dbxrefs
   (termdbxref+
     (termacc "s")
     (dbxref
       (xref_dbname "s")
       (xref_key "s")))) 

 

=head1 AUTHOR

=cut

use Carp;
use FileHandle;
use strict qw(vars refs);
use base qw(GO::Parsers::base_parser);
use GO::Parsers::ParserEventNames;    # XML constants

sub dtd {
    'go_xref-parser-events.dtd';
}

sub parse_fh {
    my ($self, $fh) = @_;
    my $file = $self->file;

    my $lnum = 0;
    $self->start_event(OBO);
    while (<$fh>) {
        chomp;

        tr [\200-\377]
          [\000-\177];   # see 'man perlop', section on tr/
        # weird ascii characters should be excluded
        tr/\0-\10//d;   # remove weird characters; ascii 0-8
                        # preserve \11 (9 - tab) and \12 (10-linefeed)
        tr/\13\14//d;   # remove weird characters; 11,12
                        # preserve \15 (13 - carriage return)
        tr/\16-\37//d;  # remove 14-31 (all rest before space)
        tr/\177//d;     # remove DEL character

        $lnum++;
        next if /^\!/;
        next if /^$/;
        $self->line($_);
        $self->line_no($lnum);
        my ($ext, @goids) = split(' > ',$_);
        if ($ext =~ /^([\w\-]+):?(\S+)(.*)/) {
            my ($db,$dbacc,$name) = ($1,$2,$3);
            $name =~ s/^\s+// if $name;
            $dbacc =~ s/\s/\%20/g;
            foreach my $goid (@goids) {
                if ($goid =~ /(.*)\s+\;\s+(.*)/) {
                    my $goacc = $2;
                    if ($self->acc_not_found($goacc)) {
                        $self->parse_err("No such ID: $goacc");
                        next;
                    }
                    $self->start_event(TERM);
                    $self->event(ID, $goacc);
                    $self->start_event(XREF_ANALOG);
                    $self->event(ACC, $dbacc);
                    $self->event(DBNAME, $db);
                    if ($name) {
                        $self->event(NAME, $name)
                    }
                    $self->end_event(XREF_ANALOG);
                    $self->end_event(TERM);
                }
                else {
                    $self->parse_err("would not extract GO ID from: $goid");
                }
            }
        }
        else {
            $self->parse_err("bad external ID: $ext in line: $_");
        }
    }
    $self->end_event(OBO);
}

1;
