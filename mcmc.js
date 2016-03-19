(function() {
    var assert = require('assert'),
    Model = require('./model'),
    Parameterization = require('./parameterization'),
    util = require('./util'),
    extend = util.extend

    function MCMC (conf) {
        var mcmc = this

        var assocs = conf.assocs
        var parameterization = conf.parameterization || new Parameterization (conf)
        var prior = conf.prior || parameterization.params.laplacePrior()
        var models = conf.models
            || conf.geneSets.map (function(geneSet) {
                return new Model ({ assocs: assocs,
                                    geneSet: geneSet,
                                    parameterization: parameterization,
                                    prior: prior })
            })
        
        extend (mcmc,
                {
                    params: parameterization.params,
                    prior: prior,
                    models: models,

                    counts: parameterization.params.newCounts(),
                    
                    samples: 0,
                    termStateOccupancy: models.map (function(model) {
                        return model.termState.map (function() { return 0 })
                    }),
                })
    }

    module.exports = MCMC
}) ()
