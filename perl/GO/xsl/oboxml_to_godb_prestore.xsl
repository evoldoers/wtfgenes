<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <!-- transforms OBO XML format to an XML format that maps directly
       to the GO Database. This transformed XML can be loaded
       directly using the generic DBIx::DBStag module

       see also: go-dev/go-db-perl/scripts/load-go-into-db.pl

       CONSTRAINTS:

       The file to be loaded cannot have trailing IDs

       If an ID from another ontology is referenced, then that
       ontology should also be included in the load

       -->

  <xsl:output indent="yes" method="xml"/>

  <xsl:key name="terms" match="term" use="id"/>
  <xsl:key name="k-synonymtypedef" match="synonymtypedef" use="id"/>
  <xsl:key name="obs-terms-by-name" match="term[is_obsolete]" use="name"/>

  <xsl:template match="/">
    <godb_prestore>
      <dbstag_metadata>
        <map>type/term_synonym.synonym_type_id=term.id</map>
        <map>category/term_synonym.synonym_category_id=term.id</map>
        <map>property_key/term_property.property_key_id=term.id</map>
        <map>term1/term2term.term1_id=term.id</map>
        <map>term2/term2term.term2_id=term.id</map>
        <map>type/term2term.relationship_type_id=term.id</map>

        <map>term1/intersection_of.term1_id=term.id</map>
        <map>term2/intersection_of.term2_id=term.id</map>
        <map>type/intersection_of.relationship_type_id=term.id</map>

        <map>relation1/relation_composition.relation1_id=term.id</map>
        <map>relation2/relation_composition.relation2_id=term.id</map>
        <map>inferred_relation/relation_composition.inferred_relation_id=term.id</map>

        <map>term1/term2term_metadata.term1_id=term.id</map>
        <map>term2/term2term_metadata.term2_id=term.id</map>
        <map>type/term2term_metadata.relationship_type_id=term.id</map>
        <map>type/association_property.relationship_type_id=term.id</map>
        <map>type/gene_product.type_id=term.id</map>
        <map>source_db/association.source_db_id=db.id</map>
        <map>type/synonym.type_id=term.id</map>
        <map>parentfk:term2term.term2_id</map>
        <map>parentfk:term2term_metadata.term2_id</map>
        <map>parentfk:intersection_of.term2_id</map>
        <map>subset/term_subset.subset_id=term.id</map>
      </dbstag_metadata>
      <xsl:apply-templates select="*/source"/>

      <!--
      <term>
        <acc>all</acc>
        <name>all</name>
        <is_root>1</is_root>
        <term_type>universal</term_type>
        <term_definition>
          <term_definition>
            This term is the most general term possible
          </term_definition>
        </term_definition>
      </term>
      -->

      <term>
        <acc>is_a</acc>
        <name>is_a</name>
        <term_type>relationship</term_type>
        <term_definition>
          <term_definition>
            inheritance relationship
          </term_definition>
        </term_definition>
        <is_relation>1</is_relation>
      </term>
      <term>
        <acc>consider</acc>
        <name>consider</name>
        <term_type>metadata</term_type>
        <is_relation>1</is_relation>
      </term>
      <term>
        <acc>replaced_by</acc>
        <name>replaced_by</name>
        <term_type>metadata</term_type>
        <is_relation>1</is_relation>
      </term>
      <relation_properties>
        <relationship_type_id>
          <term>
            <acc>is_a</acc>
          </term>
        </relationship_type_id>
        <is_transitive>1</is_transitive>
        <is_reflexive>1</is_reflexive>
        <is_anti_symmetric>1</is_anti_symmetric>
      </relation_properties>

      <xsl:apply-templates select="*/header/subsetdef"/>

      <!-- load relationships before terms -->
      <xsl:apply-templates select="*/typedef"/>
      <xsl:apply-templates select="*/typedef" mode="relation_properties"/>
      <xsl:apply-templates select="*/term"/>
      <xsl:apply-templates select="*/term/is_a"/>
      <xsl:apply-templates select="*/typedef/is_a"/>
      <xsl:apply-templates select="*/typedef/holds_over_chain"/>
      <xsl:apply-templates select="*/typedef/transitive_over"/>
      <xsl:apply-templates select="*/term/relationship"/>
      <xsl:apply-templates select="*/term/intersection_of"/>
      <xsl:apply-templates select="assocs/dbset/prod"/>
      <xsl:apply-templates select="*/instance"/>

      <!-- experimental -->
      <xsl:apply-templates select="//homologset"/>
    </godb_prestore>
  </xsl:template>

  <xsl:template match="source">
    <source_audit>
      <xsl:copy-of select="./*"/>
    </source_audit>
  </xsl:template>

  <xsl:template match="subsetdef">
    <term>
      <acc>
        <xsl:value-of select="id"/>
      </acc>
      <name>
        <xsl:value-of select="name"/>
      </name>
      <term_type>
        <xsl:text>subset</xsl:text>
      </term_type>
    </term>
  </xsl:template>

  <xsl:template match="term">
    <term>
      <acc>
        <xsl:value-of select="id"/>
      </acc>
      <xsl:if test="name">
        <name>
          <xsl:value-of select="name"/>
        </name>
      </xsl:if>
      <xsl:if test="namespace">
        <term_type>
          <xsl:value-of select="namespace"/>
        </term_type>
      </xsl:if>
      <xsl:choose>
        <xsl:when test="is_obsolete">
          <is_obsolete>1</is_obsolete>
          <!-- add extra parentage for obsolete terms -->
          <term2term>
            <type>
              <term>
                <acc>is_a</acc>
              </term>
            </type>
            <term1>
              <term>
                <name>
                  <xsl:text>obsolete_</xsl:text>
                  <xsl:value-of select="namespace"/>
                </name>
                <acc>
                  <xsl:text>obsolete_</xsl:text>
                  <xsl:value-of select="namespace"/>
                </acc>
                <term_type>
                  <xsl:value-of select="namespace"/>
                </term_type>
                <is_obsolete>1</is_obsolete>
                <is_root>1</is_root>
              </term>
            </term1>
          </term2term>
        </xsl:when>
        <xsl:otherwise>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="is_root">
        <is_root>1</is_root>
      </xsl:if>
      <xsl:apply-templates select="def"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="subset"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog|xref"/>
      <xsl:apply-templates select="consider|replaced_by"/>
      <xsl:apply-templates select="property_value"/>
    </term>
  </xsl:template>

  <xsl:template match="typedef">
    <term>
      <acc>
        <xsl:value-of select="id"/>
      </acc>
      <name>
        <xsl:value-of select="translate(name,' ','_')"/>
      </name>
      <term_type>
        <xsl:choose>
          <xsl:when test="namespace">
            <xsl:value-of select="namespace"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:text>relationship</xsl:text>
          </xsl:otherwise>
        </xsl:choose>
      </term_type>
      <xsl:if test="is_obsolete">
        <is_obsolete>1</is_obsolete>
      </xsl:if>
      <xsl:apply-templates select="def"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog|xref"/>
      <is_relation>1</is_relation>
    </term>
  </xsl:template>

  <xsl:template match="typedef" mode="relation_properties">
    <relation_properties>
      <relationship_type_id>
        <term>
          <acc>
            <xsl:value-of select="id"/>
          </acc>
        </term>
      </relationship_type_id>
      <xsl:for-each select="(is_transitive|is_symmetric|is_anti_symmetric|is_cyclic|is_reflexive|is_metadata_tag)">
        <xsl:element name="{name(.)}">
          <xsl:value-of select="."/>
        </xsl:element>
        </xsl:for-each>
    </relation_properties>
  </xsl:template>

  <xsl:template match="*" mode="dbxref">
    <dbxref>
      <xref_dbname>
        <xsl:value-of select="substring-before(.,':')"/>    
      </xref_dbname>
      <xref_key>
        <xsl:value-of select="substring-after(.,':')"/>    
      </xref_key>
    </dbxref>
  </xsl:template>

  <xsl:template match="is_a">
    <term2term>
      <type>
        <term>
          <acc>is_a</acc>
        </term>
      </type>
      <!-- term1 is the parent/object/target -->
      <term1>
        <term>
          <acc>
            <xsl:value-of select="."/>
          </acc>
        </term>
      </term1>
      <!-- term2 is the child/subject/current -->
      <term2>
        <term>
          <acc>
            <xsl:value-of select="../id"/>
          </acc>
        </term>
      </term2>
      <xsl:if test = "@completes='true'">
        <completes>1</completes>
      </xsl:if>
    </term2term>
  </xsl:template>

  <xsl:template match="relationship">
    <term2term>
      <type>
        <term>
          <term_type>relationship</term_type>
          <name>
            <xsl:value-of select="type"/>
          </name>
          <acc>
            <xsl:value-of select="type"/>
          </acc>
        </term>
      </type>
      <term1>
        <term>
          <acc>
            <xsl:value-of select="to"/>
          </acc>
        </term>
      </term1>
      <term2>
        <term>
          <acc>
            <xsl:value-of select="../id"/>
          </acc>
        </term>
      </term2>
      <xsl:if test = "@completes='true'">
        <completes>1</completes>
      </xsl:if>
    </term2term>
  </xsl:template>

  <!-- see http://wiki.geneontology.org/index.php/Relation_composition -->
  <xsl:template match="holds_over_chain">
    <xsl:comment>
      <xsl:text>Requires relation_composition table, added to DDL 2008/10/27</xsl:text>
    </xsl:comment>
    <relation_composition>
      <inferred_relation>
        <term>
          <acc>
            <xsl:value-of select="../id"/>
          </acc>
        </term>
      </inferred_relation>
      <relation1>
        <term>
          <acc>
            <xsl:value-of select="relation[1]"/>
          </acc>
        </term>
      </relation1>
      <relation2>
        <term>
          <acc>
            <xsl:value-of select="relation[2]"/>
          </acc>
        </term>
      </relation2>
    </relation_composition>
  </xsl:template>

  <!-- see http://wiki.geneontology.org/index.php/Relation_composition -->
  <xsl:template match="transitive_over">
    <xsl:comment>
      <xsl:text>translating transitive_over meta-property to relation_composition. P transitive_over Q is the same as P.Q->P </xsl:text>
    </xsl:comment>
    <relation_composition>
      <inferred_relation>
        <term>
          <acc>
            <xsl:value-of select="../id"/>
          </acc>
        </term>
      </inferred_relation>
      <relation1>
        <term>
          <acc>
            <xsl:value-of select="../id"/>
          </acc>
        </term>
      </relation1>
      <relation2>
        <term>
          <acc>
            <xsl:value-of select="."/>
          </acc>
        </term>
      </relation2>
    </relation_composition>
  </xsl:template>

  <!-- see obo1.2 docs for more info on this tag -->
  <!-- 

 a logical definition <"oocyte nucleus" = nucleus and part_of oocyte>
 would be written in obo format as

  [Term]
  id: GO:oocyte_nucleus
  name: oocyte nucleus
  intersection_of: GO:nucleus
  intersection_of: part_of CL:oocyte

 we would have two rows in this table
 row1 = <term2="GO:oocyte nucleus" term1="GO:nucleus" rel="is_a">
 row1 = <term2="GO:oocyte nucleus" term1="CL:oocyte" rel="part_of">

  -->
  <xsl:template match="intersection_of">
    <intersection_of>
      <type>
        <term>
          <acc>
            <xsl:choose>
              <xsl:when test="type">
                <xsl:value-of select="type"/>
              </xsl:when>
              <xsl:otherwise>
                <xsl:text>is_a</xsl:text>
              </xsl:otherwise>
            </xsl:choose>
          </acc>
        </term>
      </type>

      <!-- subject -->
      <term2>
        <term>
          <acc>
            <xsl:value-of select="../id"/>
          </acc>
        </term>
      </term2>

      <!-- object -->
      <term1>
        <term>
          <acc>
            <xsl:value-of select="to"/>
          </acc>
        </term>
      </term1>
    </intersection_of>
  </xsl:template>

  <xsl:template match="synonym">
    <term_synonym>
      <term_synonym>
        <xsl:value-of select="synonym_text"/>
      </term_synonym>
      <xsl:if test="@scope != ''">
        <type>
          <term>
            <term_type>synonym_scope</term_type>
            <name>
              <xsl:value-of select="@scope"/>
            </name>
            <acc>
              <xsl:value-of select="@scope"/>
            </acc>
          </term>
        </type>
      </xsl:if>
      <xsl:if test="@synonym_type != ''">
        <category>
          <term>
            <term_type>synonym_type</term_type>
            <name>
              <xsl:value-of select="key('k-synonymtypedef',@synonym_type)/name"/>
            </name>
            <acc>
              <xsl:value-of select="@synonym_type"/>
            </acc>
          </term>
        </category>
      </xsl:if>
    </term_synonym>
  </xsl:template>
    
  <xsl:template match="subset">
    <term_subset>
      <subset>
        <term>
          <acc>
            <xsl:value-of select="."/>
          </acc>
        </term>
      </subset>
    </term_subset>
  </xsl:template>
    
  <xsl:template match="alt_id">
    <term_synonym>
      <term_synonym>
        <xsl:value-of select="."/>
      </term_synonym>
      <acc_synonym>
        <xsl:value-of select="."/>
      </acc_synonym>
      <type>
        <term>
          <term_type>synonym_type</term_type>
          <name>
            alt_id
          </name>
          <acc>
            alt_id
          </acc>
        </term>
      </type>
    </term_synonym>
  </xsl:template>
    
  <xsl:template match="xref_analog|xref">
    <term_dbxref>
      <dbxref>
        <xref_dbname>
          <xsl:value-of select="dbname"/>
        </xref_dbname>
        <xref_key>
          <xsl:value-of select="acc"/>
        </xref_key>
      </dbxref>
      <is_for_definition>0</is_for_definition>
    </term_dbxref>
  </xsl:template>
    
  <xsl:template match="property_value">
    <term_property>
      <property_key>
        <term>
          <acc>
            <xsl:value-of select="type"/>
          </acc>
        </term>
      </property_key>
      <property_val>
        <xsl:value-of select="value"/>
      </property_val>
    </term_property>
  </xsl:template>

  <xsl:template match="consider|replaced_by">
    <term2term_metadata>
      <type>
        <term>
          <acc>
            <xsl:value-of select="name(.)"/>
          </acc>
        </term>
      </type>
      <term1>
        <term>
          <acc>
            <xsl:value-of select="."/>
          </acc>
        </term>
      </term1>
    </term2term_metadata>
  </xsl:template>
    
  <xsl:template match="dbxref" mode="is_for_definition">
    <term_dbxref>
      <dbxref>
        <xref_dbname>
          <xsl:value-of select="dbname"/>
        </xref_dbname>
        <xref_key>
          <xsl:value-of select="acc"/>
        </xref_key>
      </dbxref>
      <is_for_definition>1</is_for_definition>
    </term_dbxref>
  </xsl:template>
    
  <xsl:template match="def">
    <term_definition>
      <term_definition>
        <xsl:value-of select="defstr"/>
      </term_definition>
      <!-- comment can appear in one of two places -->
      <xsl:if test="../comment">
        <term_comment>
          <xsl:value-of select="../comment"/>          
        </term_comment>
      </xsl:if>
      <xsl:if test="comment">
        <term_comment>
          <xsl:value-of select="comment"/>          
        </term_comment>
      </xsl:if>
    </term_definition>
    <xsl:apply-templates select="dbxref" mode="is_for_definition"/>
  </xsl:template>

  <xsl:template match="prod">
    <gene_product>
      <dbxref>
        <xref_dbname>
          <xsl:value-of select="../proddb"/>
        </xref_dbname>
        <xref_key>
          <xsl:value-of select="prodacc"/>
        </xref_key>
      </dbxref>
      <symbol>
        <xsl:value-of select="prodsymbol"/>
      </symbol>
      <full_name>
        <xsl:value-of select="prodname"/>
      </full_name>
      <type>
        <term>
          <term_type>sequence</term_type>
          <name>
            <xsl:value-of select="prodtype"/>
          </name>
          <acc>
            <xsl:value-of select="prodtype"/>
          </acc>
        </term>
      </type> 
      <species>
        <ncbi_taxa_id>
          <xsl:value-of select="prodtaxa"/>
        </ncbi_taxa_id>
      </species>
      <xsl:apply-templates select="assoc"/>
      <xsl:apply-templates select="prodsyn"/>
    </gene_product>
  </xsl:template>

  <xsl:template match="prodsyn">
    <gene_product_synonym>
      <product_synonym>
        <xsl:value-of select="."/>
      </product_synonym>
    </gene_product_synonym>
  </xsl:template>

  <xsl:template match="assoc">
    <association>
      <term>
        <acc>
          <xsl:value-of select="termacc"/>
        </acc>
      </term>
      <xsl:if test="is_not">
        <is_not>
          <xsl:value-of select="is_not"/>
        </is_not>
      </xsl:if>
      <xsl:apply-templates select="qualifier"/>
      <xsl:apply-templates select="species_qualifier"/>
      <xsl:apply-templates select="properties"/>
      <xsl:apply-templates select="evidence"/>
      <assocdate>
        <xsl:value-of select="assocdate"/>
      </assocdate>
      <xsl:if test="source_db">
        <source_db>
          <db>
            <name>
              <xsl:value-of select="source_db"/>
            </name>
          </db>
        </source_db>
      </xsl:if>
    </association>
  </xsl:template>

  <xsl:template match="qualifier">
    <association_qualifier>
      <term>
        <acc>
          <xsl:value-of select="."/>
        </acc>
        <!-- duplicate ID in name column -->
        <name>
          <xsl:value-of select="."/>
        </name>
        <term_type>association_qualifier</term_type>
      </term>
    </association_qualifier>
  </xsl:template>

  <xsl:template match="properties">
    <xsl:for-each select="link">
      <association_property>
        <type>
          <term>
            <acc>
              <xsl:value-of select="type"/>
            </acc>
          </term>
        </type>
        <term>
          <acc>
            <!-- todo: check for nested -->
            <xsl:value-of select="to"/>
          </acc>
        </term>
      </association_property>
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="species_qualifier">
    <association_species_qualifier>
      <species>
        <ncbi_taxa_id>
          <xsl:value-of select="."/>
        </ncbi_taxa_id>
      </species>
    </association_species_qualifier>
  </xsl:template>

  <xsl:template match="evidence">
    <evidence>
      <code>
        <xsl:value-of select="evcode"/>
      </code>
      <seq_acc>
        <xsl:value-of select="with"/>
      </seq_acc>
      <xsl:apply-templates select="ref" mode="dbxref"/>
      <xsl:apply-templates select="with"/>
    </evidence>
  </xsl:template>

  <xsl:template match="with">
    <evidence_dbxref>
      <xsl:apply-templates select="." mode="dbxref"/>
    </evidence_dbxref>
  </xsl:template>


  <!-- GO.xrf_abs data stored as generic instance data -->
  <xsl:template match="instance[instance_of='GOMetaModel:Database']">
    <db>
      <name>
        <xsl:value-of select="id"/>
      </name>
      <xsl:if test="property_value[type='GOMetaModel:database']">
        <fullname>
          <xsl:value-of select="property_value[type='GOMetaModel:database']/value"/>
        </fullname>
      </xsl:if>
      <xsl:if test="property_value[type='GOMetaModel:object']">
        <datatype>
          <xsl:value-of select="property_value[type='GOMetaModel:object']/value"/>
        </datatype>
      </xsl:if>
      <xsl:if test="property_value[type='GOMetaModel:generic_url']">
        <generic_url>
          <xsl:value-of select="property_value[type='GOMetaModel:generic_url']/value"/>
        </generic_url>
      </xsl:if>
      <xsl:if test="property_value[type='GOMetaModel:url_syntax']">
        <url_syntax>
          <xsl:value-of select="property_value[type='GOMetaModel:url_syntax']/value"/>
        </url_syntax>
      </xsl:if>
      <xsl:if test="property_value[type='GOMetaModel:url_example']">
        <url_example>
          <xsl:value-of select="property_value[type='GOMetaModel:url_example']/value"/>
        </url_example>
      </xsl:if>
    </db>
  </xsl:template>


  <xsl:template match="text()|@*">
  </xsl:template>


</xsl:stylesheet>



