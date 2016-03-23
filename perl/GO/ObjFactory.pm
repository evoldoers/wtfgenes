# $Id: ObjFactory.pm,v 1.6 2007/01/24 01:16:19 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

package GO::ObjFactory;

=head1 NAME

  GO::ObjFactory     - GO Object Factory

=head1 SYNOPSIS

You should not use this method directly

=head1 DESCRIPTION

You only need to be aware of this class if you are generating new
objects. You should not directly create objects like this:

  $term = GO::Model::Term->new($h);

Instead you should create them like this:

  $fac = GO::ObjFactory->new();
  $term = $fac->create_term_obj($h);

Usually you do not need to instantiate a factory, as all objects
created with a factory carry around a reference to that factory, so
you can do this:

  # $graph object was previously created via a factory
  $term = $graph->create_term_obj($h);

If you are only using the go-perl module, then factories do not buy
you much. However, if you are also using go-db-perl and GO::AppHandle,
then factories can be useful - all objects generated from the database
will be attached to an AppHandle which means that "lazy loading" can
be used. See GO::AppHandle in go-db-perl for details

=cut


use strict;
use Carp;
use GO::Model::Seq;
use GO::Model::Term;
use GO::Model::Xref;
use GO::Model::GeneProduct;
use GO::Model::CrossProduct;
use GO::Model::LogicalDefinition;
use GO::Model::Graph;
use GO::Model::DB;
use GO::Model::Ontology;
use GO::Model::Property;
use GO::Model::Restriction;
use GO::Model::Species;
use base qw(GO::Model::Root);

sub apph{
  my $self = shift;
  $self->{apph} = shift if @_;

  my $apph = $self->{apph} || $self;
  return $apph;
}




=head2 create_term_obj

  Usage   - $term = $apph->create_term_obj;
  Returns - L<GO::Model::Term>
  Args    -

=cut

sub create_term_obj {
    my $self = shift;
    my $term = GO::Model::Term->new(@_);
    $term->apph( $self->apph );
    return $term;
}

=head2 create_relationship_obj

  Usage   - $relationship = $apph->create_relationship_obj;
  Returns - L<GO::Model::Relationship>
  Args    -

=cut

sub create_relationship_obj {
    my $self = shift;
    my $term = GO::Model::Relationship->new(@_);
    $term->apph( $self->apph );
    return $term;
}

=head2 create_xref_obj

  Usage   - $xref = $apph->create_xref_obj;
  Returns - L<GO::Model::Xref>
  Args    -

=cut

sub create_xref_obj {
    my $self = shift;
    my $xref = GO::Model::Xref->new(@_);
#    $xref->apph($self);
    return $xref;
}

=head2 create_evidence_obj

  Usage   - $evidence = $apph->create_evidence_obj;
  Returns - L<GO::Model::Evidence>
  Args    -

=cut

sub create_evidence_obj {
    my $self = shift;
    my $ev = GO::Model::Evidence->new(@_);
    return $ev;
}

=head2 create_seq_obj

  Usage   - $seq = $apph->create_seq_obj;
  Returns - L<GO::Model::Seq>
  Args    -

=cut

sub create_seq_obj {
    my $self = shift;
    my $seq = GO::Model::Seq->new(@_);
    $seq->apph( $self->apph );
    return $seq;
}

=head2 create_db_obj

  Usage   - $db = $apph->create_db_obj;
  Returns - L<GO::Model::DB>
  Args    -

=cut

sub create_db_obj {
    my $self = shift;
    my $db = GO::Model::DB->new(@_);
    $db->apph( $self->apph );
    return $db;
}

=head2 create_association_obj

  Usage   - $association = $apph->create_association_obj;
  Returns - L<GO::Model::Association>
  Args    -

=cut

sub create_association_obj {
    my $self = shift;
    my $association = GO::Model::Association->new();
    $association->apph( $self->apph );
    $association->_initialize(@_);
    return $association;
}

=head2 create_gene_product_obj

  Usage   - $gene_product = $apph->create_gene_product_obj;
  Synonym - create_product_obj
  Returns - L<GO::Model::GeneProduct>
  Args    -

=cut

sub create_gene_product_obj {
    my $self = shift;
    my $gene_product = GO::Model::GeneProduct->new(@_);
    $gene_product->apph( $self->apph );
    return $gene_product;
}
*create_product_obj = \&create_gene_product_obj;

=head2 create_species_obj

  Usage   - $species = $apph->create_species_obj;
  Returns - L<GO::Model::Species>
  Args    -

=cut

sub create_species_obj {
    my $self = shift;
    my $sp = GO::Model::Species->new(@_);
    $sp->apph( $self->apph );
    return $sp;
}

=head2 create_graph_obj

  Usage   - $graph = $apph->create_graph_obj;
  Returns - L<GO::Model::Graph>
  Args    -

=cut

sub create_graph_obj {
    my $self = shift;
    my $graph = GO::Model::Graph->new(@_);
    $graph->apph( $self->apph );
    return $graph;
}

# deprecated synonym for Graph
sub create_ontology_obj {
    my $self = shift;
    my $ontology = GO::Model::Ontology->new(@_);
    $ontology->apph( $self->apph );
    return $ontology;
}

# alpha code
sub create_property_obj {
    my $self = shift;
    my $property = GO::Model::Property->new(@_);
    $property->apph( $self->apph );
    return $property;
}


# alpha code
sub create_restriction_obj {
    my $self = shift;
    my $restriction = GO::Model::Restriction->new(@_);
    $restriction->apph( $self->apph );
    return $restriction;
}

sub create_logical_definition_obj {
    my $self = shift;
    my $ldef = GO::Model::LogicalDefinition->new(@_);
    $ldef->apph( $self->apph );
    return $ldef;
}


# experimental/deprecated code
sub create_cross_product_obj {
    my $self = shift;
    my $cross_product = GO::Model::CrossProduct->new(@_);
    $cross_product->apph( $self->apph );
    return $cross_product;
}

1;


