(function() {
    var assert = require('assert'),
        jStat = require('jStat').jStat,
	util = require('./util'),
	extend = util.extend
    
    function add (simResults, infResults) {
        var benchmarker = this
        simResults = util.extend( { benchmarkDataset: benchmarker.results.benchmark.length + 1 },
				  simResults)
        // inject inference results back into simulation data structure
	infResults.summary.forEach (function (summ, idx) {
	    simResults.simulation.samples[idx].inferenceResults = summ
	})
	benchmarker.results.model = simResults.model
	benchmarker.results.mcmc = infResults.mcmc
	delete simResults.model
	benchmarker.results.benchmark.push (simResults)
    }

    function benchList (benchmarker, selector) {
	return benchmarker.results.benchmark.reduce (function (list, benchmarkDataset) {
	    return list.concat (benchmarkDataset.simulation.samples.map (selector))
	}, [])
    }

    function selectTerm (sample) { return sample.term }
    function selectHyperScores (sample) { return sample.inferenceResults.hypergeometricPValue.term }
    function selectTermProbs (sample) { return sample.inferenceResults.posteriorMarginal.term }
    
    function underThreshold (pvalue, threshold) { return pvalue <= threshold }
    function overThreshold (postprob, threshold) { return postprob >= threshold }
    
    function analyzeScoring (benchmarker, trueTermLists, termScoreObjects, scoreCmp) {

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
	    count.tn = benchmarker.terms - count.tp - count.fp - count.fn
	    return count
        }
        
        function getStats(threshold) {
	    var counts = trueTermLists.map (function(ttl,idx) {
	        return getCounts (ttl, termScoreObjects[idx], threshold)
	    })

	    function calc (param1, param2) {
	        var x = counts
		    .filter (function(c) { return c[param1] + c[param2] > 0 })
		    .map (function(c) { return c[param1] / (c[param1] + c[param2]) })
	        return { mean: jStat.mean(x), stdev: jStat.stdev(x,true), n: x.length }
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
	    return termScoreList.concat (util.values(termScoreObj))
        }, []).sort (util.numCmp)
        var termScoreCentiles = util.removeDups (util.iota(101).map (function(centile) {
	    return Math.floor (centile * (termScores.length - 1) / 100)
        }).map (function(index) {
	    return termScores[index]
        })).map(parseFloat).sort(util.numCmp)
        return termScoreCentiles.map (getStats)
    }

    function analyze() {
        var trueTerms = benchList (this, selectTerm)
        var hyperScores = benchList (this, selectHyperScores)
        var termProbs = benchList (this, selectTermProbs)

        this.results.analysis = {
	    hypergeometric: analyzeScoring (this, trueTerms, hyperScores, underThreshold),
	    model: analyzeScoring (this, trueTerms, termProbs, overThreshold)
        }
    }

    function Benchmarker (conf) {
        var benchmarker = this
	
        extend (benchmarker,
                {
                    terms: conf.terms || conf.ontology.terms() || conf.assocs.ontology.terms(),
		    results: conf.results
			|| {
                            model: null,
                            mcmc: null,
                            benchmark: [],
                            analysis: null
			},
                    add: add,
                    analyze: analyze
                })
    }
    
    module.exports = Benchmarker
}) ()
