<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="html"/>

    <xsl:key name="is-as" match="term" use="is_a"/>
    <xsl:key name="part-ofs" match="term" use="relationship/to"/>
    <xsl:key name="terms" match="term" use="id"/>

    <xsl:template match="/">
	<xsl:element name="html">
		<xsl:element name="body">
			<xsl:element name="link">
				<xsl:attribute name="href">ontology_html.css</xsl:attribute>
				<xsl:attribute name="rel">stylesheet</xsl:attribute>
				<xsl:attribute name="type">text/css</xsl:attribute>
			</xsl:element>

<xsl:element name="pre">!type: % is_a is a
!type: &lt; part_of Part of</xsl:element>
			<xsl:apply-templates mode="first" select="obo/term[1]"/>
		</xsl:element>
	</xsl:element>
    </xsl:template>


    <xsl:template match="term" mode="first">
	<ul class="first">
		<li class="first">
			<xsl:text>$</xsl:text>
		        <xsl:value-of select="name"/>
			<xsl:text> ; </xsl:text>
			<xsl:value-of select="id"/>
			<xsl:variable name="current_id" select="id"/> 
			<xsl:apply-templates
				mode="not-first"
				select="key('part-ofs', id)">
				<xsl:with-param name="rel_type">part-of</xsl:with-param>
			</xsl:apply-templates>
			<xsl:apply-templates
				mode="not-first"
				select="key('is-as', id)">
				<xsl:with-param name="rel_type">is_a</xsl:with-param>
			</xsl:apply-templates>
		</li>
	</ul>
    </xsl:template>

    <xsl:template match="term" mode="not-first">
	<xsl:param name="parent_id"><xsl:value-of select="/obo/term[1]/id"/></xsl:param>
	<xsl:param name="rel_type"/>
	<ul>
		<li>
			<xsl:choose>
				<xsl:when test="$rel_type = 'part-of'">
					<xsl:text>%</xsl:text>
				</xsl:when>
				<xsl:when test="$rel_type = 'is_a'">
					<xsl:text>&lt;</xsl:text>
				</xsl:when>
			</xsl:choose>
			<xsl:apply-templates 
				select="."
				mode="term">
				<xsl:with-param name="parent_id"><xsl:value-of select="$parent_id"/></xsl:with-param>
			</xsl:apply-templates>
			<xsl:apply-templates
				mode="not-first"
				select="key('is-as', id)">
				<xsl:with-param name="parent_id"><xsl:value-of select="id"/></xsl:with-param>
				<xsl:with-param name="rel_type">part-of</xsl:with-param>
			</xsl:apply-templates>
			<xsl:apply-templates
				mode="not-first"
				select="key('part-ofs', id)">
				<xsl:with-param name="parent_id"><xsl:value-of select="id"/></xsl:with-param>
				<xsl:with-param name="rel_type">part-of</xsl:with-param>
			</xsl:apply-templates>
		</li>
	</ul>
    </xsl:template>

   <xsl:template match="term" name="term" mode="term">
	<xsl:param name="parent_id"><xsl:value-of select="/obo/term[1]/id"/></xsl:param>
		        <xsl:element name="a">
				<xsl:attribute name="id">
					<xsl:value-of select="id"/>
				</xsl:attribute>
				<xsl:value-of select="name"/>
				<xsl:text> ; </xsl:text>
				<xsl:value-of select="id"/>
			</xsl:element>	
			<xsl:apply-templates select="synonym"/>
			<xsl:apply-templates mode="parents" select="relationship[to != $parent_id]"/>
			<xsl:apply-templates mode="parents" select="is_a[text() != $parent_id]"/>
    </xsl:template>
 
    <xsl:template match="relationship" mode="parents">
	<xsl:text> &lt; </xsl:text>
	<xsl:apply-templates
				mode="draw-parent"
				select="key('terms', to)"/>
	<xsl:value-of select="to"/>
    </xsl:template>

    <xsl:template match="is_a" mode="parents">
	<xsl:text> % </xsl:text>
	<xsl:apply-templates
				mode="draw-parent"
				select="key('terms', .)"/>
	<xsl:value-of select="."/>
    </xsl:template>

    <xsl:template match="term" mode="draw-parent">
	<xsl:element name="a">
		<xsl:attribute name="href">#<xsl:value-of select="id"/></xsl:attribute>
		<xsl:value-of select="name"/>
	</xsl:element>
	<xsl:text> ; </xsl:text>
    </xsl:template>	

    <xsl:template match="synonym">
	<xsl:text> ; synonym:</xsl:text>
	<xsl:value-of select="synonym_text"/>
    </xsl:template>

   <xsl:template match="text()|@*">
    </xsl:template>

</xsl:stylesheet>



