
all: unit-tests integration-tests

dep:
	npm install -g mocha mersennetwister jstat node-getopt

unit-tests:
	mocha -t 5000

integration-tests:
	cd test/data/yeast; make

README.md: bin/wtfgenes.js
	bin/wtfgenes.js -h | perl -pe 's/</&lt;/g;s/>/&gt;/g;' | perl -e 'open FILE,"<README.md";while(<FILE>){last if/<pre>/;print}close FILE;print"<pre><code>\n";while(<>){print};print"</code></pre>\n"' >temp.md
	mv temp.md $@

cpp-js-comparison:
	cd test/data/yeast; make go-basic.obo gene_association.sgd
	cd cpp; make bin/wtfgenes
	time cpp/bin/wtfgenes -o test/data/yeast/go-basic.obo -a test/data/yeast/gene_association.sgd -g test/data/yeast/cerevisiae-mating.txt -s 1000
	time bin/wtfgenes.js -o test/data/yeast/go-basic.obo -a test/data/yeast/gene_association.sgd -g test/data/yeast/cerevisiae-mating.txt -s 1000
