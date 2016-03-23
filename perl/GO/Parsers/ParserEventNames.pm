=head1 NAME

  GO::Parsers::ParserEventNames - exports constants corresponding to XML

=head1 SYNOPSIS

  use GO::Parsers::ParserEventNames;



=cut

=head1 DESCRIPTION

=head1 AUTHOR

=cut

package GO::Parsers::ParserEventNames;
use strict;
use base qw(Exporter);
use vars qw(@EXPORT);

use constant OBO => 'obo';
use constant HEADER => 'header';
use constant SUBSETDEF => 'subsetdef';

use constant TYPEDEF => 'typedef';
use constant IS_CYCLIC => 'is_cyclic';
use constant IS_TRANSITIVE => 'is_transitive';
use constant IS_SYMMETRIC  => 'is_symmetric';
use constant IS_ANTI_SYMMETRIC  => 'is_anti_symmetric';
use constant IS_REFLEXIVE  => 'is_reflexive';
use constant IS_METADATA_TAG  => 'is_metadata_tag';
use constant DISJOINT_FROM => 'disjoint_from';
use constant INVERSE_OF => 'inverse_of';
use constant TRANSITIVE_OVER => 'transitive_over';
use constant DOMAIN => 'domain';
use constant RANGE => 'range';
use constant TERM => 'term';
use constant ID => 'id';
use constant IS_ANONYMOUS => 'is_anonymous';
use constant ACC => 'acc';
use constant NAMESPACE => 'namespace';
use constant NAME => 'name';
use constant SUBSET => 'subset';
use constant DEF => 'def';
use constant DEFSTR => 'defstr';
use constant IS_ROOT => 'is_root';
use constant IS_OBSOLETE => 'is_obsolete';
use constant BUILTIN => 'builtin';
use constant IS_A => 'is_a';
use constant INSTANCE_OF => 'instance_of';
use constant RELATIONSHIP => 'relationship';
use constant INTERSECTION_OF => 'intersection_of';
use constant UNION_OF => 'union_of';
use constant ALT_ID => 'alt_id';
use constant SYNONYM => 'synonym';
use constant COMMENT => 'comment';
use constant TO => 'to';
use constant TYPE => 'type';
use constant XREF => 'xref';
use constant XREF_ANALOG => 'xref_analog';
use constant XREF_UNKNOWN => 'xref_unknown';
use constant DBXREF => 'dbxref';
use constant TERM_DBXREF => 'term_dbxref';
use constant SYNONYM_TEXT => 'synonym_text';
use constant SYNONYM_TYPE => 'synonym_type';
use constant CONSIDER => 'consider';
use constant REPLACED_BY => 'replaced_by';

use constant INSTANCE => 'instance';
use constant PROPERTY_VALUE => 'property_value';
use constant VALUE => 'value';
use constant DATATYPE => 'datatype';

use constant DBSET => 'dbset';
use constant DBNAME => 'dbname';
use constant PROD => 'prod';
use constant PRODDB => 'proddb';
use constant PRODNAME => 'prodname';
use constant PRODSYMBOL => 'prodsymbol';
use constant PRODACC => 'prodacc';
use constant PRODTAXA => 'prodtaxa';
use constant PRODTYPE => 'prodtype';
use constant SECONDARY_PRODTAXA => 'secondary_prodtaxa'; # DEPRECATED
use constant PRODSYN => 'prodsyn';
use constant ISOFORM => 'isoform';

use constant ASSOCS => 'assocs';
use constant ASSOC => 'assoc';
use constant QUALIFIER => 'qualifier';
use constant SPECIES_QUALIFIER => 'species_qualifier';
use constant PROPERTIES => 'properties';
use constant ASPECT => 'aspect';
use constant SOURCE_DB => 'source_db';
use constant TERMACC => 'termacc';
use constant IS_NOT => 'is_not';
use constant ASSOCDATE => 'assocdate';
use constant WITH => 'with';
use constant REF => 'ref';
use constant EVIDENCE => 'evidence';
use constant EVCODE => 'evcode';

use constant DBXREFS => 'dbxrefs';


@EXPORT = qw(
  OBO 
    HEADER
             SUBSETDEF
    TYPEDEF             
             IS_CYCLIC
             IS_TRANSITIVE
             IS_SYMMETRIC
             IS_ANTI_SYMMETRIC
             IS_REFLEXIVE
             IS_METADATA_TAG
             DISJOINT_FROM
             INVERSE_OF
             TRANSITIVE_OVER
             DOMAIN
             RANGE
    TERM             
             ID 
             IS_ANONYMOUS
             ACC 
             NAMESPACE 
             NAME 
             SUBSET
             DEF 
               DEFSTR 
             IS_OBSOLETE 
             IS_ROOT 
             IS_A 
             BUILTIN
             RELATIONSHIP 
               TO 
               TYPE 
             INTERSECTION_OF
             UNION_OF
             SYNONYM
               SYNONYM_TYPE 
               SYNONYM_TEXT 
             ALT_ID 
             CONSIDER
             REPLACED_BY
             COMMENT 
             XREF
             XREF_ANALOG 
             XREF_UNKNOWN
             DBXREF 
               TERM_DBXREF 

  INSTANCE
             INSTANCE_OF
             PROPERTY_VALUE
               VALUE
               DATATYPE
  ASSOCS
             DBSET
               DBNAME
               PROD 
                 PRODDB 
                 PRODNAME 
                 PRODSYMBOL 
                 PRODACC 
                 PRODTAXA
                 PRODTYPE 
                 SECONDARY_PRODTAXA 
                 PRODSYN 
                 ISOFORM

                 ASSOC 
                   QUALIFIER
                   SPECIES_QUALIFIER
                   PROPERTIES
                   ASPECT 
                   SOURCE_DB 
                   TERMACC 
                   IS_NOT 
                   ASSOCDATE 
                   EVIDENCE 
                     EVCODE 
                     WITH 
                     REF 
  DBXREFS
            );

1;
