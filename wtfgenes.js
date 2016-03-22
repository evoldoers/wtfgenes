#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    Ontology = require('./ontology'),
    Assocs = require('./assocs'),
    Model = require('./model'),
    MCMC = require('./mcmc')

var defaultSeed = 123456789

var opt = getopt.create([
    ['o' , 'ontology=PATH'   , 'path to ontology file'],
    ['a' , 'assoc=PATH'      , 'path to gene-term association file'],
    ['g' , 'genes=PATH'      , 'path to gene-set file'],
    ['A',  'term-absent=N'   , 'pseudocount for absent terms (default=#terms)'],
    ['N',  'true-positive=N' , 'pseudocount for true positives (default=#genes)'],
    ['P',  'true-negative=N' , 'pseudocount for true negatives (default=#genes)'],
    ['n' , 'numsamples=N'    , 'number of samples'],
    ['s' , 'seed=N'          , 'seed random number generator (default=' + defaultSeed + ')'],
    ['h' , 'help'            , 'display this help']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

var ontologyPath = opt.options['ontology']
var assocPath = opt.options['assoc']
var genesPath = opt.options['genes']
var nSamples = opt.options['numsamples']
var seed = opt.options['seed'] || defaultSeed

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
var mcmc = new MCMC ({ assocs: assocs,
		       geneSet: genesJson,
		       seed: seed,
		       prior: {
			   succ: { t: 1, fp: 1, fn: 1 },
			   fail: {
			       t: opt.options['term-absent'] || ontology.terms(),
			       fp: opt.options['true-negative'] || assocs.genes(),
			       fn: opt.options['true-positive'] || assocs.genes()
			   }
		       }
		     })

mcmc.run (nSamples)
console.log (mcmc.summary())
