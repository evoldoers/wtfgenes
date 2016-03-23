# $Id: ObanOwl.pm,v 1.1 2007/05/14 18:29:39 cmungall Exp $
#
# This GO module is maintained by Brad Marshall <bradmars@yahoo.com>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::IO::ObanOwl;

=head1 NAME

  GO::IO::ObanOwl;

=head1 SYNOPSIS

    my $apph = GO::AppHandle->connect(-d=>$go, -dbhost=>$dbhost);
    my $term = $apph->get_term({acc=>00003677});

    #### ">-" is STDOUT
    my $out = new FileHandle(">-");  
    
    my $xml_out = GO::IO::XML->new(-output=>$out);
    $xml_out->start_document();
    $xml_out->draw_term($term);
    $xml_out->end_document();

OR:

    my $apph = GO::AppHandle->connect(-d=>$go, -dbhost=>$dbhost);
    my $term = $apph->get_node_graph(-acc=>00003677, -depth=>2);
    my $out = new FileHandle(">-");  
    
    my $xml_out = GO::IO::XML(-output=>$out);
    $xml_out->start_document();
    $xml_out->draw_node_graph($term, 3677);
    $xml_out->end_document();

=head1 DESCRIPTION

Utility class to dump GO terms as xml.  Currently you just call
start_ducument, then draw_term for each term, then end_document.

If there's a need I'll add draw_node_graph, draw_node_list, etc.


=cut

use strict;
use GO::Utils qw(rearrange);
use XML::Writer;

=head2 new

    Usage   - my $xml_out = GO::IO::XML->new(-output=>$out);
    Returns - None
    Args    - Output FileHandle

Initializes the writer object.  To write to standard out, do:

my $out = new FileHandle(">-");
my $xml_out = new GO::IO::XML(-output=>$out);

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
    $gen->setDataIndent(4);

    return $self;
}

=head2 xml_header

    Usage   - $xml_out->xml_header;
    Returns - None
    Args    - None

start_document prints the "Content-type: text/xml" statement.
If creating a cgi script, you should call this before start_document.

=cut


sub xml_header {
    my $self = shift;
    
    print "Content-type: text/xml\n\n";

}



=head2 start_document

    Usage   - $xml_out->start_document(-timestamp=>$time);
    Returns - None
    Args    - optional: timestamp string, pre-formatted

start_ducument takes care of the fiddly bits like xml declarations,
namespaces, etc.  It draws the initial tags and leaves the document
ready to add go:term nodes.

=cut



sub start_document {
    my $self = shift;
    my ($timestamp) =
	rearrange([qw(timestamp)], @_);

    $self->{writer}->xmlDecl("UTF-8");
    $self->{writer}->startTag('rdf:RDF',
                              'xmlns:oban'=>'http://www.berkeleybop.org/ontologies/oban/alpha#',
                              'xmlns:rdf'=>'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                              'xmlns:rdfs' => 'http://www.w3.org/2000/01/rdf-schema#',
                              'xmlns:owl' => 'http://www.w3.org/2002/07/owl#',
                              'xmlns:xsd' => 'http://www.w3.org/2001/XMLSchema#',
                              'xmlns:obo_rel' => 'http://www.obofoundry.org/ro/ro.owl#',
                              'xmlns:obo' => 'http://purl.org/obo/owl');
}


=head2 end_document

    Usage   - $xml_out->end_document();

Call this when done.

=cut

sub end_document{
    my $self = shift;

    $self->{writer}->endTag('rdf:RDF');
}
 
=head2 draw_node_graph

    Usage   - $xml_out->draw_node_graph(-graph=>$graph);
    Returns - None
    Args    -graph=>$node_graph, 
            -focus=>$acc,                      ## optional
            -show_associations=>"yes" or "no"  ## optional

=cut

   
sub draw_node_graph {
    my $self = shift;
    my ($graph, $focus, $show_associations, $show_terms, $show_xrefs) =
	rearrange([qw(graph focus show_associations show_terms show_xrefs)], @_);
    
    foreach my $term (@{$graph->get_all_nodes}) {
        $self->draw_term(-term=>$term, 
                         -graph=>$graph,
                         #		       -focus=>$is_focus, 
                         -show_associations=>$show_associations,
                         -show_terms=>$show_terms,
                         -show_xrefs=>$show_xrefs
                        );
    }
}

