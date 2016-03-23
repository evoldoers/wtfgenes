# $Id: Term.pm,v 1.24 2008/01/17 20:08:14 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself


package GO::Model::Term;

=head1 NAME

GO::Model::Term       - a term or concept in an ontology

=head1 SYNOPSIS

  # From a file
  use GO::Parser;
  my $parser = new GO::Parser({handler=>'obj'}); # create parser object
  $parser->parse("gene_ontology.obo"); # parse file -> objects
  my $graph = $parser->handler->graph;  # get L<GO::Model::Graph> object
  my $term = $graph->get_term("GO:0001303");   # fetch a term by ID
  printf "Term %s %s\n", $term->name, $term->acc;  

  # From a GO Database (requires go-db-perl)
  my apph = GO::AppHandle->connect(-dbname=>$dbname);
  my $term = $apph->get_term({acc=>00003677});
  printf "Term:%s (%s)\nDefinition:%s\nSynonyms:%s\n",
    $term->name,
    $term->public_acc,
    $term->definition,
    join(", ", @{$term->synonym_list});

=head1 DESCRIPTION

Represents an Ontology term; the same class is used for process,
compartment and function

currently, a Term is not aware of its Relationships; to find out how a
term is related to other terms, use the a L<GO::Model::Graph> object,
which will give you the GO::Model::Relationship objects; for example

  $rels = $graph->get_parent_relationships($term->acc);

=head1 SEE ALSO

L<GO::Model::Relationship>
L<GO::Model::Graph>
L<GO::Model::Xref>
L<GO::Model::Association>

=head1 NOTES

Like all the GO::Model::* classes, this uses accessor methods to get
or set the attributes. by using the accessor method without any
arguments gets the value of the attribute. if you pass in an argument,
then the attribuet will be set according to that argument.

for single-valued attributes

  # this sets the value of the attribute
  $my_object->attribute_name("my value");

  # this gets the value of the attribute
  $my_value = $my_object->attribute_name();

for lists:

  # this sets the values of the attribute
  $my_object->attribute_name(\@my_values);

  # this gets the values of the attribute
  $my_values = $my_object->attribute_name();


=cut


use Carp;
use Exporter;
use GO::Utils qw(rearrange);
use GO::Model::Root;
use GO::Model::Association;
use GO::Model::Xref;
use GO::Model::GeneProduct;
use strict;
use vars qw(@ISA);

use base qw(GO::Model::Root Exporter);

our %code_to_namespace =
  ('F'=>'molecular_function',
   'P'=>'biological_process',
   'C'=>'cellular_component');

sub _valid_params { return qw(id name description term_type
is_obsolete is_relationship_type public_acc acc definition
synonym_list association_list selected_association_list
association_hash n_associations dbxref_list property_list subset_list
equivalent_to_union_of_term_list
disjoint_from_term_list
consider_list
replaced_by_list
is_instance
stag is_anonymous is_cyclic is_transitive is_symmetric is_anti_symmetric is_reflexive
inverse_of transitive_over domain range logical_definition); }

=head2 acc

  Usage   - print $term->acc()
  Alias   - public_acc
  Returns -
  Args    -

accessor: gets/sets GO ID/accession [as an integer]

throws: exception if you try to pass in a non-integer

if you want to use IDs in the format GO:0000nnn, then use the method
public_acc()

=cut

sub acc {
    my $self = shift;
    if (@_) {
	my $acc = shift;
	$self->{acc} = $acc;
    }
    return $self->{acc};
}

*public_acc = \&acc;

=head2 name

  Usage   - print $term->name;
  Returns -
  Args    -

accessor: gets/sets "name" attribute

=cut

sub name {
    my $self = shift;
    $self->{name} = shift if @_;
    my $name = $self->{name};
    return $name;
}

sub description {
    my $self = shift;
    warn('deprecated');
    $self->name(@_);
}


=head2 subset_list

  Usage   - foreach (@{$term->subset_list || []}) { printf " $_\n" }
  Returns - list of strings
  Args    - list of strings [optional]

List of subset Accs for a term

Subsets are also known as GO Slims

=cut

