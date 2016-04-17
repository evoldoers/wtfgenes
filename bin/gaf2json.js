#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    gaf2json = require('../lib/converters').gaf2json

var opt = getopt.create([
    ['d' , 'database-id'      , 'use database ID, rather than gene symbol'],
    ['m' , 'merge-duplicates' , 'merge aliases in >1 set, instead of discarding'],
    ['a' , 'aliases=PATH'     , 'file of aliases (synonyms on same line)'],
    ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

function inputError(err) {
    throw new Error (err)
}

opt.argv.length || inputError ("You must specify a GAF input file")
var useDatabaseID = opt.options['database-id']

var text = ""
opt.argv.forEach (function (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    text += data.toString()
})

var aliases
if ('aliases' in opt.options)
    aliases = fs.readFileSync(opt.options.aliases).toString()

console.log (JSON.stringify (gaf2json ({ gaf: text,
                                         aliases: aliases,
                                         mergeDuplicates: opt.options['merge-duplicates'],
					 useDatabaseID: useDatabaseID })))
