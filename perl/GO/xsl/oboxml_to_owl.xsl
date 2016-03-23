<?xml version = "1.0"?>
<!DOCTYPE stylesheet [
  <!ENTITY oboInOwl "http://www.geneontology.org/formats/oboInOwl#">
  <!ENTITY oboContent "http://purl.org/obo/owl/">
  <!ENTITY obo "http://purl.org/obo/owl/obo#">
  <!ENTITY newobo "http://purl.obolibrary.org/obo/">
  <!ENTITY IAO "http://purl.obolibrary.org/obo/IAO_">
  <!ENTITY BFO "http://purl.obolibrary.org/obo/BFO_">
  <!ENTITY RO "http://purl.obolibrary.org/obo/RO_">
  <!ENTITY oban "http://purl.org/obo/oban/">
  <!ENTITY xref "http://purl.org/obo/owl/">
  <!ENTITY xsd "http://www.w3.org/2001/XMLSchema#">
  <!ENTITY owl "http://www.w3.org/2002/07/owl#">
  <!ENTITY owl11 "http://www.w3.org/2006/12/owl11#onClass">
  <!ENTITY owl2 "http://www.w3.org/2006/12/owl2#onClass">
  ]>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" 
  xmlns:oban="http://purl.org/obo/oban/"
  xmlns:owl="http://www.w3.org/2002/07/owl#"
  xmlns:owl11="&owl11;"
  xmlns:owl2="&owl2;"
  xmlns:oboInOwl="&oboInOwl;"
  xmlns:oboContent="&oboContent;"
  xmlns:obo="&obo;"
  xmlns:newobo="&newobo;"
  >

  <!-- *********************************************** -->
  <!-- Imports -->
  <!-- *********************************************** -->
  
  <!-- *********************************************** -->
  <!-- Parameters -->
  <!-- *********************************************** -->
  <xsl:param name="localid_prefix"/>
  <xsl:param name="xmlbase_relative"/>

  <!-- *********************************************** -->
  <!-- XML -->
  <!-- *********************************************** -->

  <xsl:output indent="yes" method="xml"/>

  <!-- *********************************************** -->
  <!-- Indexes -->
  <!-- *********************************************** -->
  <xsl:key name="k_idspace" match="obo/header/idspace" use="local"/>
  <xsl:key name="k_instance" match="obo/instance" use="id"/>
  <xsl:key name="k_relation" match="obo/typedef" use="id"/>

  <!-- *********************************************** -->
  <!-- block passthru -->
  <!-- *********************************************** -->
  <xsl:template match="text()|@*">
  </xsl:template>

  <xsl:variable name="default_idspace">
    <xsl:choose>
      <xsl:when test="substring-before(//obo/term[1]/id,':')">
        <xsl:value-of select="substring-before(//obo/term[1]/id,':')"/>
      </xsl:when>
      <xsl:when test="substring-before(//obo/typedef[1]/id,':')">
        <xsl:value-of select="substring-before(//obo/typedef[1]/id,':')"/>
      </xsl:when>
      <xsl:when test="substring-before(//obo/instance[1]/id,':')">
        <xsl:value-of select="substring-before(//obo/instance[1]/id,':')"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>obo</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:variable>

  <xsl:variable name="xmlbase">
    <xsl:choose>
      <xsl:when test="key('k_idspace','_base')">
        <xsl:value-of select="key('k_idspace','_base')/global"/>
      </xsl:when>
      <xsl:otherwise>

        <xsl:text>&oboContent;</xsl:text>
        <!-- ontology must have unique xml base for imports
             using the ID space seems to have problems, for example with bridging ontologies:
             an xp ontology may have classes with idspace GO, but may be downloaded from somewhere else.
             
             For now we use the file path, but there is no guarantee this is dereferenceable (use 303s?)
             In future, consider a default-idspace tag
             See also thread " Calling the rdf file an ontology?", july11 2007, semantic-web list
             
             -->
        <xsl:choose>
          <xsl:when test="$xmlbase_relative">
            <xsl:value-of select="$xmlbase_relative"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="substring-before(*/source/source_path,'.')"/>
          </xsl:otherwise>
        </xsl:choose>
        
      </xsl:otherwise>
      
    </xsl:choose>
  </xsl:variable>

  <!-- *********************************************** -->
  <!-- Top level -->
  <!-- *********************************************** -->

  <xsl:template match="/">
    <rdf:RDF
      xmlns="&oboContent;"
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
      xmlns:owl="http://www.w3.org/2002/07/owl#"
      xmlns:xsd="&xsd;"
      xmlns:oboInOwl="&oboInOwl;"
      xmlns:oboContent="&oboContent;"
      xml:base="{$xmlbase}"
      >


      <xsl:comment>
        <xsl:text>oboInOwl meta-model - we must declare this here, otherwise the ontology will be OWL-Full unless we import &oboInOwl;</xsl:text>
      </xsl:comment>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasAlternativeId"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasDate"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasVersion"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasDbXref"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasDefaultNamespace"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasOBONamespace"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasDefinition"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasSynonym"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasExactSynonym"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasNarrowSynonym"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasBroadSynonym"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasRelatedSynonym"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasSynonymType"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasSubset"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;hasURI"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;isCyclic"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;inSubset"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;savedBy"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;replacedBy"/>
      <owl:AnnotationProperty rdf:about="&oboInOwl;consider"/>
      <owl:AnnotationProperty rdf:about="&newobo;IAO_0000425"/>
      <owl:AnnotationProperty rdf:about="&newobo;IAO_0000424"/>
      <owl:Class rdf:about="&oboInOwl;DbXref"/>
      <owl:Class rdf:about="&oboInOwl;Definition"/>
      <owl:Class rdf:about="&oboInOwl;Subset"/>
      <owl:Class rdf:about="&oboInOwl;Synonym"/>
      <owl:Class rdf:about="&oboInOwl;SynonymType"/>
      <owl:Class rdf:about="&oboInOwl;ObsoleteClass"/>
      <owl:ObjectProperty rdf:about="&oboInOwl;ObsoleteProperty"/>
      
      <xsl:apply-templates select="obo/header"/>
      <xsl:apply-templates select="obo/synonym_category"/>
      <xsl:apply-templates select="obo/term[not(builtin) or builtin!='1']"/>
      <xsl:apply-templates select="obo/typedef[not(builtin) or builtin!='1']"/>
      <xsl:apply-templates select="obo/instance"/>
    </rdf:RDF>
  </xsl:template>

  <!-- *********************************************** -->
  <!-- GENERAL PURPOSE -->
  <!-- *********************************************** -->

  <!-- obo names correspond to rdfs labels -->
  <xsl:template match="name">
    <!-- all names are presumed to be in english -->
    <rdfs:label xml:lang="en">
      <xsl:value-of select="."/>
    </rdfs:label>
  </xsl:template>

  <xsl:template mode="label" match="*|@*">
    <!-- all names are presumed to be in english -->
    <rdfs:label xml:lang="en">
      <xsl:value-of select="."/>
    </rdfs:label>
  </xsl:template>

  <!-- added 0.4 SA -->
  <xsl:template match="description">
    <rdfs:comment rdf:datatype="&xsd;string">
      <xsl:value-of select="."/>
    </rdfs:comment>
  </xsl:template>

  <!-- dbxrefs -->

  <!-- in obo-xml, both dbxref and xref_analog refer to the same thing.
       note that the tag now used in obo-text-1.2 is just 'xref' -->
  <xsl:template match="dbxref|xref_analog|xref">
    <oboInOwl:hasDbXref>
      <oboInOwl:DbXref>
        <rdfs:label>
          <xsl:value-of select="dbname"/>
          <xsl:text>:</xsl:text>
          <xsl:value-of select="acc"/>
        </rdfs:label>
        <oboInOwl:hasURI rdf:datatype="&xsd;anyURI">
          <xsl:choose>
            <!-- typically OBO xrefs are in the form DB:ID - eg EC:1.1.1.1
                 on occasion the xref is also a URI. This this case it may be
                 mistakenly mis-parsed as DB=http, ID=//xxx.yyy.zzz/foo
                 we correct for that here -->
            <xsl:when test="dbname='URL'">
              <xsl:value-of select="acc"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>&xref;</xsl:text>
              <xsl:value-of select="dbname"/>
              <xsl:text>#</xsl:text>
              <xsl:value-of select="dbname"/>
              <xsl:text>_</xsl:text>
              <xsl:value-of select="acc"/>
            </xsl:otherwise>
          </xsl:choose>
        </oboInOwl:hasURI>
      </oboInOwl:DbXref>
    </oboInOwl:hasDbXref>
  </xsl:template>

  <!-- *********************************************** -->
  <!-- Synonmyms -->
  <!-- *********************************************** -->

  <xsl:template match="synonym[@scope='exact']">
    <oboInOwl:hasExactSynonym>
      <xsl:apply-templates mode="synonym" select="."/>
    </oboInOwl:hasExactSynonym>
  </xsl:template>

  <xsl:template match="synonym[@scope='narrow']">
    <oboInOwl:hasNarrowSynonym>
      <xsl:apply-templates mode="synonym" select="."/>
    </oboInOwl:hasNarrowSynonym>
  </xsl:template>

  <xsl:template match="synonym[@scope='broad']">
    <oboInOwl:hasBroadSynonym>
      <xsl:apply-templates mode="synonym" select="."/>
    </oboInOwl:hasBroadSynonym>
  </xsl:template>

  <xsl:template match="synonym">
    <oboInOwl:hasRelatedSynonym>
      <xsl:apply-templates mode="synonym" select="."/>
    </oboInOwl:hasRelatedSynonym>
  </xsl:template>

  <xsl:template mode="synonym" match="*">
    <oboInOwl:Synonym>
      <xsl:apply-templates mode="label" select="synonym_text"/>
      <xsl:apply-templates select="dbxref"/>
    </oboInOwl:Synonym>
  </xsl:template>
  
  <xsl:template match="synonym_category">
    <oboInOwl:SynonymType>
      <xsl:apply-templates select="id"/>
      <xsl:apply-templates select="name"/>
      <xsl:apply-templates select="namespace"/>
    </oboInOwl:SynonymType>
  </xsl:template>

  <!-- *********************************************** -->
  <!-- ONTOLOGY METADATA -->
  <!-- *********************************************** -->

  <!-- A subset is a view over an ontology -->
  <xsl:template match="subsetdef">
    <oboInOwl:hasSubset>
      <oboInOwl:Subset>
        <xsl:apply-templates select="id"/>
        <rdfs:comment rdf:datatype="&xsd;string">
          <xsl:value-of select="name"/>
        </rdfs:comment>
        <!-- subsetdefs can in theory have dbxrefs; no existing examples of this -->
        <xsl:apply-templates select="dbxref"/>
      </oboInOwl:Subset>
    </oboInOwl:hasSubset>
  </xsl:template>

  <xsl:template match="idspace">
    <oboInOwl:IDSpace>
      <oboInOwl:local>
        <xsl:value-of select="local"/>
      </oboInOwl:local>
      <oboInOwl:global>
        <xsl:value-of select="global"/>
      </oboInOwl:global>
      <xsl:apply-templates select="comment"/>
    </oboInOwl:IDSpace>
  </xsl:template>


  <xsl:template match="import">
    <xsl:choose>
      <xsl:when test="substring(.,string-length(.)-3) = '.obo'">
        <owl:imports rdf:resource="{concat(substring(.,0,string-length(.)-3),'.owl')}"/>
      </xsl:when>
      <xsl:otherwise>
        <owl:imports rdf:resource="{.}"/>
      </xsl:otherwise>
    </xsl:choose>
                               
  </xsl:template>

  <xsl:template match="format-version">
  </xsl:template>

  <xsl:template match="data-version">
    <owl:versionInfo>
      <xsl:value-of select="."/>
    </owl:versionInfo>
  </xsl:template>

  <xsl:template match="date">
    <oboInOwl:hasDate>
      <xsl:value-of select="."/>
    </oboInOwl:hasDate>
  </xsl:template>

  <xsl:template match="saved-by">
    <oboInOwl:savedBy>
      <xsl:value-of select="."/>
    </oboInOwl:savedBy>
  </xsl:template>

  <xsl:template match="auto-generated-by">
  </xsl:template>

  <xsl:template match="default-namespace">
    <oboInOwl:hasDefaultNamespace>
      <xsl:value-of select="."/>
    </oboInOwl:hasDefaultNamespace>
  </xsl:template>

  <xsl:template match="remark">
    <rdfs:comment>
      <xsl:value-of select="."/>
    </rdfs:comment>
  </xsl:template>

  <!-- *********************************************** -->
  <!-- MAIN TEMPLATES -->
  <!-- *********************************************** -->

  <xsl:template match="header">

    <!-- supply the Ontology metadata -->
    <owl:Ontology rdf:about="">
      <!-- most of these are not relevant in the OWL
           transform but are required for round-tripping -->
      <xsl:apply-templates select="import"/>
      <xsl:apply-templates select="format-version"/>
      <xsl:apply-templates select="data-version"/>
      <xsl:apply-templates select="date"/>
      <xsl:apply-templates select="saved-by"/>
      <xsl:apply-templates select="auto-generated-by"/>
      <xsl:apply-templates select="default-namespace"/>
      <xsl:apply-templates select="remark"/>
      <!-- create an instance on OntologySubset for each subsetdef -->
      <!-- OntologySubsets can be applied to multiple ontologies
           - they are not specific to the ontology -->
      <xsl:apply-templates select="subsetdef"/>
      <rdfs:label>
        <xsl:value-of select="default-namespace"/>
      </rdfs:label>
      <rdfs:comment>
        <xsl:text>
          This is an OWL translation of an ontology whose native representational form is .obo. The translation was performed using the oboInOwl xslt library. For details, see http://www.berkeleybop.org/obo-conv.cgi
        </xsl:text>
      </rdfs:comment>
    </owl:Ontology>

    
  </xsl:template>

  <!-- *********************************************** -->
  <!-- Terms/classes -->
  <!-- *********************************************** -->

  <xsl:template match="term">
    <owl:Class>
      <xsl:apply-templates select="id"/>
      <xsl:apply-templates select="name"/>
      <xsl:apply-templates select="comment"/>
      <xsl:apply-templates select="subset"/>
      <xsl:apply-templates select="def"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="consider|replaced_by"/>
      <xsl:apply-templates select="namespace"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog|xref"/>
      <xsl:apply-templates select="lexical_category"/>
      <xsl:apply-templates select="is_a"/>
      <xsl:apply-templates select="relationship"/>
      <xsl:apply-templates select="property_value"/>
      <xsl:apply-templates select="disjoint_from"/>

      <!-- we treat obsoletes as subclasses of the obsolete class;
           although they are not truly classes, we must treat them as
           such to avoid falling into OWL full when we have documents
           including out-of-date annotations to obsolete terms -->
      <xsl:if test="is_obsolete='1'">
        <rdfs:subClassOf rdf:resource="&oboInOwl;ObsoleteClass"/>
      </xsl:if>

      <!-- logical definitions -->
      <xsl:if test="count(intersection_of)>0">
        <owl:equivalentClass>
          <owl:Class>
            <owl:intersectionOf>
              <xsl:attribute name="rdf:parseType">Collection</xsl:attribute>
              <xsl:apply-templates select="intersection_of"/>
            </owl:intersectionOf>
          </owl:Class>
        </owl:equivalentClass>
      </xsl:if>

      <xsl:if test="count(union_of)>0">
        <owl:equivalentClass>
          <owl:Class>
            <owl:unionOf>
              <xsl:attribute name="rdf:parseType">Collection</xsl:attribute>
              <xsl:apply-templates select="union_of"/>
            </owl:unionOf>
          </owl:Class>
        </owl:equivalentClass>
      </xsl:if>
    </owl:Class>
  </xsl:template>

  <xsl:template match="is_a">
    <!-- by default we exclude inferred is_a relations -->
    <!-- this is mostly used for obol output -->
    <xsl:if test="not(@novel_inferred) and not(@problematic_inferred)">
      <rdfs:subClassOf>
        <xsl:apply-templates mode="resource" select="."/>
      </rdfs:subClassOf>
    </xsl:if>
    <xsl:variable name="is_a">
      <xsl:value-of select="."/>
    </xsl:variable>
    <xsl:variable name="this_id">
      <xsl:value-of select="../id"/>
    </xsl:variable>
    <!-- experimental tag : so far implemented by CARO -->
    <xsl:if test="/obo/header/pairwise-disjoint='true'">
      <!-- 
           this search is perhaps inefficient; we could use a key
           here, but keys are prohibitively expensive on large ontologies
           -->
      <xsl:for-each select="//term[is_a=$is_a]/id">
        <xsl:if test=".!=$this_id">
          <owl:disjointWith>
            <xsl:apply-templates mode="resource" select="."/>
          </owl:disjointWith>
        </xsl:if>
      </xsl:for-each>
    </xsl:if>
  </xsl:template>

  <xsl:template match="relationship">
    <!-- 
    <xsl:choose>
      <xsl:when test="key('k_relation',type)/is_class_level = '1'">
        <xsl:apply-templates mode="triple" select="."/>
      </xsl:when>
      <xsl:otherwise>
        <rdfs:subClassOf>
          <xsl:apply-templates mode="restriction" select="."/>      
        </rdfs:subClassOf>
      </xsl:otherwise>
    </xsl:choose>
    -->
    <rdfs:subClassOf>
      <xsl:apply-templates mode="restriction" select="."/>      
    </rdfs:subClassOf>
  </xsl:template>
    
  <!-- *** DL Constructs *** -->
  <!-- currently we support intersection_of, union_of -->
  <!-- TODO: disjoint_from, complement_of -->

  <xsl:template match="intersection_of">
    <xsl:choose>
      <!-- genus -->
      <!-- some species of obo use is_a(X) in intersection list -->
      <xsl:when test="type='is_a' or not(type)">
        <owl:Class>
          <xsl:apply-templates mode="about" select="to"/>
        </owl:Class>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates mode="restriction" select="."/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
    
  <!-- TODO -->
  <xsl:template match="union_of">
    <owl:Class>
      <xsl:apply-templates mode="about" select="to"/>
    </owl:Class>
  </xsl:template>
    
  <xsl:template match="disjoint_from">
    <owl:disjointWith>
      <xsl:apply-templates mode="resource" select="."/>
    </owl:disjointWith>
  </xsl:template>
    
  <xsl:template mode="restriction" match="*">
    <xsl:choose>
      <xsl:when test="key('k_relation',type)/is_metadata_tag = '1'">
	<!-- TODO -->
      </xsl:when>
      <xsl:otherwise>
	<owl:Restriction>
	  <!-- only used if relationship is reified -->
	  <xsl:apply-templates select="@id"/>
	  <owl:onProperty>
            <owl:ObjectProperty>
              <xsl:choose>
		<xsl:when test="key('k_relation',type)/all_some">
		  <xsl:apply-templates mode="about" select="key('k_relation',type)/all_some"/>
		</xsl:when>
		<xsl:otherwise>
		  <xsl:apply-templates mode="about" select="type"/>
		</xsl:otherwise>
              </xsl:choose>
	      
            </owl:ObjectProperty>
	  </owl:onProperty>
	  <xsl:choose>
            <xsl:when test="key('k_instance',to)">
              <owl:hasValue>
		<xsl:apply-templates mode="resource" select="to"/>
              </owl:hasValue>
            </xsl:when>
            <xsl:otherwise>
              <!-- TODO: For now we make the assumption that all relations
		   are existential (this is the case for all OBO relations)
		   may not be the case for non-foundry ontologies -->
              <owl:someValuesFrom>
		<xsl:apply-templates mode="resource" select="to"/>
              </owl:someValuesFrom>
            </xsl:otherwise>
	  </xsl:choose>
	</owl:Restriction>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- full expansion happens as a separate post-processor -->
  <xsl:template match="expand_expression_to">
    <newobo:IAO_0000424>
      <xsl:value-of select="."/>
    </newobo:IAO_0000424>
  </xsl:template>

  <xsl:template match="expand_assertion_to">
    <newobo:IAO_0000425>
      <xsl:value-of select="."/>
    </newobo:IAO_0000425>
  </xsl:template>

  <xsl:template match="def">
    <oboInOwl:hasDefinition>
      <oboInOwl:Definition>
        <xsl:apply-templates mode="label" select="defstr"/>
        <xsl:apply-templates select="dbxref"/>
      </oboInOwl:Definition>
    </oboInOwl:hasDefinition>
  </xsl:template>

  <xsl:template match="comment">
    <rdfs:comment rdf:datatype="&xsd;string">
      <xsl:value-of select="."/>
    </rdfs:comment>
  </xsl:template>

  <xsl:template match="namespace">
    <xsl:if test=".!='unknown'">
      <oboInOwl:hasOBONamespace>
        <xsl:value-of select="."/>
      </oboInOwl:hasOBONamespace>
    </xsl:if>
  </xsl:template>
  
  <xsl:template match="alt_id">
    <oboInOwl:hasAlternativeId>
      <xsl:value-of select="."/>
    </oboInOwl:hasAlternativeId>
  </xsl:template>
  
  <xsl:template match="lexical_category">
    <oboInOwl:hasLexicalCategory>
      <xsl:value-of select="."/>
    </oboInOwl:hasLexicalCategory>
  </xsl:template>

  <xsl:template match="subset">
    <oboInOwl:inSubset>
      <xsl:apply-templates mode="resource" select="."/>
    </oboInOwl:inSubset>
  </xsl:template>

  <xsl:template match="consider">
    <oboInOwl:consider>
      <xsl:apply-templates mode="resource" select="."/>
    </oboInOwl:consider>
  </xsl:template>

  <xsl:template match="replaced_by">
    <oboInOwl:replacedBy>
      <xsl:apply-templates mode="resource" select="."/>
    </oboInOwl:replacedBy>
  </xsl:template>

  <!-- *********************************************** -->
  <!-- Relations -->
  <!-- *********************************************** -->

  <!-- In obo-xml, relations and datatype properties are confusingly
       called "typedef" - the reasons for this are historical -->
  <!-- These all map to owl properties -->

  <!-- TODO:
       Relation properties:

       symmetric, anti_symmetric, reflexive

       Transitive over (not yet supported in OWL 1.0 but supported in
       obo 
-->
  
  <xsl:template match="typedef">
    <xsl:choose>
      <xsl:when test="is_transitive=1">
        <xsl:element name="owl:TransitiveProperty">
          <xsl:apply-templates mode="detail" select="."/>
        </xsl:element>
      </xsl:when>
      <xsl:when test="is_metadata_tag=1">
        <xsl:element name="owl:AnnotationProperty">
          <xsl:apply-templates mode="detail" select="."/>
        </xsl:element>
      </xsl:when>
      <xsl:when test="contains(range,'xsd:')">
        <xsl:element name="owl:DatatypeProperty">
          <xsl:apply-templates mode="detail" select="."/>
        </xsl:element>
      </xsl:when>
      <xsl:otherwise>
        <!-- TODO: datatype properties -->
        <xsl:element name="owl:ObjectProperty">
          <xsl:apply-templates mode="detail" select="."/>
        </xsl:element>
      </xsl:otherwise>
    </xsl:choose>

  </xsl:template>

  <xsl:template mode="detail" match="typedef">

    <!-- most of the following are the same as for terms/classes -->
    <xsl:apply-templates select="id"/>
    <xsl:apply-templates select="name"/>
    <xsl:apply-templates select="inverse_of|inverse_of_on_instance_level"/>
    <xsl:apply-templates select="domain"/>
    <xsl:apply-templates select="range"/>
    <xsl:apply-templates select="comment"/>
    <xsl:apply-templates select="subset"/>
    <xsl:apply-templates select="def"/>
    <xsl:apply-templates select="synonym"/>
    <xsl:apply-templates select="namespace"/>
    <xsl:apply-templates select="alt_id"/>
    <xsl:apply-templates select="xref_analog|xref"/>
    <xsl:apply-templates select="lexical_category"/>
    <xsl:apply-templates select="expands_to|expand_expression_to|expand_assertion_to"/>

    <xsl:if test="is_symmetric=1">
      <rdf:type rdf:resource="&owl;SymmetricProperty"/>
    </xsl:if>
    <xsl:if test="is_functional=1">
      <rdf:type rdf:resource="&owl;FunctionalProperty"/>
    </xsl:if>

    <!-- reflexivity in OWL is stronger than OBO -->
    <!--
    <xsl:if test="is_reflexive=1">
      <rdf:type rdf:resource="&owl;ReflexiveProperty"/>
    </xsl:if>
    -->

    <xsl:if test="is_obsolete='1'">
      <rdfs:subPropertyOf rdf:resource="&oboInOwl;ObsoleteProperty"/>
    </xsl:if>

    <!-- is_a is used for both subClassOf and subPropertyOf -->
    <xsl:for-each select="is_a">
      <rdfs:subPropertyOf>
        <xsl:apply-templates mode="resource" select="."/>
      </rdfs:subPropertyOf>
    </xsl:for-each>
    <xsl:apply-templates select="property_value"/>

    <xsl:for-each select="transitive_over">
      <owl:propertyChainAxiom rdf:parseType="Collection">
        <rdf:Description>
          <xsl:apply-templates mode="about" select="../id"/>
        </rdf:Description>
        <rdf:Description>
          <xsl:apply-templates mode="about" select="."/>
        </rdf:Description>
      </owl:propertyChainAxiom>
    </xsl:for-each>
    
    <xsl:for-each select="(holds_over_chain|equivalent_to_chain)">
      <owl:propertyChainAxiom rdf:parseType="Collection">
        <xsl:for-each select="relation">
          <rdf:Description>
            <xsl:apply-templates mode="about" select="."/>
          </rdf:Description>
        </xsl:for-each>
      </owl:propertyChainAxiom>
    </xsl:for-each>

  </xsl:template>

  <xsl:template match="inverse_of|inverse_of_on_instance_level">
    <owl:inverseOf>
      <xsl:apply-templates mode="resource" select="."/>
    </owl:inverseOf>
  </xsl:template>

  <xsl:template match="domain">
    <rdfs:domain>
      <xsl:apply-templates mode="resource" select="."/>
    </rdfs:domain>
  </xsl:template>

  <xsl:template match="range">
    <rdfs:range>
      <xsl:apply-templates mode="resource" select="."/>
    </rdfs:range>
  </xsl:template>


  <!-- *********************************************** -->
  <!-- Instances -->
  <!-- *********************************************** -->

  <xsl:template match="instance">
    <xsl:element name="rdf:Description">
      <xsl:apply-templates select="id"/>
      <xsl:apply-templates select="instance_of"/>
      <xsl:apply-templates select="name"/>
      <xsl:apply-templates select="namespace"/>
      <xsl:apply-templates select="property_value"/>
      <xsl:apply-templates select="relationship" mode="instance"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="instance_of">
    <rdf:type>
      <xsl:apply-templates mode="resource" select="."/>
    </rdf:type>
  </xsl:template>

  <xsl:template match="property_value">
    <xsl:variable name="property">
      <xsl:choose>
        <xsl:when test="contains(type,':')">
          <xsl:value-of select="substring-after(type,':')"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>obo:</xsl:text>
          <xsl:value-of select="type"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:element name="{$property}">
      <xsl:choose>
        <xsl:when test="datatype">
          <xsl:attribute name="rdf:datatype">
            <xsl:value-of select="datatype"/>
          </xsl:attribute>
          <xsl:value-of select="value"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates mode="resource" select="to"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:element>
  </xsl:template>

  <xsl:template match="OLD__property_value">
    <xsl:variable name="property">
      <xsl:choose>
        <xsl:when test="contains(type,':')">
          <xsl:value-of select="substring-after(type,':')"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="type"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:element name="{$property}">
      <xsl:if test="contains(type,':')">
        <xsl:attribute name="xmlns">
          <xsl:variable name="ns">
            <xsl:value-of select="substring-before(type,':')"/>
          </xsl:variable>
          <xsl:choose>
            <xsl:when test="key('k_idspace',$ns)">
              <xsl:value-of select="key('k_idspace',$ns)/global"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>&oboContent;</xsl:text>
              <xsl:value-of select="$ns"/>
              <xsl:text>#</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:attribute>
      </xsl:if>
      <xsl:choose>
        <xsl:when test="datatype">
          <xsl:attribute name="rdf:datatype">
            <xsl:value-of select="datatype"/>
          </xsl:attribute>
          <xsl:value-of select="value"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates mode="resource" select="to"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:element>
  </xsl:template>


  <xsl:template match="relationship" mode="instance">
    <xsl:variable name="property">
      <xsl:choose>
        <xsl:when test="contains(type,':')">
          <xsl:value-of select="substring-after(type,':')"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:text>obo:</xsl:text>
          <xsl:value-of select="type"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:element name="{$property}">
      <xsl:if test="contains(type,':')">
        <xsl:attribute name="xmlns">
          <xsl:variable name="ns">
            <xsl:value-of select="substring-before(type,':')"/>
          </xsl:variable>
          <xsl:choose>
            <xsl:when test="key('k_idspace',$ns)">
              <xsl:value-of select="key('k_idspace',$ns)/global"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>&oboContent;</xsl:text>
              <xsl:value-of select="$ns"/>
              <xsl:text>#</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:attribute>
      </xsl:if>
      <xsl:choose>
        <xsl:when test="datatype">
          <xsl:attribute name="rdf:datatype">
            <xsl:value-of select="datatype"/>
          </xsl:attribute>
          <xsl:value-of select="value"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates mode="resource" select="to"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:element>
  </xsl:template>

  <!-- *********************************************** -->
  <!-- Annotations -->
  <!-- *********************************************** -->
  <!-- We treat obo annotations as reified links for now.
       Future versions may use Named Graphs-->
  <xsl:template match="annotation">
    <oban:Annotation>
      <oban:subject>
        <xsl:apply-templates mode="resource" select="subject"/>
      </oban:subject>
      <oban:object>
        <xsl:apply-templates mode="resource" select="subject"/>
      </oban:object>
    </oban:Annotation>
  </xsl:template>
    
  <!-- *********************************************** -->
  <!-- Identifiers -->
  <!-- *********************************************** -->

  <!-- RDF stuff -->
  <xsl:template match="id">
    <xsl:attribute name="rdf:about">
      <xsl:apply-templates mode="translate-id" select="."/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template match="@id">
    <xsl:attribute name="rdf:about">
      <xsl:apply-templates mode="translate-id" select="."/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template mode="resource" match="*">
    <xsl:attribute name="rdf:resource">
      <xsl:apply-templates mode="translate-id" select="."/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template mode="about" match="*">
    <xsl:attribute name="rdf:about">
      <xsl:apply-templates mode="translate-id" select="."/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template mode="translate-id" match="@*|*">

    <!-- split the bipartite OBO ID in two -
         -->
    <xsl:variable name="idspace">
      <xsl:value-of select="substring-before(.,':')"/>
    </xsl:variable>
    <xsl:variable name="localid">
      <xsl:value-of select="substring-after(.,':')"/>
    </xsl:variable>

    <!-- handle the ID based on its content -->
    <xsl:choose>

      <!-- anonymous classes -
           denoted by an IDSpace of a single underscore -->
      <xsl:when test="$idspace = '_'">
        <xsl:value-of select="$localid"/>
      </xsl:when>

      <xsl:when test="contains(.,'^')">
        <xsl:text>&oboContent;</xsl:text>
	<xsl:call-template name="url-encode">
	  <xsl:with-param name="str" select="."/>
	</xsl:call-template>
      </xsl:when>

      <xsl:when test="contains('0123456789',substring(.,1,1))">
        <xsl:text>&oboContent;</xsl:text>
	<xsl:call-template name="url-encode">
	  <xsl:with-param name="str" select="."/>
	</xsl:call-template>
      </xsl:when>

      <!-- builtin -->
      <xsl:when test="$idspace = 'xsd'">
        <xsl:text>&xsd;</xsl:text>
        <xsl:value-of select="$localid"/>
      </xsl:when>

      <!-- is the idspace mapped in the header of the file? -->
      <xsl:when test="key('k_idspace',substring-before(.,':'))">
        <xsl:value-of select="key('k_idspace',substring-before(.,':'))/global"/>
        <xsl:if test="$localid_prefix">
          <xsl:value-of select="$localid_prefix"/>
        </xsl:if>
        <xsl:value-of select="substring-after(.,':')"/>
      </xsl:when>

      <!-- idspace is specified, but not mapped in the header -->
      <xsl:when test="substring-before(.,':')">
        <xsl:choose>
          <xsl:when test="key('k_idspace','*')">
            <!-- NEW-STYLE -->
            <xsl:value-of select="key('k_idspace','*')/global"/>
            <xsl:value-of select="$idspace"/>
            <xsl:text>_</xsl:text>
            <xsl:value-of select="substring-after(.,':')"/>
          </xsl:when>
          <xsl:otherwise>
            <!-- OLD-STYLE -->
            <xsl:text>&oboContent;</xsl:text>
            <xsl:value-of select="$idspace"/>
            <xsl:text>#</xsl:text>
            <xsl:if test="number(substring($localid,1,1)) or substring($localid,1,1)='0'">
              <xsl:value-of select="$idspace"/>
              <xsl:text>_</xsl:text>
            </xsl:if>
            <xsl:if test="$localid_prefix">
              <xsl:value-of select="$localid_prefix"/>
            </xsl:if>
            <xsl:value-of select="substring-after(.,':')"/>
          </xsl:otherwise>

        </xsl:choose>
      </xsl:when>

      <!-- no idspace: ID is flat (eg part_of) -->

      <!-- first we check if this ID is for a relation, and that relation is in OBO_REL -->
      <xsl:when test="key('k_relation',.)/xref_analog/dbname = 'OBO_REL'">
        <xsl:variable name="new-id">
          <xsl:value-of select="key('k_relation',.)/xref_analog[dbname='OBO_REL']/acc"/>
        </xsl:variable>
        <xsl:choose>
          <!-- is the idspace mapped? -->
          <xsl:when test="key('k_idspace','OBO_REL')">
            <xsl:value-of select="key('k_idspace',substring-before(.,':'))/global"/>
            <xsl:value-of select="$new-id"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>&oboContent;</xsl:text>
            <xsl:text>OBO_REL#</xsl:text>
            <xsl:value-of select="$new-id"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>

      <xsl:when test="key('k_relation',.)/xref_analog/dbname = 'BFO'">
        <xsl:variable name="new-id">
          <xsl:value-of select="key('k_relation',.)/xref_analog[dbname='BFO']/acc"/>
        </xsl:variable>
        <xsl:text>&BFO;</xsl:text>
        <xsl:value-of select="$new-id"/>
      </xsl:when>

      <xsl:when test="key('k_relation',.)/xref_analog/dbname = 'RO'">
        <xsl:variable name="new-id">
          <xsl:value-of select="key('k_relation',.)/xref_analog[dbname='RO']/acc"/>
        </xsl:variable>
        <xsl:text>&RO;</xsl:text>
        <xsl:value-of select="$new-id"/>
      </xsl:when>

      <!-- flat ID, not in OBO_REL -->
      <xsl:otherwise>
        <xsl:text>&oboContent;</xsl:text>
        <xsl:choose>
          <xsl:when test="$localid_prefix">
            <xsl:value-of select="$localid_prefix"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>obo#</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:value-of select="."/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>


  <!-- *********************************************** -->
  <!-- http://skew.org/xml/stylesheets/url-encode/url-encode.xsl -->

  <xsl:variable name="ascii">
    !"#$%'()*+,-./0123456789:;&lt;=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~
  </xsl:variable>

  <xsl:variable name="safe">!'()*-.0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~</xsl:variable>
  <xsl:variable name="hex">0123456789ABCDEF</xsl:variable>

  <xsl:template name="url-encode">
    <xsl:param name="str"/>
    <xsl:if test="$str">
      <xsl:variable name="first-char" select="substring($str,1,1)"/>
      <xsl:choose>
	<xsl:when test="contains($safe,$first-char)">
	  <xsl:value-of select="$first-char"/>
	</xsl:when>
	<xsl:otherwise>
	  <xsl:variable name="codepoint">
	    <xsl:choose>
	      <xsl:when test="contains($ascii,$first-char)">
		<xsl:value-of select="string-length(substring-before($ascii,$first-char)) + 32"/>
	      </xsl:when>
	      <xsl:otherwise>
		<xsl:message terminate="no">
		  Warning: string contains a character that is out of range! Substituting "?".
		</xsl:message>
		<xsl:text>63</xsl:text>
	      </xsl:otherwise>
	    </xsl:choose>
	  </xsl:variable>
	  <xsl:variable name="hex-digit1" select="substring($hex,floor($codepoint div 16) + 1,1)"/>
	  <xsl:variable name="hex-digit2" select="substring($hex,$codepoint mod 16 + 1,1)"/>
	  <xsl:value-of select="concat('%',$hex-digit1,$hex-digit2)"/>
	</xsl:otherwise>
      </xsl:choose>
      <xsl:if test="string-length($str) > 1">
	<xsl:call-template name="url-encode">
	  <xsl:with-param name="str" select="substring($str,2)"/>
	</xsl:call-template>
      </xsl:if>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>

