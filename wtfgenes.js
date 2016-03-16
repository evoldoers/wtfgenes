#!/usr/bin/env node

var deferred = require('deferred'),
    fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt')

var opt = getopt.create([
    ['o' , 'ontology=PATH'   , 'path to ontology file'],
    ['a' , 'assoc=PATH'      , 'path to gene-term association file'],
    ['g' , 'genes=PATH'      , 'path to gene-set file'],
    ['h' , 'help'            , 'display this help']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

var ontologyPath = opt.options['ontology']
var assocPath = opt.options['assoc']
var genesPath = opt.options['genes']

function readJsonFileSync (filename) {
    if (!fs.existsSync (filename))
        throw new Error ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    return JSON.parse (data)
}

var ontologyJson = readJsonFileSync (ontologyPath)
var assocJson = readJsonFileSync (assocPath)
var genesJson = readJsonFileSync (genesPath)

