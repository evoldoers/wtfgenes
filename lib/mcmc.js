(function() {
    var assert = require('assert'),
        jStat = require('jStat').jStat,
	MersenneTwister = require('mersennetwister'),
	Model = require('./model'),
	Parameterization = require('./parameterization'),
	BernoulliCounts = require('./bernoulli').BernoulliCounts,
	util = require('./util'),
	extend = util.extend

    function logMove(text) {
	var mcmc = this
	console.warn ("Move #" + mcmc.samplesIncludingBurn + ": " + text)
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
	    logTermMove.bind(mcmc) (move)
	})
    }

    function logState() {
	this.postMoveCallback.push (function (mcmc, move) {
	    console.warn ("Sample #" + move.sample
                          + ": log-likelihood " + mcmc.quickCollapsedLogLikelihood()
                          + " (" + mcmc.collapsedLogLikelihood() + ")"
                          + ", state " + mcmc.models.map (function (model) {
		              return JSON.stringify (model.toJSON())
	                  }))
	})
    }
    
    function logProgress() {
	var progressLogger = util.progressLogger ("Sampled", "states")
	this.postMoveCallback.push (function (mcmc, move) {
	    progressLogger (move.sample + 1, move.totalSamples)
	})
    }

    function logActiveTerms() {
	var mcmc = this
	if (!mcmc.activeTermTrace) {
	    mcmc.activeTermTrace = mcmc.models.map (function() { return [] })
	    mcmc.postMoveCallback.push (function (mcmc, move) {
		if (mcmc.finishedBurn())
		    mcmc.models.forEach (function (model, m) {
			mcmc.activeTermTrace[m].push (model.activeTerms())
		    })
	    })
	}
    }

    function logLogLikelihood (includeBurn) {
	var mcmc = this
	if (!mcmc.logLikelihoodTrace) {
	    mcmc.logLikelihoodTrace = []
	    mcmc.postMoveCallback.push (function (mcmc, move) {
		if (includeBurn || mcmc.finishedBurn())
	            mcmc.logLikelihoodTrace.push (mcmc.quickCollapsedLogLikelihood())
	    })
	}
    }

    function logTermPairs() {
	var mcmc = this
	mcmc.termPairOccupancy = mcmc.models.map (function (model) {
	    return util.keyValListToObj (model.relevantTerms.map (function(ti,i) {
		return [ti, util.keyValListToObj (model.relevantTerms.slice(i+1).map (function(tj) {
		    return [tj, 0]
		}))]
	    }))})
	mcmc.termPairOccupancyNorm = mcmc.models.map (function (model) {
	    return util.keyValListToObj (model.relevantTerms.map (function(ti,i) {
		return [ti, 0]
	    }))
	})
	mcmc.termPairSamples = 0
	mcmc.logTermPairFunc = function (mcmc, move) {
	    if (mcmc.finishedBurn()) {
		mcmc.models.forEach (function (model, m) {
		    var active = model.activeTerms()
		    for (var i = 0; i < active.length; ++i) {
			for (var j = i + 1; j < active.length; ++j)
			    ++mcmc.termPairOccupancy[m][active[i]][active[j]]
			++mcmc.termPairOccupancyNorm[m][active[i]]
		    }
		})
		++mcmc.termPairSamples
	    }
	}
	mcmc.postMoveCallback.push (mcmc.logTermPairFunc)
    }

    function stopLoggingTermPairs() {
	var mcmc = this
	mcmc.postMoveCallback = mcmc.postMoveCallback.filter (function (func) {
	    return func !== mcmc.logTermPairFunc
	})
	delete mcmc.logTermPairFunc
	delete mcmc.termPairOccupancy
	delete mcmc.termPairOccupancyNorm
	delete mcmc.termPairSamples
    }

    function logMixing() {
	var mcmc = this
	var startTime = Date.now(), moveStartMillisecs
	mcmc.traceStats = { logLikelihood: [],
			    moveElapsedMillisecs: {},
			    nProposedMoves: {},
			    nAcceptedMoves: {} }
	Object.keys(mcmc.moveRate).forEach (function(type) {
	    mcmc.traceStats.moveElapsedMillisecs[type] = 0
	    mcmc.traceStats.nAcceptedMoves[type] = 0
	    mcmc.traceStats.nProposedMoves[type] = 0
	})
	mcmc.logActiveTerms()
	mcmc.logLogLikelihood (false)
	mcmc.preMoveCallback.push (function (mcmc) {
	    moveStartMillisecs = (new Date).getTime()
	})
	mcmc.postMoveCallback.push (function (mcmc, move) {
	    if (mcmc.finishedBurn()) {
		mcmc.traceStats.moveElapsedMillisecs[move.type] += (new Date).getTime() - moveStartMillisecs
		++mcmc.traceStats.nProposedMoves[move.type]
		if (move.accepted)
		    ++mcmc.traceStats.nAcceptedMoves[move.type]
	    }
	})
	mcmc.summaryCallback.push (function (mcmc, summ) {
	    var endTime = Date.now()
	    summ.mcmc.samplesPerSecond = mcmc.samples / (endTime - startTime)
	    var points = util.iota (Math.ceil(Math.log2(mcmc.samples))).map (function(x) { return Math.pow(2,x) })
	    console.warn ("Computing log-likelihood autocorrelations")
	    summ.mcmc.logLikeAutoCorrelation = util.autocorrelation (mcmc.logLikelihoodTrace, points)
	    console.warn ("Computing term autocorrelations")
	    summ.mcmc.termAutoCorrelation = []
	    mcmc.models.forEach (function (model, m) {
		var activeTermTrace = mcmc.activeTermTrace[m]
		assert.equal (activeTermTrace.length, mcmc.samples)
		var termProb = mcmc.termStateOccupancy[m].map (function (occ) {
		    return occ / mcmc.samples
		})
		var termPrecision = termProb.map (function (p) { return 1 / (p - p*p) })
		var dynamicTerms = model.relevantTerms.filter (function (term) {
		    var p = termProb[term]
		    return p > 0 && p < 1
		})
		var isDynamic = util.objPredicate (util.listToCounts (dynamicTerms))
		var nTermsHit = dynamicTerms.length

		// t = time, T = term, tmax = max time, Tmax = number of terms
		// X^T_t = term T's state at time t
		// Mean term autocorrelation = < <(x^T_t - <x^T>) (x^T_{t+tau} - <x^T>) / <(x^T_t - <x^T>)^2> >_t >_T
		// = 1/tmax 1/Tmax sum_t^tmax sum_T^Tmax (x^T_t - <x^T>) (x^T_{t+tau} - <x^T>) / (<x^T> - <x^T>^2)
		// = 1/Tmax sum_T^Tmax ((1/tmax sum_t^tmax x^T_t x^T_{t+tau}) - <x^T>^2) / (<x^T> - <x^T>^2)

		var baseline = util.sumList (dynamicTerms.map (function (term) {
		    return termProb[term] * termProb[term] * termPrecision[term]
		}))
		var termAuto = {}
		var progressLogger = util.progressLogger ("Computed autocorrelation at", "lag times")
		points.forEach (function(tau,n) {
		    progressLogger (n + 1, points.length)
		    var R_tau = []
		    for (var i = 0; i + tau < mcmc.samples; ++i) {
			var commonTerms = util.commonElements (activeTermTrace[i], activeTermTrace[i+tau])
			    .filter (isDynamic)
			var sum = util.sumList (commonTerms.map (function (term) { return termPrecision[term] }))
			R_tau.push (sum)
		    }
		    termAuto[tau] = (jStat.mean(R_tau) - baseline) / nTermsHit
		})
		summ.mcmc.termAutoCorrelation.push (termAuto)
	    })
	    summ.mcmc.proposedMovesPerSecond = {}
	    summ.mcmc.moveAcceptRate = {}
	    Object.keys(mcmc.moveRate).forEach(function(type) {
		summ.mcmc.moveAcceptRate[type] = mcmc.traceStats.nAcceptedMoves[type] / mcmc.traceStats.nProposedMoves[type]
		summ.mcmc.proposedMovesPerSecond[type] = 1000 * mcmc.traceStats.nProposedMoves[type] / mcmc.traceStats.moveElapsedMillisecs[type]
	    })
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

	var moveTypes = ['flip', 'step', 'jump', 'randomize']
	var moveProposalFuncs = { flip: 'proposeFlipMove',
				  step: 'proposeStepMove',
				  jump: 'proposeJumpMove',
				  randomize: 'proposeRandomizeMove' }
	var moveRates = moveTypes.map (function(t) { return mcmc.moveRate[t] })
	
	for (var sample = 0; sample < samples; ++sample) {

	    mcmc.preMoveCallback.forEach (function(callback) {
		callback (mcmc)
	    })

	    var move = { sample: sample,
			 totalSamples: samples,
			 type: moveTypes [util.randomIndex (moveRates, mcmc.generator)],
			 model: mcmc.models [util.randomIndex (mcmc.modelWeight, mcmc.generator)],
			 logLikelihoodRatio: 0,
			 accepted: false }

	    extend (move, move.model[moveProposalFuncs[move.type]].bind(move.model) ())
	    move.model.sampleMoveCollapsed (move, mcmc.countsWithPrior)

	    ++mcmc.samplesIncludingBurn
	    if (mcmc.finishedBurn()) {

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
	    }

	    mcmc.postMoveCallback.forEach (function(callback) {
		callback (mcmc, move)
	    })
	}
    }

    function termSummary (modelIndex, threshold) {
        var mcmc = this
        threshold = threshold || .01
	return util.keyValListToObj (mcmc.termStateOccupancy[modelIndex].map (function (occ, term) {
	    return [mcmc.assocs.ontology.termName[term], occ / mcmc.samples]
	}).filter (function (keyVal) { return keyVal[1] >= threshold }))
    }

    function termPairSummary (modelIndex, terms) {
        var mcmc = this
	var termIndices = terms.map (function(n) { return mcmc.assocs.ontology.termIndex[n] })
	var termName = mcmc.assocs.ontology.termName
	var pairProb = util.keyValListToObj (termIndices.map (function(t1) {
	    return [termName[t1],
		    util.keyValListToObj (termIndices
					  .filter (function(t2) { return t2 != t1 })
					  .map (function(t2) {
					      var ti, tj
					      if (t1 < t2) { ti = t1; tj = t2 }
					      else { ti = t2; tj = t1 }
					      return [termName[t2],
						      mcmc.termPairOccupancy[modelIndex][ti][tj] / mcmc.termPairSamples]
					  }))]
	}))
	var singleProb = util.keyValListToObj (termIndices.map (function(t) {
	      return [termName[t], mcmc.termPairOccupancyNorm[modelIndex][t] / mcmc.termPairSamples]
	}))
	return { pair: pairProb,
		 single: singleProb }
    }

    function geneFalsePosSummary (modelIndex, threshold) {
	return geneSummary (this, modelIndex, true, threshold)
    }

    function geneFalseNegSummary (modelIndex, threshold) {
	return geneSummary (this, modelIndex, false, threshold)
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

    function hypergeometricSummary (modelIndex, maxPValue) {
	var mcmc = this
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
	var summ = { model: { prior: mcmc.prior.toJSON() },
                     termEquivalents: {},
	             mcmc: {
			 samples: mcmc.samples,
			 burn: mcmc.burn,
			 moveRate: mcmc.moveRate
		     },
		     summary: mcmc.models.map (function (model, modelIndex) {
			 return {
			     hypergeometricPValue: hypergeometricSummary.call (mcmc, modelIndex),
			     posteriorMarginal: {
				 minThreshold: threshold,
				 term: termSummary.bind(mcmc) (modelIndex, threshold),
				 gene: {
				     falsePos: geneFalsePosSummary.bind(mcmc) (modelIndex, threshold),
				     falseNeg: geneFalseNegSummary.bind(mcmc) (modelIndex, threshold)
				 }
			     }
			 }
		     })
		   }
	mcmc.summaryCallback.forEach (function(callback) {
	    callback (mcmc, summ)
	})
        var equiv = mcmc.assocs.termEquivalents()
        summ.summary.forEach (function (s) {
            Object.keys(s.posteriorMarginal.term).forEach (function (t) {
                summ.termEquivalents[t] = equiv[t]
            })
        })
	return summ
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
	    ? new BernoulliCounts(conf.prior,parameterization.paramSet)
	    : parameterization.paramSet.laplacePrior()
	var generator = conf.generator || new MersenneTwister (conf.seed)
        var initTerms = conf.initTerms || []
        var models = conf.models
            || (conf.geneSets || [conf.geneSet]).map (function(geneSet,n) {
                return new Model ({ assocs: assocs,
                                    geneSet: geneSet,
                                    parameterization: parameterization,
                                    prior: prior,
                                    initTerms: initTerms[n],
				    generator: generator })
            })
	var geneSets = models.map (function(model) { return model.geneSet })
        
	var moveRate = conf.moveRate
            ? extend ( { flip: 0, step: 0, jump: 0, randomize: 0 }, conf.moveRate)
            : { flip: 1, step: 1, jump: 0, randomize: 0 }

        extend (mcmc,
                {
		    assocs: assocs,
                    paramSet: parameterization.paramSet,
                    prior: prior,
                    models: models,
		    nVariables: nVariables,

		    geneSets: geneSets,
		    hypergeometric: geneSets.map (function (geneSet) {
			return assocs.hypergeometricPValues (geneSet)
		    }),

		    countsWithPrior: getCounts(models,prior),
		    computeCounts: function() {
			return getCounts (this.models, this.paramSet.newCounts())
		    },
		    computeCountsWithPrior: function() {
			return getCounts (this.models, this.prior)
		    },
		    collapsedLogLikelihood: function() {
			return this.computeCounts().logBetaBernoulliLikelihood (this.prior)
		    },
		    quickCollapsedLogLikelihood: function() {
			return this.countsWithPrior.subtract(this.prior).logBetaBernoulliLikelihood (this.prior)
		    },
		    
		    generator: generator,
		    
		    moveRate: moveRate,
		    modelWeight: models.map (function(model) {
			return model.relevantTerms.length
		    }),
                    
                    samples: 0,
                    samplesIncludingBurn: 0,
		    burn: 0,
		    finishedBurn: function() { return this.samplesIncludingBurn > this.burn },

                    termStateOccupancy: models.map (function(model) {
                        return model.termName.map (function() { return 0 })
                    }),
		    geneFalseOccupancy: models.map (function(model) {
                        return model.geneName.map (function() { return 0 })
                    }),
		    
		    preMoveCallback: [],
		    postMoveCallback: [],
		    summaryCallback: [],

		    logMoves: logMoves,
		    logState: logState,
		    logProgress: logProgress,
		    logActiveTerms: logActiveTerms,
		    logMixing: logMixing,
		    logLogLikelihood: logLogLikelihood,
                    logRandomNumbers: function() { util.logRandomNumbers(this.generator) },
                    
		    logTermPairs: logTermPairs,
		    stopLoggingTermPairs: stopLoggingTermPairs,

		    run: run,
		    hypergeometricSummary: hypergeometricSummary,
		    termSummary: termSummary,
		    geneFalsePosSummary: geneFalsePosSummary,
		    geneFalseNegSummary: geneFalseNegSummary,
		    termPairSummary: termPairSummary,
		    summary: summary
                })
    }

    module.exports = MCMC
}) ()
