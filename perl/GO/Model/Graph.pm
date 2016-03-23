# $Id: Graph.pm,v 1.25 2008/03/27 01:48:43 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself


package GO::Model::Graph;

=head1 NAME

GO::Model::Graph    - a collection of relationships over terms

=head1 SYNOPSIS

  # FETCHING GRAPH FROM FILES
  use GO::Parser;
  my $parser = new GO::Parser({handler=>'obj'});
  $parser->parse("gene_ontology.obo");     # ontology
  $parser->parse("gene-associations.sgd"); # gene assocs
  # get L<GO::Model::Graph> object
  my $graph = $parser->handler->graph;
  my $terms = $graph->term_query("/transmembrane/");  # matching terms
  foreach my $term (@$terms) {
    # find gene products associated to this term
    my $assocs = $graph->deep_association_list($term->acc);
    printf "Term: %s %s\n", $term->acc, $term->name;
    print "  Associations (direct and via transitive closure_\n";
    foreach my $assoc (@$assocs) {
      next if $assoc->is_not;
      printf "  Assoc evidence: %s to: %s %s\n",
        join(';', map {$_->code} @{$assoc->evidence_list}),
        $assoc->gene_product->xref->as_str,
        $assoc->gene_product->symbol;
    }
  }

  # -- alternatively, use this code... --

  # FETCHING FROM DATABASE (requires go-db-perl library)
  # pretty-printing a subgraph from "nuclear pore"
  $apph = GO::AppHandle->connect(-dbname=>"$dbname");
  $term = $apph->get_term({name=>"nuclear pore"});
  $graph =
	  $apph->get_graph_by_terms([$term], $depth);

  $it = $graph->create_iterator;
  # returns a GO::Model::GraphIterator object

  while (my $ni = $it->next_node_instance) {
    $depth = $ni->depth;
    $term = $ni->term;
    $reltype = $ni->parent_rel->type;
    printf 
      "%s %8s Term = %s (%s)  // number_of_association=%s // depth=%d\n",
          "----" x $depth,
          $reltype,
	  $term->name,
	  $term->public_acc,
	  $term->n_associations || 0,
          $depth;
  }


=head1 DESCRIPTION

Object containing Nodes (L<GO::Model::Term> objects) and relationships
(:<GO::Model::Relationship> objects)

this may be either the whole ontology tree, or a subgraph, depending
on how the object is instantiated.

=head2 ONTOLOGY GRAPH MODEL

relationships can be thought of as B<statements> or sentences of the form

  SUBJECT-TERM PREDICATE OBJECT-TERM

for example,

  "dog" IS_A "animal"

  "G-Protein coupled receptor" IS_A "transmembrane receptor"

Statements have a B<subject> (i.e. the subject of the
sentence/statement), a predicate/relationship-type and an B<object>
(i.e. the object of the sentence/statement)

Relationships can also be seen as arcs in a directed graph, with the
subject being equivalent to the child, and the object equivalent to
the parent. The arc is labeled with the predicate/relationship-type.

perl doesnt handle bidirectional links between objects too well, so
rather than having the relationship object know about the terms or the
term know about the realtionships, all the graph info is in the
Graph object

the Relationship object gives you the accessions of the related terms,
use the Graph methods to fetch these actual terms.

The idea is to keep the Term & Relationship objects lightweight, and
keep the Graph logic in the Graph object. The Graph object is
responsible for stuff like making sure that a Term object is not
instantiated twice if it can be reached by two different paths.

Currently all graphs are acyclic, cyclic graphs may be allowed in the
future when such relationships are added to GO/OBOA

=head2 TRANSITIVE CLOSURES

 graph object will calculate transitive closures for you - that is it
will follow the path in the graph to the root or to all leafs

=head2 ITERATORS

Using the create_iterator and iterate methods, you can create
"visitors" that will traverse the graph, performing actions along the
way. Functional-style programming is encouraged, as the iterature()
method allows for the passing of lexical closures:

  $graph->iterate(sub {$term=shift->term;
                       printf "%s %s\n", $term->acc,$term->name},
                  {direction=>'up',
                   acc=>"GO:0008045"})


=head2 SEE ALSO

L<go-perl>
L<GO::Model::Term>
L<GO::Parser>
L<GO::AppHandle>

=cut


use Carp;
use strict;
use Exporter;
use GO::Utils qw(rearrange max);
use GO::ObjFactory;
use GO::Model::Root;
use GO::Model::Term;
use GO::Model::Path;
use GO::Model::Relationship;
use GO::Model::GraphIterator;
use FileHandle;
use Exporter;
use Data::Dumper;
use vars qw(@ISA @EXPORT_OK %EXPORT_TAGS $AUTOLOAD);

use base qw(GO::Model::Root Exporter);


sub _valid_params {
    return qw();
}


=head2 new

  Usage   - $g = GO::Model::Graph->new;
  Returns - GO::Model::Graph;
  Args    - 

Normally you would not create a graph object yourself - this is
typically done for you by either a L<GO::Parser> object or a
L<GO::AppHandle> object

=cut

sub _initialize {
    my $self = shift;
    $self->SUPER::_initialize(@_);
    $self->{nodes_h} = {};
    $self->{nodes_a} = {};
    $self->{n_children_h} = {};
    $self->{n_parents_h} = {};
    $self->{child_relationships_h} = {};
    $self->{parent_relationships_h} = {};
    $self->apph(GO::ObjFactory->new) unless $self->apph;
    return;
}

sub clone
  {
      my ($self) = @_;

      my $new_g = GO::Model::Graph->new();
      foreach my $key (keys(%$self))
        {
            my $val = $self->{$key};
            my $val_ref = ref($val);
            my $new_val;
            if ($val_ref =~ /HASH/i)
              {
                  my %new_obj = %$val;
                  $new_val = \%new_obj;
              }
            elsif ($val_ref =~ /ARRAY/i)
              {
                  my @new_obj = @$val;
                  $new_val = \@new_obj;
              }
            else
              {
                  $new_val = $val;
              }

            $new_g->{$key} = $new_val;
        }

      return $new_g;
  }


=head2 create_iterator

  Usage   - $it = $graph->create_iterator("GO:0003677")
  Usage   - $it = $graph->create_iterator({acc=>"GO:0008045",
                                           direction=>"up"});
  Returns - GO::Model::GraphIterator;
  Args    - accession no [optional] or GO::Model::Term [optional]

makes a L<GO::Model::GraphIterator>, an object which traverses the
graph

=cut

sub create_iterator {
    my $self = shift;
    my $arg = shift;
   
    my $h = ref($arg) ? ($arg || {}) : {acc=>$arg};
    my $it = GO::Model::GraphIterator->new({graph=>$self, %$h});
    if ($h->{acc}) {
        $it->reset_cursor($h->{acc});
    }
    return $it;
}


=head2 iterate

  Usage   - $graph->iterate(sub {$ni=shift;printf "%s\n", $ni->term->name});
  Usage   - sub mysub {...}; $graph->iterate(\&mysub);
  Returns -
  Args    -  CODE

iterates through the graph executing CODE on every
L<GO::Model::GraphNodeInstance> object

=cut

sub iterate {
    my $self = shift;
    my $sub = shift;
    my @args = @_;

    if (!ref($sub)) {
        $sub = eval("sub{$sub}");
    }
    if (!ref($sub) eq "CODE") {
        confess("argument must be CODE not $sub");
    }

    my $it = $self->create_iterator(@args);
    $it->no_duplicates(1);

    while (my $ni = $it->next_node_instance) {
        &$sub($ni);
    }
}


=head2 term_filter

  Alias   - node_filter
  Usage   - $terms =
               $graph->term_filter(sub {shift->term->name =~ /transmembrane/});
  Usage   - sub mysub {...}; $graph->iterate(\&mysub);
  Returns -   ref to an array of GO::Model::Term objects
  Args    -  CODE

iterates through the graph executing CODE on every
L<GO::Model::GraphNodeInstance> object. If CODE returns true, that
node will be returned

=cut

sub node_filter {
    my $self = shift;
    my $sub = shift;
    my @args = @_;

    if (!ref($sub)) {
        $sub = eval("sub{$sub}");
    }
    if (!ref($sub) eq "CODE") {
        confess("argument must be CODE not $sub");
    }

    my $it = $self->create_iterator(@args);
    $it->compact(1);
    
    my @nodes = ();
    while (my $ni = $it->next_node_instance) {
        if (&$sub($ni)) {
            push(@nodes, $ni->term);
        }
    }
    return \@nodes;
}
*term_filter = \&node_filter;

=head2 term_query

  Usage   - $terms = $graph->term_query({name=>'/transmembrane/'});
  Usage   - $terms = $graph->term_query({acc=>'GO:0008045'});
  Usage   - $terms = $graph->term_query('/transmembrane/');
  Returns - ref to an array of GO::Model::Term objects
  Args    - hashref of constraints
            OR name constraint as string

returns a set of terms matching query constraints. If the constraint
value is enclosed in // a regexp match will be performed

constraints are ANDed. For more complex queries, use node_filter()

=cut

