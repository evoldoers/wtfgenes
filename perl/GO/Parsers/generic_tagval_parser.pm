# $Id: generic_tagval_parser.pm,v 1.3 2007/02/02 05:54:11 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::generic_tagval_parser;

=head1 NAME

  GO::Parsers::generic_tagval_parser     - syntax parsing of GO .def flat files

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
    'generic_tagval-parser-events.dtd';
}

sub _class { 'generic' }
sub _id_column {}
sub _map_property_type { shift;@_ }

sub parse_fh {
    my ($self, $fh) = @_;
    my $file = $self->file;

    $self->start_event(OBO);
    my $lnum = 0;
    my $in_record=0;
    my $class = $self->_class;
    my $id_column = $self->_id_column;
    while (my $line = <$fh>) {
        chomp $line;
	++$lnum;
        next if $line =~ /^\!/;
        $line =~ s/^\s+$//;
        if (!$line) {
	    $self->pop_stack_to_depth(1);
            $in_record = 0;
            next;
        }

	if ($line =~ /^(\S+):\s+(.*)/) {
            my ($t,$v) = ($1,$2);
            if (!$in_record) {
                $self->start_event(INSTANCE);
                $self->event(instance_of=>$class);
                if (!$id_column) {
                    $t = 'id';
                }
                $in_record = 1;
            }
            if ($id_column && $t eq $id_column) {
                $t = 'id';
            }
            if ($t eq 'id') {
                $self->event(ID, $v);
            }
            else {
                my $dt = 'xsd:string';
                if ($v =~ /^http:/) {
                    $dt = 'xsd:anyURI';
                }
                $self->event(PROPERTY_VALUE,
                             [[TYPE,$self->_map_property_type($t)],
                              [VALUE,$v],
                              [DATATYPE,$dt]]);
            }
	}
	elsif ($line =~ /^(\S+):\s*$/) {
        }
	else {
#	    $self->parse_err("cannot parse:\"$line\"");
	}
    }
    $self->pop_stack_to_depth(0);  # end event obo
}


1;
