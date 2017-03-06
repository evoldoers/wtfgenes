(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {
    var util = require('./util'),
	extend = util.extend,
	jStat = require('jstat').jStat,
	assert = require('assert')

    function toJSON(conf) {
        var assocs = this
        conf = conf || {}
        if (conf.shortForm) {
            var gt = []
            for (var g = 0; g < assocs.genes(); ++g)
                assocs.termsByGene[g].forEach (function(t) {
                    gt.push ([assocs.geneName[g], assocs.ontology.termName[t]])
                })
            return gt
        }
        var seen = {}
        var idAliasTerm = assocs.geneName.map (function(gn,gi) {
            seen[gn.toUpperCase()] = 1
            return [gn,[],assocs.termsByGene[gi].map (assocs.ontology.getTermName.bind(assocs.ontology))]
        })
        Object.keys(assocs.geneIndex).sort().forEach (function(gn) {
            var uc = gn.toUpperCase()
            if (!seen[uc]) {
                seen[uc] = true
                var gi = assocs.geneIndex[gn]
                if (gn != assocs.geneName[gi])
                    idAliasTerm[gi][1].push(gn)
            }
        })
        return { idAliasTerm: idAliasTerm }
    }

    function hypergeometricPValues (geneSet) {
	var assocs = this
	var ontology = assocs.ontology
	return assocs.genesByTerm.map (function (genesForTerm, term) {
	    var genesForTermInSet = geneSet.filter (function (gene) {
		return assocs.geneHasTerm[gene][term]
	    })
	    var n = assocs.genes(),
		nPresent = genesForTerm.length,
		nAbsent = n - nPresent,
		nInSet = geneSet.length,
		logDenominator = util.logBinomialCoefficient(n,nInSet),
		p = 0
	    for (var nPresentInSet = genesForTermInSet.length;
		 nPresentInSet <= nInSet && nPresentInSet <= nPresent;
		 ++nPresentInSet) {
		var nAbsentInSet = nInSet - nPresentInSet
		p += Math.exp (util.logBinomialCoefficient(nPresent,nPresentInSet)
			       + util.logBinomialCoefficient(nAbsent,nAbsentInSet)
			       - logDenominator)
	    }
	    return p
	})
    }

    function validateGeneNames (geneNames) {
        var assocs = this
        var missing = {}
        var geneIndices = []
        var suppliedGeneName = assocs.geneName.slice(0)
	var regex = /^\s*(.+?)\s*$/
	geneNames.map (function (name) {
	    var match = regex.exec(name)
	    if (match != null) {
		var g = match[1]
		if (g in assocs.geneIndex) {
                    var gi = assocs.geneIndex[g]
		    geneIndices.push (gi)
                    suppliedGeneName[gi] = g
		} else if (g.toUpperCase() in assocs.geneIndex) {
                    var gi = assocs.geneIndex[g.toUpperCase()]
		    geneIndices.push (gi)
                    suppliedGeneName[gi] = g
		} else
		    missing[g] = (missing[g] || 0) + 1
	    }
        })
	var missingGeneNames = Object.keys(missing)
        return { geneNames: geneNames,
		 resolvedGeneIndices: util.removeDups(geneIndices),
                 missingGeneNames: missingGeneNames,
                 suppliedGeneName: suppliedGeneName }
    }
    
    function Assocs (conf) {
        var assocs = this
        conf = extend ({closure:true}, conf)
	var ontology = conf.ontology
        if (conf.assocs) {
	    var geneTermList = conf.assocs
            conf.idAliasTerm = geneTermList.map (function(gt) {
                return [gt[0], [], [gt[1]]]
            })
        }
        var idAliasTerm = conf.idAliasTerm
        extend (assocs,
                { 'ontology': ontology,
                  'geneName': [],
                  'geneIndex': {},

                  'genesByTerm': [],
                  'termsByGene': [],
		  'geneHasTerm': {},

                  'genes': function() { return this.geneName.length },
                  'terms': function() { return this.ontology.terms() },

		  'relevantTerms': function() {
		      var assocs = this
		      return util.iota(assocs.terms()).filter (function(term) {
			  return assocs.genesByTerm[term].length > 0
                              && assocs.termIsExemplar(term)
                              && !ontology.doNotAnnotate[term]
		      })
		  },
		  'relevantTermsForGeneSet': function (geneSet) {
		      var assocs = this
		      return util.removeDups (geneSet.reduce (function(termList,g) {
			  return termList.concat (assocs.termsByGene[g])
		      }, [])).filter (function (term) {
			  return assocs.termIsExemplar(term)
                              && !ontology.doNotAnnotate[term]
		      }).sort(util.numCmp)
		  },

                  'equivClassByTerm': [],
                  'termsInEquivClass': [],
		  'getExemplar': function(termIndex) {
                      return this.termsInEquivClass[this.equivClassByTerm[termIndex]][0]
		  },
                  'termIsExemplar': function(termIndex) {
                      return this.getExemplar(termIndex) == termIndex
                  },
                  'termEquivalents': function() {
                      var assocs = this
                      return util.keyValListToObj (assocs.termsInEquivClass.filter (function(l) {
                          return l.length > 1
                      }).map (function(l) {
                          var n = l.map (function(ti) { return assocs.ontology.termName[ti] })
                          return [n[0], n.slice(1)]
                      }))
                  },
                  
		  'nAssocs': 0,
		  'hypergeometricPValues': hypergeometricPValues,
                  'validateGeneNames': validateGeneNames,
                  'toJSON': toJSON
                })

        var closure
        if (conf.closure)
            closure = ontology.transitiveClosure()
        else {
            closure = []
            for (var t = 0; t < ontology.terms(); ++t)
                closure.push ([t])
        }

        var gtCount = [], missing = {}
        idAliasTerm.forEach (function(iat) {
            var gene = iat[0]
            var aliases = iat[1]
            var terms = iat[2]

            if (!(gene in assocs.geneIndex)) {
                var gi = assocs.genes()
                assocs.geneName.push (gene)
                gtCount.push ({})
                assocs.geneIndex[gene] = gi
                assocs.geneIndex[gene.toUpperCase()] = gi
                assocs.geneIndex[gene.toLowerCase()] = gi
                aliases.forEach (function (alias) {
                    assocs.geneIndex[alias] = gi
                    assocs.geneIndex[alias.toUpperCase()] = gi
                    assocs.geneIndex[alias.toLowerCase()] = gi
                })
            }

            terms.forEach (function (term) {
                if (!(term in ontology.termIndex))
		    missing[term] = (missing[term] || 0) + 1
	        else {
		    var g = assocs.geneIndex[gene]
		    var t = ontology.termIndex[term]
		    closure[t].forEach (function(c) {
                        ++gtCount[g][c]
		    })
	        }
            })
        })

	var missingTerms = Object.keys(missing)
	if (missingTerms.length > 0 && !conf.ignoreMissingTerms)
	    console.warn ("Warning: the following terms were not found in the ontology: " + missingTerms)

        assocs.genesByTerm = assocs.ontology.termName.map (function() { return [] })
        assocs.termsByGene = assocs.geneName.map (function() { return [] })
        assocs.geneHasTerm = assocs.geneName.map (function() { return {} })

        for (var g = 0; g < assocs.genes(); ++g) {
            Object.keys(gtCount[g]).forEach (function(tStr) {
                var t = parseInt (tStr)
                assocs.termsByGene[g].push (t)
                assocs.genesByTerm[t].push (g)
		assocs.geneHasTerm[g][t] = 1
		++assocs.nAssocs
            })
        }

        assocs.termsByGene = assocs.termsByGene.map (util.sortAscending)
        assocs.genesByTerm = assocs.genesByTerm.map (util.sortAscending)

        var termClass = {}
        var reverseToposort = ontology.toposortTermIndex().slice(0).reverse()
        assocs.equivClassByTerm = ontology.termName.map (function() { return null })
        reverseToposort.forEach (function (term) {
            var genesStr = "#" + assocs.genesByTerm[term].join(",")
            if (!(genesStr in termClass)) {
                termClass[genesStr] = assocs.termsInEquivClass.length
                assocs.termsInEquivClass.push ([])
            }
            var c = termClass[genesStr]
            assocs.equivClassByTerm[term] = c
            assocs.termsInEquivClass[c].push (term)
        })
    }

    module.exports = Assocs
}) ()

},{"./util":7,"assert":12,"jstat":9}],2:[function(require,module,exports){
(function() {
    var util = require('./util'),
        extend = util.extend,
        assert = require('assert'),
        jStat = require('jStat').jStat

    function update (bp, param) {
	var val = bp._params[param]
	bp._logYes[param] = Math.log (val)
	bp._logNo[param] = Math.log (1 - val)
    }

    function logLikelihood (params, counts) {
	var ll = 0
	for (var param in counts.succ)
	    if (counts.succ.hasOwnProperty (param))
		ll += params._logYes[param] * counts.succ[param]
	for (var param in counts.fail)
	    if (counts.fail.hasOwnProperty (param))
		ll += params._logNo[param] * counts.fail[param]
	return ll
    }

    function logPrior (params, priorCounts) {
	var lp = 0
	for (var param in params._params)
            lp += Math.log (jStat.beta.pdf (params._params[param],
					    priorCounts.succ[param] + 1,
					    priorCounts.fail[param] + 1))
	return lp
    }

    function logBetaBernoulliLikelihood (priorCounts) {
	var counts = this
	var l = 0
	var allCounts = [priorCounts.succ, priorCounts.fail, counts.succ, counts.fail].reduce (util.extend, {})
	Object.keys(allCounts).forEach (function (param) {
	    l += util.logBetaBernoulli ((priorCounts.succ[param] || 0) + 1,
					 (priorCounts.fail[param] || 0) + 1,
					 counts.succ[param] || 0,
					 counts.fail[param] || 0)
	})
	return l
    }

    function deltaLogBetaBernoulliLikelihood (deltaCounts) {
	var counts = this
	var d = 0
	var allCounts = [deltaCounts.succ, deltaCounts.fail, this.succ, this.fail].reduce (util.extend, {})
	Object.keys(allCounts).forEach (function (param) {
	    var oldSucc = counts.succ[param] || 0
	    var oldFail = counts.fail[param] || 0
	    var newSucc = oldSucc + (deltaCounts.succ[param] || 0)
	    var newFail = oldFail + (deltaCounts.fail[param] || 0)

	    d += jStat.betaln(newSucc+1,newFail+1) - jStat.betaln(oldSucc+1,oldFail+1)
	})
	return d
    }

    function copyCounts() {
	return new BernoulliCounts (this)
    }

    function add (counts) {
	return this.copy().accum(counts)
    }

    function accWithDelete (c, c2, param) {
	var newCount = c2[param] + (c[param] || 0)
        if (newCount)
            c[param] = newCount
        else
            delete c[param]
    }

    function accum (counts) {
	assert.equal (this.paramSet, counts.paramSet)
	for (var param in counts.succ)
            accWithDelete (this.succ, counts.succ, param)
	for (var param in counts.fail)
            accWithDelete (this.fail, counts.fail, param)
	return this
    }

    function scale (factor) {
	for (var param in this.succ)
	    this.succ[param] *= factor
	for (var param in this.fail)
	    this.fail[param] *= factor
	return this
    }

    function subtract (counts) {
	return this.copy().accum (counts.copy().scale(-1))
    }

    function modalParams(params) {
        var counts = this
	params = params || counts.paramSet.newParams()
        params.paramNames().forEach (function(p) {
            params.setParam (p, counts.succ[p] / (counts.succ[p] + counts.fail[p]))
        })
	return params
    }

    function meanParams(params) {
        var counts = this
	params = params || counts.paramSet.newParams()
        params.paramNames().forEach (function(p) {
            params.setParam (p, (counts.succ[p] + 1) / (counts.succ[p] + counts.fail[p] + 2))
        })
	return params
    }

    function sampleParams(generator,params) {
	params = params || this.paramSet.newParams()
	// quick & dirty hack to bypass jStat's hardwired use of Math.random()...
	var oldRandom = Math.random
	if (generator)
	    Math.random = generator.random.bind(generator)
	// sample...
	for (var param in params._params)
            params.setParam (param, jStat.beta.sample (this.succ[param] + 1, this.fail[param] + 1))
	// restore...
	Math.random = oldRandom
	// return
	return params
    }

    function BernoulliParamSet (params) {
        var bp = this
	extend (bp, {
	    _params: params || {},
	    paramNames: function() { return Object.keys(this._params).sort() },
	    addParam: function(param) { this._params[param] = 1 },
	    toJSON: function() { return this.paramNames() },
	    newParams: function(p) { return new BernoulliParamAssignment (this._params) },
	    newCounts: function(c) { return new BernoulliCounts (extend ({ paramSet: this }, c)) },
	    laplacePrior: function() {
                var c = this.newCounts()
                this.paramNames().forEach (function(p) { c.succ[p] = c.fail[p] = 1 })
                return c
            }
	})
    }

    function BernoulliCounts (counts, paramSet) {
        var bc = this
	extend (bc, {
	    paramSet: paramSet
                || counts.paramSet
                || new BernoulliParamSet (extend (extend ({}, counts.succ), counts.fail)),
	    succ: extend ({}, counts.succ),
	    fail: extend ({}, counts.fail),
	    logLikelihood: function(params) { return logLikelihood(params,this) },
	    logPrior: function(params) { return logPrior(params,this) },
	    logLikeWithPrior: function(prior,params) {
                return prior.logPrior(params) + logLikelihood(params,this)
            },
	    logBetaBernoulliLikelihood: logBetaBernoulliLikelihood,
	    deltaLogBetaBernoulliLikelihood: deltaLogBetaBernoulliLikelihood,
	    copy: copyCounts,
	    add: add,
	    accum: accum,
	    scale: scale,
	    subtract: subtract,
            sampleParams: sampleParams,
            modalParams: modalParams,
            meanParams: meanParams,
	    toJSON: function() { return { succ: this.succ, fail: this.fail } }
	})
    }

    function BernoulliParamAssignment (params) {
        var bp = this
	extend (bp, {
	    _params: params || {},
	    _logYes: {},
	    _logNo: {},
	    paramNames: function() { return Object.keys(this._params).sort() },
	    getParam: function(param) { return this._params[param] },
	    setParam: function(param,val) { this._params[param] = val; update (bp, param) },
	    setParams: function(params) {
		var bp = this
		Object.keys(params).map (function(p) { bp.setParam (p, params[p]) })
	    },
	    logLikelihood: function(count) { return logLikelihood(this,count) },
	    logPrior: function(prior) { return logPrior(this,prior) },
	    logLikeWithPrior: function(prior,count) { return logPrior(this,prior) + logLikelihood(this,count) },
	    toJSON: function() { return extend ({}, this._params) },
	    newCounts: function(c) { return new BernoulliCounts (extend ({ paramSet: this }, c)) },
	    laplacePrior: function() {
                var c = this.newCounts()
                this.paramNames().forEach (function(p) { c.succ[p] = c.fail[p] = 1 })
                return c
            }
	})
	Object.keys(params).forEach (function(param) {
	    update (bp, param)
	})
    }

    module.exports.BernoulliParamSet = BernoulliParamSet
    module.exports.BernoulliParamAssignment = BernoulliParamAssignment
    module.exports.BernoulliCounts = BernoulliCounts
}) ()

},{"./util":7,"assert":12,"jStat":8}],3:[function(require,module,exports){
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

},{"./bernoulli":2,"./model":4,"./parameterization":6,"./util":7,"assert":12,"jStat":8,"mersennetwister":10}],4:[function(require,module,exports){
(function() {
    var assert = require('assert'),
	MersenneTwister = require('mersennetwister'),
	Parameterization = require('./parameterization'),
	util = require('./util'),
	extend = util.extend

    function getTermState(t) { return this._termState[t] }

    function setTermState(t,val) {
	var model = this
        assert (model.isRelevant[t])
	if (model._termState[t] != val) {
	    var delta = val ? +1 : -1
	    model.assocs.genesByTerm[t].forEach (function(g) {
		var newCount = model._nActiveTermsByGene[g] + delta
		model._nActiveTermsByGene[g] = newCount
		var inGeneSet = model.inGeneSet[g]
		var isFalse = newCount > 0 ? !inGeneSet : inGeneSet
		if (isFalse)
		    model._isFalseGene[g] = 1
		else
		    delete model._isFalseGene[g]
	    })
	    if (val)
		model._isActiveTerm[t] = true
	    else
		delete model._isActiveTerm[t]
	    model._termState[t] = val
	}
    }

    function setTermStates(termStateAssignment) {
        for (var t in termStateAssignment)
            if (termStateAssignment.hasOwnProperty(t))
                this.setTermState (t, termStateAssignment[t])
    }

    function countTerm(model,counts,inc,t,state) {
        var countObj = state ? counts.succ : counts.fail
        var countParam = model.parameterization.names.termPrior[t]
        var newCount = inc + (countObj[countParam] || 0)
	if (newCount)
	    countObj[countParam] = newCount
	else
	    delete countObj[countParam]
    }

    function countObs(model,counts,inc,isActive,g) {
        var inGeneSet = model.inGeneSet[g]
	// isActive inGeneSet param
	// 0        0         !falsePos
	// 0        1         falsePos
	// 1        0         falseNeg
	// 1        1         !falseNeg
        var isFalse = isActive ? !inGeneSet : inGeneSet
        var countObj = isFalse ? counts.succ : counts.fail
        var countParam = (isActive ? model.parameterization.names.geneFalseNeg : model.parameterization.names.geneFalsePos)[g]
        var newCount = inc + (countObj[countParam] || 0)
	if (newCount)
	    countObj[countParam] = newCount
	else
	    delete countObj[countParam]
    }
    
    function getCounts() {
	var model = this
	var counts = model.paramSet.newCounts()
	var param = model.param
	model.relevantTerms.forEach (function (t) {
            countTerm (model, counts, +1, t, model._termState[t])
	})
	model._nActiveTermsByGene.forEach (function (active, g) {
            countObs (model, counts, +1, active > 0, g)
	})
	return counts
    }

    function getCountDelta(termStateAssignment) {
	var model = this
	var param = model.param
	var cd = model.paramSet.newCounts()
        var nActiveTermsByGene = {
            _val: {},
            val: function(g) { return g in this._val ? this._val[g] : model._nActiveTermsByGene[g] },
            add: function(g,delta) { var oldval = this.val(g); this._val[g] = oldval + delta; return oldval }
        }
        for (var t in termStateAssignment)
            if (termStateAssignment.hasOwnProperty(t)) {
                assert (model.isRelevant[t])
                var val = termStateAssignment[t]
	        if (model._termState[t] != val) {
                    countTerm (model, cd, -1, t, model._termState[t])
                    countTerm (model, cd, +1, t, val)
	            var delta = val ? +1 : -1
	            model.assocs.genesByTerm[t].forEach (function(g) {
		        var oldActive = nActiveTermsByGene.add(g,delta)
		        var newActive = nActiveTermsByGene.val(g)
		        if (oldActive != newActive) {
                            countObs (model, cd, -1, oldActive, g)
                            countObs (model, cd, +1, newActive, g)
		        }
	            })
	        }
            }
	return cd
    }

    function invert(termStateAssignment) {
        var inv = extend ({}, termStateAssignment)
        for (var t in inv)
            inv[t] = this._termState[t]
        return inv
    }

    function proposeFlipMove() {
	var model = this
	var term = util.randomElement (model.relevantTerms, model.generator)
	var tsa = {}

	tsa[term] = !model._termState[term]
	return { termStates: tsa,
		 proposalHastingsRatio: 1 }
    }

    function proposeStepMove() {
	return proposeExchangeMove.bind(this) (getNeighbors)
    }

    function proposeJumpMove() {
	return proposeExchangeMove.bind(this) (getActives)
    }

    function getNeighbors(model,term) { return model.relevantNeighbors[term] }
    function getActives(model,term) { return model.relevantTerms }

    function proposeExchangeMove (getExchangePartners) {
	var model = this
	var move = { termStates: {},
		     proposalHastingsRatio: 1 }
	var activeTerms = model.activeTerms()
	if (activeTerms.length > 0) {
	    var term = util.randomElement (activeTerms, model.generator)
	    var nbrs = getExchangePartners(model,term)
	    if (nbrs.length > 0) {
		var nbr = util.randomElement (nbrs, model.generator)
		if (!this._termState[nbr]) {
		    move.termStates[term] = false
		    move.termStates[nbr] = true
		    move.proposalHastingsRatio = nbrs.length / getExchangePartners(model,nbr).length
		}
	    }
	}
	return move
    }

    function proposeRandomizeMove() {
	var model = this
	var tsa = {}
	model.relevantTerms.forEach (function (term) {
	    tsa[term] = (model.generator.random() > 0.5)
	})
	return { termStates: tsa,
		 proposalHastingsRatio: 1 }
    }

    function sampleMoveCollapsed(move,counts) {
	move.delta = this.getCountDelta (move.termStates)
	move.logLikelihoodRatio = counts.deltaLogBetaBernoulliLikelihood (move.delta)
	move.hastingsRatio = move.proposalHastingsRatio * Math.exp(move.logLikelihoodRatio)
	if (move.hastingsRatio >= 1 || this.generator.random() < move.hastingsRatio) {
	    this.setTermStates (move.termStates)
	    move.accepted = true
	    counts.accum (move.delta)
	} else
	    move.accepted = false
	return move.accepted
    }
    
    function Model (conf) {
        var model = this

	var assocs = conf.assocs
	var termName = assocs.ontology.termName
	var geneName = assocs.geneName

        var validation = assocs.validateGeneNames (conf.geneSet)
	if (validation.missingGeneNames.length > 0)
	    console.warn ("Warning: the following genes were not found in the associations list: " + validation.missingGeneNames)
        var geneSet = validation.resolvedGeneIndices
        
        // "relevant" terms are ones which have at least one associated gene in the geneSet,
        // excluding those which are indistinguishable from other terms in the ontology
        var relevantTerms = assocs.relevantTermsForGeneSet (geneSet)
        var isRelevant = util.listToCounts (relevantTerms)
        function relevantFilter(termList) {
            return termList.filter (util.objPredicate(isRelevant))
        }
        var relevantParents = assocs.ontology.parents.map (relevantFilter)
        var relevantChildren = assocs.ontology.children.map (relevantFilter)

        // initial state
        var termState = termName.map (function() { return false })
	if (conf.initTerms)
            conf.initTerms.forEach (function (initTermName) {
                if (initTermName in assocs.ontology.termIndex) {
                    var initTerm = assocs.ontology.termIndex[initTermName]
                    if (isRelevant[initTerm])
                        termState[initTerm] = true
                }
            })

        // parameterization
        var parameterization = conf.parameterization || new Parameterization (conf)

        // this object encapsulates both the graphical model itself,
        // and an assignment of state to the model variables
        extend (model,
                {
                    // the graphical model
                    assocs: assocs,
		    geneSet: geneSet,
		    termName: termName,
		    geneName: geneName,

		    inGeneSet: geneName.map (function() { return false }),

                    isRelevant: isRelevant,
		    relevantTerms: relevantTerms,
		    relevantNeighbors: relevantParents.map (function (parents, term) {
			return util.removeDups
                        ([parents,
                          relevantChildren[term]]
                         .concat (assocs.ontology.parents[term].map (function (parent) {
                             return relevantChildren[parent]
                         }))
                         .reduce (function(r,l) { return r.concat(l) }, []))
                            .filter (function(t) { return t != term })
                            .map(util.parseDecInt)
                            .sort(util.numCmp)
		    }),
		    
		    parameterization: parameterization,
		    paramSet: conf.paramSet || parameterization.paramSet,
                    prior: conf.prior || parameterization.paramSet.laplacePrior(),

                    genes: function() { return this.assocs.genes() },
                    terms: function() { return this.assocs.terms() },

                    // current state of the model
		    _termState: termState,
		    _isActiveTerm: {},

		    _nActiveTermsByGene: assocs.termsByGene.map (function(terms) {
		        return terms.reduce (function(accum,t) {
			    return accum + (termState[t] ? 1 : 0)
		        }, 0)
		    }),
		    _isFalseGene: {},
		    		    
		    hasActiveTerms: function() { return Object.keys(this._isActiveTerm).length > 0 },
                    activeTerms: function() {
                        return Object.keys(this._isActiveTerm).sort(util.numCmp)
                    },

		    falseGenes: function() {
			return Object.keys(this._isFalseGene).sort(util.numCmp)
		    },
		    
		    getTermState: getTermState,
		    setTermState: setTermState,
		    setTermStates: setTermStates,
                    invert: invert,
                    
		    getCounts: getCounts,
		    getCountDelta: getCountDelta,
		    
		    toJSON: function() {
		        var model = this
		        return model.activeTerms()
			    .map (function(t) { return model.termName[t] })
		    },

		    // MCMC methods
		    generator: conf.generator || new MersenneTwister (conf.seed),
		    
		    proposeFlipMove: proposeFlipMove,
		    proposeStepMove: proposeStepMove,
		    proposeJumpMove: proposeJumpMove,
		    proposeRandomizeMove: proposeRandomizeMove,

		    sampleMoveCollapsed: sampleMoveCollapsed
                })

	geneSet.forEach (function(g) { model.inGeneSet[g] = true })
	termState.forEach (function(s,t) { if (s) model._isActiveTerm[t] = true })

	model._nActiveTermsByGene.map (function(terms,gene) {
	    if (terms > 0 ? !model.inGeneSet[gene] : model.inGeneSet[gene])
		model._isFalseGene[gene] = true
	})
    }

    module.exports = Model
}) ()

},{"./parameterization":6,"./util":7,"assert":12,"mersennetwister":10}],5:[function(require,module,exports){
(function() {
    var util = require('./util'),
        extend = util.extend,
        assert = require('assert')

    function toJSON (conf) {
        var onto = this
        var json = []
        conf = extend ({ compress: false,
			 includeTermInfo: true },
		       conf)
        var parentLookup = conf.compress
            ? function(j) { return j }
            : function(j) { return onto.termName[j] }
        for (var i = 0; i < onto.terms(); ++i) {
            json.push ([onto.termName[i]].concat (onto.parents[i].map (parentLookup)))
        }
        var result = { "termParents" : json }
	if (conf.includeTermInfo && onto.termInfo)
	    result.termInfo = onto.termInfo
        var doNotAnnotate = util.iota(onto.terms()).filter (util.objPredicate (onto.doNotAnnotate))
        if (doNotAnnotate.length)
            result.doNotAnnotate = doNotAnnotate.map (onto.getTermName.bind(onto))
	return result
    }

    function toposortTermIndex (onto) {
        // Kahn, Arthur B. (1962), "Topological sorting of large networks", Communications of the ACM 5 (11): 558–562, doi:10.1145/368996.369025
        // https://en.wikipedia.org/wiki/Topological_sorting
        var S = [], L = []
        var nParents = [], edges = 0
        for (var c = 0; c < onto.terms(); ++c) {
            nParents[c] = onto.parents[c].length
            edges += nParents[c]
            if (nParents[c] == 0)
                S.push (c)
        }
        while (S.length > 0) {
            var n = S.shift()
            L.push (n)
            onto.children[n].forEach (function(m) {
                --edges
                if (--nParents[m] == 0)
                    S.push (m)
            })
        }
        if (edges > 0)
            return undefined

        return L
    }

    function isCyclic() {
        var L = toposortTermIndex(this)
        return typeof(L) === 'undefined'
    }

    function toposortTermIndexOrDie (onto) {
        var L = toposortTermIndex(onto)
        if (typeof(L) === 'undefined')
            throw new Error ("Ontology graph is not a DAG")
        
        return L
    }

    function toposort() {
        var onto = this

        if (onto.isToposorted())
            return onto
        
        var L = toposortTermIndexOrDie (onto)

        var json = onto.toJSON()
        var toposortedJson = { termParents: util.permuteList (json.termParents, L) }
	if (json.termInfo)
	    toposortedJson.termInfo = util.permuteList (json.termInfo, L)
	
        return new Ontology (toposortedJson)
    }

    function isToposorted() {
        for (var i = 0; i < this.terms(); ++i)
            if (this.parents[i].some (function(p) { return p >= i }))
                return false;
        return true;
    }

    function toposortTermOrder() {
	var onto = this
	var L = toposortTermIndexOrDie (onto)
	var order = onto.termName.map (function() { return null })
	L.forEach (function (term, index) { order[term] = index })
	return order
    }

    function buildChildren (onto) {
        onto.children = onto.parents.map (function() { return [] })
        for (var c = 0; c < onto.terms(); ++c)
            onto.parents[c].forEach (function(p) {
                onto.children[p].push (c)
            })
    }

    function equals (onto) {
        return JSON.stringify (this.toJSON({'compress':true})) == JSON.stringify (onto.toJSON({'compress':true}));
    }

    function transitiveClosure() {
        var onto = this
        if (!('_closure' in onto)) {
            var clos = []
            var L = toposortTermIndexOrDie (onto)
            L.forEach (function(n) {
                var closIndex = {}
                onto.parents[n].forEach (function(p) {
                    clos[p].forEach (function(c) {
                        closIndex[c] = 1
                    })
                })
                closIndex[n] = 1
                clos[n] = Object.keys(closIndex)
                    .sort (util.numCmp)
            })
            onto._closure = clos
        }
        return onto._closure
    }

    function getTermInfo (name) {
	var onto = this
	if (name in onto.termIndex && onto.termInfo)
	    return onto.termInfo[onto.termIndex[name]]
	return undefined
    }

    function subgraphRootedAt (rootTermList) {
        var onto = this
        var inSubgraph = {}
        var inSubFunc = util.objPredicate(inSubgraph)
        rootTermList.forEach (function (tn) {
            if (tn in onto.termIndex)
                inSubgraph[onto.termIndex[tn]] = true
        })
        onto.toposortTermIndex().forEach (function (ti) {
            var parents = onto.parents[ti]
            inSubgraph[ti] = inSubgraph[ti] || (parents.length ? parents.every(inSubFunc) : false)
        })
        return onto.subgraph (inSubFunc)
    }

    function subgraphWithAncestors (termList) {
        var onto = this
        var inSubgraph = {}
        var closure = onto.transitiveClosure()
        termList.forEach (function (tn) {
            if (tn in onto.termIndex)
                closure[onto.termIndex[tn]].forEach (function(c) {
                    inSubgraph[c] = true
                })
        })
        return onto.subgraph (util.objPredicate (inSubgraph))
    }

    function subgraph (termIndexPredicate) {
        var onto = this
        var termParents = [],
            termInfo = onto.termInfo ? [] : undefined
        onto.termName.forEach (function (tn, ti) {
            if (termIndexPredicate(ti)) {
                termParents.push ([tn].concat (onto.parents[ti].filter(termIndexPredicate).map (onto.getTermName.bind(onto))))
                if (termInfo)
                    termInfo.push (onto.termInfo[ti])
            }
        })
                          
        return new Ontology ({ termParents: termParents, termInfo: termInfo })
    }
    
    function Ontology (conf) {
        var onto = this
        extend (onto,
                { 'termName': [],  // this is actually the term ID. ahem
                  'termIndex': {},  // mapping from term ID to term index
		  'termInfo': null,  // the array of term names (in the OBO sense) goes here, if available
                  'doNotAnnotate': {},
                  'parents': [],
                  'children': [],
                  'terms': function() { return this.termName.length },
                  'toJSON': toJSON,
                  'isCyclic': isCyclic,
                  'isToposorted': isToposorted,
                  'toposort': toposort,
		  'toposortTermOrder': toposortTermOrder,
                  'toposortTermIndex': function() { return toposortTermIndexOrDie(this) },
                  'equals': equals,
                  'transitiveClosure': transitiveClosure,
		  'getTermInfo': getTermInfo,
                  'getTermName': function(ti) { return this.termName[ti] },
                  'subgraphRootedAt': subgraphRootedAt,
                  'subgraphWithAncestors': subgraphWithAncestors,
                  'subgraph': subgraph
                })

        if (Object.prototype.toString.call(conf) === '[object Array]')
            conf = { 'termParents': conf }
        
        if ('termParents' in conf) {
            var extTermParents = []
            conf.termParents.forEach (function (tp) {
                extTermParents.push (tp)
                var term = tp[0]
                onto.termIndex[term] = onto.terms()
                onto.termName.push (term)
            })
            conf.termParents.forEach (function (tp) {
                for (var n = 1; n < tp.length; ++n) {
                    if (typeof(tp[n]) === 'string' && !(tp[n] in onto.termIndex)) {
                        onto.termIndex[tp[n]] = onto.terms()
                        onto.termName.push (tp[n])
                        extTermParents.push ([tp[n]])
                    }
                }
            })
 
            extTermParents.forEach (function (tp,term) {
                onto.parents[term] = tp.slice([1])
                    .map (function(n) {
                        return typeof(n) === 'number' ? n : onto.termIndex[n]
                    })
            })
        } else
            throw new Error ("Can't parse Ontology config")

	if ('termInfo' in conf)
	    onto.termInfo = conf.termInfo

        if ('doNotAnnotate' in conf)
            conf.doNotAnnotate.forEach (function (tn) {
                if (tn in onto.termIndex)
                    onto.doNotAnnotate[onto.termIndex[tn]] = true
            })
        
        buildChildren (onto)
    }

    module.exports = Ontology
}) ()

},{"./util":7,"assert":12}],6:[function(require,module,exports){
(function() {
    var assert = require('assert'),
    BernoulliParamSet = require('./bernoulli').BernoulliParamSet,
    util = require('./util'),
    extend = util.extend

    function Parameterization (conf) {
        var parameterization = this

        conf = extend ({ termPrior: function(term) { return 't' },
			 geneFalsePos: function(gene) { return 'fp' },
			 geneFalseNeg: function(gene) { return 'fn' },
		       },
		       conf)

        var assocs = conf.assocs
	var termName = assocs.ontology.termName
	var geneName = assocs.geneName

        var params = {}
        function init(f) {
            return function(x) {
                var name = f(x)
                params[name] = 1
                return name
            }
        }
        
        parameterization.names = {
            termPrior: termName.map (init (conf.termPrior)),
	    geneFalsePos: geneName.map (init (conf.geneFalsePos)),
	    geneFalseNeg: geneName.map (init (conf.geneFalseNeg))
        }
    
        parameterization.paramSet = new BernoulliParamSet (params)
    }

    module.exports = Parameterization
}) ()

},{"./bernoulli":2,"./util":7,"assert":12}],7:[function(require,module,exports){
(function() {
    var extend = require('util')._extend,
        assert = require('assert'),
	jStat = require('jStat').jStat

    function numCmp (a, b) { return a-b }

    function reverseCmp (comparisonFunc) {
        return function(a,b) {
            return comparisonFunc(b,a)
        }
    }

    function sortAscending (list) {
        return list.sort (numCmp)
    }

    function listToCounts (list) {
	var c = {}
	list.forEach (function(x) {
            c[x] = (c[x] || 0) + 1
        })
        return c
    }
    
    function removeDups (list) {
	return Object.keys (listToCounts (list))
    }

    function parseDecInt (x) {
        return parseInt (x)
    }

    function objPredicate (obj) {
        return function(x) {
            return obj[x] ? true : false
        }
    }

    function negate (predicateFunc) {
	return function () {
            return !predicateFunc.apply(this, arguments)
	}
    }

    function sumList (list) {
	return list.reduce (function(tot,x) { return tot+x }, 0)
    }
    
    function randomElement (list, generator) {
	return list.length > 0 ? list [Math.floor (generator.random() * list.length)] : undefined
    }

    function randomIndex (distrib, generator) {
	var sum = sumList (distrib)
	var rnd = generator.random() * sum
	for (var idx = 0; idx < distrib.length; ++idx)
	    if ((rnd -= distrib[idx]) <= 0)
		return idx
	return undefined
    }

    function randomKey (obj, generator) {
	var keys = Object.keys (obj)
	var distrib = keys.map (function(k) { return obj[k] })
	return keys [randomIndex (distrib, generator)]
    }

    function iota(n) {
	var list = []
	for (var i = 0; i < n; ++i)
	    list.push(i)
	return list
    }

    function sortKeys (obj, sortFunc, keys) {
	sortFunc = sortFunc || numCmp
	return (keys || Object.keys(obj)).sort (function(a,b) {
	    return sortFunc (obj[a], obj[b])
	})
    }

    function sortIndices (order, indexList, sortFunc) {
	sortFunc = sortFunc || numCmp
	return (indexList || iota(order.length)).sort (function(a,b) {
	    return sortFunc (order[a], order[b])
	})
    }

    function permuteList (list, order) {
	return order.map (function(idx) { return list[idx] })
    }

    function keyValListToObj (keyValList) {
	var obj = {}
	keyValList.forEach (function (keyVal) {
	    obj[keyVal[0]] = keyVal[1]
	})
	return obj
    }

    function values (obj) {
        return Object.keys(obj).map (function(k) { return obj[k] })
    }

    function commonKeys (obj1, obj2) {
	return Object.keys(obj1).filter (function(k) { return obj2.hasOwnProperty(k) })
    }

    function commonElements (list1, list2) {
	return commonKeys (listToCounts(list1), listToCounts(list2))
    }

    function logBinomialCoefficient (n, k) {
	return jStat.gammaln(n+1) - jStat.gammaln(k+1) - jStat.gammaln(n-k+1)
    }
    
    function logBetaBinomial (alpha, beta, n, k) {
	return logBinomialCoefficient(n,k) + logBetaBernoulli(alpha,beta,k,n-k)
    }
    
    function logBetaBernoulli (alpha, beta, succ, fail) {
	return jStat.betaln(alpha+succ,beta+fail) - jStat.betaln(alpha,beta)
    }

    function autocorrelation (list, points) {
	points = points || iota(list.length-1)
	var mean = jStat.mean(list), variance = jStat.variance(list)
	var list_minus_mean = list.map (function(x) { return x - mean })
	var R = {}
	points.forEach (function(tau) {
	    var R_tau = []
	    for (var i = 0; i + tau < list.length; ++i)
		R_tau.push (list_minus_mean[i] * list_minus_mean[i + tau])
	    R[tau] = jStat.mean(R_tau) / variance
	})
	return R
    }

    function arraysEqual (a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false
        if (a.length != b.length) return false
        for (var i = 0; i < a.length; ++i)
            if (a[i] !== b[i]) return false
        return true
    }

    function approxEqual (a, b, epsilon) {
	epsilon = epsilon || .0001
	if (Math.max (Math.abs(a), Math.abs(b)) > 0)
	    return Math.abs(a-b) / Math.max (Math.abs(a), Math.abs(b)) < epsilon
	else
	    return Math.abs(a-b) < epsilon
    }
    
    function assertApproxEqual (a, b, epsilon, message) {
	assert (approxEqual(a,b,epsilon), message || ("Difference between a ("+a+") and b ("+b+") is too large"))
    }
    
    function plural (count, singular, plural) {
        plural = plural || (singular + 's')
        return count + ' ' + (count == 1 ? singular : plural)
    }
    
    function toHHMMSS (milliseconds) {
	var sec_num = Math.floor (milliseconds / 1000)
	var hours   = Math.floor (sec_num / 3600)
	var minutes = Math.floor ((sec_num - (hours * 3600)) / 60)
	var seconds = sec_num - (hours * 3600) - (minutes * 60)

	if (hours < 10)
	    hours = "0" + hours
	if (minutes < 10)
	    minutes = "0" + minutes
	if (seconds < 10)
	    seconds = "0" + seconds

	return hours+':'+minutes+':'+seconds
    }

    function progressLogger (pastTenseVerb, pluralNoun) {
	var startTime = Date.now(), lastTime = startTime, delay = 1000
	return function (stepsCompleted, totalSteps) {
	    var nowTime = Date.now()
	    if (nowTime - lastTime > delay) {
		lastTime = nowTime
		delay = Math.min (30000, delay*2)
		var progress = stepsCompleted / totalSteps
		console.warn (pastTenseVerb + " " + stepsCompleted + "/" + totalSteps + " " + pluralNoun + " (" + Math.round(100*progress) + "%), estimated time left " + toHHMMSS ((1/progress - 1) * (nowTime - startTime)))
	    }
	}
    }

    function logRandomNumbers(generator,nMax) {
	var rnd = generator.int, nRnd = 0
	generator.int = function() {
	    var r = rnd.apply (this, arguments)
	    if (typeof(nMax) === 'undefined' || nRnd < nMax)
		console.warn ("Random number #" + (++nRnd) + ": " + r)
	    return r
	}
    }

    function HSVtoRGB(h, s, v) {
	var r, g, b, i, f, p, q, t
	i = Math.floor(h * 6)
	f = h * 6 - i
	p = v * (1 - s)
	q = v * (1 - f * s)
	t = v * (1 - (1 - f) * s)
	switch (i % 6) {
        case 0: r = v, g = t, b = p; break
        case 1: r = q, g = v, b = p; break
        case 2: r = p, g = v, b = t; break
        case 3: r = p, g = q, b = v; break
        case 4: r = t, g = p, b = v; break
        case 5: r = v, g = p, b = q; break
	}
	return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
	}
    }

    module.exports.numCmp = numCmp
    module.exports.reverseCmp = reverseCmp
    module.exports.sortAscending = sortAscending
    module.exports.listToCounts = listToCounts
    module.exports.removeDups = removeDups
    module.exports.parseDecInt = parseDecInt
    module.exports.objPredicate = objPredicate
    module.exports.negate = negate
    module.exports.sumList = sumList
    module.exports.randomElement = randomElement
    module.exports.randomIndex = randomIndex
    module.exports.randomKey = randomKey
    module.exports.iota = iota
    module.exports.sortKeys = sortKeys
    module.exports.sortIndices = sortIndices
    module.exports.permuteList = permuteList
    module.exports.keyValListToObj = keyValListToObj
    module.exports.values = values
    module.exports.commonKeys = commonKeys
    module.exports.commonElements = commonElements
    module.exports.logBinomialCoefficient = logBinomialCoefficient
    module.exports.logBetaBinomial = logBetaBinomial
    module.exports.logBetaBernoulli = logBetaBernoulli
    module.exports.autocorrelation = autocorrelation
    module.exports.arraysEqual = arraysEqual
    module.exports.approxEqual = approxEqual
    module.exports.assertApproxEqual = assertApproxEqual
    module.exports.toHHMMSS = toHHMMSS
    module.exports.plural = plural
    module.exports.progressLogger = progressLogger
    module.exports.logRandomNumbers = logRandomNumbers
    module.exports.HSVtoRGB = HSVtoRGB
    module.exports.extend = extend
}) ()

},{"assert":12,"jStat":8,"util":16}],8:[function(require,module,exports){
this.j$ = this.jStat = (function(Math, undefined) {

// For quick reference.
var concat = Array.prototype.concat;
var slice = Array.prototype.slice;
var toString = Object.prototype.toString;

// Calculate correction for IEEE error
// TODO: This calculation can be improved.
function calcRdx(n, m) {
  var val = n > m ? n : m;
  return Math.pow(10,
                  17 - ~~(Math.log(((val > 0) ? val : -val)) * Math.LOG10E));
}


var isArray = Array.isArray || function isArray(arg) {
  return toString.call(arg) === '[object Array]';
};


function isFunction(arg) {
  return toString.call(arg) === '[object Function]';
}


function isNumber(arg) {
  return typeof arg === 'number' && arg === arg;
}


// Converts the jStat matrix to vector.
function toVector(arr) {
  return concat.apply([], arr);
}


// The one and only jStat constructor.
function jStat() {
  return new jStat._init(arguments);
}


// TODO: Remove after all references in src files have been removed.
jStat.fn = jStat.prototype;


// By separating the initializer from the constructor it's easier to handle
// always returning a new instance whether "new" was used or not.
jStat._init = function _init(args) {
  var i;

  // If first argument is an array, must be vector or matrix.
  if (isArray(args[0])) {
    // Check if matrix.
    if (isArray(args[0][0])) {
      // See if a mapping function was also passed.
      if (isFunction(args[1]))
        args[0] = jStat.map(args[0], args[1]);
      // Iterate over each is faster than this.push.apply(this, args[0].
      for (var i = 0; i < args[0].length; i++)
        this[i] = args[0][i];
      this.length = args[0].length;

    // Otherwise must be a vector.
    } else {
      this[0] = isFunction(args[1]) ? jStat.map(args[0], args[1]) : args[0];
      this.length = 1;
    }

  // If first argument is number, assume creation of sequence.
  } else if (isNumber(args[0])) {
    this[0] = jStat.seq.apply(null, args);
    this.length = 1;

  // Handle case when jStat object is passed to jStat.
  } else if (args[0] instanceof jStat) {
    // Duplicate the object and pass it back.
    return jStat(args[0].toArray());

  // Unexpected argument value, return empty jStat object.
  // TODO: This is strange behavior. Shouldn't this throw or some such to let
  // the user know they had bad arguments?
  } else {
    this[0] = [];
    this.length = 1;
  }

  return this;
};
jStat._init.prototype = jStat.prototype;
jStat._init.constructor = jStat;


// Utility functions.
// TODO: for internal use only?
jStat.utils = {
  calcRdx: calcRdx,
  isArray: isArray,
  isFunction: isFunction,
  isNumber: isNumber,
  toVector: toVector
};


// Easily extend the jStat object.
// TODO: is this seriously necessary?
jStat.extend = function extend(obj) {
  var i, j;

  if (arguments.length === 1) {
    for (j in obj)
      jStat[j] = obj[j];
    return this;
  }

  for (var i = 1; i < arguments.length; i++) {
    for (j in arguments[i])
      obj[j] = arguments[i][j];
  }

  return obj;
};


// Returns the number of rows in the matrix.
jStat.rows = function rows(arr) {
  return arr.length || 1;
};


// Returns the number of columns in the matrix.
jStat.cols = function cols(arr) {
  return arr[0].length || 1;
};


// Returns the dimensions of the object { rows: i, cols: j }
jStat.dimensions = function dimensions(arr) {
  return {
    rows: jStat.rows(arr),
    cols: jStat.cols(arr)
  };
};


// Returns a specified row as a vector or return a sub matrix by pick some rows
jStat.row = function row(arr, index) {
  if (isArray(index)) {
    return index.map(function(i) {
      return jStat.row(arr, i);
    })
  }
  return arr[index];
};


// return row as array
// rowa([[1,2],[3,4]],0) -> [1,2]
jStat.rowa = function rowa(arr, i) {
  return jStat.row(arr, i);
};


// Returns the specified column as a vector or return a sub matrix by pick some
// columns
jStat.col = function col(arr, index) {
  if (isArray(index)) {
    var submat = jStat.arange(arr.length).map(function(i) {
      return new Array(index.length);
    });
    index.forEach(function(ind, i){
      jStat.arange(arr.length).forEach(function(j) {
        submat[j][i] = arr[j][ind];
      });
    });
    return submat;
  }
  var column = new Array(arr.length);
  for (var i = 0; i < arr.length; i++)
    column[i] = [arr[i][index]];
  return column;
};


// return column as array
// cola([[1,2],[3,4]],0) -> [1,3]
jStat.cola = function cola(arr, i) {
  return jStat.col(arr, i).map(function(a){ return a[0] });
};


// Returns the diagonal of the matrix
jStat.diag = function diag(arr) {
  var nrow = jStat.rows(arr);
  var res = new Array(nrow);
  for (var row = 0; row < nrow; row++)
    res[row] = [arr[row][row]];
  return res;
};


// Returns the anti-diagonal of the matrix
jStat.antidiag = function antidiag(arr) {
  var nrow = jStat.rows(arr) - 1;
  var res = new Array(nrow);
  for (var i = 0; nrow >= 0; nrow--, i++)
    res[i] = [arr[i][nrow]];
  return res;
};

// Transpose a matrix or array.
jStat.transpose = function transpose(arr) {
  var obj = [];
  var objArr, rows, cols, j, i;

  // Make sure arr is in matrix format.
  if (!isArray(arr[0]))
    arr = [arr];

  rows = arr.length;
  cols = arr[0].length;

  for (var i = 0; i < cols; i++) {
    objArr = new Array(rows);
    for (j = 0; j < rows; j++)
      objArr[j] = arr[j][i];
    obj.push(objArr);
  }

  // If obj is vector, return only single array.
  return obj.length === 1 ? obj[0] : obj;
};


// Map a function to an array or array of arrays.
// "toAlter" is an internal variable.
jStat.map = function map(arr, func, toAlter) {
  var row, nrow, ncol, res, col;

  if (!isArray(arr[0]))
    arr = [arr];

  nrow = arr.length;
  ncol = arr[0].length;
  res = toAlter ? arr : new Array(nrow);

  for (row = 0; row < nrow; row++) {
    // if the row doesn't exist, create it
    if (!res[row])
      res[row] = new Array(ncol);
    for (col = 0; col < ncol; col++)
      res[row][col] = func(arr[row][col], row, col);
  }

  return res.length === 1 ? res[0] : res;
};


// Cumulatively combine the elements of an array or array of arrays using a function.
jStat.cumreduce = function cumreduce(arr, func, toAlter) {
  var row, nrow, ncol, res, col;

  if (!isArray(arr[0]))
    arr = [arr];

  nrow = arr.length;
  ncol = arr[0].length;
  res = toAlter ? arr : new Array(nrow);

  for (row = 0; row < nrow; row++) {
    // if the row doesn't exist, create it
    if (!res[row])
      res[row] = new Array(ncol);
    if (ncol > 0)
      res[row][0] = arr[row][0];
    for (col = 1; col < ncol; col++)
      res[row][col] = func(res[row][col-1], arr[row][col]);
  }
  return res.length === 1 ? res[0] : res;
};


// Destructively alter an array.
jStat.alter = function alter(arr, func) {
  return jStat.map(arr, func, true);
};


// Generate a rows x cols matrix according to the supplied function.
jStat.create = function  create(rows, cols, func) {
  var res = new Array(rows);
  var i, j;

  if (isFunction(cols)) {
    func = cols;
    cols = rows;
  }

  for (var i = 0; i < rows; i++) {
    res[i] = new Array(cols);
    for (j = 0; j < cols; j++)
      res[i][j] = func(i, j);
  }

  return res;
};


function retZero() { return 0; }


// Generate a rows x cols matrix of zeros.
jStat.zeros = function zeros(rows, cols) {
  if (!isNumber(cols))
    cols = rows;
  return jStat.create(rows, cols, retZero);
};


function retOne() { return 1; }


// Generate a rows x cols matrix of ones.
jStat.ones = function ones(rows, cols) {
  if (!isNumber(cols))
    cols = rows;
  return jStat.create(rows, cols, retOne);
};


// Generate a rows x cols matrix of uniformly random numbers.
jStat.rand = function rand(rows, cols) {
  if (!isNumber(cols))
    cols = rows;
  return jStat.create(rows, cols, Math.random);
};


function retIdent(i, j) { return i === j ? 1 : 0; }


// Generate an identity matrix of size row x cols.
jStat.identity = function identity(rows, cols) {
  if (!isNumber(cols))
    cols = rows;
  return jStat.create(rows, cols, retIdent);
};


// Tests whether a matrix is symmetric
jStat.symmetric = function symmetric(arr) {
  var issymmetric = true;
  var size = arr.length;
  var row, col;

  if (arr.length !== arr[0].length)
    return false;

  for (row = 0; row < size; row++) {
    for (col = 0; col < size; col++)
      if (arr[col][row] !== arr[row][col])
        return false;
  }

  return true;
};


// Set all values to zero.
jStat.clear = function clear(arr) {
  return jStat.alter(arr, retZero);
};


// Generate sequence.
jStat.seq = function seq(min, max, length, func) {
  if (!isFunction(func))
    func = false;

  var arr = [];
  var hival = calcRdx(min, max);
  var step = (max * hival - min * hival) / ((length - 1) * hival);
  var current = min;
  var cnt;

  // Current is assigned using a technique to compensate for IEEE error.
  // TODO: Needs better implementation.
  for (cnt = 0;
       current <= max;
       cnt++, current = (min * hival + step * hival * cnt) / hival) {
    arr.push((func ? func(current, cnt) : current));
  }

  return arr;
};


// arange(5) -> [0,1,2,3,4]
// arange(1,5) -> [1,2,3,4]
// arange(5,1,-1) -> [5,4,3,2]
jStat.arange = function arange(start, end, step) {
  var rl = [];
  step = step || 1;
  if (end === undefined) {
    end = start;
    start = 0;
  }
  if (start === end || step === 0) {
    return [];
  }
  if (start < end && step < 0) {
    return [];
  }
  if (start > end && step > 0) {
    return [];
  }
  if (step > 0) {
    for (i = start; i < end; i += step) {
      rl.push(i);
    }
  } else {
    for (i = start; i > end; i += step) {
      rl.push(i);
    }
  }
  return rl;
};


// A=[[1,2,3],[4,5,6],[7,8,9]]
// slice(A,{row:{end:2},col:{start:1}}) -> [[2,3],[5,6]]
// slice(A,1,{start:1}) -> [5,6]
// as numpy code A[:2,1:]
jStat.slice = (function(){
  function _slice(list, start, end, step) {
    // note it's not equal to range.map mode it's a bug
    var i;
    var rl = [];
    var length = list.length;
    if (start === undefined && end === undefined && step === undefined) {
      return jStat.copy(list);
    }

    start = start || 0;
    end = end || list.length;
    start = start >= 0 ? start : length + start;
    end = end >= 0 ? end : length + end;
    step = step || 1;
    if (start === end || step === 0) {
      return [];
    }
    if (start < end && step < 0) {
      return [];
    }
    if (start > end && step > 0) {
      return [];
    }
    if (step > 0) {
      for (i = start; i < end; i += step) {
        rl.push(list[i]);
      }
    } else {
      for (i = start; i > end;i += step) {
        rl.push(list[i]);
      }
    }
    return rl;
  }

  function slice(list, rcSlice) {
    rcSlice = rcSlice || {};
    if (isNumber(rcSlice.row)) {
      if (isNumber(rcSlice.col))
        return list[rcSlice.row][rcSlice.col];
      var row = jStat.rowa(list, rcSlice.row);
      var colSlice = rcSlice.col || {};
      return _slice(row, colSlice.start, colSlice.end, colSlice.step);
    }

    if (isNumber(rcSlice.col)) {
      var col = jStat.cola(list, rcSlice.col);
      var rowSlice = rcSlice.row || {};
      return _slice(col, rowSlice.start, rowSlice.end, rowSlice.step);
    }

    var rowSlice = rcSlice.row || {};
    var colSlice = rcSlice.col || {};
    var rows = _slice(list, rowSlice.start, rowSlice.end, rowSlice.step);
    return rows.map(function(row) {
      return _slice(row, colSlice.start, colSlice.end, colSlice.step);
    });
  }

  return slice;
}());


// A=[[1,2,3],[4,5,6],[7,8,9]]
// sliceAssign(A,{row:{start:1},col:{start:1}},[[0,0],[0,0]])
// A=[[1,2,3],[4,0,0],[7,0,0]]
jStat.sliceAssign = function sliceAssign(A, rcSlice, B) {
  if (isNumber(rcSlice.row)) {
    if (isNumber(rcSlice.col))
      return A[rcSlice.row][rcSlice.col] = B;
    rcSlice.col = rcSlice.col || {};
    rcSlice.col.start = rcSlice.col.start || 0;
    rcSlice.col.end = rcSlice.col.end || A[0].length;
    rcSlice.col.step = rcSlice.col.step || 1;
    var nl = jStat.arange(rcSlice.col.start,
                          Math.min(A.length, rcSlice.col.end),
                          rcSlice.col.step);
    var m = rcSlice.row;
    nl.forEach(function(n, i) {
      A[m][n] = B[i];
    });
    return A;
  }

  if (isNumber(rcSlice.col)) {
    rcSlice.row = rcSlice.row || {};
    rcSlice.row.start = rcSlice.row.start || 0;
    rcSlice.row.end = rcSlice.row.end || A.length;
    rcSlice.row.step = rcSlice.row.step || 1;
    var ml = jStat.arange(rcSlice.row.start,
                          Math.min(A[0].length, rcSlice.row.end),
                          rcSlice.row.step);
    var n = rcSlice.col;
    ml.forEach(function(m, j) {
      A[m][n] = B[j];
    });
    return A;
  }

  if (B[0].length === undefined) {
    B = [B];
  }
  rcSlice.row.start = rcSlice.row.start || 0;
  rcSlice.row.end = rcSlice.row.end || A.length;
  rcSlice.row.step = rcSlice.row.step || 1;
  rcSlice.col.start = rcSlice.col.start || 0;
  rcSlice.col.end = rcSlice.col.end || A[0].length;
  rcSlice.col.step = rcSlice.col.step || 1;
  var ml = jStat.arange(rcSlice.row.start,
                        Math.min(A.length, rcSlice.row.end),
                        rcSlice.row.step);
  var nl = jStat.arange(rcSlice.col.start,
                        Math.min(A[0].length, rcSlice.col.end),
                        rcSlice.col.step);
  ml.forEach(function(m, i) {
    nl.forEach(function(n, j) {
      A[m][n] = B[i][j];
    });
  });
  return A;
};


// [1,2,3] ->
// [[1,0,0],[0,2,0],[0,0,3]]
jStat.diagonal = function diagonal(diagArray) {
  var mat = jStat.zeros(diagArray.length, diagArray.length);
  diagArray.forEach(function(t, i) {
    mat[i][i] = t;
  });
  return mat;
};


// return copy of A
jStat.copy = function copy(A) {
  return A.map(function(row) {
    if (isNumber(row))
      return row;
    return row.map(function(t) {
      return t;
    });
  });
};


// TODO: Go over this entire implementation. Seems a tragic waste of resources
// doing all this work. Instead, and while ugly, use new Function() to generate
// a custom function for each static method.

// Quick reference.
var jProto = jStat.prototype;

// Default length.
jProto.length = 0;

// For internal use only.
// TODO: Check if they're actually used, and if they are then rename them
// to _*
jProto.push = Array.prototype.push;
jProto.sort = Array.prototype.sort;
jProto.splice = Array.prototype.splice;
jProto.slice = Array.prototype.slice;


// Return a clean array.
jProto.toArray = function toArray() {
  return this.length > 1 ? slice.call(this) : slice.call(this)[0];
};


// Map a function to a matrix or vector.
jProto.map = function map(func, toAlter) {
  return jStat(jStat.map(this, func, toAlter));
};


// Cumulatively combine the elements of a matrix or vector using a function.
jProto.cumreduce = function cumreduce(func, toAlter) {
  return jStat(jStat.cumreduce(this, func, toAlter));
};


// Destructively alter an array.
jProto.alter = function alter(func) {
  jStat.alter(this, func);
  return this;
};


// Extend prototype with methods that have no argument.
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    jProto[passfunc] = function(func) {
      var self = this,
      results;
      // Check for callback.
      if (func) {
        setTimeout(function() {
          func.call(self, jProto[passfunc].call(self));
        });
        return this;
      }
      results = jStat[passfunc](this);
      return isArray(results) ? jStat(results) : results;
    };
  })(funcs[i]);
})('transpose clear symmetric rows cols dimensions diag antidiag'.split(' '));


