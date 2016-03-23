# $Id: Parser.pm,v 1.15 2006/04/20 22:48:23 cmungall Exp $
#
#
# see also - http://www.geneontology.org
#          - http://www.godatabase.org/dev
#
# You may distribute this module under the same terms as perl itself

=head1 NAME

  GO::Parser     - parses all GO files formats and types

=head1 SYNOPSIS

fetch L<GO::Model::Graph> objects using a parser:

  # Scenario 1: Getting objects from a file
  use GO::Parser;
  my $parser = new GO::Parser({handler=>'obj',use_cache=>1});
  $parser->parse("function.ontology");     # ontology
  $parser->parse("GO.defs");               # definitions
  $parser->parse("ec2go");                 # external refs
  $parser->parse("gene-associations.sgd"); # gene assocs
  # get GO::Model::Graph object
  my $graph = $parser->handler->graph;

  # Scenario 2: Getting OBO XML from a file
  use GO::Parser;
  my $parser = new GO::Parser({handler=>'xml'});
  $parser->handler->file("output.xml");
  $parser->parse("gene_ontology.obo");

  # Scenario 3: Using an XSL stylesheet to convert the OBO XML
  use GO::Parser;
  my $parser = new GO::Parser({handler=>'xml'});
  # xslt files are kept in in $ENV{GO_ROOT}/xml/xsl
  # (if $GO_ROOT is not set, defaults to install directory)
  $parser->xslt("oboxml_to_owl"); 
  $parser->handler->file("output.owl-xml");
  $parser->parse("gene_ontology.obo");

  # Scenario 4: via scripts
  my $cmd = "go2xml gene_ontology.obo | xsltproc my-transform.xsl -";
  my $fh = FileHandle->new("$cmd |") || die("problem initiating $cmd");
  while(<$fh>) { print $_ }
  $fh->close || die("problem running $cmd");

=cut

=head1 DESCRIPTION

Module for parsing GO flat files; for examples of GO/OBO flatfile
formats see:

L<ftp://ftp.geneontology.org/pub/go/ontology>

L<ftp://ftp.geneontology.org/pub/go/gene-associations>

For a description of the various file formats, see:

L<http://www.geneontology.org/GO.format.html>

L<http://www.geneontology.org/GO.annotation.html#file>

This module will generate XML events from a correctly formatted GO/OBO
file

=head1 SEE ALSO

This module is a part of go-dev, see:

L<http://www.godatabase.org/dev>

for more details

=head1 PUBLIC METHODS

=head2 new

 Title   : new
 Usage   : my $p = GO::Parser->new({format=>'obo_xml',handler=>'obj'});
           $p->parse("go.obo-xml");
           my $g = $p->handler->graph;
 Synonyms: 
 Function: creates a parser object
 Example : 
 Returns : GO::Parser
 Args    : a hashref of arguments:
            format: a format for which a parser exists
            handler: a format for which a perl handler exists
            use_cache: (boolean) see caching below

=head2 parse

 Title   : parse
 Usage   : $p->parse($file);
 Synonyms: 
 Function: parses a file
 Example : 
 Returns : 
 Args    : str filename

=head2 handler

 Title   : handler
 Usage   : my $handler = $p->handler;
 Synonyms: 
 Function: gets/sets a GO::Handler object
 Example : 
 Returns : L<GO::Handlers::base>
 Args    : L<GO::Handlers::base>

=head1 FORMATS

This module is a front end wrapper for a number of different GO/OBO
formats - see the relevant module documentation below for details.

The full list of parsers can be found in the go-perl/GO/Parsers/
directory

=over

=item obo_text

Files with suffix ".obo"

This is a new file format replacement for the existing GO flat file
formats. It handles ontologies, definitions and xrefs (but not
associations)

=item go_ont

Files with suffix ".ontology"

These store the ontology DAGs

=item go_def

Files with suffix ".defs"

=item go_xref

External database references for GO terms

Files with suffix "2go" (eg ec2go, metacyc2go)

=item go_assoc