sub term_query {
    my $self = shift;
    my $constr = shift;
    if (!ref($constr)) {
        $constr = {name=>$constr};
    }
    # compile code for speed
    my $code =
      join(' && ',
           map {
               my $v = $constr->{$_};
               my $op = 'eq';
               if ($v =~ /^\/.*\/$/) {
                   $op = '=~';
               }
               else {
                   $v =~ s/\'/\\\'/g;
                   $v = "'$v'";
               }
               if (GO::Model::Term->new->can($_."_list")) {
                   sprintf('grep {$_ %s %s} @{$term->%s_list || []}',
                           $op,
                           $v,
                           $_);
               }
               else {
                   sprintf('$term->%s %s %s',
                           $_,
                           $op,
                           $v);
               }
           } keys %$constr);
    my $sub = 
      eval "sub { my \$term=shift->term; $code}";
    return $self->node_filter($sub);
}


=head2 subgraph

  Usage   - my $subgraph = $graph->subgraph({acc=>"GO:0008045"});
  Returns - GO::Model::Graph
  Args    - as term_query()

creates a subgraph of the current graph containing the terms
returned by a term_query() call and all paths to the root

=cut

sub subgraph {
    my $self = shift;
    my $terms = $self->term_query(@_);
    my $subgraph = 
      $self->subgraph_by_terms($terms);
    return $subgraph;
}

=head2 subgraph_by_terms

  Usage   - my $subgraph = $graph->subgraph_by_terms($terms);
  Usage   - my $subgraph = $graph->subgraph_by_terms($terms,{partial=>1});
  Returns - GO::Model::Graph
  Args    - GO::Model::Term listref

creates a subgraph of the current graph containing the specified terms

The path-to-top will be calculated for all terms and added to the
subgraph, UNLESS the partial option is set; in this case a
relationship between 

=cut

sub subgraph_by_terms {
    my $self = shift;
    my $terms = shift || [];
    my $opt = shift || {};
    my $g = $self->apph->create_graph_obj;
    my %done = ();
    my %in_set = map {$_->acc=>1} @$terms;
    my $partial = $opt->{partial};
    foreach my $term (@$terms) {
        my $it = $self->create_iterator($term->acc);
        if ($partial) {
            $it->subset_h(\%in_set);
        }
        $it->direction('up');
        while (my $ni = $it->next_node_instance) {
            my $t = $ni->term;
            my $rel = $ni->parent_rel;
            $g->add_relationship($rel) if $rel;
            # don't add term twice (but do add rel to term)
            # don't continue past already-visited term
            next if $done{$t->acc};
            $done{$t->acc} = 1;

            $g->add_term($t);
        }
    }
    return $g;
}

=head2 get_all_nodes

  Usage   - my $node_listref = $graph->get_all_nodes();
  Synonyms- get_all_terms
  Returns - ref to an array of GO::Model::Term objects
  Args    - none

The returned array is UNORDERED

If you want the returned list ordered (eg breadth first or depth
first) use the create_iterator() method to get a GO::Model::GraphIterator

See also L<GO::Model::Term>

=cut

sub get_all_nodes {
    my $self = shift;
    my ($order) = rearrange([qw(order)], @_);
    
    my @nodes;
    if (!$order) {
	@nodes = values %{$self->{nodes_h}};
#	@nodes = @{$self->{nodes_a}};
    }
    else {
	confess("not implemented yet!");
    }

    return \@nodes;
}
*get_all_terms = \&get_all_nodes;


=head2 get_term

  Usage   - my $term = $graph->get_term($acc);
  Synonyms- get_node
  Returns - GO::Model::Term
  Args    - id

  returns a GO::Model::Term object for an accession no.
  the term must be in the Graph object

See also L<GO::Model::Term>

=cut

sub get_term {
    my $self = shift;
    my $acc = shift || confess "you need to provide an accession ID";
    
    # be liberal in what we accept - id, hashref or object
    if (ref($acc)) {
        if (ref($acc) eq "HASH") {
            $acc = $acc->{acc};
        }
        else {
            $acc = $acc->acc;
        }
    }
    return $self->{nodes_a}->{$acc};
}
*get_node = \&get_term;

=head2 get_term_by_name

  Usage   - my $term = $graph->get_term_by_name("blah");
  Returns - GO::Model::Term
  Args    - string

  returns a GO::Model::Term object for a name
  the term must be in the Graph object

CASE INSENSITIVE

See also L<GO::Model::Term>

=cut

sub get_term_by_name {
    my $self = shift;
    my $name = shift || confess;
    
    my @terms = grep { lc($_->name) eq lc($name) } @{$self->get_all_terms};
    
    if (!@terms > 1) {
        confess(">1 term: @terms");
    }
    return $terms[0];
}
*get_node_by_name = \&get_term_by_name;

=head2 get_terms_by_subset

  Usage   - my $term = $graph->get_terms_by_subset("goslim_plant");
  Returns - GO::Model::Term
  Args    - string

  returns a GO::Model::Term object for a subset
  the term must be in the Graph object

CASE INSENSITIVE

See also L<GO::Model::Term>

=cut

sub get_terms_by_subset {
    my $self = shift;
    my $subset = shift || confess;
    
    my @terms = grep { $_->in_subset($subset) } @{$self->get_all_terms};
    
    return \@terms;
}
*get_nodes_by_subset = \&get_terms_by_subset;

=head2 get_top_nodes

  Usage   - my $node_listref = $graph->get_top_nodes();
  Synonyms- get_top_terms
  Returns - ref to an array of GO::Model::Term objects
  Args    - none

usually returns 1 node - the root term

See also L<GO::Model::Term>

=cut

sub get_top_nodes {
    my $self = shift;
    if ($self->{_top_nodes}) {
        return $self->{_top_nodes};
    }
    my @topnodes = ();
    foreach my $node (@{$self->get_all_nodes}) {
        my $parent_rels = $self->get_parent_relationships($node->acc);
        my @parent_nodes = ();
        foreach my $rel (@$parent_rels) {
            my $node = $self->get_term($rel->acc1);
            if ($node) {
                push(@parent_nodes, $node);
            }
        }
        if (!@parent_nodes) {
            push(@topnodes, $node);
        }
    }
    $self->{_top_nodes} = \@topnodes;
    return \@topnodes;
}
*get_top_terms = \&get_top_nodes;


=head2 get_leaf_nodes

  Usage   - my $node_listref = $graph->get_top_nodes();
  Synonyms- get_leaf_terms
  Returns - ref to an array of GO::Model::Term objects
  Args    - none

See also L<GO::Model::Term>

=cut

sub get_leaf_nodes {
    my $self = shift;
    if ($self->{_leaf_nodes}) {
        return $self->{_leaf_nodes};
    }
    my @leafnodes = ();
    foreach my $node (@{$self->get_all_nodes}) {
	my $child_rels = $self->get_child_relationships($node->acc);
	if (!@$child_rels) {
	    push(@leafnodes, $node);
	}
    }
    $self->{_leaf_nodes} = \@leafnodes;
    return \@leafnodes;
}
*get_leaf_terms = \&get_leaf_nodes;



=head2 is_leaf_node

  Usage   - if ($graph->is_leaf_node($acc)) {...}
  Returns - bool
  Args    - accession str

See also L<GO::Model::Term>

=cut

sub is_leaf_node {
    my $self = shift;
    my $acc = shift;
    my $child_rels = $self->get_child_relationships($acc);
    return !@$child_rels;
}
*is_leaf_term = \&is_leaf_node;

=head2 seed_nodes

  Usage   - $nodes = $graph->seed_nodes;
  Returns - GO::Model::Term listref
  Args    - GO::Model::Term listref [optional]

gets/sets the "seed" nodes/terms - these are the terms the Graph is
started from, e.g. for building a node ancestory graph, the seed
term would be the leaf of this graph, but not term that are expanded
or collpased from the ancestory graph.

This is mostly relevant if you are fetching your graphs from a
database via go-db-perl

See also L<GO::Model::Term>

=cut

sub seed_nodes {
    my $self = shift;
    $self->{_seed_nodes} = shift if @_;
    return $self->{_seed_nodes};
}


=head2 focus_nodes

  Usage   - $nodes = $graph->focus_nodes;
  Synonyms- focus_terms
  Returns - GO::Model::Term listref
  Args    - GO::Model::Term listref [optional]

gets/sets the "focus" nodes/terms - these are the terms the Graph is
centred around; for instance, if the graph was built around a query to
"endoplasmic*" all the terms matching this string would be focused

This is mostly relevant if you are fetching your graphs from a
database via go-db-perl

See also L<GO::Model::Term>

=cut

sub focus_nodes {
    my $self = shift;
    $self->{_focus_nodes} = shift if @_;
    return $self->{_focus_nodes};
}
*focus_terms = \&focus_nodes;

=head2 is_focus_node

  Usage   - if ($g->is_focus_node($term)) {..}
  Returns - bool
  Args    - GO::Model::Term

=cut

sub is_focus_node {
    my $self = shift;
    my $term = shift;
    if (grep {$_->acc eq $term->acc} @{$self->focus_nodes || []}) {
        return 1;
    }
    return 0;
}
*is_focus_term = \&is_focus_node;


=head2 add_focus_node

  Usage   - $g->add_focus_node($term)
  Returns -
  Args    - GO::Model::Term

See also L<GO::Model::Term>

=cut

sub add_focus_node {
    my $self = shift;
    my $term = shift;
    if (!$self->is_focus_node($term)) {
        push(@{$self->{_focus_nodes}}, $term);
    }
}
*add_focus_term = \&add_focus_node;


=head2 paths_to_top

  Usage   - my $paths = $graph->paths_to_top("GO:0005045");
  Returns - arrayref of GO::Model::Path objects
  Args    -

