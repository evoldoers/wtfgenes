<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  version="1.0">

  <xsl:strip-space elements="*"/>
  <xsl:output method="xml" indent="yes"/>

  <xsl:template match="/">
    <obo>
      <xsl:apply-templates select="//interpro"/>
    </obo>
  </xsl:template>
  <xsl:template match="interpro">
    <term>
      <id>
        <xsl:text>InterPro:</xsl:text><xsl:value-of select="@id"/>
      </id>
      <name>
        <xsl:value-of select="name"/>
      </name>
      <!-- abstract is mixed attribute xml; need to convert. how?
           -->
       <xsl:apply-templates select="parent_list"/>
      <xsl:apply-templates select="member_list"/>
      <xsl:apply-templates select="structure_db_links"/>
      <xsl:apply-templates select="taxonomy_distribution"/>
    </term>
  </xsl:template>

  <xsl:template match="parent_list">
    <xsl:for-each select="rel_ref">
      <is_a>
        <xsl:text>InterPro:</xsl:text><xsl:value-of select="@ipr_ref"/>
      </is_a>
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="member_list|structure_db_links">
    <xsl:for-each select="db_xref">
      <xref_analog>
        <acc>
          <xsl:value-of select="@dbkey"/>
        </acc>
        <dbname>
          <xsl:value-of select="@db"/>
        </dbname>
      </xref_analog>
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="taxonomy_distribution">
    <xsl:for-each select="taxon_data">
      <restriction>
        <type>
          <xsl:text>ipr:can_occur_in</xsl:text>
        </type>
        <to>
          <xsl:text>taxon_name:</xsl:text><xsl:value-of select="@name"/>
        </to>
      </restriction>
    </xsl:for-each>
  </xsl:template>

</xsl:stylesheet>
