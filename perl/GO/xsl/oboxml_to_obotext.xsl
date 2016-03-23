<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <!-- not yet fully tested; perl transform still used for production mode -->

    <xsl:output indent="yes" method="text"/>

    <xsl:key name="terms" match="term" use="id"/>

    <xsl:template match="/">
      <xsl:apply-templates select="obo/header" />
      <xsl:text>&#10;</xsl:text>

      <xsl:apply-templates select="obo/typedef"/>
      <xsl:apply-templates select="obo/term"/>
      <xsl:apply-templates select="obo/instance"/>
    </xsl:template>

    <xsl:template match="header">
      <xsl:text>format-version: 1.2</xsl:text>
      <xsl:apply-templates select="date" />
      <xsl:apply-templates select="saved-by" />
      <xsl:apply-templates select="auto-generated-by" />
      <xsl:apply-templates select="subsetdef">
        <xsl:sort select="id" />
      </xsl:apply-templates>
      <xsl:apply-templates select="synonym_category">
        <xsl:sort select="id" />
      </xsl:apply-templates>
      <xsl:apply-templates select="default-namespace" />
      <xsl:apply-templates select="remark" />
    </xsl:template>

    <!-- mix term and typedef in same template -->
    <xsl:template match="term|typedef">
      <xsl:if test="name() = 'term'">
        <xsl:text>[Term]</xsl:text>
      </xsl:if>
      <xsl:if test="name() = 'typedef'">
        <xsl:text>[Typedef]</xsl:text>
      </xsl:if>
      <xsl:text>&#10;</xsl:text>
      <xsl:text>id: </xsl:text>
      <xsl:value-of select="id"/>
      <xsl:text>&#10;</xsl:text>
      <xsl:apply-templates select="is_anonymous"/>
      <xsl:text>name: </xsl:text>
      <xsl:value-of select="name"/>
      <xsl:text>&#10;</xsl:text>

      <xsl:if test="namespace">
        <xsl:text>namespace: </xsl:text>
        <xsl:value-of select="namespace"/>
        <xsl:text>&#10;</xsl:text>
      </xsl:if>
      <xsl:apply-templates select="alt_id">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="def" />
      <xsl:apply-templates select="comment" />

      <xsl:apply-templates select="subset">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="synonym">
        <xsl:sort select="synonym_text|@scope|category"/>
      </xsl:apply-templates>

      <xsl:apply-templates select="xref_analog">
        <xsl:sort />
      </xsl:apply-templates>
      <xsl:apply-templates select="xref_unknown">
        <xsl:sort />
      </xsl:apply-templates>
      <xsl:apply-templates select="domain">
        <xsl:sort />
      </xsl:apply-templates>
      <xsl:apply-templates select="range">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="is_cyclic"/>
      <xsl:apply-templates select="is_reflexive"/>
      <xsl:apply-templates select="is_symmetric"/>
      <xsl:apply-templates select="is_transitive"/>

      <xsl:apply-templates select="is_a">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="intersection_of">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="inverse_of">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="union_of">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="disjoint_from">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="relationship|functional_property|datatype_property">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="is_obsolete"/>

      <xsl:apply-templates select="replaced_by">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:apply-templates select="consider">
        <xsl:sort />
      </xsl:apply-templates>

      <xsl:text>&#10;</xsl:text>
    </xsl:template>

    <xsl:template match="subsetdef">
      <xsl:text>subsetdef: </xsl:text>
      <xsl:apply-templates />
    </xsl:template>

    <xsl:template match="synonym_category">
      <xsl:text>synonymtypedef: </xsl:text>
      <xsl:apply-templates />
    </xsl:template>

    <!-- used for all boolean tags w/ default value false -->
    <xsl:template match="is_obsolete|is_cyclic|is_reflexive|is_transitive|is_symmetric|is_anonymous">
      <xsl:if test="text() = '1'">
        <xsl:value-of select="name()"/>
        <xsl:text>: true&#10;</xsl:text>
      </xsl:if>
    </xsl:template>

    <xsl:template match="intersection_of">
      <xsl:text>intersection_of: </xsl:text>

      <xsl:if test = "count(type) > 0">
	<xsl:value-of select="type"/>
	<xsl:text> </xsl:text>
      </xsl:if>
      <xsl:value-of select="to"/>
      <xsl:text> ! </xsl:text>
      <xsl:value-of select="key('terms', .)/name"/>
      <xsl:text>&#10;</xsl:text>
    </xsl:template>

    <xsl:template match="is_a|inverse_of|disjoint_with|union_of">
      <xsl:value-of select="name()"/>
      <xsl:text>: </xsl:text>
      <xsl:value-of select="."/>

      <xsl:if test = "@namespace != ''">
        <xsl:text> {namespaces="</xsl:text>
	<xsl:value-of select="@namespace"/>
	<xsl:text>"}</xsl:text>
      </xsl:if>
      <xsl:text> ! </xsl:text>
      <xsl:value-of select="key('terms', .)/name"/>
      <xsl:text>&#10;</xsl:text>
    </xsl:template>

    <xsl:template match="relationship|functional_property|datatype_property">
      <xsl:value-of select="name()"/>
      <xsl:text>: </xsl:text>
      <xsl:value-of select="type"/>
      <xsl:text> </xsl:text>
      <xsl:value-of select="to"/>

      <xsl:if test = "@namespace != ''">
        <xsl:text> {namespaces="</xsl:text>
	<xsl:value-of select="@namespace"/>
	<xsl:text>"}</xsl:text>
      </xsl:if>
      <xsl:text> ! </xsl:text>
      <xsl:value-of select="key('terms', to)/name"/>
      <xsl:text>&#10;</xsl:text>
    </xsl:template>

    <xsl:template match="synonym">
      <xsl:text>synonym: "</xsl:text>
      <xsl:value-of select="synonym_text"/>
      <xsl:text>"</xsl:text>
      <xsl:choose>
         <xsl:when test = "@scope='exact'">
	    <xsl:text> EXACT</xsl:text>
	 </xsl:when>
	 <xsl:when test = "@scope='broad'">
	    <xsl:text> BROAD</xsl:text>
	 </xsl:when>
	 <xsl:when test = "@scope='narrow'">
	    <xsl:text> NARROW</xsl:text>
	 </xsl:when>
	 <xsl:otherwise>
	    <xsl:text> UNSPECIFIED</xsl:text>
	 </xsl:otherwise>
      </xsl:choose>

      <xsl:if test = "category != ''">
        <xsl:text> </xsl:text>
	<xsl:value-of select="category"/>
      </xsl:if>

      <xsl:call-template name="dbxreflist" />
      <xsl:text>&#10;</xsl:text>
    </xsl:template>

    <xsl:template name="dbxreflist">
      <xsl:if test="count(dbxref) = 0">
         <xsl:text> []</xsl:text>
      </xsl:if>
      <xsl:for-each select="dbxref">
         <xsl:sort select="dbname|acc" />
         <xsl:if test="position() = 1">
             <xsl:text> [</xsl:text>
         </xsl:if>
	 <xsl:if test="position() > 1">
	     <xsl:text>, </xsl:text>
	 </xsl:if>
         <xsl:apply-templates select="." />
	 <xsl:if test="position() = count(../dbxref)">
	     <xsl:text>]</xsl:text>
	 </xsl:if>
      </xsl:for-each>
    </xsl:template>

    <xsl:template name="dbxref" match="dbxref">
      <xsl:value-of select="dbname"/>
      <xsl:text>:</xsl:text>
      <xsl:value-of select="acc"/>
      <xsl:if test="name != ''">
         <xsl:text> "</xsl:text>
           <xsl:value-of select="name"/>
         <xsl:text>"</xsl:text>
      </xsl:if>
    </xsl:template>

    <xsl:template match="def">
      <xsl:text>def: "</xsl:text>
      <xsl:value-of select="defstr"/>
      <xsl:text>"</xsl:text>

      <xsl:call-template name="dbxreflist" />
      <xsl:text>&#10;</xsl:text>
    </xsl:template>
    
    <xsl:template match="xref_analog|xref_unknown">
      <xsl:if test="name() = 'xref_unknown'">
         <xsl:text>xref: </xsl:text>
      </xsl:if>
      <xsl:if test="name() = 'xref_analog'">
         <xsl:text>xref_analog: </xsl:text>
      </xsl:if>
      <xsl:call-template name="dbxref" />

      <xsl:text>&#10;</xsl:text>
    </xsl:template>
    
    <!-- generic tag: value template -->
    <xsl:template
    match="alt_id|domain|range|comment|subset|replaced_by|consider|format-version|date|saved-by|auto-generated-by|subsetdef|synonym_category|default-namespace|remark">
      <xsl:if test=". != ''">
        <xsl:value-of select="name()"/>
        <xsl:text>: </xsl:text>
        <xsl:value-of select="."/>
        <xsl:text>&#10;</xsl:text>
      </xsl:if>
    </xsl:template>

    <!-- INSTANCES -->
    <xsl:template match="instance">
      <xsl:text>[Instance]</xsl:text>
      <xsl:text>&#10;</xsl:text>
      <xsl:text>id: </xsl:text>
      <xsl:value-of select="id"/>
      <xsl:text>&#10;</xsl:text>
      <xsl:text>instance_of: </xsl:text>
      <xsl:value-of select="instance_of"/>
      <xsl:text>&#10;</xsl:text>
      <xsl:for-each select="property_value">
        <xsl:text>property_value: </xsl:text>
        <xsl:value-of select="property"/>
        <xsl:text> </xsl:text>
        <xsl:choose>
          <xsl:when test="xsd_type">
            <xsl:text>"</xsl:text>
            <xsl:value-of select="value"/>
            <xsl:text>" </xsl:text>
            <xsl:value-of select="xsd_type"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="value"/>
          </xsl:otherwise>
        </xsl:choose>
        <xsl:text>&#10;</xsl:text>
      </xsl:for-each>
      <xsl:text>&#10;</xsl:text>
    </xsl:template>

   <xsl:template match="text()|@*">
   </xsl:template>

</xsl:stylesheet>



