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

    var onto = new Ontology (json)
    var ontoJson = onto.toJSON()
    
    var jsonFull = json.slice()
    jsonFull.push (["animal"])  // 7

    var ontoFull = new Ontology (jsonFull)
    var ontoJsonFull = ontoFull.toJSON()

    describe('#constructor', function() {
        it('should parse explicitly declared terms', function() {
            assert (ontoFull.termName.length == 8)
        })
        it('should detect implicit terms', function() {
            assert (onto.termName.length == 8)
            assert (onto.termName[7] == 'animal')
            assert (onto.parents[7].length == 0)
        })
        it('should map term names to term indices', function() {
            assert (ontoFull.termIndex['arachnid'] == 0)
            assert (ontoFull.termIndex['spider'] == 2)
            assert (ontoFull.termIndex['man'] == 4)
            assert (ontoFull.termIndex['spiderman'] == 5)
            assert (ontoFull.termIndex['animal'] == 7)
        })
        it('should map parent names to term indices', function() {
            assert (ontoFull.parents[0].length == 1)
            assert (ontoFull.parents[0][0] == 7)

            assert (ontoFull.parents[5].length == 2)
            assert (ontoFull.parents[5][0] == 2)
            assert (ontoFull.parents[5][1] == 4)
        })
    })

    describe('#toJSON', function() {
        it('should be idempotent when composed with constructor', function() {
            assert (JSON.stringify(jsonFull) == JSON.stringify(ontoJsonFull))
        })
    })

    describe('#terms', function() {
        it('should yield the number of terms', function() {
            assert (ontoFull.terms() == jsonFull.length)
        })
    })
})
