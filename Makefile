
all: unit-tests integration-tests

dep:
	npm install -g mocha mersennetwister jstat node-getopt

unit-tests:
	mocha

integration-tests:
	cd test/data/yeast; make
