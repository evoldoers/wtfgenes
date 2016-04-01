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
	var samples = []
	for (var i = 0; i < n; ++i) {
	    var geneState = sim.geneName.map (function() { return false })
	    var termState = sim.termName.map (function() { return false })
	    var implicitTermState = sim.termName.map (function() { return false })
	    util.sortIndices (ontology.toposortTermOrder(), sim.assocs.relevantTerms())
		.forEach (function(term) {
		    implicitTermState[term] = ontology.parents[term].some (function(p) { return implicitTermState[p] })
		    if (!sim.excludeRedundantTerms || !implicitTermState[term]) {
			var state = sim.generator.random() < params.getParam (parameterization.names.termPrior[term])
			if (state) {
			    termState[term] = implicitTermState[term] = true
			    sim.assocs.genesByTerm[term].forEach (function (gene) {
				geneState[gene] = true
			    })
			}
		    }
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

		    excludeRedundantTerms: conf.excludeRedundantTerms,

		    generator: conf.generator || new MersenneTwister (conf.seed),

		    sampleGeneSets: sampleGeneSets
                })
    }
    
    module.exports = Simulator
}) ()
