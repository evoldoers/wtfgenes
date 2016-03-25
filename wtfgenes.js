#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    jStat = require('jStat').jStat,
    assert = require('assert'),
    util = require('./util'),
    Ontology = require('./ontology'),
    Assocs = require('./assocs'),
    Model = require('./model'),
    MCMC = require('./mcmc'),
    Simulator = require('./simulator')

var defaultSeed = 123456789
var defaultSamplesPerTerm = 100

// The default prior can be summarized as follows:
// - P(term present) = 1/#terms, sample size (#terms + 1)
// - P(false positive) = 1/#genes, sample size (#genes + 1)
// - P(false negative) = 1/#genes, sample size (#genes + 1)
var defaultTermPseudocount = 1
var defaultFalseNegPseudocount = 1
var defaultFalsePosPseudocount = 1

var defaultMoveRate = { flip: 1, swap: 1, randomize: 0 }
var defaultBenchReps = 1

var opt = getopt.create([
    ['o' , 'ontology=PATH'    , 'path to ontology file'],
    ['a' , 'assoc=PATH'       , 'path to gene-term association file'],
    ['g' , 'genes=PATH+'      , 'path to gene-set file(s)'],
    ['s' , 'samples=N'        , 'number of samples per term (default='+defaultSamplesPerTerm+')'],
    ['i' , 'ignore-missing'   , 'ignore missing terms & genes'],
    ['T',  'terms=N'          , 'pseudocount: active terms (default='+defaultTermPseudocount+')'],
    ['t',  'absent-terms=N'   , 'pseudocount: inactive terms (default=#terms)'],
    ['N',  'false-negatives=N', 'pseudocount: false negatives (default='+defaultFalseNegPseudocount+')'],
    ['p',  'true-positives=N' , 'pseudocount: true positives (default=#genes)'],
    ['P',  'false-positives=N', 'pseudocount: false positives (default='+defaultFalsePosPseudocount+')'],
    ['n',  'true-negatives=N' , 'pseudocount: true negatives (default=#genes)'],
    ['F',  'flip-rate=N'      , 'relative rate of term-toggling moves (default='+defaultMoveRate.flip+')'],
    ['S',  'swap-rate=N'      , 'relative rate of term-swapping moves (default='+defaultMoveRate.swap+')'],
    ['R',  'randomize-rate=N' , 'relative rate of term-randomizing moves (default='+defaultMoveRate.randomize+')'],
    ['l',  'log=TAG+'         , 'log various extra things (e.g. "move", "state")'],
    ['q' , 'quiet'            , 'don\'t log the usual things ("data", "progress")'],
    ['r' , 'rnd-seed=N'       , 'seed random number generator (default=' + defaultSeed + ')'],
    ['m' , 'simulate=N'       , 'instead of doing inference, simulate N gene sets'],
    ['x' , 'exclude-redundant', 'exclude redundant terms from simulation'],
    ['b' , 'benchmark'        , 'benchmark by running inference on simulated data'],
    ['B' , 'bench-reps'       , 'number of repetitions of benchmark (default='+defaultBenchReps+')'],
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
var seed = opt.options['rnd-seed'] || defaultSeed

var logTags = opt.options['log'] || []
if (!opt.options['quiet'])
    logTags.push('data','progress')
function logging(tag) { return logTags.some(function(x) { return tag == x }) }

function readJsonFileSync (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    return JSON.parse (data)
}

var ontologyJson = readJsonFileSync (ontologyPath)
var ontology = new Ontology ({termParents:ontologyJson})
if (logging('data'))
    console.warn("Read " + ontology.terms() + "-term ontology from " + ontologyPath)

var assocJson = readJsonFileSync (assocPath)
var assocs = new Assocs ({ ontology: ontology,
			   assocs: assocJson,
			   ignoreMissingTerms: opt.options['ignore-missing'] })

if (logging('data'))
    console.warn("Read " + assocs.nAssocs + " associations (" + assocs.genes() + " genes, " + assocs.relevantTerms().length + " terms) from " + assocPath)

var prior = {
    succ: {
	t: parseInt(opt.options['terms']) || defaultTermPseudocount,
	fp: parseInt(opt.options['false-positives']) || defaultFalsePosPseudocount,
	fn: parseInt(opt.options['false-negatives']) || defaultFalseNegPseudocount
    },
    fail: {
	t: parseInt(opt.options['absent-terms']) || assocs.relevantTerms().length,
	fp: parseInt(opt.options['true-negatives']) || assocs.genes(),
	fn: parseInt(opt.options['true-positives']) || assocs.genes()
    }
}

var moveRate = util.extend ({}, defaultMoveRate)
Object.keys(defaultMoveRate).forEach (function(r) {
    var arg = r + '-rate'
    if (arg in opt.options)
	moveRate[r] = parseInt (opt.options[arg])
})

if (opt.options['benchmark']) {
    var benchReps = opt.options['bench-reps'] || defaultBenchReps
    var benchResults = { model: null, mcmc: null, benchmark: [] }
    for (var benchRep = 0; benchRep < benchReps; ++benchRep) {

	if (logging('progress'))
	    console.warn("Starting benchmark repetition #" + (benchRep+1))

	var simResults = util.extend( { benchmarkDataset: benchRep+1 },
				      runSimulation() )
	var genesJson = simResults.simulation.samples.map (function(sample) { return sample.gene.observed })

	if (logging('data'))
	    console.warn("Simulated " + genesJson.length + " gene set(s) of size [" + genesJson.map(function(l){return l.length}) + "]")

	var infResults = runInference (genesJson)

	// inject inference results back into simulation data structure
	infResults.summary.forEach (function (summ, idx) {
	    simResults.simulation.samples[idx].inferenceResults = summ
	})
	benchResults.model = simResults.model
	benchResults.mcmc = infResults.mcmc
	benchResults.benchmark.push (simResults)
	delete simResults.model
    }

    function benchList (selector) {
	return benchResults.benchmark.reduce (function (list, benchmarkDataset) {
	    return list.concat (benchmarkDataset.simulation.samples.map (selector))
	}, [])
    }
    var trueTerms = benchList (function(sample) { return sample.term })
    var hyperScores = benchList (function(sample) { return sample.inferenceResults.hypergeometricPValue.term })
    var termProbs = benchList (function(sample) { return sample.inferenceResults.posteriorMarginal.term })

    benchResults.analysis = {
	hypergeometric: analyzeBenchmark (trueTerms, hyperScores, function(pvalue,threshold) { return pvalue <= threshold }),
	model: analyzeBenchmark (trueTerms, termProbs, function(postprob,threshold) { return postprob >= threshold })
    }

    showResults(benchResults)

} else if (opt.options['simulate']) {
    showResults (runSimulation())

} else {
    var genesPaths = opt.options['genes'] || inputError("You must specify at least one gene set")
    var genesJson = genesPaths.map (function(genesPath) { return readJsonFileSync (genesPath) })

    if (logging('data'))
	console.warn("Read " + genesJson.length + " gene set(s) of size [" + genesJson.map(function(l){return l.length}) + "] from [" + genesPaths + "]")

    var infResults = runInference (genesJson)
    showResults (infResults)
}

function runSimulation() {
    var sim = new Simulator ({ assocs: assocs,
			       seed: seed,
			       prior: prior,
			       excludeRedundantTerms: opt.options['exclude-redundant'] })

    return sim.sampleGeneSets (parseInt (opt.options['simulate'] || '1'))
}

function runInference (genesJson) {
    var mcmc = new MCMC ({ assocs: assocs,
			   geneSets: genesJson,
			   seed: seed,
			   prior: prior,
			   moveRate: moveRate,
			   ignoreMissingGenes: opt.options['ignore-missing']
			 })

    if (logging('move'))
	mcmc.logMoves()

    if (logging('state'))
	mcmc.logState()

    if (logging('progress'))
	mcmc.logProgress()

    var nSamples = samplesPerTerm * mcmc.nVariables()
    if (logging('data'))
	console.warn("Model has " + mcmc.nVariables() + " variables; running MCMC for " + nSamples + " steps")

    mcmc.run (nSamples)

    return mcmc.summary()
}

function analyzeBenchmark (trueTermLists, termScoreObjects, scoreCmp) {
    function getCounts (trueTermList, termScoreObject, threshold) {
	function isPastThreshold(term) {
	    return scoreCmp (termScoreObject[term], threshold)
	}
	var isNotPastThreshold = util.negate (isPastThreshold)
	var isTrueTerm = util.objPredicate (util.listToCounts (trueTermList))
	var isNotTrueTerm = util.negate (isTrueTerm)
	var termsPastThreshold = Object.keys(termScoreObject).filter (isPastThreshold)
	var count = { tp: trueTermList.filter(isPastThreshold).length,
		      fp: termsPastThreshold.filter(isNotTrueTerm).length,
		      fn: trueTermList.filter(isNotPastThreshold).length }
	count.tn = ontology.terms() - count.tp - count.fp - count.fn
	return count
    }
    function getStats(threshold) {
	var counts = trueTermLists.map (function(ttl,idx) {
	    return getCounts (ttl, termScoreObjects[idx], threshold)
	})

	function calc (param1, param2) {
	    return jStat.mean (counts
			       .filter (function(c) { return c[param1] + c[param2] > 0 })
			       .map (function(c) { return c[param1] / (c[param1] + c[param2]) }))
	}

	return { threshold: threshold,
		 recall: calc('tp','fn'),
		 specificity: calc('tn','fp'),
		 precision: calc('tp','fp'),
		 fpr: calc('fp','tn')
	       }
    }

    assert (trueTermLists.length == termScoreObjects.length)
    var termScores = termScoreObjects.reduce (function (termScoreList, termScoreObj) {
	return termScoreList.concat (Object.keys(termScoreObj).map(function(term){return termScoreObj[term]}))
    }, []).sort (util.numCmp)
    var termScoreCentiles = util.removeDups (util.iota(101).map (function(centile) {
	return Math.floor (centile * (termScores.length - 1) / 100)
    }).map (function(index) {
	return termScores[index]
    })).map(parseFloat).sort(util.numCmp)
    return termScoreCentiles.map (getStats)
}

function showResults (results) {
    console.log (JSON.stringify (results, null, 2))
}
