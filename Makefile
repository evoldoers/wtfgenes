
dep:
	npm install -g mocha mersennetwister jstat node-getopt

tests:
	mocha
	cd test/data/yeast; make
