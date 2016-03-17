// for use with mocha test framework

var Ontology = require('../ontology'),
    Assocs = require('../assocs'),
    assert = require('assert')

describe('Assocs', function() {

    var ontoJson = [
        ["arachnid", "animal"],
        ["mammal", "animal"],
        ["spider", "arachnid"],
        ["primate", "mammal"],
        ["human", "primate"],
        ["spiderhuman", "arachnid", "human", "mutant"],
        ["gorilla", "primate"],
        ["animal"],
        ["mutant"]
    ]

    var onto = new Ontology (ontoJson)

    var gt = [["peter-parker", "spiderhuman"],
              ["may-parker", "spiderhuman"],
              ["socrates", "human"],
              ["charlotte", "spider"],
              ["kingkong", "gorilla"],
              ["kingkong", "mutant"]]

    var gtTrans = [["peter-parker", "arachnid"],
                   ["peter-parker", "mammal"],
                   ["peter-parker", "primate"],
                   ["peter-parker", "human"],
                   ["peter-parker", "spiderhuman"],
                   ["peter-parker", "animal"],
                   ["peter-parker", "mutant"],
                   ["may-parker", "arachnid"],
                   ["may-parker", "mammal"],
                   ["may-parker", "primate"],
                   ["may-parker", "human"],
                   ["may-parker", "spiderhuman"],
                   ["may-parker", "animal"],
                   ["may-parker", "mutant"],
                   ["socrates", "mammal"],
                   ["socrates", "primate"],
                   ["socrates", "human"],
                   ["socrates", "animal"],
                   ["charlotte", "arachnid"],
                   ["charlotte", "spider"],
                   ["charlotte", "animal"],
                   ["kingkong", "mammal"],
                   ["kingkong", "primate"],
                   ["kingkong", "gorilla"],
                   ["kingkong", "animal"],
                   ["kingkong", "mutant"]]

    var assocs = new Assocs (onto, gt)
    var transAssocs = new Assocs (onto, gt, {closure:true})
    
    describe('#constructor', function() {
        it('should parse genes', function() {
            assert.equal (assocs.genes(), 5)
        })
    })

    describe('#toJSON', function() {
        var assocsJson = assocs.toJSON()
        it('should be idempotent with constructor', function() {
            assert.deepEqual (assocsJson, gt)
        })
    })

    describe('#constructor', function() {
        var transAssocsJson = transAssocs.toJSON()
        it('should form transitive associations if mandated', function() {
            assert.deepEqual (transAssocsJson, gtTrans)
        })
    })

})
