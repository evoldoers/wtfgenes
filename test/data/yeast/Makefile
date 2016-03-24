
# Scripts
PERLDIR = ../../../perl
GO2JSON = $(PERLDIR)/go2json.pl
QUICK_GO2JSON = $(PERLDIR)/quick-go2json.pl
ASSOCS2JSON = $(PERLDIR)/assocs2json.pl

WTFGENES = ../../../wtfgenes.js

# Top-level rules
all: cerevisiae-test

cerevisiae: goslim_yeast.json gene_association.sgd.json

pombe: goslim_pombe.json gene_association.pombase.json

basic: go-basic.json

# GOA files
gene_association.%.gz:
	curl -O http://geneontology.org/gene-associations/$@

gene_association.%.json: gene_association.%.gz
	$(ASSOCS2JSON) -symbol $< >$@

# GO-basic
go-basic.obo: 
	curl -O http://geneontology.org/ontology/$@

go-basic.json: go-basic.obo
	cat $< | $(QUICK_GO2JSON) >$@

# Cerevisiae mating pathway
cerevisiae-test: go-basic.json gene_association.sgd.json
	$(WTFGENES) -o go-basic.json -a gene_association.sgd.json -g cerevisiae-mating.json -s 100 -i -l data

# These slims don't seem to be very useful (they lack terms from the GOA files)
# but here are the rules anyway:
goslim_%.obo:
	curl -O http://geneontology.org/ontology/subsets/$@

goslim_%.json: goslim_%.obo
	$(GO2JSON) $< >$@
