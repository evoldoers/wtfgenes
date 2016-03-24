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
    ['g' , 'genes=PATH+'     , 'path to gene-set file'],
    ['n' , 'numsamples=N'    , 'number of samples'],
    ['i' , 'ignore-missing'  , 'ignore missing terms & genes'],
    ['A',  'term-absent=N'   , 'pseudocount for absent terms (default=#terms)'],
    ['N',  'true-positive=N' , 'pseudocount for true positives (default=#genes)'],
    ['P',  'true-negative=N' , 'pseudocount for true negatives (default=#genes)'],
    ['F',  'flip-rate=N'     , 'relative rate of term-toggling moves (default=1)'],
    ['S',  'swap-rate=N'     , 'relative rate of term-swapping moves (default=1)'],
    ['R',  'randomize-rate=N', 'relative rate of term-randomizing moves (default=0)'],
    ['l',  'log=TAG+'        , 'log various things (e.g. "move", "state")'],
    ['s' , 'seed=N'          , 'seed random number generator (default=' + defaultSeed + ')'],
    ['h' , 'help'            , 'display this help']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

function inputError(err) {
    throw new Error (err)
}

var ontologyPath = opt.options['ontology'] || inputError("You must specify an ontology")
var assocPath = opt.options['assoc'] || inputError("You must specify gene-term associations")
var genesPaths = opt.options['genes'] || inputError("You must specify a gene list")
var nSamples = opt.options['numsamples']
var seed = opt.options['seed'] || defaultSeed

function readJsonFileSync (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    return JSON.parse (data)
}

var ontologyJson = readJsonFileSync (ontologyPath)
var assocJson = readJsonFileSync (assocPath)
var genesJson = genesPaths.map (function(genesPath) { return readJsonFileSync (genesPath) })

var ontology = new Ontology ({termParents:ontologyJson})
var assocs = new Assocs ({ ontology: ontology,
			   assocs: assocJson,
			   ignoreMissingTerms: opt.options['ignore-missing'] })

var moveRate = {}
var moves = ['flip','swap','randomize']
moves.forEach (function(r) {
    var arg = r + '-rate'
    if (arg in opt.options)
	moveRate[r] = parseInt (opt.options[arg])
})

var mcmc = new MCMC ({ assocs: assocs,
		       geneSets: genesJson,
		       seed: seed,
		       prior: {
			   succ: { t: 1, fp: 1, fn: 1 },
			   fail: {
			       t: parseInt(opt.options['term-absent']) || ontology.terms(),
			       fp: parseInt(opt.options['true-negative']) || assocs.genes(),
			       fn: parseInt(opt.options['true-positive']) || assocs.genes()
			   }
		       },
		       moveRate: moveRate,
		       ignoreMissingGenes: opt.options['ignore-missing']
		     })

var logTags = opt.options['log'] || []
function logging(tag) { return logTags.some(function(x) { return tag == x }) }
if (logging('move'))
    mcmc.logMoves()
if (logging('state'))
    mcmc.logState()

mcmc.run (nSamples)
console.log (mcmc.summary())
