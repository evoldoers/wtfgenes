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
