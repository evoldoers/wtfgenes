# $Id: OBDXML.pm,v 1.3 2006/11/28 01:08:46 sjcarbon Exp $
#
# This GO module is maintained by Seth Carbon <sjcarbon@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself.

##
## TODO: Should the links to classes from instances be put in?
## TODO: Should I add the links to 'obd:with' from the ev instances?
## WARNING: Written using version XML::Writer 6.0.1. Earlier version
##          may not work.
##

package GO::IO::OBDXML;

=head1 NAME

  GO::IO::OBDXML;

=head1 SYNOPSIS

    my $apph = GO::AppHandle->connect(-d=>$go, -dbhost=>$dbhost);
    my $term = $apph->get_term({acc=>00003677});

    #### ">-" is STDOUT
    my $out = new FileHandle(">-");

    my $xml_out = GO::IO::OBDXML->new(-output=>$out);
    $xml_out->start_document();
    $xml_out->draw_term($term);
    $xml_out->end_document();

OR:

    my $apph = GO::AppHandle->connect(-d=>$go, -dbhost=>$dbhost);
    my $term = $apph->get_node_graph(-acc=>00003677, -depth=>2);
    my $out = new FileHandle(">-");

    my $xml_out = GO::IO::OBDXML(-output=>$out);
    $xml_out->start_document();
    $xml_out->draw_graph($term, 3677);
    $xml_out->end_document();

=head1 DESCRIPTION

Utility class to dump GO terms as OBD XML.  Currently you just call
start_ducument, then draw_term for each term, then end_document.

=cut

use strict;
use GO::Utils qw(rearrange);
use XML::Writer;


####################

=head2 new

    Usage   - my $xml_out = GO::IO::OBDXML->new(-output=>$out);
    Returns - None
    Args    - Output FileHandle

Initializes the writer object.  To write to standard out, do:

my $out = new FileHandle(">-");
my $xml_out = new GO::IO::OBDXML(-output=>$out);

=cut

sub new {
  my $class = shift;
  my $self = {};
  bless $self, $class;
  my ($out) =
    rearrange([qw(output)], @_);

  $out = new FileHandle(">-") unless $out;
  my $gen = new XML::Writer(OUTPUT=>$out);
  $self->{writer} = $gen;

  $gen->setDataMode(1);
  $gen->setDataIndent(2);

  return $self;
}


####################

=head2 cgi_header

    Usage   - $xml_out->cgi_header;
    Returns - None
    Args    - None

cgi_header prints the "Content-type: text/xml" statement.
If creating a CGI script, you should call this before start_document.

=cut

sub cgi_header {
  my $self = shift;
  print "Content-type: text/xml\n\n";
}


####################

=head2 start_document

    Usage   - $xml_out->start_document;
    Returns - None
    Args    - None

start_document takes care of the fiddly bits like xml declarations,
namespaces, etc.  It draws the initial tags and leaves the document
ready to add go:term nodes.

=cut

sub start_document {
  my $self = shift;

  $self->{writer}->xmlDecl('utf-8');
  $self->{writer}->startTag('graphset',
			    'xmlns'=>
			    'http://www.bioontology.org/obd/schema/obd-generic');
}


####################

=head2 start_graph

    Usage   - $xml_out->start_graph;
    Returns - None
    Args    - None

start_graph opens a new graph segment.

=cut

sub start_graph {
  my $self = shift;
  $self->{writer}->startTag('graph');
}


####################

=head2 end_document

    Usage   - $xml_out->end_document;

Call this when done.

=cut

sub end_document{
  my $self = shift;
  $self->{writer}->endTag('graphset');
}


####################

=head2 end_graph

    Usage   - $xml_out->end_graph;

Call this when done a graph segment.

=cut

sub end_graph {
  my $self = shift;
  $self->{writer}->endTag('graph');
}


####################

