package GO::Metadata::Panther;
use strict;
use warnings;
use Exporter;
use Memoize;
use List::Util qw/sum first/;
use Data::Dumper;
use Carp;

use base qw/GO::Metadata::UniProt::Species Exporter/;
our @EXPORT_OK = qw/panther_codes panther_all valid_panther_codes/;


=head1 NAME

GO::Metadata::Panther - Species info for data used by Panther Clusters

=head1 SYNOPSIS

 use GO::Metadata::Panther;
 my $s = GO::Metadata::Panther->code('YEAST');

=head1 DESCRIPTION

Inherits functions from L<GO::Metadata::UniProt::Species>.

Accesses information related to species in the Panther F<seq2pthr.gz>
file.  This file can be fetched from:
L<ftp://ftp.pantherdb.org/genome/pthr7.0/>

=cut

# Information needed but not provided by UniProt's speclist.txt file.

our %species =
  (
   #
   # A
   #

   ANOGA => { prefer => [ qw/ENSEMBL UniProtKB/ ] },
   ARATH => { id_filter => sub {
		  if ($_[0] eq 'gene') {
		      return ('TAIR', "locus:$_[1]");
		  }
		  return @_;
	      }
	    },
   AQUAE => {},
   ASHGO => { also_node => [ 284811 ] },

   #
   # B
   #

   BACSU => {},
   BACTN => {},
   BOVIN => { prefer => [ 'UniProtKB',  'ENSEMBL' ] },
   BRAJA => {},

   #
   # C
   #

   CAEBR => {},
   CAEEL => { prefer => [ 'WB' ],
	      id_filter => sub {
		  $_[0] = 'WB' if ($_[1] =~ m/^WB/);
		  return @_;
	      }
	    },
   CANFA => { prefer => [ 'ENSEMBL' ] },
   CHLTA => {},
   CHLRE => {},
   CHLAA => {},
   CIOIN => { prefer => [ 'ENSEMBL' ] },

   #
   # D
   #

   DANRE => { prefer => [ 'ZFIN', 'ENSEMBL', 'UniProtKB' ] },
   DEIRA => {},
   DICDI => {},
   DROME => { prefer => [ 'FB' ],
	      id_filter => sub {
		  $_[0] = 'FB' if ($_[1] =~ m/^FB/);
		  return @_;
	      }
	    },

   #
   # E
   #

   EMENI => {},
   ENTHI => {},
   ECOLI => { also_node => [ 562, 511145 ],
	      prefer    => [ 'EcoCyc', 'UniProtKB' ] },

   #
   # G
   #

   CHICK => { prefer => [ 'UniProtKB', 'ENSEMBL', 'NCBI' ] },
   GEOSL => {},
   GLOVI => { also_node => [ 251221 ] },


   #
   # H
   #

   HUMAN => { prefer => [ 'UniProtKB', 'ENSEMBL' ] },

   #
   # L
   #

   LEIMA => { also_node => [ 347515 ] },
   LEPIN => {},

   #
   # M
   #

   MACMU => { prefer => [ 'UniProtKB', 'ENSEMBL' ] },
   METAC => {},
   MONDO => { prefer => [ 'ENSEMBL' ] },
   MOUSE => { prefer => [ 'MGI', 'UniProtKB', 'ENSEMBL' ],
	      id_filter => sub {
	      	  if (($_[0] eq 'MGI') and ($_[1] !~ m/^MGI:/)) {
	      	      return ('MGI', "MGI:$_[1]");
	      	  }
	      	  return @_;
	      }
	    },

   #
   # N
   #

   NEUCR => {},

   #
   # O
   #

   ORNAN => { prefer => [ 'ENSEMBL' ] },
   ORYSJ => {},

   #
   # P
   #

   PANTR => { prefer => [ 'ENSEMBL', 'UniProtKB' ] },
   PLAYO => {},
   PSEA7 => {},

   #
   # R
   #

   RAT => {  prefer => [ 'RGD', 'UniProtKB', 'ENSEMBL' ] },

   #
   # S
   #

   YEAST => {},
   SCHPO => {},
   STRCO => {},
   STRPU => {},
   SULSO => {},

   #
   # T
   #

   FUGRU => { is => 'TAKRU' },
   TAKRU => { was => 'FUGRU',
	      prefer => [ 'ENSEMBL' ],
	    },
   TETTH => { also_node => [ 312017 ] },
   THEMA => {},

   #
   # X
   #

   XENTR => { prefer => [ 'UniProtKB', 'ENSEMBL' ] },
);

