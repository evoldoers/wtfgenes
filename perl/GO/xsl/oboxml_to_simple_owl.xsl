<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" 
  xmlns:owl="http://www.w3.org/2002/07/owl#" 
  xml:base="http://www.geneontology.org/owl">
  
  <xsl:output indent="yes" method="xml"/>

  <xsl:key name="terms" match="term" use="id"/>

  <xsl:template match="/">
    <rdf:RDF
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" 
  xmlns:owl="http://www.w3.org/2002/07/owl#" 
  xmlns="http://www.geneontology.org/owl#" 
  xml:base="http://www.geneontology.org/owl">
      <owl:Ontology rdf:about=""/>
      <xsl:apply-templates select="obo/term"/>
      <xsl:apply-templates select="obo/typedef"/>
    </rdf:RDF>
  </xsl:template>

  <xsl:template match="term">
    <xsl:element name="owl:Class">
      <xsl:apply-templates mode="rdf-id" select="id"/>
      <rdfs:label xml:lang="en">
        <xsl:value-of select="name"/>
      </rdfs:label>
      <xsl:apply-templates select="def/defstr"/>
      <xsl:apply-templates select="is_a"/>
      <xsl:apply-templates select="relationship"/>
      <xsl:apply-templates mode="annotation" select="property_value"/>
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
    </xsl:element>
  </xsl:template>

  <xsl:template match="typedef">
    <xsl:choose>
      <xsl:when test="is_metadata_tag=1">
        <xsl:element name="owl:AnnotationProperty">
          <xsl:apply-templates mode="detail" select="."/>
        </xsl:element>
      </xsl:when>
      <xsl:when test="is_transitive=1">
        <xsl:element name="owl:TransitiveProperty">
          <xsl:apply-templates mode="detail" select="."/>
        </xsl:element>
      </xsl:when>
      <xsl:otherwise>
        <xsl:element name="owl:ObjectProperty">
          <xsl:apply-templates mode="detail" select="."/>
        </xsl:element>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template mode="detail" match="typedef">
      <xsl:apply-templates mode="rdf-id" select="id"/>
      <rdfs:label>
        <xsl:value-of select="name"/>
      </rdfs:label>
      <xsl:apply-templates select="def/defstr"/>
      <xsl:for-each select="is_a">
        <rdfs:subPropertyOf>
          <xsl:apply-templates mode="rdf-resource" select="."/>
        </rdfs:subPropertyOf>
      </xsl:for-each>
  </xsl:template>

  <xsl:template match="is_a">
    <xsl:if test="not(@novel_inferred) and not(@problematic_inferred)">
      <rdfs:subClassOf>
        <xsl:apply-templates mode="rdf-resource" select="."/>
      </rdfs:subClassOf>
    </xsl:if>
  </xsl:template>

  <xsl:template match="relationship">
    <rdfs:subClassOf>
      <xsl:apply-templates mode="restriction" select="."/>      
    </rdfs:subClassOf>
  </xsl:template>
    
  <xsl:template match="property_value" mode="annotation">
    <xsl:element name="{type}">
      <xsl:apply-templates mode="rdf-resource" select="to"/>
    </xsl:element>
  </xsl:template>
    
  <xsl:template match="intersection_of">
    <xsl:choose>
      <xsl:when test="type='is_a' or not(type)">
        <owl:Class>
          <xsl:apply-templates mode="rdf-about" select="to"/>
        </owl:Class>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates mode="restriction" select="."/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template mode="restriction" match="*">
    <owl:Restriction>
      <owl:onProperty>
        <owl:ObjectProperty>
          <xsl:apply-templates mode="rdf-about" select="type"/>
        </owl:ObjectProperty>
      </owl:onProperty>
      <owl:someValuesFrom>
        <xsl:apply-templates mode="rdf-resource" select="to"/>
      </owl:someValuesFrom>
    </owl:Restriction>
  </xsl:template>
  
  <xsl:template match="text()|@*">
  </xsl:template>

<xsl:template match="defstr">
	<rdfs:comment rdf:datatype="http://www.w3.org/2001/XMLSchema#string">
      		<xsl:value-of select="."/>
      </rdfs:comment>
</xsl:template>

  <!-- RDF stuff -->
  <xsl:template mode="rdf-id" match="*">
    <xsl:attribute name="rdf:ID">
      <xsl:value-of select="translate(.,':','_')"/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template mode="rdf-about" match="*">
    <xsl:attribute name="rdf:about">
      <xsl:text>#</xsl:text>
      <xsl:value-of select="translate(.,':','_')"/>
    </xsl:attribute>
  </xsl:template>

  <xsl:template mode="rdf-resource" match="*">
    <xsl:attribute name="rdf:resource">
      <xsl:text>#</xsl:text>
      <xsl:value-of select="translate(.,':','_')"/>
    </xsl:attribute>
  </xsl:template>

</xsl:stylesheet>



