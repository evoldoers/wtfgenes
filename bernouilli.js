(function() {
    var extend = require('util')._extend,
        assert = require('assert')

    function update (bp, param) {
	var val = bp._params[param]
	bp._logYes[param] = Math.log (val)
	bp._logNo[param] = Math.log (1 - val)
    }

    function logLikelihood (params, counts) {
	var ll = 0
	for (var param in counts.pos)
	    if (counts.pos.hasOwnProperty (param))
		ll += params._logYes[param] * counts.pos[param]
	for (var param in counts.neg)
	    if (counts.neg.hasOwnProperty (param))
		ll += params._logNo[param] * counts.neg[param]
	return ll
    }

    function add (counts) {
	assert (this.params === counts.params)
	var c = new BernouilliCounts (this)
	for (var param in counts.pos)
	    if (counts.pos.hasOwnProperty (param))
		c.pos[param] = counts.pos[param] + (c.pos[param] || 0)
	for (var param in counts.neg)
	    if (counts.neg.hasOwnProperty (param))
		c.neg[param] = counts.neg[param] + (c.neg[param] || 0)
	return c
    }

    function BernouilliCounts (counts) {
        var bc = this
	extend (bc, {
	    params: counts.params,
	    pos: extend ({}, counts.pos),
	    neg: extend ({}, counts.neg),
	    logLikelihood: function(params) { return logLikelihood(params || this.params,this) },
	    add: add,
	    toJSON: function() { return { pos: this.pos, neg: this.neg } }
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
	    toJSON: function() { return extend ({}, this._params) },
	    newCounts: function(c) { return new BernouilliCounts (extend ({ params: this }, c)) }
	})
	Object.keys(params).forEach (function(param) {
	    update (bp, param)
	})
    }

    module.exports = BernouilliParams
}) ()