Annotations of genes or gene products using GO

Files with prefix "gene-association."

=item obo_xml

Files with suffix ".obo.xml" or ".obo-xml"

This is the XML version of the OBO flat file format above

See L<http://www.godatabase.org/dev/xml/doc/xml-doc.html>

=item obj_yaml

A YAML dump of the perl L<GO::Model::Graph> object. You need L<YAML>
from CPAN for this to work

=item obj_storable

A dump of the perl L<GO::Model::Graph> object. You need L<Storable>
from CPAN for this to work. This is intended to cache objects on the
filesystem, for fast access. The obj_storable representation may not
be portable

=head2 PARSING ARCHITECTURE

Each parser fires XML B<events>. The XML events are known as
B<Obo-XML>.  

These XML events can be B<caught> by a handler written in perl, or
they can be caught by an XML parser written in some other language, or
by using XSL stylesheets.

go-dev comes with a number of stylesheets in the 
  go-dev/xml/xsl
directory

Anything that catches these XML events is known as a B<handler>

go-perl comes with some standard perl XML handlers, in addition to
some standard XSL stylesheets. These can be found in the
B<go-dev/go-perl/GO/Handlers> directory

If you are interested in getting perl B<objects> from files then you
will want the B<obj> handler, which gives back L<GO::Model::Graph>
objects

The parsing architecture gives you the option of using the go-perl
object model, or just parsing the XML events directly

If you are using the go-db-perl library, the load-go-into-db.pl script
will perform the following processes when loading files into the
database

=over

=item Obo-XML events fired using GO::Parser::* classes

=item Obo-XML transformed into godb xml using oboxml_to_godb_prestore.xsl

=item godb_prestore.xml stored in database using generic loader

=back

=head2 Obo-XML

The Obo-XML format DTD is stored in the go-dev/xml/dtd directory

=head2 HOW IT WORKS

Currently the various parsers and perl event handlers use the B<stag>
module for this - see L<Data::Stag> for more details, or
http://stag.sourceforge.net

=head2 NESTED EVENTS

nested events can be thought of as xml, without attributes; nested
events can easily be turned into xml

events have a start, a body and an end

event handlers can *catch* these events and do something with them.

an object handler can turn the events into objects, centred around the
GO::Model::Graph object; see GO::Handlers::obj

other handlers can catch the events and convert them into other
formats, eg OWL or OBO

Or you can bypass the handler and get output as an XML stream - to do
this, just run the go2xml script

a database loading event handler can catch the events and turn them
into SQL statements, loading a MySQL or postgres database (see the
go-db-perl library)

the advantage of an event based parsing architecture is that it is
easy to build lightweight parsers, and heavy weight object models can
be bypassed if prefered.

=head2 EXAMPLES

To see examples of the events generated by the GO::Parser class, run
the script go2xml; for example

  go2xml function.ontology

on any GO-formatted flatfile

This also works on OBO-formatted files:

  go2xml gene_ontology.obo

You can also use the script "stag-parse.pl" which comes with the
L<Data::Stag> distribution. for example

  stag-parse.pl -p GO::Parsers::go_assoc_parser gene-association.fb

=head2 XSLT HANDLERS

The full list can be found in the go-dev/xml/xsl directory

=head2 PERL HANDLERS

see GO::Handlers::* for all the different handlers possible;
more can be added dynamically.

you can either create the handler object yourself, and pass it as an argument,
e.g.

  my $apph    = new GO::AppHandle(-db=>"go");
  my $handler = new GO::Handlers::godb({apph=>$apph});
  my $parser  = new GO::Parser({handler=>$handler});
  $parser->parse(@files);

or you can use one of the registered handlers:

  my $parser = new GO::Parser({handler=>'db',
                               handler_args=>{apph=>$apph}});

or you can just do things from the command line

  go2fmt.pl -w oboxml function.ontology


the registered perl handlers are as follows:

=over

=item obo_xml

writes out OBO-XML (which is basically a straightforward conversion of
the event stream into XML)

