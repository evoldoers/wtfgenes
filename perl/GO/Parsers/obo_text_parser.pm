# $Id: obo_text_parser.pm,v 1.52 2010/03/11 22:40:27 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::Parsers::obo_text_parser;

=head1 NAME

  GO::Parsers::obo_text_parser     - OBO Flat file parser object

=head1 SYNOPSIS

  do not use this class directly; use GO::Parser

=cut

=head1 DESCRIPTION


=cut

use Exporter;
use Text::Balanced qw(extract_quotelike extract_bracketed);
use base qw(GO::Parsers::base_parser);
use GO::Parsers::ParserEventNames;

use Carp;
use FileHandle;

use strict qw(vars refs);

sub dtd {
    'obo-parser-events.dtd';
}

sub parse_fh {
    my ($self, $fh) = @_;

    $self->start_event(OBO);
    $self->parse_fh_inner($fh);

    $self->pop_stack_to_depth(0);
    $self->parsed_ontology(1);

}

sub parse_fh_inner {

    my ($self, $fh) = @_;
    my $file = $self->file;
    my $litemode = $self->litemode;
    my $is_go;
    local($_);    # latest perl is more strict about modification of $_

    $self->fire_source_event($file);
    $self->start_event(HEADER);
    my $stanza_count;
    my $in_hdr = 1;
    my $is_root = 1; # default
    my $namespace_set;
    my $id;
    my $namespace = $self->force_namespace; # default
    my $force_namespace = $self->force_namespace;
    my $usc = $self->replace_underscore;
    my %id_remap_h = ();
    my @imports = ();

    my $is_utf8;

    # temporary hack...
    if ($ENV{OBO_IDMAP}) {
        my @parts = split(/\;/,$ENV{OBO_IDMAP});
        foreach (@parts) {
            if (/(.*)=(.*)/) {
                $id_remap_h{$1} = $2;
            }
        }
    }

    my $default_id_prefix;

    while(<$fh>) {
	chomp;

        if (/^encoding:\s*utf/) {
            $is_utf8 = 1;
        }

        if (!$is_utf8) {
            tr [\200-\377]
                [\000-\177];   # see 'man perlop', section on tr/
            # weird ascii characters should be excluded
            tr/\0-\10//d;   # remove weird characters; ascii 0-8
            # preserve \11 (9 - tab) and \12 (10-linefeed)
            tr/\13\14//d;   # remove weird characters; 11,12
            # preserve \15 (13 - carriage return)
            tr/\16-\37//d;  # remove 14-31 (all rest before space)
            tr/\177//d;     # remove DEL character
        }

        s/^\!.*//;
        s/[^\\]\!.*//;
        #s/[^\\]\#.*//;
        s/^\s+//;
        s/\s+$//;
	next unless $_;
        next if ($litemode && $_ !~ /^(\[|id:|name:|is_a:|relationship:|namespace:|is_obsolete:)/ && !$in_hdr);
	if (/^\[(\w+)\]\s*(.*)/) { # new stanza

            # we are at the beginning of a new stanza
            # reset everything and make sure everything from
            # previous stanza is exported

	    my $stanza = lc($1);
	    my $rest = $2;
	    if ($in_hdr) {
		$in_hdr = 0;
		$self->end_event(HEADER);
	    }
	    else {
                if (!$namespace_set) {
                    if (!$namespace) {
                        if ($stanza ne 'instance') {
                            #$self->parse_err("missing namespace for ID: $id");
                        }
                    }
                    else {
                        $self->event(NAMESPACE, $namespace);
                    }
                }
                $self->event(IS_ROOT,1) if $is_root;
                $is_root = 1; # assume root by default; override if parents found
                $namespace_set = 0;
		$self->end_event;
	    }
            $is_root = 0 unless $stanza eq 'term';
	    $self->start_event($stanza);
            $id = undef;
            $stanza_count++;
	}
        elsif ($in_hdr) {

            # we are in the header section

            if (/^([\w\-]+)\:\s*(.*)/) {  # tag-val pair
                my ($tag, $val) = ($1,$2);
                if ($tag eq 'subsetdef') {
                    if ($val =~ /(\S+)\s+(.*)/) {
                        my $subset_id = $1;
                        $val = $2;
                        my ($subset_name, $parts) =
                          extract_qstr($val);
                        $val =
                          [[ID,$subset_id],
                           [NAME,$subset_name],
                           map {dbxref($_)} @$parts];
                    }
                    else {
                        $self->parse_err("subsetdef: expect ID \"NAME\", got: $val");
                    }
                }
                if ($tag eq 'synonymtypedef') {
                    if ($val =~ /(\S+)\s+\"(.*)\"\s*(.*)/) {
                        my $stname = $1;
                        my $stdef = $2;
                        my $scope = $3;
                        $val =
                          [[ID,$stname],
                           [NAME,$stdef],
                           ($scope ? ['scope', $scope] : ())];

                    }
                    else {
                        $self->parse_err("synonymtypedef: expect ID \"NAME\", got: $val");
                    }
                }
                if ($tag eq 'idspace') {
                    my ($idspace,$global,@rest) = split(' ',$val);
                    if (!$global) {
                        $self->parse_err("idspace requires two columns");
                    }
                    $val =
                      [['local',$idspace],
                       ['global',$global],
                       (@rest ? [COMMENT,join(' ',@rest)] : ()),
                      ];
                }
                if ($tag eq 'local-id-mapping') {
                    if ($val =~ /(\S+)\s+(.*)/) {
                        # with a local ID mapping we delay binding
                        $val =
                          [['local',$1],
                           ['to',$2]];
                    }
                    else {
                        $self->parse_err("id-mapping requires two columns");
                    }
                }
                if ($tag eq 'import') {
                    if ($ENV{OBO_FOLLOW_IMPORTS}) {
                        push(@imports, $val);
                    }
                    else {
                        # handled below
                        #$self->event(import=>$val);
                    }
                }

                $self->event($tag=>$val);

                # post-processing
                if ($tag eq 'default-namespace') {
                    $namespace = $val
                      unless $namespace;
                }
                if ($tag eq 'id-mapping') {
                    if ($val =~ /(\S+)\s+(.*)/) {
                        # bind at parse time
                        if ($id_remap_h{$1}) {
                            $self->parse_err("remapping $1 to $2");
                        }
                        $id_remap_h{$1} = $2;
                    }
                    else {
                        $self->parse_err("id-mapping requires two columns");
                    }
                }
                if ($tag eq 'default-id-prefix') {
                    $default_id_prefix = $val;
                }
            }
            else {
                $self->parse_err("illegal header entry: $_");
            }
        } # END OF IN-HEADER
	elsif (/^([\w\-]+)\:\s*(.*)/) {  # tag-val pair
	    my ($tag, $val) = ($1,$2);
            my $qh;
            ($val, $qh) = extract_quals($val);
	    #$val =~ s/\\//g;
	    my $val2 = $val;
	    $val2 =~ s/\\,/,/g;
	    $val2 =~ s/\\//g;
            if ($tag eq ID) {
                if ($id_remap_h{$val}) {
                    $val = $id_remap_h{$val};
                }
                if ($val !~ /:/) {
                    if ($default_id_prefix) {
                        $val = "$default_id_prefix:$val";
                    }
                }
            }
            elsif ($tag eq NAME) {
                # replace underscore in name
                $val = $val2;
                if ($usc) {
                    $val =~ s/_/$usc/g;
                }
            }
	    elsif ($tag eq RELATIONSHIP) {
		my ($type, @ids) = split(' ', $val2);
		my $id = shift @ids;
                if ($id_remap_h{$type}) {
                    $type = $id_remap_h{$type};
                }
                if ($type !~ /:/) {
                    if ($default_id_prefix) {
                        $type = "$default_id_prefix:$type";
                    }
                }
		$val = [[TYPE,$type],[TO,$id]];
		push(@$val,map {['additional_argument',$_]} @ids);
	    }
	    elsif ($tag eq INTERSECTION_OF || $tag eq UNION_OF) {
		my ($type, $id) = split(' ', $val2);
                if ($id_remap_h{$type}) {
                    $type = $id_remap_h{$type};
                }
                if ($type !~ /:/) {
                    if ($default_id_prefix) {
                        $type = "$default_id_prefix:$type";
                    }
                }
		if (defined $id) {
                    $val = [[TYPE,$type],[TO,$id]];
                }
                else {
                    $id = $type;
                    $val = [[TO,$id]];
                }
	    }
	    elsif ($tag eq INVERSE_OF || $tag eq TRANSITIVE_OVER || $tag eq IS_A) {
                if ($id_remap_h{$val}) {
                    $val = $id_remap_h{$val};
                }
                if ($val !~ /:/) {
                    if ($default_id_prefix) {
                        $val = "$default_id_prefix:$val";
                    }
                }
	    }
	    elsif ($tag eq DISJOINT_FROM) {
                if ($id_remap_h{$val}) {
                    $val = $id_remap_h{$val};
                }
                if ($val !~ /:/) {
                    if ($default_id_prefix) {
                        $val = "$default_id_prefix:$val";
                    }
                }
	    }
	    elsif ($tag eq XREF) {
                $tag = XREF_ANALOG;
		my $dbxref = dbxref($val);
		$val = $dbxref->[1];
	    }
	    elsif ($tag eq XREF_ANALOG) {
		my $dbxref = dbxref($val);
		$val = $dbxref->[1];
	    }
	    elsif ($tag eq XREF_UNKNOWN) {
		my $dbxref = dbxref($val);
		$val = $dbxref->[1];
	    }
	    elsif ($tag eq PROPERTY_VALUE) {
                if ($val =~ /^(\S+)\s+(\".*)/) {
                    # first form
                    # property_value: relation "literal value" xsd:datatype
                    my $type = $1;
                    my $rest = $2;
                    my ($to, $datatype) = extract_quotelike($rest);
                    $to =~ s/^\"//;
                    $to =~ s/\"$//;
                    $datatype =~ s/^\s+//;
                    $val = [[TYPE,$type],
                            [VALUE,$to],
                            [DATATYPE,$datatype]];
                }
                else {
                    # second form
                    # property_value: relation ToID
                    my ($type,$to) = split(' ',$val);
                    $val = [[TYPE,$type],
                            [TO,$to]];
                }
	    }
            elsif ($tag eq NAMESPACE) {
                if ($force_namespace) {
                    # override whatever namespace was provided
                    $val = $force_namespace;
                }
                else {
                    # do nothing - we will export later
                }
                $namespace_set = $val;
            }
	    elsif ($tag eq DEF) {
		my ($defstr, $parts) =
		  extract_qstr($val);
		$val =
		  [[DEFSTR,$defstr],
		   map {dbxref($_)} @$parts];
	    }
	    elsif ($tag =~ /(\w*)synonym/) {
                my $scope = $1 || '';
                if ($scope) {
                    $tag = SYNONYM;
                    if ($scope =~ /(\w+)_$/) {
                        $scope = $1;
                    }
                    else {
                        $self->parse_err("bad synonym type: $scope");
                        $scope = '';
                    }
                }
		my ($syn, $parts, $extra_quals) =
		  extract_qstr($val2);
                if (@$extra_quals) {
                    $scope = shift @$extra_quals;
                    $scope = lc($scope);
                    $qh->{synonym_type} = shift @$extra_quals if @$extra_quals;
                }
                if ($qh->{scope}) {
                    if ($scope) {
                        if ($scope ne $qh->{scope}) {
                            $self->parse_err("inconsistent scope: $scope/$qh->{scope}");
                        }
                        else {
                            $self->parse_err("redundant scope: $scope");
                        }
                    }
                }
                else {
                    $qh->{scope} = $scope;
                }
            
		$val =
		  [[SYNONYM_TEXT,$syn],
		   (map {dbxref($_)} @$parts)];
	    }
	    elsif ($tag =~ /formula/) {
		my ($formula, $parts, $extra_quals) =
		  extract_qstr($val2);
                my $lang = 'CLIF';
                if (@$extra_quals) {
                    $lang = shift @$extra_quals;
                }
                $qh->{format} = $lang;
            
		$val =
		  [['formula_text',$formula],
		   (map {dbxref($_)} @$parts)];
	    }
	    elsif ($tag eq 'holds_temporally_between' ||    # experimental support for obof1.3
                   $tag eq 'holds_atemporally_between' ||
                   $tag eq 'holds_on_class_level_between') {
		my ($sub, $ob) = split(' ', $val2);
                if ($id_remap_h{$sub}) {
                    $sub = $id_remap_h{$sub};
                }
                if ($id_remap_h{$ob}) {
                    $ob = $id_remap_h{$ob};
                }
		$val = [[subject=>$sub],[object=>$ob]];
	    }
	    elsif ($tag eq 'holds_over_chain' || $tag eq 'equivalent_to_chain') {    # obof1.3
		my @rels = split(' ', $val2);
                @rels = map {                 
                    my $rel = $_;
                    if ($id_remap_h{$_}) { 
                        $rel = $id_remap_h{$_}
                    }
                    if ($rel !~ /:/) {
                        if ($default_id_prefix) {
                            $rel = "$default_id_prefix:$rel";
                        }
                    }
                    $rel;
                } @rels;
		$val = [map {[relation=>$_]} @rels];
	    }
	    elsif ($tag =~ /^expand/) {
		my ($template, $parts) =
		  extract_qstr($val);
		$val = $template;
	    }
	    else {
		$val = $val2;
		# normal tag:val
	    }
            if (!ref($val) && $val eq 'true') {
                $val = 1;
            }
            if (!ref($val) && $val eq 'false') {
                $val = 0;
            }
            if (%$qh) {
                # note that if attributes are used for
                # terminal nodes then we effectively have
                # to 'push the node down' a level;
                # eg
                # <is_a>x</is_a>
                #    ==> [is_a=>'x']
                # <is_a t="v">x</is_a> 
                #    ==> [is_a=>[[@=>[[t=>v]]],[.=>x]]]
                my $data = ref $val ? $val : [['.'=>$val]];
                my @quals = map {[$_=>$qh->{$_}]} keys %$qh;
                $self->event($tag=>[['@'=>[@quals]],
                                    @$data,
                                   ]);
            }
            else {
                $self->event($tag=>$val);
            }

            if ($tag eq IS_A || $tag eq RELATIONSHIP) {
                $is_root = 0;
            }
            if ($tag eq IS_OBSOLETE && $val) {
                $is_root = 0;
            }
	    if ($tag eq ID) {
                $id = $val;
	    }
	    if ($tag eq NAME) {
                if (!$id) {
                    $self->parse_err("missing id!")
                }
                else {
                    $self->acc2name_h->{$id} = $val;
                }
	    }
	}
	else {
	    $self->throw("uh oh: $_");
	}
    }

    # duplicated code! check final event
    if (!$namespace_set) {
        if (!$namespace && $stanza_count) {
            #$self->parse_err("missing namespace for ID: $id");
        }
        else {
            $self->event(NAMESPACE, $namespace);
        }
    }
    $self->event(IS_ROOT,1) if $is_root;

    foreach my $import_file (@imports) {
        $import_file = $self->download_file_if_required($import_file);
        $self->file($import_file);
        $self->pop_stack_to_depth(1);
        #$self->end_event(HEADER);
        my $ifh = FileHandle->new($import_file);
        $self->parse_fh_inner($ifh);
        #$self->pop_stack_to_depth(1);
        $ifh->close();
    }

    return;
}

# each tag line can have trailing qualifiers in {}s at the end
sub extract_quals {
    my $str = shift;

    my %q = ();
    if ($str =~ /(.*[^\s])\s+(\{.*)\}\s*$/) {
        my $return_str = $1;
        my $extr = $2;
        if ($extr) {
            my @qparts = split_on_comma($extr);
            foreach (@qparts) {
                if (/(\w+)=\"(.*)\"/) {
                    $q{$1} = $2;
                }
                elsif (/(\w+)=\'(.*)\'/) {
                    $q{$1} = $2;
                }
                elsif (/(\w+)=(\S+)/) { # current 1.2 standard; non-quoted
                    $q{$1} = $2;
                }
                else {
                    warn("$_ in $str");
                }
            }
        }
        return ($return_str, \%q);
    }
    else {
        return ($str, {});
    }
}

sub extract_qstr {
    my $str = shift;

    my ($extr, $rem, $prefix) = extract_quotelike($str);
    my $txt = $extr;
    $txt =~ s/^\"// if $txt;
    $txt =~ s/\"$// if $txt;
    if ($prefix) {
	warn("illegal prefix: $prefix in: $str");
    }

    my @extra = ();

    # synonyms can have two words following quoted part
    # before dbxref section
    #  - two
    if ($rem =~ /(\w+)\s+(\w+)\s+(\[.*)/) {
        $rem = $3;
        push(@extra,$1,$2);
    }
    elsif ($rem =~ /(\w+)\s+(\[.*)/) {
        $rem = $2;
        push(@extra,$1);
    }
    else {
    }

    my @parts = ();
    while (($extr, $rem, $prefix) = extract_bracketed($rem, '[]')) {
	last unless $extr;
	$extr =~ s/^\[//;
	$extr =~ s/\]$//;
	push(@parts, $extr) if $extr;
    }
    @parts =
      map {split_on_comma($_)} @parts;
    
    $txt =~ s/\\//g if $txt;
    return ($txt, \@parts, \@extra);
}

sub split_on_comma {
    my $str = shift;
    my @parts = ();
    while ($str =~ /(.*[^\\],\s*)(.*)/) {
	$str = $1;
	my $part = $2;
	unshift(@parts, $part);
	$str =~ s/,\s*$//;
    }
    unshift(@parts, $str);
    return map {s/\\//g;$_} @parts;
}

# turns a DB:ACC string into an obo-xml dbxref element
sub dbxref {
    my $str = shift;
    $str =~ s/\\//g;
    my $name;
    if ($str =~ /(.*)\s+\"(.*)\"$/) {
        $str = $1;
        $name = $2;
    }
    my ($db, @rest) = split(/:/, $str);
    my $acc = join(':',@rest);
    $db =~ s/^\s+//;
    if ($db eq 'http' && $acc =~ /^\/\//) {
        # dbxref is actually a URI
        $db = 'URL';
        $acc = simple_escape($acc);
        $acc =~ s/\s/\%20/g;
        $acc = "http:$acc";
    }
    else {
#        $db=escape($db);
#        $acc=escape($acc);
    }
    $db =~ s/\s+/_/g;  # HumanDO.obo has spaces in xref
    $acc =~ s/\s+/_/g;
    $db = 'NULL' unless $db;
    $acc = 'NULL' unless $acc;
    [DBXREF,[[ACC,$acc],
              [DBNAME,$db],
              defined $name ? [NAME,$name] : ()
             ]];
}

sub parse_term_expression {
    my $self = shift;
    my $expr = shift;
    my ($te,$rest) = $self->parse_term_expression_with_rest($expr);
    if ($rest) {
        $self->parse_err("trailing: $rest");
    }
    return Data::Stag->nodify($te);
}

sub parse_term_expression_with_rest {
    my $self = shift;
    my $expr = shift;
    if ($expr =~ /^\((.*)/) {
        my $genus_expr = $1;
        my ($genus,$diff_expr) = $self->parse_term_expression_with_rest($genus_expr);
        my $next_c = substr($diff_expr,0,1,'');
        if ($next_c eq ')') {
            my ($diffs,$rest) = $self->parse_differentia_with_rest($diff_expr);
            my $stag = [intersection=>[
                                       [link=>[[to=>[$genus]]]],
                                       @$diffs]];
            return ($stag,$rest);
            
        }
        else {
            $self->parse_err("expected ) at end of genus. Got: $next_c followed by $diff_expr");
        }
    }
    elsif ($expr =~ /^([\w\:\.\-]+)\^(.*)/) {
        my $genus = $1;
        my $diff_expr = $2;
        my ($diffs,$rest) = $self->parse_differentia_with_rest($diff_expr);
        my $stag = [intersection=>[
                                   [link=>[[to=>$genus]]],
                                   @$diffs]];
        return ($stag,$rest);
    }
    elsif ($expr =~ /^([\w\:\.\-]+)(.*)/) {
        return ($1,$2);
    }
    else {
        $self->parse_err("could not parse: $expr");
    }
}

sub parse_differentia {
    my $self = shift;
    my $expr = shift;
    my ($diffs,$rest) = $self->parse_differentia_with_rest($expr);
    if ($rest) {
        $self->parse_err("trailing: $rest");
    }
    
    Data::Stag->nodify($_) foreach @$diffs;
    return $diffs;
}

sub parse_differentia_with_rest {
    my $self = shift;
    my $expr = shift;
    if ($expr =~ /^(.+?)\((.*)/) {
        my $rel = $1;
        my $term_expr = $2;
        my ($term,$rest) = $self->parse_term_expression_with_rest($term_expr);
        my $diff = [link=>[[type=>$rel],
                           [to=>(ref($term) ? [$term] : $term)]]];
        if ($rest) {
            my $next_c = substr($rest,0,1,'');
            if ($next_c eq ')') {
                $next_c = substr($rest,0,1);
                if ($next_c eq '^' || $next_c eq ',') {
                    my ($next_diffs,$next_rest) = $self->parse_differentia_with_rest(substr($rest,1));
                    if (!$next_diffs) {
                        $self->parse_err("problem parsing differentia: $rest. Expr: $term_expr");
                        return ([$diff],$rest);
                    }
                    return ([$diff,@$next_diffs],$next_rest);
                }
                elsif ($next_c eq '') {
                    return ([$diff],$rest);
                }
                elsif ($next_c eq ')') {
                    return ([$diff],$rest);
                }
                else {
                    $self->parse_err("expected ^ or ) in differentium. Got: $next_c followed_by: $rest. Expr: $term_expr");
                }
            }
            else {
                $self->parse_err("expected ) to close differentium. Got: $next_c followed by: $rest. Expr: $term_expr");
            }
        }
        else {
            $self->parse_err("expected ). Got: \"\". Expr: $term_expr");
        }
    }
    else {
        $self->parse_err("expect relation(...). Got: $expr. ");
    }
}

# lifted from CGI::Util

our $EBCDIC = "\t" ne "\011";
# (ord('^') == 95) for codepage 1047 as on os390, vmesa
our @E2A = (
   0,  1,  2,  3,156,  9,134,127,151,141,142, 11, 12, 13, 14, 15,
  16, 17, 18, 19,157, 10,  8,135, 24, 25,146,143, 28, 29, 30, 31,
 128,129,130,131,132,133, 23, 27,136,137,138,139,140,  5,  6,  7,
 144,145, 22,147,148,149,150,  4,152,153,154,155, 20, 21,158, 26,
  32,160,226,228,224,225,227,229,231,241,162, 46, 60, 40, 43,124,
  38,233,234,235,232,237,238,239,236,223, 33, 36, 42, 41, 59, 94,
  45, 47,194,196,192,193,195,197,199,209,166, 44, 37, 95, 62, 63,
 248,201,202,203,200,205,206,207,204, 96, 58, 35, 64, 39, 61, 34,
 216, 97, 98, 99,100,101,102,103,104,105,171,187,240,253,254,177,
 176,106,107,108,109,110,111,112,113,114,170,186,230,184,198,164,
 181,126,115,116,117,118,119,120,121,122,161,191,208, 91,222,174,
 172,163,165,183,169,167,182,188,189,190,221,168,175, 93,180,215,
 123, 65, 66, 67, 68, 69, 70, 71, 72, 73,173,244,246,242,243,245,
 125, 74, 75, 76, 77, 78, 79, 80, 81, 82,185,251,252,249,250,255,
  92,247, 83, 84, 85, 86, 87, 88, 89, 90,178,212,214,210,211,213,
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57,179,219,220,217,218,159
	 );

sub escape {
  shift() if @_ > 1 and ( ref($_[0]) || (defined $_[1] && $_[0] eq $CGI::DefaultClass));
  my $toencode = shift;
  return undef unless defined($toencode);
  # force bytes while preserving backward compatibility -- dankogai
  $toencode = pack("C*", unpack("C*", $toencode));
    if ($EBCDIC) {
      $toencode=~s/([^a-zA-Z0-9_.-])/uc sprintf("%%%02x",$E2A[ord($1)])/eg;
    } else {
      $toencode=~s/([^a-zA-Z0-9_.-])/uc sprintf("%%%02x",ord($1))/eg;
    }
  return $toencode;
}

sub simple_escape {
  return unless defined(my $toencode = shift);
  $toencode =~ s{&}{&amp;}gso;
  $toencode =~ s{<}{&lt;}gso;
  $toencode =~ s{>}{&gt;}gso;
  $toencode =~ s{\"}{&quot;}gso;
# Doesn't work.  Can't work.  forget it.
#  $toencode =~ s{\x8b}{&#139;}gso;
#  $toencode =~ s{\x9b}{&#155;}gso;
  $toencode;
}



1;
