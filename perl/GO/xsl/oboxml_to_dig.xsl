<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" 
  xmlns="http://dl.kr.org/dig/lang">
  
</xsl:stylesheet>

  <xsl:output indent="yes" method="xml"/>

  <xsl:key name="terms" match="term" use="id"/>

  <xsl:template match="/">
    <tells   xmlns="http://dl.kr.org/dig/lang">
      <clearKB\>
      <xsl:apply-templates select="obo/term"/>
      <xsl:apply-templates select="obo/typedef"/>
    </rdf:RDF>
  </xsl:template>

  <xsl:template match="term">
    <defconcept>
      <xsl:attribute name="name">
        <xsl:value-of select="id"/>        
      </xsl:attribute>
    </defconcept>
    <xsl:apply-templates select="is_a"/>
    <xsl:apply-templates select="relationship"/>
    <xsl:if test="count(intersection_of)>0">
      <equalc>
        <catom>
          <xsl:attribute name="name">
            <xsl:value-of select="id"/>                    
          </xsl:attribute>
        </catom>
        <and>
          <xsl:apply-templates select="intersection_of"/>
        </and>
      </equalc>
    </xsl:if>
  </xsl:template>

  <xsl:template match="typedef">
    <defrole>
      <xsl:attribute name="name">
        <xsl:value-of select="id"/>        
      </xsl:attribute>
    </defrole>
  </xsl:template>

  <xsl:template match="is_a">
    <xsl:if test="not(@novel_inferred) and not(@problematic_inferred)">
      <xsl:comment>
        <xsl:text> </xsl:text>
        <xsl:value-of select="key('terms',.)/name"/>
        <xsl:text> </xsl:text>
      </xsl:comment>
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
    
  <xsl:template match="intersection_of">
    <xsl:choose>
      <xsl:when test="type='is_a'">
        <catom>
          <xsl:attribute name="name">
            <xsl:value-of select="to"/>                    
          </xsl:attribute>
        </catom>
      </xsl:when>
      <xsl:otherwise>
        <some>
          <ratom>
            <xsl:attribute name="name">
              <xsl:value-of select="type"/>
            </xsl:attribute>
          </ratom>
          <iset>
            <atom>
              <xsl:attribute name="name">
                <xsl:value-of select="to"/>
              </xsl:attribute>
            </atom>
          </iset>
        </some>
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
    <xsl:comment>
      <xsl:text> </xsl:text>
      <xsl:value-of select="key('terms', to)/name"/>
      <xsl:text> </xsl:text>
    </xsl:comment>
  </xsl:template>
  
  <xsl:template match="text()|@*">
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



