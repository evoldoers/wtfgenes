# $Id: go_ont_parser.pm,v 1.17 2005/08/19 01:48:09 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::go_ont_parser;

=head1 NAME

  GO::Parsers::go_ont_parser     - syntax parsing of GO .ontology flat files

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION

This generates Stag event streams from one of the various GO flat file
formats (ontology, defs, xref, associations). See GO::Parser for details

Examples of these files can be found at http://www.geneontology.org

A description of the event streams generated follows; Stag or an XML
handler can be used to catch these events

=head1 GO ONTOLOGY FILES

These files have the .ontology suffix. The stag-schema for the event
streams generated look like this:
 
  (ontology
   (source
     (source_type "s")
     (source_path "s")
     (source_mtime "i"))
   (term+
     (id "s")
     (name "s")
     (is_root? "i")
     (relationship+
       (type "s")
       (to "s"))
     (dbxref*
       (dbname "s")
       (acc "s"))
     (synonym* "s")
     (secondaryid* "s")
     (is_obsolete? "i"))) 


=head1 AUTHOR

=cut

use Exporter;
use base qw(GO::Parsers::base_parser);
use GO::Parsers::ParserEventNames;

use Carp;
use FileHandle;
use strict qw(vars refs);

sub dtd {
    'go_ont-parser-events.dtd';
}

sub regesc {
    my $code = shift;
    if ($code eq '|') {
        $code = '\|';
    }
    if ($code eq '*') {
        $code = '\*';
    }
    if ($code eq '?') {
        $code = '\?';
    }
    $code;
}

sub reln_regexp {
    join("|", map {" ".regesc($_)." "} keys %{shift || {}});
}

