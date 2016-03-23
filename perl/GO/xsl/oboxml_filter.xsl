<?xml version="1.0" encoding="utf-8"?>

<!-- AUTHOR: Chris Mungall :: cjm at fruitfly dot org  -->

<!-- to filter out anonymous terms, use arg filter_anonymous=1 -->
<!-- usage: -->
<!--     xsltproc xsl/oboxml_filter.xsl -param filter_anonymous 1 -stringparam namespace cellular_component my.obo.xml -->

     <xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                version="1.0">

  <xsl:strip-space elements="*"/>
  <xsl:param name="namespace"/>
  <xsl:param name="filter_anonymous"/>
  <xsl:param name="filter_named"/>
  <xsl:output indent="yes" method="xml"/>

  <xsl:template match="term">
    <xsl:choose>
      <xsl:when test="$filter_anonymous and (($filter_anonymous != 0 and is_anonymous != 0) or ($filter_named = 0 and is_anonymous != 1))">
        <!-- do nothing -->
      </xsl:when>
      <xsl:when test="$namespace and namespace != $namespace">
      </xsl:when>
      <xsl:otherwise>
        <xsl:copy>
          <xsl:apply-templates select="@* | node()" />
        </xsl:copy>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- match everything else -->
  <xsl:template match="/ | @* | node()">
    <xsl:copy>
      <xsl:apply-templates select="@* | node()" />
    </xsl:copy>
  </xsl:template>


</xsl:stylesheet>
