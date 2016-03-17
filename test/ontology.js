// for use with mocha test framework

var Ontology = require('../ontology'),
    assert = require('assert')

describe('Ontology', function() {

    var json = [
        ["arachnid", "animal"],  // 0
        ["mammal", "animal"],  // 1
        ["spider", "arachnid"],  // 2
        ["primate", "mammal"],  // 3
        ["man", "primate"],  // 4
        ["spiderman", "spider", "man"],  // 5
        ["kingkong", "primate"]  // 6
    ]

    var fullJson = json.slice()
    fullJson.push (["animal"])  // 7

    var topJson = [7,0,1,2,3,4,6,5]  // Kahn's sort ordering (NB kingkong now precedes spiderman)
        .map (function(i) { return fullJson[i] })

    var cyclicJson = [["l'etat","moi"],["moi","l'etat"]];

    var compressedJson = [
        ["arachnid", 7],
        ["mammal", 7],
        ["spider", 0],
        ["primate", 1],
        ["man", 3],
        ["spiderman", 2, 4],
        ["kingkong", 3],
        ["animal"]
    ]

    var subJson = [
        ["arachnid", "animal"],
        ["mammal", "animal"],
        ["spider", "arachnid"]
    ]

    var closure = [[0,7],
                   [1,7],
                   [0,2,7],
                   [1,3,7],
                   [1,3,4,7],
                   [0,1,2,3,4,5,7],
                   [1,3,6,7],
                   [7]]
    
    var onto = new Ontology ({ "termParents": json })
    var fullOnto = new Ontology ({ "termParents": fullJson })
    var topOnto = new Ontology ({ "termParents": topJson })
    var subOnto = new Ontology ({ "termParents": subJson })

    describe('#constructor', function() {
        it('should parse explicitly declared terms', function() {
            assert.equal (fullOnto.termName.length, 8)
        })
        it('should detect implicit terms', function() {
            assert.equal (onto.termName.length, 8)
            assert.equal (onto.termName[7], 'animal')
            assert.equal (onto.parents[7].length, 0)
        })
        it('should map term names to term indices', function() {
            assert.equal (fullOnto.termIndex['arachnid'], 0)
            assert.equal (fullOnto.termIndex['spider'], 2)
            assert.equal (fullOnto.termIndex['man'], 4)
            assert.equal (fullOnto.termIndex['spiderman'], 5)
            assert.equal (fullOnto.termIndex['animal'], 7)
        })
        it('should map parent names to term indices', function() {
            assert.equal (fullOnto.parents[0].length, 1)
            assert.equal (fullOnto.parents[0][0], 7)

            assert.equal (fullOnto.parents[5].length, 2)
            assert.equal (fullOnto.parents[5][0], 2)
            assert.equal (fullOnto.parents[5][1], 4)
        })
        it('should create parent->child maps', function() {
            assert.equal (fullOnto.children[7].length, 2)
            assert.equal (fullOnto.children[7][0], 0)
            assert.equal (fullOnto.children[7][1], 1)

            assert.equal (fullOnto.children[0].length, 1)
            assert.equal (fullOnto.children[0][0], 2)

            assert.equal (fullOnto.children[5].length, 0)
        })
        it('should interpret list argument as termParents', function() {
            var autoOnto = new Ontology (json)
            assert (autoOnto.equals (onto))
        })
    })

    describe('#toJSON', function() {
        var fullOntoJson = fullOnto.toJSON()
        var fullOntoCompressedJson = fullOnto.toJSON({'compress':true})
        it('should be idempotent with constructor', function() {
            assert.deepEqual (fullOntoJson.termParents, fullJson)
        })
        it('should be able to generate compressed output', function() {
            assert.deepEqual (fullOntoCompressedJson.termParents, compressedJson)
        })
        it('should be idempotent with constructor for compressed output', function() {
            var compressedOnto = new Ontology (fullOntoCompressedJson)
            var compressedOntoJson = compressedOnto.toJSON()
            assert.deepEqual (compressedOntoJson.termParents, fullJson)
        })
    })

    describe('#terms', function() {
        it('should yield the number of terms', function() {
            assert.equal (fullOnto.terms(), fullJson.length)
        })
    })

    describe('#toposort', function() {
        var sortOnto = fullOnto.toposort()
        var sortOntoJson = sortOnto.toJSON()
        it('should preserve the number of terms', function() {
            assert.equal (sortOnto.terms(), fullOnto.terms())
        })
        it('should topologically sort the ontology graph', function() {
            for (var i = 0; i < sortOnto.terms(); ++i)
                sortOnto.parents[i].forEach (function(p) { assert (p < i) })
        })
        it('should yield Kahn\'s ordering', function() {
            assert.deepEqual (sortOntoJson.termParents, topJson)
        })
        it('should be idempotent', function() {
            var sortSortOnto = sortOnto.toposort()
            var sortSortOntoJson = sortSortOnto.toJSON()
            assert.deepEqual (sortSortOntoJson, sortOntoJson)
        })
    })

    describe('#isCyclic', function() {
        it('should return true for a cyclic ontology', function() {
            var cyclicOnto = new Ontology ({ "termParents": cyclicJson })
            assert (cyclicOnto.isCyclic())
        })
        it('should return false for a DAG', function() {
            assert (!fullOnto.isCyclic())
        })
    })

    describe('#equals', function() {
        it('should return true for same ontology', function() {
            assert (onto.equals(onto))
        })
        it('should return false for different ontologies', function() {
            assert (!onto.equals(subOnto))
        })
    })

    describe('#isToposorted', function() {
        it('should return true for a topologically-sorted ontology', function() {
            assert (topOnto.isToposorted())
        })
        it('should return false for an unsorted ontology', function() {
            assert (!fullOnto.isToposorted())
        })
    })

    describe('#transitiveClosure', function() {
        it('should return the transitive closure of a test ontology', function() {
            assert.deepEqual (onto.transitiveClosure(), closure)
        })
        it('should cache its results', function() {
            assert ('_closure' in onto)
            assert.deepEqual (onto._closure, closure)
        })
    })
})
