<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output indent="yes" method="text"/>

  <xsl:key name="terms" match="term" use="id"/>

  <xsl:template mode="id" match="*">
    <xsl:value-of select="translate(.,':','_')"/>
  </xsl:template>

  <xsl:template match="/">
    <!-- ******** -->
    <!-- ONTOLOGY -->
    <!-- ******** -->

    <xsl:text>(in-knowledge-base test x-test)&#10;&#10;</xsl:text>
    <xsl:text>(signature :atomic-concepts (</xsl:text>
    <xsl:for-each select="obo/term">
    <xsl:text>&#10;            </xsl:text>
      <xsl:apply-templates mode="id" select="id"/>
      <xsl:text> </xsl:text>
    </xsl:for-each>
    <xsl:text>)&#10;   :roles (</xsl:text>
    <xsl:for-each select="obo/typedef">
      <xsl:text>&#10;            (</xsl:text>
      <xsl:apply-templates mode="id" select="id"/>
      <xsl:text>) </xsl:text>
    </xsl:for-each>
    <xsl:text>))&#10;</xsl:text>
    <xsl:apply-templates select="obo/term"/>

    <!-- ******* -->
    <!-- QUERIES -->
    <!-- ******* -->

    <!-- check existing predictions -->
    <xsl:for-each select="obo/term/is_a[@novel_inferred='true']">
      <xsl:text>(concept-subsumes? </xsl:text>
      <xsl:apply-templates mode="id" select="."/>
      <xsl:text> </xsl:text>
      <xsl:apply-templates mode="id" select="../id"/>
      <xsl:text>)&#10;</xsl:text>
    </xsl:for-each>

    <!-- check for new subsumptions -->
    <xsl:for-each select="obo/term">
      <xsl:text>(concept-ancestors </xsl:text>
      <xsl:apply-templates mode="id" select="id"/>
      <xsl:text>)&#10;</xsl:text>
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="term">
    <xsl:apply-templates select="is_a"/>
    <xsl:apply-templates select="relationship"/>
    <xsl:if test="count(intersection_of)>0">
      <xsl:text>(equivalent </xsl:text>
      <xsl:apply-templates mode="id" select="id"/>
      <xsl:text> (and </xsl:text>
      <xsl:apply-templates select="intersection_of"/>
      <xsl:text>))&#10;</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="is_a">
    <xsl:if test="not(@novel_inferred) and not(@problematic_inferred)">
      <xsl:text>(implies </xsl:text>
      <xsl:apply-templates mode="id" select="../id"/>
      <xsl:text> </xsl:text>
      <xsl:apply-templates mode="id" select="."/>
      <xsl:text>)&#10;</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="relationship">
      <xsl:text>(implies </xsl:text>
      <xsl:apply-templates mode="id" select="../id"/>
      <xsl:text> (some </xsl:text>
      <xsl:value-of select="type"/>
      <xsl:text> </xsl:text>
      <xsl:apply-templates mode="id" select="to"/>
      <xsl:text>))&#10;</xsl:text>
    
  </xsl:template>
    
  <xsl:template match="intersection_of">
    <xsl:text> </xsl:text>
    <xsl:choose>
      <xsl:when test="type='is_a'">
        <xsl:apply-templates mode="id" select="to"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>(some </xsl:text>
        <xsl:value-of select="type"/>
        <xsl:text> </xsl:text>
        <xsl:apply-templates mode="id" select="to"/>
        <xsl:text>)</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  
  <xsl:template match="text()|@*">
  </xsl:template>

</xsl:stylesheet>