See also L<GO::Model::Path>

=cut

#sub FAST_paths_to_top {
#    my $self= shift;
#    my $acc = shift;
#    my %is_ancestor_h = ();
#    $self->iterate(sub {
#                       my $ni = shift;
#                       $is_ancestor_h->{$ni->term->acc}=1;
#                       return;
#                   },
#                   {acc=>$acc,
#                    direction=>'up'}
#                  );
#    print "$_\n" foreach keys %is_ancestor_h;
#    my @root_accs =
#      grep {!$self->n_parents($_)} (keys %is_ancestor_h);
#    if (!@root_accs) {
#        confess("ASSERTION ERROR: No root accs for $acc");
#    }
#    if (@root_accs > 1) {
#        confess("ONTOLOGY ERROR: >1 root for $acc");
#    }
#    my $root_acc = shift @root_accs;
#    my @nodes = ( {acc=>$root_acc,paths=>[]} );
    
#    while (@nodes) {
#        my $node = shift @nodes;
#        my $curr_acc = $node->{acc};
#        my $child_rels = $self->get_child_relationships($curr_acc);
#        foreach my $child_rel (@$child_rels) {
#            my $child_term = $self->get_term($child_rel->acc2);
#            my $child_acc = $child_term->acc;
#            next unless $is_ancestor_h{$child_acc};
            
#        }
#    }
#    die 'todo';
#}

sub paths_to_top {
    my $self= shift;
    require GO::Model::Path;
    my $acc=shift;

    my $path = GO::Model::Path->new;
    my @nodes = ({path=>$path, acc=>$acc});

    my @paths = ();
    while (@nodes) {
	my $node = shift @nodes;
	my $parent_rels = $self->get_parent_relationships($node->{acc});
#	printf
#	  "$node->{acc} has parents: %s\n",
#	  join("; ", map {$_->acc} @$parents);
	if (!@$parent_rels) {
#	    print "PUSING PATH $node->{path}\n";
	    push(@paths, $node->{path});
	}
	else {
	    foreach my $parent_rel (@$parent_rels) {
		my $parent = $self->get_term($parent_rel->acc1);
                if (!$parent) {
                    # dangling parent - do nothing
                }
                else {
                    my $new_path = $node->{path}->duplicate;
                    $new_path->add_link($parent_rel->type, $parent);
                    push(@nodes, {path=>$new_path, acc=>$parent->acc});
                }
            }
	}
    }
    return \@paths;
}

=head2 node_count

  Usage   - my $count = $g->node_count
  Synonyms- term_count
  Returns - int
  Args    -

returns the number of terms/nodes in the graph

See also L<GO::Model::Term>

=cut

sub node_count {
    my $self = shift;
    return scalar(@{$self->get_all_nodes});
}
*term_count = \&node_count;

=head2 n_associations

  Usage   - my $count = $g->n_associations($acc);
  Returns - int
  Args    -

if you parsed an association file into this graph, this will return
the number of instances attached directly to acc

See also L<GO::Model::Association>
See also L<GO::Model::GeneProduct>

=cut

sub n_associations {
    my $self = shift;
    my $acc = shift;
    my $term = $self->get_term($acc);
    if ($term) {
	return $term->n_associations
    }
    else {
        confess("Don't have $acc in $self");
    }
}


=head2 n_deep_associations

  Usage   - my $count = $g->n_deep_associations($acc);
  Returns - int
  Args    -

if you parsed an association file into this graph, this will return
the number of instances attached directly to acc OR to a node subsumed
by acc

See also L<GO::Model::Association>
See also L<GO::Model::GeneProduct>


=cut

sub n_deep_associations {
    my $self = shift;
    my $acc = shift;
    my $rcterms = $self->get_recursive_child_terms($acc);
    my $cnt = 0;
    foreach (@$rcterms){
        $cnt+= $self->n_associations($_->acc)
    }
    return $cnt;
}


=head2 n_children

  Usage   - $n = $graph->n_children('GO:0003677');
  Synonyms- n_sterms, n_subj_terms, n_subject_terms
  Returns - int
  Args    - 

returns the number of DIRECT children/subject/subordinate terms
beneath this one

=cut

sub n_children {
    my $self = shift;
    my $acc = shift;
    if (ref($acc)) {
        if (ref($acc) eq "HASH") {
            confess("illegal argument: $acc");
        }
        $acc = $acc->acc;
    }
    my @tl = @{$self->get_child_terms($acc) || []};
    if (@tl) {
        return scalar(@tl);
    }
#    if ($self->{trailing_edges}) {
#        my $edgeh = $self->{trailing_edges}->{$acc};
#        if ($edgeh) {
#            return scalar(keys %$edgeh);
#        }
#        return 0;
#    }
#    else {
        if (!defined($self->{n_children_h}->{$acc})) {
            my $term = 
              $self->get_term($acc);
            $term || confess("$acc not in graph $self");
            my $tl = $term->apph->get_child_terms($term, {acc=>1});
            $self->{n_children_h}->{$acc} = scalar(@$tl); 
        }
        return $self->{n_children_h}->{$acc};
#    }
}
*n_sterms = \&n_children;
*n_subj_terms = \&n_children;
*n_subject_terms = \&n_children;

=head2 n_parents

  Usage   - $n = $graph->n_parents(3677);
  Synonyms- n_oterms, n_obj_terms, n_object_terms
  Returns - int
  Args    - 

returns the number of DIRECT parent/object/superordinate terms
above this one

=cut

sub n_parents {
    my $self = shift;
    my $acc = shift;
    if (ref($acc)) {
        if (ref($acc) eq "HASH") {
            confess("illegal argument: $acc");
        }
        $acc = $acc->acc;
    }
    if (!defined($self->{n_parents_h}->{$acc})) {
        my $term = 
          $self->get_term($acc);
        $term || confess("$acc not in graph $self");
        my $tl = $term->apph->get_parent_terms($term, {acc=>1});
        $self->{n_parents_h}->{$acc} = scalar(@$tl); 
    }
    return $self->{n_parents_h}->{$acc};
}
*n_oterms = \&n_parents;
*n_obj_terms = \&n_parents;
*n_object_terms = \&n_parents;

=head2 association_list

  Usage   - $assocs = $g->association_list('GO:0003677')
  Returns - listref of GO::Model::Association
  Args    - acc (string)

returns a list of association objects B<directly> attached to the
specified term

See also L<GO::Model::Association>

=cut

sub association_list {
    my $self = shift;
    my $acc = shift;
    my $term = $self->get_term($acc);
    if (!$term) {
#        use Data::Dumper;
#        print Dumper [keys %{$self->{nodes_a}}];
#        die "no term with acc $acc";
        return undef;
    }
    return $term->association_list();
}


=head2 get_direct_associations

  Usage   -
  Returns -
  Args    -

See also L<GO::Model::Association>

=cut

sub get_direct_associations {
    my $self = shift;
    my $acc = shift;
    $acc = $acc->acc if ref $acc;
    $self->association_list($acc);
}


=head2 deep_association_list

  Usage   - $assocs = $g->association_list('GO:0003677')
  Returns - listref of GO::Model::Association
  Args    - acc (string)

returns a list of association objects B<directly and indirectly>
attached to the specified term. (ie assocs attached to the term or to
terms subsumed by the specified term).

See also L<GO::Model::Association>

=cut

sub deep_association_list {
    my $self = shift;
    my $acc = shift;
    my @accs = @{$self->association_list($acc) || []};
    push(@accs,
	 map {@{$self->deep_association_list($_->acc)||[]}} 
	 @{$self->get_child_terms($acc) || []});
    return \@accs;
}


=head2 product_list

  Usage   - $prods = $g->product_list('GO:0003677')
  Returns - listref of GO::Model::GeneProduct
  Args    - acc (string)

returns a list of distinct gene product objects B<directly>
attached to the specified term.

See also L<GO::Model::GeneProduct>

=cut

sub product_list {
     my $self = shift;
    my $acc = shift;
    my $assocs = $self->association_list($acc) || [];
    my @prods = ();
    my %ph = ();
    foreach my $assoc (@$assocs) {
        my $gp = $assoc->gene_product;
        if (!$ph{$gp->xref->as_str}) {
            push(@prods, $gp);
            $ph{$gp->xref->as_str} = 1;
        }
    }
    return [@prods];
    
}

=head2 deep_product_list

  Usage   - $prods = $g->deep_product_list('GO:0003677')
  Returns - listref of GO::Model::GeneProduct
  Args    - acc (string)

returns a list of distinct gene product objects B<directly and indirectly>
attached to the specified term. (ie assocs attached to the term or to
terms subsumed by the specified term).

See also L<GO::Model::GeneProduct>

=cut

sub deep_product_list {
    my $self = shift;
    my $acc = shift;
    my $assocs = $self->deep_association_list($acc) || [];
    my @prods = ();
    my %ph = ();
    foreach my $assoc (@$assocs) {
        my $gp = $assoc->gene_product;
        if (!$ph{$gp->xref->as_str}) {
            push(@prods, $gp);
            $ph{$gp->xref->as_str} = 1;
        }
    }
    return [@prods];
    
}

=head2 deep_product_count

  Usage   - $n_prods = $g->deep_product_count('GO:0003677')
  Returns - int
  Args    - acc (string)

