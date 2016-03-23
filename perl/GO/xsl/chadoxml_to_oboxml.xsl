DEPRECATED< NOT COMPLETE

<?xml version = "1.0"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<!-- chadoxml xml can be loaded into a chado db using XML::XORT -->

<!-- does not build transitive closure -->

  <xsl:output indent="yes" method="xml"/>

  <xsl:key name="terms" match="term" use="id"/>

  <xsl:template match="/">
    <chado>

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

      <!-- contact_id should really be nullable -->
      <contact op="force" id="no_contact">
        <name>no contact</name>
      </contact>
      <db op="force" id="obo_rel">
        <name>OBO_REL</name>
        <contact_id>no_contact</contact_id>
      </db>
      <db op="force" id="internal">
        <name>internal</name>
        <contact_id>no_contact</contact_id>
      </db>
      <cvterm op="force" id="comment_type">
        <dbxref_id>
          <dbxref>
            <db_id>internal</db_id>
            <accession>cvterm_property_type</accession>
          </dbxref>
        </dbxref_id>
        <cv_id>cvterm_property_type</cv_id>
        <name>comment</name>
      </cvterm>

      <cvterm op="force" id="is_a">
        <dbxref_id>
          <dbxref>
            <db_id>obo_rel</db_id>
            <accession>is_a</accession>
          </dbxref>
        </dbxref_id>
        <cv_id>relationship</cv_id>
        <name>is_a</name>
        <is_relationship_type>1</is_relationship_type>
      </cvterm>

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
        <is_relationship_type>1</is_relationship_type>
      </cvterm>

      <!-- terms can appear in different obo file types -->
      <xsl:apply-templates select="*/typedef"/>
      <xsl:apply-templates select="*/term"/>
      <xsl:apply-templates select="*/term/is_a"/>
      <xsl:apply-templates select="*/term/relationship"/>
      <xsl:apply-templates select="*/typedef/is_a"/>

    </chado>
  </xsl:template>

  <xsl:template match="term">
    <cvterm>
      <dbxref_id>
        <xsl:apply-templates select="id" mode="dbxref"/>
      </dbxref_id>
      <name>
        <xsl:value-of select="name"/>
      </name>
      <cv_id>
        <cv>
          <name>
            <xsl:value-of select="namespace"/>
          </name>
        </cv>
      </cv_id>
      <xsl:if test="is_obsolete">
        <is_obsolete>1</is_obsolete>
      </xsl:if>
      <xsl:apply-templates select="def"/>
      <xsl:apply-templates select="comment"/>
      <xsl:apply-templates select="synonym"/>
      <xsl:apply-templates select="alt_id"/>
      <xsl:apply-templates select="xref_analog"/>
    </cvterm>
  </xsl:template>

  <xsl:template match="typedef">
    <cvterm>
      <dbxref_id>
        <dbxref>
          <db_id>obo_rel</db_id>
          <accession>
            <xsl:value-of select="id"/>
          </accession>
        </dbxref>
      </dbxref_id>
      <name>
        <xsl:value-of select="name"/>
      </name>
      <xsl:choose>
        <xsl:when test="namespace">
          <cv_id>
            <cv>
              <name>
                <xsl:value-of select="namespace"/>
              </name>
            </cv>
          </cv_id>
        </xsl:when>
        <xsl:otherwise>
          <cv_id>relationship</cv_id>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="is_obsolete">
        <is_obsolete>1</is_obsolete>
      </xsl:if>
      <is_relationship_type>1</is_relationship_type>
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

  <xsl:template match="*" mode="dbxref">
    <dbxref>
      <db_id>
        <db>
          <contact_id>no_contact</contact_id>
          <name>
            <xsl:value-of select="substring-before(.,':')"/>    
          </name>
        </db>
      </db_id>
      <accession>
        <xsl:value-of select="substring-after(.,':')"/>    
      </accession>
    </dbxref>
  </xsl:template>

  <xsl:template match="is_a">
    <cvterm_relationship>
      <type_id>is_a</type_id>
      <subject_id>
        <cvterm op="lookup">
          <dbxref_id>
            <xsl:apply-templates select="../id" mode="dbxref"/>
          </dbxref_id>
        </cvterm>
      </subject_id>
      <object_id>
        <cvterm op="lookup">
          <dbxref_id>
            <xsl:apply-templates select="." mode="dbxref"/>
          </dbxref_id>
        </cvterm>
      </object_id>
    </cvterm_relationship>
  </xsl:template>

  <xsl:template match="type">
    <cvterm op="lookup">
      <cv_id>relationship</cv_id>
      <name>
        <xsl:value-of select="."/>
      </name>
      <is_relationship_type>1</is_relationship_type>
      <!-- dbxref is the same as the name for relationships -->
      <dbxref_id>
        <dbxref>
          <db_id>obo_rel</db_id>
          <accession>
            <xsl:value-of select="type"/>
          </accession>
        </dbxref>
      </dbxref_id>
    </cvterm>
  </xsl:template>

  <xsl:template match="relationship">
    <cvterm_relationship>
      <type_id>
        <xsl:apply-templates select="type"/>
      </type_id>
      <subject_id>
        <cvterm op="lookup">
          <dbxref_id>
            <xsl:apply-templates select="../id" mode="dbxref"/>
          </dbxref_id>
        </cvterm>
      </subject_id>
      <object_id>
        <cvterm op="lookup">
          <dbxref_id>
            <xsl:apply-templates select="to" mode="dbxref"/>
          </dbxref_id>
        </cvterm>
      </object_id>
    </cvterm_relationship>
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
        <cvterm op="lookup">
          <dbxref_id>
            <xsl:apply-templates select="../id" mode="dbxref"/>
          </dbxref_id>
        </cvterm>
      </subject_id>
      <object_id>
        <xsl:choose>
          <xsl:when test="type">
            <!-- anonymous term -->
            <cvterm>
              <dbxref_id>
                <xsl:call-template name="make-anon-term">
                  <xsl:with-param name="anon_id" select="concat(../id)"/>
                </xsl:call-template>
              </dbxref_id>
              <cvterm_relationship>
                <type_id>
                  <xsl:apply-templates select="type"/>
                </type_id>
                <object_id>
                  <cvterm op="lookup">
                    <dbxref_id>
                      <xsl:apply-templates select="to" mode="dbxref"/>
                    </dbxref_id>
                  </cvterm>
                </object_id>
              </cvterm_relationship>
            </cvterm>
          </xsl:when>
          <xsl:otherwise>
            <cvterm op="lookup">
              <dbxref_id>
                <xsl:apply-templates select="to" mode="dbxref"/>
              </dbxref_id>
            </cvterm>
          </xsl:otherwise>
        </xsl:choose>
      </object_id>
    </cvterm_relationship>
  </xsl:template>

  <xsl:template match="synonym">
    <cvtermsynonym>
      <synonym>
        <xsl:value-of select="synonym_text"/>
      </synonym>
      <xsl:if test="type">
        <type_id>
          <cvterm>
            <dbxref_id>
              <dbxref>
                <db_id>internal</db_id>
                <accession>
                  <xsl:value-of select="type"/>
                </accession>
              </dbxref>
            </dbxref_id>
            <cv_id>synonym_type</cv_id>
            <name>
              <xsl:value-of select="type"/>
            </name>
          </cvterm>
        </type_id>
      </xsl:if>
    </cvtermsynonym>
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
              <contact_id>no_contact</contact_id>
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
              <contact_id>no_contact</contact_id>
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
    <xsl:apply-templates select="dbxref" mode="is_for_definition"/>
  </xsl:template>

  <xsl:template match="prod">
    <feature>
      <dbxref>
        <db>
          <contact_id>no_contact</contact_id>
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
            <contact_id>no_contact</contact_id>
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
      <cvterm>
        <xsl:apply-templates select="termacc" mode="dbxref"/>
      </cvterm>
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