sub parse_fh {
    my ($self, $fh) = @_;

    my $file = $self->file;

    my $is_go;
    my %typemap =
      ('$'=>'is_a',
       '%'=>'is_a',
       '<'=>'part_of',
       '~'=>'derives_from',
       );
    my $reln_regexp = reln_regexp(\%typemap);
    my $lnum = 0;
    my @stack = ();
    my $obs_depth;

    my $usc = $self->replace_underscore;
    $self->start_event(OBO);
    my %rtypenameh = ();
    $self->fire_source_event($file);
    $self->handler->{ontology_type} = 
      $self->force_namespace;
    my $root_id;

  PARSELINE:
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
        my $line = $_;
	$line =~ s/\r//g;
	chomp $line;
	$line =~ s/\s+$//;
	++$lnum;
        $self->line($line);
        $self->line_no($lnum);
        if ($line =~ /^\!type:\s*(\S+)\s+(\S+)/) {
            my ($code, $name) = ($1, $2);
            $name =~ s/\s+/_/g;
            $name = lc($name);
            if ($name eq 'isa') {
                $name = 'is_a';
            }
            if ($name eq 'partof') {
                $name = 'part_of';
            }
            $typemap{$code} = $name
              unless $code eq '%';
            #$code = '\\'.$code;
            $reln_regexp = reln_regexp(\%typemap);
            next;
        }
	next if $line =~ /^\s*\!/;   # comment
	next if $line eq '\$';        # 
	next if $line eq '';        # 
	last if $line =~ /^\s*\$\s*$/;  # end of file

	# get rid of SGML directives, e.g. FADH<down>2</down>, as these confuse the relationship syntax
	$line =~ s/<\/?[A-Za-z]+>//g;
#	$line = &spellGreek ($line);
	$line =~ s/&([a-z]+);/$1/g;

        $line =~ /( *)(.*)/;
        my $body = $2;
        my $indent = length($1);

        my $is_obs = 0;
        while ((scalar @stack) &&
               $stack[$#stack]->[0] >= $indent) {
            pop @stack;
            if (defined($obs_depth) &&
                $obs_depth >= $indent) {
                # no longer under obsolete node
                $obs_depth = undef;
            }
        }

        my $rchar;
        if ($body =~ /^(\@\w+\@)(.*)/) {
            $rchar = $self->typemap($1,\%typemap);
            $body = $2;
	    $reln_regexp = ' \@\w+\@ ';
        }
	else {
            $rchar = $self->typemap(substr($body, 0, 1),\%typemap);
            $body = substr($body, 1);
        }
        # +++++++++++++++++++++++++++++++++
        # parse body / main content of line
        # +++++++++++++++++++++++++++++++++
        my $currxref;
        my @parts = split(/($reln_regexp)/, $body);
	for (my $i=0; $i < @parts; $i+=2) {
            my $part = $parts[$i];
            my ($name, @xrefs) =
              split(/\s*;\s+/, $part);
            $name = $self->unescapego($name);
            if ($usc) {
                $name =~ s/_/$usc/g;
            }
            if ($name =~ /^obsolete/i && $i==0) {
                $obs_depth = $indent;
            }
            if ($name eq "Gene_Ontology") {
                $is_go =1;
            }
            if (defined($obs_depth)) {
                # set obsolete flag if we
                # are anywhere under the obsolete node
                $is_obs = 1;
            }
            if ($indent < 2 && $is_go) {
                $self->handler->{ontology_type} = $name
                  unless $self->force_namespace;
            }
            elsif ($indent < 1) {
                $self->handler->{ontology_type} = $name
                  unless $self->force_namespace;
            }
            elsif (!$self->handler->{ontology_type}) {
                $self->handler->{ontology_type} = $name;
            }
	    else {
	    }

            my $pxrefstr = shift @xrefs;
            if (!$pxrefstr) {
		$pxrefstr = '';
                $self->parse_err("no ID");
                next PARSELINE;
            }
            # get the GO id for this line
            my ($pxref, @secondaryids) =
              split(/,\s+/, $pxrefstr);
            if ($i==0) {
                $currxref = $pxref;
                if ($currxref =~ /\s/) {
                    my $msg = "\"$pxref\" doesn't look valid";
                    $self->parse_err($msg);
                }
                my $a2t = $self->acc2name_h;
                my $prevname = $a2t->{$currxref};
                if ($prevname &&
                    $prevname ne $name) {
                    my $msg = "clash on $pxref; was '$prevname' now '$name'";
                    $self->parse_err($msg);
		    next PARSELINE;
                }
		if ($prevname && $indent) {
		    # seen before - no new data, skip to avoid repeats
		    next PARSELINE;
		}
                $a2t->{$currxref} = $name;
		$root_id = $currxref if !$indent;
                $a2t->{$currxref} = $name;
		$self->start_event(TERM);
                $self->event(ID, $currxref);
                $self->event(NAME, $name);
                $self->event(IS_OBSOLETE, $is_obs) if $is_obs;
                $self->event(IS_ROOT, 1) if !$indent;
                $self->event(NAMESPACE, $self->handler->{ontology_type}) 
		  if $self->handler->{ontology_type};
                map {
                    $self->event(ALT_ID, $_);
                } @secondaryids;
            }
	    #            map {
	    #                $self->start_event("secondaryid");
	    #                $self->event("id", $_);
	    #                $self->end_event("secondaryid");
	    #            } @secondaryids;
            if ($i == 0) {
                # first part on line has main
                # info for this term
                foreach my $xref (@xrefs) {
                    my ($db,@rest) =
                      split(/:/,$xref);
		    my $dbacc = $self->unescapego(join(":", @rest));
		    if ($db eq "synonym") {
                        $self->event(SYNONYM, [[synonym_text=>$dbacc],
                                               [type=>'related']]);
                    }
                    
		    #                    elsif ($dbacc =~ /\s/) {
		    #                        # db accessions should not have
		    #                        # spaces in them - this
		    #                        # indicates that there is a problem;
		    #                        # eg synonym spelled wrongly
		    #                        # [MetaCyc accessions have spaces!]
		    #                        my $msg =
		    #                          "ignoring $db:$dbacc - doesn't look like accession";
		    #                        $self->parse_err({msg=>$msg,
		    #                                        line_no=>$lnum,
		    #                                        line=>$line,
		    #                                        file=>$file});
		    #                    }
                    else {
                        $self->event(XREF_ANALOG, [[dbname => $db], [acc => $dbacc]]);
                    }
                }
            } else {
                # other parts on line
                # have redundant info,
                # but the relationship
                # part is useful
                my $rchar = $self->typemap($parts[$i-1],\%typemap);
		if (!$pxref) {
		    $self->parse_err("problem with $name $currxref: rel $rchar has no parent/object");
		} else {
		    $self->relationship_event($rchar, $pxref);
		}
            }
        }
	#$line =~ s/\\//g;
        # end of parse body
        if (@stack) {
            my $up = $stack[$#stack];
	    my $obj = $up->[1];
	    if (!$obj) {
		$self->parse_err("problem with $currxref: rel $rchar has no parent/object [top of stack is @$up]");
	    } else {
		$self->relationship_event($rchar, $up->[1]);
		$rtypenameh{$rchar} = 1;
	    }
        } else {
	    #            $self->event("rel", "isa", "TOP");
        }
        $self->end_event(TERM);
        push(@stack, [$indent, $currxref]);
    }
    $self->pop_stack_to_depth(1);
    foreach my $rtypename (keys %rtypenameh) {
	next if $rtypename eq 'is_a';
	$self->event(TYPEDEF, [
			       [id=>$rtypename],
			       [name=>$rtypename],
			       [domain=>$root_id],
			       [range=>$root_id],
			      ]);
    }
    $self->pop_stack_to_depth(0);
    $self->parsed_ontology(1);
}

sub relationship_event {
    my $self = shift;
    my $rchar = shift;
    my $to = shift;

    if ($rchar eq 'is_a' ||
	$rchar eq 'isa') {
	$self->event(IS_A, $to);
    }
    else {
	$self->event(RELATIONSHIP,
		     [[type => $rchar],
		      [to=>$to]]);
    }
}


sub typemap {
    my $self = shift;
    my $ch = shift;
    my %typemap = %{shift || {}};
    $ch =~ s/^ *//g;
    $ch =~ s/ *$//g;
    if ($typemap{$ch}) {
        $ch = $typemap{$ch};
    }
    elsif ($typemap{'\\'.$ch}) {
        $ch = $typemap{$ch};
    }
    elsif ($ch =~ /^\@(\w+)\@/) {
	$ch = lc($1);
    }
    else {
    }
    $ch =~ s/isa/is_a/;
    $ch =~ s/partof/part_of/;
    $ch;
}

sub unescapego {
    my $self = shift;
    my $ch = shift;
    $ch =~ s/\\//g;
    $ch;

}

1;
