// for use with mocha test framework

var Ontology = require('../ontology'),
    Assocs = require('../assocs'),
    assert = require('assert')

describe('Assocs', function() {

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

    var onto = new Ontology (ontoJson)

    var gt = [["peter-parker", "spiderhuman"],
              ["may-parker", "spiderhuman"],
              ["socrates", "human"],
              ["charlotte", "spider"],
              ["kingkong", "gorilla"],
              ["kingkong", "mutant"]]

    var geneName = ["peter-parker",  // 0
                    "may-parker",  // 1
                    "socrates",  // 2
                    "charlotte",  // 3
                    "kingkong"];  // 4
    
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

    var gtDup = gt.concat ([["charlotte","spider"]])
    
    var assocs = new Assocs (onto, gt)
    var transAssocs = new Assocs (onto, gt, {closure:true})
    var dupAssocs = new Assocs (onto, gtDup)
    
    describe('#constructor', function() {
        it('should parse the right number of genes', function() {
            assert.equal (assocs.genes(), 5)
        })
        it('should make a list of gene names', function() {
            assert.deepEqual (assocs.geneName, geneName)
        })
        it('should map terms to genes', function() {
            assert.deepEqual (assocs.genesByTerm[5], [0,1])
            assert.deepEqual (assocs.genesByTerm[6], [4])
        })
        it('should map genes to terms', function() {
            assert.deepEqual (assocs.termsByGene[0], [5])
            assert.deepEqual (assocs.termsByGene[4], [6,8])
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
        var dupAssocsJson = dupAssocs.toJSON()
        it('should ignore duplicate associations', function() {
            assert.deepEqual (dupAssocsJson, gt)
        })
    })

})
