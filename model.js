(function() {
    var assert = require('assert'),
	MersenneTwister = require('mersennetwister'),
	bernouilli = require('./bernouilli'),
	BernouilliParams = bernouilli.BernouilliParams,
	BernouilliCounts = bernouilli.BernouilliCounts,
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
		model._nActiveTermsByGene[g] += delta
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
        var inGeneSet = model._inGeneSet[g]
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
	var counts = model.params.newCounts()
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
	var cd = model.params.newCounts()
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

    function proposeSwapMove() {
	var model = this
	var activeTerms = model.activeTerms()
	if (activeTerms.length == 0)
	    return this.proposeFlipMove()
	var term = util.randomElement (activeTerms, model.generator)
	var tsa = {}
	tsa[term] = false
	var nbrs = this.relevantNeighbors[term]
	if (nbrs.length == 0)
	    return { termStates: tsa,
		     proposalHastingsRatio: 1 }
	var nbr = util.randomElement (nbrs, model.generator)
	if (this._termState[nbr])
	    return { termStates: tsa,
		     proposalHastingsRatio: 1 }
	tsa[nbr] = true
	return { termStates: tsa,
		 proposalHastingsRatio: model.relevantNeighbors[nbr].length / nbrs.length }
    }

    function sampleMoveForDelta(move,logLikeRatioFunc) {
	move.delta = this.getCountDelta(move.termStates)
	move.logLikelihoodRatio = logLikeRatioFunc(move.delta)
	move.hastingsRatio = move.proposalHastingsRatio * Math.exp(move.logLikelihoodRatio)
	if (move.hastingsRatio >= 1 || this.generator.random() < move.hastingsRatio) {
	    this.setTermStates (move.termStates)
	    move.accepted = true
	} else
	    move.accepted = false
	return move.accepted
    }
    
    function sampleMove(move) {
	return sampleMoveForDelta.bind(this) (move, function(countDelta) {
	    return countDelta.logLikelihood()
	})
    }

    function sampleMoveCollapsed(move,counts) {
	sampleMoveForDelta.bind(this) (move, function(countDelta) {
	    return counts.deltaLogBetaBernouilliLikelihood (countDelta)
	})
	if (move.accepted)
	    counts.accum (move.delta)
	return move.accepted
    }
    
    function Model (conf) {
        var model = this
	var isActive = {}

	var assocs = conf.assocs
	var termName = assocs.ontology.termName
	var geneName = assocs.geneName
        
        var geneSet = conf.geneSet.map (function(g) {
            return assocs.geneIndex[g]
        })

	if (conf.terms)
	    conf.terms.forEach (function(term) { isActive[term] = true })
        var termState = termName.map (conf.termState || util.objPredicate(isActive))

        // "relevant" terms are ones which have at least one associated gene in the geneSet
        var relevantTerms = util.removeDups (geneSet.reduce (function(termList,g) {
	    return termList.concat (assocs.termsByGene[g])
	}, [])).map(util.parseDecInt).sort(util.numCmp)
        var isRelevant = util.listToCounts (relevantTerms)
        function relevantFilter(termList) {
            return termList.filter (util.objPredicate(isRelevant))
        }
        var relevantParents = assocs.ontology.parents.map (relevantFilter)
        var relevantChildren = assocs.ontology.children.map (relevantFilter)

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

		    _inGeneSet: geneName.map (function() { return false }),

                    isRelevant: isRelevant,
		    relevantTerms: relevantTerms,
		    relevantNeighbors: relevantParents.map (function(parents,term) {
			return parents.concat(relevantChildren[term]).sort(util.numCmp)
		    }),
		    
		    parameterization: parameterization,
		    params: conf.params || parameterization.params,
                    prior: conf.prior || parameterization.params.laplacePrior(),

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

                    activeTerms: function() {
                        return Object.keys(this._isActiveTerm).sort(util.numCmp)
                    },
                    
		    getTermState: getTermState,
		    setTermState: setTermState,
		    setTermStates: setTermStates,
                    invert: invert,
                    
		    getCounts: getCounts,
		    getCountDelta: getCountDelta,

		    generator: conf.generator || new MersenneTwister (conf.seed),
		    
		    proposeFlipMove: proposeFlipMove,
		    proposeSwapMove: proposeSwapMove,

		    sampleMove: sampleMove,
		    sampleMoveCollapsed: sampleMoveCollapsed,
		    
		    toJSON: function() {
		        var model = this
		        return model.activeTerms()
			    .map (function(t) { return model.termName[t] })
		    }
                })

	geneSet.forEach (function(g) { model._inGeneSet[g] = true })
	termState.forEach (function(s,t) { if (s) model._isActiveTerm[t] = true })
    }

    module.exports = Model
}) ()
