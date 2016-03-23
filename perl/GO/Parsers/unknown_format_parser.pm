# $Id: unknown_format_parser.pm,v 1.9 2005/08/18 21:23:11 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::unknown_format_parser;

=head1 NAME

  GO::Parsers::unknown_format_parser     - base class for parsers

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

=head1 AUTHOR

=cut

use Carp;
use FileHandle;
use GO::Parser;
use base qw(GO::Parsers::base_parser Exporter);
use strict qw(subs vars refs);

sub parse_file_by_type {
    shift->parse_file(@_);
}
sub parse_file {
    my ($self, $file, $dtype) = @_;
    $self->file($file);
    my $fmt;   # input file format
    my $p;
    
    # determine format based on dtype
    # (legacy code - dtypes should switch to standard formars)
    if ($dtype) {

	# convert legacy types
	if ($dtype =~ /ontology$/) {
	    $fmt = "go_ont";
	}
	elsif ($dtype =~ /defs$/) {
	    $fmt = "go_def";
	}
	elsif ($dtype =~ /xrefs$/) {
	    $fmt = "go_xref";
	}
	elsif ($dtype =~ /assocs$/) {
	    $fmt = "go_assoc";
	}
	else {
	    $fmt = $dtype;
	}
    }
    if (!$p) {
	# no default parser, or it has been overwritten
	if (!$fmt) {
	    # messy guessing of format from file extension
	    if ($file =~ /\.go$/) {
		$fmt = "go_ont";
	    }
	    if ($file =~ /\.ontology$/) {
		$fmt = "go_ont";
	    }
	    if ($file =~ /defs$/) {
		$fmt = "go_def";
	    }
	    if ($file =~ /2go$/) {
		$fmt = "go_xref";
	    }
	    if ($file =~ /gene_association/) {
		$fmt = "go_assoc";
	    }
	    if ($file =~ /\.obo$/ || $file =~ /\.obo[\.\-_]text$/) {
		$fmt = "obo_text";
	    }
	    if ($file =~ /\.obo\W*xml$/) {
		$fmt = "obo_xml";
	    }
	    if (!$fmt) {
                # if suffix is a known parser module, use it
                if ($file =~ /\.(\w+)$/) {
                    my $suffix = $1;
                    my $mod = "GO/Parsers/$suffix"."_parser.pm";
                    eval {
                        require "$mod";
                    };
                    if ($@) {
                    }
                    else {
                        $fmt = $suffix;
                    }
                }
            }
	    if (!$fmt) {
		#$self->throw("I have no idea how to parse: $file\n");
                open(F,$file) || $self->throw("Cannot open $file");
                my $first_line = <F>;
                if ($first_line =~ /^format/) {
                    $fmt = 'obo_text';
                }
                else {
                    $fmt = 'go_ont';
                }
                close(F);
	    }
	}
	$p = GO::Parser->get_parser_impl($fmt);
    }
    %$p = %$self;
    $p->parse($file);
    %$self = %$p;
    $self->parser($p);
    $self;
}

sub parser {
    my $self = shift;
    $self->{_parser} = shift if @_;
    return $self->{_parser};
}


sub parse {
    my $self = shift;
    my $filename;
    foreach $filename (@_) {
        $self->parse_file($filename);
    }
    return;
}


# deprecated!
sub parse_ontology {
    my ($self, $file) = @_;
    $self->parse_file($file, 'go_ont');
}



1;