sub write_all {
    my $self = shift;
    my ($terms, $graph, $focus, $show_associations, $show_terms, $show_xrefs) =
	rearrange([qw(terms graph focus show_associations show_terms show_xrefs)], @_);
    
    
    $self->start_document;
    if (!$terms) {
        $terms = $graph->get_all_terms;
    }
    foreach my $term (@$terms) {
        $self->draw_term(-term=>$term, 
                         -graph=>$graph,
#                         -focus=>$is_focus, 
                         -show_associations=>$show_associations,
                         -show_terms=>$show_terms,
                         -show_xrefs=>$show_xrefs
		      );
    }
}

sub __is_focus {
  my $self = shift;
  my ($node_list, $term) =
    rearrange([qw(node_list term)], @_);
  
  foreach my $node (@$node_list) {
    if ($node->acc eq $term->acc) {
      return "yes";
    } 
  }
      return "no";
}


=head2 draw_term

    Usage   - $xml_out->draw_term();
    Returns - None
    Args    -term=>$term, 
            -graph=>$graph, 
            -is_focus=>"yes" or "no",    ## optional
            -show_associations=>"yes" or "no",    ## optional
            -show_terms=>"yes" or "no",    ## optional, just draws associations
  

=cut

sub draw_term {
    my $self = shift;
    my ($term, $graph, $is_focus, $show_associations, $show_terms, $show_xrefs) =
	rearrange([qw(term graph focus show_associations show_terms show_xrefs)], @_);
    
    $show_terms = $show_terms || "";
    $is_focus = $is_focus || "";
    $show_xrefs = $show_xrefs || "";

    if ($show_terms ne 'no') {
	$self->startTag('owl:Class', 
                        #'focus'=>'yes', 
                        'rdf:about'=>$self->class_uri($term->public_acc),
                       );
        $self->dataElement('oboInOwl:identifier', $term->acc);
        $self->dataElement('rdfs:label', $term->name);
        
        my $syn_idx = $term->synonyms_by_type_idx || {};
        foreach my $scope (keys %$syn_idx) {
            my $syn_prop = $self->_synonym_property($scope);
            foreach my $syn (@{$syn_idx->{$scope}}) {
                $self->startTag($syn_prop);
                $self->startTag('oboInOwl:Synonym');
                $self->dataElement('rdfs:label', $syn);
                $self->endTag;
                $self->endTag;
            }	
        }
        if ($term->definition) {
            $self->startTag('oboInOwl:hasDefinition');
            $self->startTag('oboInOwl:Definition');
            $self->dataElement('rdfs:label', $term->definition );
            $self->dataElement('go:definition', 
                               $term->definition);
            $self->draw_dbxref($_) foreach @{$self->definition_dbxref_list || []};
            $self->endTag;
            $self->endTag;
        };
        if ($term->comment) {
            $self->dataElement('rdfs:comment', 
                               $term->comment);
        };
        if (defined $graph) {
            foreach my $rel (sort by_acc1 @{$graph->get_parent_relationships($term->acc)}) {
                my $to = $rel->acc1;
                if (lc($rel->type) eq 'is_a') {
                    $self->emptyTag('rdfs:subClassOf', 
                                    'rdf:resource'=>$self->class_uri($to));
                }
                else {
                    $self->startTag('rdfs:subClassOf');
                    $self->startTag('owl:Restriction');
                    $self->emptyTag('owl:onProperty', 
                                    'rdf:resource'=>$self->class_uri($to));
                    # assume OBO REL defs; always existential
                    $self->emptyTag('owl:someValuesFrom', 
                                    'rdf:resource'=>$self->class_uri($to));
                    $self->endTag;
                    $self->endTag;
                }
            }    
        }
      
        if ($show_xrefs ne 'no') {
            if ($term->dbxref_list) {
                $self->draw_dbxref($_) foreach @{$self->dbxref_list || []};
            }
        }
      
        $self->endTag('owl:Class');
        if (defined ($term->selected_association_list)) {
            foreach my $selected_ass (sort by_gene_product_symbol @{$term->selected_association_list}) {
                $self->__draw_association($selected_ass, 1, $term);
            }
        }
      
        if ($show_associations && $show_associations eq 'yes') {
            foreach my $ass (sort by_gene_product_symbol @{$term->association_list}) { 
                $self->__draw_association($ass, 0, $term);
            }	
        }
    } 
    else {
        if (defined ($term->selected_association_list)) {
            foreach my $selected_ass (sort by_gene_product_symbol @{$term->selected_association_list}) {
                $self->__draw_association($selected_ass, 1, $term);
            }
        }
    }
    
}

