#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt')

var opt = getopt.create([
    ['s' , 'symbol'           , 'use gene symbol, rather than database ID'],
    ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

function inputError(err) {
    throw new Error (err)
}

opt.argv.length || inputError ("You must specify a GOA format input file")
var useSymbol = opt.options['symbol']

var assocs = []
opt.argv.forEach (function (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    data.toString().split("\n").forEach (function (line) {
	if (!line.match(/^\s*\!/)) {
	    var fields = line.split("\t")
	    if (fields.length >= 7) {
		var id = fields[useSymbol ? 2 : 1]
		var qualifier = fields[3]
		var go_id = fields[4]
		if (qualifier != "NOT")
		    assocs.push ([id, go_id])
	    }
	}
    })
})

console.log(assocs)