=head2 in_subset

  Usage   - if ($term->in_subset('goslim_prok');
  Returns - bool
  Args    - subset-name str

Tests if the term belongs to a subset

=cut

sub in_subset {
    my $self = shift;
    my $subset = shift;
    return 1 if grep {$_ eq $subset} @{$self->subset_list || []};
    return 0;
}

=head2 definition

  Usage   - print $term->definition;
  Returns -
  Args    -

accessor: gets/sets "definition" attribute

=cut

sub definition {
    my $self = shift;
    $self->{definition} = shift if @_;
    return $self->{definition};
}

=head2 primary_xref

 Title   : primary_xref
 Usage   :
 Function:
 Example :
 Returns : GO::Model::Xref
 Args    :

The same as acc(), except the ID is returned as a L<GO::Model::Xref>
rather than a string

=cut

sub primary_xref{
   my ($self,@args) = @_;

   my ($dbname, $acc) = split(/\:/, $self->acc);
   return GO::Model::Xref->new({xref_key=>$acc,
				xref_dbname=>$dbname});
}


=head2 comment

 Title   : comment
 Usage   : $obj->comment($newval)
 Function: 
 Example : 
 Returns : value of comment (a scalar)
 Args    : on set, new value (a scalar or undef, optional)


=cut

sub comment{
    my $self = shift;

    return $self->{'comment'} = shift if @_;
    return $self->{'comment'};
}

=head2 definition_dbxref_list

 Title   : definition_dbxref_list
 Usage   : $obj->definition_dbxref(\@xrefs)
 Function: 
 Example : 
 Returns : definition_dbxref_list hashlist (of GO::Model::Xref)
 Args    : on set, new values (GO::Model::Xref hashlist)

L<GO::Model::Xref>

=cut

sub definition_dbxref_list{
    my $self = shift;

    return $self->{'definition_dbxref_list'} = shift if @_;
    return $self->{'definition_dbxref_list'};
}


=head2 add_definition_dbxref

  - Usage : $term->add_definition_dbxref($xref);
  - Args  : GO::Term::Xref
  
L<GO::Model::Xref>

=cut

sub add_definition_dbxref {
    my $self = shift;

    foreach my $dbxref (@_) {
        if (!ref($dbxref)) {
            my ($db, @rest) = split(/:/, $dbxref);
            confess "$dbxref not a dbxref" unless @rest;
            my $acc = join(":", @rest);
            $dbxref = $self->apph->create_xref_obj({xref_key=>$acc,
                                                    xref_dbname=>$db});
        }
        UNIVERSAL::isa($dbxref, "GO::Model::Xref") or confess($dbxref." not a xref");
        $self->definition_dbxref_list([]) unless $self->definition_dbxref_list;
        push(@{$self->definition_dbxref_list}, $dbxref);

    }
    $self->definition_dbxref_list;
}


sub lisp_acc {
    my $self = shift;
    return 
      sprintf "Go%07d", $self->acc;
}



=head2 has_synonym

  Usage   - if ($term->has_synonym("autotrophy") {...}
  Returns - bool
  Args    - string

=cut

sub has_synonym {
    my $self = shift;
    my $str = shift;
    my @syns = @{$self->synonym_list || []};
    if (grep {$_ eq $str} @syns) {
        return 1;
    }
    return 0;
}


=head2 add_synonym

  Usage   - $term->add_synonym("calcineurin");
  Usage   - $term->add_synonym(@synonym_strings);
  Returns -
  Args    -

Adds a synonym; loses type information (the synonym type in blank)

=cut

sub add_synonym {
    my $self = shift;
    $self->add_synonym_by_type('', $_) foreach @_;
}

=head2 synonym_list

  Usage   - my $syn_l = $term->synonym_list;
  Usage   - $term->synonym_list([$syn1, $syn2]);
  Returns - arrayref
  Args    - arrayref [optional]

accessor: gets/set list of synonyms [array reference]

each synonym is represented as a string - this method loses synonym
typing information. If used as a setter, will set the type for each
synonym to null

=cut

sub synonym_list {
    my $self = shift;
    if (@_) {
        my $syns = shift;
        $self->synonyms_by_type_idx({});
        $self->add_synonym(@$syns);
    }
    my $sbt = $self->synonyms_by_type_idx;
    my @syns = 
      map { @{$sbt->{$_} || []} } keys %$sbt;
    return \@syns;
}

sub synonym_type_list {

    return [keys %{shift->{_synonyms_by_type_idx} || {}}];
}

# private: lookup table indexed by type, value is syn string arrayref
sub synonyms_by_type_idx {
    my $self = shift;
    if (@_) {
        $self->{_synonyms_by_type_idx} = shift;
    }
    else {
        $self->{_synonyms_by_type_idx} = {} unless 
          $self->{_synonyms_by_type_idx};
    }
    return $self->{_synonyms_by_type_idx};
}


=head2 add_synonym_by_type

  Usage   - $term->add_synonym_by_type('exact', $syn);
  Returns -
  Args    -

=cut

sub add_synonym_by_type {
    my $self = shift;
    my $type = shift || '';
    my $syn = shift;
    push(@{$self->synonyms_by_type_idx->{$type}}, $syn);
}


=head2 synonyms_by_type

  Usage   - $synstrs = $term->synonyms_by_type('exact');
  Usage   - $term->synonyms_by_type('exact', \@exact_syns);
  Returns - arrayref of strings
  Args    - type string, arrayref of strings [optional]

in getter mode, gets a list of synonyms of a particular type

in setter mode, sets a list of synonyms for a particular type

=cut

sub synonyms_by_type {
    my $self = shift;
    my $type = shift;
    if (@_) {
        $self->synonyms_by_type_idx->{$type} = shift;
    }
    return $self->synonyms_by_type_idx->{$type} || [];
}

=head2 alt_id_list

  Usage   - my $syn_l = $term->alt_id_list;
  Usage   - $term->alt_id_list([$syn1, $syn2]);
  Returns - arrayref
  Args    - arrayref [optional]

accessor: gets/set list of synonyms [array reference]

=cut

sub alt_id_list {
    my $self = shift;
    if (@_) {
        $self->add_alt_id(@_);
    }
    $self->synonyms_by_type('alt_id');
}


=head2 add_alt_id

  Usage   - $term->add_alt_id('GO:0000001');
  Returns -
  Args    - id string, or list of id strings

=cut

sub add_alt_id {
    my $self = shift;
    my @alt_ids = @_;
    $self->add_synonym_by_type('alt_id',$_) foreach @_;
}
*add_secondaryid = \&add_alt_id;


=head2 namespace (INHERITED)

  Usage   - print $term->namespace();     # getting the type
  Usage   - $term->namespace("molecular_function"); # setting the type
  Alias   - type
  Alias   - term_type
  Alias   - category
  Alias   - ontology
  Returns - string representing type
  Args    - string represnting type [optional]

The OBO namespace for the L<GO::Model::Term> or
L<GO::Model::Relationship>

This method is inherited from the superclass

=cut

# DEFINED IN SUPERCLASS
# documentation repeated here to make things easier to find

=head2 set_namespace_by_code

  Usage   - $term->set_namespace_by_code("P");
  Returns - 
  Args    - String: M, P or C

Currently the mapping is hardcoded

  ('F'=>'molecular_function',
   'P'=>'biological_process',
   'C'=>'cellular_component');

=cut

sub set_namespace_by_code {
    my $self = shift;
    my $code = shift;
    my $ns = $code_to_namespace{$code};
    if (!$ns) {
        $self->throw("Unknown code: $code");
    }
    $self->namespace($ns);
    return $code;
}

=head2 get_code_from_namespace

  Usage   - $code = $term->get_code_from_namespace;
  Returns - String: M, P or F
  Args    - String (if omitted will use current namespace)

Returns the code for the current namespace (or any given namespace if supplied)

=cut

sub get_code_from_namespace {
    my $self = shift;
    my $ns = shift || $self->namespace || ''; 
    my %m = reverse %code_to_namespace; # assumes 1-1 bijective mapping
    my $code = $m{$ns};
#    if (!$code) {
#        $self->throw("Unknown namespace: $ns");
#    }
    return $code;
}




# DEPCRECATED
sub add_obsolete {
    my $self = shift;
    if (@_) {
	my $obs = shift;
	$self->{obsolete_h}->{$obs->acc} = $obs;
    }
    return $self->obsolete_list;
}

# deprecated
sub obsolete_list {
    my $self = shift;
    while (shift @_) {
	$self->add_obsolete ($_);
    }
    my @obs = values %{$self->{obsolete_h}};
    return \@obs;
}


=head2 add_dbxref

  - Usage : $term->add_dbxref($xref);
  - Args  : GO::Term::Xref

L<GO::Model::Xref>

=cut

sub add_dbxref {
    my $self = shift;

    foreach my $dbxref (@_) {
        if (!ref($dbxref)) {
            my ($db, @rest) = split(/:/, $dbxref);
            confess "$dbxref not a dbxref" unless @rest;
            my $acc = join(":", @rest);
            $dbxref = $self->apph->create_xref_obj({xref_key=>$acc,
                                                    xref_dbname=>$db});
        }
        UNIVERSAL::isa($dbxref, "GO::Model::Xref") or confess($dbxref." not a xref");
        $self->dbxref_list([]) unless $self->dbxref_list;
        push(@{$self->dbxref_list}, $dbxref);

    }
    $self->dbxref_list;
}
*add_xref = \&add_dbxref;


=head2 dbxref_list

  - Usage : $term->dbxref_list($xref);
  - Args  : optional listref of GO::Term::Xref
  - Returns  : listref of GO::Term::Xref
  

accessor: gets/sets list of dbxref [array reference]

=cut

# autodefined

=head2 is_obsolete

accessor: gets/set obsolete flag [boolean

=cut

sub is_obsolete {
    my $self = shift;
    $self->{is_obsolete} = shift if @_;
    return $self->{is_obsolete} ? 1:0;
}

=head2 is_root

accessor: gets/set is_root flag [boolean]

=cut

sub is_root {
    my $self = shift;
    $self->{is_root} = shift if @_;
    return $self->{is_root} ? 1:0;
}

=head1 TERM ASSOCIATION METHODS

=head2 association_list

  Usage   - $assoc_l = $term->association_list
  Returns - arrayref of GO::Model::Association
  Args    - arrayref of GO::Model::Association [optional]

accessor: gets/set list of associations [array reference]

if this is undefined, the datasource will be queried
for the associations

=cut

sub association_list {
    my $self = shift;
    my ($al, $sort_by) = 
      rearrange([qw(associations sort_by)], @_);
    if ($al) {
	if (!ref($al) eq "ARRAY") {
	    confess("$al is not an array ref");
	}
	$self->{"association_list"} = $al;
	foreach my $assoc (@{$self->{"association_list"} || []}) {
	    my $gene = $assoc->gene_product;
	    $self->{association_hash}->{$gene->acc} = $assoc;
	}
    }
    if (!defined($self->{"association_list"})) {
	if (!defined($self->apph)) {
#	    print $self->dump;
	}
	else {
	    $self->{"association_list"} =
	      $self->apph->get_direct_associations($self);
	    foreach my $assoc (@{$self->{"association_list"} || []}) {
		my $gene = $assoc->gene_product;
		if (!$gene) {
		    confess("no gene for assoc $assoc");
		}
                if (!$self->{association_hash}->{$gene->acc}) {
                    $self->{association_hash}->{$gene->acc} = [];  
                }
		push(@{$self->{association_hash}->{$gene->acc}}, $assoc);
	    }
	}
    }
    if ($sort_by &&
        (!$self->{"association_list_sort_by"} ||
         $self->{"association_list_sort_by"} ne $sort_by)) {
        my @sortlist = ref($sort_by) ? @$sort_by : ($sort_by);
        my @al = 
          sort {
              my $as1 = $a;
              my $as2 = $b;
              my $i=0;
              my $cmp;
              while (!defined($cmp) && 
                     $i < @sortlist) {
                  my $sortk = $sortlist[$i];
                  $i++;
                  if ($sortk eq "gene_product") {
                      $cmp = 
                        $as1->gene_product->symbol cmp
                        $as2->gene_product->symbol;
                  }
                  elsif ($sortk eq "ev_code") {
                      confess("cant sort on evcode yet");
                  }
                  else {
                      confess("dont know $sortk");
                  }
              }
              $cmp;
          } @{$self->{association_list} || []};
        $self->{"association_list"} = \@al;
        $self->{"association_list_sort_by"} = $sort_by;
    }
    return $self->{"association_list"};
}

=head2 selected_association_list

  Usage   - $assoc_l = $term->selected_association_list
  Returns - arrayref of GO::Model::Association
  Args    - arrayref of GO::Model::Association [optional]

accessor: gets list of SELECTED associations [array reference]

[this method is only of use if you are using it in conjunction with
L<GO::AppHandle> in the go-db-perl distro]

this in not the total list of all associations associated with a term;
if the term was created via a query on products, this will include
those associations

L<GO::Model::Association>

=cut

# done by AUTOLOAD



=head2 add_association

  Usage   - $term->add_association($assoc);
  Returns - 
  Args    - GO::Model::Association

L<GO::Model::Association>

=cut

sub add_association {
    my $self = shift;
    if (!$self->{"association_list"}) {
	$self->{"association_list"} = [];
    }
    my $assoc = shift;
    if (ref($assoc) ne "GO::Model::Association") {
	# it's a hashref - create obj from hashref
	my $assoc2 = $self->apph->create_association_obj($assoc);
	$assoc = $assoc2;
    }
    push(@{$self->{"association_list"}}, ($assoc));
    my $gene = $assoc->gene_product;
    if (!$self->{association_hash}->{$gene->acc}) {
        $self->{association_hash}->{$gene->acc} = [];  
    }
    push(@{$self->{association_hash}->{$gene->acc}}, $assoc);
    return $self->{"association_list"};
}


=head2 add_selected_association

  Usage   -
  Returns -
  Args    -

L<GO::Model::Association>

=cut

sub add_selected_association {
    my $self = shift;
    my $assoc = shift;
    $assoc->isa("GO::Model::Association") || confess;
    if (!$self->{"selected_association_list"}) {
	$self->{"selected_association_list"} = [];
    }
    push(@{$self->{"selected_association_list"}}, $assoc);
}

=head2 association_hash

returns associations as listref of unique GeneProduct objects

L<GO::Model::Association>

=cut

sub association_hash {
    my $self = shift;
    if (!defined($self->{"association_list"})) {
        $self->association_list;
    }
    $self->{"association_hash"} = shift if @_;
    return $self->{"association_hash"};
}

=head2 get_all_associations

  Usage   - my $al = $term->get_all_associations
  Returns - GO::Model::Association list
  Args    -

returns all associations for the term and the terms beneath it in the GO DAG

same as $apph->get_all_associations($term)

L<GO::Model::Association>

=cut

sub get_all_associations {
    my $self = shift;
    $self->apph->get_all_associations($self);
}

=head2 n_associations

  Usage   - my $n = $term->n_associations
  Returns -
  Args    -

=cut

sub n_associations {
    my $self = shift;
    if (!@{$self->{"association_list"} || []}) {

	# association count can be get/set even if the actual
	# list is not present
	$self->{n_associations} = shift if @_;
    }
    if (!defined($self->{n_associations}) &&
        $self->{association_list}) {

        # we have already loaded the
        # association list
	$self->{n_associations} =
	  scalar(@{$self->association_list || []});
    }
    if (!defined($self->{n_associations})) {
	$self->{n_associations} =
          $self->apph->get_association_count($self);
    }
    return $self->{n_associations};
}


=head2 product_list

  Usage   - $prods = $term->product_list
  Returns - L<GO::Model::GeneProduct> listref
  Args    -

Returns a reference to an array of gene products that are attached
directly to this term.

(if the products have not been fetched, this method will call
$term->association_list, cache the results, and use the associations
to build the product list. succeeding calls of product_list to this
term will hence be faster)

See L<GO::Model::GeneProduct>

=cut

sub product_list {
    my $self = shift;
    my $assocs = $self->association_list;
    my @prods = ();
    my %ph = ();
    foreach my $assoc (@$assocs) {
        my $gp = $assoc->gene_product;
        if (!$ph{$gp->id}) {
            push(@prods, $gp);
            $ph{$gp->id} = 1;
        }
    }
    return [@prods];
}


=head2 deep_product_list

  Usage   -
  Returns - GO::Model::GeneProduct listref
  Args    -

finds all products attached to this term and all terms below in the
graph

L<GO::Model::GeneProduct>

=cut

sub deep_product_list {
    my $self = shift;
    my $prods = 
      $self->apph->get_products({deep=>1, term=>$self});
    return $prods;
}

=head2 n_deep_products

  Usage   - my $count = $term->n_deep_products;
  Returns - int
  Args    - filter (hashref) - or string "recount"

gets the count for the *dsitinct* number of GO::Model::GeneProduct
entries annotated at OR BELOW this level. if you have set the filters
in GO::AppHandle then these filters will be used in determining the
count.

Remember, if you did not explicitly set the filters, then the
default filter will be used, which is [!IEA] (i.e. curated
associations only, see www.geneontology.org for a discussion of
evidence codes).

Note: currently only the speciesdb filter is respected. It turns out
to be very expensive to do the set arithmetic for distinct recursive
gene counts with different evidence combinations. Because each product
belongs to one speciesdb only, the speciesdb counts are mutually
exclusive, which makes this easier.

  # get the number of gene products that have been annotated
  # as transcription factors in worm and fly discounting
  # uncurated automatic annotations
  $apph->filters({evcodes=>["!IEA"], speciesdbs=>["SGD", "FB"]});
  $term = $apph->get_term({name=>"transcription factor"});
  print $term->n_deep_products;

The count will be cached, so if you alter the filter parameters be sure
to get a recount like this:

  my $count = $term->n_deep_products("recount");

TODO: make the recount automatic if the filter is changed

PERFORMANCE NOTE 1: When you ask the AppHandle to give you a list of
GO::Model::Term objects, it may decide to populate this attribute when
building the terms in a fast and efficient way. Therefore you should
avoid setting the filters *after* you have created the objects
otherwise it will have to refetch all these values slowing things
down.

PERFORMANCE NOTE 2: If you are using the SQL GO::AppHandle
implementation, then this call will probably involve a query to the
*gene_produc_count* table. If you populated the database you are using
yourself, make sure this table is filled otherwise this will be an
expensive query.

L<GO::Model::GeneProduct>

=cut

sub n_deep_products {
    my $self = shift;
    $self->{n_deep_products} = shift if @_;
    if (!defined($self->{n_deep_products}) ||
        $self->{n_deep_products} eq "recount") {
        $self->{n_deep_products} = 
          $self->apph->get_deep_product_count({term=>$self});
    }
    else {
    }
    return $self->{n_deep_products};
}

# EXPERIMENTAL
sub n_deep_products_grouped_by_taxid {
    my $self = shift;
    $self->{n_deep_products_grouped_by_taxid} = shift if @_;
    if (!defined($self->{n_deep_products_grouped_by_taxid}) ||
        $self->{n_deep_products_grouped_by_taxid} eq "recount") {
        $self->{n_deep_products_grouped_by_taxid} = 
          $self->apph->get_deep_product_count({term=>$self,group_by=>'taxid'});
    }
    else {
    }
    return $self->{n_deep_products_grouped_by_taxid};
}


=head2 n_products

  Usage   - as n_deep_products
  Returns -
  Args    -

see docs for n_deep_products

gets a count of products AT THIS LEVEL ONLY

L<GO::Model::GeneProduct>

=cut

sub n_products {
    my $self = shift;
    $self->{n_products} = shift if @_;
    if (!defined($self->{n_products}) ||
        $self->{n_products} eq "recount") {
        $self->{n_products} = 
          $self->apph->get_product_count({term=>$self});
    }
    return $self->{n_products};
}

sub n_unique_associations {
    my $self = shift;
    return scalar(keys %{$self->association_hash || {}});
}

sub get_child_terms {
    my $self = shift;
    return $self->apph->get_child_terms($self, @_);
}

sub get_parent_terms {
    my $self = shift;
    return $self->apph->get_parent_terms($self, @_);
}

=head2 loadtime

 Title   : loadtime
 Usage   :
 Function:
 Example :
 Returns : time term was loaded into datasource
 Args    : none


=cut

sub loadtime{
    my ($self) = @_;
    return $self->apph->get_term_loadtime($self->acc);
}


sub show {
    my $self = shift;
    print $self->as_str;
}

sub as_str {
    my $self = shift;
    sprintf("%s (%s)", $self->name, $self->public_acc);
}
# --- EXPERIMENTAL METHOD ---
# not yet public
sub namerule {
    my $self = shift;
    $self->{_namerule} = shift if @_;
    return $self->{_namerule};
}

sub defrule {
    my $self = shift;
    $self->{_defrule} = shift if @_;
    return $self->{_defrule};
}

# --- EXPERIMENTAL METHOD ---
# not yet public
sub stag {
    my $self = shift;
    $self->{_stag} = shift if @_;
    if (!$self->{_stag}) {
        require "Data/Stag.pm";
        $self->{_stag} = Data::Stag->new(stag=>[]);
    }
    return $self->{_stag};
}



# pseudo-private method
# available to query classes;
# a template is a specification from a client to a query server
# showing how much data should be transferred across.
# the template is an instance of the object that is being returned;
# there are a few premade templates available; eg shallow
sub get_template {
    my $class = shift;
    my $template = shift || {};
    if ($template eq "shallow") {
	# shallow template, just get term attributes, no other
	# structs
	$template = GO::Model::Term->new({"name"=>"",
					  "acc"=>-1,
					  "definition"=>"",
					  "n_associations"=>0,
					  "synonym_list"=>[],
					  "dbxref_list"=>undef});
    }
    if ($template =~ /no.*assoc/) {
        # everything bar associations
	$template = GO::Model::Term->new({"name"=>"",
					  "acc"=>-1,
					  "definition"=>1,
					  "n_associations"=>0,
					  "synonym_list"=>[]});
        $template->{dbxref_h} = 1;
    }
    if ($template eq "all") {
        # everything
	$template = GO::Model::Term->new({"name"=>"",
					  "acc"=>-1,
					  "definition"=>1,
					  "association_list"=>[],
					  "synonym_list"=>[]});
        $template->{dbxref_h} = 1;
    }
    return $template;
}

sub to_text {
    my $self = shift;
    my ($prefix, $escape, $obs_l, $suppress) =
      rearrange([qw(prefix escape obs suppress)], @_);
    my @syns = @{$self->synonym_list || [] };
    my @xrefs = @{$self->dbxref_list || [] };
    if ($suppress) {
	if (!ref($suppress)) {
	    $suppress = {$suppress => 1};
	}
	@xrefs =
	  grep {!$suppress->{$_->xref_dbname}} @xrefs;
    }
    else {
	@xrefs =
	  grep {$_->xref_dbname eq 'EC'} @xrefs;
    }
    my $sub = 
      sub { @_ };
    if ($escape) {
        $sub =
          sub {map{s/\,/\\\,/g;$_}@_};
    }
    my $text = 
      sprintf("%s%s ; %s%s%s%s",
              &$sub($prefix || ""),
              &$sub($self->name),
              $self->public_acc,
              (($obs_l && @$obs_l) ?
               join ("", map {", ".$_->public_acc } @$obs_l ) 
               : ''
              ),
              ((@xrefs) ?
               join("", map {&$sub(" ; ".($_->as_str || ''))} @xrefs )
               : ''
              ),
              ((@syns) ?
               join("", map {&$sub(" ; synonym:$_")} @syns ):""
              ),
             );
    return $text;
}

sub to_ptuples {
    my $self = shift;
    my ($th, $include, $sort) =
      rearrange([qw(tuples include sort)], @_);
    my @s = ();
    push(@s,
         ["term",
          $self->acc,
          $self->name,
          ]);
    foreach my $x (@{$self->dbxref_list || []}) {
        push(@s, $x->to_ptuples(-tuples=>$th));
        push(@s, ["term_dbxref",
                  $self->acc,
                  $x->as_str]);
    }
    @s;
}

1;
