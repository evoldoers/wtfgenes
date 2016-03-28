
# Scripts
SCRIPTDIR = ../../../bin
OBO2JSON = $(SCRIPTDIR)/obo2json.js
GOA2JSON = $(SCRIPTDIR)/goa2json.js
WTFGENES = $(SCRIPTDIR)/wtfgenes.js

# Top-level rules
all: cerevisiae-test

cerevisiae: gene_association.sgd.json

pombe: gene_association.pombase.json

basic: go-basic.json

# GOA files
%: %.gz
	gunzip $<

gene_association.%.gz:
	curl -O http://geneontology.org/gene-associations/$@

gene_association.%.json: gene_association.%
	$(GOA2JSON) $< >$@

# GO-basic
go-basic.obo: 
	curl -O http://geneontology.org/ontology/$@

go-basic.json: go-basic.obo
	$(OBO2JSON) $< >$@

# Cerevisiae mating pathway
cerevisiae-test: go-basic.json gene_association.sgd.json
	$(WTFGENES) -o go-basic.json -a gene_association.sgd.json -g cerevisiae-mating.json -s 100 -i -l data

# Simulation
sim.json:
	$(WTFGENES) -o go-basic.json -a gene_association.sgd.json -B 1000 -x >$@
