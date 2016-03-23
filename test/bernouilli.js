// for use with mocha test framework

var Bernouilli = require('../bernouilli').BernouilliParams,
    assert = require('assert')

describe('BernouilliParams', function() {

    var json = { 'c': .5,
		 'b': .25,
		 'a': .125 }

    var params = [ 'a', 'b', 'c' ]

    var bern = new Bernouilli (json)

    describe('#constructor', function() {
        it('should parse correct number of params', function() {
            assert.deepEqual (bern.params(), params)
        })
    })

    describe('#getParam', function() {
        it('should retrieve param values', function() {
            assert.equal (bern.getParam('a'), .125)
            assert.equal (bern.getParam('b'), .25)
            assert.equal (bern.getParam('c'), .5)
        })
    })

    describe('#setParam', function() {
        it('should store param values', function() {
            bern.setParam('a',.0625)
            assert.equal (bern.getParam('a'), .0625)
            bern.setParam('a',.125)
            assert.equal (bern.getParam('a'), .125)
        })
    })

    describe('#toJSON', function() {
        it('should serialize and deserialize idempotently', function() {
            assert.deepEqual (bern.toJSON(), json)
        })
    })

    describe('#newCounts', function() {
	var a3b1Json = {succ:{a:3},fail:{b:1}}
	var a1c5Json = {succ:{a:1},fail:{c:5}}
	var a4b1c5Json = {succ:{a:4},fail:{b:1,c:5}}
	var zeroCounts = bern.newCounts()
	var a3b1Counts = bern.newCounts(a3b1Json)
	var a1c5Counts = bern.newCounts(a1c5Json)
        it('should return empty counts by default', function() {
            assert.deepEqual (zeroCounts.succ, {})
            assert.deepEqual (zeroCounts.fail, {})
        })
        it('should accept optional counts argument', function() {
            assert.equal (a3b1Counts.succ.a, 3)
            assert.equal (a3b1Counts.fail.b, 1)
        })

	describe('BernouilliCounts', function() {
	    describe('#toJSON', function() {
		it('should serialize and deserialize idempotently', function() {
		    assert.deepEqual (a3b1Counts.toJSON(), a3b1Json)
		})
	    })
	    describe('#accum', function() {
	        var tmpCounts = bern.newCounts(a3b1Json)
		it('should accumulate counts', function() {
		    tmpCounts.accum (a1c5Counts)
		    assert.deepEqual (tmpCounts.toJSON(), a4b1c5Json)
		})
	    })
	    describe('#copy', function() {
		it('should copy counts', function() {
		    var a3b1copy = a3b1Counts.copy()
		    assert.deepEqual (a3b1copy.toJSON(), a3b1Json)
		    ++a3b1copy.succ['a']
		    assert.deepEqual (a3b1Counts.toJSON(), a3b1Json)
		})
	    })
	    describe('#add', function() {
		it('should add counts', function() {
		    var a4b1c5Counts = a3b1Counts.add (a1c5Counts)
		    assert.deepEqual (a4b1c5Counts.toJSON(), a4b1c5Json)
		})
		it('should not modify originals', function() {
		    assert.deepEqual (a3b1Counts.toJSON(), a3b1Json)
		    assert.deepEqual (a1c5Counts.toJSON(), a1c5Json)
		})
	    })
	    describe('#logLikelihood', function() {
		it('should compute log-likelihood', function() {
		    assert.equal (a3b1Counts.logLikelihood(bern),
				  3 * Math.log(bern.getParam('a')) + Math.log(1 - bern.getParam('b')))
		})
		it('should work after parameters changed', function() {
		    bern.setParam('a',.66)
		    bern.setParam('b',.33)
		    assert.equal (bern.getParam('a'), .66)
		    assert.equal (bern.getParam('b'), .33)
		    assert.equal (a3b1Counts.logLikelihood(bern),
				  3 * Math.log(bern.getParam('a')) + Math.log(1 - bern.getParam('b')))
		})
	    })
	    describe('#logPrior', function() {
	        var abcLaplaceJson = {succ:{a:1,b:1,c:1},fail:{a:1,b:1,c:1}}
                var abcMidJson = { 'c': .5,
		                   'b': .5,
		                   'a': .5 }
                var midBern = new Bernouilli (abcMidJson)
	        var abcLaplace = midBern.newCounts(abcLaplaceJson)
		it('should compute log of beta prior', function() {
		    assert.equal (abcLaplace.logPrior(midBern), 3*Math.log(1.5))
		})
	    })
	})
    })

})
