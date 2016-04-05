
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

webclient: jquery plotly web/wtfgenes.js

jquery: web/jquery-1.12.2.min.js

plotly: web/plotly-latest.min.js

web/plotly-latest.min.js:
	cd web; curl -O https://cdn.plot.ly/plotly-latest.min.js

web/jquery-1.12.2.min.js:
	cd web; curl -O https://code.jquery.com/jquery-1.12.2.min.js

web/wtfgenes.js: web/client.js
	browserify $< -o $@

cpp-js-comparison:
	cd test/data/yeast; make go-basic.obo gene_association.sgd
	cd cpp; make bin/wtfgenes
	time cpp/bin/wtfgenes -o test/data/yeast/go-basic.obo -a test/data/yeast/gene_association.sgd -g test/data/yeast/cerevisiae-mating.txt -s 1000
	time bin/wtfgenes.js -o test/data/yeast/go-basic.obo -a test/data/yeast/gene_association.sgd -g test/data/yeast/cerevisiae-mating.txt -s 1000
