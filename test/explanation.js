// for use with mocha test framework

var Ontology = require('../ontology'),
    Assocs = require('../assocs'),
    Explanation = require('../explanation'),
    assert = require('assert')

describe('Explanation', function() {

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
    var normals = ["socrates", "charlotte"]
    
    var onto = new Ontology (ontoJson)
    var assocs = new Assocs ({ ontology: onto, assocs: gt })

    var mutantEx = new Explanation ({ assocs: assocs, geneSet: mutants })
    var normalEx = new Explanation ({ assocs: assocs, geneSet: normals })

    var mutCount = mutantEx.getCounts()
    var normCount = normalEx.getCounts()

    var multAssign = {3:1,4:1,7:1,8:1}
    
    describe('#constructor', function() {
        it('should identify relevant terms', function() {
            assert.deepEqual (mutantEx.relevantTerms, [0,1,3,4,5,6,7,8])
            assert.deepEqual (normalEx.relevantTerms, [0,1,2,3,4,7])
            assert (normalEx.isRelevant[1])
            assert (!normalEx.isRelevant[5])
        })
        it('should identify parents of relevant terms', function() {
            assert.deepEqual (mutantEx.relevantParents, [[7],[7],[0],[1],[3],[0,4,8],[3],[],[]])
        })
        it('should create default params', function() {
            assert.deepEqual (mutantEx.params.params(), ['fn','fp','t'])
        })
        it('should create default Laplace prior', function() {
            assert.deepEqual (mutantEx.prior.toJSON(), {succ:{fn:1,fp:1,t:1},fail:{fn:1,fp:1,t:1}})
        })
        it('should set all term states to 0 by default', function() {
            assert.deepEqual (mutantEx._termState, [0,0,0,0,0,0,0,0,0])
        })
        it('should initialize private inGeneSet flags', function() {
            assert.deepEqual (mutantEx._inGeneSet, [1,1,0,0,1])
            assert.deepEqual (normalEx._inGeneSet, [0,0,1,1,0])
        })
    })

    describe('#setTermState', function() {
        it('should update termState & isActiveTerm', function() {
            for (var t = 0; t < 9; ++t)
                if (t != 2) {
                    mutantEx.setTermState(t,1);
                    for (var s = 0; s < 9; ++s)
                        assert.equal (mutantEx.getTermState(s), s == t ? 1 : 0)
                    var isActiveTerm = {}
                    isActiveTerm[t] = 1
                    assert.deepEqual (mutantEx._isActiveTerm, isActiveTerm)
                    mutantEx.setTermState(t,0);
                }
            assert.deepEqual (mutantEx._isActiveTerm, {})
            assert.deepEqual (mutantEx._termState, [0,0,0,0,0,0,0,0,0])
        })
        it('should update nActiveTermsByGene', function() {
            mutantEx.setTermState(1,1);
            mutantEx.setTermState(3,1);
            mutantEx.setTermState(8,1);
            assert.equal (mutantEx._nActiveTermsByGene[2], 2)
            assert.equal (mutantEx._nActiveTermsByGene[3], 0)
            assert.equal (mutantEx._nActiveTermsByGene[4], 3)
            mutantEx.setTermState(1,0);
            mutantEx.setTermState(3,0);
            mutantEx.setTermState(8,0);
        })
    })

    describe('#toJSON', function() {
        it('should convert term state to JSON', function() {
            for (var t = 0; t < 9; ++t)
                if (t != 2) {
                    mutantEx.setTermState(t,1);
                    assert.deepEqual (mutantEx.toJSON(), [onto.termName[t]])
                    mutantEx.setTermState(t,0);
                }
            assert.deepEqual (mutantEx.toJSON(), {})
        })
    })

    describe('#activeTerms', function() {
        it('should return sorted list of active terms', function() {
            mutantEx.setTermState(0,1);
            for (var t = 4; t < 9; ++t) {
                mutantEx.setTermState(t,1);
                for (var s = 3; s < t; ++s) {
                    mutantEx.setTermState(s,1);
                    assert.deepEqual (mutantEx.activeTerms(), [0,s,t])
                    mutantEx.setTermState(s,0);
                }
                mutantEx.setTermState(t,0);
            }
            mutantEx.setTermState(0,0);
            assert.deepEqual (mutantEx.toJSON(), {})
        })
    })
    
    describe('#invert', function() {
        it('should invert a term-state assignment', function() {
            assert.deepEqual (mutantEx.invert(multAssign), {3:0,4:0,7:0,8:0})
            assert.deepEqual (mutantEx.invert({0:0,1:1}), {0:0,1:0})
        })
    })

    describe('#setTermStates', function() {
        it('should apply a term-state assignment', function() {
            var inv = mutantEx.invert(multAssign)
            mutantEx.setTermStates (multAssign)
            assert.deepEqual (mutantEx.toJSON(), ['primate','human','animal','mutant'])
            mutantEx.setTermStates (inv)
            assert.deepEqual (mutantEx.toJSON(), [])
        })
    })
            
    describe('#getCounts', function() {
        it('should return Bernouilli parameter counts', function() {
            assert.deepEqual (mutCount.toJSON(), {succ:{fp:3},fail:{t:8,fp:2}})
            assert.deepEqual (normCount.toJSON(), {succ:{fp:2},fail:{t:6,fp:3}})

            normalEx.setTermState (7, 1)
            var newNormCount = normalEx.getCounts()
            assert.deepEqual (newNormCount.toJSON(), {succ:{t:1,fn:3},fail:{t:5,fn:2}})
            normalEx.setTermState (7, 0)
        })
    })

    describe('#getCountDelta', function() {
        it('should return count deltas for a single-term state change', function() {
            var normSingleDelta = normalEx.getCountDelta({7:1})
            assert.deepEqual (normSingleDelta.toJSON(), {succ:{t:1,fp:-2,fn:3},fail:{t:-1,fp:-3,fn:2}})
            var mutSingleDelta = mutantEx.getCountDelta({8:1})
            assert.deepEqual (mutSingleDelta.toJSON(), {succ:{t:1,fp:-3},fail:{t:-1,fn:3}})
        })
        var mutMultiDelta = mutantEx.getCountDelta(multAssign)
        it('should return count deltas for a multi-term state change', function() {
            assert.deepEqual (mutMultiDelta.toJSON(), {succ:{t:4,fp:-3,fn:2},fail:{t:-4,fn:3,fp:-2}})
        })
        it('should be consistent with observed getCounts delta', function() {
            var inv = mutantEx.invert (multAssign)
            mutantEx.setTermStates (multAssign)
            assert.deepEqual (mutCount.add(mutMultiDelta).toJSON(), mutantEx.getCounts().toJSON())
            mutantEx.setTermStates (inv)
        })
    })
})
