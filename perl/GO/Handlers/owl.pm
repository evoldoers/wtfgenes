# stag-handle.pl -p GO::Parsers::GoOntParser -m <THIS> function/function.ontology

# $Id: owl.pm,v 1.5 2004/07/08 04:08:42 cmungall Exp $
#
# This GO module is maintained by Chris Mungall <cjm@fruitfly.org>
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Handlers::owl     - writes OWL 

=head1 SYNOPSIS

  use GO::Parser;
  my $p = GO::Parser->new({handler=>'owl'});
  $p->parse("function.ontology");

=head1 DESCRIPTION

Consumes an OBO-XML event stream and generates OWL XML

See the file

  go-dev/doc/mapping-obo-to-owl.txt

For more details

=head1 COMMAND LINE

go2fmt.pl -w owl function.obo

=cut


package GO::Handlers::owl;
use base qw(Data::Stag::Writer Exporter);
use XML::Writer;
use strict;

sub is_transform { 0 }

sub init {
    my $self = shift;
    $self->SUPER::init(@_);
    my $gen = XML::Writer->new(OUTPUT=>$self->safe_fh);
    $self->{writer} = $gen;

    $gen->setDataMode(1);
    $gen->setDataIndent(4);
}

sub s_obo {
    my $self = shift;

    $self->{writer}->xmlDecl("UTF-8");
#    $self->{writer}->doctype("owl:RDF", 
#			     '-//Gene Ontology//Custom XML/RDF Version 2.0//EN',
#			     'http://www.godatabase.org/dtd/go.dtd');
    $self->{writer}->startTag('rdf:RDF', 
			      'xmlns:rdf'=>"http://www.w3.org/1999/02/22-rdf-syntax-ns#",
			      'xmlns:rdfs'=>"http://www.w3.org/2000/01/rdf-schema#",
			      'xmlns:owl'=>"http://www.w3.org/2002/07/owl#",

			      'xmlns'=>"http://www.geneontology.org/owl/obo/#",
			      'xmlns:obo'=>"http://www.geneontology.org/owl/obo/#",
			      'xml:base'=>"http://www.geneontology.org/owl/obo/",
			      'xmlns:dc'=>"http://purl.org/dc/elements/1.1/",
			     );
}

sub e_obo {
    my $self = shift;

    $self->{writer}->endTag('rdf:RDF');
}

sub w {
    shift->{writer}
}

sub e_term {
    my ($self, $term) = @_;
    my $id = $term->get_id || $self->throw($term->sxpr);
    my $w = $self->w;
    $id = rdfsafe($id);
    my $name_h = $self->{name_h};
    my $name = $term->get_name;
    $w->startTag('owl:Class', 'rdf:ID'=>$id);
    if ($name) {
	if (!$name_h) {
	    $name_h = {};
	    $self->{name_h} = $name_h;
	}
	$name_h->{$id} = $name;
	$self->cmt("-- $name --\n");
	$w->dataElement('rdfs:label', $name);
    }
    my $def = $term->get_definition;
    if ($def) {
	$w->dataElement('dc:description',
			$def->get_definition_text);
    }
    my $ont = $term->get_ontology;
#    if ($ont) {
#	$self->fact('belongs', [$id, $ont]);
#    }
    my @is_as = $term->get_is_a;
    $w->dataElement('rdfs:subClassOf',
		       '',
		       'rdf:resource'=>rdfres($_)) foreach @is_as;
    my @rels = $term->get_relationship;
    foreach (@rels) {
	$w->startTag('rdfs:subClassOf');
	$w->startTag('owl:Restriction');
	$w->dataElement('owl:onProperty', '',
			   'rdf:resource'=>rdfres($_->get_type));
	$w->dataElement('owl:someValuesFrom', '',
			   'rdf:resource'=>rdfres($_->get_to));
	$w->endTag('owl:Restriction');
	$w->endTag('rdfs:subClassOf');
    }
    $w->endTag('owl:Class');
    return;
}

sub e_typedef {
    my ($self, $typedef) = @_;
    my $id = $typedef->get_id || $self->throw($typedef->sxpr);
    my $w = $self->w;
    $id = rdfsafe($id);
    my $name = $typedef->get_name;
    $w->startTag('owl:ObjectProperty', 'rdf:ID'=>$id);
    if ($name) {
#	$w->dataElement('rdfs:label', $name);
    }
    my $def = $typedef->get_definition;
    if ($def) {
	$w->dataElement('dc:description',
			$def->get_definition_text);
    }
    my @is_as = $typedef->get_is_a;
    $w->dataElement('rdfs:subPropertyOf',
		       '',
		       'rdf:resource'=>rdfres($_)) foreach @is_as;
    my $domain = $typedef->get_domain;
    my $range = $typedef->get_range;
    $w->dataElement('rdfs:domain','','rdf:resource'=>rdfres($domain)) if $domain;
    $w->dataElement('rdfs:range','','rdf:resource'=>rdfres($range)) if $range;
    $w->endTag('owl:ObjectProperty');
    return;
}

sub out {
    my $self = shift;
    print "@_";
}

sub cmt {
    my $self = shift;
    my $cmt = shift;
#    $self->out(" % $cmt") if $cmt;
    return;
}

sub rdfres {
    my $w = rdfsafe(shift);
    return "#$w";
}

sub rdfsafe {
    my $w = shift;
    $w =~ s/:/_/g;
    $w;
}

1;