=head2 draw_node_graph

    Usage   - $xml_out->draw_node_graph(-graph=>$graph);
    Returns - None
    Args    -graph=>$graph,
            -show_associations=>'yes' or 'no', # optional, default 'yes'.
            -show_terms=>'yes' or 'no',        # optional, default 'yes'.
            -show_xrefs=>'yes' or 'no',        # optional, default 'yes'.
            -show_evidence=>'yes' or 'no',     # optional, default 'yes'.

=cut

##
sub draw_graph {
  my $self = shift;
  my ($graph, $show_associations, $show_evidence, $show_terms, $show_xrefs) =
    rearrange([qw(graph show_associations show_evidence
		  show_terms show_xrefs)], @_);

  foreach my $term (@{$graph->get_all_nodes}) {
    $self->draw_term(-term=>$term,
		     -graph=>$graph,
		     -show_associations=>$show_associations,
		     -show_terms=>$show_terms,
		     -show_xrefs=>$show_xrefs,
		     -show_evidence=>$show_evidence
		    );
  }
}


####################

=head2 draw_term

    Usage   - $xml_out->draw_term();
    Returns - None
    Args    -term=>$term,
            -graph=>$graph,                    # optional
            -show_associations=>'yes' or 'no', # optional, default 'yes'.
            -show_terms=>'yes' or 'no',        # optional, default 'yes'.
            -show_xrefs=>'yes' or 'no',        # optional, default 'yes'.
            -show_evidence=>'yes' or 'no',     # optional, default 'yes'.

=cut

sub draw_term {
  my $self = shift;
  my ($term, $graph,
      $show_associations, $show_terms,
      $show_xrefs, $show_evidence) =
	rearrange([qw(term graph
		      show_associations show_terms
		      show_xrefs show_evidence)], @_);

  $show_terms = $show_terms || 'yes';
  $show_xrefs = $show_xrefs || 'yes';
  $show_associations = $show_associations || 'yes';
  $show_evidence = $show_evidence || 'yes';

  ## We are going to show the terms in the graph.
  if ($show_terms eq 'yes') {

    ## Draw term node. Way of drawing depends on $show_ xrefs.
    if(	$show_xrefs eq 'yes'){
      $self->__draw_node(-id=>$term->acc, -metadata=>'class',
			 -label=>$term->name, -source=>$term->type,
			 -description=>$term->definition,
			 -aliases=>$term->synonym_list,
			 -xrefs=>$term->dbxref_list);
    }else{
      $self->__draw_node(-id=>$term->acc, -metadata=>'class',
			 -label=>$term->name, -source=>$term->type,
			 -description=>$term->definition,
			 -aliases=>$term->synonym_list);
    }

    ## Write out the links from the term if a graph was given.
    if( defined $graph ){
      my $rel_list = $graph->get_relationships($term->acc);
      foreach my $rel ( @$rel_list ){
	$self->__draw_link(-subject=>$rel->subject_acc,
			   -object=>$rel->object_acc,
			   -predicate=>$rel->type);
      }
    }
  }

  ## Write out associations if not nixed.
  if( $show_associations eq 'yes') {
    my $assoc_list = $term->association_list;
    foreach my $assoc (@$assoc_list) {

      ## Get gp and draw gp node.
      my $gp = $assoc->gene_product;
      $self->__draw_node(-id=>$gp->acc,
			 -metadata=>'class',
			 -label=>$gp->symbol,
			 -source=>$gp->type,
			 -description=>$gp->full_name,
			 -aliases=>$gp->synonym_list);

      ## Link the gp to the term.
      $self->__draw_link(-subject=>$gp->acc,
			 -object=>$term->acc,
			 -predicate=>'obd:has_role',
			 -id=>$gp->acc . '_obd:has_role_' . $term->acc);

      ## Make an ID for the node.
      my $ann_inst_id = 'AIID:' . $assoc->id;

      ## Create an annotation instance node.
      $self->__draw_node(-id=>$ann_inst_id,
			 -metadata=>'instance');

      ## Link annotation node to gp/term link.
      $self->__draw_link(-subject=>$ann_inst_id,
			 -object=>$gp->acc . '_obd:has_role_' . $term->acc,
			 -predicate=>'obd:posits',
			 -id=>$ann_inst_id . '_obd:posits_assoc');

      ## Now we'll deal with all the evidence...
      if( $show_evidence eq 'yes') {
	my $ev_list = $assoc->evidence_list;
	foreach my $ev (@$ev_list) {

	  ## Make an ID for the node.
	  #my $ev_node_id = $ev->xref->xref_key;
	  my $ev_node_id = 'ENID:' . $ev->id;

	  ## Draw term node. Way of drawing depends on $show_ xrefs.
	  if(	$show_xrefs eq 'yes'){
	    $self->__draw_node(-id=>$ev_node_id,
			       -metadata=>'instance',
			       -label=>$ev->code,
			       -xrefs=>$ev->xref_list);
	  }else{
	    ## Create evidence instance node w/o xrefs.
	    $self->__draw_node(-id=>$ev_node_id,
			       -metadata=>'instance',
			       -label=>$ev->code);
	  }

	  ## Create link from annotation instance to evidence instance.
	  $self->__draw_link(-subject=>$ann_inst_id,
			     -object=>$ev_node_id,
			     -predicate=>'obd:has_evidence');
	}
      }
    }
  }
}


