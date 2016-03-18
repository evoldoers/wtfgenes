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
    
    describe('#constructor', function() {
        it('should identify relevant terms', function() {
            assert.deepEqual (mutantEx.relevantTerms, [0,1,3,4,5,6,7,8])
            assert.deepEqual (normalEx.relevantTerms, [0,1,2,3,4,7])
        })

        // WRITE ME
    })

})
