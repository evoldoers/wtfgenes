(function() {
    var extend = require('util')._extend,
        assert = require('assert'),
        jStat = require('jStat')

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

    function logPrior (params, counts) {
	var lp = 0
	for (var param in params._params)
            lp += Math.log (jStat.beta.pdf (counts.succ[param] + 1, counts.fail[param] + 1))
	return lp
    }
    
    function add (counts) {
	var c = new BernouilliCounts (this)
	return c.accum (counts)
    }

    function accum (counts) {
	assert (this.params === counts.params)
        function accWithDelete (c, c2, param) {
	    var newCount = c2[param] + (c[param] || 0)
            if (newCount)
                c[param] = newCount
            else
                delete c[param]
        }
	for (var param in counts.succ)
            accWithDelete (this.succ, counts.succ, param)
	for (var param in counts.fail)
            accWithDelete (this.fail, counts.fail, param)
	return this
    }

    function sampleParams() {
        var params = new BernouilliParams (this.params._params)
	for (var param in params._params)
            params.setParam (param, jStat.beta.sample (this.succ[param] + 1, this.fail[param] + 1))
    }

    function BernouilliCounts (counts) {
        var bc = this
	extend (bc, {
	    params: counts.params,
	    succ: extend ({}, counts.succ),
	    fail: extend ({}, counts.fail),
	    logLikelihood: function(params) { return logLikelihood(params || this.params,this) },
	    logPrior: function(params) { return logPrior(params || this.params,this) },
	    logLikeWithPrior: function(prior,params) {
                params = params || this.params
                return prior.logPrior(params) + logLikelihood(params,this)
            },
	    add: add,
	    accum: accum,
            sampleParams: sampleParams,
	    toJSON: function() { return { succ: this.succ, fail: this.fail } }
	})
    }

    function BernouilliParams (params) {
        var bp = this
	extend (bp, {
	    _params: params || {},
	    _logYes: {},
	    _logNo: {},
	    params: function() { return Object.keys(this._params).sort() },
	    getParam: function(param) { return this._params[param] },
	    setParam: function(param,val) { this._params[param] = val; update (bp, param) },
	    logLikelihood: function(count) { return logLikelihood(this,count) },
	    logPrior: function(prior) { return logPrior(this,prior) },
	    logLikeWithPrior: function(prior,count) { return logPrior(this,prior) + logLikelihood(this,count) },
	    toJSON: function() { return extend ({}, this._params) },
	    newCounts: function(c) { return new BernouilliCounts (extend ({ params: this }, c)) },
	    laplacePrior: function() {
                var c = this.newCounts()
                this.params().forEach (function(p) { c.succ[p] = c.fail[p] = 1 })
                return c
            }
	})
	Object.keys(params).forEach (function(param) {
	    update (bp, param)
	})
    }

    module.exports = BernouilliParams
}) ()