returns a count of distinct gene product objects B<directly and
indirectly> attached to the specified term. performs transitive
closure. will not count gene products twice

See also L<GO::Model::GeneProduct>

=cut

sub deep_product_count {
    my $self = shift;
    my $acc = shift;
    return scalar(@{$self->deep_product_list($acc)});
}

=head2 get_relationships

  Usage   - my $rel_listref = $graph->get_relationships('GO:0003677');
  Returns - ref to an array of GO::Model::Relationship objects
  Args    - identifier/acc (string)

returns relationships which concern the specified term; the specified
term can be the subject or object term in the relationship (ie child
or parent)

See also L<GO::Model::Relationship>

=cut
  
sub get_relationships {
    my $self = shift;
    my $acc = shift || confess("You must specify an acc");
    my $child_rel_l = $self->get_child_relationships($acc);
    my $parent_rel_l = $self->get_parent_relationships($acc);
    
    return [@{$child_rel_l}, @{$parent_rel_l}];
}
*get_rels = \&get_relationships;
  

=head2 get_parent_relationships

  Usage   - my $rel_listref = $graph->get_parent_relationships('GO:0003677');
  Synonym - get_relationships_by_child
  Synonym - get_relationships_by_subj 
  Synonym - get_relationships_by_subject 
  Synonym - get_obj_relationships 
  Synonym - get_object_relationships
  Returns - ref to an array of GO::Model::Relationship objects
  Args    - identifier/acc (string)

See also L<GO::Model::Relationship>

=cut
 
sub get_parent_relationships {
    my $self = shift;
    my $acc = shift || confess("You must specify an acc");

    # if a term object is specified instead of ascc no, use the acc no
    if (ref($acc) && $acc->isa("GO::Model::Term")) {
	$acc = $acc->acc;
    }

    my $rel_h = $self->{parent_relationships_h}->{$acc};
    return $self->get_acc_relationships ($rel_h);
}
*get_relationships_by_child = \&get_parent_relationships;
*get_relationships_by_subj = \&get_parent_relationships;
*get_relationships_by_subject = \&get_parent_relationships;
*get_obj_relationships = \&get_parent_relationships;
*get_object_relationships = \&get_parent_relationships;
  

=head2 get_child_relationships

  Usage   - my $rel_listref = $graph->get_child_relationships('GO:0003677');
  Synonym - get_relationships_by_parent
  Synonym - get_relationships_by_obj 
  Synonym - get_relationships_by_object
  Synonym - get_subj_relationships
  Synonym - get_subject_relationships
  Returns - ref to an array of GO::Model::Relationship objects
  Args    - identifier/acc (string)

See also L<GO::Model::Relationship>

=cut
  
sub get_child_relationships {
    my $self = shift;
    my $acc = shift || confess("You must specify an acc");

    # if a term object is specified instead of ascc no, use the acc no
    if (ref($acc) && $acc->isa("GO::Model::Term")) {
	$acc = $acc->acc;
    }

    my $rel_h = $self->{child_relationships_h}->{$acc};
    return $self->get_acc_relationships ($rel_h);
}
*get_relationships_by_parent = \&get_child_relationships;
*get_relationships_by_obj = \&get_child_relationships;
*get_relationships_by_object = \&get_child_relationships;
*get_subj_relationships = \&get_child_relationships;
*get_subject_relationships = \&get_child_relationships;

=head2 get_all_relationships

  Usage   -
  Returns - GO::Model::Relationship list
  Args    -

returns all the relationships/statements in this graph

See also L<GO::Model::Relationship>

=cut

sub get_all_relationships {
    my $self = shift;
    my $nl = $self->get_all_nodes;
    [
     map {
         values %{$self->{child_relationships_h}->{$_->acc}}
     } @$nl
     ];
}

sub get_acc_relationships {
    my $self = shift;
    my $rel_h = shift;

    my $rels = [];
    foreach my $acc (keys (%{$rel_h})) {
	push (@{$rels}, $rel_h->{$acc});
    }
    return $rels;
}

=head2 get_parent_terms

  Usage   - my $term_lref = $graph->get_parent_terms($parent_term->acc);
  Synonym - get_obj_terms
  Synonym - get_object_terms
  Returns - ref to array of GO::Model::Term objs
  Args    - the accession of the query term

See also L<GO::Model::Term>

=cut

sub get_parent_terms {
    return shift->_get_related_terms_by_type("parent",@_);
}
*get_obj_terms = \&get_parent_terms;
*get_object_terms = \&get_parent_terms;


=head2 get_parent_terms_by_type

  Usage   - 
  Synonym - get_obj_terms_by_type
  Synonym - get_object_terms_by_type
  Returns - ref to array of GO::Model::Term objs
  Args    - the accession of the query term
          - the type by which to constrain relationships

See also L<GO::Model::Term>

=cut

sub get_parent_terms_by_type {
    return shift->_get_related_terms_by_type("parent",@_);
}
*get_obj_terms_by_type = \&get_parent_terms_by_type;
*get_object_terms_by_type = \&get_parent_terms_by_type;


=head2 get_recursive_parent_terms

 Title   : get_recursive_parent_terms
 Usage   :
 Synonyms: get_recursive_obj_terms
 Synonyms: get_recursive_object_terms
 Function:
 Example :
 Returns : 
 Args    : accession of query term

See also L<GO::Model::Term>

=cut

sub get_recursive_parent_terms{
    my $self = shift;
    my $acc = shift;
    $self->get_recursive_parent_terms_by_type($acc, undef, @_);
}
*get_recursive_obj_terms = \&get_recursive_parent_terms;
*get_recursive_object_terms = \&get_recursive_parent_terms;

=head2 get_recursive_parent_terms_by_type

 Title   : get_recursive_parent_terms_by_type
 Usage   :
 Synonyms: get_recursive_obj_terms_by_type
 Synonyms: get_recursive_object_terms_by_type
 Function:
 Example :
 Returns : 
 Args    :

if type is blank, gets all

See also L<GO::Model::Term>

=cut

sub get_recursive_parent_terms_by_type {
    return shift->_get_recursive_related_terms_by_type("parent",@_);
}
*get_recursive_obj_terms_by_type = \&get_recursive_parent_terms_by_type;
*get_recursive_object_terms_by_type = \&get_recursive_parent_terms_by_type;


=head2 get_reflexive_parent_terms

 Title   : get_reflexive_parent_terms
 Usage   :
 Function:
 Example :
 Returns : 
 Args    : acc

returns parent terms plus the term (for acc) itself

[reflexive transitive closure of relationships in upward direction]

See also L<GO::Model::Term>

=cut

sub get_reflexive_parent_terms {
   my ($self, $acc) = @_;
   my $terms = $self->get_recursive_parent_terms($acc);
   unshift(@$terms, $self->get_term($acc));
   return $terms;
}

=head2 get_reflexive_parent_terms_by_type

 Title   : get_reflexive_parent_terms_by_type
 Usage   :
 Function:
 Example :
 Returns : listref of terms
 Args    : acc, type

closure of relationship including the term itself

See also L<GO::Model::Term>

=cut

sub get_reflexive_parent_terms_by_type{
   my ($self,$acc, $type) = @_;
   my $terms = $self->get_recursive_parent_terms_by_type($acc, $type);
   return [$self->get_term($acc), @$terms];
}

=head2 get_child_terms

  Usage   - my $term_lref = $graph->get_child_terms($parent_term->acc);
  Synonym - get_subj_terms
  Synonym - get_subject_terms
  Returns - ref to array of GO::Model::Term objs
  Args    -

See also L<GO::Model::Term>

=cut

sub get_child_terms {
    return shift->_get_related_terms_by_type("child",@_);
}
*get_subj_terms = \&get_child_terms;
*get_subject_terms = \&get_child_terms;

=head2 get_child_terms_by_type

  Synonym - get_subj_terms_by_type
  Synonym - get_subject_terms_by_type
  Returns - ref to array of GO::Model::Term objs
  Args    - the accession of the query term
          - the type by which to constrain relationships

See also L<GO::Model::Term>

=cut

sub get_child_terms_by_type {
    return shift->_get_related_terms_by_type("child",@_);
}
*get_subj_terms_by_type = \&get_child_terms_by_type;
*get_subject_terms_by_type = \&get_child_terms_by_type;

=head2 get_recursive_child_terms

 Title   : get_recursive_child_terms
 Usage   :
 Synonyms: get_recursive_subj_terms
 Synonyms: get_recursive_subject_terms
 Function:
 Example :
 Returns : a reference to an array of L<GO::Model::Term> objects
 Args    : the accession of the query term


See also L<GO::Model::Term>

=cut

sub get_recursive_child_terms{
   my ($self,$acc, $refl) = @_;
   $self->get_recursive_child_terms_by_type($acc, undef, $refl);
}
*get_recursive_subj_terms = \&get_recursive_child_terms;
*get_recursive_subject_terms = \&get_recursive_child_terms;

=head2 get_recursive_child_terms_by_type

 Title   : get_recursive_child_terms_by_type
 Usage   :
 Synonyms: get_recursive_subj_terms_by_type
 Synonyms: get_recursive_subject_terms_by_type
 Function:
 Example :
 Returns : a reference to an array of L<GO::Model::Term> objects
 Args    : accession, type

if type is blank, gets all

See also L<GO::Model::Term>

=cut