=head2 Exportable Subroutines

=over

=item panther_codes()

Returns the list of UniProt species codes that are used in Panther clusters.

=cut
sub panther_codes{
    return map {
	defined $species{$_}->{is} ? () : $_;
    } keys %species;
}
sub codes{
    carp "Please use panther_codes() instead of codes()";
    panther_codes(@_);
}


=item GO::Metadata::Panther->panther_all()

Returns a list of C<GO::Metadata::Panther> objects that are used in Panther clusters.

=cut
sub panther_all{
    my $c = shift;
    return $c->new(panther_codes());
}
sub all {
    carp 'Please panther_all() instead if all()';
    return shift()->panther_all(@_);
}

=item valid_codes(...)

Returns a true value in every argument is a UniProt species code used
in Panther cluster.  Otherwise returns false.

=cut
sub valid_panther_codes{
    for my $code (@_) {
	return undef if (!exists $species{$code});
    }
    return '1';
}


=back

=head2 OO Function

=over

=item GO::Metadata::Panther-E<gt>new(...);

This basically hands things off to L<GO::Metadata::UniProt::Species>'s
new function.   Populates that with other Panther/GO specific
information, and does some error correction.

=cut
our %_new_cache;
sub new{
    my $c = shift;

    my @have;
    my @all = map {
	if ($_new_cache{$_}) {
	    push @have, $_new_cache{$_};
	    ();
	} else {
	    $_;
	}
    } @_;

    ##########
    # Fix up also_node entries (see ECOLI)
    @all = map {
	my $all = $_;
	my $out = $all;
	if ($all =~ m/^\d+$/) {
	  BLA:
	    for my $code (keys %species) {
		for my $node (@{ $species{$code}->{also_node} }) {
		    if ($all eq $node) {
			$out = $code;
			last BLA;
		    }
		}
	    }
	}
	$out;
    } @all;
    # This bugs me
    ##########

    @all = map {
	if (!$_->ncbi_taxon_id()) {
	    warn 'Skipping unknown NCBI taxon ID, check: SELECT * FROM species WHERE ncbi_taxa_id=0';
	    ();
	} else {
	    $_;
	}
    } $c->SUPER::new(map {
	if ($species{$_} && $species{$_}->{is}) {
	    warn "$_ -> $species{$_}->{is}";
	    $species{$_}->{is};
	} else {
	    $_;
	}
    } @all) if (scalar @all);

    for (@all) {
	if ($species{$_->code()}) {
	    while (my ($k,$v) = each %{ $species{$_->code} }) {
		$_->{$k} = $v;
	    }
	} else {
	    warn $_->code . ' Not a Panther family.';
	}
    }

    for my $all (@all) {
	$_new_cache{$all->{node}} = $all;
	$_new_cache{$all->{code}} = $all;
    }
    push @all, @have;

    return undef   if (0 == scalar @all);
    return $all[0] if (1 == scalar @all);
    return @all;
}


=item $s->ncbi_taxa_ids()

Returns the list of NCBI taxa identifiers associated with the UniProt
species code.  In a perfect word this will only every return one
value.  In any case, the first value will be the actual numeric
identifier associated.

=cut
sub ncbi_ids{
    my $s = shift;
    my @out = ($s->{node});
    push @out, @{ $s->{also_node} } if ($s->{also_node});
    return @out;
}

=item $s->prefers()

Returns a list of id types (generally to be populated in
C<dbxref.xref_dbname>) in order of preference of use.  If a null list,
we have never encountered a conflict that needed resolving.

=cut
sub prefers{
    my $s = shift;

    if ($s->{prefer}) {
	return @{ $s->{prefer} };
    }
    return qw/UniProtKB/;
}

# this is not fully in use.
sub reject{
    my $s = shift;

    if ($s->{reject}) {
	return @{ $s->{reject} };
    }
    return qw/GeneID/;
}

# sub prefered{
#     my $s = shift;
#     my $v = shift

#     return first { $v eq $_ } $s->preferes();
# }

sub id_filter{
    my $s = shift;
    my ($k, $v) = (shift, shift);
    $k = 'UniProtKB' if ($k =~ m/UniProt/i);

    if ($s->{id_filter}) {
	return &{ $s->{id_filter} }($k, $v);
    }
    return ($k, $v);
}


=back

=head2 SEE ALSO

L<GO::Metadata::UniProt::Species>

=head2 AUTHOR

Sven Heinicke E<lt>sven@genomics.princeton.edu</gt>

=cut

1;