// Extend prototype with methods that have one argument.
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    jProto[passfunc] = function(index, func) {
      var self = this;
      // check for callback
      if (func) {
        setTimeout(function() {
          func.call(self, jProto[passfunc].call(self, index));
        });
        return this;
      }
      return jStat(jStat[passfunc](this, index));
    };
  })(funcs[i]);
})('row col'.split(' '));


// Extend prototype with simple shortcut methods.
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    jProto[passfunc] = new Function(
        'return jStat(jStat.' + passfunc + '.apply(null, arguments));');
  })(funcs[i]);
})('create zeros ones rand identity'.split(' '));


// Exposing jStat.
return jStat;

}(Math));
(function(jStat, Math) {

var isFunction = jStat.utils.isFunction;

// Ascending functions for sort
function ascNum(a, b) { return a - b; }

function clip(arg, min, max) {
  return Math.max(min, Math.min(arg, max));
}


// sum of an array
jStat.sum = function sum(arr) {
  var sum = 0;
  var i = arr.length;
  while (--i >= 0)
    sum += arr[i];
  return sum;
};


// sum squared
jStat.sumsqrd = function sumsqrd(arr) {
  var sum = 0;
  var i = arr.length;
  while (--i >= 0)
    sum += arr[i] * arr[i];
  return sum;
};


// sum of squared errors of prediction (SSE)
jStat.sumsqerr = function sumsqerr(arr) {
  var mean = jStat.mean(arr);
  var sum = 0;
  var i = arr.length;
  var tmp;
  while (--i >= 0) {
    tmp = arr[i] - mean;
    sum += tmp * tmp;
  }
  return sum;
};

// sum of an array in each row
jStat.sumrow = function sumrow(arr) {
  var sum = 0;
  var i = arr.length;
  while (--i >= 0)
    sum += arr[i];
  return sum;
};

// product of an array
jStat.product = function product(arr) {
  var prod = 1;
  var i = arr.length;
  while (--i >= 0)
    prod *= arr[i];
  return prod;
};


// minimum value of an array
jStat.min = function min(arr) {
  var low = arr[0];
  var i = 0;
  while (++i < arr.length)
    if (arr[i] < low)
      low = arr[i];
  return low;
};


// maximum value of an array
jStat.max = function max(arr) {
  var high = arr[0];
  var i = 0;
  while (++i < arr.length)
    if (arr[i] > high)
      high = arr[i];
  return high;
};


// unique values of an array
jStat.unique = function unique(arr) {
  var hash = {}, _arr = [];
  for(var i = 0; i < arr.length; i++) {
    if (!hash[arr[i]]) {
      hash[arr[i]] = true;
      _arr.push(arr[i]);
    }
  }
  return _arr;
};


// mean value of an array
jStat.mean = function mean(arr) {
  return jStat.sum(arr) / arr.length;
};


// mean squared error (MSE)
jStat.meansqerr = function meansqerr(arr) {
  return jStat.sumsqerr(arr) / arr.length;
};


// geometric mean of an array
jStat.geomean = function geomean(arr) {
  return Math.pow(jStat.product(arr), 1 / arr.length);
};


// median of an array
jStat.median = function median(arr) {
  var arrlen = arr.length;
  var _arr = arr.slice().sort(ascNum);
  // check if array is even or odd, then return the appropriate
  return !(arrlen & 1)
    ? (_arr[(arrlen / 2) - 1 ] + _arr[(arrlen / 2)]) / 2
    : _arr[(arrlen / 2) | 0 ];
};


// cumulative sum of an array
jStat.cumsum = function cumsum(arr) {
  return jStat.cumreduce(arr, function (a, b) { return a + b; });
};


// cumulative product of an array
jStat.cumprod = function cumprod(arr) {
  return jStat.cumreduce(arr, function (a, b) { return a * b; });
};


// successive differences of a sequence
jStat.diff = function diff(arr) {
  var diffs = [];
  var arrLen = arr.length;
  var i;
  for (var i = 1; i < arrLen; i++)
    diffs.push(arr[i] - arr[i - 1]);
  return diffs;
};


// ranks of an array
jStat.rank = function (arr) {
  var arrlen = arr.length;
  var sorted = arr.slice().sort(ascNum);
  var ranks = new Array(arrlen);
  for (var i = 0; i < arrlen; i++) {
    var first = sorted.indexOf(arr[i]);
    var last = sorted.lastIndexOf(arr[i]);
    if (first === last) {
      var val = first;
    } else {
      var val = (first + last) / 2;
    }
    ranks[i] = val + 1;
  }
  return ranks;
};


// mode of an array
// if there are multiple modes of an array, return all of them
// is this the appropriate way of handling it?
jStat.mode = function mode(arr) {
  var arrLen = arr.length;
  var _arr = arr.slice().sort(ascNum);
  var count = 1;
  var maxCount = 0;
  var numMaxCount = 0;
  var mode_arr = [];
  var i;

  for (var i = 0; i < arrLen; i++) {
    if (_arr[i] === _arr[i + 1]) {
      count++;
    } else {
      if (count > maxCount) {
        mode_arr = [_arr[i]];
        maxCount = count;
        numMaxCount = 0;
      }
      // are there multiple max counts
      else if (count === maxCount) {
        mode_arr.push(_arr[i]);
        numMaxCount++;
      }
      // resetting count for new value in array
      count = 1;
    }
  }

  return numMaxCount === 0 ? mode_arr[0] : mode_arr;
};


// range of an array
jStat.range = function range(arr) {
  return jStat.max(arr) - jStat.min(arr);
};

// variance of an array
// flag = true indicates sample instead of population
jStat.variance = function variance(arr, flag) {
  return jStat.sumsqerr(arr) / (arr.length - (flag ? 1 : 0));
};

// deviation of an array
jStat.deviation = function (arr) {
  var mean = jStat.mean(arr);
  var arrlen = arr.length;
  var dev = new Array(arrlen);
  for (var i = 0; i < arrlen; i++) {
    dev[i] = arr[i] - mean;
  }
  return dev;
};

// standard deviation of an array
// flag = true indicates sample instead of population
jStat.stdev = function stdev(arr, flag) {
  return Math.sqrt(jStat.variance(arr, flag));
};


// mean deviation (mean absolute deviation) of an array
jStat.meandev = function meandev(arr) {
  var devSum = 0;
  var mean = jStat.mean(arr);
  var i;
  for (var i = arr.length - 1; i >= 0; i--)
    devSum += Math.abs(arr[i] - mean);
  return devSum / arr.length;
};


// median deviation (median absolute deviation) of an array
jStat.meddev = function meddev(arr) {
  var devSum = 0;
  var median = jStat.median(arr);
  var i;
  for (var i = arr.length - 1; i >= 0; i--)
    devSum += Math.abs(arr[i] - median);
  return devSum / arr.length;
};


// coefficient of variation
jStat.coeffvar = function coeffvar(arr) {
  return jStat.stdev(arr) / jStat.mean(arr);
};


// quartiles of an array
jStat.quartiles = function quartiles(arr) {
  var arrlen = arr.length;
  var _arr = arr.slice().sort(ascNum);
  return [
    _arr[ Math.round((arrlen) / 4) - 1 ],
    _arr[ Math.round((arrlen) / 2) - 1 ],
    _arr[ Math.round((arrlen) * 3 / 4) - 1 ]
  ];
};


// Arbitary quantiles of an array. Direct port of the scipy.stats
// implementation by Pierre GF Gerard-Marchant.
jStat.quantiles = function quantiles(arr, quantilesArray, alphap, betap) {
  var sortedArray = arr.slice().sort(ascNum);
  var quantileVals = [quantilesArray.length];
  var n = arr.length;
  var i, p, m, aleph, k, gamma;

  if (typeof alphap === 'undefined')
    alphap = 3 / 8;
  if (typeof betap === 'undefined')
    betap = 3 / 8;

  for (var i = 0; i < quantilesArray.length; i++) {
    p = quantilesArray[i];
    m = alphap + p * (1 - alphap - betap);
    aleph = n * p + m;
    k = Math.floor(clip(aleph, 1, n - 1));
    gamma = clip(aleph - k, 0, 1);
    quantileVals[i] = (1 - gamma) * sortedArray[k - 1] + gamma * sortedArray[k];
  }

  return quantileVals;
};

// Returns the k-th percentile of values in a range, where k is in the
// range 0..1, exclusive.
jStat.percentile = function percentile(arr, k) {
  var _arr = arr.slice().sort(ascNum);
  var realIndex = k * (_arr.length - 1);
  var index = parseInt(realIndex);
  var frac = realIndex - index;

  if (index + 1 < _arr.length) {
    return _arr[index] * (1 - frac) + _arr[index + 1] * frac;
  } else {
    return _arr[index];
  }
}


// The percentile rank of score in a given array. Returns the percentage
// of all values in the input array that are less than (kind='strict') or
// less or equal than (kind='weak') score. Default is weak.
jStat.percentileOfScore = function percentileOfScore(arr, score, kind) {
  var counter = 0;
  var len = arr.length;
  var strict = false;
  var value, i;

  if (kind === 'strict')
    strict = true;

  for (var i = 0; i < len; i++) {
    value = arr[i];
    if ((strict && value < score) ||
        (!strict && value <= score)) {
      counter++;
    }
  }

  return counter / len;
};


// Histogram (bin count) data
jStat.histogram = function histogram(arr, bins) {
  var first = jStat.min(arr);
  var binCnt = bins || 4;
  var binWidth = (jStat.max(arr) - first) / binCnt;
  var len = arr.length;
  var bins = [];
  var i;

  for (var i = 0; i < binCnt; i++)
    bins[i] = 0;
  for (var i = 0; i < len; i++)
    bins[Math.min(Math.floor(((arr[i] - first) / binWidth)), binCnt - 1)] += 1;

  return bins;
};


// covariance of two arrays
jStat.covariance = function covariance(arr1, arr2) {
  var u = jStat.mean(arr1);
  var v = jStat.mean(arr2);
  var arr1Len = arr1.length;
  var sq_dev = new Array(arr1Len);
  var i;

  for (var i = 0; i < arr1Len; i++)
    sq_dev[i] = (arr1[i] - u) * (arr2[i] - v);

  return jStat.sum(sq_dev) / (arr1Len - 1);
};


// (pearson's) population correlation coefficient, rho
jStat.corrcoeff = function corrcoeff(arr1, arr2) {
  return jStat.covariance(arr1, arr2) /
      jStat.stdev(arr1, 1) /
      jStat.stdev(arr2, 1);
};

  // (spearman's) rank correlation coefficient, sp
jStat.spearmancoeff =  function (arr1, arr2) {
  arr1 = jStat.rank(arr1);
  arr2 = jStat.rank(arr2);
  var arr1dev = jStat.deviation(arr1);
  var arr2dev = jStat.deviation(arr2);
  return jStat.sum(arr1dev.map(function (x, i) {
    return x * arr2dev[i];
  })) /
  Math.sqrt(jStat.sum(arr1dev.map(function (x) {
    return Math.pow(x, 2);
    })) * jStat.sum(arr2dev.map(function (x) {
      return Math.pow(x, 2);
  }))
  );
}


// statistical standardized moments (general form of skew/kurt)
jStat.stanMoment = function stanMoment(arr, n) {
  var mu = jStat.mean(arr);
  var sigma = jStat.stdev(arr);
  var len = arr.length;
  var skewSum = 0;

  for (var i = 0; i < len; i++)
    skewSum += Math.pow((arr[i] - mu) / sigma, n);

  return skewSum / arr.length;
};

// (pearson's) moment coefficient of skewness
jStat.skewness = function skewness(arr) {
  return jStat.stanMoment(arr, 3);
};

// (pearson's) (excess) kurtosis
jStat.kurtosis = function kurtosis(arr) {
  return jStat.stanMoment(arr, 4) - 3;
};


var jProto = jStat.prototype;


// Extend jProto with method for calculating cumulative sums and products.
// This differs from the similar extension below as cumsum and cumprod should
// not be run again in the case fullbool === true.
// If a matrix is passed, automatically assume operation should be done on the
// columns.
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    // If a matrix is passed, automatically assume operation should be done on
    // the columns.
    jProto[passfunc] = function(fullbool, func) {
      var arr = [];
      var i = 0;
      var tmpthis = this;
      // Assignment reassignation depending on how parameters were passed in.
      if (isFunction(fullbool)) {
        func = fullbool;
        fullbool = false;
      }
      // Check if a callback was passed with the function.
      if (func) {
        setTimeout(function() {
          func.call(tmpthis, jProto[passfunc].call(tmpthis, fullbool));
        });
        return this;
      }
      // Check if matrix and run calculations.
      if (this.length > 1) {
        tmpthis = fullbool === true ? this : this.transpose();
        for (; i < tmpthis.length; i++)
          arr[i] = jStat[passfunc](tmpthis[i]);
        return arr;
      }
      // Pass fullbool if only vector, not a matrix. for variance and stdev.
      return jStat[passfunc](this[0], fullbool);
    };
  })(funcs[i]);
})(('cumsum cumprod').split(' '));


