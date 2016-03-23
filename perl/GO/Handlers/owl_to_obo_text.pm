# $Id: owl_to_obo_text.pm,v 1.2 2004/07/08 04:08:42 cmungall Exp $
# BioPerl module for Bio::Parser::owl_to_obo
#
# cjm
#
# POD documentation - main docs before the code

=head1 NAME

Bio::Parser::owl_to_obo_text

=head1 SYNOPSIS

Do not use this module directly.

=head1 DESCRIPTION

=head1 FEEDBACK

=head1 AUTHORS - Chris Mungall

Email: cjm@fruitfly.org

=cut

# Let the code begin...

package GO::Handlers::owl_to_obo_text;
use vars qw(@ISA);
use strict;

# Object preamble - inherits from Bio::Root::Object

use base qw(GO::Handlers::base);

our $BASE;

sub e_rdf_RDF_xml_base {
    my ($self, $base) = @_;
    $BASE = $base->data;
    return;
}

sub e_owl_ObjectProperty {
    my ($self, $prop) = @_;
    my $id = $prop->sget("owl:ObjectProperty-rdf:ID");
    $self->printf("\n[Typedef]\nid:%s\nname:%s\n",
		  $id, $id);


    $prop->free;
    return;
}

sub e_owl_AnnotationProperty {
    my ($self, $prop) = @_;
    
    $prop->free;
    return;
}

sub _xml {
    my $str = shift;
    my $xml = "<foo>$str</foo>";
    my $struct;
    eval {
	$struct = Data::Stag->parsestr($xml);
    };
    if ($@) {
	print STDERR $@;
	print STDERR $str,"\n";
	$struct = Data::Stag->new(foo=>[]);
    }
    $struct;
}

sub e_owl_Class {
    my ($self, $owlclass) = @_;

    print $owlclass->xml;
    my $id = $owlclass->sget("owl:Class-rdf:ID");
    my $name = $owlclass->sget("Preferred_Name") || $id;
    my @defh = 
      map {
	  my $struct = _xml($_);
	  ($struct->sget("def-definition") =>
	   $struct->sget("def-source"));
      } $owlclass->get("DEFINITION");
    my %defh = @defh;
    my @defrefs = values %defh;
    my $defref = join(" ", map {"[$_]"} @defrefs) || "[]";
    my $def = join(";;\\n", keys %defh);
    
    my @subclasses =
      map {
	  my @R = $_->get("owl:Restriction");
	  if (@R) {
	      @R;
	  }
	  else {
	      my $sid = $_->sget("rdfs:subClassOf-rdf:resource");
	      if (!$sid) {
		  die $owlclass->sxpr;
		  $sid = '';
	      }
	      _get_ID($sid);
	  }
      } $owlclass->get("rdfs:subClassOf");
    my @restrictions = grep {ref($_)} @subclasses;
    @subclasses = grep {!ref($_)} @subclasses;
    
    my @stypes = $owlclass->get("Semantic_Type");
    
    # weird xml-inside-xml
    my @syns = $owlclass->get("FULL_SYN");
    @syns = map {
	my $struct = _xml($_);
	$struct->sget("term-name");
    } @syns;
    push(@syns, $owlclass->get("Synonym"));
    my @lines =
      (id => $id,
       name => $name,
       (map {(is_a => $_ )} @subclasses),
       (map {(synonym => safeqt($_)." []")} @syns),
       $def ? (definition => safeqt($def)." $defref") : (),
       (map {
	   (relationship =>
	    sprintf("%s %s",
		    (_get_IDs($_->sfindval("owl:onProperty-rdf:resource")),
		     _get_IDs($_->sfindval("owl:someValuesFrom-rdf:resource")),
		    )))
       } @restrictions),
      );
    $self->printf("\n[Term]\n");
    while (my ($tag, $val) = splice(@lines, 0, 2)) {
	$self->print("$tag: $val\n");
    }
    $owlclass->free;
    return;
}

sub safeqt {
    my $str = shift || '';
    $str =~ s/\"/\\\"/g;
    "\"$str\"";
}
sub _get_ID {
    my @l = _get_IDs(@_);
    return shift @l;
}

sub _get_IDs {
    my @ids = @_;
    map {
	$_ = '' unless $_;
	s/^\#//;
	$_;
    } @ids;
}

1;
