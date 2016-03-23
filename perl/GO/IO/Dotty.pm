# $Id: Dotty.pm,v 1.1 2005/02/11 05:44:56 cmungall Exp $

package GO::IO::Dotty;

=head1 NAME

  GO::IO::Dotty;

=head1 SYNOPSIS

  Utility functions for producing Dotty diagrams from GO graphs

  Contributed to the go-database list by Philip Lord

=head1 REQUIREMENTS

http://www.research.att.com/sw/tools/graphviz/
http://search.cpan.org/search?dist=GraphViz

=cut

use strict;
use Exporter;
use GraphViz;
my @ISA=qw{Exporter};

my %labellednodes;

sub graphviz_to_dotty{
  my $graphviz = shift;

  open( DOTTY, "|dotty -" );
  print DOTTY $graphviz->as_text;
  close( DOTTY );
}

sub go_graph_to_graphviz {
  my $graph = shift;
  my %gopts = %{shift || {}};
  my %opts = %{shift || {}};
  my $it = $graph->create_iterator;
  my %relationships;
  my %labellednodes;

  my $graphviz = GraphViz->new(%gopts);

  while (my $ni = $it->next_node_instance ){
      my $term = $ni->term;
      my $rel = $ni->parent_rel;
      my $parents = $graph->get_parent_terms($term->acc);
      _graphviz_label( $term, $graph,
                       \%labellednodes, $graphviz, \%opts );
      
      foreach my $p (@$parents){
          _graphviz_label( $p, $graph->is_focus_node( $p ),
                           \%labellednodes, $graphviz, \%opts );
          
          my $identifier = $p->acc . " " . $term->acc;
          unless( $relationships{ $identifier } ){
              ## for some reason graphviz assumes that a number is only a
              ## label, and not a node name which is irritating.
              my $node = "acc" . $term->acc;
              my $pnode = "acc" . $p->acc;
              my $apph = $term->apph;
              $graphviz->add_edge($node=>$pnode, label=>$rel->type);
              $relationships{ $identifier } = 1;
          }
      }
      
    if ($opts{selected_assocs}) {
        my @prs = map {$_->gene_product } @{$term->selected_association_list || []};
        my $node = "acc" . $term->acc;
        foreach my $pr (@prs) {
            my $nid = $pr->xref->as_str;
            unless($labellednodes{$nid}) {
                $graphviz->add_node($nid, label=>$pr->symbol,
                                    color=>'red');
                  $labellednodes{$nid} = 1;
            }
            $graphviz->add_edge( $nid=>$node, label=>"annotated_to");
        }
    }
  }
  return $graphviz;
}

sub _graphviz_label{
  my $term = shift;
  my $graph = shift;
  my $labellednodes = shift;
  my $graphviz = shift;
  my %opts = %{ shift || {}};
  my $acc = $term->acc;
  my $node = "acc" . $term->acc;

  unless( $labellednodes->{$acc} ){
      if ($opts{sub}) {
          $graphviz->add_node($opts{sub}->($node, $term));
      }
      else {
          $graphviz->add_node
            ( $node, 
              label=>$term->name . " " . $term->acc ,
              URL=>%opts->{'base_url'}.$term->acc,
              fontname=>'Courier'
            );
      }
      $labellednodes->{$acc} = 1;
  }
}

sub label_nodes_with_colour{
  my $graphviz = shift;
  my $terms = shift;
  my $colour = shift;

  foreach my $term (@$terms){
     my $node = "acc" . $term->public_acc;
    $graphviz->add_node
      ( $node,
        style=>"filled", color=>$colour ,
      fontname=>'Courier');
   }
}

# support US spelling
*label_nodes_with_color = \&label_nodes_with_colour;

1;
