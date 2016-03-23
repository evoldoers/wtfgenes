<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <!-- transforms OBO XML format to a simple tabular summary

       cjm 2004

       -->

  <xsl:output indent="yes" method="text"/>

  <xsl:template match="/">
    <xsl:text>#ID&#9;NAME&#9;NAMESPACE&#9;OBS&#9;IS_A&#9;REL&#9;DEF&#9;SYNS&#9;ALT-IDS&#9;XREFS&#10;</xsl:text>
    <xsl:apply-templates select="*/term"/>
  </xsl:template>

  <xsl:template match="term">
    <xsl:value-of select="id"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:value-of select="name"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:value-of select="namespace"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:choose>
      <xsl:when test="is_obsolete">
        <xsl:text>OBSOLETE</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>CURRENT</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:text>&#9;</xsl:text>
    <xsl:apply-templates select="is_a"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:apply-templates select="relationship"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:apply-templates select="def"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:apply-templates select="synonym"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:apply-templates select="alt_id"/>
    <xsl:text>&#9;</xsl:text>
    <xsl:apply-templates select="xref_analog"/>
    <xsl:text>&#10;</xsl:text>
  </xsl:template>

  <xsl:template match="is_a|alt_id">
    <xsl:value-of select="."/>
    <xsl:text>;</xsl:text>
  </xsl:template>

  <xsl:template match="relationship">
    <xsl:value-of select="type"/>
    <xsl:text>=</xsl:text>
    <xsl:value-of select="to"/>
    <xsl:text>;</xsl:text>
  </xsl:template>

  <xsl:template match="synonym">
    <xsl:value-of select="synonym_text"/>
  </xsl:template>

  <xsl:template match="def">
    <xsl:value-of select="defstr"/>
  </xsl:template>

  <xsl:template match="xref_analog">
    <xsl:value-of select="dbname"/>
    <xsl:text>:</xsl:text>
    <xsl:value-of select="acc"/>
    <xsl:text>;</xsl:text>
  </xsl:template>

  <xsl:template match="text()|@*">
  </xsl:template>


</xsl:stylesheet>



