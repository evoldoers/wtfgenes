(function() {
    var assert = require('assert'),
	MersenneTwister = require('mersennetwister'),
	Model = require('./model'),
	Parameterization = require('./parameterization'),
	BernouilliCounts = require('./bernouilli').BernouilliCounts,
	util = require('./util'),
	extend = util.extend

    function logMove(text) {
	var mcmc = this
	console.log ("Move #" + (mcmc.samples+1) + ": " + text)
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
	    console.log ("State #" + mcmc.samples + ": " + mcmc.models.map (function (model) {
		return JSON.stringify (model.toJSON())
	    }))
	})
    }

    function getCounts(models,prior) {
	return models.reduce (function(c,m) {
	    return c.accum (m.getCounts())
	}, prior.copy())
    }

    function run(samples) {
	var mcmc = this

	var sumModelWeight = util.sumList (mcmc.modelWeight)
	var moveRate = { flip: mcmc.moveRate.flip,
			 randomize: mcmc.moveRate.randomize
		       }

	for (var sample = 0; sample < samples; ++sample) {
	    
	    var nActiveTerms = mcmc.models.map (function(model) { return model.activeTerms.length })
	    moveRate.swap = mcmc.moveRate.swap * util.sumList (nActiveTerms)

	    mcmc.preMoveCallback.forEach (function(callback) {
		callback (mcmc, moveRate)
	    })

	    var move = { type: util.randomKey (moveRate, mcmc.generator) }

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
		var occupancy = mcmc.termStateOccupancy[n]
		model.activeTerms().forEach (function(term) {
		    ++occupancy[term]
		})
	    })

	    mcmc.postMoveCallback.forEach (function(callback) {
		callback (mcmc, move)
	    })
	}
    }

    function termSummary() {
	var mcmc = this
	return mcmc.termStateOccupancy.map (function (occupancy) {
	    return util.keyValListToObj (occupancy.map (function (occ, term) {
		return [mcmc.assocs.ontology.termName[term], occ / mcmc.samples]
	    }).filter (function (keyVal) { return keyVal[1] > 0 }))
	})
    }

    function summary() {
	var mcmc = this
	return { samples: mcmc.samples,
		 termSummary: termSummary.bind(mcmc)() }
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
	    ? new BernouilliCounts(conf.prior,parameterization.params)
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
		    
		    countsWithPrior: getCounts(models,prior),
		    computeCounts: function() {
			return getCounts (this.models, this.params.newCounts())
		    },
		    computeCountsWithPrior: function() {
			return getCounts (this.models, this.prior)
		    },
		    collapsedLogLikelihood: function() {
			return this.computeCounts().logBetaBernouilliLikelihood (this.prior)
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

		    preMoveCallback: [],
		    postMoveCallback: [],

		    logMoves: logMoves,
		    logState: logState,

		    run: run,
		    summary: summary
                })
    }

    module.exports = MCMC
}) ()
