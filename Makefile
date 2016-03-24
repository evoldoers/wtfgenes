
all: unit-tests integration-tests

dep:
	npm install -g mocha mersennetwister jstat node-getopt

unit-tests:
	mocha

integration-tests:
	cd test/data/yeast; make

README.md: wtfgenes.js
	./wtfgenes.js -h | perl -pe 's/</&lt;/g;s/>/&gt;/g;' | perl -e 'open FILE,"<README.md";while(<FILE>){last if/<pre>/;print}close FILE;print"<pre><code>\n";while(<>){print};print"</code></pre>\n"' >temp.md
	mv temp.md $@
