
# Scripts
SCRIPTDIR = ../../../bin
OBO2JSON = $(SCRIPTDIR)/obo2json.js
GOA2JSON = $(SCRIPTDIR)/goa2json.js
WTFGENES = $(SCRIPTDIR)/wtfgenes.js

# Data
ONTOLOGY = go-basic.obo
ASSOCS = gene_association.fb

# Top-level rules
all: sim.json

# Gene-term associations
%: %.gz
	gunzip $<

gene_association.%.gz:
	curl -O http://geneontology.org/gene-associations/$@

# Ontology
go-basic.obo: 
	curl -O http://geneontology.org/ontology/$@

# Simulation
sim.json: go-basic.obo gene_association.fb
	$(WTFGENES) -o $(ONTOLOGY) -a $(ASSOCS) -B 1500 -x -T 3 -p 1 -N 9 -n 4 -P 6 >$@

hypergeometric.csv model.csv: sim.json
	node -e 'fs=require("fs");d=JSON.parse(fs.readFileSync("$<"));["hypergeometric","model"].map(function(method){f=d.analysis[method].map(function(row){return[row.threshold,row.recall.mean,row.specificity.mean,row.precision.mean,row.fpr.mean,row.precision.n]});text="threshold,recall,specificity,precision,fpr,precision_n\n";f.forEach(function(row){text+=row.join(",")+"\n"});fs.writeFileSync(method+".csv",text)})'

%.reanalyzed: %
	node -e 'fs=require("fs");benchmarker=require("../../../lib/benchmarker");o=JSON.parse(fs.readFileSync("go-basic.json"));terms=o.length;d=JSON.parse(fs.readFileSync("$<"));b=new benchmarker({results:d,terms:terms});b.analyze();console.log(JSON.stringify(b.results,null,2))' >$@
