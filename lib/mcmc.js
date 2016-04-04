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
	    logTermMove.bind(mcmc) (move)
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
	var progressLogger = util.progressLogger ("Sampled", "states")
	this.postMoveCallback.push (function (mcmc, move) {
	    progressLogger (move.sample + 1, move.totalSamples)
	})
    }

    function analyzeMixing() {
	var mcmc = this
	var startTime = Date.now(), moveStartMillisecs
	mcmc.traceStats = { logLikelihood: [],
			    activeTerms: mcmc.models.map (function() { return [] }),
			    moveElapsedMillisecs: {},
			    nProposedMoves: {},
			    nAcceptedMoves: {} }
	Object.keys(mcmc.moveRate).forEach (function(type) {
	    mcmc.traceStats.moveElapsedMillisecs[type] = 0
	    mcmc.traceStats.nAcceptedMoves[type] = 0
	    mcmc.traceStats.nProposedMoves[type] = 0
	})
	mcmc.preMoveCallback.push (function (mcmc) {
	    moveStartMillisecs = (new Date).getTime()
	})
	mcmc.postMoveCallback.push (function (mcmc, move) {
	    mcmc.traceStats.moveElapsedMillisecs[move.type] += (new Date).getTime() - moveStartMillisecs
	    mcmc.traceStats.logLikelihood.push (mcmc.quickCollapsedLogLikelihood())
	    mcmc.models.forEach (function (model, m) {
		mcmc.traceStats.activeTerms[m].push (model.activeTerms())
	    })
	    ++mcmc.traceStats.nProposedMoves[move.type]
	    if (move.accepted)
		++mcmc.traceStats.nAcceptedMoves[move.type]
	})
	mcmc.summaryCallback.push (function (mcmc, summ) {
	    var endTime = Date.now()
	    summ.mcmc.samplesPerSecond = mcmc.samples / (endTime - startTime)
	    var points = util.iota (Math.ceil(Math.log2(mcmc.samples))).map (function(x) { return Math.pow(2,x) })
	    console.warn ("Computing log-likelihood autocorrelations")
	    summ.mcmc.logLikeAutoCorrelation = util.autocorrelation (mcmc.traceStats.logLikelihood, points)
	    console.warn ("Computing term autocorrelations")
	    summ.mcmc.termAutoCorrelation = []
	    mcmc.models.forEach (function (model, m) {
		var activeTermTrace = mcmc.traceStats.activeTerms[m]
		var termProb = mcmc.termStateOccupancy[m].map (function (occ) {
		    return occ / mcmc.samples
		})
		var termPrecision = termProb.map (function (p) { return 1 / (p - p*p) })
		var termsHit = model.relevantTerms.filter (function (term) { return termProb[term] > 0 })
		var nTermsHit = termsHit.length

		// t = time, T = term, tmax = max time, Tmax = number of terms
		// X^T_t = term T's state at time t
		// Mean term autocorrelation = < <(x^T_t - <x^T>) (x^T_{t+tau} - <x^T>) / <(x^T_t - <x^T>)^2> >_t >_T
		// = 1/tmax 1/Tmax sum_t^tmax sum_T^Tmax (x^T_t - <x^T>) (x^T_{t+tau} - <x^T>) / (<x^T> - <x^T>^2)
		// = 1/Tmax sum_T^Tmax ((1/tmax sum_t^tmax x^T_t x^T_{t+tau}) - <x^T>^2) / (<x^T> - <x^T>^2)

		var baseline = util.sumList (termsHit.map (function (term) {
		    return termProb[term] * termProb[term] * termPrecision[term]
		}))
		var termAuto = {}
		var progressLogger = util.progressLogger ("Computed autocorrelation at", "lag times")
		points.forEach (function(tau,n) {
		    progressLogger (n + 1, points.length)
		    var R_tau = []
		    for (var i = 0; i + tau < mcmc.samples; ++i) {
			var commonTerms = util.commonElements (activeTermTrace[i], activeTermTrace[i+tau])
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

    function termSummary (modelIndex, threshold) {
        var mcmc = this
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
	var summ = { model: { prior: mcmc.prior.toJSON() },
	             mcmc: {
			 samples: mcmc.samples,
			 moveRate: mcmc.moveRate
		     },
		     summary: mcmc.models.map (function (model, modelIndex) {
			 return {
			     hypergeometricPValue: hypergeometricSummary (mcmc, modelIndex),
			     posteriorMarginal: {
				 minThreshold: threshold,
				 term: termSummary.bind(mcmc) (modelIndex, threshold),
				 gene: {
				     falsePos: geneSummary (mcmc, modelIndex, true, threshold),
				     falseNeg: geneSummary (mcmc, modelIndex, false, threshold)
				 }
			     }
			 }
		     })
		   }
	mcmc.summaryCallback.forEach (function(callback) {
	    callback (mcmc, summ)
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
        var models = conf.models
            || (conf.geneSets || [conf.geneSet]).map (function(geneSet) {
                return new Model ({ assocs: assocs,
                                    geneSet: geneSet,
                                    parameterization: parameterization,
                                    prior: prior,
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
		    analyzeMixing: analyzeMixing,

		    run: run,
		    termSummary: termSummary,
		    summary: summary
                })
    }

    module.exports = MCMC
}) ()
