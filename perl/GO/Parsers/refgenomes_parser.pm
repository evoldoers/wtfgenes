# $Id: refgenomes_parser.pm,v 1.1 2007/01/24 01:16:20 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::refgenomes_parser;

=head1 NAME

  GO::Parsers::refgenomes_parser     - syntax parsing of GO .def flat files

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION


=head1 GO DEFINITION FILES

=head1 AUTHOR

=cut

use Exporter;
use base qw(GO::Parsers::base_parser);
use GO::Parsers::ParserEventNames;  # declare XML constants

use Carp;
use FileHandle;
use strict qw(subs vars refs);

sub dtd {
    'refgenomes-parser-events.dtd';
}

sub _class { 'generic' }
sub _id_column {}
sub _map_property_type { shift;@_ }

our %DB_LOOKUP =
  (dictybase=>'DDB',
   flybase=>'FB',
   wormbase=>'WB',
   goa=>'UniProt',
   chicken=>'UniProt',
   zfin=>'ZFIN',
   pombase=>'GeneDB_Spombe',
   );

sub parse_fh {
    my ($self, $fh) = @_;
    my $file = $self->file;

    my $LAST_COL = 'completion target';
    my @hdr = ();
    $self->start_event('refgenomeset');

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
        my @vals = split(/\t/,$line);
        if (!@hdr) {
            @hdr = @vals;
            next;
	}

        $self->start_event('homologset');

        my %valh = ();
        for (my $i=0; $i<@hdr; $i++) {
            my $col = $hdr[$i];
            $col =~ s/\s/_/g;
            $col =~ s/\W//g;
            $valh{$col} = $vals[$i];
        }
        my $id = $valh{OMIM_ID};
        $id =~ s/\W//g;
        $self->event('@'=>[[id=>"MIM:$id"]]);
        
        my $in_genes = 0;
        my $i=-1;
        while ($i<@vals) {
            $i++;
            my $col = $hdr[$i];
            my $val = $vals[$i];
            if ($in_genes) {
                my ($sp, @extra) = split(' ',$col);
                if (!@extra) {
                    # ignore anything with annoying chatty text
                    next if $val =~ / /i;
                    next unless $val;
                    next if $val =~ /\"/;
                    my $sp2 = $DB_LOOKUP{lc($sp)};
                    $sp = $sp2 if ($sp2);
                    my $fid = "$sp:$val";
                    $self->event('member',[['@'=>[[ref=>$fid]]]]);
                }
            }
            else {
                if ($col eq $LAST_COL) {
                    $in_genes = 1;
                }
                $col =~ s/\s/_/g;
                $col =~ s/\W//g;
                $self->event(tagval=>[['@'=>[[type=>$col]]],['.'=>$val]]) if $val;
            }
        }
        $self->end_event('homologset');
        
    }
    $self->pop_stack_to_depth(0);  # end event obo
}


1;
