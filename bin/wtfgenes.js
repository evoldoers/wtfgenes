#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    MersenneTwister = require('mersennetwister'),
    assert = require('assert'),
    util = require('../lib/util'),
    Ontology = require('../lib/ontology'),
    Assocs = require('../lib/assocs'),
    Model = require('../lib/model'),
    MCMC = require('../lib/mcmc'),
    Simulator = require('../lib/simulator'),
    Benchmarker = require('../lib/benchmarker'),
    converters = require('../lib/converters')

var defaultSeed = 123456789
var defaultSamplesPerTerm = 100
var defaultBurnPerTerm = 10

var defaultPriorMode = .5
var defaultPriorCount = 0

var defaultMoveRate = { flip: 1, step: 1, jump: 1, randomize: 0 }
var defaultBenchReps = 1

var opt = getopt.create([
    ['o' , 'ontology=PATH'    , 'path to ontology file'],
    ['a' , 'assoc=PATH'       , 'path to gene-term association file'],
    ['g' , 'genes=PATH+'      , 'path to gene-set file(s)'],
    ['s' , 'samples=N'        , 'number of samples per term (default='+defaultSamplesPerTerm+')'],
    ['u' , 'burn=N'           , 'number of burn-in samples per term (default='+defaultBurnPerTerm+')'],
    ['t',  'term-prob=N'      , 'mode of term probability prior (default='+defaultPriorMode+')'],
    ['T',  'term-count=N'     , '#pseudocounts of term probability prior (default='+defaultPriorCount+')'],
    ['n',  'false-neg-prob=N' , 'mode of false negative prior (default='+defaultPriorMode+')'],
    ['N',  'false-neg-count=N', '#pseudocounts of false negative prior (default='+defaultPriorCount+')'],
    ['p',  'false-pos-prob=N' , 'mode of false positive prior (default='+defaultPriorMode+')'],
    ['P',  'false-pos-count=N', '#pseudocounts of false positive prior (default='+defaultPriorCount+')'],
    ['F',  'flip-rate=N'      , 'relative rate of term-toggling moves (default='+defaultMoveRate.flip+')'],
    ['S',  'step-rate=N'      , 'relative rate of term-stepping moves (default='+defaultMoveRate.step+')'],
    ['J',  'jump-rate=N'      , 'relative rate of term-jumping moves (default='+defaultMoveRate.jump+')'],
    ['R',  'randomize-rate=N' , 'relative rate of term-randomizing moves (default='+defaultMoveRate.randomize+')'],
    ['i',  'init-terms=LIST+' , 'specify initial state as comma-separated term list'],
    ['l',  'log=TAG+'         , 'log extra things (e.g. "move", "state", "mixing")'],
    ['q' , 'quiet'            , 'don\'t log the usual things ("data", "progress")'],
    ['r' , 'rnd-seed=N'       , 'seed random number generator (default=' + defaultSeed + ')'],
    ['m' , 'simulate=N'       , 'instead of doing inference, simulate N gene sets'],
    ['x' , 'exclude-redundant', 'exclude redundant terms from simulation'],
    ['X' , 'exclude-ancestral', 'exclude ancestral terms from simulation'],
    ['w' , 'exclude-with=N'   , 'exclude terms with >=N gene associations from simulation'],
    ['A' , 'active-terms=N'   , 'specify number of active terms for simulation'],
    ['O' , 'false-pos=P'      , 'specify false positive probability for simulation'],
    ['E' , 'false-neg=P'      , 'specify false negative probability for simulation'],
    ['b' , 'benchmark'        , 'benchmark by running inference on simulated data'],
    ['B' , 'bench-reps=N'     , 'number of repetitions of benchmark (default='+defaultBenchReps+')'],
    ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

function inputError(err) {
    throw new Error (err)
}

var ontologyPath = opt.options['ontology'] || inputError("You must specify an ontology")
var assocPath = opt.options['assoc'] || inputError("You must specify gene-term associations")

var samplesPerTerm = opt.options['samples'] ? parseInt(opt.options['samples']) : defaultSamplesPerTerm
var burnPerTerm = opt.options['burn'] ? parseInt(opt.options['burn']) : defaultBurnPerTerm
var seed = opt.options['rnd-seed'] || defaultSeed

var logTags = opt.options['log'] || []
if (!opt.options['quiet'])
    logTags.push('data','progress')
function logging(tag) { return logTags.some(function(x) { return tag == x }) }

function readJsonFileSync (filename, alternateParser) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    var result
    try {
	result = JSON.parse (data)
    } catch (err) {
	if (alternateParser)
	    result = alternateParser (data.toString())
	else
	    throw err
    }
    return result
}

var ontologyJson = readJsonFileSync (ontologyPath, converters.obo2json)
var ontology = new Ontology (ontologyJson)
if (logging('data'))
    console.warn("Read " + ontology.terms() + "-term ontology from " + ontologyPath)

var assocJson = readJsonFileSync (assocPath, converters.gaf2json)
var assocs = new Assocs ({ ontology: ontology,
			   idAliasTerm: assocJson.idAliasTerm })

if (logging('data'))
    console.warn("Read " + assocs.nAssocs + " associations (" + assocs.genes() + " genes, " + assocs.relevantTerms().length + " terms) from " + assocPath)

var prior = { succ:{}, fail:{} }
var paramArg = { t: 'term', fp: 'false-pos', fn: 'false-neg' }
Object.keys(paramArg).forEach (function(param) {
    var arg = paramArg[param]
    var probArg = arg + '-prob', countArg = arg + '-count'
    var prob = (probArg in opt.options) ? opt.options[probArg] : defaultPriorMode
    var count = (countArg in opt.options) ? opt.options[countArg] : defaultPriorCount
    prior.succ[param] = prob * count
    prior.fail[param] = (1 - prob) * count
})

var moveRate = util.extend ({}, defaultMoveRate)
Object.keys(defaultMoveRate).forEach (function(r) {
    var arg = r + '-rate'
    if (arg in opt.options)
	moveRate[r] = parseFloat (opt.options[arg])
})

var _generator
function generator() {
    _generator = _generator || new MersenneTwister (seed)
    return _generator
}
if (logging('rnd'))
    util.logRandomNumbers (generator())

if (opt.options['benchmark'] || opt.options['bench-reps']) {
    var benchReps = opt.options['bench-reps'] ? parseInt(opt.options['bench-reps']) : defaultBenchReps
    var benchResults = { model: null, mcmc: null, benchmark: [] }
    var benchmarker = new Benchmarker ({ terms: ontology.terms() })
    for (var benchRep = 0; benchRep < benchReps; ++benchRep) {

	if (logging('progress'))
	    console.warn("Starting benchmark repetition #" + (benchRep+1))

	var simResults = runSimulation()

	var genesJson = simResults.simulation.samples.map (function(sample) { return sample.gene.observed })
	if (logging('data'))
	    console.warn("Simulated " + genesJson.length + " gene set(s) of size [" + genesJson.map(function(l){return l.length}) + "]")

	var infResults = runInference (genesJson)

        benchmarker.add (simResults, infResults)
    }

    benchmarker.analyze()
    showResults (benchmarker.results)

} else if (opt.options['simulate']) {
    showResults (runSimulation())

} else {
    var genesPaths = opt.options['genes'] || inputError("You must specify at least one gene set")
    var genesJson = genesPaths.map (function(genesPath) { return readJsonFileSync (genesPath, converters.flatfile2list) })

    if (logging('data'))
	console.warn("Read " + genesJson.length + " gene set(s) of size [" + genesJson.map(function(l){return l.length}) + "] from [" + genesPaths + "]")

    var infResults = runInference (genesJson)
    showResults (infResults)
}

function runSimulation() {
    var simParams = {}
    function addSimParam (arg, param) {
	if (arg in opt.options)
	    simParams[param] = parseFloat (opt.options[arg])
    }
    addSimParam ('false-pos', 'fp')
    addSimParam ('false-neg', 'fn')

    var sim = new Simulator ({ assocs: assocs,
			       generator: generator(),
			       prior: prior,
			       nActiveTerms: opt.options['active-terms'],
			       simParams: simParams,
			       excludeRedundantTerms: opt.options['exclude-redundant'],
			       excludeAncestralTerms: opt.options['exclude-ancestral'],
			       termAssociationCutoff: opt.options['exclude-with'] })

    return sim.sampleGeneSets (parseInt (opt.options['simulate'] || '1'))
}

function runInference (genesJson) {
    var mcmc = new MCMC ({ assocs: assocs,
			   geneSets: genesJson,
			   generator: generator(),
			   prior: prior,
                           initTerms: ('init-terms' in opt.options) ? opt.options['init-terms'].map (function(s) { return s.split(',') }) : undefined,
			   moveRate: moveRate
			 })

    if (logging('move'))
	mcmc.logMoves()

    if (logging('state'))
	mcmc.logState()

    if (logging('progress'))
	mcmc.logProgress()

    if (logging('mixing'))
	mcmc.logMixing()

    var nSamples = samplesPerTerm * mcmc.nVariables()
    mcmc.burn = burnPerTerm * mcmc.nVariables()
    if (logging('data'))
	console.warn("Model has " + mcmc.nVariables() + " variables; running MCMC for " + nSamples + " steps + " + mcmc.burn + " burn-in")

    mcmc.run (nSamples + mcmc.burn)

    return mcmc.summary()
}

function showResults (results) {
    console.log (JSON.stringify (results, null, 2))
}