##
sub __draw_node {

  my $self = shift;
  my ($id, $metadata, $label, $source, $description, $aliases, $xrefs) =
    rearrange([qw(id metadata label source description aliases xrefs)], @_);

  # Open node.
  if( $metadata ){
    $self->{writer}->startTag('node', 'id'=>$id, 'metadata'=>$metadata);
  }else{
    $self->{writer}->startTag('node', 'id'=>$id);
  }

  # Populate the node with: label, source, and description.
  if( $label ){
    $self->{writer}->startTag('label');
    $self->{writer}->cdata($label);
    $self->{writer}->endTag('label');
  }
  if( $source ){
    $self->{writer}->emptyTag('source', 'about'=>$source);
  }
  if( $description ){
    $self->__draw_sit(-tag=>'description', -label=>$description);
  }

  # Add any aliases.
  if( $aliases ){
    foreach my $alias ( @$aliases ) {
      $self->__draw_sit(-tag=>'alias', -label=>$alias, -scope=>'exact');
    }
  }

  # Add any xrefs.
  if( $xrefs ){
    foreach my $xref ( @$xrefs ) {
      $self->__draw_xref(-about=>$xref->xref_key, -context=>$xref->dbname);
    }
  }

  # Close node.
  $self->{writer}->endTag('node');
}


##
sub __draw_link {
  my $self = shift;
  my ($subject, $object, $predicate, $id) =
    rearrange([qw(subject object predicate id)], @_);

  if( $id ){
    $self->{writer}->startTag('link', 'id'=>$id);
  }else{
    $self->{writer}->startTag('link');
  }
  $self->{writer}->emptyTag('predicate', 'about'=>$predicate);
  $self->{writer}->emptyTag('subject', 'about'=>$subject);
  $self->{writer}->emptyTag('object', 'about'=>$object);
  $self->{writer}->endTag('link');
}


## BUG: xrefs not implemented here.
sub __draw_sit {
  my $self = shift;
  my ($tag, $label, $id, $scope, $type) =
    rearrange([qw(tag label id scope type)], @_);

  my %attr_hash;
  if( $id ){ $attr_hash{'id'} = $id; }
  if( $scope ){ $attr_hash{'scope'} = $scope; }
  if( $type ){ $attr_hash{'type'} = $type; }

  $self->{writer}->startTag($tag,
			    %attr_hash);
  $self->{writer}->startTag('label');
  $self->{writer}->cdata($label);
  $self->{writer}->endTag('label');
  $self->{writer}->endTag($tag);
}


##
sub __draw_xref {
  my $self = shift;
  my ($about, $context) =
    rearrange([qw(about context)], @_);
  if( $context ){
    $self->{writer}->startTag('xref', 'context'=>$context);
  }else{
    $self->{writer}->startTag('xref');
  }
  $self->{writer}->emptyTag('linkref', 'about'=>$about);
  $self->{writer}->endTag('xref');
}


1;