sub get_recursive_child_terms_by_type{
    return shift->_get_recursive_related_terms_by_type("child",@_);
}
*get_recursive_subj_terms_by_type = \&get_recursive_child_terms_by_type;
*get_recursive_subject_terms_by_type = \&get_recursive_child_terms_by_type;

=head2 _get_recursive_related_terms_by_type

 Title   : _get_recursive_related_terms_by_type
 Usage   :
 Function: Obtain all relationships of the given kind and type for the
           term identified by its accession, and recursively repeat
           this with all parents and children as query for parent and
           child relationships, respectively.

           This is an internal method.
 Example :
 Returns : A reference to an array of L<GO::Model::Term> objects.
 Args    : - the kind of relationship, either "child" or "parent"
           - the accession of the term with which to query
           - the type to which to constrain relationships (optional,
             all types if left undef)
           - TRUE if reflexive and FALSE otherwise (default FALSE)

See also L<GO::Model::Term>

=cut

sub _get_recursive_related_terms_by_type{
    my ($self, $relkind, $acc, $type, $refl) = @_;
   
    # if a term object is specified instead of ascc no, use the acc no
    if (ref($acc) && $acc->isa("GO::Model::Term")) {
	$acc = $acc->acc;
    }

    my $rels = ($relkind eq "child")
        ? $self->get_child_relationships($acc)
        : $self->get_parent_relationships($acc);

    if ($type) {
        @$rels = grep { $_->type eq $type; } @$rels;
    }

    my $relmethod = $relkind."_acc";

    my @pterms =
      map {
          my $term = $self->get_term($_->$relmethod());
          my $rps = 
            $self->_get_recursive_related_terms_by_type($relkind,
                                                        $_->$relmethod(), 
                                                        $type);
          ($term, @$rps);
      } @$rels;
    if ($refl) {
        @pterms = ($self->get_term($acc), @pterms);
    }
    return \@pterms;
}

=head2 _get_related_terms_by_type

  Usage   - my $term_lref = $graph->_get_related_terms_by_type("child",$acc);
  Returns - ref to array of GO::Model::Term objs

  Args    - the kind of relationship, either "child" or "parent" 
          - the accession of the term for which to obtain rel.ships
          - the type by which to constrain relationships (optional,
            defaults to all terms if left undef)

This is an internal method.

=cut

sub _get_related_terms_by_type {
    my ($self,$relkind,$acc,$type) = @_;

    # if a term object is specified instead of ascc no, use the acc no
    if (ref($acc) && $acc->isa("GO::Model::Term")) {
	$acc = $acc->acc;
    }

    my $rels = ($relkind eq "child")
        ? $self->get_child_relationships($acc)
        : $self->get_parent_relationships($acc);

    if ($type) {
        @$rels = grep { $_->type eq $type; } @$rels;
    }

    my $relmethod = $relkind."_acc";

    my @term_l = ();
    foreach my $r (@$rels) {
	my $t = $self->get_term($r->$relmethod());
	if ($t) {
	    push(@term_l, $t);
	}
    }
    return \@term_l;
}

=head2 get_parent_accs_by_type

  Usage   -
  Returns -
  Args    - acc, type

=cut

sub get_parent_accs_by_type {
    my $self = shift;
    my $term = shift;
    my $type = shift;
    my $rels = $self->get_parent_relationships($term);
    return [map {$_->acc1} grep {lc($_->type) eq lc($type) } @$rels];
}


=head2 get_reflexive_parent_accs_by_type

 Title   : get_reflexive_parent_accs_by_type
 Usage   :
 Function:
 Example :
 Returns : listref of terms
 Args    : acc, type

closure of relationship including the term itself

See also L<GO::Model::Term>

=cut

sub get_reflexive_parent_accs_by_type{
   my ($self,$acc, $type) = @_;
   my $terms = $self->get_recursive_parent_accs_by_type($acc, $type);
   return [$acc, @$terms];
}

=head2 get_relationships_between_terms

 Title   : get_relationships_between_terms
 Usage   :
 Function:
 Example :
 Returns : [] of relationships
 Args    : parent id, child id

See also L<GO::Model::Relationship>

=cut

sub get_relationships_between_terms{
   my ($self, $acc1, $acc2) = @_;

   my $child_rels = $self->get_child_relationships($acc1);
   
   return [grep {$_->acc2 eq $acc2} @$child_rels];
}

=head2 get_parent_closure_hash_by_type

 Title   : get_parent_closure_hash_by_type
 Usage   :
 Function: given a term-acc and relationship type, will give a hash that
           can be used to check if a term X is a parent of term Y
 Example :
 Returns : 
 Args    :

keys will be lower-cased

=cut

sub get_parent_closure_hash_by_type{
   my ($self, $acc, $type) = @_;

   my $parents = 
     $self->get_reflexive_parent_terms_by_type($acc,
                                               $type);
   return {map {lc($_->name)=>1} @$parents};
}


=head2 add_child_relationship

See also L<GO::Model::Relationship>

=cut

sub add_child_relationship {
    my $self = shift;
    confess("deprecated");
    my ($rel) =
      rearrange([qw(term)], @_);

}


=head2 add_parent_relationship

    parent relationships are as valued as child relationships

See also L<GO::Model::Relationship>

=cut

sub add_parent_relationship {
    my $self = shift;
    confess("deprecated");
    my ($rel) =
      rearrange([qw(term)], @_);
}


=head2 close_below

  Usage   - $graph->close_below(3677);
  Returns -
  Args    - term (as acc or GO::Model::Term object)

gets rid of everything below a node

used by AmiGO for when a user closes a term in the graph

=cut

sub close_below {
    my $self = shift;
    my $node = shift;
    my $if_no_parent_to_delete = shift;
    my $acc;
    if (ref($node)) {
        if (ref($node) eq "ARRAY") {
            map { $self->close_below($_) } @$node;
            return;
        } elsif ($node->isa('GO::Model::Term')) {
            $acc = $node->acc;
        } else {
            $acc = $node->{acc};
        }
    }
    else {
        $acc = $node;
    }
    my $iter = $self->create_iterator($acc);
    my @togo = ();
    while (my $n = $iter->next_node) {
        unless ($n->acc eq $acc) {
            push(@togo, $n);
        }
    }
    my $p = $if_no_parent_to_delete ? $acc : undef;
    foreach my $n (@togo) {
        $self->delete_node($n->acc, $p);
    }
}

# add 2nd optional arg: parent acc for checking if to delete the node -- Shu
# if there are other parent(s), do not delete the node
sub delete_node {
    my $self = shift;
    my $acc = shift;
    my $p_acc = shift;

    #    delete $self->{parent_relationships_h}->{$acc};
    #    delete $self->{child_relationships_h}->{$acc};    

    # Remove the parent relationship, first from our parents...
    my $par_rel_hashes = $self->{parent_relationships_h}->{$acc} || {};
    my $par_rels = [grep {$_} values(%$par_rel_hashes)];
    my $par_rel;
    my $other_p = 0;
    foreach $par_rel (@$par_rels) {
        my $par_acc = $par_rel->acc1;
        if (!$p_acc || $par_acc && $par_acc eq $p_acc) {
            $self->{child_relationships_h}->{$par_acc}->{$acc} = undef;
            delete $self->{child_relationships_h}->{$par_acc}->{$acc};
        } else {
            $other_p++;
        }
    }
    # ... then from ourself
    $self->{parent_relationships_h}->{$acc} = undef unless ($other_p);


    # Remove the child relationship, first from our children...
    my $child_rel_hashes = $self->{child_relationships_h}->{$acc} || {};
    my $child_rels = [grep {$_} values(%$child_rel_hashes)];
    my $child_rel;
    foreach $child_rel (@$child_rels) {
        my $child_acc = $child_rel->acc2;
        unless ($other_p) {
            $self->{parent_relationships_h}->{$child_acc}->{$acc} = undef;
            delete $self->{parent_relationships_h}->{$child_acc}->{$acc};
        }
    }
    # ... then from ourself
    $self->{child_relationships_h}->{$acc} = undef unless ($other_p);

    # Now delete ourself
    unless ($other_p) {
	my $term = $self->{nodes_a}->{$acc};  # IH, 6/24/2015
        delete $self->{nodes_h}->{$acc};
        $self->{nodes_a}->{$acc} = undef;
	for my $alt_id (@{$term->alt_id_list}) { $self->{nodes_a}->{$alt_id} = undef }  # IH, 6/24/2015
    }
    # This could change the top and leaf nodes, so
    # remove the cached values
    $self->{_top_nodes} = undef;
    $self->{_leaf_nodes} = undef;
}
sub category_term {
    my $self= shift;

    my $acc=shift;
    my $paths = $self->paths_to_top($acc);
    my $path = $paths->[0];
    if (!$path || !$path->term_list) {
	return;
    }
    if ($path->length < 2) {
	return $path->term_list->[-1];
    }
    return $path->term_list->[-2];
}


=head2 find_roots

  Usage   - my $terms = $graph->find_roots;
  Returns - arrayref of GO::Model::Term objects
  Args    -

All terms withOUT a parent

See also L<GO::Model::Term>

=cut

sub find_roots {
    my $self= shift;
    require GO::Model::Path;
    
    my $nodes = $self->get_all_nodes;
    my @roots = ();
    foreach my $node (@$nodes) {
	my $ps = $self->get_parent_terms($node->acc);
	if (!@$ps) {
	    push(@roots, $node);
	}
    }
    return \@roots;
}


