
all: jquery-1.12.2.min.js plotly-latest.min.js assets/js/wtfgenes.js

plotly-latest.min.js:
	cd web; curl -O https://cdn.plot.ly/plotly-latest.min.js

jquery-1.12.2.min.js:
	cd web; curl -O https://code.jquery.com/jquery-1.12.2.min.js

assets/js/wtfgenes.js: client.js $(wildcard ../lib/*.js)
	browserify client.js -o $@
