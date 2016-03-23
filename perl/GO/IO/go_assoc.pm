# $Id: go_assoc.pm,v 1.6 2008/06/02 22:00:44 sjcarbon Exp $
#
# This GO module is maintained by Seth Carbon <sjcarbon@berkeleybop.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself.

##
## TODO: Fix documentation.
##

package GO::IO::go_assoc;

=head1 NAME

  GO::IO::go_assoc;

=head1 SYNOPSIS

    my $apph = GO::AppHandle->connect(-d=>$go, -dbhost=>$dbhost);
    my $term = $apph->get_term({acc=>00003677});

    #### ">-" is STDOUT
    my $out = new FileHandle(">-");

    my $ga_out = GO::IO::go_assoc->new(-output=>$out);
    $ga_out->write_term($term);

OR:

    my $apph = GO::AppHandle->connect(-d=>$go, -dbhost=>$dbhost);
    my $graph = $apph->get_node_graph(-acc=>00003677, -depth=>2);
    my $out = new FileHandle(">-");

    my $ga_out = GO::IO::go_assoc->new(-output=>$out);
    $ga_out->write_graph($graph);

=head1 DESCRIPTION

Utility class to dump GO terms as OBD XML.  Currently, you just call
start_document, write_term for each term, then end_document.

=cut


use strict;
use GO::Utils qw(rearrange);


####################

=head2 new

    Usage   - my $ga_out = new GO::IO::go_assoc(-output=>$out);
    Returns - Output emitter.
    Args    - Output FileHandle

Initializes the writer object.  To write to standard out, do:

my $out = new FileHandle(">-");
my $ga_out = new GO::IO::go_assoc($out);

=cut

sub new {
  my $class = shift;
  my $self = {};
  #my $outhandle = rearrange([qw(output)], @_);
  my $outhandle = shift;
  $self->{OUT} = $outhandle;

  bless $self, $class;
  return $self;
}


####################

=head2 cgi_header

    Usage   - $ga_out->cgi_header;
    Returns - None
    Args    - None

cgi_header prints the "Content-type: text/plain" statement.
If creating a CGI script, you should call this before further action.

=cut

sub cgi_header {
  my $self = shift;
  my $fh = $self->{OUT};
  print $fh "Content-type: text/plain\n\n";
}


####################

=head2 write_graph

    Usage   - $ga_out->write_graph(-graph=>$graph);
    Returns - None
    Args    -graph=>$graph,
            -deep=>1 or 0,           # optional, default 0.
            -qualifier=>1 or 0,      # optional, default 1.
            -with=>1 or 0,           # optional, default 1.
            -object_name=>1 or 0,    # optional, default 1.
            -object_synonym=>1 or 0, # optional, default 1.

=cut

##
sub write_graph {
  my $self = shift;
  my ($graph, $deep, $qualifier,
      $with, $object_name, $object_synonym) =
	rearrange([qw(graph deep qualifier
		      with object_name object_synonym)], @_);

  my $term_list = $graph->get_all_nodes;
  $self->write_term_list(-term_listref=>$term_list,
			 -deep=>$deep,
			 -qualifier=>$qualifier,
			 -with=>$with,
			 -object_name=>$object_name,
			 -object_synonym=>$object_synonym
			);
}


####################

=head2 write_term_list

    Usage   - $ga_out->write_term_list();
    Returns - None
    Args    -term_listref=>$term_listref,
            -deep=>1 or 0,           # optional, default 0.
            -qualifier=>1 or 0,      # optional, default 1.
            -with=>1 or 0,           # optional, default 1.
            -object_name=>1 or 0,    # optional, default 1.
            -object_synonym=>1 or 0, # optional, default 1.

=cut

##
sub write_term_list {
  my $self = shift;
  my ($term_listref, $deep, $qualifier, $with, $object_name, $object_synonym) =
    rearrange([qw(term_listref deep qualifier
		  with object_name object_synonym)], @_);

  #print STDERR "\n\n" . @$term_listref . "\n\n";
  #print STDERR "\n\n" . $term->acc . "\n\n";
  #sleep 1;

  ##
  foreach my $term (@$term_listref) {

    $self->write_term(-term=>$term,
		      -deep=>$deep,
		      -qualifier=>$qualifier,
		      -with=>$with,
		      -object_name=>$object_name,
		      -object_synonym=>$object_synonym);
  }
}


####################

=head2 write_term

    Usage   - $ga_out->write_term();
    Returns - None
    Args    -term=>$term,
            -deep=>1 or 0,           # optional, default 0.
            -qualifier=>1 or 0,      # optional, default 1.
            -with=>1 or 0,           # optional, default 1.
            -object_name=>1 or 0,    # optional, default 1.
            -object_synonym=>1 or 0, # optional, default 1.

