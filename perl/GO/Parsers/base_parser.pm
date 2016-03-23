# $Id: base_parser.pm,v 1.18 2008/03/13 05:16:40 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::base_parser;

=head1 NAME

  GO::Parsers::base_parser     - base class for parsers

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

=head1 AUTHOR

=cut

use Carp;
use FileHandle;
use Digest::MD5 qw(md5_hex);
use GO::Parser;
use Data::Stag qw(:all);
use base qw(Data::Stag::BaseGenerator Exporter);
use strict qw(subs vars refs);

# Exceptions

sub throw {
    my $self = shift;
    confess("@_");
}

sub warn {
    my $self = shift;
    warn("@_");
}

sub messages {
    my $self = shift;
    $self->{_messages} = shift if @_;
    return $self->{_messages};
}

*error_list = \&messages;

sub message {
    my $self = shift;
    my $msg = shift;
    CORE::warn 'deprecated';
    $self->parse_err($msg);
}

=head2 show_messages

  Usage   -
  Returns -
  Args    -

=cut

sub show_messages {
    my $self = shift;
    my $fh = shift;
    $fh = \*STDERR unless $fh;
    foreach my $e (@{$self->error_list || []}) {
        printf $fh "\n===\n  Line:%s [%s]\n%s\n  %s\n\n", $e->{line_no} || "", $e->{file} || "", $e->{line} || "", $e->{msg} || "";
    }
}

sub init {
    my $self = shift;

    $self->messages([]);
    $self->acc2name_h({});
    $self;
}

sub parsed_ontology {
    my $self = shift;
    $self->{parsed_ontology} = shift if @_;
    return $self->{parsed_ontology};
}

=head2 normalize_files

  Usage   - @files = $parser->normalize_files(@files)
  Returns -
  Args    -

takes a list of filenames/paths, "glob"s them, uncompresses any compressed files and returns the new file list

=cut

sub normalize_files {
    my $self = shift;
    my $dtype;
    my @files = map {glob $_} @_;
    my @errors = ();
    my @nfiles = ();
    
    # uncompress any compressed files
    foreach my $fn (@files) {
        if ($fn =~ /\.gz$/) {
            my $nfn = $fn;
            $nfn =~ s/\.gz$//;
            my $cmd = "gzip -dc $fn > $nfn";
            #print STDERR "Running $cmd\n";
            my $err = system("$cmd");
            if ($err) {
                push(@errors,
                     "can't uncompress $fn");
                next;
            }
            $fn = $nfn;
        }
        if ($fn =~ /\.Z$/) {
            my $nfn = $fn;
            $nfn =~ s/\.Z$//;
            my $cmd = "zcat $fn > $nfn";
            print STDERR "Running $cmd\n";
            my $err = system("$cmd");
            if ($err) {
                push(@errors,
                     "can't uncompress $fn");
                next;
            }
            $fn = $nfn;
        }
        push(@nfiles, $fn);
    }
    my %done = ();
    @files = grep { my $d = !$done{$_}; $done{$_} = 1; $d } @nfiles;
    return @files;
}