=item obo_text

=item go_ont

legacy GO-ontology file format

=item go_xref

GO xref file, for linking GO terms to terms and dbxrefs in other ontologies

=item go_defs

legacy GO-definitions file format

=item go_assoc

GO association file format

=item rdf

GO XML-RDF file format

=item owl

OWL format (default: OWL-DL)

OWL is a W3C standard format for ontologies

You will need the XSL files from the full go-dev distribution to run
this; see the XML section in L<http://www.godatabase.org/dev>

=item prolog

prolog facts - you will need a prolog compiler/interpreter to use
these. You can reason over these facts using Obol or the forthcoming
Bio-LP project

=item sxpr

lisp style S-Expressions, conforming to the OBO-XML schema; you will
need lisp to make full use of these. you can also do some nice stuff
just within emacs (use lisp-mode and load an sxpr file into your
buffer)

=item godb

this is actually part of the go-db-perl library, not the go-perl library

catches events and loads them into a database conforming to the GO
database schema; see the directory go-dev/sql, as part of the whole
go-dev distribution; or www.godatabase.org/dev/database

=item obj_yaml

A YAML dump of the perl L<GO::Model::Graph> object. You need L<YAML>
from CPAN for this to work

=item obj_storable

A dump of the perl L<GO::Model::Graph> object. You need L<Storable>
from CPAN for this to work. This is intended to cache objects on the
filesystem, for fast access. The obj_storable representation may not
be portable

=back

=head1 EXAMPLES OF DATATYPE TEXT FORMATS

=head2 go_ont format

eg format: go_ont for storing graphs and metadata; for example:

  !version: $Revision: 1.15 $
  !date: $Date: 2006/04/20 22:48:23 $
  !editors: Michael Ashburner (FlyBase), Midori Harris (SGD), Judy Blake (MGD)
  $Gene_Ontology ; GO:0003673
   $cellular_component ; GO:0005575
    %extracellular ; GO:0005576
     <fibrinogen ; GO:0005577
      <fibrinogen alpha chain ; GO:0005972
      <fibrinogen beta chain ; GO:0005973

See GO::Parsers::go_ont_parser for more details

this is the following file parsed with events turned directly into OBO-XML:
  
  <?xml version="1.0" encoding="UTF-8"?>
  <obo>
    <source>
      <source_type>file</source_type>
      <source_path>z.ontology</source_path>
      <source_mtime>1075164285</source_mtime>
    </source>
    <term>
      <id>GO:0003673</id>
      <name>Gene_Ontology</name>
      <ontology>root</ontology>
    </term>
    <term>
      <id>GO:0005575</id>
      <name>cellular_component</name>
      <ontology>root</ontology>
      <is_a>GO:0003673</is_a>
    </term>
    <term>
      <id>GO:0005576</id>
      <name>extracellular</name>
      <ontology>root</ontology>
      <is_a>GO:0005575</is_a>
    </term>
    <term>
      <id>GO:0005577</id>
      <name>fibrinogen</name>
      <ontology>root</ontology>
      <relationship>
        <type>part_of</type>
        <to>GO:0005576</to>
      </relationship>
    </term>
    <term>
      <id>GO:0005972</id>
      <name>fibrinogen alpha chain</name>
      <ontology>root</ontology>
      <relationship>
        <type>part_of</type>
        <to>GO:0005577</to>
      </relationship>
    </term>
    <term>
      <id>GO:0005973</id>
      <name>fibrinogen beta chain</name>
      <ontology>root</ontology>
      <relationship>
        <type>part_of</type>
        <to>GO:0005577</to>
      </relationship>
    </term>
  </obo>

=head2 go_def format

eg format: go_defs for storing definitions:

  !Gene Ontology definitions
  !
  term: 'de novo' protein folding
  goid: GO:0006458
  definition: Processes that assist the folding of a nascent peptide chain into its correct tertiary structure.
  definition_reference: Sanger:mb

See GO::Parsers::go_def_parser for more details

=head2 go_xref format

