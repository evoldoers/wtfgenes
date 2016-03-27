#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    goa2json = require('./converters').goa2json

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

var text = ""
opt.argv.forEach (function (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    text += data.toString()
})

console.log (JSON.stringify (goa2json ({ goa: text,
					 useSymbol: useSymbol })))
