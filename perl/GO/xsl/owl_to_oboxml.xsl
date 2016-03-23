<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" 
  xmlns:owl="http://www.w3.org/2002/07/owl#" 
  version="1.0"
  >

  <xsl:strip-space elements="*"/>
  <xsl:output method="xml" indent="yes"/>

  <xsl:template match="/">
    <obo>
      <xsl:apply-templates select="rdf:RDF"/>
    </obo>
  </xsl:template>
  <xsl:template match="rdf:RDF">
    <xsl:apply-templates select="owl:Ontology"/>
    <xsl:apply-templates select="owl:Class" mode="default"/>
    <xsl:apply-templates select="owl:ObjectProperty|owl:TransitiveProperty"/>
    <xsl:apply-templates select="owl:DatatypeProperty"/>
    <xsl:apply-templates select="owl:FunctionalProperty"/>
  </xsl:template>

  <xsl:template match="owl:Ontology">
    <header>
      <remark>
        <xsl:value-of select="rdfs:comment"/>
      </remark>
      <default_namespace>
        <xsl:value-of select="rdfs:label"/>
      </default_namespace>
    </header>
  </xsl:template>

  <xsl:template match="owl:ObjectProperty|owl:DatatypeProperty|owl:FunctionalProperty|owl:TransitiveProperty">
    <typedef>
      <id>
        <xsl:value-of select="substring-after(@rdf:about,'#')"/>
        <xsl:value-of select="@rdf:ID"/>        
      </id>
      <name>
        <xsl:choose>
          <xsl:when test="rdfs:label">
            <xsl:value-of select="rdfs:label"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="@rdf:ID"/>
          </xsl:otherwise>
        </xsl:choose>
      </name>
      <xsl:if test="name(..) = 'owl:TransitiveProperty'">
        <is_transitive>true</is_transitive>
      </xsl:if>
      <xsl:apply-templates select="rdfs:subPropertyOf"/>
      <xsl:apply-templates select="rdfs:domain"/>
      <xsl:apply-templates select="rdfs:range"/>
      <xsl:apply-templates mode="namespace" select="../owl:Ontology"/>
    </typedef>
  </xsl:template>

  <xsl:template match="rdfs:comment">
    <comment>
      <xsl:value-of select="."/>
    </comment>
  </xsl:template>

  <xsl:template match="rdfs:subPropertyOf">
    <is_a>
      <xsl:value-of select="substring-after(owl:Class/@rdf:about,'#')"/>
      <xsl:value-of select="substring-after(@rdf:resource,'#')"/>
      <xsl:value-of select="owl:Class/@rdf:ID"/>
    </is_a>
  </xsl:template>

  <xsl:template match="rdfs:domain">
    <domain>
      <xsl:value-of select="substring-after(owl:Class/@rdf:about,'#')"/>
      <xsl:value-of select="substring-after(@rdf:resource,'#')"/>
      <xsl:value-of select="owl:Class/@rdf:ID"/>
    </domain>
  </xsl:template>

  <xsl:template match="rdfs:range">
    <range>
      <xsl:value-of select="substring-after(owl:Class/@rdf:about,'#')"/>
      <xsl:value-of select="substring-after(@rdf:resource,'#')"/>
      <xsl:value-of select="owl:Class/@rdf:ID"/>
    </range>
  </xsl:template>

  <!-- map owl:Class to term -->
  <xsl:template match="owl:Class" mode="default">
    <term>
      <id>
        <xsl:value-of select="substring-after(@rdf:about,'#')"/>
        <xsl:value-of select="@rdf:ID"/>
      </id>
      <name>
        <xsl:choose>
          <xsl:when test="rdfs:label">
            <xsl:value-of select="rdfs:label"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="@rdf:ID"/>
          </xsl:otherwise>
        </xsl:choose>
      </name>
      <!-- both normal subclasses and restrictions are under subclass -->
      <xsl:apply-templates select="owl:equivalentClass"/>
      <xsl:apply-templates select="owl:intersectionOf"/>
      <xsl:apply-templates select="rdfs:subClassOf"/>
      <xsl:apply-templates select="owl:disjointWith"/>
      <xsl:apply-templates mode="namespace" select="../owl:Ontology"/>
    </term>
  </xsl:template>

  <xsl:template match="*" mode="namespace">
    <xsl:if test="rdfs:label">
      <namespace>
        <xsl:value-of select="rdfs:label"/>
      </namespace>
    </xsl:if>
  </xsl:template>

  <!-- embedded in equivalentClass -->
  <xsl:template match="owl:Class" mode="in-equiv">
    <xsl:apply-templates select="owl:intersectionOf"/>
  </xsl:template>

  <!-- equivalentClass -->
  <xsl:template match="owl:equivalentClass">
    <xsl:apply-templates select="owl:Class" mode="in-equiv"/>
    
    <!-- restrictions may be inside equivalentClass -->
    <xsl:apply-templates select="owl:Restriction"/>
  </xsl:template>



  <!-- is_as and relationships -->
  <xsl:template match="rdfs:subClassOf">
    <xsl:choose>
      <xsl:when test="not(owl:Restriction)">
        <is_a>
          <xsl:value-of select="substring-after(owl:Class/@rdf:about,'#')"/>
          <xsl:value-of select="substring-after(@rdf:resource,'#')"/>
          <xsl:value-of select="owl:Class/@rdf:ID"/>
        </is_a>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates select="owl:Restriction"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- map owl:Restriction to relationships -->
  <xsl:template match="owl:Restriction">

    <!-- restrictions may be object, datatype or functional properties -->

    <!-- ObjectProperty - normal obo relationship -->
    <xsl:if test="owl:onProperty/owl:ObjectProperty">
      <relationship>
        <type>
          <!-- rdf:about or rdf:ID can be used -->
          <xsl:value-of select="owl:onProperty/owl:ObjectProperty/@rdf:ID"/>
          <xsl:value-of select="substring-after(owl:onProperty/owl:ObjectProperty/@rdf:about,'#')"/>
          <xsl:value-of select="substring-after(owl:onProperty/owl:ObjectProperty/@rdf:resource,'#')"/>
        </type>
        <xsl:apply-templates select="owl:allValuesFrom|owl:someValuesFrom|owl:hasValue"/>
        <xsl:apply-templates select="owl:maxCardinality"/>
      </relationship>
    </xsl:if>

    <!-- Functional Property -->
    <xsl:if test="owl:onProperty/owl:FunctionalProperty">
      <functional_property>
        <type>
          <!-- rdf:about or rdf:ID can be used -->
          <xsl:value-of select="owl:onProperty/owl:FunctionalProperty/@rdf:ID"/>
          <xsl:value-of select="substring-after(owl:onProperty/owl:FunctionalProperty/@rdf:about,'#')"/>
          <xsl:value-of select="substring-after(owl:onProperty/owl:FunctionalProperty/@rdf:resource,'#')"/>
        </type>
        <xsl:apply-templates select="owl:allValuesFrom|owl:someValuesFrom|owl:hasValue"/>
        <xsl:apply-templates select="owl:maxCardinality"/>
      </functional_property>
    </xsl:if>

    <xsl:if test="owl:onProperty/owl:DatatypeProperty">
      <xsl:comment>
        ignoring datatype property
        <xsl:value-of select="substring-after(owl:onProperty/owl:DatatypeProperty/@rdf:about,'#')"/>
        <xsl:text>&#10;</xsl:text>
      </xsl:comment>
    </xsl:if>
  </xsl:template>

  <xsl:template match="owl:allValuesFrom|owl:someValuesFrom">
    <to>
      <xsl:apply-templates mode="resolve-id" select="."/>
    </to>
  </xsl:template>

  <xsl:template match="owl:hasValue">
    <to>
      <xsl:value-of select="*/@rdf:ID"/>
      <xsl:value-of select="substring-after(*/@rdf:about,'#')"/>    
      <xsl:value-of select="substring-after(@rdf:resource,'#')"/>    
      <xsl:value-of select="@rdf:datatype"/>    
    </to>
  </xsl:template>

  <xsl:template match="owl:maxCardinality">
    <max_cardinality>
      <xsl:value-of select="."/>
    </max_cardinality>
  </xsl:template>

  <xsl:template match="owl:intersectionOf">
    <xsl:for-each select="owl:Class">
      <intersection_of>
        <type>is_a</type>
        <to>
          <xsl:apply-templates mode="resolve-id" select="."/>
        </to>
      </intersection_of>            
    </xsl:for-each>
    <xsl:for-each select="owl:Restriction">
      <intersection_of>
        <type>
          <xsl:choose>
            <!-- todo: not exhaustive enough -->
            <xsl:when test="owl:onProperty/owl:ObjectProperty">
              <xsl:apply-templates mode="resolve-id" select="owl:onProperty/owl:ObjectProperty"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:apply-templates mode="resolve-id" select="owl:onProperty"/>
            </xsl:otherwise>
          </xsl:choose>
        </type>
        <to>
          <!-- warning!! currently obo does not distinguish existential/universal -->
          <xsl:choose>
            <xsl:when test="owl:allValuesFrom|owl:someValuesFrom|owl:hasValue">
              <xsl:apply-templates mode="resolve-id" 
                select="owl:allValuesFrom|owl:someValuesFrom|owl:hasValue"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:message terminate="yes">
                <xsl:text>relationship to unresolvable</xsl:text>
                <xsl:copy-of select="."/>
              </xsl:message>
            </xsl:otherwise>
          </xsl:choose>
        </to>
      </intersection_of>            
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="owl:disjointWith">
    <disjoint_with>
      <xsl:apply-templates mode="resolve-id" select="owl:Class"/>
    </disjoint_with>
  </xsl:template>

  <xsl:template mode="resolve-id" match="*|@*">
    <xsl:choose>
      <!-- multiple ways of refering to something -->
      <xsl:when test="owl:Class">
        <!-- class object - recursively resolve -->
        <xsl:apply-templates mode="resolve-id" select="owl:Class"/>
      </xsl:when>
      <xsl:when test="@rdf:ID">
        <xsl:value-of select="@rdf:ID"/>
      </xsl:when>
      <xsl:when test="substring-after(@rdf:about,'#')">
        <xsl:value-of select="substring-after(@rdf:about,'#')"/>
      </xsl:when>
      <xsl:when test="substring-after(@rdf:resource,'#')">    
        <xsl:value-of select="substring-after(@rdf:resource,'#')"/>    
      </xsl:when>
      <xsl:otherwise>
        <xsl:message>
          <xsl:text>Cannot resolve ID: </xsl:text>
          <xsl:copy-of select="."/>
        </xsl:message>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