eg format: go_xrefs for storing links between GO IDs and IDs for terms
in other DBs:

  EC:1.-.-.- > GO:oxidoreductase ; GO:0016491
  EC:1.1.-.- > GO:1-phenylethanol dehydrogenase ; GO:0018449

See GO::Parsers::go_xref_parser for more details

=head2 go_assoc format

eg format: go-assocs for storing gene-associations:

  SGD     S0004660        AAC1            GO:0005743      SGD:12031|PMID:2167309 TAS             C       ADP/ATP translocator    YMR056C gene    taxon:4932 20010118
  SGD     S0004660        AAC1            GO:0006854      SGD:12031|PMID:2167309 IDA             P       ADP/ATP translocator    YMR056C gene    taxon:4932 20010118

See GO::Parsers::go_assoc_parser for more details

=head2 obo_text format

L<http://www.geneontology.org/GO.format.html>

=cut

package GO::Parser;

use Exporter;

use Carp;
use GO::Model::Term;
use FileHandle;
use strict qw(subs vars refs);
use base qw(GO::Model::Root);

# Exceptions


# Constructor


=head2 new

  Usage   - my $parser = GO::Parser->new()
  Returns - GO::Parser

creates a new parser

=cut

sub new {
    my $proto = shift; 
    my $class = ref($proto) || $proto;;
    my $self = {};
    bless $self, $class;

    my $init_h = $_[0] || {};
    if (!ref($init_h)) {
        $init_h = {@_};
    }
    my $fmt = $init_h->{format} || $init_h->{fmt} || '';
    my $use_cache = $init_h->{use_cache};
    $fmt = lc($fmt) unless $fmt =~ /::/;
#    $fmt = 'gotext' unless $fmt;
    if (!$fmt) {
	# this parser guesses/defers on what type it is parsing
	$fmt = "unknown_format";
    }

    my $p = $self->get_parser_impl($fmt);
    if ($init_h) {
	map {$p->{$_} = $init_h->{$_}} keys %$init_h;
    }
    
    my $handler = $init_h->{handler} || "base";
    if (UNIVERSAL::isa($handler, "GO::AppHandle")) {
        require "GO/Handlers/DbStoreHandler.pm";
        $handler = GO::Handlers::DbStoreHandler->new({apph=>$handler});
    }
    unless (ref($handler)) {
	my $hclass = $handler;
	if ($handler !~ /::/) {
	    if ($handler =~ /^::/) {
		$hclass = $handler;
		$hclass =~ s/^:://;
	    }
	    else {
		$hclass = "GO::Handlers::$handler";
	    }
	}
        eval {
            $class->load_module($hclass);
        };
        if ($@) {
            print STDERR $@, "\n\n\n";
            
            $self->throw("No such handler: $handler");
        }
        $handler = $hclass->new($init_h->{handler_args});
    }
    $p->handler($handler);
    $p->use_cache($use_cache);

    delete $init_h->{parser};
    delete $init_h->{handler};

    return $p;
}


sub get_parser_impl {
    my $self = shift;
    my $fmt = shift;
    my $mod;
    if ($fmt =~ /::/) {
	$mod = $fmt;
    }
    else {
	$mod = "GO::Parsers::$fmt"."_parser";
    }
    $self->load_module($mod);
    my $p = $mod->new();
    return $p;
}


=head2 create_handler

  Usage   - my $handler = GO::Parser->create_handler('obj');
  Returns - L<GO::Handlers::base>
  Args    - handler type [str]

=cut

sub create_handler {
    my $self = shift;
    my $type = shift || 'obj';
    my $p = $self->new({handler=>$type});
    return $p->handler;
}

sub load_module {

    my $self = shift;
    my $classname = shift;
    my $mod = $classname;
    $mod =~ s/::/\//g;

    if ($main::{"_<$mod.pm"}) {
    }
    else {
	eval {
	    require "$mod.pm";
	};
	if ($@) {
	    $self->throw("No such module: $classname;;\n$@");
	}
    }
}

1;