=cut

sub write_term{

  my $self = shift;
  my ($term, $deep, $qualifier, $with, $object_name, $object_synonym) =
	rearrange([qw(term deep qualifier
		      with object_name object_synonym)], @_);

  $deep = $deep || 0;
  $qualifier = $qualifier || 1;
  $with = $with || 1;
  $object_name = $object_name || 1;
  $object_synonym = $object_synonym || 1;

  my @output = ();

  my $assoc_listref;
  if( $deep ){
    $assoc_listref = $term->get_all_associations || [];
  }else{
    #$assoc_listref = $term->selected_association_list || [];
    $assoc_listref = $term->association_list;
  }

  foreach my $assoc (@$assoc_listref) {

    ## Get evidence info.
    my $ev_listref = $assoc->evidence_list;
    foreach my $ev (@$ev_listref) {

      ## Get gp info.
      my $gp = $assoc->gene_product;

      ## 1  DB   gene_product x dbxref.xref_dbname
      push @output, $gp->speciesdb;
      push @output, "\t";

      ## 2  DB_Object_ID  gene_product x dbxref.xref_xref_key
      push @output, $gp->acc;
      push @output, "\t";

      ## 3  DB_Object_Symbol  gene_product.symbol
      push @output, $gp->symbol;
      push @output, "\t";

      ## 4  NOT         association.is_not
      ##    Qualifiers  association_qualifier
      if ( $qualifier ) {
	if ( $assoc->is_not ) {
	  push @output, 'NOT';
	  #}else{
	  #push @output, 'IS';
	}
      }
      push @output, "\t";

      ## 5  GOid   association x term.acc
      push @output, $term->acc;
      push @output, "\t";

      ## 6  DB:Reference  association x evidence.dbxref_id
      my $xref_listref = $ev->xref_list;
      foreach my $xref ( @$xref_listref ) {
	push @output, $xref->dbname . ':' . $xref->xref_key;
	push @output, '|';
      }
      ## Get rid of trailing '|'.
      pop @output if $output[$#output] eq '|';
      push @output, "\t";

      ## 7  Evidence   association x evidence.code
      push @output, $ev->code;
      push @output, "\t";

      ## 8  With/From  evidence.seq_acc [DENORMALIZED]
      ##               evidence x evidence_dbxref x dbxref [NORMALIZED]
      if ( $with && $ev->seq_acc ) {
	push @output, $ev->seq_acc;
	push @output, '|';
      }
      ## Get rid of trailing '|'.
      pop @output if $output[$#output] eq '|';
      push @output, "\t";

      ## 9  Aspect  association x term.term_type
      my $aspect = $term->type;
      if ( $aspect eq 'cellular_component' ||
	   $aspect eq 'C' || $aspect eq 'c' ) {
	push @output, 'C';
      } elsif ( $aspect eq 'molecular_function' ||
		$aspect eq 'F' || $aspect eq 'f' ) {
	push @output, 'F';
      } elsif ( $aspect eq 'biological_process' ||
		$aspect eq 'P' || $aspect eq 'p' ) {
	push @output, 'P';
      }
      push @output, "\t";

      ## 10  DB_Object_Name  gene_product.full_name
      if ( $object_name && $gp->full_name ) {
	push @output, $gp->full_name;
      }
      push @output, "\t";

      ## 11  Synonym  gene_product x gene_product_synonym
      my $syn_listref = $gp->synonym_list;
      if ( $syn_listref && @$syn_listref && $object_synonym ) {
	foreach my $syn (@$syn_listref) {
	  push @output, $syn;
	  push @output, '|';
	}
	## Get rid of trailing '|'.
	pop @output if $output[$#output] eq '|';
      }
      push @output, "\t";

      ## 12  DB_Object_type  gene_product.type_id x term.name [TBA]
      push @output, $gp->type;
      push @output, "\t";

      ## 13  Taxon  gene_product x species.ncbi_taxa_id
      push @output, 'taxon:';
      push @output, $gp->species->ncbi_taxa_id;
      push @output, "\t";

      ## 14  Date  association.assoc_date
      push @output, $assoc->assocdate;
      push @output, "\t";

      ## 15  Assigned_by  association.source_db_id x db.name
      ## TODO/NOTE: Hidden API.
      push @output, $assoc->assigned_by || '';

      push @output, "\n";
    }
  }

  my $fh = $self->{OUT} || undef;
  if( defined($fh) && scalar(@output) > 0 ){
    print $fh join '', @output;
  }
}


# ####################


# =head2 write_association_list

#     Usage   - $ga_out->write_association();
#     Returns - None
#     Args    -term=>$term,
#             -qualifier=>1 or 0,      # optional, default 1.
#             -with=>1 or 0,           # optional, default 1.
#             -object_name=>1 or 0,    # optional, default 1.
#             -object_synonym=>1 or 0, # optional, default 1.

# =cut

# sub write_association_list{

#   my $self = shift;
#   my ($assoc_listref,
#       $qualifier, $with, $object_name, $object_synonym) =
# 	rearrange([qw(assoc_listref
# 		      qualifier with object_name object_synonym)], @_);

#   $qualifier = $qualifier || 1;
#   $with = $with || 1;
#   $object_name = $object_name || 1;
#   $object_synonym = $object_synonym || 1;

#   my @output = ();

#   foreach my $assoc (@$assoc_listref) {

#     ## Get evidence info.
#     my $ev_listref = $assoc->evidence_list;
#     foreach my $ev (@$ev_listref) {

#       ## Get gp info.
#       my $gp = $assoc->gene_product;

#       ## 1  DB   gene_product x dbxref.xref_dbname
#       push @output, $gp->speciesdb;
#       push @output, "\t";

#       ## 2  DB_Object_ID  gene_product x dbxref.xref_xref_key
#       push @output, $gp->acc;
#       push @output, "\t";

#       ## 3  DB_Object_Symbol  gene_product.symbol
#       push @output, $gp->symbol;
#       push @output, "\t";

#       ## 4  NOT         association.is_not
#       ##    Qualifiers  association_qualifier
#       if ( $qualifier ) {
# 	if ( $assoc->is_not ) {
# 	  push @output, 'NOT';
# 	  #}else{
# 	  #push @output, 'IS';
# 	}
#       }
#       push @output, "\t";

#       ## 5  GOid   association x term.acc
#       #push @output, $term->acc;
#       push @output, "\t";

#       ## 6  DB:Reference  association x evidence.dbxref_id
#       my $xref_listref = $ev->xref_list;
#       foreach my $xref ( @$xref_listref ) {
# 	push @output, $xref->dbname . ':' . $xref->xref_key;
# 	push @output, '|';
#       }
#       ## Get rid of trailing '|'.
#       pop @output if $output[$#output] eq '|';
#       push @output, "\t";

#       ## 7  Evidence   association x evidence.code
#       push @output, $ev->code;
#       push @output, "\t";

#       ## 8  With/From  evidence.seq_acc [DENORMALIZED]
#       ##               evidence x evidence_dbxref x dbxref [NORMALIZED]
#       if ( $with && $ev->seq_acc ) {
# 	push @output, $ev->seq_acc;
# 	push @output, '|';
#       }
#       ## Get rid of trailing '|'.
#       pop @output if $output[$#output] eq '|';
#       push @output, "\t";

#       ## 9  Aspect  association x term.term_type
#       #my $aspect = $term->type;
#       my $aspect = 'foo';
#       if ( $aspect eq 'cellular_component' ||
# 	   $aspect eq 'C' || $aspect eq 'c' ) {
# 	push @output, 'C';
#       } elsif ( $aspect eq 'molecular_function' ||
# 		$aspect eq 'F' || $aspect eq 'f' ) {
# 	push @output, 'F';
#       } elsif ( $aspect eq 'biological_process' ||
# 		$aspect eq 'P' || $aspect eq 'p' ) {
# 	push @output, 'P';
#       }
#       push @output, "\t";

#       ## 10  DB_Object_Name  gene_product.full_name
#       if ( $object_name && $gp->full_name ) {
# 	push @output, $gp->full_name;
#       }
#       push @output, "\t";

#       ## 11  Synonym  gene_product x gene_product_synonym
#       my $syn_listref = $gp->synonym_list;
#       if ( $syn_listref && @$syn_listref && $object_synonym ) {
# 	foreach my $syn (@$syn_listref) {
# 	  push @output, $syn;
# 	  push @output, '|';
# 	}
# 	## Get rid of trailing '|'.
# 	pop @output if $output[$#output] eq '|';
#       }
#       push @output, "\t";

#       ## 12  DB_Object_type  gene_product.type_id x term.name [TBA]
#       push @output, $gp->type;
#       push @output, "\t";

#       ## 13  Taxon  gene_product x species.ncbi_taxa_id
#       push @output, 'taxon:';
#       push @output, $gp->species->ncbi_taxa_id;
#       push @output, "\t";

#       ## 14  Date  association.assoc_date
#       push @output, $assoc->assocdate;
#       push @output, "\t";

#       ## 15  Assigned_by  association.source_db_id x db.name
#       ## TODO/NOTE: Hidden API.
#       push @output, $assoc->assigned_by;

#       push @output, "\n";
#     }
#   }

#   my $fh = $self->{OUT};
#   print $fh join '', @output;
# }


1;