sub fire_source_event {
    my $self = shift;
    my $file = shift || die "need to pass file argument";
    my @fileparts = split(/\//, $file);
    my @stat = stat($file);
    my $mtime = $stat[9];
    my $parsetime = time;
    my $md5 = md5_hex($fileparts[-1]);
    $self->event(source => [
				     [source_id => $file ],
				     [source_type => 'file'],
				     [source_fullpath => $file ],
				     [source_path => $fileparts[-1] ],
				     [source_md5 => $md5],
				     [source_mtime => $mtime ],
				     [source_parsetime => $parsetime ],
				    ]
			 );
    return;
}

sub parse_assocs {
    my $self = shift;
    my $fn = shift;
    $self->dtype('go_assoc');
    my $p = GO::Parser->get_parser_impl('go_assoc');
    %$p = %$self;
    $p->parse($fn);
    return;
}

sub parse_to_graph {
    my $self = shift;
    my $h = GO::Parser->create_handler('obj');
    $self->handler($h);
    $self->parse(@_);
    return $h->graph;
}

sub set_type {
    my ($self, $fmt) = @_;
    $self->dtype($fmt);
    my $p = GO::Parser->get_parser_impl($fmt);
    bless $self, ref($p);
    return;
}
sub dtype {
    my $self = shift;
    $self->{_dtype} = shift if @_;
    return $self->{_dtype};
}

sub parse_file {
    my ($self, $file, $dtype) = @_;

    $self->dtype($dtype);
    $self->parse($file);
}

sub xslt {
    my $self = shift;
    $self->{_xslt} = shift if @_;
    return $self->{_xslt};
}

sub force_namespace {
    my $self = shift;
    $self->{_force_namespace} = shift if @_;
    return $self->{_force_namespace};
}

sub replace_underscore {
    my $self = shift;
    $self->{_replace_underscore} = shift if @_;
    return $self->{_replace_underscore};
}

# EXPERIMENTAL: cache objects
sub use_cache {
    my $self = shift;
    $self->{_use_cache} = shift if @_;
    return $self->{_use_cache};
}

# EXPERIMENTAL: returns subroutine
# sub maps name to cached name
sub file_to_cache_sub {
    my $self = shift;
    my $lite = $self->litemode;
    my $suffix = $lite ? ".lcache" : ".cache";
    $self->{_file_to_cache_sub} = shift if @_;
    return $self->{_file_to_cache_sub} ||
      sub {
          my $f = shift;
          $f =~ s/\.\w+$//;
          $f .= $suffix;
          return $f;
      };
}


sub cached_obj_file {
    my $self = shift;
    return $self->file_to_cache_sub->(@_);
}

sub parse {
    my ($self, @files) = @_;

    my $dtype = $self->dtype;
    foreach my $file (@files) {

        $file = $self->download_file_if_required($file);

        $self->file($file);
        #printf STDERR "parsing: $file %d\n", $self->use_cache;

        if ($self->use_cache) {
            my $cached_obj_file = $self->cached_obj_file($file);
            my $reparse;
            if (-f $cached_obj_file) {
                my @stat1 = lstat($file);
                my @stat2 = lstat($cached_obj_file);
                my $t1 = $stat1[9];
                my $t2 = $stat2[9];
                if ($t1 >= $t2) {
                    $reparse = 1;
                }
                else {
                    $reparse = 0;
                }
            }
            else {
                $reparse = 1;
            }

            if ($reparse) {
                # make/remake cache
                my $hclass = "GO::Handlers::obj_storable";
                $self->load_module($hclass);
                my $cache_handler =
                  $hclass->new;
                $self->use_cache(0);
                my $orig_handler = $self->handler;
                $self->handler($cache_handler);
                $cache_handler->file($cached_obj_file);
                $self->parse($file);
                my $g = $cache_handler->graph;
                $self->use_cache(1);
                my $p2 = GO::Parser->new({
                                          format=>'GO::Parsers::obj_emitter'});
                $p2->handler($orig_handler);
                # this is the only state we need to copy across
                if ($self->can('xslt')) {
                    $p2->xslt($self->xslt);
                }
                $p2->emit_graph($g);
            }
            else {
                # use cache
                my $p2 = GO::Parser->new({format=>'obj_storable'});
                $p2->handler($self->handler);
                # this is the only state we need to copy across
                if ($self->can('xslt')) {
                    $p2->xslt($self->xslt);
                }
                $p2->parse_file($cached_obj_file);
            }
            next;
        }

        # check for XSL transform
        if ($self->can('xslt') && $self->xslt) {
            my $xsl = $self->xslt;
            my $xslt_file = $xsl;

            if (!-f $xslt_file) {
                # if GO_ROOT is set then this specifies the location of the xslt dir
                #  if it is not set, assume we are using an installed version of go-perl,
                #  in which case, the xslts will be located along with the perl modules
                my $GO_ROOT = $ENV{GO_ROOT};
                if ($GO_ROOT) {
                    # env var takes precedence;
                    # developers should use this
                    $xslt_file = "$GO_ROOT/xml/xsl/$xsl.xsl";
                }
                
                # default location is with perl modules
                if (!$xslt_file || !-f $xslt_file) {
                    # user-mode; xsl will be wherever the GO modules are installed
                    require "GO/Parser.pm";
                    my $dir = $INC{'GO/Parser.pm'};
                    $dir =~ s/Parser\.pm/xsl/;
                    $xslt_file = "$dir/$xsl.xsl";
                }
            }
            if (!-f $xslt_file) {
                $self->throw("No such file: $xslt_file OR $xsl");
            }

            # first parse input file to intermediate xml
            my $file1 = _make_temp_filename($file, "-1.xml");
            my $handler = $self->handler;
            my $outhandler1 =
              Data::Stag->getformathandler("xml");
            $outhandler1->file($file1);
            $self->handler($outhandler1);
            $self->SUPER::parse($file);
            $self->handler->finish;

            # transform intermediate xml using XSLT
            my $file2 = _make_temp_filename($file, "-2.xml");
            # $results contains the post-xslt XML doc;
            # we either want to write this directly, or
            # pass it to a handler

            if ($handler->isa("Data::Stag::XMLWriter")) {
                # WRITE DIRECTLY:
                # if the final goal is XML, then write this
                # directly
                if ($handler->file) {
                    # $ss->output_file($results,$handler->file);
                    xsltproc($xslt_file,$file1,$handler->file);
                } else {
                    my $fh = $handler->fh;
                    if (!$fh) {
                        $fh = \*STDOUT;
                        xsltproc($xslt_file,$file1);
                    }
                    else {
                        xsltproc($xslt_file,$file1,$file2);
                        my $infh = FileHandle->new($file2) || die "cannot open $file2";
                        while (<$infh>) {print $fh $_}
                        unlink($file2);
                    }
                    #$ss->output_fh($results,$handler->fh);
                }
            } else {
                # PASS TO HANDLER:
                # we need to do another transform, in perl.
                # 
                # write $results of stylesheet transform
                #$ss->output_file($results,$file2);
                xsltproc($xslt_file,$file1,$file2);
                
                # clear memory
                #$ss=undef;
                #$xslt=undef;
                #$results=undef;

                # we pass the final XML to the handler
                my $load_parser = new GO::Parser ({format=>'obo_xml'});
                $load_parser->handler($handler);
                $load_parser->errhandler($self->errhandler);
                $load_parser->parse($file2);
                unlink($file2);
            }

            # restore to previous state
            $self->handler($handler);
        } else {
            # no XSL transform - perform parse as normal
            # (use Data::Stag superclass)
            $self->SUPER::parse($file);
        }
    }
}

# applies XSLT and removes input file
sub xsltproc {
    my ($xf,$inf,$outf) = @_;
    my $cmd = "xsltproc $xf $inf";
    if ($outf) {
        $cmd .= " > $outf";
    }
    my $err = system($cmd);
    unlink($inf);
    if ($err) {
        confess("problem running: $cmd");
    }
    return;
}

sub _make_temp_filename {
    my ($base, $suffix) = @_;
    $base =~ s/.*\///;
    return "TMP.$$.$base$suffix";
}

sub download_file_if_required {
    my $self = shift;
    my $f = shift;
    if ($f =~ /^http:/) {
        my $tmpf = _make_temp_filename($f,'.obo');
        system("wget -O $tmpf $f");
        return $tmpf;
    }
    else {
        return $f;
    }
}

=head2 litemode

  Usage   - $p->litemode(1)
  Returns -
  Args    - bool

when set, parser will only throw the following events:

id|name|is_a|relationship|namespace

(optimisation for fast parsing)

=cut

sub litemode {
    my $self = shift;
    $self->{_litemode} = shift if @_;
    return $self->{_litemode};
}

=head2 acc2name_h

  Usage   - $n = $p->acc2name_h->{'GO:0003673'}
  Returns - hashref
  Args    - hashref [optional]

gets/sets a hash mapping IDs to names

this will be automatically set by an ontology parser

a non-ontology parser will use this index to verify the parsed data
(see $p->acc_not_found($id), below)

=cut

sub acc2name_h {
    my $self = shift;
    $self->{_acc2name_h} = shift if @_;
    $self->{_acc2name_h} = {} 
      unless $self->{_acc2name_h};
    return $self->{_acc2name_h};
}


=head2 acc_not_found

  Usage   - if ($p->acc_not_found($go_id)) { warn("$go_id not known") }
  Returns - bool
  Args    - acc string

uses acc2name_h - if this hash mapping has been created AND the acc is
not in the hash, THEN it is considered not found

This is useful for non-ontology parsers (xref_parser, go_assoc_parser)
to check whether a referenced ID is actually present in the ontology

note that if acc2name_h has not been created, then accs cannot be
considered not-found, and this will always return 0/false

=cut

sub acc_not_found {
    my $self = shift;
    my $acc = shift;
    my $h = $self->acc2name_h;
    if (scalar(keys %$h) && !$h->{$acc}) {
        return 1;
    }
    return 0;
}

sub dtd {
    undef;
}

1;
