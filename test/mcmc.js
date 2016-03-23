// for use with mocha test framework

var Ontology = require('../ontology'),
    Assocs = require('../assocs'),
    Model = require('../model'),
    MCMC = require('../mcmc'),
    MersenneTwister = require('mersennetwister'),
    util = require('../util'),
    assert = require('assert')

describe('MCMC', function() {

    var ontoJson = [
        ["arachnid", "animal"],  // 0
        ["mammal", "animal"],  // 1
        ["spider", "arachnid"],  // 2
        ["primate", "mammal"],  // 3
        ["human", "primate"],  // 4
        ["spiderhuman", "arachnid", "human", "mutant"],  // 5
        ["gorilla", "primate"],  // 6
        ["animal"],  // 7
        ["mutant"]  // 8
    ]

    var geneName = ["peter-parker",  // 0
                    "may-parker",  // 1
                    "socrates",  // 2
                    "charlotte",  // 3
                    "king-kong"];  // 4

    var gt = [["peter-parker", "spiderhuman"],
              ["may-parker", "spiderhuman"],
              ["socrates", "human"],
              ["charlotte", "spider"],
              ["king-kong", "gorilla"],
              ["king-kong", "mutant"]]

    var mutants = ["peter-parker", "may-parker", "king-kong"]
    
    var onto = new Ontology (ontoJson)
    var assocs = new Assocs ({ ontology: onto, assocs: gt })

    var prior = {
	succ: { t: 1, fp: 1, fn: 1 },
	fail: {
	    t: onto.terms(),
	    fp: assocs.genes(),
	    fn: assocs.genes()
	}
    }

    var model = new Model ({ assocs: assocs,
			     geneSet: mutants,
			     prior: prior })

    var seed = 12345

    function bitVecToTermStateAssignment (bitVec) {
	var tsa = {}
	for (var i = 0; i < model.relevantTerms.length; ++i)
	    tsa[model.relevantTerms[i]] = (bitVec & (1 << i)) ? true : false
	model.setTermStates (tsa)
    }

    function bitVecToTermString (bitVec) {
	var s = []
	for (var i = 0; i < model.relevantTerms.length; ++i)
	    if (bitVec & (1 << i))
		s.push (onto.termName[model.relevantTerms[i]])
	return JSON.stringify(s)
    }

    function getModelStateAsBitVec (model) {
	var bitVec = 0
	for (var i = 0; i < model.relevantTerms.length; ++i)
	    if (model.getTermState (model.relevantTerms[i]))
		bitVec = bitVec + (1 << i)
	return bitVec
    }

    function moveToBitVec (move) {
	var bitVec = 0
	model.relevantTerms.forEach (function(term,idx) {
	    if (move.termStates[term])
		bitVec += (1 << idx)
	})
	return bitVec
    }

    function testCounts (mcmc, move) {
	assert.deepEqual (mcmc.computeCountsWithPrior().toJSON(), mcmc.countsWithPrior.toJSON())
    }

    function addLogLikeRatioTest (mcmc) {
	var llOld
	function recordOldLogLike (mcmc, move) {
	    llOld = mcmc.collapsedLogLikelihood()
	}

	function testLogLikeRatio (mcmc, move) {
	    var inv = move.model.invert(move.termStates)
	    move.model.setTermStates(move.termStates)
	    var llNew = mcmc.collapsedLogLikelihood()
	    util.assertApproxEqual (llNew - llOld, move.logLikelihoodRatio)
	    move.model.setTermStates(inv)
	}

	mcmc.preMoveCallback.push (recordOldLogLike)
	mcmc.postMoveCallback.push (testLogLikeRatio)
    }

    function addStateOccupancyTracker (mcmc) {
	var stateOccupancy = []
	for (var bitVec = 0; bitVec < (1 << model.relevantTerms.length); ++bitVec)
	    stateOccupancy.push (0)
	mcmc.postMoveCallback.push (function(mcmc,move) {
	    ++stateOccupancy [getModelStateAsBitVec (move.model)]
	})
	return stateOccupancy
    }

    function addProposalTracker (mcmc) {
	var stateOccupancy = []
	for (var bitVec = 0; bitVec < (1 << model.relevantTerms.length); ++bitVec)
	    stateOccupancy.push (0)
	mcmc.postMoveCallback.push (function(mcmc,move) {
	    assert.equal (move.type, 'randomize')
	    ++stateOccupancy [moveToBitVec (move)]
	})
	return stateOccupancy
    }

    function newMCMC (moveRate) {
	return new MCMC ({ assocs: assocs,
			   geneSet: mutants,
			   seed: seed,
			   prior: prior,
			   moveRate: moveRate })
    }

    var state = [], statePostProb, termPostProb = model.termName.map (function() { return 0 }), termPostProbByName = {}
    it('should enumerate all states as initialization for test', function() {
	var stateLogLike = [], maxLogLike
	for (var bitVec = 0; bitVec < (1 << model.relevantTerms.length); ++bitVec) {
	    model.setTermStates (bitVecToTermStateAssignment (bitVec))
	    assert.equal (getModelStateAsBitVec (model), bitVec)
	    var counts = model.getCounts()
	    var ll = counts.logBetaBernouilliLikelihood (prior)
	    state.push (model.toJSON())
	    stateLogLike.push (ll)
	    if (bitVec == 0 || ll > maxLogLike)
		maxLogLike = ll
	}

	var norm = 0
	stateLogLike.forEach (function(ll) { norm += Math.exp (ll - maxLogLike) })

	var logNorm = Math.log (norm)
	statePostProb = stateLogLike.map (function(ll) { return Math.exp (ll - maxLogLike - logNorm) })

	statePostProb.forEach (function (stateProb, bitVec) {
	    model.relevantTerms.forEach (function (term, bitVecIdx) {
		if (bitVec & (1 << bitVecIdx))
		    termPostProb[term] += stateProb
	    })
	})

	termPostProb.forEach (function (postProb, term) {
	    termPostProbByName[onto.termName[term]] = postProb
	})
    })

    function testTermOccupancy (mcmc) {
	var summary = mcmc.summary()
	var termSummary = summary.termSummary[0]
	assert (termPostProb.every (function (postProb, term) {
	    util.approxEqual (postProb, termSummary[onto.termName[term]])
	}), "\nTrue: " + JSON.stringify(termPostProbByName,null,1) + "\nEstimated: " + JSON.stringify(termSummary,null,1))
    }

    function testStateOccupancy (mcmc, stateOccupancy) {
	var ok = true
	var n = mcmc.samples
	stateOccupancy.forEach (function (occupancy, state) {
	    var p = statePostProb[state]
	    var expectedFreq = n*p
	    var stdev = Math.sqrt (n*p*(1-p))
	    var tol = 4*stdev / expectedFreq
	    var approxEq = util.approxEqual (occupancy, expectedFreq, tol)
	    if (!approxEq) {
		console.log ("Expected: " + Math.round(expectedFreq) + " +/- " + Math.round(stdev) + " Actual: " + occupancy + " State: " + bitVecToTermString(state) + '\033[31m NOT CLOSE\033[39m')
		ok = false
	    }
	})
	assert (ok)
    }

    function testUniformDistribution (proposalFrequency, stateNameFunc) {
	stateNameFunc = stateNameFunc || bitVecToTermString
	var ok = true
	var n = proposalFrequency.reduce (function(tot,x) { return tot+x }, 0)
	var p = 1 / proposalFrequency.length
	var expectedFreq = n*p
	var stdev = Math.sqrt (n*p*(1-p))
	var tol = 4*stdev / expectedFreq
	proposalFrequency.forEach (function (propFreq, state) {
	    var approxEq = util.approxEqual (propFreq, expectedFreq, tol)
	    if (!approxEq) {
		model.setTermStates (bitVecToTermStateAssignment (state))
		console.log ("Expected: " + expectedFreq + " Actual: " + propFreq + " Proposal: " + stateNameFunc(state) + '\033[31m NOT CLOSE\033[39m')
		ok = false
	    }
	})
	assert (ok)
    }

    it('should track counts correctly during an MCMC run', function() {
	var mcmc = newMCMC ({flip:1,swap:1,randomize:1})
	mcmc.postMoveCallback.push (testCounts)
	mcmc.postMoveCallback.push (testRelevantTerms)
	mcmc.run(1000)
    })

    it('should evaluate log-likelihood ratios correctly during a run', function() {
	var mcmc = newMCMC ({flip:1,swap:1,randomize:1})
	addLogLikeRatioTest (mcmc)
	mcmc.run(1000)
    })

    it('should have an RNG that generates uniformly distributed bits', function() {
	var propFreq = [0,0]
	var mersenne = new MersenneTwister()
	for (var n = 0; n < 10000; ++n)
	    ++propFreq [mersenne.random() > .5 ? 1 : 0]
	testUniformDistribution (propFreq, function(state){return state})
    })

    function proposeRandomize() {
	var move = {termStates:{}}
	model.relevantTerms.forEach (function(term) {
	    move.termStates[term] = model.generator.random() > .5
	})
	return move
    }

    function testRandomize(moveProposalFunc) {
	var propFreq = []
	for (var n = 0; n < 10000; ++n) {
	    var move = moveProposalFunc()
	    var bitVec = moveToBitVec (move)
	    propFreq[bitVec] = (propFreq[bitVec] || 0) + 1
	}
	testUniformDistribution (propFreq)
    }

    function testRelevantTerms(mcmc,move) {
        assert.deepEqual (move.model.relevantTerms, [0,1,3,4,5,6,7,8])
    }

    it('should have an RNG that generates uniformly distributed states', function() {
	testRandomize (proposeRandomize)
    })

    it('should have a model that proposes states uniformly with "randomize" moves', function() {
	testRandomize (function(){return model.proposeRandomizeMove()})
    })

    it('should propose states uniformly with "randomize" moves during a run', function() {
	var mcmc = newMCMC ({randomize:1})
	var propFreq = addProposalTracker (mcmc)
	mcmc.run(10000)
	testUniformDistribution (propFreq)
    })

    it('should estimate state post.probs. correctly with "randomize" moves', function() {
	var mcmc = newMCMC ({randomize:1})
	var stateOccupancy = addStateOccupancyTracker (mcmc)
	mcmc.postMoveCallback.push (testCounts)
	addLogLikeRatioTest (mcmc)
	mcmc.run(10000)
	testStateOccupancy (mcmc, stateOccupancy)
    })

    it('should estimate term post.probs. correctly with "randomize" moves', function() {
	var mcmc = newMCMC ({randomize:1})
	mcmc.run(10000)
	testTermOccupancy (mcmc)
    })

})
