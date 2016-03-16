#!/usr/bin/env node

var Ontology = require('../ontology'),
    assert = require('assert')

describe('Ontology', function() {

    var json = [
        ["arachnid", "animal"],
        ["mammal", "animal"],
        ["spider", "arachnid"],
        ["primate", "mammal"],
        ["man", "primate"],
        ["spiderman", "spider", "man"],
        ["kingkong", "primate"]
    ]

    var onto = new Ontology (json)
    var ontoJson = onto.toJSON()
    
    var jsonFull = json.slice()
    jsonFull.push (["animal"])

    var ontoFull = new Ontology (jsonFull)
    var ontoJsonFull = ontoFull.toJSON()

    describe('#constructor', function() {
        it('should detect implicit terms', function() {
            assert (onto.terms() == 8)
            assert (onto.termName[7] == 'animal')
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
