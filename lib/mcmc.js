(function() {
    var assert = require('assert'),
	MersenneTwister = require('mersennetwister'),
	Model = require('./model'),
	Parameterization = require('./parameterization'),
	BernoulliCounts = require('./bernoulli').BernoulliCounts,
	util = require('./util'),
	extend = util.extend

    function logMove(text) {
	var mcmc = this
	console.warn ("Move #" + mcmc.samples + ": " + text)
    }

    function logTermMove(move) {
	var mcmc = this
	logMove.bind(mcmc)("(" + Object.keys(move.termStates).map (function(t) {
	    return mcmc.assocs.ontology.termName[t] + "=>" + move.termStates[t]
	}) + ") " + JSON.stringify(move.delta) + " HastingsRatio=" + move.hastingsRatio + " "
		+ (move.accepted ? "Accept" : "Reject"))
    }

    function logMoves() {
	var mcmc = this
	mcmc.postMoveCallback.push (function (mcmc, move) {
	    switch (move.type) {
	    case 'flip':
	    case 'swap':
	    case 'randomize':
		logTermMove.bind(mcmc) (move)
		break

	    case 'param':
		logMove.bind(mcmc) ("Params " + JSON.stringify(mcmc.params.toJSON()))
		break

	    default:
		break;
	    }
	})
    }

    function logState() {
	this.postMoveCallback.push (function (mcmc, move) {
	    console.warn ("State #" + mcmc.samples + ": " + mcmc.models.map (function (model) {
		return JSON.stringify (model.toJSON())
	    }))
	})
    }
    
    function logProgress() {
	var startTime = Date.now(), lastTime = startTime, delay = 1000
	this.postMoveCallback.push (function (mcmc, move) {
	    var nowTime = Date.now()
	    if (nowTime - lastTime > delay) {
		lastTime = nowTime
		delay = Math.min (30000, delay*2)
		var progress = move.sample / move.totalSamples
		console.warn ("Sampled " + (move.sample+1) + "/" + move.totalSamples + " states (" + Math.round(100*progress) + "%), estimated time left " + util.toHHMMSS ((1/progress - 1) * (nowTime - startTime)))
	    }
	})
    }

    function getCounts(models,prior) {
	return models.reduce (function(c,m) {
	    return c.accum (m.getCounts())
	}, prior.copy())
    }

    function run(samples) {
	var mcmc = this

	if (util.sumList(mcmc.modelWeight) == 0) {
	    console.warn ("Refusing to run MCMC on a model with no variables")
	    return
	}

	var moveRate = { flip: mcmc.moveRate.flip,
			 swap: 0,  // set this later: it depends on number of active terms
			 randomize: mcmc.moveRate.randomize }
	
	var moveTypes = ['flip', 'swap', 'randomize']
	
	for (var sample = 0; sample < samples; ++sample) {
	    
	    var nActiveTerms = mcmc.models.map (function(model) { return model.activeTerms.length })
	    moveRate.swap = mcmc.moveRate.swap * util.sumList (nActiveTerms)

	    mcmc.preMoveCallback.forEach (function(callback) {
		callback (mcmc, moveRate)
	    })

	    var move = { sample: sample,
			 totalSamples: samples,
			 type: moveTypes [util.randomIndex (moveTypes.map(function(t){return moveRate[t]}),
							    mcmc.generator)] }

	    switch (move.type) {
	    case 'flip':
		move.model = mcmc.models [util.randomIndex (mcmc.modelWeight)]
		extend (move, move.model.proposeFlipMove.bind(move.model) ())
		move.model.sampleMoveCollapsed (move, mcmc.countsWithPrior)
		break

	    case 'swap':
		move.model = mcmc.models [util.randomIndex (nActiveTerms)]
		extend (move, move.model.proposeSwapMove.bind(move.model) ())
		move.model.sampleMoveCollapsed (move, mcmc.countsWithPrior)
		break

	    case 'randomize':
		move.model = mcmc.models [util.randomIndex (mcmc.modelWeight)]
		extend (move, move.model.proposeRandomizeMove.bind(move.model) ())
		move.model.sampleMoveCollapsed (move, mcmc.countsWithPrior)
		break

	    default:
		throw new Error ("Invalid move type: " + move.type)
		break;
	    }

	    ++mcmc.samples

	    mcmc.models.forEach (function(model,n) {
		var termStateOccupancy = mcmc.termStateOccupancy[n]
		model.activeTerms().forEach (function(term) {
		    ++termStateOccupancy[term]
		})
		var geneFalseOccupancy = mcmc.geneFalseOccupancy[n]
		model.falseGenes().forEach (function(gene) {
		    ++geneFalseOccupancy[gene]
		})
	    })

	    mcmc.postMoveCallback.forEach (function(callback) {
		callback (mcmc, move)
	    })
	}
    }

    function termSummary (mcmc, modelIndex, threshold) {
        threshold = threshold || .01
	return util.keyValListToObj (mcmc.termStateOccupancy[modelIndex].map (function (occ, term) {
	    return [mcmc.assocs.ontology.termName[term], occ / mcmc.samples]
	}).filter (function (keyVal) { return keyVal[1] >= threshold }))
    }

    function geneSummary (mcmc, modelIndex, wantGeneSet, threshold) {
	var model = mcmc.models[modelIndex]
        threshold = threshold || .01
	return util.keyValListToObj (mcmc.geneFalseOccupancy[modelIndex].map (function (occ, gene) {
	    return [gene, occ / mcmc.samples]
	}).filter (function (keyVal) {
	    var inGeneSet = model.inGeneSet[keyVal[0]]
	    return keyVal[1] >= threshold && (wantGeneSet ? inGeneSet : !inGeneSet)
	}).map (function (keyVal) {
	    return [mcmc.assocs.geneName[keyVal[0]], keyVal[1]]
	}))
    }

    function hypergeometricSummary (mcmc, modelIndex, maxPValue) {
	maxPValue = maxPValue || .05  // default 95% significance
        var multiMaxPValue = maxPValue / mcmc.assocs.terms()  // Bonferroni correction
	return { maxThreshold: maxPValue,
                 bonferroniMaxThreshold: multiMaxPValue,
                 term: util.keyValListToObj (mcmc.hypergeometric[modelIndex].map (function (pvalue, term) {
	             return [mcmc.assocs.ontology.termName[term], pvalue]
	         }).filter (function (keyVal) { return keyVal[1] <= multiMaxPValue }))
               }
    }

    function summary (threshold) {
	var mcmc = this
        threshold = threshold || .01
	return { model: { prior: mcmc.prior.toJSON() },
	         mcmc: {
		     samples: mcmc.samples,
		     moveRate: mcmc.moveRate
		 },
		 summary: mcmc.models.map (function (model, modelIndex) {
		     return {
			 hypergeometricPValue: hypergeometricSummary (mcmc, modelIndex),
			 posteriorMarginal: {
                             minThreshold: threshold,
			     term: termSummary (mcmc, modelIndex, threshold),
			     gene: {
				 falsePos: geneSummary (mcmc, modelIndex, true, threshold),
				 falseNeg: geneSummary (mcmc, modelIndex, false, threshold)
			     }
			 }
		     }
		 })
	       }
    }

    function nVariables() {
	return util.sumList (this.models.map (function (model) {
	    return model.relevantTerms.length
	}))
    }
    
    function MCMC (conf) {
        var mcmc = this

        var assocs = conf.assocs
        var parameterization = conf.parameterization || new Parameterization (conf)
        var prior = conf.prior
	    ? new BernoulliCounts(conf.prior,parameterization.params)
	    : parameterization.params.laplacePrior()
	var generator = conf.generator || new MersenneTwister (conf.seed)
        var models = conf.models
            || (conf.geneSets || [conf.geneSet]).map (function(geneSet) {
                return new Model ({ assocs: assocs,
                                    geneSet: geneSet,
                                    parameterization: parameterization,
                                    prior: prior,
				    generator: generator,
				    ignoreMissingGenes: conf.ignoreMissingGenes })
            })
	var geneSets = models.map (function(model) { return model.geneSet })
        
	var moveRate = conf.moveRate
            ? extend ( { flip: 0, swap: 0, param: 0, randomize: 0 }, conf.moveRate)
            : { flip: 1, swap: 1, param: 0, randomize: 0 }

        extend (mcmc,
                {
		    assocs: assocs,
                    params: parameterization.params,
                    prior: prior,
                    models: models,
		    nVariables: nVariables,

		    geneSets: geneSets,
		    hypergeometric: geneSets.map (function (geneSet) {
			return assocs.hypergeometricPValues (geneSet)
		    }),

		    countsWithPrior: getCounts(models,prior),
		    computeCounts: function() {
			return getCounts (this.models, this.params.newCounts())
		    },
		    computeCountsWithPrior: function() {
			return getCounts (this.models, this.prior)
		    },
		    collapsedLogLikelihood: function() {
			return this.computeCounts().logBetaBernoulliLikelihood (this.prior)
		    },
		    
		    generator: generator,
		    
		    moveRate: moveRate,
		    modelWeight: models.map (function(model) {
			return model.relevantTerms.length
		    }),
                    
                    samples: 0,
                    termStateOccupancy: models.map (function(model) {
                        return model.termName.map (function() { return 0 })
                    }),
		    geneFalseOccupancy: models.map (function(model) {
                        return model.geneName.map (function() { return 0 })
                    }),
		    
		    preMoveCallback: [],
		    postMoveCallback: [],

		    logMoves: logMoves,
		    logState: logState,
		    logProgress: logProgress,

		    run: run,
		    summary: summary
                })
    }

    module.exports = MCMC
}) ()