sub by_acc1 {
  lc($a->acc1) cmp lc($b->acc1);

}

sub by_xref_key {
  lc($a->xref_key) cmp lc($b->xref_key);
}

sub by_gene_product_symbol {
  lc($a->gene_product->symbol) cmp lc($b->gene_product->symbol);

}

sub draw_dbxref {
  my $self = shift;
  my $dbxref = shift;
  $self->startTag('oboInOwl:hasDbXref');
  $self->startTag('oboInOwl:DbXref');
  $self->dataElement('rdfs:label',$dbxref->as_str);
  $self->endTag;
  $self->endTag;

}

sub __draw_association {
  my $self = shift;
  my $ass = shift;
  my $term = shift;
  
  my $rdf_id = 'http://www.geneontology.org/go#'.$ass->go_public_acc;

  $self->startTag('oban:Annotation'); # bNode
  foreach my $ev (@{$ass->evidence_list}) {
      $self->startTag('oban:has_evidence');
      $self->startTag('rdf:Description');
      $self->dataElement('rdf:type',
                         'rdf:about'=>$self->class_uri($ev->code));
      foreach my $with (@{$ev->seq_xref_list || []}) {
          $self->dataElement('oban:with',
                             'rdf:about'=>$self->class_uri($with->as_str));
      }
      foreach my $pub (@{$ev->pub_xref_list || []}) {
          $self->dataElement('oban:has_source',
                             'rdf:about'=>$self->class_uri($pub->as_str));
      }
      $self->startTag('oban:posits');
      $self->startTag('rdf:Statement');
      $self->dataElement('rdf:subject',
                         'rdf:about'=>$self->data_uri($ass->gene_product->dbxref->as_str));
      $self->dataElement('rdf:predicate',
                         'rdf:about'=>'oban:has_role'); # TODO
      $self->dataElement('rdf:object',
                         'rdf:about'=>$self->class_uri($term->public_acc));
      $self->endTag;
      $self->endTag;
      $self->endTag;
      $self->endTag;
  }
  $self->endTag;
  
}

sub class_uri {
    my $self = shift;
    my $id = shift;
    my ($db,@rest) = split(/:/,$id);
    if (@rest) {
        my $local = join(':',@rest);
        return sprintf("http://purl.org/obo/owl/%s#%s_%s",$db,$db,$local);
    }
}

=head2 

sub characters

  This is simply a wrapper to XML::Writer->characters
  which strips out any non-ascii characters.

=cut

sub characters {
  my $self = shift;
  my $string = shift;
  
  if ($string) {
      $self->{writer}->characters($self->__strip_non_ascii($string));
  }
  
}

=head2 

sub dataElement

  This is simply a wrapper to XML::Writer->dataElement
  which strips out any non-ascii characters.

=cut

sub dataElement {
  my $self = shift;
  my $tag = shift;
  my $content = shift;

  $self->{writer}->dataElement($tag,
			       $self->__strip_non_ascii($content));
  
}

sub startTag {
  my $self = shift;

  $self->{writer}->startTag(@_);
}

sub endTag {
  my $self = shift;

  $self->{writer}->endTag(@_);
}


sub emptyTag {
  my $self = shift;

  $self->{writer}->emptyTag(@_);
}

sub __strip_non_ascii {
  my $self = shift;
  my $string = shift;

  $string =~ s/\P{IsASCII}//g;

  return $string;
}

sub __make_go_from_acc {
  my $self = shift;
  my $acc = shift;
  return $acc;
}

1;




