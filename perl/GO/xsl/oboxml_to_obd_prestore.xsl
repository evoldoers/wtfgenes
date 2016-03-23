<?xml version = "1.0"?>
<!DOCTYPE stylesheet [
  <!ENTITY oboInOwl "http://www.geneontology.org/formats/oboInOwl#">
  <!ENTITY oboContent "http://purl.org/obo/owl/">
  <!ENTITY xref "http://purl.org/obo/owl/">
  <!ENTITY xsd "http://www.w3.org/2001/XMLSchema#">
  ]>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <!-- this transforms oboxml into obdxml -->
  <!-- obdxml can be loaded into an obd db using DBIx::DBStag -->
  <xsl:param name="source"/>

  <xsl:output indent="yes" method="xml"/>

  <!-- *********************************************** -->
  <!-- Parameters -->
  <!-- *********************************************** -->
  <xsl:param name="localid_prefix"/>
  <xsl:param name="default_idspace"/>

  <!-- *********************************************** -->
  <!-- Indexes -->
  <!-- *********************************************** -->
  <xsl:key name="k_idspace" match="obo/header/idspace" use="local"/>
  <xsl:key name="k_entity" match="term|typedef|instance" use="id"/>

  <xsl:variable name="unique_namespace" select="//namespace[not(.=preceding::namespace)]"/>
  <xsl:variable name="source_id" select="//source/source_id"/>

  <xsl:template match="/">
    <obd>
      <xsl:comment>
        <xsl:text>XORT macros - we can refer to these later by stag??</xsl:text>
      </xsl:comment>

      <!-- set macros; ensure the basic stuff is there -->

      <node op="force" id="OBO_REL">
        <uid>OBO_REL</uid>
        <label>OBO_REL</label>
        <uri>http://www.obofoundry.org/ro#</uri>
        <metatype><xsl:text>I</xsl:text></metatype>
      </node>

      <node op="force" id="_default_idspace">
        <uid>
          <xsl:choose>
            <xsl:when test="$default_idspace">
              <xsl:value-of select="$default_idspace"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:text>_global</xsl:text>
            </xsl:otherwise>
          </xsl:choose>
        </uid>
      </node>

      <node op="force" id="is_a">
        <uid>OBO_REL:is_a</uid>
        <metatype><xsl:text>R</xsl:text></metatype>
      </node>

      <node op="force" id="instance_of">
        <uid>OBO_REL:instance_of</uid>
        <metatype><xsl:text>R</xsl:text></metatype>
      </node>

      <node op="force" id="owl:inverseOf">
        <uid>owl:inverseOf</uid>
        <metatype><xsl:text>R</xsl:text></metatype>
      </node>

      <node op="force" id="in_organism">
        <uid>oban:in_organism</uid>
        <metatype><xsl:text>R</xsl:text></metatype>
      </node>

      <node op="force" id="influences">
        <uid>oban:influences</uid>
        <metatype><xsl:text>R</xsl:text></metatype>
      </node>

      <!-- ID only appears as an attribute in trailing qualifiers -->
      <xsl:for-each select="//@id">
        <node id="{.}">
          <is_reiflink><xsl:text>t</xsl:text></is_reiflink>
          <is_anonymous><xsl:text>t</xsl:text></is_anonymous>
        </node>
      </xsl:for-each>

      <xsl:call-template name="embed-delete-directives"/>
      <xsl:apply-templates select="*/source"/>
      <xsl:apply-templates select="*/header/subsetdef"/>

      <!-- terms can appear in different obo file types -->
      <xsl:comment>relationship types</xsl:comment>
      <xsl:apply-templates select="*/typedef"/>

      <xsl:comment>terms</xsl:comment>
      <xsl:apply-templates select="*/term"/>

      <xsl:comment>instances</xsl:comment>
      <xsl:apply-templates select="*/instance"/>

      <xsl:comment>annotations</xsl:comment>
      <xsl:apply-templates select="*/annotation"/>


      <xsl:comment>is_a relationship types</xsl:comment>
      <xsl:apply-templates select="*/term/is_a"/>
      <xsl:apply-templates select="*/typedef/is_a"/>
      <xsl:apply-templates select="*/typedef/inverse_of"/>

      <xsl:comment>other relationship types</xsl:comment>
      <xsl:apply-templates select="*/term/relationship"/>

      <xsl:comment>
        logical definitions (by intersection or union)
      </xsl:comment>
      <xsl:apply-templates select="*/term/intersection_of"/>
      <xsl:apply-templates select="*/term/union_of"/>

      <xsl:comment>instance-level relations</xsl:comment>
      <xsl:apply-templates select="*/instance/property_value"/>

      <!-- old-style obo-xml annotations -->
      <xsl:apply-templates select="//prod"/>

    </obd>
  </xsl:template>

  <!-- todo -->
  <xsl:template name="embed-delete-directives">
    <xsl:comment>
      <xsl:text>
        Update policy: all links from this source are deleted and repopulated
      </xsl:text>
    </xsl:comment>
    <_sql op="delete" from="link" match="loaded_from_id" pkey="link_id">
      <xsl:call-template name="sql-for-namespaces"/>
    </_sql>
    <_sql op="delete" from="tagval" match="loaded_from_id" pkey="tagval_id">
      <xsl:call-template name="sql-for-namespaces"/>
    </_sql>
    <_sql op="delete" from="sameas" match="loaded_from_id" pkey="sameas_id">
      <xsl:call-template name="sql-for-namespaces"/>
    </_sql>
    <_sql op="delete" from="alias" match="loaded_from_id" pkey="alias_id">
      <xsl:call-template name="sql-for-namespaces"/>
    </_sql>
    <_sql op="delete" from="description" match="loaded_from_id" pkey="description_id">
      <xsl:call-template name="sql-for-namespaces"/>
    </_sql>
    <!-- annotation nodes too? -->
  </xsl:template>

  <xsl:template name="sql-for-namespaces">
    <_sql op="select" from="node" col="node_id" match="uid">
      <xsl:value-of select="//source/source_id"/>
    </_sql>
  </xsl:template>

  <xsl:template name="xxxx-sql-for-namespaces">
    <xsl:for-each select="$unique_namespace">
      <_sql op="select" from="node" col="node_id" match="uid">
        <xsl:value-of select="."/>
      </_sql>
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="term">
    <node id="{id}">
      <xsl:apply-templates select="id" mode="id"/>
      <xsl:call-template name="node_audit"/>

      <xsl:choose>
        <xsl:when test="is_anonymous=1">
          <is_anonymous>
            <xsl:text>t</xsl:text>
          </is_anonymous>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="id" mode="uri"/>
        </xsl:otherwise>
      </xsl:choose>

      <metatype><xsl:text>C</xsl:text></metatype>
      <xsl:if test="is_obsolete=1">
        <is_obsolete>t</is_obsolete>
      </xsl:if>
      <xsl:if test="name">
        <label>
          <xsl:value-of select="name"/>
        </label>
      </xsl:if>

      <!-- when no namespace, use string before ':' in id for source  if any -->
      <xsl:apply-templates mode="source_id" select="."/>

      <xsl:apply-templates select="def"/>
      <xsl:apply-templates select="comment"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog"/>
      <xsl:apply-templates select="subset"/>
    </node>
  </xsl:template>

  <!-- in oboxml, a typedef element is used for relations and slots. these map to nodes in obd -->
  <xsl:template match="typedef">
    <node id="{id}">
      <xsl:apply-templates select="id" mode="id"/>
      <metatype>
        <xsl:text>R</xsl:text>
      </metatype>
      <label>
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
      </label>

      <!-- by default, relations go in the relationship
           namespace, even though they may not be defined in
           official obo relations ontology -->
      <xsl:choose>
        <xsl:when test="namespace and contains(id,':')">
          <source_id>
            <node>
              <uid>
                <xsl:value-of select="namespace"/>
              </uid>
              <metatype><xsl:text>I</xsl:text></metatype>
            </node>
          </source_id>
        </xsl:when>
        <xsl:otherwise>
          <source_id>_default_idspace</source_id>
        </xsl:otherwise>
      </xsl:choose>

      <xsl:if test="is_obsolete">
        <is_obsolete>t</is_obsolete>
      </xsl:if>
      <xsl:apply-templates select="is_symmetric|is_cyclic|is_anti_symmetric|is_reflexive|is_transitive"/>
      <xsl:apply-templates select="def"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog"/>
    </node>
  </xsl:template>

  <!-- more work needed here!! -->
  <xsl:template match="instance">
    <node id="{id}">
      <xsl:apply-templates select="id" mode="id"/>
      <xsl:choose>
        <xsl:when test="is_anonymous=1">
          <is_anonymous>
            <xsl:text>t</xsl:text>
          </is_anonymous>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="id" mode="uri"/>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="name" mode="label"/>
      <metatype><xsl:text>I</xsl:text></metatype>
      
      <xsl:if test="namespace">
        <source_id>
          <node>
            <uid>
              <xsl:value-of select="namespace"/>
            </uid>
          </node>
        </source_id>
      </xsl:if>

      <xsl:apply-templates select="instance_of"/>
      <xsl:apply-templates select="comment"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog"/>
      <xsl:apply-templates select="subset"/>

    </node>
  </xsl:template>

  <xsl:template match="subsetdef">
    <node>
      <uid>
        <xsl:value-of select="id"/>
      </uid>
      <label>
        <xsl:value-of select="name"/>
      </label>
      <metatype><xsl:text>I</xsl:text></metatype>
      <source_id>
        <node>
          <uid>subset</uid>
        </node>
      </source_id>
    </node>
  </xsl:template>

  <xsl:template match="is_symmetric|is_cyclic|is_anti_symmetric|is_reflexive|is_transitive">
    <xsl:if test="../is_transitive">
      <is_transitive>t</is_transitive>
    </xsl:if>
    <!-- what about other rel property?? -->
  </xsl:template>

  <!-- reference to a node
       assumed to be inside a foreign key element -->
  <xsl:template match="*" mode="node_ref">
    <xsl:if test="not(.)">
      <xsl:message terminate="yes">
        <xsl:copy select="."/>
        <xsl:text>No ID</xsl:text>
      </xsl:message>
    </xsl:if>
    <xsl:choose>
      <!-- we've already referenced this node -
           we assume it has already been loaded -->
      <xsl:when test="key('k_entity',.)">
        <xsl:value-of select="."/>
      </xsl:when>
      <!-- convention: bNodes are in _ idspace -->
      <!-- is there a term or typedef by this ID in this file? -->
      <xsl:when test="substring-before(.,':') = '_'">
        <!-- use a XORT id -->
        <xsl:value-of select="."/>
      </xsl:when>
      <xsl:otherwise>
        <!-- explicit node reference -->
        <node>
          <uid>
            <xsl:value-of select="."/>
          </uid>
        </node>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="link_audit">
    <link_audit op="insert">
      <source_id>__source</source_id>
      <loadtime>now</loadtime>
    </link_audit>
  </xsl:template>
  <xsl:template name="node_audit">
    <node_audit op="insert">
      <source_id>__source</source_id>
      <loadtime>now</loadtime>
    </node_audit>
  </xsl:template>

  <xsl:template match="*" mode="id">
    <xsl:if test="not(.)">
      <xsl:message terminate="yes">
        <xsl:copy select="."/>
        <xsl:text>No ID</xsl:text>
      </xsl:message>
    </xsl:if>
    <xsl:choose>
      <!-- convention: bNodes are in _ idspace -->
      <xsl:when test="substring-before(.,':') = '_'">
      </xsl:when>
      <xsl:otherwise>
        <!-- not a bNode -->
        <uid>
          <xsl:value-of select="."/>
        </uid>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- not the ones under def -->
  <xsl:template match="*" mode="dbxref">
    <sameas>
      <object_id>
        <xsl:apply-templates select="." mode="node_ref"/>
      </object_id>
    </sameas>
  </xsl:template>

  <xsl:template match="is_a|instance_of">
    <link>
      <xsl:call-template name="link_audit"/>
      <xsl:apply-templates select="@implied"/>
      <node_id>
        <xsl:apply-templates select="../id" mode="node_ref"/>
      </node_id>
      <predicate_id>
        <xsl:value-of select="name(.)"/>
      </predicate_id>
      <object_id>
        <xsl:apply-templates select="." mode="node_ref"/>
      </object_id>
      <xsl:apply-templates mode="source_id" select=".."/>
    </link>
  </xsl:template>

  <xsl:template match="inverse_of">
    <link>
      <xsl:apply-templates select="@implied"/>
      <node_id>
        <xsl:apply-templates select="../id" mode="node_ref"/>
      </node_id>
      <predicate_id>
        <xsl:text>owl:inverseOf</xsl:text>
      </predicate_id>
      <object_id>
        <xsl:apply-templates select="." mode="node_ref"/>
      </object_id>
      <xsl:apply-templates mode="source_id" select=".."/>
    </link>
  </xsl:template>

  <xsl:template match="relationship">
    <link>
      <xsl:if test="@id">
        <!-- if the link is identified, we also create or reference a tuple in the node table -->
        <reiflink_node_id>
          <!-- use a macro lookup -->
          <xsl:value-of select="@id"/>
        </reiflink_node_id>
      </xsl:if>
      <xsl:apply-templates select="@implied"/>
      <node_id>
        <xsl:apply-templates select="../id" mode="node_ref"/>
      </node_id>
      <predicate_id>
        <xsl:apply-templates select="type" mode="node_ref"/>
      </predicate_id>
      <object_id>
        <xsl:apply-templates select="to" mode="node_ref"/>
      </object_id>
      <xsl:apply-templates mode="source_id" select=".."/>
    </link>
  </xsl:template>

  <!-- for instances: slot-values and relationships between instances -->
  <xsl:template match="property_value">
    <xsl:choose>
      <xsl:when test="datatype">
        <!-- slots -->
        <tagval>
          <node_id>
            <xsl:value-of select="../id"/>
          </node_id>
          <tag_id>
            <xsl:apply-templates select="type" mode="node_ref"/>
          </tag_id>
          <val>
            <xsl:value-of select="value"/>
          </val>
          <xsl:apply-templates mode="source_id" select=".."/>
        </tagval>
      </xsl:when>
      <xsl:otherwise>
        <!-- instance to instance links -->
        <link>
          <xsl:if test="@id">
            <!-- if the link is identified, we also create or reference a tuple in the node table -->
            <reiflink_node_id>
              <!-- use a macro lookup -->
              <xsl:value-of select="@id"/>
            </reiflink_node_id>
          </xsl:if>
          <xsl:apply-templates select="@implied"/>
          <node_id>
            <xsl:apply-templates select="../id" mode="node_ref"/>
          </node_id>
          <predicate_id>
            <xsl:apply-templates select="type" mode="node_ref"/>
          </predicate_id>
          <object_id>
            <xsl:apply-templates select="to" mode="node_ref"/>
          </object_id>
          <xsl:apply-templates mode="source_id" select=".."/>
        </link>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- intersection_ofs: collection of links -->
  <xsl:template match="intersection_of|union_of">
    <link>
      <xsl:apply-templates select="@implied"/>
      <node_id>
        <xsl:apply-templates select="../id" mode="node_ref"/>
      </node_id>
      <combinator>
        <xsl:choose>
          <xsl:when test="name(.)='intersection_of'">
            <xsl:text>I</xsl:text>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>U</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </combinator>
      <xsl:if test="@implied and @implied!='false'">
        <is_inferred>
          <xsl:text>t</xsl:text>
        </is_inferred>
      </xsl:if>
      <predicate_id>
        <xsl:choose>
          <xsl:when test="type">
            <xsl:apply-templates select="type" mode="node_ref"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>is_a</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </predicate_id>
      <object_id>
        <xsl:apply-templates select="to" mode="node_ref"/>
      </object_id>
      <xsl:apply-templates mode="source_id" select=".."/>
    </link>
  </xsl:template>

  <xsl:template name="make-anon-node-attrs">
    <xsl:param name="anon_id"/>
    <uid><xsl:value-of select="$anon_id"/></uid>
    <metatype><xsl:text>I</xsl:text></metatype>
    <is_anonymous>t</is_anonymous>
  </xsl:template>

  <xsl:template match="synonym">
    <alias>
      <label>
        <xsl:value-of select="synonym_text"/>
      </label>
      <xsl:if test="@scope">
        <scope>
          <xsl:value-of select="@scope"/>
        </scope>
      </xsl:if>
      <xsl:apply-templates mode="source_id" select=".."/>
    </alias>
  </xsl:template>

  <xsl:template match="comment">
    <description>
      <type_id>
        <node>
          <uid>comment</uid>
          <metatype><xsl:text>R</xsl:text></metatype>
        </node>
      </type_id>
      <label>
        <xsl:value-of select="."/>
      </label>
      <xsl:apply-templates mode="source_id" select=".."/>
    </description>
  </xsl:template>

  <xsl:template match="description">
    <description>
      <type_id>
        <node>
          <uid>oboMetaModel:description</uid>
          <metatype><xsl:text>R</xsl:text></metatype>
        </node>
      </type_id>
      <label>
        <xsl:value-of select="."/>
      </label>
      <xsl:apply-templates mode="source_id" select=".."/>
    </description>
  </xsl:template>

  <xsl:template match="creator">
    <tagval>
      <tag_id>
        <node>
          <uid>dc:creator</uid>
          <metatype><xsl:text>R</xsl:text></metatype>
        </node>
      </tag_id>
      <val>
        <xsl:value-of select="."/>
      </val>
      <xsl:apply-templates mode="source_id" select=".."/>
    </tagval>
  </xsl:template>

  <xsl:template match="annotation_date">
    <tagval>
      <tag_id>
        <node>
          <uid>dc:date</uid>
          <metatype><xsl:text>R</xsl:text></metatype>
        </node>
      </tag_id>
      <val>
        <xsl:value-of select="."/>
      </val>
      <xsl:apply-templates mode="source_id" select=".."/>
    </tagval>
  </xsl:template>

  <xsl:template match="provenance">
    <link>
      <predicate_id>
        <node>
          <uid>oboMetaModel:provenance</uid>
          <metatype><xsl:text>R</xsl:text></metatype>
        </node>
      </predicate_id>
      <object_id>
        <xsl:apply-templates mode="id-or-expression" select="."/>
      </object_id>
      <xsl:apply-templates mode="source_id" select=".."/>
      <is_metadata>
        <xsl:text>t</xsl:text>
      </is_metadata>
    </link>
  </xsl:template>

  <xsl:template mode="xref" match="*">
    <xsl:choose>
      <!-- typically OBO xrefs are in the form DB:ID - eg EC:1.1.1.1
           on occasion the xref is also a URI. This this case it may be
           mistakenly mis-parsed as DB=http, ID=//xxx.yyy.zzz/foo
           we correct for that here -->
      <xsl:when test="dbname='URL'">
        <xsl:value-of select="acc"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="dbname"/>
        <xsl:text>:</xsl:text>
        <xsl:value-of select="acc"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- design decision: use node_xref table? -->
  <xsl:template match="xref_analog">
    <link>
      <predicate_id>
        <node>
          <uid>oboMetaModel:xref</uid>
        </node>
      </predicate_id>
      <object_id>
        <node>
          <uid>
            <xsl:apply-templates mode="xref" select="."/>
          </uid>
        </node>
      </object_id>
      <xsl:apply-templates mode="source_id" select=".."/>
      <is_metadata>
        <xsl:text>t</xsl:text>
      </is_metadata>
    </link>
  </xsl:template>

  <xsl:template match="OLD--xref_analog">
    <node_xref>
      <xref_id>
        <node>
          <uid>
            <xsl:value-of select="acc"/>
          </uid>
          <source_id>
            <node>
              <uid>
                <xsl:value-of select="dbname"/>
              </uid>
            </node>
          </source_id>
        </node>
      </xref_id>
    </node_xref>
  </xsl:template>

  <!-- only dbxref under def -->
  <xsl:template match="dbxref" mode="is_for_definition">
    <description_xref>
      <xref_id>
        <node>
          <uid>
            <xsl:apply-templates mode="xref" select="."/>
          </uid>
        </node>
      </xref_id>
    </description_xref>
  </xsl:template>

  <!-- TODO: fix this -->
  <!-- treat alt_id as alias -->
  <xsl:template match="alt_id">
    <alias>
      <type_id>
        <node>
          <uid>alt_id</uid>
        </node>
      </type_id>
      <label>
        <xsl:value-of select="."/>
      </label>
      <xsl:apply-templates mode="source_id" select=".."/>
    </alias>
  </xsl:template>
  
  <xsl:template match="def">
    <description>
      <type_id>
        <node>
          <uid>definition</uid>
          <metatype><xsl:text>R</xsl:text></metatype>
        </node>
      </type_id>
      <label>
        <xsl:value-of select="defstr"/>
      </label>
      <xsl:if test="string-length(dbxref/acc) > 0 and string-length(dbxref/dbname) > 0">
        <xsl:apply-templates select="dbxref" mode="is_for_definition"/>
      </xsl:if>
      <xsl:apply-templates mode="source_id" select=".."/>
    </description>
  </xsl:template>

  <xsl:template match="subset">
    <link>
      <predicate_id>
        <node>
          <uid>oboMetaModel:inSubset</uid>
        </node>
      </predicate_id>
      <object_id>
        <node>
          <uid>
            <xsl:value-of select="."/>
          </uid>
        </node>
      </object_id>
      <is_metadata>
        <xsl:text>t</xsl:text>
      </is_metadata>
      <xsl:apply-templates mode="source_id" select=".."/>
    </link>
  </xsl:template>

  <!-- implied links (inferred by reasoner) -->
  <xsl:template match="@implied">
    <xsl:if test=". != 'false'">
      <is_inferred>
        <xsl:text>t</xsl:text>
      </is_inferred>
    </xsl:if>
  </xsl:template>

  <xsl:template match="*" mode="label">
    <xsl:if test=".">
      <label>
        <xsl:value-of select="."/>
      </label>
    </xsl:if>
  </xsl:template>


  <!-- also parse go_assoc xml -->
  <xsl:template match="prod">
    <node>
      <xsl:comment>
        <xsl:text>annotated entity</xsl:text>
      </xsl:comment>
      <source_id>
        <node>
          <uid>
            <xsl:value-of select="../proddb"/>
          </uid>
        </node>
      </source_id>
      <uid>
        <xsl:value-of select="../proddb"/>
        <xsl:text>:</xsl:text>
        <xsl:value-of select="prodacc"/>
      </uid>
      <xsl:call-template name="node_audit"/>
      <label>
        <xsl:value-of select="prodsymbol"/>
      </label>
      <xsl:if test="prodname">
        <alias>
          <type_id>
            <node>
              <uid>full_name</uid>
            </node>
          </type_id>
          <label>
            <xsl:value-of select="prodname"/>
          </label>
        </alias>
      </xsl:if>
      <xsl:for-each select="prodsyn">
        <alias>
          <type_id>
            <node>
              <uid>synonym</uid>
            </node>
          </type_id>
          <label>
            <xsl:value-of select="."/>
          </label>
        </alias>
      </xsl:for-each>
      <xsl:if test="prodtaxa">
        <link>
          <predicate_id>
            <xsl:text>in_organism</xsl:text> <!-- TODO -->
          </predicate_id>
          <object_id>
            <node>
              <uid>
                <xsl:text>NCBITaxon:</xsl:text>
                <xsl:value-of select="prodtaxa"/>
              </uid>
            </node>
          </object_id>
        </link>
      </xsl:if>
      <xsl:if test="prodtype">
        <link>
          <predicate_id>
            <xsl:text>is_a</xsl:text> <!-- TODO: is_a vs instance_of -->
          </predicate_id>
          <object_id>
            <node>
              <uid>
                <xsl:value-of select="prodtype"/>
              </uid>
            </node>
          </object_id>
        </link>
      </xsl:if>
      <xsl:comment>
        <xsl:text>annotations</xsl:text>
      </xsl:comment>
      <xsl:for-each select="assoc">
        <link>
          <predicate_id>
            <xsl:text>influences</xsl:text> <!-- TODO -->
          </predicate_id>
          <object_id>
            <node>
              <uid>
                <xsl:value-of select="termacc"/>
              </uid>
            </node>
          </object_id>
          <source_id>
            <node>
              <uid>
                <xsl:value-of select="../proddb"/>
              </uid>
            </node>
          </source_id>
          <xsl:call-template name="link_audit"/>
          <xsl:if test="is_not=1">
            <is_negated><xsl:text>t</xsl:text></is_negated>
          </xsl:if>
          <xsl:comment>the annotation is the attribution for the link</xsl:comment>
          <reiflink_node_id>
            <node>
              <!-- id is optional -->
              <xsl:apply-templates select="id" mode="id"/>
              <is_anonymous><xsl:text>t</xsl:text></is_anonymous>
              <is_reiflink><xsl:text>t</xsl:text></is_reiflink>
              <metatype><xsl:text>I</xsl:text></metatype>
              <!-- type -->
              <link>
                <predicate_id>
                  <xsl:text>instance_of</xsl:text>
                </predicate_id>
                <object_id>
                  <node>
                    <uid>oban:Annotation</uid>
                  </node>
                </object_id>
              </link>
              <!-- assocdata -->
              <xsl:if test="assocdate">
                <!-- TODO -->
              </xsl:if>
            </node>
          </reiflink_node_id>
        </link>
      </xsl:for-each>
    </node>
    <!-- xsl:value-of select="../proddb"/?? -->
    <!-- xsl:value-of select="prodtype"/?? -->
    <!-- xsl:value-of select="prodtaxa"/?? -->
  </xsl:template>

  <!-- obo-format 1.3 annotation extension -->
  <xsl:template match="annotation">
    <link>
      <predicate_id>
        <node>
          <uid>
            <xsl:value-of select="relation"/>
          </uid>
        </node>
      </predicate_id>
      <node_id>
        <node>
          <uid>
            <xsl:value-of select="subject"/>
          </uid>
        </node>
      </node_id>
      <object_id>
        <xsl:apply-templates select="object" mode="id-or-expression"/>
      </object_id>
      <source_id>
        <node>
          <uid>
            <xsl:value-of select="namespace"/>
          </uid>
        </node>
      </source_id>
      <xsl:call-template name="link_audit"/>
      <xsl:if test="is_negated=1">
        <is_negated>
          <xsl:text>t</xsl:text>
        </is_negated>
      </xsl:if>
      <xsl:comment>the annotation is the attributation for the link</xsl:comment>
      <reiflink_node_id>
        <node>
          
          <is_anonymous><xsl:text>t</xsl:text></is_anonymous>
          <metatype><xsl:text>I</xsl:text></metatype>
          <!-- type -->
          <link>
            <predicate_id>
              <xsl:text>instance_of</xsl:text>
            </predicate_id>
            <object_id>
              <node>
                <uid>oban:Annotation</uid>
              </node>
            </object_id>
          </link>
          <!-- note: duplicated in node and link -->
          
          <xsl:apply-templates mode="source_id" select="."/>
          <xsl:apply-templates select="description"/>
          <xsl:apply-templates select="annotation_date"/>
          <xsl:apply-templates select="provenance"/>
          <xsl:apply-templates select="context"/>
          <xsl:apply-templates select="creator"/>
        </node>
      </reiflink_node_id>
    </link>
  </xsl:template>

  <xsl:template mode="source_id" match="*">
    <source_id>
      <node>
        <uid>
          <xsl:choose>
            <xsl:when test="namespace">
              <xsl:value-of select="namespace"/>
            </xsl:when>
            <xsl:when test="contains(id,':')">
              <xsl:value-of select="substring-before(id,':')"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="//header/default-namespace"/>
            </xsl:otherwise>
          </xsl:choose>
        </uid>
        <metatype><xsl:text>I</xsl:text></metatype>
      </node>
    </source_id>
    <loaded_from_id>
      <xsl:text>__source</xsl:text>
    </loaded_from_id>
  </xsl:template>

  <!-- auditing -->
  <!-- audit source - not to be confused with namespace source... -->
  <xsl:template match="source">
    <node id="__source">
      <xsl:apply-templates select="source_id" mode="id"/>
      <xsl:apply-templates select="name" mode="label"/>
      <metatype><xsl:text>I</xsl:text></metatype>
      
      <xsl:if test="namespace">
        <source_id>
          <node>
            <uid>
              <xsl:value-of select="source_path"/>
            </uid>
          </node>
        </source_id>
      </xsl:if>

      <link>
        <predicate_id>
          <xsl:text>instance_of</xsl:text>
        </predicate_id>
        <object_id>
          <node>
            <uid>obd_meta:Document</uid>
          </node>
        </object_id>
      </link>
      <tagval>
        <tag_id>
          <node>
            <uid>obd_meta:md5</uid>
          </node>
        </tag_id>
        <val>
          <xsl:value-of select="source_md5"/>
        </val>
      </tagval>
      <tagval>
        <tag_id>
          <node>
            <uid>obd_meta:modification_time</uid>
          </node>
        </tag_id>
        <val>
          <xsl:value-of select="source_mtime"/>
        </val>
      </tagval>
      <tagval>
        <tag_id>
          <node>
            <uid>obd_meta:source_fullpath</uid>
          </node>
        </tag_id>
        <val>
          <xsl:value-of select="source_fullpath"/>
        </val>
      </tagval>
    </node>
  </xsl:template>

  <xsl:template match="*" mode="id-or-expression">
    <xsl:choose>
      <xsl:when test="intersection/link">
        <node>
          <is_anonymous>
            <xsl:text>t</xsl:text>
          </is_anonymous>
          <metatype>
            <xsl:text>C</xsl:text>
          </metatype>
          <xsl:for-each select="intersection/link">
            <link>
              <combinator>
                <xsl:text>I</xsl:text>
              </combinator>
              <predicate_id>
                <xsl:choose>
                  <xsl:when test="type">
                    <xsl:apply-templates select="type" mode="node_ref"/>
                  </xsl:when>
                  <xsl:otherwise>
                    <xsl:text>is_a</xsl:text>
                  </xsl:otherwise>
                </xsl:choose>
              </predicate_id>
              <object_id>
                <xsl:apply-templates select="to" mode="id-or-expression"/>
              </object_id>
            </link>
          </xsl:for-each>
        </node>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates select="." mode="node_ref"/> 
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template mode="uri" match="*">
    <uri>
      <xsl:apply-templates mode="translate-id" select="."/>
    </uri>
  </xsl:template>

  <xsl:template mode="translate-id" match="*">
    <xsl:choose>
      <xsl:when test="key('k_idspace',substring-before(.,':'))">
        <xsl:value-of select="key('k_idspace',substring-before(.,':'))/global"/>
        <xsl:if test="$localid_prefix">
          <xsl:value-of select="$localid_prefix"/>
        </xsl:if>
        <xsl:value-of select="substring-after(.,':')"/>
      </xsl:when>
      <xsl:when test="substring-before(.,':')">
        <xsl:text>&oboContent;</xsl:text>
        <xsl:value-of select="substring-before(.,':')"/>
        <xsl:text>#</xsl:text>
        <xsl:value-of select="substring-before(.,':')"/>
        <xsl:text>_</xsl:text>
        <xsl:if test="$localid_prefix">
          <xsl:value-of select="$localid_prefix"/>
        </xsl:if>
        <xsl:value-of select="substring-after(.,':')"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>&oboContent;</xsl:text>
        <xsl:text>_global/</xsl:text>
        <xsl:if test="$localid_prefix">
          <xsl:value-of select="$localid_prefix"/>
        </xsl:if>
        <xsl:value-of select="."/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="text()|@*">
  </xsl:template>


</xsl:stylesheet>


