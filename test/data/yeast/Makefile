
# Scripts
SCRIPTDIR = ../../../bin
OBO2JSON = $(SCRIPTDIR)/obo2json.js
GAF2JSON = $(SCRIPTDIR)/gaf2json.js
WTFGENES = $(SCRIPTDIR)/wtfgenes.js

# Top-level rules
all: cerevisiae-test

cerevisiae: gene_association.sgd.json

pombe: gene_association.pombase.json

basic: go-basic.json

# GAF files
%: %.gz
	gunzip $<

gene_association.%.gz:
	curl -O http://geneontology.org/gene-associations/$@

gene_association.%.json: gene_association.%
	$(GAF2JSON) $< >$@

# GO-basic
go-basic.obo: 
	curl -O http://geneontology.org/ontology/$@

go-basic.json: go-basic.obo
	$(OBO2JSON) -n $< >$@

# Cerevisiae mating pathway
cerevisiae-test: go-basic.json gene_association.sgd.json
	$(WTFGENES) -o go-basic.json -a gene_association.sgd.json -g cerevisiae-mating.json -s 100 -l data

# Simulation
sim.json:
	$(WTFGENES) -o go-basic.json -a gene_association.sgd.json -B 1000 -x >$@

hypergeometric.csv model.csv: sim.json
	node -e 'fs=require("fs");d=JSON.parse(fs.readFileSync("$<"));["hypergeometric","model"].map(function(method){f=d.analysis[method].map(function(row){return[row.threshold,row.recall.mean,row.specificity.mean,row.precision.mean,row.fpr.mean,row.precision.n]});text="threshold,recall,specificity,precision,fpr,precision_n\n";f.forEach(function(row){text+=row.join(",")+"\n"});fs.writeFileSync(method+".csv",text)})'

%.reanalyzed: %
	node -e 'fs=require("fs");benchmarker=require("../../../lib/benchmarker");o=JSON.parse(fs.readFileSync("go-basic.json"));terms=o.length;d=JSON.parse(fs.readFileSync("$<"));b=new benchmarker({results:d,terms:terms});b.analyze();console.log(JSON.stringify(b.results,null,2))' >$@
