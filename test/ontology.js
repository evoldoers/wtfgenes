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

    var onto = new Ontology (json)
    var fullOnto = new Ontology (fullJson)

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
    })

    describe('#toJSON', function() {
        var fullOntoJson = fullOnto.toJSON()
        it('should be idempotent when composed with constructor', function() {
            assert (JSON.stringify(fullOntoJson) == JSON.stringify(fullJson))
        })
    })

    describe('#terms', function() {
        it('should yield the number of terms', function() {
            assert (fullOnto.terms() == fullJson.length)
        })
    })

    describe('#toposort', function() {
        var topOnto = fullOnto.toposort()
        it('should preserve the number of terms', function() {
            assert (topOnto.terms() == fullOnto.terms())
        })
        it('should topologically sort the ontology graph', function() {
            for (var i = 0; i < topOnto.terms(); ++i)
                topOnto.parents[i].forEach (function(p) { assert (p < i) })
        })
        it('should yield Kahn\'s ordering', function() {
            var topOntoJson = topOnto.toJSON()
            assert (JSON.stringify(topOntoJson) == JSON.stringify(topJson))
        })
    })

    describe('#isCyclic', function() {
        it('should return true for a cyclic ontology', function() {
            var cyclicOnto = new Ontology (cyclicJson)
            assert (cyclicOnto.isCyclic())
        })
        it('should return false for a DAG', function() {
            assert (!fullOnto.isCyclic())
        })
    })
})
