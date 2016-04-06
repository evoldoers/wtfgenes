#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    obo2json = require('../lib/converters').obo2json

var opt = getopt.create([
    ['e' , 'expand'           , 'do not compress output'],
    ['n' , 'names'            , 'include term names'],
    ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

function inputError(err) {
    throw new Error (err)
}

opt.argv.length || inputError ("You must specify an OBO format input file")
var expand = opt.options['expand']
var includeTermInfo = opt.options['names']

var text = ""
opt.argv.forEach (function (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    text += data.toString()
})

console.log (JSON.stringify (obo2json ({ obo: text,
					 compress: !expand,
					 includeTermInfo: includeTermInfo }),
			     null,
			     expand ? 2 : undefined))
