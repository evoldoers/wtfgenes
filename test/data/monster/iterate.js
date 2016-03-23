
var Ontology = require('../../../ontology'),
    Assocs = require('../../../assocs'),
    Model = require('../../../model'),
    util = require('../../../util'),
    assert = require('assert')

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

var ontology = new Ontology (ontoJson)
var assocs = new Assocs ({ ontology: ontology, assocs: gt })

var prior = {
    succ: { t: 1, fp: 1, fn: 1 },
    fail: {
	t: ontology.terms(),
	fp: assocs.genes(),
	fn: assocs.genes()
    }
}

var model = new Model ({ assocs: assocs,
			 geneSet: mutants,
			 prior: prior })

var state = [], stateLogLike = []
for (var flags = 0; flags < 256; ++flags) {
    model.setTermState (0, (flags & 1) ? true : false)
    model.setTermState (1, (flags & 2) ? true : false)
    for (var t = 3; t < 9; ++t)
	model.setTermState (t, (flags & (1 << (t-1)) ? true : false))
    var counts = model.getCounts()
    var ll = counts.logBetaBernouilliLikelihood (prior)
    state.push (model.toJSON())
    stateLogLike.push (ll)
}

util.sortIndices(stateLogLike).forEach (function(i) {
    console.log (stateLogLike[i] + " " + state[i])
})