// Extend jProto with methods which don't require arguments and work on columns.
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    // If a matrix is passed, automatically assume operation should be done on
    // the columns.
    jProto[passfunc] = function(fullbool, func) {
      var arr = [];
      var i = 0;
      var tmpthis = this;
      // Assignment reassignation depending on how parameters were passed in.
      if (isFunction(fullbool)) {
        func = fullbool;
        fullbool = false;
      }
      // Check if a callback was passed with the function.
      if (func) {
        setTimeout(function() {
          func.call(tmpthis, jProto[passfunc].call(tmpthis, fullbool));
        });
        return this;
      }
      // Check if matrix and run calculations.
      if (this.length > 1) {
        if (passfunc !== 'sumrow')
          tmpthis = fullbool === true ? this : this.transpose();
        for (; i < tmpthis.length; i++)
          arr[i] = jStat[passfunc](tmpthis[i]);
        return fullbool === true
            ? jStat[passfunc](jStat.utils.toVector(arr))
            : arr;
      }
      // Pass fullbool if only vector, not a matrix. for variance and stdev.
      return jStat[passfunc](this[0], fullbool);
    };
  })(funcs[i]);
})(('sum sumsqrd sumsqerr sumrow product min max unique mean meansqerr ' +
    'geomean median diff rank mode range variance deviation stdev meandev ' +
    'meddev coeffvar quartiles histogram skewness kurtosis').split(' '));


// Extend jProto with functions that take arguments. Operations on matrices are
// done on columns.
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    jProto[passfunc] = function() {
      var arr = [];
      var i = 0;
      var tmpthis = this;
      var args = Array.prototype.slice.call(arguments);

      // If the last argument is a function, we assume it's a callback; we
      // strip the callback out and call the function again.
      if (isFunction(args[args.length - 1])) {
        var callbackFunction = args[args.length - 1];
        var argsToPass = args.slice(0, args.length - 1);

        setTimeout(function() {
          callbackFunction.call(tmpthis,
                                jProto[passfunc].apply(tmpthis, argsToPass));
        });
        return this;

      // Otherwise we curry the function args and call normally.
      } else {
        var callbackFunction = undefined;
        var curriedFunction = function curriedFunction(vector) {
          return jStat[passfunc].apply(tmpthis, [vector].concat(args));
        }
      }

      // If this is a matrix, run column-by-column.
      if (this.length > 1) {
        tmpthis = tmpthis.transpose();
        for (; i < tmpthis.length; i++)
          arr[i] = curriedFunction(tmpthis[i]);
        return arr;
      }

      // Otherwise run on the vector.
      return curriedFunction(this[0]);
    };
  })(funcs[i]);
})('quantiles percentileOfScore'.split(' '));

}(this.jStat, Math));
// Special functions //
(function(jStat, Math) {

// Log-gamma function
jStat.gammaln = function gammaln(x) {
  var j = 0;
  var cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];
  var ser = 1.000000000190015;
  var xx, y, tmp;
  tmp = (y = xx = x) + 5.5;
  tmp -= (xx + 0.5) * Math.log(tmp);
  for (; j < 6; j++)
    ser += cof[j] / ++y;
  return Math.log(2.5066282746310005 * ser / xx) - tmp;
};


// gamma of x
jStat.gammafn = function gammafn(x) {
  var p = [-1.716185138865495, 24.76565080557592, -379.80425647094563,
           629.3311553128184, 866.9662027904133, -31451.272968848367,
           -36144.413418691176, 66456.14382024054
  ];
  var q = [-30.8402300119739, 315.35062697960416, -1015.1563674902192,
           -3107.771671572311, 22538.118420980151, 4755.8462775278811,
           -134659.9598649693, -115132.2596755535];
  var fact = false;
  var n = 0;
  var xden = 0;
  var xnum = 0;
  var y = x;
  var i, z, yi, res, sum, ysq;
  if (y <= 0) {
    res = y % 1 + 3.6e-16;
    if (res) {
      fact = (!(y & 1) ? 1 : -1) * Math.PI / Math.sin(Math.PI * res);
      y = 1 - y;
    } else {
      return Infinity;
    }
  }
  yi = y;
  if (y < 1) {
    z = y++;
  } else {
    z = (y -= n = (y | 0) - 1) - 1;
  }
  for (var i = 0; i < 8; ++i) {
    xnum = (xnum + p[i]) * z;
    xden = xden * z + q[i];
  }
  res = xnum / xden + 1;
  if (yi < y) {
    res /= yi;
  } else if (yi > y) {
    for (var i = 0; i < n; ++i) {
      res *= y;
      y++;
    }
  }
  if (fact) {
    res = fact / res;
  }
  return res;
};


// lower incomplete gamma function, which is usually typeset with a
// lower-case greek gamma as the function symbol
jStat.gammap = function gammap(a, x) {
  return jStat.lowRegGamma(a, x) * jStat.gammafn(a);
};


// The lower regularized incomplete gamma function, usually written P(a,x)
jStat.lowRegGamma = function lowRegGamma(a, x) {
  var aln = jStat.gammaln(a);
  var ap = a;
  var sum = 1 / a;
  var del = sum;
  var b = x + 1 - a;
  var c = 1 / 1.0e-30;
  var d = 1 / b;
  var h = d;
  var i = 1;
  // calculate maximum number of itterations required for a
  var ITMAX = -~(Math.log((a >= 1) ? a : 1 / a) * 8.5 + a * 0.4 + 17);
  var an, endval;

  if (x < 0 || a <= 0) {
    return NaN;
  } else if (x < a + 1) {
    for (; i <= ITMAX; i++) {
      sum += del *= x / ++ap;
    }
    return (sum * Math.exp(-x + a * Math.log(x) - (aln)));
  }

  for (; i <= ITMAX; i++) {
    an = -i * (i - a);
    b += 2;
    d = an * d + b;
    c = b + an / c;
    d = 1 / d;
    h *= d * c;
  }

  return (1 - h * Math.exp(-x + a * Math.log(x) - (aln)));
};

// natural log factorial of n
jStat.factorialln = function factorialln(n) {
  return n < 0 ? NaN : jStat.gammaln(n + 1);
};

// factorial of n
jStat.factorial = function factorial(n) {
  return n < 0 ? NaN : jStat.gammafn(n + 1);
};

// combinations of n, m
jStat.combination = function combination(n, m) {
  // make sure n or m don't exceed the upper limit of usable values
  return (n > 170 || m > 170)
      ? Math.exp(jStat.combinationln(n, m))
      : (jStat.factorial(n) / jStat.factorial(m)) / jStat.factorial(n - m);
};


jStat.combinationln = function combinationln(n, m){
  return jStat.factorialln(n) - jStat.factorialln(m) - jStat.factorialln(n - m);
};


// permutations of n, m
jStat.permutation = function permutation(n, m) {
  return jStat.factorial(n) / jStat.factorial(n - m);
};


// beta function
jStat.betafn = function betafn(x, y) {
  // ensure arguments are positive
  if (x <= 0 || y <= 0)
    return undefined;
  // make sure x + y doesn't exceed the upper limit of usable values
  return (x + y > 170)
      ? Math.exp(jStat.betaln(x, y))
      : jStat.gammafn(x) * jStat.gammafn(y) / jStat.gammafn(x + y);
};


// natural logarithm of beta function
jStat.betaln = function betaln(x, y) {
  return jStat.gammaln(x) + jStat.gammaln(y) - jStat.gammaln(x + y);
};


// Evaluates the continued fraction for incomplete beta function by modified
// Lentz's method.
jStat.betacf = function betacf(x, a, b) {
  var fpmin = 1e-30;
  var m = 1;
  var qab = a + b;
  var qap = a + 1;
  var qam = a - 1;
  var c = 1;
  var d = 1 - qab * x / qap;
  var m2, aa, del, h;

  // These q's will be used in factors that occur in the coefficients
  if (Math.abs(d) < fpmin)
    d = fpmin;
  d = 1 / d;
  h = d;

  for (; m <= 100; m++) {
    m2 = 2 * m;
    aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    // One step (the even one) of the recurrence
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin)
      d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin)
      c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    // Next step of the recurrence (the odd one)
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin)
      d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin)
      c = fpmin;
    d = 1 / d;
    del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < 3e-7)
      break;
  }

  return h;
};


