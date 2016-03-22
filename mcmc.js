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
	console.log ("Move #" + mcmc.samples + ": " + text)
	console.log()
    }

    function logTermMove(move) {
	var mcmc = this
	logMove.bind(mcmc)("Toggle (" + Object.keys(move.termStates).map (function(t) {
	    return mcmc.assocs.ontology.termName[t]
	}) + "), Hastings ratio " + move.hastingsRatio + ": "
		+ (move.accepted ? "accepted" : "rejected"))
    }

    function getCounts(models,prior) {
	return models.reduce (function(c,m) {
	    return c.accum (m.getCounts())
	}, prior.copy())
    }

    function run(samples) {
	var mcmc = this

	console.log ("Initial counts: " + JSON.stringify(mcmc.counts.toJSON()))

	var sumModelWeight = util.sumList (mcmc.modelWeight)
	var moveRate = [ mcmc.moveRate.flip,
			 mcmc.moveRate.swap ]
	for (var sample = 0; sample < samples; ++sample) {
	    var moveType = util.randomIndex (moveRate, mcmc.generator)
	    switch (moveType) {
	    case 0:
		var model = mcmc.models [util.randomIndex (mcmc.modelWeight)]
		var move = model.proposeFlipMove()
//		model.sampleMove (move)
		model.sampleMoveCollapsed (move, mcmc.counts)
		logTermMove.bind(mcmc) (move)
		break

	    case 1:
		var model = mcmc.models [util.randomIndex (mcmc.modelWeight, mcmc.generator)]
		var move = model.proposeSwapMove()
//		model.sampleMove (move)
		model.sampleMoveCollapsed (move, mcmc.counts)
		logTermMove.bind(mcmc) (move)
		break

/*
	    case 2:
		var counts = mcmc.models.reduce (function(counts,model) {
		    return counts.add (model.getCounts())
		}, mcmc.prior)
		counts.sampleParams (mcmc.params)
		logMove.bind(mcmc) ("Params " + JSON.stringify(mcmc.params.toJSON()))
		break
*/

	    default:
		throw new Error ("invalid move type!")
		break;
	    }

	    mcmc.models.forEach (function(model,n) {
		var occupancy = mcmc.termStateOccupancy[n]
		model.activeTerms().forEach (function(term) {
		    ++occupancy[term]
		})
	    })
	    ++mcmc.samples

	    assert.deepEqual (getCounts(mcmc.models,mcmc.prior).toJSON(), mcmc.counts.toJSON())
	}

    	console.log ("Final counts: " + JSON.stringify(mcmc.counts.toJSON()))
    }

    function termSummary() {
	var mcmc = this
	return mcmc.termStateOccupancy.map (function (occupancy) {
	    return util.keyValListToObj (occupancy.map (function (occ, term) {
		return [mcmc.assocs.ontology.termName[term], occ / mcmc.samples]
	    }))
	})
    }

    function summary() {
	var mcmc = this
	return { samples: mcmc.samples,
		 termSummary: termSummary.bind(mcmc)() }
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
				    generator: generator})
            })
        
	var moveRate = { flip: 1, swap: 1, param: 1 }
	if (conf.moveRate)
	    extend (moveRate, conf.moveRate)
	
        extend (mcmc,
                {
		    assocs: assocs,
                    params: parameterization.params,
                    prior: prior,
                    models: models,

		    counts: getCounts(models,prior),
		    
		    generator: generator,
		    
		    moveRate: moveRate,
		    modelWeight: models.map (function(model) {
			return model.relevantTerms.length
		    }),
                    
                    samples: 0,
                    termStateOccupancy: models.map (function(model) {
                        return model.termName.map (function() { return 0 })
                    }),

		    run: run,
		    summary: summary
                })
    }

    module.exports = MCMC
}) ()
