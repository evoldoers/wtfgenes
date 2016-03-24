
PERLDIR = ../../../perl
GO2JSON = $(PERLDIR)/go2json.pl
ASSOCS2JSON = $(PERLDIR)/assocs2json.pl

all: cerevisiae pombe

cerevisiae: goslim_yeast.json gene_association.sgd.json

pombe: goslim_pombe.json gene_association.pombase.json

goslim_%.obo:
	curl -O http://geneontology.org/ontology/subsets/goslim_$*.obo

goslim_%.json: goslim_%.obo
	$(GO2JSON) $< >$@

gene_association.%.gz:
	curl -O http://geneontology.org/gene-associations/gene_association.$*.gz

gene_association.%.json: gene_association.%.gz
	$(ASSOCS2JSON) -symbol $< >$@

cerevisiae-test: cerevisiae
	../../../wtfgenes.js -o goslim_yeast.json -a gene_association.sgd.json -g cerevisiae-mating.json -n 10000 -i
