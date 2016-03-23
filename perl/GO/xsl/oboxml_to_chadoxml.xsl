<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <!-- this transforms oboxml into chadoxml -->
  <!-- chadoxml can be loaded into a chado db using XML::XORT -->
  <!-- does NOT build transitive closure 'cvtermpath' -->
  <!-- use the Pg function fill_cvtermpath for this  -->

  <xsl:output indent="yes" method="xml"/>

  <xsl:param name="default_idspace"/>
  <xsl:param name="map_intersection_of_tags"/>

  <xsl:key name="k_entity" match="term|typedef|instance" use="id"/>
  <xsl:key name="k_typeref" match="//type" use="."/>
  <xsl:key name="k_namespace" match="//namespace" use="."/>
  <xsl:variable name="unique_typeref" select="//type[not(.=preceding::type) and not(key('k_entity',.))]"/>
  <xsl:variable name="unique_namespace" select="//namespace[not(.=preceding::namespace)]"/>

  <xsl:template match="/">
    <chado>

      <xsl:comment>
        <xsl:text>XORT macros - we can refer to these later</xsl:text>
      </xsl:comment>
      <!-- set macros; ensure the basic stuff is there -->
      <cv op="force" id="relationship">
        <name>relationship</name>
      </cv>
      <cv op="force" id="synonym_type">
        <name>synonym_type</name>
      </cv>
      <cv op="force" id="cvterm_property_type">
        <name>cvterm_property_type</name>
      </cv>
      <cv op="force" id="anonymous_cv">
        <name>anonymous</name>
      </cv>

      <db op="force" id="OBO_REL">
        <name>OBO_REL</name>
      </db>

      <db op="force" id="_default_idspace">
        <name>
          <xsl:choose>
            <xsl:when test="$default_idspace">
              <xsl:value-of select="$default_idspace"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>_global</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
        </name>
      </db>

      <db op="force" id="internal">
        <name>internal</name>
      </db>

      <cvterm op="force" id="comment_type">
        <dbxref_id>
          <dbxref>
            <db_id>internal</db_id>
            <accession>comment</accession>
          </dbxref>
        </dbxref_id>
        <cv_id>cvterm_property_type</cv_id>
        <name>comment</name>
      </cvterm>

      <cvterm op="force" id="is_anonymous">
        <dbxref_id>
          <dbxref>
            <db_id>internal</db_id>
            <accession>is_anonymous</accession>
          </dbxref>
        </dbxref_id>
        <cv_id>cvterm_property_type</cv_id>
        <name>is_anonymous</name>
      </cvterm>

      <cvterm op="force" id="builtin__is_a">
        <dbxref_id>
          <dbxref>
            <db_id>OBO_REL</db_id>
            <accession>is_a</accession>
          </dbxref>
        </dbxref_id>
        <cv_id>relationship</cv_id>
        <name>is_a</name>
        <is_relationshiptype>1</is_relationshiptype>
      </cvterm>

      <xsl:comment>
        external cvterms that are referred to in this document
      </xsl:comment>

      <xsl:for-each select="$unique_typeref">
        <xsl:apply-templates select="." mode="dbxref"/>
        <cvterm id="{.}">
          <dbxref_id>
            <xsl:text>dbxref__</xsl:text>
            <xsl:value-of select="."/>
          </dbxref_id>
        </cvterm>
      </xsl:for-each>

      <xsl:comment>
        cv/namespaces
      </xsl:comment>

      <xsl:for-each select="$unique_namespace">
        <cv id="cv__{.}">
          <name>
            <xsl:value-of select="."/>
          </name>
        </cv>
      </xsl:for-each>

      <!-- terms can appear in different obo file types -->
      <xsl:comment>relationship types</xsl:comment>
      <xsl:apply-templates select="*/typedef"/>

      <xsl:comment>terms</xsl:comment>
      <xsl:apply-templates select="*/term"/>

      <xsl:comment>instances</xsl:comment>
      <xsl:apply-templates select="*/instance"/>

      <xsl:comment>is_a relationship types</xsl:comment>
      <xsl:apply-templates select="*/term/is_a"/>

      <xsl:comment>other relationship types</xsl:comment>
      <xsl:apply-templates select="*/term/relationship"/>

      <xsl:if test="$map_intersection_of_tags='true'">
        <xsl:comment>
          intersection_of; logical definition DAG links.
          you should only expect to find cvterm_relationships
          under here for advanced obo1.2 and owl sourced ontologies
        </xsl:comment>
        <!-- required for owl compatibility, and compatibility
             with advanced features of obo 1.2 format -->
        <cvterm op="force" id="intersection_of">
          <dbxref_id>
            <dbxref>
              <db_id>internal</db_id>
              <accession>intersection_of</accession>
            </dbxref>
          </dbxref_id>
          <cv_id>cvterm_property_type</cv_id>
          <name>intersection_of</name>
          <is_relationshiptype>1</is_relationshiptype>
        </cvterm>
        
        <xsl:apply-templates select="*/term/intersection_of"/>
      </xsl:if>

      <xsl:comment>is_a relationship types between typedefs</xsl:comment>
      <xsl:apply-templates select="*/typedef/is_a"/>

      <xsl:comment>cvterm metadata</xsl:comment>
      <xsl:apply-templates select="*/term/property_value"/>

      <xsl:comment>instance-level relations</xsl:comment>
      <xsl:apply-templates select="*/instance/property_value"/>



    </chado>
  </xsl:template>

  <xsl:template match="term">
    <cvterm id="{id}">
      <dbxref_id>
        <xsl:apply-templates select="id" mode="dbxref"/>
      </dbxref_id>

      <!-- we must munge the name for obsoletes -->
      <xsl:choose>
        <xsl:when test="is_obsolete">
          <is_obsolete>1</is_obsolete>
          <name>
            <xsl:value-of select="name"/>
            <xsl:text> (obsolete </xsl:text>
            <xsl:value-of select="id"/>
            <xsl:text>)</xsl:text>
          </name>
        </xsl:when>
        <xsl:otherwise>
          <name>
            <xsl:value-of select="name"/>
          </name>
        </xsl:otherwise>
      </xsl:choose>

      <xsl:apply-templates select="namespace"/>

      <xsl:apply-templates select="def"/>
      <xsl:apply-templates select="comment"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog"/>
    </cvterm>
  </xsl:template>

  <!-- in oboxml, a typedef element is used for relations and
       slots. these map to cvterms in chado -->
  <xsl:template match="typedef">
    <cvterm op="force" id="{id}">
      <dbxref_id>
        <xsl:apply-templates select="id" mode="dbxref"/>
      </dbxref_id>
      <name>
        <!-- note: earlier versions of ontologies had ad-hoc names -->
        <!-- we want to use the ID of the name here -->
        <xsl:choose>
          <xsl:when test="contains(id,':')">
            <!-- we have a 'real' ID, which means the name is real -->
            <xsl:value-of select="name"/>
          </xsl:when>
          <xsl:otherwise>
            <!-- old ontology: ID is actually the name -->
            <xsl:value-of select="id"/>
          </xsl:otherwise>
        </xsl:choose>
      </name>

      <xsl:choose>
        <xsl:when test="xref_analog/dbname = 'OBO_REL'">
          <!-- do not write the specified namespace: we map the relation to the equivalent in OBO_REL
               -->
          <cv_id>relationship</cv_id>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="namespace"/>
        </xsl:otherwise>
      </xsl:choose>
      
      <xsl:if test="is_obsolete">
        <is_obsolete>1</is_obsolete>
      </xsl:if>
      <xsl:apply-templates select="is_symmetric|is_cyclic|is_anti_symmetric|is_reflexive|is_transitive"/>

      <is_relationshiptype>1</is_relationshiptype>
      <xsl:if test="def">
        <definition>
          <xsl:value-of select="defstr"/>
        </definition>
      </xsl:if>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog"/>
    </cvterm>
  </xsl:template>

  <xsl:template match="instance">
    <cvterm id="{id}">
      <dbxref_id>
        <xsl:apply-templates select="id" mode="dbxref"/>
      </dbxref_id>

      <is_instance>1</is_instance>
      <!-- we must munge the name for obsoletes -->
      <xsl:if test="name">
        <name>
          <xsl:value-of select="name"/>
        </name>
      </xsl:if>
      
      <xsl:apply-templates select="namespace"/>
    </cvterm>
  </xsl:template>

  <xsl:template match="is_symmetric|is_cyclic|is_anti_symmetric|is_reflexive|is_transitive">
    <cvtermprop>
      <type_id>
        <cvterm op="force">
          <dbxref_id>
            <dbxref>
              <db_id>internal</db_id>
              <accession><xsl:value-of select="name(.)"/></accession>
            </dbxref>
          </dbxref_id>
          <cv_id>cvterm_property_type</cv_id>
          <name><xsl:value-of select="name(.)"/></name>
        </cvterm>
      </type_id>
      <value>1</value>
    </cvtermprop>
  </xsl:template>

  <!-- reference to a cvterm
       assumed to be inside a -->
  <xsl:template match="*" mode="cvterm_id">
    <xsl:if test="not(.)">
      <xsl:message terminate="yes">
        <xsl:copy select="."/>
        <xsl:text>No ID</xsl:text>
      </xsl:message>
    </xsl:if>

    <xsl:choose>
      <!-- is there a term or typedef by this ID in this file? -->
      <xsl:when test="key('k_entity',.)">
        <xsl:value-of select="."/>
      </xsl:when>
      
      <!-- have we already referenced it? -->
      <xsl:when test="key('k_typeref',.)">
        <xsl:value-of select="."/>
      </xsl:when>
      
      <!-- not present in this document -->
      <xsl:otherwise>
        <cvterm>
          <xsl:apply-templates select="." mode="dbxref"/>
        </cvterm>
      </xsl:otherwise>

    </xsl:choose>

  </xsl:template>

  <!-- turn an OBO ID into a Chado dbxref -->
  <xsl:template match="*" mode="dbxref">
    <dbxref id="dbxref__{.}">
      <xsl:choose>

        <!-- simple split on bipartite ONO ID -->
        <xsl:when test="contains(.,':')">
          <db_id>
            <db>
              <name>
                <xsl:value-of select="substring-before(.,':')"/>    
              </name>
            </db>
          </db_id>
          <accession>
            <xsl:value-of select="substring-after(.,':')"/>    
          </accession>
        </xsl:when>

        <!-- OBO Format has no concept of a default ID space.
             IDs that are not prefixed with a dbspace go into
             the DB 'global'.
             The exception here is OBO_REL
             Equivalence to OBO_REL must
             now be stated, otherwise an unprefixed part_of
             will be treated as _global:part_of
             -->

        <xsl:when test="key('k_entity',.)/xref_analog/dbname = 'OBO_REL'">
          <db_id>OBO_REL</db_id>
          <accession>
            <xsl:value-of select="."/>
          </accession>
        </xsl:when>

        <xsl:otherwise>
          <db_id>_default_idspace</db_id>
          <accession>
            <xsl:value-of select="."/>
          </accession>
        </xsl:otherwise>
      </xsl:choose>
    </dbxref>
  </xsl:template>

  <!-- TODO: implied links -->
  <xsl:template match="is_a">
    <cvterm_relationship>
      <type_id>builtin__is_a</type_id>
      <subject_id>
        <xsl:apply-templates select="../id" mode="cvterm_id"/>
      </subject_id>
      <object_id>
        <xsl:apply-templates select="." mode="cvterm_id"/>
      </object_id>
    </cvterm_relationship>
  </xsl:template>

  <xsl:template match="relationship">
    <cvterm_relationship>
      <type_id>
        <xsl:apply-templates select="type" mode="cvterm_id"/>
      </type_id>
      <subject_id>
        <xsl:apply-templates select="../id" mode="cvterm_id"/>
      </subject_id>
      <object_id>
        <xsl:apply-templates select="to" mode="cvterm_id"/>
      </object_id>
    </cvterm_relationship>
  </xsl:template>

  <!-- for instances: slot-values and relationships between instances -->
  <xsl:template match="property_value">
    <xsl:choose>
      <xsl:when test="datatype">
        <!-- slots -->
        <cvtermprop>
          <cvterm_id>
            <xsl:apply-templates select="../id" mode="cvterm_id"/>
          </cvterm_id>
          <type_id>
            <xsl:apply-templates select="type" mode="cvterm_id"/>
          </type_id>
          <value>
            <xsl:value-of select="to"/>
          </value>
        </cvtermprop>
      </xsl:when>
      <xsl:otherwise>
        <!-- instance to instance links -->
        <cvterm_relationship>
          <type_id>
            <xsl:apply-templates select="type" mode="cvterm_id"/>
          </type_id>
          <subject_id>
            <xsl:apply-templates select="../id" mode="cvterm_id"/>
          </subject_id>
          <object_id>
            <xsl:value-of select="to"/>
          </object_id>
        </cvterm_relationship>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- see obo1.2 docs for more info on this tag -->
  <!-- intersection_ofs (aka logical definitions) are
       recorded in the DAG as a collection of intersection_of
       relationships between the defined term and either
       (a) another term (the genus, or generic term)
       (b) an anonymous term, itself linked to another term by a
           relationship of some type (a differentium)
       -->
  <xsl:template match="intersection_of">
    <cvterm_relationship>
      <type_id>intersection_of</type_id>
      <subject_id>
        <xsl:apply-templates select="../id" mode="cvterm_id"/>
      </subject_id>
      <object_id>
        <xsl:choose>
          <xsl:when test="type">
            <!-- anonymous term -->
            <cvterm>
              <xsl:call-template name="make-anon-term-elts">
                <xsl:with-param name="anon_id" select="concat('restriction','--',concat(type,'--',../id))"/>
              </xsl:call-template>
              <cvterm_relationship>
                <type_id>
                  <xsl:apply-templates select="type" mode="cvterm_id"/>
                </type_id>
                <object_id>
                  <xsl:apply-templates select="to" mode="cvterm_id"/>
                </object_id>
              </cvterm_relationship>
            </cvterm>
          </xsl:when>
          <xsl:otherwise>
            <xsl:apply-templates select="to" mode="cvterm_id"/>
          </xsl:otherwise>
        </xsl:choose>
      </object_id>
    </cvterm_relationship>
  </xsl:template>

  <xsl:template name="make-anon-term-elts">
    <xsl:param name="anon_id"/>
    <dbxref_id>
      <dbxref>
        <db_id>internal</db_id>
        <accession><xsl:value-of select="$anon_id"/></accession>
      </dbxref>
    </dbxref_id>
    <name><xsl:value-of select="$anon_id"/></name>
    <cv_id>anonymous_cv</cv_id>
    <cvtermprop>
      <type_id>is_anonymous</type_id>
      <value>
        <xsl:text>1</xsl:text>
      </value>
      <rank>0</rank>
    </cvtermprop>
  </xsl:template>

  <xsl:template match="synonym">
    <cvtermsynonym>
      <synonym>
        <xsl:value-of select="synonym_text"/>
      </synonym>
      <xsl:if test="@scope">
        <type_id>
          <cvterm>
            <dbxref_id>
              <dbxref>
                <db_id>internal</db_id>
                <accession>
                  <xsl:value-of select="@scope"/>
                </accession>
              </dbxref>
            </dbxref_id>
            <cv_id>synonym_type</cv_id>
            <name>
              <xsl:value-of select="@scope"/>
            </name>
          </cvterm>
        </type_id>
      </xsl:if>
    </cvtermsynonym>
  </xsl:template>

  <!-- TODO: use this -->
  <xsl:template match="namespace">
    <cv_id>
      <xsl:text>cv__</xsl:text>
      <xsl:value-of select="."/>
    </cv_id>
  </xsl:template>
    
  <xsl:template match="comment">
    <cvtermprop>
      <type_id>comment_type</type_id>
      <value>
        <xsl:value-of select="."/>
      </value>
      <rank>0</rank>
    </cvtermprop>
  </xsl:template>
    
  <xsl:template match="xref_analog">
    <cvterm_dbxref>
      <dbxref_id>
        <dbxref>
          <db_id>
            <db>
              <name>
                <xsl:value-of select="dbname"/>
              </name>
            </db>
          </db_id>
          <accession>
            <xsl:value-of select="acc"/>
          </accession>
        </dbxref>
      </dbxref_id>
    </cvterm_dbxref>
  </xsl:template>
    
  <xsl:template match="dbxref" mode="is_for_definition">
    <cvterm_dbxref>
      <dbxref_id>
        <dbxref>
          <db_id>
            <db>
              <name>
                <xsl:value-of select="dbname"/>
              </name>
            </db>
          </db_id>
          <accession>
            <xsl:value-of select="acc"/>
          </accession>
        </dbxref>
      </dbxref_id>
      <is_for_definition>1</is_for_definition>
    </cvterm_dbxref>
  </xsl:template>
    
  <xsl:template match="alt_id">
    <cvterm_dbxref>
      <dbxref_id>
        <xsl:apply-templates select="." mode="dbxref"/>
      </dbxref_id>
    </cvterm_dbxref>
  </xsl:template>
  
  <xsl:template match="def">
    <definition>
      <xsl:value-of select="defstr"/>
    </definition>
	<xsl:if test="string-length(dbxref/acc) > 0 and string-length(dbxref/dbname) > 0">
        <xsl:apply-templates select="dbxref" mode="is_for_definition"/>
	</xsl:if>
  </xsl:template>

  <xsl:template match="prod">
    <feature>
      <dbxref>
        <db>
          <name>
            <xsl:value-of select="../proddb"/>
          </name>
        </db>
        <accession>
          <xsl:value-of select="prodacc"/>
        </accession>
      </dbxref>
      <name>
        <xsl:value-of select="prodsymbol"/>
      </name>
      <uniquename>
        <xsl:value-of select="prodsymbol"/>
      </uniquename>
      <type>
        <cvterm>
          <name>
            <xsl:value-of select="prodtype"/>
          </name>
          <cv>
            <name>
              sequence
            </name>
          </cv>
        </cvterm>
      </type>
      <organism>
        <dbxref>
          <db>
            <name>
              ncbi_taxononmy
            </name>
          </db>
          <accession>
            <xsl:value-of select="prodtaxa"/>
          </accession>
        </dbxref>
      </organism>
      <xsl:apply-templates select="assoc"/>
    </feature>
  </xsl:template>

  <xsl:template match="assoc">
    <feature_cvterm>
      <cvterm_id>
        <xsl:apply-templates select="termacc" mode="cvterm_id"/>
      </cvterm_id>
      <xsl:apply-templates select="evidence"/>
    </feature_cvterm>
  </xsl:template>

  <xsl:template match="evidence">
    <feature_cvtermprop>
    </feature_cvtermprop>
  </xsl:template>

  <xsl:template match="text()|@*">
  </xsl:template>


</xsl:stylesheet>