// Returns the inverse of the lower regularized inomplete gamma function
jStat.gammapinv = function gammapinv(p, a) {
  var j = 0;
  var a1 = a - 1;
  var EPS = 1e-8;
  var gln = jStat.gammaln(a);
  var x, err, t, u, pp, lna1, afac;

  if (p >= 1)
    return Math.max(100, a + 100 * Math.sqrt(a));
  if (p <= 0)
    return 0;
  if (a > 1) {
    lna1 = Math.log(a1);
    afac = Math.exp(a1 * (lna1 - 1) - gln);
    pp = (p < 0.5) ? p : 1 - p;
    t = Math.sqrt(-2 * Math.log(pp));
    x = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t;
    if (p < 0.5)
      x = -x;
    x = Math.max(1e-3,
                 a * Math.pow(1 - 1 / (9 * a) - x / (3 * Math.sqrt(a)), 3));
  } else {
    t = 1 - a * (0.253 + a * 0.12);
    if (p < t)
      x = Math.pow(p / t, 1 / a);
    else
      x = 1 - Math.log(1 - (p - t) / (1 - t));
  }

  for(; j < 12; j++) {
    if (x <= 0)
      return 0;
    err = jStat.lowRegGamma(a, x) - p;
    if (a > 1)
      t = afac * Math.exp(-(x - a1) + a1 * (Math.log(x) - lna1));
    else
      t = Math.exp(-x + a1 * Math.log(x) - gln);
    u = err / t;
    x -= (t = u / (1 - 0.5 * Math.min(1, u * ((a - 1) / x - 1))));
    if (x <= 0)
      x = 0.5 * (x + t);
    if (Math.abs(t) < EPS * x)
      break;
  }

  return x;
};


// Returns the error function erf(x)
jStat.erf = function erf(x) {
  var cof = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2,
             -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
             4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6,
             1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8,
             6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
             -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
             -6.886027e-12, 8.94487e-13, 3.13092e-13,
             -1.12708e-13, 3.81e-16, 7.106e-15,
             -1.523e-15, -9.4e-17, 1.21e-16,
             -2.8e-17];
  var j = cof.length - 1;
  var isneg = false;
  var d = 0;
  var dd = 0;
  var t, ty, tmp, res;

  if (x < 0) {
    x = -x;
    isneg = true;
  }

  t = 2 / (2 + x);
  ty = 4 * t - 2;

  for(; j > 0; j--) {
    tmp = d;
    d = ty * d - dd + cof[j];
    dd = tmp;
  }

  res = t * Math.exp(-x * x + 0.5 * (cof[0] + ty * d) - dd);
  return isneg ? res - 1 : 1 - res;
};


// Returns the complmentary error function erfc(x)
jStat.erfc = function erfc(x) {
  return 1 - jStat.erf(x);
};


// Returns the inverse of the complementary error function
jStat.erfcinv = function erfcinv(p) {
  var j = 0;
  var x, err, t, pp;
  if (p >= 2)
    return -100;
  if (p <= 0)
    return 100;
  pp = (p < 1) ? p : 2 - p;
  t = Math.sqrt(-2 * Math.log(pp / 2));
  x = -0.70711 * ((2.30753 + t * 0.27061) /
                  (1 + t * (0.99229 + t * 0.04481)) - t);
  for (; j < 2; j++) {
    err = jStat.erfc(x) - pp;
    x += err / (1.12837916709551257 * Math.exp(-x * x) - x * err);
  }
  return (p < 1) ? x : -x;
};


// Returns the inverse of the incomplete beta function
jStat.ibetainv = function ibetainv(p, a, b) {
  var EPS = 1e-8;
  var a1 = a - 1;
  var b1 = b - 1;
  var j = 0;
  var lna, lnb, pp, t, u, err, x, al, h, w, afac;
  if (p <= 0)
    return 0;
  if (p >= 1)
    return 1;
  if (a >= 1 && b >= 1) {
    pp = (p < 0.5) ? p : 1 - p;
    t = Math.sqrt(-2 * Math.log(pp));
    x = (2.30753 + t * 0.27061) / (1 + t* (0.99229 + t * 0.04481)) - t;
    if (p < 0.5)
      x = -x;
    al = (x * x - 3) / 6;
    h = 2 / (1 / (2 * a - 1)  + 1 / (2 * b - 1));
    w = (x * Math.sqrt(al + h) / h) - (1 / (2 * b - 1) - 1 / (2 * a - 1)) *
        (al + 5 / 6 - 2 / (3 * h));
    x = a / (a + b * Math.exp(2 * w));
  } else {
    lna = Math.log(a / (a + b));
    lnb = Math.log(b / (a + b));
    t = Math.exp(a * lna) / a;
    u = Math.exp(b * lnb) / b;
    w = t + u;
    if (p < t / w)
      x = Math.pow(a * w * p, 1 / a);
    else
      x = 1 - Math.pow(b * w * (1 - p), 1 / b);
  }
  afac = -jStat.gammaln(a) - jStat.gammaln(b) + jStat.gammaln(a + b);
  for(; j < 10; j++) {
    if (x === 0 || x === 1)
      return x;
    err = jStat.ibeta(x, a, b) - p;
    t = Math.exp(a1 * Math.log(x) + b1 * Math.log(1 - x) + afac);
    u = err / t;
    x -= (t = u / (1 - 0.5 * Math.min(1, u * (a1 / x - b1 / (1 - x)))));
    if (x <= 0)
      x = 0.5 * (x + t);
    if (x >= 1)
      x = 0.5 * (x + t + 1);
    if (Math.abs(t) < EPS * x && j > 0)
      break;
  }
  return x;
};


// Returns the incomplete beta function I_x(a,b)
jStat.ibeta = function ibeta(x, a, b) {
  // Factors in front of the continued fraction.
  var bt = (x === 0 || x === 1) ?  0 :
    Math.exp(jStat.gammaln(a + b) - jStat.gammaln(a) -
             jStat.gammaln(b) + a * Math.log(x) + b *
             Math.log(1 - x));
  if (x < 0 || x > 1)
    return false;
  if (x < (a + 1) / (a + b + 2))
    // Use continued fraction directly.
    return bt * jStat.betacf(x, a, b) / a;
  // else use continued fraction after making the symmetry transformation.
  return 1 - bt * jStat.betacf(1 - x, b, a) / b;
};


// Returns a normal deviate (mu=0, sigma=1).
// If n and m are specified it returns a object of normal deviates.
jStat.randn = function randn(n, m) {
  var u, v, x, y, q, mat;
  if (!m)
    m = n;
  if (n)
    return jStat.create(n, m, function() { return jStat.randn(); });
  do {
    u = Math.random();
    v = 1.7156 * (Math.random() - 0.5);
    x = u - 0.449871;
    y = Math.abs(v) + 0.386595;
    q = x * x + y * (0.19600 * y - 0.25472 * x);
  } while (q > 0.27597 && (q > 0.27846 || v * v > -4 * Math.log(u) * u * u));
  return v / u;
};


// Returns a gamma deviate by the method of Marsaglia and Tsang.
jStat.randg = function randg(shape, n, m) {
  var oalph = shape;
  var a1, a2, u, v, x, mat;
  if (!m)
    m = n;
  if (!shape)
    shape = 1;
  if (n) {
    mat = jStat.zeros(n,m);
    mat.alter(function() { return jStat.randg(shape); });
    return mat;
  }
  if (shape < 1)
    shape += 1;
  a1 = shape - 1 / 3;
  a2 = 1 / Math.sqrt(9 * a1);
  do {
    do {
      x = jStat.randn();
      v = 1 + a2 * x;
    } while(v <= 0);
    v = v * v * v;
    u = Math.random();
  } while(u > 1 - 0.331 * Math.pow(x, 4) &&
          Math.log(u) > 0.5 * x*x + a1 * (1 - v + Math.log(v)));
  // alpha > 1
  if (shape == oalph)
    return a1 * v;
  // alpha < 1
  do {
    u = Math.random();
  } while(u === 0);
  return Math.pow(u, 1 / oalph) * a1 * v;
};


// making use of static methods on the instance
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    jStat.fn[passfunc] = function() {
      return jStat(
          jStat.map(this, function(value) { return jStat[passfunc](value); }));
    }
  })(funcs[i]);
})('gammaln gammafn factorial factorialln'.split(' '));


(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    jStat.fn[passfunc] = function() {
      return jStat(jStat[passfunc].apply(null, arguments));
    };
  })(funcs[i]);
})('randn'.split(' '));

}(this.jStat, Math));
(function(jStat, Math) {

// generate all distribution instance methods
(function(list) {
  for (var i = 0; i < list.length; i++) (function(func) {
    // distribution instance method
    jStat[func] = function(a, b, c) {
      if (!(this instanceof arguments.callee))
        return new arguments.callee(a, b, c);
      this._a = a;
      this._b = b;
      this._c = c;
      return this;
    };
    // distribution method to be used on a jStat instance
    jStat.fn[func] = function(a, b, c) {
      var newthis = jStat[func](a, b, c);
      newthis.data = this;
      return newthis;
    };
    // sample instance method
    jStat[func].prototype.sample = function(arr) {
      var a = this._a;
      var b = this._b;
      var c = this._c;
      if (arr)
        return jStat.alter(arr, function() {
          return jStat[func].sample(a, b, c);
        });
      else
        return jStat[func].sample(a, b, c);
    };
    // generate the pdf, cdf and inv instance methods
    (function(vals) {
      for (var i = 0; i < vals.length; i++) (function(fnfunc) {
        jStat[func].prototype[fnfunc] = function(x) {
          var a = this._a;
          var b = this._b;
          var c = this._c;
          if (!x && x !== 0)
            x = this.data;
          if (typeof x !== 'number') {
            return jStat.fn.map.call(x, function(x) {
              return jStat[func][fnfunc](x, a, b, c);
            });
          }
          return jStat[func][fnfunc](x, a, b, c);
        };
      })(vals[i]);
    })('pdf cdf inv'.split(' '));
    // generate the mean, median, mode and variance instance methods
    (function(vals) {
      for (var i = 0; i < vals.length; i++) (function(fnfunc) {
        jStat[func].prototype[fnfunc] = function() {
          return jStat[func][fnfunc](this._a, this._b, this._c);
        };
      })(vals[i]);
    })('mean median mode variance'.split(' '));
  })(list[i]);
})((
  'beta centralF cauchy chisquare exponential gamma invgamma kumaraswamy ' +
  'laplace lognormal noncentralt normal pareto studentt weibull uniform ' +
  'binomial negbin hypgeom poisson triangular'
).split(' '));



// extend beta function with static methods
jStat.extend(jStat.beta, {
  pdf: function pdf(x, alpha, beta) {
    // PDF is zero outside the support
    if (x > 1 || x < 0)
      return 0;
    // PDF is one for the uniform case
    if (alpha == 1 && beta == 1)
      return 1;

    if (alpha < 512 && beta < 512) {
      return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) /
          jStat.betafn(alpha, beta);
    } else {
      return Math.exp((alpha - 1) * Math.log(x) +
                      (beta - 1) * Math.log(1 - x) -
                      jStat.betaln(alpha, beta));
    }
  },

  cdf: function cdf(x, alpha, beta) {
    return (x > 1 || x < 0) ? (x > 1) * 1 : jStat.ibeta(x, alpha, beta);
  },

  inv: function inv(x, alpha, beta) {
    return jStat.ibetainv(x, alpha, beta);
  },

  mean: function mean(alpha, beta) {
    return alpha / (alpha + beta);
  },

  median: function median(alpha, beta) {
    return jStat.ibetainv(0.5, alpha, beta);
  },

  mode: function mode(alpha, beta) {
    return (alpha - 1 ) / ( alpha + beta - 2);
  },

  // return a random sample
  sample: function sample(alpha, beta) {
    var u = jStat.randg(alpha);
    return u / (u + jStat.randg(beta));
  },

  variance: function variance(alpha, beta) {
    return (alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1));
  }
});

// extend F function with static methods
jStat.extend(jStat.centralF, {
  // This implementation of the pdf function avoids float overflow
  // See the way that R calculates this value:
  // https://svn.r-project.org/R/trunk/src/nmath/df.c
  pdf: function pdf(x, df1, df2) {
    var p, q, f;

    if (x < 0)
      return 0;

    if (df1 <= 2) {
      if (x === 0 && df1 < 2) {
        return Infinity;
      }
      if (x === 0 && df1 === 2) {
        return 1;
      }
      return Math.sqrt((Math.pow(df1 * x, df1) * Math.pow(df2, df2)) /
                       (Math.pow(df1 * x + df2, df1 + df2))) /
                       (x * jStat.betafn(df1/2, df2/2));
    }

    p = (df1 * x) / (df2 + x * df1);
    q = df2 / (df2 + x * df1);
    f = df1 * q / 2.0;
    return f * jStat.binomial.pdf((df1 - 2) / 2, (df1 + df2 - 2) / 2, p);
  },

  cdf: function cdf(x, df1, df2) {
    if (x < 0)
      return 0;
    return jStat.ibeta((df1 * x) / (df1 * x + df2), df1 / 2, df2 / 2);
  },

  inv: function inv(x, df1, df2) {
    return df2 / (df1 * (1 / jStat.ibetainv(x, df1 / 2, df2 / 2) - 1));
  },

  mean: function mean(df1, df2) {
    return (df2 > 2) ? df2 / (df2 - 2) : undefined;
  },

  mode: function mode(df1, df2) {
    return (df1 > 2) ? (df2 * (df1 - 2)) / (df1 * (df2 + 2)) : undefined;
  },

  // return a random sample
  sample: function sample(df1, df2) {
    var x1 = jStat.randg(df1 / 2) * 2;
    var x2 = jStat.randg(df2 / 2) * 2;
    return (x1 / df1) / (x2 / df2);
  },

  variance: function variance(df1, df2) {
    if (df2 <= 4)
      return undefined;
    return 2 * df2 * df2 * (df1 + df2 - 2) /
        (df1 * (df2 - 2) * (df2 - 2) * (df2 - 4));
  }
});


// extend cauchy function with static methods
jStat.extend(jStat.cauchy, {
  pdf: function pdf(x, local, scale) {
    if (scale < 0) { return 0; }

    return (scale / (Math.pow(x - local, 2) + Math.pow(scale, 2))) / Math.PI;
  },

  cdf: function cdf(x, local, scale) {
    return Math.atan((x - local) / scale) / Math.PI + 0.5;
  },

  inv: function(p, local, scale) {
    return local + scale * Math.tan(Math.PI * (p - 0.5));
  },

  median: function median(local, scale) {
    return local;
  },

  mode: function mode(local, scale) {
    return local;
  },

  sample: function sample(local, scale) {
    return jStat.randn() *
        Math.sqrt(1 / (2 * jStat.randg(0.5))) * scale + local;
  }
});



// extend chisquare function with static methods
jStat.extend(jStat.chisquare, {
  pdf: function pdf(x, dof) {
    if (x < 0)
      return 0;
    return (x === 0 && dof === 2) ? 0.5 :
        Math.exp((dof / 2 - 1) * Math.log(x) - x / 2 - (dof / 2) *
                 Math.log(2) - jStat.gammaln(dof / 2));
  },

  cdf: function cdf(x, dof) {
    if (x < 0)
      return 0;
    return jStat.lowRegGamma(dof / 2, x / 2);
  },

  inv: function(p, dof) {
    return 2 * jStat.gammapinv(p, 0.5 * dof);
  },

  mean : function(dof) {
    return dof;
  },

  // TODO: this is an approximation (is there a better way?)
  median: function median(dof) {
    return dof * Math.pow(1 - (2 / (9 * dof)), 3);
  },

  mode: function mode(dof) {
    return (dof - 2 > 0) ? dof - 2 : 0;
  },

  sample: function sample(dof) {
    return jStat.randg(dof / 2) * 2;
  },

  variance: function variance(dof) {
    return 2 * dof;
  }
});



// extend exponential function with static methods
jStat.extend(jStat.exponential, {
  pdf: function pdf(x, rate) {
    return x < 0 ? 0 : rate * Math.exp(-rate * x);
  },

  cdf: function cdf(x, rate) {
    return x < 0 ? 0 : 1 - Math.exp(-rate * x);
  },

  inv: function(p, rate) {
    return -Math.log(1 - p) / rate;
  },

  mean : function(rate) {
    return 1 / rate;
  },

  median: function (rate) {
    return (1 / rate) * Math.log(2);
  },

  mode: function mode(rate) {
    return 0;
  },

  sample: function sample(rate) {
    return -1 / rate * Math.log(Math.random());
  },

  variance : function(rate) {
    return Math.pow(rate, -2);
  }
});



// extend gamma function with static methods
jStat.extend(jStat.gamma, {
  pdf: function pdf(x, shape, scale) {
    if (x < 0)
      return 0;
    return (x === 0 && shape === 1) ? 1 / scale :
            Math.exp((shape - 1) * Math.log(x) - x / scale -
                    jStat.gammaln(shape) - shape * Math.log(scale));
  },

  cdf: function cdf(x, shape, scale) {
    if (x < 0)
      return 0;
    return jStat.lowRegGamma(shape, x / scale);
  },

  inv: function(p, shape, scale) {
    return jStat.gammapinv(p, shape) * scale;
  },

  mean : function(shape, scale) {
    return shape * scale;
  },

  mode: function mode(shape, scale) {
    if(shape > 1) return (shape - 1) * scale;
    return undefined;
  },

  sample: function sample(shape, scale) {
    return jStat.randg(shape) * scale;
  },

  variance: function variance(shape, scale) {
    return shape * scale * scale;
  }
});

// extend inverse gamma function with static methods
jStat.extend(jStat.invgamma, {
  pdf: function pdf(x, shape, scale) {
    if (x <= 0)
      return 0;
    return Math.exp(-(shape + 1) * Math.log(x) - scale / x -
                    jStat.gammaln(shape) + shape * Math.log(scale));
  },

  cdf: function cdf(x, shape, scale) {
    if (x <= 0)
      return 0;
    return 1 - jStat.lowRegGamma(shape, scale / x);
  },

  inv: function(p, shape, scale) {
    return scale / jStat.gammapinv(1 - p, shape);
  },

  mean : function(shape, scale) {
    return (shape > 1) ? scale / (shape - 1) : undefined;
  },

  mode: function mode(shape, scale) {
    return scale / (shape + 1);
  },

  sample: function sample(shape, scale) {
    return scale / jStat.randg(shape);
  },

  variance: function variance(shape, scale) {
    if (shape <= 2)
      return undefined;
    return scale * scale / ((shape - 1) * (shape - 1) * (shape - 2));
  }
});


// extend kumaraswamy function with static methods
jStat.extend(jStat.kumaraswamy, {
  pdf: function pdf(x, alpha, beta) {
    if (x === 0 && alpha === 1)
      return beta;
    else if (x === 1 && beta === 1)
      return alpha;
    return Math.exp(Math.log(alpha) + Math.log(beta) + (alpha - 1) *
                    Math.log(x) + (beta - 1) *
                    Math.log(1 - Math.pow(x, alpha)));
  },

  cdf: function cdf(x, alpha, beta) {
    if (x < 0)
      return 0;
    else if (x > 1)
      return 1;
    return (1 - Math.pow(1 - Math.pow(x, alpha), beta));
  },

  inv: function inv(p, alpha, beta) {
    return Math.pow(1 - Math.pow(1 - p, 1 / beta), 1 / alpha);
  },

  mean : function(alpha, beta) {
    return (beta * jStat.gammafn(1 + 1 / alpha) *
            jStat.gammafn(beta)) / (jStat.gammafn(1 + 1 / alpha + beta));
  },

  median: function median(alpha, beta) {
    return Math.pow(1 - Math.pow(2, -1 / beta), 1 / alpha);
  },

  mode: function mode(alpha, beta) {
    if (!(alpha >= 1 && beta >= 1 && (alpha !== 1 && beta !== 1)))
      return undefined;
    return Math.pow((alpha - 1) / (alpha * beta - 1), 1 / alpha);
  },

  variance: function variance(alpha, beta) {
    throw new Error('variance not yet implemented');
    // TODO: complete this
  }
});



// extend lognormal function with static methods
jStat.extend(jStat.lognormal, {
  pdf: function pdf(x, mu, sigma) {
    if (x <= 0)
      return 0;
    return Math.exp(-Math.log(x) - 0.5 * Math.log(2 * Math.PI) -
                    Math.log(sigma) - Math.pow(Math.log(x) - mu, 2) /
                    (2 * sigma * sigma));
  },

  cdf: function cdf(x, mu, sigma) {
    if (x < 0)
      return 0;
    return 0.5 +
        (0.5 * jStat.erf((Math.log(x) - mu) / Math.sqrt(2 * sigma * sigma)));
  },

  inv: function(p, mu, sigma) {
    return Math.exp(-1.41421356237309505 * sigma * jStat.erfcinv(2 * p) + mu);
  },

  mean: function mean(mu, sigma) {
    return Math.exp(mu + sigma * sigma / 2);
  },

  median: function median(mu, sigma) {
    return Math.exp(mu);
  },

  mode: function mode(mu, sigma) {
    return Math.exp(mu - sigma * sigma);
  },

  sample: function sample(mu, sigma) {
    return Math.exp(jStat.randn() * sigma + mu);
  },

  variance: function variance(mu, sigma) {
    return (Math.exp(sigma * sigma) - 1) * Math.exp(2 * mu + sigma * sigma);
  }
});



// extend noncentralt function with static methods
jStat.extend(jStat.noncentralt, {
  pdf: function pdf(x, dof, ncp) {
    var tol = 1e-14;
    if (Math.abs(ncp) < tol)  // ncp approx 0; use student-t
      return jStat.studentt.pdf(x, dof)

    if (Math.abs(x) < tol) {  // different formula for x == 0
      return Math.exp(jStat.gammaln((dof + 1) / 2) - ncp * ncp / 2 -
                      0.5 * Math.log(Math.PI * dof) - jStat.gammaln(dof / 2));
    }

    // formula for x != 0
    return dof / x *
        (jStat.noncentralt.cdf(x * Math.sqrt(1 + 2 / dof), dof+2, ncp) -
         jStat.noncentralt.cdf(x, dof, ncp));
  },

  cdf: function cdf(x, dof, ncp) {
    var tol = 1e-14;
    var min_iterations = 200;

    if (Math.abs(ncp) < tol)  // ncp approx 0; use student-t
      return jStat.studentt.cdf(x, dof);

    // turn negative x into positive and flip result afterwards
    var flip = false;
    if (x < 0) {
      flip = true;
      ncp = -ncp;
    }

    var prob = jStat.normal.cdf(-ncp, 0, 1);
    var value = tol + 1;
    // use value at last two steps to determine convergence
    var lastvalue = value;
    var y = x * x / (x * x + dof);
    var j = 0;
    var p = Math.exp(-ncp * ncp / 2);
    var q = Math.exp(-ncp * ncp / 2 - 0.5 * Math.log(2) -
                     jStat.gammaln(3 / 2)) * ncp;
    while (j < min_iterations || lastvalue > tol || value > tol) {
      lastvalue = value;
      if (j > 0) {
        p *= (ncp * ncp) / (2 * j);
        q *= (ncp * ncp) / (2 * (j + 1 / 2));
      }
      value = p * jStat.beta.cdf(y, j + 0.5, dof / 2) +
          q * jStat.beta.cdf(y, j+1, dof/2);
      prob += 0.5 * value;
      j++;
    }

    return flip ? (1 - prob) : prob;
  }
});


// extend normal function with static methods
jStat.extend(jStat.normal, {
  pdf: function pdf(x, mean, std) {
    return Math.exp(-0.5 * Math.log(2 * Math.PI) -
                    Math.log(std) - Math.pow(x - mean, 2) / (2 * std * std));
  },

  cdf: function cdf(x, mean, std) {
    return 0.5 * (1 + jStat.erf((x - mean) / Math.sqrt(2 * std * std)));
  },

  inv: function(p, mean, std) {
    return -1.41421356237309505 * std * jStat.erfcinv(2 * p) + mean;
  },

  mean : function(mean, std) {
    return mean;
  },

  median: function median(mean, std) {
    return mean;
  },

  mode: function (mean, std) {
    return mean;
  },

  sample: function sample(mean, std) {
    return jStat.randn() * std + mean;
  },

  variance : function(mean, std) {
    return std * std;
  }
});



// extend pareto function with static methods
jStat.extend(jStat.pareto, {
  pdf: function pdf(x, scale, shape) {
    if (x < scale)
      return 0;
    return (shape * Math.pow(scale, shape)) / Math.pow(x, shape + 1);
  },

  cdf: function cdf(x, scale, shape) {
    if (x < scale)
      return 0;
    return 1 - Math.pow(scale / x, shape);
  },

  inv: function inv(p, scale, shape) {
    return scale / Math.pow(1 - p, 1 / shape);
  },

  mean: function mean(scale, shape) {
    if (shape <= 1)
      return undefined;
    return (shape * Math.pow(scale, shape)) / (shape - 1);
  },

  median: function median(scale, shape) {
    return scale * (shape * Math.SQRT2);
  },

  mode: function mode(scale, shape) {
    return scale;
  },

  variance : function(scale, shape) {
    if (shape <= 2)
      return undefined;
    return (scale*scale * shape) / (Math.pow(shape - 1, 2) * (shape - 2));
  }
});



