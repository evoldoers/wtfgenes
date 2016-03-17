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
        ["primate",1],
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

    var onto = new Ontology ({ "termParents": json })
    var fullOnto = new Ontology ({ "termParents": fullJson })
    var topOnto = new Ontology ({ "termParents": topJson })
    var subOnto = new Ontology ({ "termParents": subJson })

    describe('#constructor', function() {
        it('should parse explicitly declared terms', function() {
            assert (fullOnto.termName.length == 8)
        })
        it('should detect implicit terms', function() {
            assert (onto.termName.length == 8)
            assert (onto.termName[7] == 'animal')
            assert (onto.parents[7].length == 0)
        })
        it('should map term names to term indices', function() {
            assert (fullOnto.termIndex['arachnid'] == 0)
            assert (fullOnto.termIndex['spider'] == 2)
            assert (fullOnto.termIndex['man'] == 4)
            assert (fullOnto.termIndex['spiderman'] == 5)
            assert (fullOnto.termIndex['animal'] == 7)
        })
        it('should map parent names to term indices', function() {
            assert (fullOnto.parents[0].length == 1)
            assert (fullOnto.parents[0][0] == 7)

            assert (fullOnto.parents[5].length == 2)
            assert (fullOnto.parents[5][0] == 2)
            assert (fullOnto.parents[5][1] == 4)
        })
        it('should create parent->child maps', function() {
            assert (fullOnto.children[7].length == 2)
            assert (fullOnto.children[7][0] == 0)
            assert (fullOnto.children[7][1] == 1)

            assert (fullOnto.children[0].length == 1)
            assert (fullOnto.children[0][0] == 2)

            assert (fullOnto.children[5].length == 0)
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
            assert (JSON.stringify(fullOntoJson.termParents) == JSON.stringify(fullJson))
        })
        it('should be able to generate compressed output', function() {
            assert (JSON.stringify(fullOntoCompressedJson.termParents) == JSON.stringify(compressedJson))
        })
        it('should be idempotent with constructor for compressed output', function() {
            var compressedOnto = new Ontology (fullOntoCompressedJson)
            var compressedOntoJson = compressedOnto.toJSON()
            assert (JSON.stringify(compressedOntoJson.termParents) == JSON.stringify(fullJson))
        })
    })

    describe('#terms', function() {
        it('should yield the number of terms', function() {
            assert (fullOnto.terms() == fullJson.length)
        })
    })

    describe('#toposort', function() {
        var sortOnto = fullOnto.toposort()
        var sortOntoJson = sortOnto.toJSON()
        it('should preserve the number of terms', function() {
            assert (sortOnto.terms() == fullOnto.terms())
        })
        it('should topologically sort the ontology graph', function() {
            for (var i = 0; i < sortOnto.terms(); ++i)
                sortOnto.parents[i].forEach (function(p) { assert (p < i) })
        })
        it('should yield Kahn\'s ordering', function() {
            assert (JSON.stringify(sortOntoJson.termParents) == JSON.stringify(topJson))
        })
        it('should be idempotent', function() {
            var sortSortOnto = sortOnto.toposort()
            var sortSortOntoJson = sortSortOnto.toJSON()
            assert (JSON.stringify(sortSortOntoJson) == JSON.stringify(sortOntoJson))
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
})
