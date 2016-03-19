#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    Ontology = require('./ontology'),
    Assocs = require('./assocs'),
    Model = require('./model'),
    MCMC = require('./mcmc')

var opt = getopt.create([
    ['o' , 'ontology=PATH'   , 'path to ontology file'],
    ['a' , 'assoc=PATH'      , 'path to gene-term association file'],
    ['g' , 'genes=PATH'      , 'path to gene-set file'],
    ['s' , 'samples=N'       , 'number of samples'],
    ['h' , 'help'            , 'display this help']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

var ontologyPath = opt.options['ontology']
var assocPath = opt.options['assoc']
var genesPath = opt.options['genes']
var nSamples = opt.options['samples']

function readJsonFileSync (filename) {
    if (!fs.existsSync (filename))
        throw new Error ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    return JSON.parse (data)
}

var ontologyJson = readJsonFileSync (ontologyPath)
var assocJson = readJsonFileSync (assocPath)
var genesJson = readJsonFileSync (genesPath)

var ontology = new Ontology ({termParents:ontologyJson})
var assocs = new Assocs ({ontology:ontology,assocs:assocJson})
var mcmc = new MCMC ({assocs:assocs,geneSet:genesJson})

mcmc.run (nSamples)
console.log (mcmc.summary())