// extend studentt function with static methods
jStat.extend(jStat.studentt, {
  pdf: function pdf(x, dof) {
    dof = dof > 1e100 ? 1e100 : dof;
    return (1/(Math.sqrt(dof) * jStat.betafn(0.5, dof/2))) *
        Math.pow(1 + ((x * x) / dof), -((dof + 1) / 2));
  },

  cdf: function cdf(x, dof) {
    var dof2 = dof / 2;
    return jStat.ibeta((x + Math.sqrt(x * x + dof)) /
                       (2 * Math.sqrt(x * x + dof)), dof2, dof2);
  },

  inv: function(p, dof) {
    var x = jStat.ibetainv(2 * Math.min(p, 1 - p), 0.5 * dof, 0.5);
    x = Math.sqrt(dof * (1 - x) / x);
    return (p > 0.5) ? x : -x;
  },

  mean: function mean(dof) {
    return (dof > 1) ? 0 : undefined;
  },

  median: function median(dof) {
    return 0;
  },

  mode: function mode(dof) {
    return 0;
  },

  sample: function sample(dof) {
    return jStat.randn() * Math.sqrt(dof / (2 * jStat.randg(dof / 2)));
  },

  variance: function variance(dof) {
    return (dof  > 2) ? dof / (dof - 2) : (dof > 1) ? Infinity : undefined;
  }
});



// extend weibull function with static methods
jStat.extend(jStat.weibull, {
  pdf: function pdf(x, scale, shape) {
    if (x < 0 || scale < 0 || shape < 0)
      return 0;
    return (shape / scale) * Math.pow((x / scale), (shape - 1)) *
        Math.exp(-(Math.pow((x / scale), shape)));
  },

  cdf: function cdf(x, scale, shape) {
    return x < 0 ? 0 : 1 - Math.exp(-Math.pow((x / scale), shape));
  },

  inv: function(p, scale, shape) {
    return scale * Math.pow(-Math.log(1 - p), 1 / shape);
  },

  mean : function(scale, shape) {
    return scale * jStat.gammafn(1 + 1 / shape);
  },

  median: function median(scale, shape) {
    return scale * Math.pow(Math.log(2), 1 / shape);
  },

  mode: function mode(scale, shape) {
    if (shape <= 1)
      return 0;
    return scale * Math.pow((shape - 1) / shape, 1 / shape);
  },

  sample: function sample(scale, shape) {
    return scale * Math.pow(-Math.log(Math.random()), 1 / shape);
  },

  variance: function variance(scale, shape) {
    return scale * scale * jStat.gammafn(1 + 2 / shape) -
        Math.pow(jStat.weibull.mean(scale, shape), 2);
  }
});



// extend uniform function with static methods
jStat.extend(jStat.uniform, {
  pdf: function pdf(x, a, b) {
    return (x < a || x > b) ? 0 : 1 / (b - a);
  },

  cdf: function cdf(x, a, b) {
    if (x < a)
      return 0;
    else if (x < b)
      return (x - a) / (b - a);
    return 1;
  },

  inv: function(p, a, b) {
    return a + (p * (b - a));
  },

  mean: function mean(a, b) {
    return 0.5 * (a + b);
  },

  median: function median(a, b) {
    return jStat.mean(a, b);
  },

  mode: function mode(a, b) {
    throw new Error('mode is not yet implemented');
  },

  sample: function sample(a, b) {
    return (a / 2 + b / 2) + (b / 2 - a / 2) * (2 * Math.random() - 1);
  },

  variance: function variance(a, b) {
    return Math.pow(b - a, 2) / 12;
  }
});



// extend uniform function with static methods
jStat.extend(jStat.binomial, {
  pdf: function pdf(k, n, p) {
    return (p === 0 || p === 1) ?
      ((n * p) === k ? 1 : 0) :
      jStat.combination(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  },

  cdf: function cdf(x, n, p) {
    var binomarr = [],
    k = 0;
    if (x < 0) {
      return 0;
    }
    if (x < n) {
      for (; k <= x; k++) {
        binomarr[ k ] = jStat.binomial.pdf(k, n, p);
      }
      return jStat.sum(binomarr);
    }
    return 1;
  }
});



// extend uniform function with static methods
jStat.extend(jStat.negbin, {
  pdf: function pdf(k, r, p) {
    if (k !== k >>> 0)
      return false;
    if (k < 0)
      return 0;
    return jStat.combination(k + r - 1, r - 1) *
        Math.pow(1 - p, k) * Math.pow(p, r);
  },

  cdf: function cdf(x, r, p) {
    var sum = 0,
    k = 0;
    if (x < 0) return 0;
    for (; k <= x; k++) {
      sum += jStat.negbin.pdf(k, r, p);
    }
    return sum;
  }
});



// extend uniform function with static methods
jStat.extend(jStat.hypgeom, {
  pdf: function pdf(k, N, m, n) {
    // Hypergeometric PDF.

    // A simplification of the CDF algorithm below.

    // k = number of successes drawn
    // N = population size
    // m = number of successes in population
    // n = number of items drawn from population

    if(k !== k | 0) {
      return false;
    } else if(k < 0 || k < m - (N - n)) {
      // It's impossible to have this few successes drawn.
      return 0;
    } else if(k > n || k > m) {
      // It's impossible to have this many successes drawn.
      return 0;
    } else if (m * 2 > N) {
      // More than half the population is successes.

      if(n * 2 > N) {
        // More than half the population is sampled.

        return jStat.hypgeom.pdf(N - m - n + k, N, N - m, N - n)
      } else {
        // Half or less of the population is sampled.

        return jStat.hypgeom.pdf(n - k, N, N - m, n);
      }

    } else if(n * 2 > N) {
      // Half or less is successes.

      return jStat.hypgeom.pdf(m - k, N, m, N - n);

    } else if(m < n) {
      // We want to have the number of things sampled to be less than the
      // successes available. So swap the definitions of successful and sampled.
      return jStat.hypgeom.pdf(k, N, n, m);
    } else {
      // If we get here, half or less of the population was sampled, half or
      // less of it was successes, and we had fewer sampled things than
      // successes. Now we can do this complicated iterative algorithm in an
      // efficient way.

      // The basic premise of the algorithm is that we partially normalize our
      // intermediate product to keep it in a numerically good region, and then
      // finish the normalization at the end.

      // This variable holds the scaled probability of the current number of
      // successes.
      var scaledPDF = 1;

      // This keeps track of how much we have normalized.
      var samplesDone = 0;

      for(var i = 0; i < k; i++) {
        // For every possible number of successes up to that observed...

        while(scaledPDF > 1 && samplesDone < n) {
          // Intermediate result is growing too big. Apply some of the
          // normalization to shrink everything.

          scaledPDF *= 1 - (m / (N - samplesDone));

          // Say we've normalized by this sample already.
          samplesDone++;
        }

        // Work out the partially-normalized hypergeometric PDF for the next
        // number of successes
        scaledPDF *= (n - i) * (m - i) / ((i + 1) * (N - m - n + i + 1));
      }

      for(; samplesDone < n; samplesDone++) {
        // Apply all the rest of the normalization
        scaledPDF *= 1 - (m / (N - samplesDone));
      }

      // Bound answer sanely before returning.
      return Math.min(1, Math.max(0, scaledPDF));
    }
  },

  cdf: function cdf(x, N, m, n) {
    // Hypergeometric CDF.

    // This algorithm is due to Prof. Thomas S. Ferguson, <tom@math.ucla.edu>,
    // and comes from his hypergeometric test calculator at
    // <http://www.math.ucla.edu/~tom/distributions/Hypergeometric.html>.

    // x = number of successes drawn
    // N = population size
    // m = number of successes in population
    // n = number of items drawn from population

    if(x < 0 || x < m - (N - n)) {
      // It's impossible to have this few successes drawn or fewer.
      return 0;
    } else if(x >= n || x >= m) {
      // We will always have this many successes or fewer.
      return 1;
    } else if (m * 2 > N) {
      // More than half the population is successes.

      if(n * 2 > N) {
        // More than half the population is sampled.

        return jStat.hypgeom.cdf(N - m - n + x, N, N - m, N - n)
      } else {
        // Half or less of the population is sampled.

        return 1 - jStat.hypgeom.cdf(n - x - 1, N, N - m, n);
      }

    } else if(n * 2 > N) {
      // Half or less is successes.

      return 1 - jStat.hypgeom.cdf(m - x - 1, N, m, N - n);

    } else if(m < n) {
      // We want to have the number of things sampled to be less than the
      // successes available. So swap the definitions of successful and sampled.
      return jStat.hypgeom.cdf(x, N, n, m);
    } else {
      // If we get here, half or less of the population was sampled, half or
      // less of it was successes, and we had fewer sampled things than
      // successes. Now we can do this complicated iterative algorithm in an
      // efficient way.

      // The basic premise of the algorithm is that we partially normalize our
      // intermediate sum to keep it in a numerically good region, and then
      // finish the normalization at the end.

      // Holds the intermediate, scaled total CDF.
      var scaledCDF = 1;

      // This variable holds the scaled probability of the current number of
      // successes.
      var scaledPDF = 1;

      // This keeps track of how much we have normalized.
      var samplesDone = 0;

      for(var i = 0; i < x; i++) {
        // For every possible number of successes up to that observed...

        while(scaledCDF > 1 && samplesDone < n) {
          // Intermediate result is growing too big. Apply some of the
          // normalization to shrink everything.

          var factor = 1 - (m / (N - samplesDone));

          scaledPDF *= factor;
          scaledCDF *= factor;

          // Say we've normalized by this sample already.
          samplesDone++;
        }

        // Work out the partially-normalized hypergeometric PDF for the next
        // number of successes
        scaledPDF *= (n - i) * (m - i) / ((i + 1) * (N - m - n + i + 1));

        // Add to the CDF answer.
        scaledCDF += scaledPDF;
      }

      for(; samplesDone < n; samplesDone++) {
        // Apply all the rest of the normalization
        scaledCDF *= 1 - (m / (N - samplesDone));
      }

      // Bound answer sanely before returning.
      return Math.min(1, Math.max(0, scaledCDF));
    }
  }
});



// extend uniform function with static methods
jStat.extend(jStat.poisson, {
  pdf: function pdf(k, l) {
    if (l < 0 || (k % 1) !== 0 || k < 0) {
      return 0;
    }

    return Math.pow(l, k) * Math.exp(-l) / jStat.factorial(k);
  },

  cdf: function cdf(x, l) {
    var sumarr = [],
    k = 0;
    if (x < 0) return 0;
    for (; k <= x; k++) {
      sumarr.push(jStat.poisson.pdf(k, l));
    }
    return jStat.sum(sumarr);
  },

  mean : function(l) {
    return l;
  },

  variance : function(l) {
    return l;
  },

  sample: function sample(l) {
    var p = 1, k = 0, L = Math.exp(-l);
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }
});

// extend triangular function with static methods
jStat.extend(jStat.triangular, {
  pdf: function pdf(x, a, b, c) {
    if (b <= a || c < a || c > b) {
      return NaN;
    } else {
      if (x < a || x > b) {
        return 0;
      } else if (x < c) {
          return (2 * (x - a)) / ((b - a) * (c - a));
      } else if (x === c) {
          return (2 / (b - a));
      } else { // x > c
          return (2 * (b - x)) / ((b - a) * (b - c));
      }
    }
  },

  cdf: function cdf(x, a, b, c) {
    if (b <= a || c < a || c > b)
      return NaN;
    if (x <= a)
      return 0;
    else if (x >= b)
      return 1;
    if (x <= c)
      return Math.pow(x - a, 2) / ((b - a) * (c - a));
    else // x > c
      return 1 - Math.pow(b - x, 2) / ((b - a) * (b - c));
  },

  inv: function inv(p, a, b, c) {
    if (b <= a || c < a || c > b) {
      return NaN;
    } else {
      if (p <= ((c - a) / (b - a))) {
        return a + (b - a) * Math.sqrt(p * ((c - a) / (b - a)));
      } else { // p > ((c - a) / (b - a))
        return a + (b - a) * (1 - Math.sqrt((1 - p) * (1 - ((c - a) / (b - a)))));
      }
    }
  },

  mean: function mean(a, b, c) {
    return (a + b + c) / 3;
  },

  median: function median(a, b, c) {
    if (c <= (a + b) / 2) {
      return b - Math.sqrt((b - a) * (b - c)) / Math.sqrt(2);
    } else if (c > (a + b) / 2) {
      return a + Math.sqrt((b - a) * (c - a)) / Math.sqrt(2);
    }
  },

  mode: function mode(a, b, c) {
    return c;
  },

  sample: function sample(a, b, c) {
    var u = Math.random();
    if (u < ((c - a) / (b - a)))
      return a + Math.sqrt(u * (b - a) * (c - a))
    return b - Math.sqrt((1 - u) * (b - a) * (b - c));
  },

  variance: function variance(a, b, c) {
    return (a * a + b * b + c * c - a * b - a * c - b * c) / 18;
  }
});

function laplaceSign(x) { return x / Math.abs(x); }

jStat.extend(jStat.laplace, {
  pdf: function pdf(x, mu, b) {
    return (b <= 0) ? 0 : (Math.exp(-Math.abs(x - mu) / b)) / (2 * b);
  },

  cdf: function cdf(x, mu, b) {
    if (b <= 0) { return 0; }

    if(x < mu) {
      return 0.5 * Math.exp((x - mu) / b);
    } else {
      return 1 - 0.5 * Math.exp(- (x - mu) / b);
    }
  },

  mean: function(mu, b) {
    return mu;
  },

  median: function(mu, b) {
    return mu;
  },

  mode: function(mu, b) {
    return mu;
  },

  variance: function(mu, b) {
    return 2 * b * b;
  },

  sample: function sample(mu, b) {
    var u = Math.random() - 0.5;

    return mu - (b * laplaceSign(u) * Math.log(1 - (2 * Math.abs(u))));
  }
});

}(this.jStat, Math));
/* Provides functions for the solution of linear system of equations, integration, extrapolation,
 * interpolation, eigenvalue problems, differential equations and PCA analysis. */