=head2 get_all_products

  Usage   -
  Returns -
  Args    -

See also L<GO::Model::GeneProduct>


=cut

sub get_all_products {
    my $self = shift;
    my $nodes = $self->get_all_nodes;
    my @prod_index = ();
    my @prods = ();
    foreach my $n (@$nodes) {
        foreach my $p (@{$n->product_list}) {
            if (!$prod_index[$p->id]) {
            }
        }
    }
}

sub find_path {
    confess;
}

sub build_matrix {
    my $self = shift;
    
    my %node_lookup = ();
    my $terms = $self->get_all_nodes;
    foreach my $t (@$terms) {
        $node_lookup{$t->acc} = {$t->acc => 0};
        my $parents = $self->get_parent_terms($t->acc);
#        foreach my $p (@$parents) {
#            $node_lookup[$t->acc]->{$p->acc} = 1;
#        }
        my %h = $self->parent_dist($t->acc);
        foreach my $k (keys %h) {
            $node_lookup{$t->acc}->{$k} = $h{$k};
        }
    }
    return %node_lookup;
}

sub parent_dist {
    my $self = shift;
    my $acc = shift;
    my $dist = shift || 0;
    $dist ++;
    my $parents = $self->get_parent_terms($acc);
    my %h = ();
    foreach my $p (@$parents) {
        $h{$p->acc} = $dist;
        my %rh = $self->parent_dist($p->acc, $dist);
        foreach my $k (keys %rh) {
            # multiple parentage; take the shortest path
            if (!defined($h{$k}) ||
                $h{$k} > $rh{$k}) {
                $h{$k} = $rh{$k};
            }
        }
    }
    return %h;
}


=head2 merge

 Usage   - $g->merge($g2);
 Returns -
 Args    - GO::Model::Graph

merges two graphs

=cut

sub merge {
    my $self = shift;
    my $g2 = shift;

    foreach my $t (@{$g2->get_all_nodes}) {
        if ($self->get_term($t->acc)) {
        }
        else {
            $self->add_term($t);
        }
    }
    foreach my $t (@{$g2->focus_nodes || []}) {
        $self->add_focus_node($t);
    }
    foreach my $r (@{$g2->get_all_relationships}) {
        # don't need to worry about duplicates,
        # add_relationship unqiuifies
        $self->add_relationship($r);
    }
}


sub to_lisp {
    my $self = shift;
    my $term = shift;

    my @parent_rels = 
      @{$self->get_parent_relationships($term->acc) || []};

    my @parents = ();
    my @lisp_isa = (); 
    my @lisp_partof = (); 
      map {
	  if ($_->is_inheritance) {
	      push(@lisp_isa, $self->get_term($_->acc1));
	  }
	  else {
	      push(@lisp_partof, $self->get_term($_->acc1));
	  }
	  push(@parents, $self->get_term($_->acc1));
      } @parent_rels;
    my $lisp = 
      ["|".$term->lisp_acc."| T ",
       [
	["OCELOT::PARENTS ".
	 (@parents ? 
	  join("", (map {"|".$_->lisp_acc."| "} @parents)) :
	  "OCELOT::FRAMES")
	],
	["DESCRIPTION \"".$term->name."\""],
#	["DEFINITION \"".$term->description."\""],
	@lisp_isa ? ["IS-A ".join("",map{"|".$_->lisp_acc."| "} @lisp_isa)] : "",
	@lisp_partof ? ["PART-OF ".join("",map{"|".$_->lisp_acc."| "} @lisp_partof)] : "",
       ],
       "NIL",
       ];

    
    my $lisp_term = lisp2text($lisp);
}

sub lisp2text {
    my $arr = shift;
    my $text = "";
    for (my $i=0; $i<@$arr; $i++) {
	if (ref($arr->[$i])) {
	    $text.= lisp2text($arr->[$i]);
	}
	else {
	    $text.= $arr->[$i];
	}
    }
    return "($text)\n";
}

sub to_ptuples {
    my $self = shift;
    my ($th, $include, $sort) =
      rearrange([qw(tuples include sort)], @_);
    my $it = $self->create_iterator;
    my @stmts = ();
    my %done = ();
    while (my $ni = $it->next_node_instance) {
        my $term = $ni->term;
        next if $done{$term->acc};
        push(@stmts, $term->to_ptuples(-tuples=>$th));
        $done{$term->acc} = $term;
    }
    my $rels =
      $self->get_all_relationships;
    push(@stmts,
         map { $_->to_ptuples(-tuples=>$th) } @$rels);
    unless ($include && $include->{'-assocs'}) {
        map { printf "$_:$include->{$_};;;\n"; } keys %$include;
        foreach my $t (values %done) {
            my $assocs = $t->association_list || [];
            push(@stmts,
                 map {$_->to_ptuples(-term=>$t, -tuples=>$th) } @$assocs);
        }
    }
    return @stmts;
}

=head2 export

  Usage   - $graph->export({format=>$format});
  Returns -
  Args    - opt hash

writes out the graph in any export format, including obo, go_ont, owl,
png (graphviz) etc

=cut

sub export {
    my $self = shift;
    my $opt = shift || {};
    my $format = $opt->{format} || 'obo';
    delete $opt->{format};

    # todo: filehandles/files

    if ($format eq 'png') {

        require "GO/IO/Dotty.pm";
        my $graphviz =
          GO::IO::Dotty::go_graph_to_graphviz( $self,
                                                  {node => {shape => 'box'},
                                                   %$opt,
                                                  });
        print $graphviz->as_png;
    }
    elsif ($format eq 'go_ont') {
        # todo: tidy this up
        $self->to_text_output(-fmt=>'gotext');
    }
    else {
        my $p = GO::Parser->new({format=>"GO::Parsers::obj_emitter",
                                 handler=>$format});
        $p->emit_graph($self);
    }
    return;
}

=head2 to_xml

  Usage   -
  Returns -
  Args    -

=cut

sub to_xml {
    my $self = shift;
    my $fh = shift;
    require "GO/IO/RDFXML.pm";
    my $out = GO::IO::RDFXML->new(-output=>$fh);
    $out->start_document();
    $out->draw_node_graph($self, @_);
    $out->end_document();
}

sub to_obo {
    my $self = shift;
    my $fh = shift;
    require "GO/Handlers/OboOutHandler.pm";
    my $out = GO::Handlers::OboOutHandler->new(-output=>$fh);
    $out->g($self);
    $out->out;
}

sub add_path {
    my $self = shift;
    my $path = shift;

    die 'TODO';
    my $links = $path->link_list;
    for (my $i=0; $i<@$links; $i+=2) {
	my $t = $links->[$i+1];
        $self->add_term($t);
        $self->add_relationship(); # TODO
    }
}


=head2 add_term

 Usage   - $g->add_term($term)
 Returns - 
 Args    - GO::Model::Term

=cut

sub add_term {
    my $self = shift;
    my $term = shift;
    if (!ref($term)) {
	confess("Term must be either hashref or Term object");
    }
    if (ref($term) eq 'HASH') {
#        $term = $self->apph->create_term_obj($term);
        $term = GO::Model::Term->new($term);
    }
    my $acc = $term->acc;
    $acc or confess ("$term has no acc");
    $self->{nodes_a}->{$acc} = $term;
    $self->{nodes_h}->{$acc} = $self->{nodes_a}->{$acc};
    for my $alt_id (@{$term->alt_id_list}) { $self->{nodes_a}->{$alt_id} = $term }  # IH, 6/24/2015
    $term;
}

=head2 add_node

  Usage   -
  Returns -
  Args    -

synonym for add_term

=cut

*add_node = \&add_term;

=head2 add_relationship

  Usage   - $graph->add_relationship({acc1=>from_id, acc2=>to_id});
  Usage   - $graph->add_relationship($from_id, $to_id, $type});
  Usage   - $graph->add_relationship($obj, $subj, $type});
  Returns -
  Args    -

only one relationship between id1 and id2 is allowed

See also L<GO::Model::Relationship>


=cut

