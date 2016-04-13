
all: assets/js/jquery-1.12.2.min.js assets/js/plotly-latest.min.js assets/js/wtfgenes.js

assets/js/plotly-latest.min.js:
	cd assets/js; curl -O https://cdn.plot.ly/plotly-latest.min.js

assets/js/jquery-1.12.2.min.js:
	cd assets/js; curl -O https://code.jquery.com/jquery-1.12.2.min.js

assets/js/wtfgenes.js: client.js $(wildcard ../lib/*.js)
	browserify client.js -o $@
