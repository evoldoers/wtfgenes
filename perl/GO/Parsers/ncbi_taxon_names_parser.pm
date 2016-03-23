# $Id: ncbi_taxon_names_parser.pm,v 1.2 2004/11/24 02:28:02 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::ncbi_taxon_names_parser;

=head1 NAME

  GO::Parsers::ncbi_taxon_names_parser     - OBO Flat file parser object

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION


=cut

use Exporter;
use Text::Balanced qw(extract_quotelike extract_bracketed);
use base qw(GO::Parsers::base_parser);

use Carp;
use FileHandle;
use strict qw(subs vars refs);



sub parse_fh {
    my ($self, $fh) = @_;

    my @stags = ();
    my $curr_id;
    $self->start_event('taxon_set');
    while (<$fh>) {
	chomp;
	my @vals = split(/\s*\|\s*/,$_);
	my ($id,$val,$xx,$tag) = @vals;
	if ($curr_id && $id != $curr_id) {
	    $self->event(taxon=>[
				 [id=>$curr_id],
				 @stags
				]);
	    @stags = ();
	}
	$tag = lc($tag);
	$tag =~ s/\s/_/g;
	$tag =~ tr/a-z0-0_//cd;
	push(@stags, [$tag=>$val]);
	if ($tag eq 'scientific_name') {
	    # lump subspecies in with species;
	    # eg genus=Homo, species=sapiens neanderthalensis
	    my ($genus,$species) = ($val =~ /^(\S+)\s+(.*)/);
	    push(@stags, [genus=>$genus],[species=>$species]);
	}
	$curr_id = $id;
    }
    $self->event(taxon=>[
			 [id=>$curr_id],
			 @stags
			]);
    $self->end_event('taxon_set');
    return;
}

1;