sub add_relationship {
    my $self = shift;
    my ($rel) = @_;

    if (ref($rel) eq "HASH") {
	$rel = GO::Model::Relationship->new($rel);
    }
    if (UNIVERSAL::isa($rel, "GO::Model::Relationship")) {
    }
    else {
	my ($from_id, $to_id, $type) = @_;
        if (ref($from_id)) {
            if (UNIVERSAL::isa($from_id, "GO::Model::Term")) {
                my $term1 = $from_id;
                if ($term1->acc) {
                    $from_id = $term1->acc;
                }
                else {
                    $from_id = sprintf("%s", $term1);
                }
            }
        }
        if (ref($to_id)) {
            if (UNIVERSAL::isa($to_id, "GO::Model::Term")) {
                my $term2 = $to_id;
                if ($term2->acc) {
                    $to_id = $term2->acc;
                }
                else {
                    $to_id = sprintf("%s", $term2);
                }
            }
        }
        $from_id || confess("did not specify a from id, only @_");
        $to_id || confess("did not specify a to id, only @_");
	$rel = GO::Model::Relationship->new({acc1=>$from_id, acc2=>$to_id});
        $rel->type($type || 'is_a');
    }
#    if (!ref($rel)) {
#	my ($from_id, $to_id, $type) = @_;
#	$rel = GO::Model::Relationship->new({acc1=>$from_id, acc2=>$to_id});
#        $rel->type($type);
#    }
#    if (ref($rel) eq "HASH") {
#	$rel = GO::Model::Relationship->new($rel);
#    }

    $rel->acc1 || confess($rel);
    $rel->acc2 || confess($rel);

    if (0 && $rel->complete) {
        # EXPERIMENTAL:
        #  an OWL/DL style logical definition (N+S conditions) is stored in the DAG as
        #  normal Relationships but with the 'completes' tag set to true
        #
        #  e.g. for a logical def of "larval locomotory behaviour"
        #     genus: locomotory behavior
        #     differentia: during larval_stage
        #
        #  we would have 2 Relationships, one an is_a link to locomotory behavior
        #    the other a during link to larval_stage (eg from fly_anatomy)
        #  both these would be tagged complete=1
        #  - note this is in *addition* to existing links (N conditions)
        #
        #  calling this method removes the logical def links and creates
        #  a logical definition object
        my $term = $self->get_term($rel->acc2);
        my $ldef = $term->logical_definition;
        if (!$ldef) {
            $ldef = $self->apph->create_logical_definition_obj;
            $term->logical_definition($ldef);
        }
        my $oacc = $rel->acc1;
        my $type = $rel->type;
        if ($type ne 'is_a') {
            $ldef->add_intersection([$type,$oacc]);
        }
        else {
            $ldef->add_intersection([$oacc]);
        }
        return;
    }

    # add an index going from parent to child
    if (!$self->{child_relationships_h}->{$rel->acc1}) {
        $self->{child_relationships_h}->{$rel->acc1} = {};
    }
    $self->{child_relationships_h}->{$rel->acc1}->{$rel->acc2} = $rel;

    # add an index going from child to parent
    if (!$self->{parent_relationships_h}->{$rel->acc2}) {
        $self->{parent_relationships_h}->{$rel->acc2} = {};
    }
    $self->{parent_relationships_h}->{$rel->acc2}->{$rel->acc1} = $rel;

}

*add_arc = \&add_relationship;

sub get_term_properties {
    my $self = shift;
    my $acc = shift;
    if (ref($acc)) {
        # term obj?
        $acc = $acc->acc;
    }
    my $parents = $self->get_recursive_parent_terms_by_type($acc, 'is_a', 1);
    return [map {@{$_->property_list || []}} @$parents];
}

sub get_all_properties {
    my $self = shift;
    my $terms = $self->get_all_terms;
    my @props = map {@{$_->property_list || []}} @$terms;
    my %ph = map {$_->name => $_} @props;
    return [values %ph];
}

sub cross_product_index {
    my $self = shift;
    $self->{_cross_product_index} = shift if @_;
    $self->{_cross_product_index} = {} unless $self->{_cross_product_index};
    return $self->{_cross_product_index};
}

sub add_cross_product {
    my $self = shift;
    my $xp_acc = shift;
    my $xp;
    if (ref($xp_acc)) {
        $xp = $xp_acc;
        $xp_acc = $xp->xp_acc;
    }
    else {
        my $parent_acc = shift;
        my $restrs = shift;
        $xp = $self->apph->create_cross_product_obj({xp_acc=>$xp_acc,
                                                        parent_acc=>$parent_acc,
                                                        restriction_list=>$restrs});
    }
    $self->cross_product_index->{$xp_acc} = $xp;
    return $xp;
}

sub get_cross_product {
    my $self = shift;
    my $xp_acc = shift;
    return $self->cross_product_index->{$xp_acc};
}

sub get_term_by_cross_product {
    my $self = shift;
    my $xp = shift;
    my $cpi = $self->cross_product_index;
    my @xp_accs = keys %$cpi;
    my $term;
    foreach my $xp_acc (@xp_accs) {
        my $curr_xp = $cpi->{$xp_acc};
        if ($xp->equals($curr_xp)) {
            $term = $self->get_term($xp_acc);
            last;
        }
    }
    return $term;
}

sub create_subgraph_by_term_type {
    my $self = shift;
    my $tt = shift;
    
    my $g = $self->apph->create_graph_obj;
    my $terms = $self->get_all_terms;
    foreach my $t (@$terms) {
        next unless $t->type eq $tt;
        $g->add_term($t);
        $g->add_relationship($_)
          foreach @{$self->get_relationships($t->acc)};
        my $xp = $self->get_cross_product($t->acc);
        $g->add_cross_product($xp) if $xp;
    }
    return $g;
}

sub add_trailing_edge {
    my $self = shift;
    my $acc = shift;
    my $id = shift;
    if (!$self->{trailing_edges}) {
       $self->{trailing_edges} = {}; 
    }
    if (!$self->{trailing_edges}->{$acc}) {
        $self->{trailing_edges}->{$acc} = {};
    }
    $self->{trailing_edges}->{$acc}->{$id} = 1;
}

sub infer_logical_definitions {
    my $self = shift;
    my $terms = $self->get_all_terms;
    $self->infer_logical_definition_for_term($_->acc)
      foreach @$terms;
}

# EXPERIMENTAL:
#  an OWL/DL style logical definition (N+S conditions) is stored in the DAG as
#  normal Relationships but with the 'completes' tag set to true
#
#  e.g. for a logical def of "larval locomotory behaviour"
#     genus: locomotory behavior
#     differentia: during larval_stage
#
#  we would have 2 Relationships, one an is_a link to locomotory behavior
#    the other a during link to larval_stage (eg from fly_anatomy)
#  both these would be tagged complete=1
#  - note this is in *addition* to existing links (N conditions)
#
#  calling this method removes the logical def links and creates
#  a logical definition object
sub infer_logical_definition_for_term {
    my $self = shift;
    my $acc = shift;
    my $term = $self->get_term($acc);
    my $parent_rels = $self->get_parent_relationships($acc);
    my @isects = grep {$_->complete} @$parent_rels;
    warn("assertion warning: $acc has 1 logical def link") if @isects == 1;
    return unless @isects > 1;
    my $ldef;
    if (@isects) {
        $ldef = $self->apph->create_logical_definition_obj;
        $term->logical_definition($ldef);
        foreach my $isect (@isects) {
            # hack: todo; test if genuinely anonymous
            my $oacc = $isect->object_acc;
            my $rel = $isect->type;
            if ($rel ne 'is_a') {
                $ldef->add_intersection([$_->type,$oacc]);
            }
            else {
                $ldef->add_intersection([$oacc]);
            }
        }
    }
    return $ldef;
    
}

sub set_category {
    my ($self, $id, $category) = @_;
}

sub add_obsolete_pointer {
    my ($self, $id, $obsolete_id) = @_;
}

sub add_synonym {
    my ($self, $id, $synonym) = @_;
}

sub add_dbxref {
    my ($self, $id, $dbxref) = @_;
}


sub tab {
    my $tab = shift;
    my $tc = shift || "  ";
    print $tc x $tab;
}

sub _rel_prefix {
    my $self = shift;
    my $rel = shift;
    my %th = qw(is_a % part_of < develops_from ~ isa % partof < developsfrom ~);
    return $th{lc($rel->type)} || '@'.$rel->type.":";
}


=head2 add_buckets

 Usage   -
 Returns -
 Args    -

adds bucket terms to non-leaf nodes

this is useful for making GO slims

=cut

sub add_buckets {
    my $self = shift;
    my ($idspace) =
      rearrange([qw(idpsace)], @_);
    my $terms = $self->get_all_nodes;
    my $id = 1;
    $idspace = $idspace || "slim_temp_id";
    foreach my $term (@$terms) {
        if (!$self->is_leaf_node($term->acc)) {
	    #printf STDERR "adding bucket for %s\n", $term->acc;
            my $t = $self->apph->create_term_obj;
	    # start name with Z to force last alphabetic placement
            $t->name("Z-OTHER-".$term->name);
            $t->acc("$idspace:$id");
            $id++;
            $self->add_term($t);
            $self->add_relationship($term,
				    $t,
				    "bucket");
        }
    }
    return;
}


=head2 to_text_output

  Usage   -
  Returns -
  Args    - fmt, assocs [bool]

hacky text output

this method should probably move out of the model code
into output adapters

=cut

