(function() {
    var assert = require('assert'),
	MersenneTwister = require('mersennetwister'),
	Parameterization = require('./parameterization'),
	BernoulliCounts = require('./bernoulli').BernoulliCounts,
	util = require('./util'),
	extend = util.extend

    function sampleGeneSets(n) {
	var sim = this
	n = n || 1
	var ontology = sim.assocs.ontology
	var parameterization = sim.parameterization
	var params = sim.prior.sampleParams (sim.generator)
	if (sim.simParams)
	    params.setParams (sim.simParams)
	var samples = []
	for (var i = 0; i < n; ++i) {
	    var geneState = sim.geneName.map (function() { return false })
	    var termState = sim.termName.map (function() { return false })
	    var implicitTermState = sim.termName.map (function() { return false })
	    if (sim.nActiveTerms) {
		var rt = sim.assocs.relevantTerms()
		for (var i = 0; i < rt.length - 1; ++i) {  // Fisher-Yates shuffle
		    var j = Math.min (rt.length - 1, i + Math.floor (sim.generator.random() * (rt.length - i)))
		    var tmp = rt[i]
		    rt[i] = rt[j]
		    rt[j] = tmp
		}
		var trans = ontology.transitiveClosure()
		var nTerms = 0
		for (var n = 0; n < rt.length && nTerms < sim.nActiveTerms; ++n) {
		    var term = rt[n]
		    if (!termState[term]) {
			termState[term] = true
			if (sim.excludeRedundantTerms)
			    trans[term].forEach (function (t) {
				termState[t] = true
			    })
			++nTerms
		    }
		}
		if (nTerms < sim.nActiveTerms)
		    console.warn ("Warning: " + sim.nActiveTerms + " simulated terms requested; could only generate " + nTerms + " terms")
	    } else
		util.sortIndices (ontology.toposortTermOrder(), sim.assocs.relevantTerms())
		.forEach (function(term) {
		    implicitTermState[term] = ontology.parents[term].some (function(p) { return implicitTermState[p] })
		    if (!sim.excludeRedundantTerms || !implicitTermState[term]) {
			var state = sim.generator.random() < params.getParam (parameterization.names.termPrior[term])
			if (state)
			    termState[term] = implicitTermState[term] = true
		    }
		})
	    termState.forEach (function (state, term) {
		if (state)
		    sim.assocs.genesByTerm[term].forEach (function (gene) {
			geneState[gene] = true
		    })
	    })
	    var geneObservedState = geneState.map (function(state,gene) {
		var falseParam = state ? parameterization.names.geneFalseNeg : parameterization.names.geneFalsePos
		var isFalse = sim.generator.random() < params.getParam (falseParam[gene])
		return isFalse ? !state : state
	    })
	    var geneSet = sim.geneName.filter (function(name,gene) {
		return geneObservedState[gene]
	    })
	    samples.push ({ term: sim.termName.filter (function(name,term) { return termState[term] }),
			    gene: {
				true: sim.geneName.filter (function(name,gene) { return geneState[gene] }),
				falsePos: sim.geneName.filter (function(name,gene) {
				    return !geneState[gene] && geneObservedState[gene] }),
				falseNeg: sim.geneName.filter (function(name,gene) {
				    return geneState[gene] && !geneObservedState[gene] }),
				observed: geneSet
			    }
			  })
	}
	return { model: { prior: sim.prior.toJSON() },
		 simulation: {
		     params: params,
		     samples: samples
		 } }
    }
    
    function Simulator (conf) {
        var sim = this

	var assocs = conf.assocs
	var termName = assocs.ontology.termName
	var geneName = assocs.geneName

        var parameterization = conf.parameterization || new Parameterization (conf)
        var prior = conf.prior
	    ? new BernoulliCounts(conf.prior,parameterization.paramSet)
	    : parameterization.paramSet.laplacePrior()
	
        extend (sim,
                {
                    assocs: assocs,
		    termName: termName,
		    geneName: geneName,

                    genes: function() { return this.assocs.genes() },
                    terms: function() { return this.assocs.terms() },

		    parameterization: parameterization,
                    prior: prior,

		    simParams: conf.simParams,
		    nActiveTerms: conf.nActiveTerms,
		    excludeRedundantTerms: conf.excludeRedundantTerms,
		    
		    generator: conf.generator || new MersenneTwister (conf.seed),

		    sampleGeneSets: sampleGeneSets
                })
    }
    
    module.exports = Simulator
}) ()