(function(jStat, Math) {

var push = Array.prototype.push;
var isArray = jStat.utils.isArray;

function isUsable(arg) {
  return isArray(arg) || arg instanceof jStat;
}

jStat.extend({

  // add a vector/matrix to a vector/matrix or scalar
  add: function add(arr, arg) {
    // check if arg is a vector or scalar
    if (isUsable(arg)) {
      if (!isUsable(arg[0])) arg = [ arg ];
      return jStat.map(arr, function(value, row, col) {
        return value + arg[row][col];
      });
    }
    return jStat.map(arr, function(value) { return value + arg; });
  },

  // subtract a vector or scalar from the vector
  subtract: function subtract(arr, arg) {
    // check if arg is a vector or scalar
    if (isUsable(arg)) {
      if (!isUsable(arg[0])) arg = [ arg ];
      return jStat.map(arr, function(value, row, col) {
        return value - arg[row][col] || 0;
      });
    }
    return jStat.map(arr, function(value) { return value - arg; });
  },

  // matrix division
  divide: function divide(arr, arg) {
    if (isUsable(arg)) {
      if (!isUsable(arg[0])) arg = [ arg ];
      return jStat.multiply(arr, jStat.inv(arg));
    }
    return jStat.map(arr, function(value) { return value / arg; });
  },

  // matrix multiplication
  multiply: function multiply(arr, arg) {
    var row, col, nrescols, sum, nrow, ncol, res, rescols;
    // eg: arr = 2 arg = 3 -> 6 for res[0][0] statement closure
    if (arr.length === undefined && arg.length === undefined) {
      return arr * arg;
    }
    nrow = arr.length,
    ncol = arr[0].length,
    res = jStat.zeros(nrow, nrescols = (isUsable(arg)) ? arg[0].length : ncol),
    rescols = 0;
    if (isUsable(arg)) {
      for (; rescols < nrescols; rescols++) {
        for (row = 0; row < nrow; row++) {
          sum = 0;
          for (col = 0; col < ncol; col++)
          sum += arr[row][col] * arg[col][rescols];
          res[row][rescols] = sum;
        }
      }
      return (nrow === 1 && rescols === 1) ? res[0][0] : res;
    }
    return jStat.map(arr, function(value) { return value * arg; });
  },

  // outer([1,2,3],[4,5,6])
  // ===
  // [[1],[2],[3]] times [[4,5,6]]
  // ->
  // [[4,5,6],[8,10,12],[12,15,18]]
  outer:function outer(A, B) {
    return jStat.multiply(A.map(function(t){ return [t] }), [B]);
  },


  // Returns the dot product of two matricies
  dot: function dot(arr, arg) {
    if (!isUsable(arr[0])) arr = [ arr ];
    if (!isUsable(arg[0])) arg = [ arg ];
    // convert column to row vector
    var left = (arr[0].length === 1 && arr.length !== 1) ? jStat.transpose(arr) : arr,
    right = (arg[0].length === 1 && arg.length !== 1) ? jStat.transpose(arg) : arg,
    res = [],
    row = 0,
    nrow = left.length,
    ncol = left[0].length,
    sum, col;
    for (; row < nrow; row++) {
      res[row] = [];
      sum = 0;
      for (col = 0; col < ncol; col++)
      sum += left[row][col] * right[row][col];
      res[row] = sum;
    }
    return (res.length === 1) ? res[0] : res;
  },

  // raise every element by a scalar
  pow: function pow(arr, arg) {
    return jStat.map(arr, function(value) { return Math.pow(value, arg); });
  },

  // exponentiate every element
  exp: function exp(arr) {
    return jStat.map(arr, function(value) { return Math.exp(value); });
  },

  // generate the natural log of every element
  log: function exp(arr) {
    return jStat.map(arr, function(value) { return Math.log(value); });
  },

  // generate the absolute values of the vector
  abs: function abs(arr) {
    return jStat.map(arr, function(value) { return Math.abs(value); });
  },

  // computes the p-norm of the vector
  // In the case that a matrix is passed, uses the first row as the vector
  norm: function norm(arr, p) {
    var nnorm = 0,
    i = 0;
    // check the p-value of the norm, and set for most common case
    if (isNaN(p)) p = 2;
    // check if multi-dimensional array, and make vector correction
    if (isUsable(arr[0])) arr = arr[0];
    // vector norm
    for (; i < arr.length; i++) {
      nnorm += Math.pow(Math.abs(arr[i]), p);
    }
    return Math.pow(nnorm, 1 / p);
  },

  // computes the angle between two vectors in rads
  // In case a matrix is passed, this uses the first row as the vector
  angle: function angle(arr, arg) {
    return Math.acos(jStat.dot(arr, arg) / (jStat.norm(arr) * jStat.norm(arg)));
  },

  // augment one matrix by another
  // Note: this function returns a matrix, not a jStat object
  aug: function aug(a, b) {
    var newarr = [];
    for (var i = 0; i < a.length; i++) {
      newarr.push(a[i].slice());
    }
    for (var i = 0; i < newarr.length; i++) {
      push.apply(newarr[i], b[i]);
    }
    return newarr;
  },

  // The inv() function calculates the inverse of a matrix
  // Create the inverse by augmenting the matrix by the identity matrix of the
  // appropriate size, and then use G-J elimination on the augmented matrix.
  inv: function inv(a) {
    var rows = a.length;
    var cols = a[0].length;
    var b = jStat.identity(rows, cols);
    var c = jStat.gauss_jordan(a, b);
    var result = [];
    var i = 0;
    var j;

    //We need to copy the inverse portion to a new matrix to rid G-J artifacts
    for (; i < rows; i++) {
      result[i] = [];
      for (j = cols; j < c[0].length; j++)
        result[i][j - cols] = c[i][j];
    }
    return result;
  },

  // calculate the determinant of a matrix
  det: function det(a) {
    var alen = a.length,
    alend = alen * 2,
    vals = new Array(alend),
    rowshift = alen - 1,
    colshift = alend - 1,
    mrow = rowshift - alen + 1,
    mcol = colshift,
    i = 0,
    result = 0,
    j;
    // check for special 2x2 case
    if (alen === 2) {
      return a[0][0] * a[1][1] - a[0][1] * a[1][0];
    }
    for (; i < alend; i++) {
      vals[i] = 1;
    }
    for (var i = 0; i < alen; i++) {
      for (j = 0; j < alen; j++) {
        vals[(mrow < 0) ? mrow + alen : mrow ] *= a[i][j];
        vals[(mcol < alen) ? mcol + alen : mcol ] *= a[i][j];
        mrow++;
        mcol--;
      }
      mrow = --rowshift - alen + 1;
      mcol = --colshift;
    }
    for (var i = 0; i < alen; i++) {
      result += vals[i];
    }
    for (; i < alend; i++) {
      result -= vals[i];
    }
    return result;
  },

  gauss_elimination: function gauss_elimination(a, b) {
    var i = 0,
    j = 0,
    n = a.length,
    m = a[0].length,
    factor = 1,
    sum = 0,
    x = [],
    maug, pivot, temp, k;
    a = jStat.aug(a, b);
    maug = a[0].length;
    for(var i = 0; i < n; i++) {
      pivot = a[i][i];
      j = i;
      for (k = i + 1; k < m; k++) {
        if (pivot < Math.abs(a[k][i])) {
          pivot = a[k][i];
          j = k;
        }
      }
      if (j != i) {
        for(k = 0; k < maug; k++) {
          temp = a[i][k];
          a[i][k] = a[j][k];
          a[j][k] = temp;
        }
      }
      for (j = i + 1; j < n; j++) {
        factor = a[j][i] / a[i][i];
        for(k = i; k < maug; k++) {
          a[j][k] = a[j][k] - factor * a[i][k];
        }
      }
    }
    for (var i = n - 1; i >= 0; i--) {
      sum = 0;
      for (j = i + 1; j<= n - 1; j++) {
        sum = sum + x[j] * a[i][j];
      }
      x[i] =(a[i][maug - 1] - sum) / a[i][i];
    }
    return x;
  },

  gauss_jordan: function gauss_jordan(a, b) {
    var m = jStat.aug(a, b),
    h = m.length,
    w = m[0].length;
    // find max pivot
    for (var y = 0; y < h; y++) {
      var maxrow = y;
      for (var y2 = y+1; y2 < h; y2++) {
        if (Math.abs(m[y2][y]) > Math.abs(m[maxrow][y]))
          maxrow = y2;
      }
      var tmp = m[y];
      m[y] = m[maxrow];
      m[maxrow] = tmp
      for (var y2 = y+1; y2 < h; y2++) {
        c = m[y2][y] / m[y][y];
        for (var x = y; x < w; x++) {
          m[y2][x] -= m[y][x] * c;
        }
      }
    }
    // backsubstitute
    for (var y = h-1; y >= 0; y--) {
      c = m[y][y];
      for (var y2 = 0; y2 < y; y2++) {
        for (var x = w-1; x > y-1; x--) {
          m[y2][x] -= m[y][x] * m[y2][y] / c;
        }
      }
      m[y][y] /= c;
      for (var x = h; x < w; x++) {
        m[y][x] /= c;
      }
    }
    return m;
  },

  // solve equation
  // Ax=b
  // A is upper triangular matrix
  // A=[[1,2,3],[0,4,5],[0,6,7]]
  // b=[1,2,3]
  // triaUpSolve(A,b) // -> [2.666,0.1666,1.666]
  // if you use matrix style
  // A=[[1,2,3],[0,4,5],[0,6,7]]
  // b=[[1],[2],[3]]
  // will return [[2.666],[0.1666],[1.666]]
  triaUpSolve: function triaUpSolve(A, b) {
    var size = A[0].length;
    var x = jStat.zeros(1, size)[0];
    var parts;
    var matrix_mode = false;

    if (b[0].length != undefined) {
      b = b.map(function(i){ return i[0] });
      matrix_mode = true;
    }

    jStat.arange(size - 1, -1, -1).forEach(function(i) {
      parts = jStat.arange(i + 1,size).map(function(j) {
        return x[j] * A[i][j];
      });
      x[i] = (b[i] - jStat.sum(parts)) / A[i][i];
    });

    if (matrix_mode)
      return x.map(function(i){ return [i] });
    return x;
  },

  triaLowSolve: function triaLowSolve(A, b) {
    // like to triaUpSolve but A is lower triangular matrix
    var size = A[0].length;
    var x = jStat.zeros(1, size)[0];
    var parts;

    var matrix_mode=false;
    if (b[0].length != undefined) {
      b = b.map(function(i){ return i[0] });
      matrix_mode = true;
    }

    jStat.arange(size).forEach(function(i) {
      parts = jStat.arange(i).map(function(j) {
        return A[i][j] * x[j];
      });
      x[i] = (b[i] - jStat.sum(parts)) / A[i][i];
    })

    if (matrix_mode)
      return x.map(function(i){ return [i] });
    return x;
  },

  // A -> [L,U]
  // A=LU
  // L is lower triangular matrix
  // U is upper triangular matrix
  lu: function lu(A) {
    var size = A.length;
    //var L=jStat.diagonal(jStat.ones(1,size)[0]);
    var L = jStat.identity(size);
    var R = jStat.zeros(A.length, A[0].length);
    var parts;
    jStat.arange(size).forEach(function(t) {
      R[0][t] = A[0][t];
    });
    jStat.arange(1, size).forEach(function(l) {
      jStat.arange(l).forEach(function(i) {
        parts = jStat.arange(i).map(function(jj) {
          return L[l][jj] * R[jj][i];
        });
        L[l][i] = (A[l][i] - jStat.sum(parts)) / R[i][i];
      });
      jStat.arange(l, size).forEach(function(j) {
        parts = jStat.arange(l).map(function(jj) {
          return L[l][jj] * R[jj][j];
        });
        R[l][j] = A[i][j] - jStat.sum(parts);
      });
    });
    return [L, R];
  },

  // A -> T
  // A=TT'
  // T is lower triangular matrix
  cholesky: function cholesky(A) {
    var size = A.length;
    var T = jStat.zeros(A.length, A[0].length);
    var parts;
    jStat.arange(size).forEach(function(i) {
      parts = jStat.arange(i).map(function(t) {
        return Math.pow(T[i][t],2);
      });
      T[i][i] = Math.sqrt(A[i][i] - jStat.sum(parts));
      jStat.arange(i + 1, size).forEach(function(j) {
        parts = jStat.arange(i).map(function(t) {
          return T[i][t] * T[j][t];
        });
        T[j][i] = (A[i][j] - jStat.sum(parts)) / T[i][i];
      });
    });
    return T;
  },

  gauss_jacobi: function gauss_jacobi(a, b, x, r) {
    var i = 0;
    var j = 0;
    var n = a.length;
    var l = [];
    var u = [];
    var d = [];
    var xv, c, h, xk;
    for (; i < n; i++) {
      l[i] = [];
      u[i] = [];
      d[i] = [];
      for (j = 0; j < n; j++) {
        if (i > j) {
          l[i][j] = a[i][j];
          u[i][j] = d[i][j] = 0;
        } else if (i < j) {
          u[i][j] = a[i][j];
          l[i][j] = d[i][j] = 0;
        } else {
          d[i][j] = a[i][j];
          l[i][j] = u[i][j] = 0;
        }
      }
    }
    h = jStat.multiply(jStat.multiply(jStat.inv(d), jStat.add(l, u)), -1);
    c = jStat.multiply(jStat.inv(d), b);
    xv = x;
    xk = jStat.add(jStat.multiply(h, x), c);
    i = 2;
    while (Math.abs(jStat.norm(jStat.subtract(xk,xv))) > r) {
      xv = xk;
      xk = jStat.add(jStat.multiply(h, xv), c);
      i++;
    }
    return xk;
  },

  gauss_seidel: function gauss_seidel(a, b, x, r) {
    var i = 0;
    var n = a.length;
    var l = [];
    var u = [];
    var d = [];
    var j, xv, c, h, xk;
    for (; i < n; i++) {
      l[i] = [];
      u[i] = [];
      d[i] = [];
      for (j = 0; j < n; j++) {
        if (i > j) {
          l[i][j] = a[i][j];
          u[i][j] = d[i][j] = 0;
        } else if (i < j) {
          u[i][j] = a[i][j];
          l[i][j] = d[i][j] = 0;
        } else {
          d[i][j] = a[i][j];
          l[i][j] = u[i][j] = 0;
        }
      }
    }
    h = jStat.multiply(jStat.multiply(jStat.inv(jStat.add(d, l)), u), -1);
    c = jStat.multiply(jStat.inv(jStat.add(d, l)), b);
    xv = x;
    xk = jStat.add(jStat.multiply(h, x), c);
    i = 2;
    while (Math.abs(jStat.norm(jStat.subtract(xk, xv))) > r) {
      xv = xk;
      xk = jStat.add(jStat.multiply(h, xv), c);
      i = i + 1;
    }
    return xk;
  },

  SOR: function SOR(a, b, x, r, w) {
    var i = 0;
    var n = a.length;
    var l = [];
    var u = [];
    var d = [];
    var j, xv, c, h, xk;
    for (; i < n; i++) {
      l[i] = [];
      u[i] = [];
      d[i] = [];
      for (j = 0; j < n; j++) {
        if (i > j) {
          l[i][j] = a[i][j];
          u[i][j] = d[i][j] = 0;
        } else if (i < j) {
          u[i][j] = a[i][j];
          l[i][j] = d[i][j] = 0;
        } else {
          d[i][j] = a[i][j];
          l[i][j] = u[i][j] = 0;
        }
      }
    }
    h = jStat.multiply(jStat.inv(jStat.add(d, jStat.multiply(l, w))),
                       jStat.subtract(jStat.multiply(d, 1 - w),
                                      jStat.multiply(u, w)));
    c = jStat.multiply(jStat.multiply(jStat.inv(jStat.add(d,
        jStat.multiply(l, w))), b), w);
    xv = x;
    xk = jStat.add(jStat.multiply(h, x), c);
    i = 2;
    while (Math.abs(jStat.norm(jStat.subtract(xk, xv))) > r) {
      xv = xk;
      xk = jStat.add(jStat.multiply(h, xv), c);
      i++;
    }
    return xk;
  },

  householder: function householder(a) {
    var m = a.length;
    var n = a[0].length;
    var i = 0;
    var w = [];
    var p = [];
    var alpha, r, k, j, factor;
    for (; i < m - 1; i++) {
      alpha = 0;
      for (j = i + 1; j < n; j++)
      alpha += (a[j][i] * a[j][i]);
      factor = (a[i + 1][i] > 0) ? -1 : 1;
      alpha = factor * Math.sqrt(alpha);
      r = Math.sqrt((((alpha * alpha) - a[i + 1][i] * alpha) / 2));
      w = jStat.zeros(m, 1);
      w[i + 1][0] = (a[i + 1][i] - alpha) / (2 * r);
      for (k = i + 2; k < m; k++) w[k][0] = a[k][i] / (2 * r);
      p = jStat.subtract(jStat.identity(m, n),
          jStat.multiply(jStat.multiply(w, jStat.transpose(w)), 2));
      a = jStat.multiply(p, jStat.multiply(a, p));
    }
    return a;
  },

  // A -> [Q,R]
  // Q is orthogonal matrix
  // R is upper triangular
  QR: (function() {
    // x -> Q
    // find a orthogonal matrix Q st.
    // Qx=y
    // y is [||x||,0,0,...]
    function get_Q1(x) {
      var size = x.length;
      var norm_x = jStat.norm(x,2);
      var e1 = jStat.zeros(1, size)[0];
      e1[0] = 1;
      var u = jStat.add(jStat.multiply(jStat.multiply(e1, norm_x), -1), x);
      var norm_u = jStat.norm(u, 2);
      var v = jStat.divide(u, norm_u);
      var Q = jStat.subtract(jStat.identity(size),
                             jStat.multiply(jStat.outer(v, v), 2));
      return Q;
    }

    function qr(A) {
      var size = A[0].length;
      var QList = [];
      jStat.arange(size).forEach(function(i) {
        var x = jStat.slice(A, { row: { start: i }, col: i });
        var Q = get_Q1(x);
        var Qn = jStat.identity(A.length);
        Qn = jStat.sliceAssign(Qn, { row: { start: i }, col: { start: i }}, Q);
        A = jStat.multiply(Qn, A);
        QList.push(Qn);
      });
      var Q = QList.reduce(function(x, y){ return jStat.multiply(x,y) });
      var R = A;
      return [Q, R];
    }

    return qr;
  })(),

  lstsq: (function(A, b) {
    // solve least squard problem for Ax=b as QR decomposition way if b is
    // [[b1],[b2],[b3]] form will return [[x1],[x2],[x3]] array form solution
    // else b is [b1,b2,b3] form will return [x1,x2,x3] array form solution
    function R_I(A) {
      A = jStat.copy(A);
      var size = A.length;
      var I = jStat.identity(size);
      jStat.arange(size - 1, -1, -1).forEach(function(i) {
        jStat.sliceAssign(
            I, { row: i }, jStat.divide(jStat.slice(I, { row: i }), A[i][i]));
        jStat.sliceAssign(
            A, { row: i }, jStat.divide(jStat.slice(A, { row: i }), A[i][i]));
        jStat.arange(i).forEach(function(j) {
          var c = jStat.multiply(A[j][i], -1);
          var Aj = jStat.slice(A, { row: j });
          var cAi = jStat.multiply(jStat.slice(A, { row: i }), c);
          jStat.sliceAssign(A, { row: j }, jStat.add(Aj, cAi));
          var Ij = jStat.slice(I, { row: j });
          var cIi = jStat.multiply(jStat.slice(I, { row: i }), c);
          jStat.sliceAssign(I, { row: j }, jStat.add(Ij, cIi));
        })
      });
      return I;
    }

    function qr_solve(A, b){
      var array_mode = false;
      if (b[0].length === undefined) {
        // [c1,c2,c3] mode
        b = b.map(function(x){ return [x] });
        array_mode = true;
      }
      var QR = jStat.QR(A);
      var Q = QR[0];
      var R = QR[1];
      var attrs = A[0].length;
      var Q1 = jStat.slice(Q,{col:{end:attrs}});
      var R1 = jStat.slice(R,{row:{end:attrs}});
      var RI = R_I(R1);
      var x = jStat.multiply(jStat.multiply(RI, jStat.transpose(Q1)), b);
      if (array_mode)
        return x.map(function(i){ return i[0] });
      return x;
    }

    return qr_solve;
  })(),

  jacobi: function jacobi(a) {
    var condition = 1;
    var count = 0;
    var n = a.length;
    var e = jStat.identity(n, n);
    var ev = [];
    var b, i, j, p, q, maxim, theta, s;
    // condition === 1 only if tolerance is not reached
    while (condition === 1) {
      count++;
      maxim = a[0][1];
      p = 0;
      q = 1;
      for (var i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          if (i != j) {
            if (maxim < Math.abs(a[i][j])) {
              maxim = Math.abs(a[i][j]);
              p = i;
              q = j;
            }
          }
        }
      }
      if (a[p][p] === a[q][q])
        theta = (a[p][q] > 0) ? Math.PI / 4 : -Math.PI / 4;
      else
        theta = Math.atan(2 * a[p][q] / (a[p][p] - a[q][q])) / 2;
      s = jStat.identity(n, n);
      s[p][p] = Math.cos(theta);
      s[p][q] = -Math.sin(theta);
      s[q][p] = Math.sin(theta);
      s[q][q] = Math.cos(theta);
      // eigen vector matrix
      e = jStat.multiply(e, s);
      b = jStat.multiply(jStat.multiply(jStat.inv(s), a), s);
      a = b;
      condition = 0;
      for (var i = 1; i < n; i++) {
        for (j = 1; j < n; j++) {
          if (i != j && Math.abs(a[i][j]) > 0.001) {
            condition = 1;
          }
        }
      }
    }
    for (var i = 0; i < n; i++) ev.push(a[i][i]);
    //returns both the eigenvalue and eigenmatrix
    return [e, ev];
  },

  rungekutta: function rungekutta(f, h, p, t_j, u_j, order) {
    var k1, k2, u_j1, k3, k4;
    if (order === 2) {
      while (t_j <= p) {
        k1 = h * f(t_j, u_j);
        k2 = h * f(t_j + h, u_j + k1);
        u_j1 = u_j + (k1 + k2) / 2;
        u_j = u_j1;
        t_j = t_j + h;
      }
    }
    if (order === 4) {
      while (t_j <= p) {
        k1 = h * f(t_j, u_j);
        k2 = h * f(t_j + h / 2, u_j + k1 / 2);
        k3 = h * f(t_j + h / 2, u_j + k2 / 2);
        k4 = h * f(t_j +h, u_j + k3);
        u_j1 = u_j + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
        u_j = u_j1;
        t_j = t_j + h;
      }
    }
    return u_j;
  },

  romberg: function romberg(f, a, b, order) {
    var i = 0;
    var h = (b - a) / 2;
    var x = [];
    var h1 = [];
    var g = [];
    var m, a1, j, k, I, d;
    while (i < order / 2) {
      I = f(a);
      for (j = a, k = 0; j <= b; j = j + h, k++) x[k] = j;
      m = x.length;
      for (j = 1; j < m - 1; j++) {
        I += (((j % 2) !== 0) ? 4 : 2) * f(x[j]);
      }
      I = (h / 3) * (I + f(b));
      g[i] = I;
      h /= 2;
      i++;
    }
    a1 = g.length;
    m = 1;
    while (a1 !== 1) {
      for (j = 0; j < a1 - 1; j++)
      h1[j] = ((Math.pow(4, m)) * g[j + 1] - g[j]) / (Math.pow(4, m) - 1);
      a1 = h1.length;
      g = h1;
      h1 = [];
      m++;
    }
    return g;
  },

  richardson: function richardson(X, f, x, h) {
    function pos(X, x) {
      var i = 0;
      var n = X.length;
      var p;
      for (; i < n; i++)
        if (X[i] === x) p = i;
      return p;
    }
    var n = X.length,
    h_min = Math.abs(x - X[pos(X, x) + 1]),
    i = 0,
    g = [],
    h1 = [],
    y1, y2, m, a, j;
    while (h >= h_min) {
      y1 = pos(X, x + h);
      y2 = pos(X, x);
      g[i] = (f[y1] - 2 * f[y2] + f[2 * y2 - y1]) / (h * h);
      h /= 2;
      i++;
    }
    a = g.length;
    m = 1;
    while (a != 1) {
      for (j = 0; j < a - 1; j++)
      h1[j] = ((Math.pow(4, m)) * g[j + 1] - g[j]) / (Math.pow(4, m) - 1);
      a = h1.length;
      g = h1;
      h1 = [];
      m++;
    }
    return g;
  },

  simpson: function simpson(f, a, b, n) {
    var h = (b - a) / n;
    var I = f(a);
    var x = [];
    var j = a;
    var k = 0;
    var i = 1;
    var m;
    for (; j <= b; j = j + h, k++)
      x[k] = j;
    m = x.length;
    for (; i < m - 1; i++) {
      I += ((i % 2 !== 0) ? 4 : 2) * f(x[i]);
    }
    return (h / 3) * (I + f(b));
  },

  hermite: function hermite(X, F, dF, value) {
    var n = X.length;
    var p = 0;
    var i = 0;
    var l = [];
    var dl = [];
    var A = [];
    var B = [];
    var j;
    for (; i < n; i++) {
      l[i] = 1;
      for (j = 0; j < n; j++) {
        if (i != j) l[i] *= (value - X[j]) / (X[i] - X[j]);
      }
      dl[i] = 0;
      for (j = 0; j < n; j++) {
        if (i != j) dl[i] += 1 / (X [i] - X[j]);
      }
      A[i] = (1 - 2 * (value - X[i]) * dl[i]) * (l[i] * l[i]);
      B[i] = (value - X[i]) * (l[i] * l[i]);
      p += (A[i] * F[i] + B[i] * dF[i]);
    }
    return p;
  },

  lagrange: function lagrange(X, F, value) {
    var p = 0;
    var i = 0;
    var j, l;
    var n = X.length;
    for (; i < n; i++) {
      l = F[i];
      for (j = 0; j < n; j++) {
        // calculating the lagrange polynomial L_i
        if (i != j) l *= (value - X[j]) / (X[i] - X[j]);
      }
      // adding the lagrange polynomials found above
      p += l;
    }
    return p;
  },

  cubic_spline: function cubic_spline(X, F, value) {
    var n = X.length;
    var i = 0, j;
    var A = [];
    var B = [];
    var alpha = [];
    var c = [];
    var h = [];
    var b = [];
    var d = [];
    for (; i < n - 1; i++)
      h[i] = X[i + 1] - X[i];
    alpha[0] = 0;
    for (var i = 1; i < n - 1; i++) {
      alpha[i] = (3 / h[i]) * (F[i + 1] - F[i]) -
          (3 / h[i-1]) * (F[i] - F[i-1]);
    }
    for (var i = 1; i < n - 1; i++) {
      A[i] = [];
      B[i] = [];
      A[i][i-1] = h[i-1];
      A[i][i] = 2 * (h[i - 1] + h[i]);
      A[i][i+1] = h[i];
      B[i][0] = alpha[i];
    }
    c = jStat.multiply(jStat.inv(A), B);
    for (j = 0; j < n - 1; j++) {
      b[j] = (F[j + 1] - F[j]) / h[j] - h[j] * (c[j + 1][0] + 2 * c[j][0]) / 3;
      d[j] = (c[j + 1][0] - c[j][0]) / (3 * h[j]);
    }
    for (j = 0; j < n; j++) {
      if (X[j] > value) break;
    }
    j -= 1;
    return F[j] + (value - X[j]) * b[j] + jStat.sq(value-X[j]) *
        c[j] + (value - X[j]) * jStat.sq(value - X[j]) * d[j];
  },

  gauss_quadrature: function gauss_quadrature() {
    throw new Error('gauss_quadrature not yet implemented');
  },

  PCA: function PCA(X) {
    var m = X.length;
    var n = X[0].length;
    var flag = false;
    var i = 0;
    var j, temp1;
    var u = [];
    var D = [];
    var result = [];
    var temp2 = [];
    var Y = [];
    var Bt = [];
    var B = [];
    var C = [];
    var V = [];
    var Vt = [];
    for (var i = 0; i < m; i++) {
      u[i] = jStat.sum(X[i]) / n;
    }
    for (var i = 0; i < n; i++) {
      B[i] = [];
      for(j = 0; j < m; j++) {
        B[i][j] = X[j][i] - u[j];
      }
    }
    B = jStat.transpose(B);
    for (var i = 0; i < m; i++) {
      C[i] = [];
      for (j = 0; j < m; j++) {
        C[i][j] = (jStat.dot([B[i]], [B[j]])) / (n - 1);
      }
    }
    result = jStat.jacobi(C);
    V = result[0];
    D = result[1];
    Vt = jStat.transpose(V);
    for (var i = 0; i < D.length; i++) {
      for (j = i; j < D.length; j++) {
        if(D[i] < D[j])  {
          temp1 = D[i];
          D[i] = D[j];
          D[j] = temp1;
          temp2 = Vt[i];
          Vt[i] = Vt[j];
          Vt[j] = temp2;
        }
      }
    }
    Bt = jStat.transpose(B);
    for (var i = 0; i < m; i++) {
      Y[i] = [];
      for (j = 0; j < Bt.length; j++) {
        Y[i][j] = jStat.dot([Vt[i]], [Bt[j]]);
      }
    }
    return [X, D, Vt, Y];
  }
});

// extend jStat.fn with methods that require one argument
(function(funcs) {
  for (var i = 0; i < funcs.length; i++) (function(passfunc) {
    jStat.fn[passfunc] = function(arg, func) {
      var tmpthis = this;
      // check for callback
      if (func) {
        setTimeout(function() {
          func.call(tmpthis, jStat.fn[passfunc].call(tmpthis, arg));
        }, 15);
        return this;
      }
      if (typeof jStat[passfunc](this, arg) === 'number')
        return jStat[passfunc](this, arg);
      else
        return jStat(jStat[passfunc](this, arg));
    };
  }(funcs[i]));
}('add divide multiply subtract dot pow exp log abs norm angle'.split(' ')));

}(this.jStat, Math));
(function(jStat, Math) {

var slice = [].slice;
var isNumber = jStat.utils.isNumber;
var isArray = jStat.utils.isArray;

// flag==true denotes use of sample standard deviation
// Z Statistics
jStat.extend({
  // 2 different parameter lists:
  // (value, mean, sd)
  // (value, array, flag)
  zscore: function zscore() {
    var args = slice.call(arguments);
    if (isNumber(args[1])) {
      return (args[0] - args[1]) / args[2];
    }
    return (args[0] - jStat.mean(args[1])) / jStat.stdev(args[1], args[2]);
  },

  // 3 different paramter lists:
  // (value, mean, sd, sides)
  // (zscore, sides)
  // (value, array, sides, flag)
  ztest: function ztest() {
    var args = slice.call(arguments);
    var z;
    if (isArray(args[1])) {
      // (value, array, sides, flag)
      z = jStat.zscore(args[0],args[1],args[3]);
      return (args[2] === 1) ?
        (jStat.normal.cdf(-Math.abs(z), 0, 1)) :
        (jStat.normal.cdf(-Math.abs(z), 0, 1)*2);
    } else {
      if (args.length > 2) {
        // (value, mean, sd, sides)
        z = jStat.zscore(args[0],args[1],args[2]);
        return (args[3] === 1) ?
          (jStat.normal.cdf(-Math.abs(z),0,1)) :
          (jStat.normal.cdf(-Math.abs(z),0,1)* 2);
      } else {
        // (zscore, sides)
        z = args[0];
        return (args[1] === 1) ?
          (jStat.normal.cdf(-Math.abs(z),0,1)) :
          (jStat.normal.cdf(-Math.abs(z),0,1)*2);
      }
    }
  }
});

jStat.extend(jStat.fn, {
  zscore: function zscore(value, flag) {
    return (value - this.mean()) / this.stdev(flag);
  },

  ztest: function ztest(value, sides, flag) {
    var zscore = Math.abs(this.zscore(value, flag));
    return (sides === 1) ?
      (jStat.normal.cdf(-zscore, 0, 1)) :
      (jStat.normal.cdf(-zscore, 0, 1) * 2);
  }
});

// T Statistics
jStat.extend({
  // 2 parameter lists
  // (value, mean, sd, n)
  // (value, array)
  tscore: function tscore() {
    var args = slice.call(arguments);
    return (args.length === 4) ?
      ((args[0] - args[1]) / (args[2] / Math.sqrt(args[3]))) :
      ((args[0] - jStat.mean(args[1])) /
       (jStat.stdev(args[1], true) / Math.sqrt(args[1].length)));
  },

  // 3 different paramter lists:
  // (value, mean, sd, n, sides)
  // (tscore, n, sides)
  // (value, array, sides)
  ttest: function ttest() {
    var args = slice.call(arguments);
    var tscore;
    if (args.length === 5) {
      tscore = Math.abs(jStat.tscore(args[0], args[1], args[2], args[3]));
      return (args[4] === 1) ?
        (jStat.studentt.cdf(-tscore, args[3]-1)) :
        (jStat.studentt.cdf(-tscore, args[3]-1)*2);
    }
    if (isNumber(args[1])) {
      tscore = Math.abs(args[0])
      return (args[2] == 1) ?
        (jStat.studentt.cdf(-tscore, args[1]-1)) :
        (jStat.studentt.cdf(-tscore, args[1]-1) * 2);
    }
    tscore = Math.abs(jStat.tscore(args[0], args[1]))
    return (args[2] == 1) ?
      (jStat.studentt.cdf(-tscore, args[1].length-1)) :
      (jStat.studentt.cdf(-tscore, args[1].length-1) * 2);
  }
});

jStat.extend(jStat.fn, {
  tscore: function tscore(value) {
    return (value - this.mean()) / (this.stdev(true) / Math.sqrt(this.cols()));
  },

  ttest: function ttest(value, sides) {
    return (sides === 1) ?
      (1 - jStat.studentt.cdf(Math.abs(this.tscore(value)), this.cols()-1)) :
      (jStat.studentt.cdf(-Math.abs(this.tscore(value)), this.cols()-1)*2);
  }
});

// F Statistics
jStat.extend({
  // Paramter list is as follows:
  // (array1, array2, array3, ...)
  // or it is an array of arrays
  // array of arrays conversion
  anovafscore: function anovafscore() {
    var args = slice.call(arguments),
    expVar, sample, sampMean, sampSampMean, tmpargs, unexpVar, i, j;
    if (args.length === 1) {
      tmpargs = new Array(args[0].length);
      for (var i = 0; i < args[0].length; i++) {
        tmpargs[i] = args[0][i];
      }
      args = tmpargs;
    }
    // 2 sample case
    if (args.length === 2) {
      return jStat.variance(args[0]) / jStat.variance(args[1]);
    }
    // Builds sample array
    sample = new Array();
    for (var i = 0; i < args.length; i++) {
      sample = sample.concat(args[i]);
    }
    sampMean = jStat.mean(sample);
    // Computes the explained variance
    expVar = 0;
    for (var i = 0; i < args.length; i++) {
      expVar = expVar + args[i].length * Math.pow(jStat.mean(args[i]) - sampMean, 2);
    }
    expVar /= (args.length - 1);
    // Computes unexplained variance
    unexpVar = 0;
    for (var i = 0; i < args.length; i++) {
      sampSampMean = jStat.mean(args[i]);
      for (j = 0; j < args[i].length; j++) {
        unexpVar += Math.pow(args[i][j] - sampSampMean, 2);
      }
    }
    unexpVar /= (sample.length - args.length);
    return expVar / unexpVar;
  },

  // 2 different paramter setups
  // (array1, array2, array3, ...)
  // (anovafscore, df1, df2)
  anovaftest: function anovaftest() {
    var args = slice.call(arguments),
    df1, df2, n, i;
    if (isNumber(args[0])) {
      return 1 - jStat.centralF.cdf(args[0], args[1], args[2]);
    }
    anovafscore = jStat.anovafscore(args);
    df1 = args.length - 1;
    n = 0;
    for (var i = 0; i < args.length; i++) {
      n = n + args[i].length;
    }
    df2 = n - df1 - 1;
    return 1 - jStat.centralF.cdf(anovafscore, df1, df2);
  },

  ftest: function ftest(fscore, df1, df2) {
    return 1 - jStat.centralF.cdf(fscore, df1, df2);
  }
});

jStat.extend(jStat.fn, {
  anovafscore: function anovafscore() {
    return jStat.anovafscore(this.toArray());
  },

  anovaftes: function anovaftes() {
    var n = 0;
    var i;
    for (var i = 0; i < this.length; i++) {
      n = n + this[i].length;
    }
    return jStat.ftest(this.anovafscore(), this.length - 1, n - this.length);
  }
});

// Error Bounds
jStat.extend({
  // 2 different parameter setups
  // (value, alpha, sd, n)
  // (value, alpha, array)
  normalci: function normalci() {
    var args = slice.call(arguments),
    ans = new Array(2),
    change;
    if (args.length === 4) {
      change = Math.abs(jStat.normal.inv(args[1] / 2, 0, 1) *
                        args[2] / Math.sqrt(args[3]));
    } else {
      change = Math.abs(jStat.normal.inv(args[1] / 2, 0, 1) *
                        jStat.stdev(args[2]) / Math.sqrt(args[2].length));
    }
    ans[0] = args[0] - change;
    ans[1] = args[0] + change;
    return ans;
  },

  // 2 different parameter setups
  // (value, alpha, sd, n)
  // (value, alpha, array)
  tci: function tci() {
    var args = slice.call(arguments),
    ans = new Array(2),
    change;
    if (args.length === 4) {
      change = Math.abs(jStat.studentt.inv(args[1] / 2, args[3] - 1) *
                        args[2] / Math.sqrt(args[3]));
    } else {
      change = Math.abs(jStat.studentt.inv(args[1] / 2, args[2].length - 1) *
                        jStat.stdev(args[2], true) / Math.sqrt(args[2].length));
    }
    ans[0] = args[0] - change;
    ans[1] = args[0] + change;
    return ans;
  },

  significant: function significant(pvalue, alpha) {
    return pvalue < alpha;
  }
});

jStat.extend(jStat.fn, {
  normalci: function normalci(value, alpha) {
    return jStat.normalci(value, alpha, this.toArray());
  },

  tci: function tci(value, alpha) {
    return jStat.tci(value, alpha, this.toArray());
  }
});

// internal method for calculating the z-score for a difference of proportions test
function differenceOfProportions(p1, n1, p2, n2) {
  if (p1 > 1 || p2 > 1 || p1 <= 0 || p2 <= 0) {
    throw new Error("Proportions should be greater than 0 and less than 1")
  }
  var pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  var se = Math.sqrt(pooled * (1 - pooled) * ((1/n1) + (1/n2)));
  return (p1 - p2) / se;
}

// Difference of Proportions
jStat.extend(jStat.fn, {
  oneSidedDifferenceOfProportions: function oneSidedDifferenceOfProportions(p1, n1, p2, n2) {
    var z = differenceOfProportions(p1, n1, p2, n2);
    return jStat.ztest(z, 1);
  },

  twoSidedDifferenceOfProportions: function twoSidedDifferenceOfProportions(p1, n1, p2, n2) {
    var z = differenceOfProportions(p1, n1, p2, n2);
    return jStat.ztest(z, 2);
  }
});

}(this.jStat, Math));
this.jStat.models=(function(){

  function sub_regress(endog, exog) {
    return ols(endog, exog);
  }

  function sub_regress(exog) {
    var var_count = exog[0].length;
    var modelList = jStat.arange(var_count).map(function(endog_index) {
      var exog_index =
          jStat.arange(var_count).filter(function(i){return i!==endog_index});
      return ols(jStat.col(exog, endog_index).map(function(x){ return x[0] }),
                 jStat.col(exog, exog_index))
    });
    return modelList;
  }

  // do OLS model regress
  // exog have include const columns ,it will not generate it .In fact, exog is
  // "design matrix" look at
  //https://en.wikipedia.org/wiki/Design_matrix
  function ols(endog, exog) {
    var nobs = endog.length;
    var df_model = exog[0].length - 1;
    var df_resid = nobs-df_model - 1;
    var coef = jStat.lstsq(exog, endog);
    var predict =
        jStat.multiply(exog, coef.map(function(x) { return [x] }))
            .map(function(p) { return p[0] });
    var resid = jStat.subtract(endog, predict);
    var ybar = jStat.mean(endog);
    // constant cause problem
    // var SST = jStat.sum(endog.map(function(y) {
    //   return Math.pow(y-ybar,2);
    // }));
    var SSE = jStat.sum(predict.map(function(f) {
      return Math.pow(f - ybar, 2);
    }));
    var SSR = jStat.sum(endog.map(function(y, i) {
      return Math.pow(y - predict[i], 2);
    }));
    var SST = SSE + SSR;
    var R2 = (SSE / SST);
    return {
        exog:exog,
        endog:endog,
        nobs:nobs,
        df_model:df_model,
        df_resid:df_resid,
        coef:coef,
        predict:predict,
        resid:resid,
        ybar:ybar,
        SST:SST,
        SSE:SSE,
        SSR:SSR,
        R2:R2
    };
  }

  // H0: b_I=0
  // H1: b_I!=0
  function t_test(model) {
    var subModelList = sub_regress(model.exog);
    //var sigmaHat=jStat.stdev(model.resid);
    var sigmaHat = Math.sqrt(model.SSR / (model.df_resid));
    var seBetaHat = subModelList.map(function(mod) {
      var SST = mod.SST;
      var R2 = mod.R2;
      return sigmaHat / Math.sqrt(SST * (1 - R2));
    });
    var tStatistic = model.coef.map(function(coef, i) {
      return (coef - 0) / seBetaHat[i];
    });
    var pValue = tStatistic.map(function(t) {
      var leftppf = jStat.studentt.cdf(t, model.df_resid);
      return (leftppf > 0.5 ? 1 - leftppf : leftppf) * 2;
    });
    var c = jStat.studentt.inv(0.975, model.df_resid);
    var interval95 = model.coef.map(function(coef, i) {
      var d = c * seBetaHat[i];
      return [coef - d, coef + d];
    })
    return {
        se: seBetaHat,
        t: tStatistic,
        p: pValue,
        sigmaHat: sigmaHat,
        interval95: interval95
    };
  }

  function F_test(model) {
    var F_statistic =
        (model.R2 / model.df_model) / ((1 - model.R2) / model.df_resid);
    var fcdf = function(x, n1, n2) {
      return jStat.beta.cdf(x / (n2 / n1 + x), n1 / 2, n2 / 2)
    }
    var pvalue = 1 - fcdf(F_statistic, model.df_model, model.df_resid);
    return { F_statistic: F_statistic, pvalue: pvalue };
  }

  function ols_wrap(endog, exog) {
    var model = ols(endog,exog);
    var ttest = t_test(model);
    var ftest = F_test(model);
    var adjust_R2 =
        1 - (1 - model.rsquared) * ((model.nobs - 1) / (model.df_resid));
    model.t = ttest;
    model.f = ftest;
    model.adjust_R2 = adjust_R2;
    return model;
  }

  return { ols: ols_wrap };
})();

},{}],9:[function(require,module,exports){
arguments[4][8][0].apply(exports,arguments)
},{"dup":8}],10:[function(require,module,exports){
(function (root, factory) {
    'use strict';

    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.MersenneTwister = factory();
    }
}(this, function () {
    /**
     * A standalone, pure JavaScript implementation of the Mersenne Twister pseudo random number generator. Compatible
     * with Node.js, requirejs and browser environments. Packages are available for npm, Jam and Bower.
     *
     * @module MersenneTwister
     * @author Raphael Pigulla <pigulla@four66.com>
     * @license See the attached LICENSE file.
     * @version 0.2.3
     */

    /*
     * Most comments were stripped from the source. If needed you can still find them in the original C code:
     * http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/MT2002/CODES/mt19937ar.c
     *
     * The original port to JavaScript, on which this file is based, was done by Sean McCullough. It can be found at:
     * https://gist.github.com/banksean/300494
     */
    'use strict';

    var MAX_INT = 4294967296.0,
        N = 624,
        M = 397,
        UPPER_MASK = 0x80000000,
        LOWER_MASK = 0x7fffffff,
        MATRIX_A = 0x9908b0df;

    /**
     * Instantiates a new Mersenne Twister.
     *
     * @constructor
     * @alias module:MersenneTwister
     * @since 0.1.0
     * @param {number=} seed The initial seed value.
     */
    var MersenneTwister = function (seed) {
        if (typeof seed === 'undefined') {
            seed = new Date().getTime();
        }

        this.mt = new Array(N);
        this.mti = N + 1;

        this.seed(seed);
    };

    /**
     * Initializes the state vector by using one unsigned 32-bit integer "seed", which may be zero.
     *
     * @since 0.1.0
     * @param {number} seed The seed value.
     */
    MersenneTwister.prototype.seed = function (seed) {
        var s;

        this.mt[0] = seed >>> 0;

        for (this.mti = 1; this.mti < N; this.mti++) {
            s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
            this.mt[this.mti] =
                (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253) + this.mti;
            this.mt[this.mti] >>>= 0;
        }
    };

    /**
     * Initializes the state vector by using an array key[] of unsigned 32-bit integers of the specified length. If
     * length is smaller than 624, then each array of 32-bit integers gives distinct initial state vector. This is
     * useful if you want a larger seed space than 32-bit word.
     *
     * @since 0.1.0
     * @param {array} vector The seed vector.
     */
    MersenneTwister.prototype.seedArray = function (vector) {
        var i = 1,
            j = 0,
            k = N > vector.length ? N : vector.length,
            s;

        this.seed(19650218);

        for (; k > 0; k--) {
            s = this.mt[i-1] ^ (this.mt[i-1] >>> 30);

            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525))) +
                vector[j] + j;
            this.mt[i] >>>= 0;
            i++;
            j++;
            if (i >= N) {
                this.mt[0] = this.mt[N - 1];
                i = 1;
            }
            if (j >= vector.length) {
                j = 0;
            }
        }

        for (k = N - 1; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] =
                (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941)) - i;
            this.mt[i] >>>= 0;
            i++;
            if (i >= N) {
                this.mt[0] = this.mt[N - 1];
                i = 1;
            }
        }

        this.mt[0] = 0x80000000;
    };

    /**
     * Generates a random unsigned 32-bit integer.
     *
     * @since 0.1.0
     * @returns {number}
     */
    MersenneTwister.prototype.int = function () {
        var y,
            kk,
            mag01 = new Array(0, MATRIX_A);

        if (this.mti >= N) {
            if (this.mti === N + 1) {
                this.seed(5489);
            }

            for (kk = 0; kk < N - M; kk++) {
                y = (this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK);
                this.mt[kk] = this.mt[kk + M] ^ (y >>> 1) ^ mag01[y & 1];
            }

            for (; kk < N - 1; kk++) {
                y = (this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK);
                this.mt[kk] = this.mt[kk + (M - N)] ^ (y >>> 1) ^ mag01[y & 1];
            }

            y = (this.mt[N - 1] & UPPER_MASK) | (this.mt[0] & LOWER_MASK);
            this.mt[N - 1] = this.mt[M - 1] ^ (y >>> 1) ^ mag01[y & 1];
            this.mti = 0;
        }

        y = this.mt[this.mti++];

        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);

        return y >>> 0;
    };

    /**
     * Generates a random unsigned 31-bit integer.
     *
     * @since 0.1.0
     * @returns {number}
     */
    MersenneTwister.prototype.int31 = function () {
        return this.int() >>> 1;
    };

    /**
     * Generates a random real in the interval [0;1] with 32-bit resolution.
     *
     * @since 0.1.0
     * @returns {number}
     */
    MersenneTwister.prototype.real = function () {
        return this.int() * (1.0 / (MAX_INT - 1));
    };

    /**
     * Generates a random real in the interval ]0;1[ with 32-bit resolution.
     *
     * @since 0.1.0
     * @returns {number}
     */
    MersenneTwister.prototype.realx = function () {
        return (this.int() + 0.5) * (1.0 / MAX_INT);
    };

    /**
     * Generates a random real in the interval [0;1[ with 32-bit resolution.
     *
     * @since 0.1.0
     * @returns {number}
     */
    MersenneTwister.prototype.rnd = function () {
        return this.int() * (1.0 / MAX_INT);
    };

    /**
     * Generates a random real in the interval [0;1[ with 32-bit resolution.
     *
     * Same as .rnd() method - for consistency with Math.random() interface.
     *
     * @since 0.2.0
     * @returns {number}
     */
    MersenneTwister.prototype.random = MersenneTwister.prototype.rnd;

    /**
     * Generates a random real in the interval [0;1[ with 53-bit resolution.
     *
     * @since 0.1.0
     * @returns {number}
     */
    MersenneTwister.prototype.rndHiRes = function () {
        var a = this.int() >>> 5,
            b = this.int() >>> 6;

        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    };

    var instance = new MersenneTwister();

    /**
     * A static version of [rnd]{@link module:MersenneTwister#rnd} on a randomly seeded instance.
     *
     * @static
     * @function random
     * @memberof module:MersenneTwister
     * @returns {number}
     */
    MersenneTwister.random = function () {
        return instance.rnd();
    };

    return MersenneTwister;
}));

},{}],11:[function(require,module,exports){
(function (global){
(function() {
  var MersenneTwister = require('mersennetwister'),
      assert = require('assert'),
      util = require('../lib/util'),
      Ontology = require('../lib/ontology'),
      Assocs = require('../lib/assocs'),
      Model = require('../lib/model'),
      MCMC = require('../lib/mcmc')

  function setRedraw() {
    this.redraw = true
  }

  function bgColorStyle (r, g, b) {
    var bg = 0x10000*r + 0x100*g + b
    var bgStr = "000000" + bg.toString(16)
    bgStr = bgStr.substring (bgStr.length - 6)
    return 'background-color:#' + bgStr + ';'
  }
  
  function probStyle (p) {
    var rgb = util.HSVtoRGB (.43, p, 1)  // hue matches active-menu color in basic.css; value changed from .79 to 1 to fade naturally to white background
    return bgColorStyle (rgb.r, rgb.g, rgb.b)
  }

  function runMCMC() {
    var wtf = this
    var delayToNextRun = 100
    if (!wtf.paused) {
      delayToNextRun = 10

      wtf.mcmc.run (wtf.samplesPerRun)
      var now = Date.now()

      if (wtf.lastRun) {
	var elapsedSecs = (now - wtf.lastRun) / 1000
	$('#wtf-samples-per-sec').text ((wtf.samplesPerRun / elapsedSecs).toPrecision(2))
      }
      wtf.lastRun = now
      $('#wtf-total-samples').text (wtf.mcmc.samplesIncludingBurn.toString())
      $('#wtf-samples-per-term').text (Math.round(wtf.mcmc.samplesIncludingBurn / wtf.mcmc.nVariables()).toString())

      var currentSample = wtf.mcmc.samplesIncludingBurn,
          lastSample = wtf.logLikeSampleTimes.length ? wtf.logLikeSampleTimes[wtf.logLikeSampleTimes.length-1] : 0

      if (currentSample - lastSample > wtf.logLikeTracePeriod) {
        wtf.logLikeTrace.push (wtf.mcmc.quickCollapsedLogLikelihood())
        wtf.logLikeSampleTimes.push (currentSample)
        wtf.stateTrace.push (wtf.mcmc.models[0].activeTerms().map (function(t) {
          return wtf.ontology.termName[t]
        }).join(", "))
        if (wtf.logLikeTrace.length > 2000) {
          wtf.stateTrace = wtf.stateTrace.filter (function(x,i) { return i % 2 == 0 })
          wtf.logLikeTrace = wtf.logLikeTrace.filter (function(x,i) { return i % 2 == 0 })
          wtf.logLikeSampleTimes = wtf.logLikeSampleTimes.filter (function(x,i) { return i % 2 == 0 })
          wtf.logLikeTracePeriod *= 2
          forceRedrawLogLikelihood.call(wtf)
        } else
          redrawLogLikelihood.call(wtf)
      }

      if (!wtf.milestonePassed.burnIn && wtf.mcmc.finishedBurn()) {
        $('.wtf-sampler-notifications').append (makeAlert ('info', 'The sampler finished its burn-in period. Results are now available on the Term Report and Gene Report pages, and will be continually updated while the sampler is running.'))
	$('.wtf-results').show()
        $('.wtf-burn-unfinished').hide()
        wtf.milestonePassed.burnIn = true
      }

      var justFinished = false
      if (!wtf.milestonePassed.targetSamples && wtf.mcmc.samplesIncludingBurn >= wtf.milestone.targetSamples) {
	pauseAnalysis.call (wtf, null, 'success', 'the target of ' + wtf.milestone.targetSamples + ' samples was reached')
	wtf.milestonePassed.targetSamples = true
	$("#wtf-target-samples-per-term").prop('disabled',false)
        justFinished = true
      }
      
      if (justFinished || (wtf.redraw && (wtf.currentPage == 'term-report' || wtf.currentPage == 'gene-report'))) {
        showTables (wtf)
	wtf.redraw = false
	setTimeout (setRedraw.bind(wtf), 1000)
      }

      var percent = Math.round (100 * (wtf.mcmc.samplesIncludingBurn - wtf.milestone.startOfRun) / (wtf.milestone.targetSamples - wtf.milestone.startOfRun)) + '%'
      $('.wtf-progress-percent').text (percent)
      $('.wtf-progress-bar').css('width', percent)
    }
    wtf.mcmcTimer = setTimeout (runMCMC.bind(wtf), delayToNextRun)
  }

  function linkTerm (term) {
    var wtf = this
    return '<a target="_blank" href="' + wtf.termURL + term + '" title="' + wtf.ontology.getTermInfo(term) + '">' + term + '</a>'
  }

  function tableHeader (list) {
    return $('<thead><tr>'
	     + list.map (function (text_mouseover_cols) {
	       return text_mouseover_cols.length
		 ? ('<th'
		    + (text_mouseover_cols[2] ? (' colspan="' + text_mouseover_cols[2] + '"') : '')
		    + '><span title="' + text_mouseover_cols[1] + '">'
		    + text_mouseover_cols[0] + '</span></th>')
	       : ""
	     }).join('')
	     + '</tr></thead>')
  }

  function showTables (wtf) {
    var terms = showTermTable (wtf)
    var falsePos = wtf.mcmc.geneFalsePosSummary(0)
    var falseNeg = wtf.mcmc.geneFalseNegSummary(0)
    showGeneTable (wtf, $('#wtf-false-pos-table-parent'), falsePos,
		   "mislabeled")
    showGeneTable (wtf, $('#wtf-false-neg-table-parent'), falseNeg,
		   "mislabeled", "Predicted by terms", terms)
  }
  
  var termPairProbThreshold = .05, termOddsRatioThreshold = 100
  function showTermTable (wtf) {
    var termTable = $('<table class="table table-responsive"/>')
    var termProb = wtf.mcmc.termSummary(0)
    var terms = util.sortKeys(termProb).reverse()
    wtf.termProb = termProb

    var bosons = terms.map (function() { return [] })
    var fermions = terms.map (function() { return [] })
    if (wtf.trackingTermPairs && wtf.mcmc.termPairSamples > wtf.mcmc.burn) {
      var termPairSummary = wtf.mcmc.termPairSummary (0, terms)
      var termPairProb = termPairSummary.pair, termPairMarginal = termPairSummary.single

      terms.forEach (function(t,i) {
	terms.forEach (function(t2) {
	  if (t != t2) {
	    var ratio = termPairProb[t][t2] / (termPairMarginal[t] * termPairMarginal[t2])
	    if (ratio > termOddsRatioThreshold)
	      bosons[i].push(t2)
	    else if (ratio < 1 / termOddsRatioThreshold)
	      fermions[i].push(t2)
	  }
	})
      })
    }
    var gotBosons = bosons.some (function(l) { return l.length > 0 })
    var gotFermions = fermions.some (function(l) { return l.length > 0 })

    var equivalents = util.keyValListToObj (terms.map (function(t) {
      var ti = wtf.ontology.termIndex[t]
      return [ t,
               wtf.assocs.termsInEquivClass[wtf.assocs.equivClassByTerm[ti]]
	       .map (function(tj) { return wtf.ontology.termName[tj] }) ]
    }))
    var gotEquivalents = terms.some (function(t) { return equivalents[t].length > 0 })

    termTable.append (tableHeader
		      ([['Rank', 'Rank of this ' + (gotEquivalents ? ' class of terms.' : 'term.')],
                        [gotEquivalents ? 'ID(s)' : 'ID', gotEquivalents ? 'IDs for ontology terms. (Terms that have exactly the same gene associations are collapsed into a single class and their probabilities aggregated, since they are statistically indistinguishable under this model.)' : 'ID of an ontology term.'],
			[gotEquivalents ? 'Term(s)' : 'Term', 'Name of ontology term.' + (gotEquivalents ? ' (Terms that have exactly the same gene associations are collapsed into a single equivalence class and their probabilities aggregated, since they are statistically indistinguishable under this model.)' : '')],
			['P(Term|Data)', 'The posterior probability that ' + (gotEquivalents ? 'one of the terms in the equivalence class' : 'the term') + ' is activated.'],
			['Explains', 'Number of genes that are associated with ' + (gotEquivalents ? 'this class of terms' : 'the term') + ' and are in the active set.'],
			['Also predicts', 'Number of genes that are associated with ' + (gotEquivalents ? 'this class of terms' : 'the term') + ' but are not in the active set.'],
			gotBosons ? ['Positively correlated with', 'Other terms from this table that often co-occur with ' + (gotEquivalents ? 'this class of terms' : 'this term') + '. An interpretation is that these terms collaborate to explain complementary/disjoint subsets of the active genes.'] : [],
			gotFermions ? ['Negatively correlated with', 'Other terms from this table that rarely co-occur with ' + (gotEquivalents ? 'this class of terms' : 'this term') + '. An interpretation is that these terms compete to explain similar/overlapping subsets of the active genes.'] : []]))
    var termTableBody = $('<tbody/>')
    var inGeneSet = util.objPredicate (wtf.mcmc.models[0].inGeneSet)
    terms.forEach (function (t,i) {
      var p = termProb[t]
      var pStyle = probStyle(p)
      var genes = wtf.assocs.genesByTerm[wtf.ontology.termIndex[t]]
      var explained = genes.filter(inGeneSet).length
      var predicted = genes.length - explained
      function eqtd(x) {
	return '<td rowspan="' + equivalents[t].length + '">' + x + '</td>'
      }
      function eqtdsets(l) {
	return eqtd (l.map(function(f){return equivalents[f].map(linkTerm.bind(wtf)).join(", ")}).join("<br/>"))
      }
      equivalents[t].forEach (function (e, ei) {
	termTableBody
	  .append ($('<tr style="' + pStyle + '"/>')
		   .append (ei == 0 ? eqtd(i+1) : '',
                            stacktd(ei,linkTerm.call(wtf,e)),
			    stacktd(ei,wtf.ontology.getTermInfo(e)),
			    (ei == 0 ? eqtd(p.toPrecision(5)) : ''),
			    (ei == 0 ? eqtd(explained) : ''),
			    (ei == 0 ? eqtd(predicted) : ''),
			    (ei == 0 && gotBosons ? eqtdsets(bosons[i]) : ''),
			    (ei == 0 && gotFermions ? eqtdsets(fermions[i]) : '')))
      })
    })
    if (terms.length == 0)
      termTableBody.append ($('<tr/>').append ($('<td>').html ('<i>None</i>')))
    termTable.append (termTableBody)
    $('#wtf-term-table-parent').empty()
      .append (termTable)

    return terms
  }

  function stacktd(i,content,title) {
    var elt = (i == 0 ? $('<td/>') : $('<td style="border-top-style:none;"/>'))
    elt.html (content)
    if (title)
      elt.attr('title',title)
    return elt
  }

  function showGeneTable (wtf, parent, geneProb, label, termsHeader, terms) {
    var geneTable = $('<table class="table table-responsive"/>')
    var genes = util.sortKeys(geneProb).reverse()
    var showTerm = terms ? util.listToCounts(terms) : {}
    geneTable.append (tableHeader
		      ([['Gene name', 'Name of the potential ' + label + ' gene.'],
			['P(' + label + ')', 'Posterior probability that the gene is ' + label + '.'],
			terms ? ['Predicted by', 'A term that predicts this gene.', 2] : [],
			terms ? ['Explains', 'Number of genes in the active set that are explained by this term.'] : [],
			terms ? ['Also predicts', 'Number of genes that are NOT in the active set but are predicted by this term.'] : []]))
    var geneTableBody = $('<tbody/>')
    function pbtd(t,x) { return (t.length > 1 ? ('<td rowspan="' + t.length + '">') : '<td>') + x + '</td>' }
    var inGeneSet = util.objPredicate (wtf.mcmc.models[0].inGeneSet)
    genes.forEach (function (g,i) {
      var p = geneProb[g]
      var pStyle = probStyle(p)
      var predictedBy = []
      if (terms)
	wtf.assocs.termsByGene[wtf.assocs.geneIndex[g]].forEach (function (ti) {
	  var tx = wtf.assocs.getExemplar(ti)
	  if (showTerm[wtf.ontology.termName[tx]])
	    predictedBy.push (wtf.ontology.termName[ti])
	})
      if (predictedBy.length == 0)
	predictedBy = [null]

      predictedBy.forEach (function (t, ti) {

	var genes = t ? wtf.assocs.genesByTerm[wtf.ontology.termIndex[t]] : []
	var explained = genes.filter(inGeneSet).length
	var predicted = genes.length - explained

	geneTableBody
	  .append ($('<tr style="' + pStyle + '"/>')
		   .append (ti == 0 ? pbtd(predictedBy,g) : '',
			    ti == 0 ? pbtd(predictedBy,p.toPrecision(5)) : '',
			    t ? stacktd(ti,linkTerm.call(wtf,t)) : '',
			    t ? stacktd(ti,wtf.ontology.getTermInfo(t)) : '',
			    t ? stacktd(ti,explained) : '',
			    t ? stacktd(ti,predicted) : ''))
      })
    })
    if (genes.length == 0)
      geneTableBody.append ($('<tr/>').append ($('<td>').html ('<i>None</i>')))
    geneTable.append (geneTableBody)
    parent.empty()
    parent.append (geneTable)
  }

  var hypergeometricThreshold = .05
  function makeQuickReport() {
    var wtf = this
    if (!wtf.madeQuickReport) {
      $('#wtf-hypergeometric-term-table-parent').empty()
      $('#wtf-quick-report').hide()

      getGeneSet(wtf)
	.fail (function (msg) {
          $('.wtf-no-report-text').html ('No results yet! Please go back to the Data page and ' + msg)
          $('.wtf-no-report').show()
        }).done (function (validation) {
	  var relevantTerms = wtf.assocs.relevantTermsForGeneSet (validation.resolvedGeneIndices)
	  var hyperByTermIndex = wtf.assocs.hypergeometricPValues (validation.resolvedGeneIndices)
	  var sidakThreshold = 1 - Math.pow (1 - hypergeometricThreshold, 1 / relevantTerms.length)
	  var hyperByTerm = util.keyValListToObj (relevantTerms.map (function (ti) {
	    return [wtf.ontology.termName[ti], hyperByTermIndex[ti]]
	  }).filter (function (tp) {
	    return tp[1] < sidakThreshold
	  }))

	  wtf.hyperByTermIndex = hyperByTermIndex
	  wtf.hyperSidakThreshold = sidakThreshold

	  var termTable = $('<table class="table table-striped"/>')
	  var terms = util.sortKeys(hyperByTerm)
	  var inGeneSet = util.objPredicate (util.listToCounts (validation.resolvedGeneIndices))

	  termTable.append (tableHeader
			    ([['Rank', 'The rank of this term.'],
                              ['ID', 'The ID of an ontology term.'],
			      ['Name', 'The name of the term.'],
			      ['P-value', "The P-value of this term, according to a one-tailed Fisher\'s exact test. This is the probability that, if the genes in the gene-set had been selected at random, they would include at least as many genes annotated to this term as they in fact did."],
			      ['Explains', 'Number of genes in the specified gene-set that are explained by this term.'],
			      ['Also predicts', 'Number of genes that are NOT in the specified gene-set but are associated with this term.']]))
	  var termTableBody = $('<tbody/>')
	  terms.forEach (function (t,i) {
	    var p = hyperByTerm[t]
	    var genes = wtf.assocs.genesByTerm[wtf.ontology.termIndex[t]]
	    var explained = genes.filter(inGeneSet).length
	    var predicted = genes.length - explained
	    termTableBody
	      .append ($('<tr/>')
		       .append ($('<td/>').text (i + 1),
                                $('<td/>').html (linkTerm.call(wtf,t)),
				$('<td/>').text (wtf.ontology.getTermInfo(t)),
				$('<td/>').text (p.toPrecision(5)),
				$('<td/>').text (explained),
				$('<td/>').text (predicted)))
	  })
	  termTable.append (termTableBody)
	  $('#wtf-hypergeometric-term-table-parent').append (termTable)
	  $('#wtf-quick-report').show()
          $('.wtf-no-report').hide()
	  wtf.madeQuickReport = true
	})
    }
  }

  function getLogLikeRange (wtf) {
    var len = wtf.logLikeTrace.length
    if (len > 0) {
      var slice = wtf.logLikeTrace.slice(wtf.logLikeMinMaxSlice).concat (wtf.logLikeMinMax)
      wtf.logLikeMinMax[0] = Math.min (...slice)
      wtf.logLikeMinMax[1] = Math.max (...slice)
      wtf.logLikeMinMaxSlice = len
    }
  }
  
  function plotLogLikelihood() {
    var wtf = this
    if (wtf.mcmc) {
      wtf.logLikeMinMax = []
      wtf.logLikeMinMaxSlice = 0
      getLogLikeRange (wtf)
      wtf.targetX = [wtf.milestone.targetSamples, wtf.milestone.targetSamples]

      $('#wtf-loglike-plot').empty()
      Plotly.newPlot( $('#wtf-loglike-plot')[0],
		      [{ x: wtf.logLikeSampleTimes,
                         y: wtf.logLikeTrace,
                         text: wtf.stateTrace,
                         mode: 'lines',
			 name: 'Log-likelihood' },
		       { x: [wtf.mcmc.burn, wtf.mcmc.burn],
			 y: wtf.logLikeMinMax,
			 name: 'Burn-in',
			 mode: 'lines',
			 hoverinfo: 'name',
			 line: { dash: 4 } },
		       { x: wtf.targetX,
			 y: wtf.logLikeMinMax,
			 name: 'End of run',
			 mode: 'lines',
			 hoverinfo: 'name',
			 line: { dash: 4 } }],
		      { margin: { t:10, b:100, r:0 },
			yaxis: { title: 'Log-likelihood' },
			xaxis: { title: 'Sample number' },
                        showlegend: false },
		      { frameMargins: .05,
			displayModeBar: false })

      $(window).off('resize')
      $(window).on('resize', forceRedrawLogLikelihood.bind(wtf))
    }
  }

  function forceRedrawLogLikelihood() {
    var wtf = this
    if (wtf.mcmc) {
      plotLogLikelihood.call(wtf)
      Plotly.redraw( $('#wtf-loglike-plot')[0] )
    }
  }
  
  function redrawLogLikelihood() {
    var wtf = this
    if (wtf.mcmc && !wtf.paused) {
      getLogLikeRange (wtf)
      Plotly.redraw( $('#wtf-loglike-plot')[0] )
    }
  }

  function pairCheckboxClicked (evt) {
    var wtf = this

    if ($('#wtf-track-term-pairs').prop('checked')) {
      if (!wtf.trackingTermPairs) {
	wtf.trackingTermPairs = true
	wtf.mcmc.logTermPairs()
      }
    } else {
      if (wtf.trackingTermPairs) {
	wtf.trackingTermPairs = false
	wtf.mcmc.stopLoggingTermPairs()
      }
    }
  }

  function modalAlert (msg) {
    $("#wtf-modal-text").html (msg)
    $("#wtf-modal").modal()
  }
  
  function modalConfirm (msg, noText, yesText, callback) {
    $("#wtf-confirm-text").html (msg)
    $("#wtf-confirm-no-button").text(noText)
    $("#wtf-confirm-yes-button").text(yesText)
      .on ('click', function (evt) {
	$("#wtf-confirm-yes-button").off ('click')
	callback (evt)
      })
    $("#wtf-confirm").modal()
  }

  function cancelStart (wtf, msg) {
    if (msg)
      modalAlert (msg)
    $('.wtf-reset').prop('disabled',false)
    $('.wtf-start').prop('disabled',false)
    enableInputControls (wtf)
  }

  function getGeneSet (wtf) {
    var def = $.Deferred()
    if (!wtf.assocs)
      def.reject ('select an organism and ontology.')
    else {
      var geneNames = $('#wtf-gene-set-textarea').val().split(/\s*\n\s*/)
	  .filter (function (sym) { return sym.length > 0 })
      var valid = wtf.assocs.validateGeneNames (geneNames)
      if (valid.missingGeneNames.length > 0) {
        valid.missingGeneNamesHint = 'The following gene symbols were not found in the gene-term associations database:<br/>'
          + '<i>' + valid.missingGeneNames.join(", ") + '</i>'
        if (valid.resolvedGeneIndices.length == 0)
	  def.reject ('enter some valid gene symbols.', valid.missingGeneNamesHint)
      } else
        if (valid.geneNames.length == 0)
	  def.reject ('enter some gene symbols.')
      wtf.userGeneName = valid.suppliedGeneName
      def.resolve (valid)
    }
    return def
  }

  function parseCountAndSet (id) {
    var elt = $('#'+id)
    var val = parseFloat (elt.val())
    if (isNaN(val) || val < 0)
      val = 0
    elt.val(val)
    return val
  }

  function parsePosIntAndSet (id, defaultVal) {
    var elt = $('#'+id)
    var val = parseInt (elt.val())
    if (isNaN(val) || val < 0)
      val = defaultVal
    elt.val(val)
    return val
  }
  
  function startAnalysis (evt) {
    var wtf = this
    if (evt)
      evt.preventDefault()

    $('.wtf-reset').prop('disabled',true)
    $('.wtf-start').prop('disabled',true)
    disableInputControls (wtf)

    setTimeout (function() {  // give buttons a chance to update
      getGeneSet(wtf)
	.fail (function (msg) { cancelStart (wtf, 'Before starting analysis, please ' + msg) })
	.done (function (validation) {
          
          $('.wtf-sampler-notifications').append (makeAlert ('info', 'Initializing MCMC sampler.'))

          setTimeout (function() {
	    var prior = {
	      succ: {
		t: parseCountAndSet ('wtf-term-present-pseudocount'),
		fp: parseCountAndSet ('wtf-false-pos-pseudocount'),
		fn: parseCountAndSet ('wtf-false-neg-pseudocount')
	      },
	      fail: {
		t: parseCountAndSet ('wtf-term-absent-pseudocount'),
		fp: parseCountAndSet ('wtf-true-neg-pseudocount'),
		fn: parseCountAndSet ('wtf-true-pos-pseudocount')
	      }
	    }

	    makeQuickReport.call (wtf)

	    wtf.mcmc = new MCMC ({ assocs: wtf.assocs,
			           geneSets: [validation.geneNames],
				   prior: prior,
                                   moveRate: {
				     flip: 1,
				     step: 1,
				     jump: 1
                                   },
				   seed: 123456789
			         })

	    wtf.samplesPerRun = 100
            wtf.logLikeSampleTimes = []
            wtf.logLikeTrace = []
            wtf.stateTrace = []
	    wtf.logLikeTracePeriod = wtf.samplesPerRun

	    var samplesPerTerm = parsePosIntAndSet ('wtf-target-samples-per-term', 1)
	    wtf.mcmc.burn = parsePosIntAndSet ('wtf-burn-per-term', 1) * wtf.mcmc.nVariables()
	    wtf.milestone.targetSamples = wtf.mcmc.burn + samplesPerTerm * wtf.mcmc.nVariables()
	    wtf.milestone.startOfRun = 0

	    wtf.milestonePassed = {}
	    wtf.trackingTermPairs = false

	    $('.wtf-mcmc-status').show()

	    $('.wtf-start').prop('disabled',false)
	    $('.wtf-reset').show()

	    $('.wtf-progress-header').show()
	    $('.wtf-progress-bar').css('width','0%')

	    resumeAnalysis.call(wtf)

            plotLogLikelihood.call(wtf)

            wtf.redraw = true
            setTimeout (runMCMC.bind(wtf), 1)
          }, 100)
        })
    }, 1)
  }

  function pauseAnalysis (evt, type, reason) {
    var wtf = this
    if (evt)
      evt.preventDefault()

    wtf.paused = true
    $('.wtf-start').html('More sampling')
    $('.wtf-start').off('click')
    $('.wtf-start').on('click',resumeAnalysis.bind(wtf))
    $('.wtf-reset').prop('disabled',false)

    $('#wtf-track-term-pairs').off('click')
    $('.wtf-sampler-notifications').append (makeAlert (type || 'warning',
                                                       'The sampler was paused at ' + Date() + (reason ? (', because ' + reason) : '') + '.'))

    $('#wtf-samples-per-sec').text(0)
    $('.wtf-progress-bar').removeClass('active')
  }

  function resumeAnalysis (evt) {
    var wtf = this
    if (evt)
      evt.preventDefault()

    if (wtf.milestonePassed.targetSamples) {
      delete wtf.milestonePassed.targetSamples
      var samplesPerTerm = parsePosIntAndSet ('wtf-target-samples-per-term', 1)
      wtf.milestone.startOfRun = wtf.mcmc.samplesIncludingBurn
      wtf.milestone.targetSamples += samplesPerTerm * wtf.mcmc.nVariables()
      wtf.targetX[0] = wtf.targetX[1] = wtf.milestone.targetSamples
    }

    wtf.paused = false
    $('.wtf-start').html('Stop sampling')
    $('.wtf-start').off('click')
    $('.wtf-start').on('click',pauseAnalysis.bind(wtf))
    $('.wtf-reset').prop('disabled',true)

    pairCheckboxClicked.call(wtf)
    $('#wtf-track-term-pairs').on('click',pairCheckboxClicked.bind(wtf))

    disableInputControls (wtf)
    $("#wtf-target-samples-per-term").prop('disabled',true)
    $('.wtf-sampler-notifications').append (makeAlert ('success', 'The sampler was started at ' + Date() + '.'))

    $('.wtf-progress-bar').addClass('active')
  }

  function reset (evt) {
    var wtf = this
    if (evt)
      evt.preventDefault()
    if (wtf.mcmcTimer) {
      clearTimeout (wtf.mcmcTimer)
      delete wtf.mcmcTimer
    }

    delete wtf.mcmc
    wtf.paused = true

    $('.wtf-start').off('click')
    $('.wtf-start')
      .on('click', startAnalysis.bind(wtf))

    cancelStart(wtf)
    $('.wtf-start').text('Start sampling')

    $('.wtf-mcmc-status').hide()
    $('.wtf-results').hide()
    $('.wtf-reset').hide()
    $('.wtf-sampler-notifications').empty()
    $("#wtf-target-samples-per-term").prop('disabled',false)

    $('.wtf-progress-header').hide()

    $(window).off('resize')  // cancel Plotly redraw
  }

  function inputControls() {
    return $('#wtf-select-organism-button, #wtf-select-ontology-button, #wtf-gene-set-textarea, #wtf-load-gene-set-button, #wtf-example-gene-set-button, .wtf-prior')
  }
  
  function disableInputControls (wtf) {
    inputControls().prop('disabled',true)
    $('.wtf-prior-slider').slider('disable')
    $('.wtf-input-panel').attr('title','These controls are disabled once sampling begins. To modify them, reset the sampler.')
  }
  
  function enableInputControls (wtf) {
    inputControls().prop('disabled',false)
    $('.wtf-input-panel').attr('title','')
    $('.wtf-prior-slider').slider('enable')
    wtf.enableSliderReset()
  }

  function geneSetTextAreaChanged() {
    var wtf = this
    
    delete wtf.madeQuickReport
    delete wtf.hyperByTermIndex

    if (wtf.geneSetValidateTimer) {
      clearTimeout (wtf.geneSetValidateTimer)
      delete wtf.geneSetValidateTimer
    }

    wtf.geneSetValidateTimer = setTimeout (function() {
      delete wtf.geneSetValidateTimer
      getGeneSet(wtf)
        .done (function (valid) {
          if (!wtf.geneSetValidateTimer) {
            if (valid.missingGeneNamesHint) {
              $('.wtf-gene-names-invalid-text').html (valid.missingGeneNamesHint)
              $('.wtf-gene-names-invalid').show()
              $('.wtf-gene-names-valid').hide()
            } else {
              $('.wtf-gene-names-invalid').hide()
              $('.wtf-gene-names-valid').show()
            }
            $('.wtf-gene-names-valid-count').text (util.plural (valid.geneNames.length, "valid gene symbol"))
            $('#wtf-sampler-controls').show()
          }

        }).fail (function (msg, detail) {
          if (!wtf.geneSetValidateTimer) {
            $('#wtf-sampler-controls').hide()
            $('.wtf-gene-names-valid').hide()
            if (detail) {
              $('.wtf-gene-names-invalid-text').html (detail)
              $('.wtf-gene-names-invalid').show()
            } else
              $('.wtf-gene-names-invalid').hide()
          }
        })
    }, 500)
  }

  function setGeneSetTextArea (wtf, text) {
    $('#wtf-gene-set-textarea').val (text)
    geneSetTextAreaChanged.call (wtf)
  }

  function exampleLoader (wtf, exampleJson) {
    return function (evt) {
      evt.preventDefault()
      setGeneSetTextArea (wtf, exampleJson.genes.join("\n"))
    }
  }
  
  function log() {
    console.log (Array.prototype.slice.call(arguments).join(''))
  }

  function textInput() {
    return $('<input type="text" size="5"/>')
  }

  function selectPage (wtf, id) {
    $('.wtf-page').hide()
    $('.wtf-link').removeClass('active-menu')
    $('.wtf-' + id + '-link').addClass('active-menu')
    $('#wtf-' + id + '-page').show()
    $('.wtf-no-report').hide()

    wtf.currentPage = id
    switch (id) {
    case 'quick-report':
      if (id == 'quick-report')
	setTimeout (makeQuickReport.bind(wtf), 1)  // don't delay redraw
      break

    case 'sampler':
      setTimeout (forceRedrawLogLikelihood.bind(wtf), 1)  // don't delay redraw
      break

    case 'term-report':
    case 'gene-report':
      if (!wtf.mcmc) {
        $('.wtf-no-report-text').html ("You won't see any results on this page until you start running the sampler.")
        $('.wtf-no-report').show()
      } else if (!wtf.mcmc.finishedBurn()) {
        $('.wtf-no-report-text').html ("You won't see any results on this page until the sampler has finished its burn-in period.")
        $('.wtf-no-report').show()
      }
      break

    default:
      break
    }
  }

  function makeAlert (type, text) {
    return '<div class="alert alert-' + type + ' alert-dismissable">'
      + '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>'
      + text
      + '</div>'
  }

  function makeLink (url, text) {
    return '<a href="' + url + '">' + text + '</a>'
  }
  
  function initialize() {
    var wtf = this

    var ontologyReady = $.Deferred(),
	assocsReady = $.Deferred()

    // load ontology
    wtf.log ("Loading ontology...")
    $('#wtf-ontology-notifications')
      .append (makeAlert ('info',
                          'Loading ' + wtf.ontologyName))
    $.get(wtf.ontologyURL)
      .done (function (ontologyJson) {
	wtf.ontology = new Ontology (ontologyJson)
        
	wtf.log ("Loaded ontology ", wtf.ontologyName, " with ", wtf.ontology.terms(), " terms")

	$('.wtf-term-count').text (wtf.ontology.terms())

        $('#wtf-ontology-notifications')
          .append (makeAlert ('success',
                              'Loaded ' + wtf.ontologyName + ' with ' + wtf.ontology.terms() + ' terms'))

	ontologyReady.resolve()
      }).fail (function() {
        $('#wtf-ontology-notifications')
          .append (makeAlert ('warning',
                              'There was a problem loading ' + wtf.ontologyName + ' from '
                              + makeLink (ontologyURL, wtf.ontologyURL)))
      })

    // load associations
    ontologyReady.done (function() {
      wtf.log ("Loading gene-term associations...")
      $('#wtf-ontology-notifications')
        .append (makeAlert ('info',
                            'Loading ' + wtf.ontologyName + '&harr;' + wtf.organismName + ' associations'))
      $.get(wtf.assocsURL)
	.done (function (assocsJson) {
	  wtf.assocs = new Assocs ({ ontology: wtf.ontology,
				     idAliasTerm: assocsJson.idAliasTerm })

	  wtf.log ("Loaded ", wtf.assocs.nAssocs, " associations (", wtf.assocs.genes(), " genes, ", wtf.assocs.relevantTerms().length, " terms)")

	  $('.wtf-relevant-term-count').text (wtf.assocs.relevantTerms().length)
	  $('.wtf-gene-count').text (wtf.assocs.genes())

          $('#wtf-ontology-notifications')
            .append (makeAlert ('success',
                                'Loaded ' + wtf.assocs.nAssocs + ' associations (' + wtf.assocs.genes() + ' genes, ' + wtf.assocs.relevantTerms().length + ' terms)'))

	  assocsReady.resolve()
	}).fail (function() {
          $('#wtf-ontology-notifications')
            .append (makeAlert ('warning',
                                'There was a problem loading ' + wtf.ontologyName + '&harr;' + wtf.organismName + ' associations from '
                                + makeLink (wtf.assocsURL, wtf.assocsURL)))
	})
    })

    // initialize form
    assocsReady.done (function() {

      geneSetTextAreaChanged.call(wtf)

      var examples = wtf.organismExamples.concat (wtf.ontologyExamples)
      $('#wtf-example-list').empty()
      $('#wtf-example-list').append (examples.map (function (exampleJson) {
	return $('<li><a href="#">' + exampleJson.name + '</a></li>')
	  .click (exampleLoader (wtf, exampleJson))
      }))
      
      if (examples.length)
	$('#wtf-example-gene-set-button').show()
      else
	$('#wtf-example-gene-set-button').hide()
    })
  }

  function organismSelector(wtf,orgJson) {
    return function (evt) {
      evt.preventDefault()
      if (wtf.organismName != orgJson.name) {

	wtf.organismName = orgJson.name
        wtf.organismExamples = orgJson.examples || []

	delete wtf.ontologyName
        delete wtf.ontology
        delete wtf.assocs
	delete wtf.madeQuickReport
	delete wtf.hyperByTermIndex

	$('#wtf-select-organism-button-text').text (orgJson.name)
	$('.wtf-organism-name').text (orgJson.name)

	$('#wtf-select-ontology-button').show()
	$('#wtf-select-ontology-button-text').text('Select ontology')

        var ontologyMenu = orgJson.ontologies.map (function (ontoJson) {
	  return $('<li><a href="#">' + ontoJson.name + '</a></li>')
	    .click (ontologySelector(wtf,ontoJson))
	})
        
	$('#wtf-ontology-list').empty()
	$('#wtf-ontology-list').append (ontologyMenu)

        $('#wtf-example-gene-set-button').hide()
        $('#wtf-ontology-notifications').empty()

        geneSetTextAreaChanged.call(wtf)

	reset.call (wtf)

        if (ontologyMenu.length === 1)
          ontologyMenu[0].click()
      }
    }
  }

  function ontologySelector(wtf,ontoJson) {
    return function (evt) {
      evt.preventDefault()
      if (wtf.ontologyName != ontoJson.name) {

	wtf.ontologyName = ontoJson.name
	wtf.ontologyURL = ontoJson.ontology
	wtf.assocsURL = ontoJson.assocs
        wtf.termURL = ontoJson.term || 'http://amigo.geneontology.org/amigo/term/'
        wtf.ontologyExamples = ontoJson.examples || []
	
        delete wtf.ontology
        delete wtf.assocs
	delete wtf.madeQuickReport
	delete wtf.hyperByTermIndex

	$('#wtf-select-ontology-button-text').text (ontoJson.name)
	$('.wtf-ontology-name').text (ontoJson.name)
        $('#wtf-ontology-notifications').empty()

        geneSetTextAreaChanged.call (wtf)

	initialize.call(wtf)
      }
    }
  }

  function WTFgenes (conf) {
    var wtf = this
    conf = conf || {}

    // populate wtf object
    $.extend (wtf, { datasetsURL: conf.datasets || "./datasets.json",
                     milestone: {},
                     milestonePassed: {},
		     log: log })

    // set up sidebar menu
    $('.wtf-page').hide()
    selectPage (wtf, 'data')
    $('.wtf-page-inner').show()
    $('.wtf-link').click (function (evt) {
      evt.preventDefault()
      selectPage (wtf, evt.target.getAttribute('data-target'))
    })
    
    // set up data page
    $('#wtf-select-organism-button-text').text('Select organism')
    $('#wtf-select-ontology-button').hide()
    $('#wtf-example-gene-set-button').hide()
    $('#wtf-sampler-controls').hide()

    $('#wtf-gene-set-textarea').bind ('input propertychange', geneSetTextAreaChanged.bind (wtf))

    $('#wtf-gene-set-file-selector').on ('change', function (fileSelectEvt) {
      var reader = new FileReader()
      reader.onload = function (fileLoadEvt) {
	setGeneSetTextArea (wtf, fileLoadEvt.target.result)
      }
      reader.readAsText(fileSelectEvt.target.files[0])
    })
    $('#wtf-load-gene-set-button')
      .on ('click', function (evt) {
	evt.preventDefault()
	$('#wtf-gene-set-file-selector').click()
	return false
      })

    $('.wtf-reset')
      .on('click', function() {
	modalConfirm ("Do you really want to reset? This will erase all the statistics the sampler has accumulated (i.e. the Term and Gene reports).", "No, I've relented", "Yes, wipe it all", reset.bind(wtf))
      })

    // set up parameters page
    function findIndexEq (list, val) {
      return list.findIndex (function(x) { return x == val })
    }

    var sliderProbs = [0, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, .1, .2, .3, .4, .5, .6, .7, .8, .9, .99, .999, .9999, .99999, .999999, 1],
        sliderWeights = [0, .01, .1, .5, 1, 2, 5, 10, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8],
        initSliderProb = .5,
        initSliderWeight = 0,
        initSliderProbVal = findIndexEq(sliderProbs,initSliderProb),
        initSliderWeightVal = findIndexEq(sliderWeights,initSliderWeight)
    
    function sliderChangeCallback (probId, weightId, succId, failId, thisId) {
      return function (event, ui) {
        var probVal = thisId==probId ? ui.value : $('#wtf-'+probId+'-slider').slider('value'),
            weightVal = thisId==weightId ? ui.value : $('#wtf-'+weightId+'-slider').slider('value'),
            prob = sliderProbs[probVal],
            weight = sliderWeights[weightVal]
        $('#wtf-'+succId+'-pseudocount').val (prob * weight)
        $('#wtf-'+failId+'-pseudocount').val ((1 - prob) * weight)
        $('.wtf-'+probId).text (prob)
        $('.wtf-'+weightId).text (weight)
        $('#wtf-'+probId+'-slider, #wtf-'+weightId+'-slider').fadeTo(0,1)
        $('#wtf-reset-'+probId)
          .prop('disabled',probVal == initSliderProbVal && weightVal == initSliderWeightVal)
      }
    }

    function setSlider (id, target, values) {
      var index = findIndexEq(values,target)
      if (index >= 0) {
        $('#wtf-'+id+'-slider').slider ('value', index)
        $('#wtf-'+id+'-slider').fadeTo(0,1)
      } else {
        var nextIndex = values.findIndex (function(x) { return x > target })
        $('#wtf-'+id+'-slider').slider ('value', nextIndex > 0 ? (nextIndex-1) : 0)
        $('#wtf-'+id+'-slider').fadeTo(.5,.5)
      }
      return index
    }

    function pseudocountChangeCallback (probId, weightId, succId, failId) {
      return function() {
        var succ = parseCountAndSet ('wtf-'+succId+'-pseudocount')
        var fail = parseCountAndSet ('wtf-'+failId+'-pseudocount')
        var weight = succ + fail, prob = weight > 0 ? (succ / weight) : .5
        $('.wtf-'+probId).text (prob)
        $('.wtf-'+weightId).text (weight)
        var probVal = setSlider (probId, prob, sliderProbs)
        var weightVal = setSlider (weightId, weight, sliderWeights)
        $('#wtf-reset-'+probId)
          .prop('disabled',probVal == initSliderProbVal && weightVal == initSliderWeightVal)
      }
    }
    
    function initSliders (probId, weightId, succId, failId) {
      var probChange = sliderChangeCallback (probId, weightId, succId, failId, probId)
      var weightChange = sliderChangeCallback (probId, weightId, succId, failId, weightId)
      var pseudoChange = pseudocountChangeCallback (probId, weightId, succId, failId)
      $('#wtf-'+probId+'-slider')
        .slider({ value: initSliderProbVal,
                  min: 0,
                  max: sliderProbs.length - 1,
                  slide: probChange,
                  stop: probChange
                })
      $('#wtf-'+weightId+'-slider')
        .slider({ value: initSliderWeightVal,
                  min: 0,
                  max: sliderWeights.length - 1,
                  slide: weightChange,
                  stop: weightChange
                })
      $('#wtf-'+succId+'-pseudocount, #wtf-'+failId+'-pseudocount')
        .change (pseudoChange)
      $('#wtf-reset-'+probId).click (function() {
        $('#wtf-'+probId+'-slider').slider ('value', initSliderProbVal)
        $('#wtf-'+weightId+'-slider').slider ('value', initSliderWeightVal)
        sliderChangeCallback (probId, weightId, succId, failId) ()
      })
      var oldReset = wtf.enableSliderReset
      wtf.enableSliderReset = function() {
        pseudoChange()
        oldReset()
      }
      sliderChangeCallback (probId, weightId, succId, failId) ()
    }

    wtf.enableSliderReset = function() { }
    initSliders ('term-prob', 'term-weight', 'term-present', 'term-absent')
    initSliders ('false-pos-prob', 'false-pos-weight', 'false-pos', 'true-neg')
    initSliders ('false-neg-prob', 'false-neg-weight', 'false-neg', 'true-pos')
    
    // set up sampler & results pages
    $('#wtf-burn-per-term').val(10)
    $('#wtf-target-samples-per-term').val(100)
    reset.call (wtf)
    
    // load dataset file
    wtf.log ("Loading datasets...")
    $.get(wtf.datasetsURL)
      .done (function (datasetsJson) {
	wtf.datasets = datasetsJson
	wtf.log ("Loaded " + wtf.datasets.organisms.length + " organisms")
	wtf.datasets.organisms.forEach (function (orgJson) {
	  $('#wtf-organism-list').append
	  ($('<li><a href="#">' + orgJson.name + '</a></li>')
	   .click (organismSelector(wtf,orgJson)))
	})

      }).fail (function() {
	wtf.log("Problem loading " + wtf.datasetsURL)
      })
  }

  global.WTFgenes = WTFgenes
})()

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../lib/assocs":1,"../lib/mcmc":3,"../lib/model":4,"../lib/ontology":5,"../lib/util":7,"assert":12,"mersennetwister":10}],12:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":16}],13:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],14:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],15:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],16:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":15,"_process":14,"inherits":13}]},{},[11]);