sub to_text_output {
    my $self = shift;
    my ($fmt, $show_assocs, $fh, $disp_filter, $it, $opts, $suppress) = 
      rearrange([qw(fmt assocs fh disp_filter it opts suppress)], @_);

    $fmt = $fmt || "gotext";
    $fh = $fh || \*STDOUT;

    $opts = {} unless $opts;
    $it = $self->create_iterator unless $it;
    $it->no_duplicates(1);
    if ($opts->{isa_only}) {
        $it->reltype_filter("is_a");
    }
    if ($fmt eq "gotext") {
        while (my $ni = $it->next_node_instance) {
            my $depth = $ni->depth;
            my $term = $ni->term;
            next if $term->is_relationship_type;
            my $parent_rel = $ni->parent_rel;
            my $line = " " x $depth;
            my $prefix = 
              $ni->parent_rel ? $self->_rel_prefix($ni->parent_rel) : "\$";
            $line .= 
              $term->to_text(-prefix=>$prefix,
                             -escape=>1,
			     -suppress=>$suppress,
                         );

            my $parents =
              $self->get_parent_relationships($term->acc);
            my @others = @$parents;
            if ($parent_rel) {
                @others = grep {$_->acc1 ne $parent_rel->acc1} @$parents;
                if ($disp_filter) {
                    my %filh = ();
                    $disp_filter = [$disp_filter] unless ref($disp_filter);
                    %filh = map {lc($_)=>1} @$disp_filter;
                    @others = grep { $filh{lc($_->type)} } @others;
                }
            }
            foreach my $rel (@others) {
                my $prefix =
                  $self->_rel_prefix($rel);
                my $n =
                  $self->get_term($rel->acc1);
                next unless $n;   # not in graph horizon
                $line .=
                  sprintf(" %s %s ; %s",
                          $prefix,
                          $n->name,
                          $n->public_acc);
            }
            if ($opts->{show_counts}) {
                $line.= " [gps: ".$term->n_deep_products."]";
                if ($opts->{grouped_by_taxid}) {
                    my $sh = $opts->{species_hash} || {};
                    my $n_by_tax = $term->n_deep_products_grouped_by_taxid;
                    my @taxids = sort {$n_by_tax->{$b} <=> $n_by_tax->{$a}} keys %$n_by_tax;
                    # arbitrarily select first 10...
                    my @staxids = splice(@taxids,0,10);
                    $line .= " by_tax=";
                    foreach (@staxids) {
                        my $sn = $_;
                        my $sp = $sh->{$_};
                        if ($sp && $sp->binomial) {
                            $sn = $sp->binomial;
                        }
                        $line .= " $sn:$n_by_tax->{$_}"
                    }
                }
            }
            $line .= "\n";
            if ($show_assocs && $self->is_focus_node($term)) {
                my $al = $term->association_list;
                foreach my $a (@$al) {
                    $line .= " " x $depth;
                    $line.= 
                      sprintf("  * %s %s %s %s\n",
                              $a->gene_product->symbol,
                              $a->gene_product->full_name,
                              $a->gene_product->acc,
                              join("; ", map {$_->code} @{$a->evidence_list})
                             ),
                         }
            }
            print $fh "$line";
        }
    }
    elsif ($fmt eq 'tree') {
        while (my $ni = $it->next_node_instance) {
            my $depth = $ni->depth;
            my $term = $ni->term;
            my $rtype = $ni->parent_rel ? $ni->parent_rel->type : " ";
            my $line = " " x $depth;
            $line .= 
              sprintf("[%s] ", uc(substr($rtype,0,1)));
            $line .= $term->name;
            print $fh "$line\n";
        }
    }
    elsif ($fmt eq "triples") {
        my @nodes = @{$self->get_all_nodes};
        my $line = "";
        while (my $term = shift @nodes) {
            my $parents =
              $self->get_parent_relationships($term->acc);
            foreach my $rel (@$parents) {
                my $p =
                  $self->get_term($rel->acc1);
                next unless $p;   # not in graph horizon
                $line .=
                  sprintf("(\"%s\" %s \"%s\")\n",
                          $term->name,
                          $rel->type,
                          $p->name);
            }
            print $fh "$line";
        }
    }
    else {
        while (my $ni = $it->next_node_instance) {
            my $term = $ni->term;
            next if $term->is_relationship_type;
            my $depth = $ni->depth;
            my $parent_rel = $ni->parent_rel;
            tab($depth, $self->is_focus_node($term) ? "->" : "  ");
            my %th = qw(isa % partof < developsfrom ~);
            printf $fh
              "%2s Term = %s (%s)  // products=%s // $depth\n",
                $ni->parent_rel ? $th{$ni->parent_rel->type} : "",
                  $term->name,
                    $term->public_acc,
                      $term->n_deep_products || 0,
                        $depth,
                          ;
            if ($show_assocs && $self->is_focus_node($term)) {
                my $al = $term->association_list;
                foreach my $a (@$al) {
                    tab $depth;
                    printf $fh "\t* %s %s %s\n",
                      $a->gene_product->symbol,
                        $a->gene_product->full_name,
                          $a->gene_product->acc,
                            join("; ", map {$_->code} @{$a->evidence_list}),
                        }
            }
        }
    }    
}


#Removes a node and connects the parents directly
#to the children.  It is a tricky question which
#rel_type to use for the new connection (the parent
#and childs rel_types might be different).  For
#now I just use the childs, but this may need to
#be revisited.
sub delete_node_with_reconnect {
    my $self = shift;
    my $acc = shift;

    #print "<PRE>\t\t=-=-= Removing $acc</PRE>\n";

    # First adjust the child and parent relationships
    my $par_rel_hashes = $self->{parent_relationships_h}->{$acc} || {};
    my $par_rels = [grep {$_} values(%$par_rel_hashes)];
    my $child_rel_hashes = $self->{child_relationships_h}->{$acc} || {};
    my $child_rels = [grep {$_} values(%$child_rel_hashes)];

    my ($par_rel, $child_rel);
    foreach $par_rel (@$par_rels) {
        my $par_acc = $par_rel->acc1;
        my $par_type = $par_rel->type;
        foreach $child_rel (@$child_rels) {
            my $child_acc = $child_rel->acc2;
            my $child_type = $child_rel->type;

            # There's a heirarchy of types
            my $rel_type = $child_type;
            #qw(isa partof developsfrom);

            #print "<PRE>\t\t=-=-=\t\t  Adding $par_acc -> $child_acc ($rel_type)</PRE>\n";
            $self->add_relationship({acc1=>$par_acc,
                                     acc2=>$child_acc,
                                     type=>$rel_type});
        }
    }

    # And get rid of the node itself
    $self->delete_node($acc);
}


sub DEPRECATED_sub_graph {
  my ($self, $terms) = @_;

  # Output a clone of the graph
  my $subg = $self->clone;

  my $it = $subg->create_iterator();
  my $ni;
  while ($ni = $it->next_node_instance)
    {
      my $term = $ni->term;
      my $term_name = $term->name;
      my $acc = $term->public_acc;
      $subg->delete_node_with_reconnect($acc) unless (grep {$_->public_acc eq $term->public_acc} @$terms);
      #print_debug_line("Keeping term \"$term_name\" in graph") if (grep {$_->public_acc eq $term->public_acc} @$terms);
    }

  return $subg;
}

sub max_depth
  {
    my ($self) = @_;

    my $it = $self->create_iterator();

    my $max_d = 0;
    my $ni;
    while ($ni = $it->next_node_instance)
      {
        my $depth = $ni->depth;
        $max_d = max($max_d, $depth);
      }

    return $max_d;
  }

sub split_graph_by_re {
    my ($acc, $re, $rtype, $orthogroot) =
      rearrange([qw(acc re rtype re orthogroot)], @_);
    my $func = sub {$_=shift->name;/$re/;print STDERR "$re on $_;xx=$1\n";($1)};
    shift->split_graph_by_func($acc,$func,$rtype,$orthogroot);
}

sub split_graph_by_func {
    my $self = shift;
    my ($acc, $func, $rtype, $orthogroot) =
      rearrange([qw(acc func rtype re orthogroot)], @_);
#    my $ng = ref($self)->new;
    my $ng = $self->apph->create_graph_obj;

    my $new_acc = $self->apph->new_acc;
    my $root = $self->get_term($acc);
#    $ng->add_term($root);
    my $it = $self->create_iterator($acc);
    my %h = ();
    while (my $ni = $it->next_node_instance) {
        my $term = $ni->term;
        my $rel = $ni->parent_rel;
        next unless !$rel || lc($rel->type) eq "is_a";
        my ($n) = &$func($term);
#        my $t1 = GO::Model::Term->new({name=>$n1});
#        my $t2 = GO::Model::Term->new({name=>$n});
        my $t2;
        $t2 = $self->apph->get_term({search=>$n});
        if (!$t2) {
            print STDERR "$n not found; checking graph\n";
            my $all = $ng->get_all_nodes;
            ($t2) = grep { $_->name eq $n } @$all;
        }
        if (!$t2) {
            print STDERR "$n not found; creating new\n";
            $t2 = $self->apph->create_term_obj({name=>$n});
            $t2->type("new");
            $t2->acc($new_acc++);
        }
        $h{$term->acc} = $t2;

        # original term now gets flattened in main graph
        $ng->add_term($term);
#        $ng->add_relationship($root->acc, $term->acc, $rel->type) if $rel;
        if ($rel) {
            $ng->add_relationship($rel->acc1, $term->acc, $rel->type) if $rel->acc1;
        }

        # this part gets externalised and the relationship
        # gets preserved here
        $ng->add_term($t2);
        if ($rel) {
            my $np = $h{$rel->acc1};
            if ($np) {
                # new externalised ontology
                $ng->add_relationship($np->acc, $t2->acc, $rel->type);
                # x-product
                $ng->add_relationship($t2->acc, $term->acc, $rtype);
            }
        }
    }
    return $ng;
}

sub store {
    my $self = shift;
    foreach my $t (@{$self->get_all_nodes}) {
        $self->apph->add_term($t);
    }
    foreach my $r (@{$self->get_all_relationships}) {
        $self->apph->add_relationship($r);
    }
}

# **** EXPERIMENTAL CODE ****
# the idea is to be homogeneous and use graphs for
# everything; eg gene products are nodes in a graph,
# associations are arcs
# cf rdf, daml+oil etc
sub graphify {
    my $self = shift;
    my ($subg, $opts) =
      rearrange([qw(graph opts)], @_);

    $opts = {} unless $opts;
    $subg = $self unless $subg;

    foreach my $term (@{$self->get_all_nodes}) {
        $term->graphify($subg);
    }
    $subg;
}

1;
