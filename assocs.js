(function() {
    var util = require('./util'),
	extend = util.extend,
	assert = require('assert')

    function toJSON() {
        var assocs = this
        var gt = []
        for (var g = 0; g < assocs.genes(); ++g)
            assocs.termsByGene[g].forEach (function(t) {
                gt.push ([assocs.geneName[g], assocs.ontology.termName[t]])
            })
        return gt
    }

    function hypergeometricPValues (geneSet) {
	var assocs = this
	var ontology = assocs.ontology
	return assocs.genesByTerm.map (function (genesForTerm, term) {
	    var genesForTermInSet = geneSet.filter (function (gene) {
		return assocs.geneHasTerm[gene][term]
	    })
	    var n = assocs.genes(),
		nPresent = genesForTerm.length,
		nAbsent = n - nPresent,
		nInSet = geneSet.length,
		logDenominator = util.logBinomialCoefficient(n,nInSet),
		p = 0
	    for (var nPresentInSet = genesForTermInSet.length;
		 nPresentInSet <= nInSet && nPresentInSet <= nPresent;
		 ++nPresentInSet) {
		var nAbsentInSet = nInSet - nPresentInSet
		p += Math.exp (util.logBinomialCoefficient(nPresent,nPresentInSet)
			       + util.logBinomialCoefficient(nAbsent,nAbsentInSet)
			       - logDenominator)
	    }
	    return p
	})
    }
    
    function Assocs (conf) {
        var assocs = this
        conf = extend ({closure:true}, conf)
	var ontology = conf.ontology
	var geneTermList = conf.assocs
        extend (assocs,
                { 'ontology': ontology,
                  'geneName': [],
                  'geneIndex': {},
                  'genesByTerm': [],
                  'termsByGene': [],
		  'geneHasTerm': {},
                  'genes': function() { return this.geneName.length },
                  'terms': function() { return this.ontology.terms() },
		  'nAssocs': 0,
		  'hypergeometricPValues': hypergeometricPValues,
                  'toJSON': toJSON
                })

        var closure
        if (conf.closure)
            closure = ontology.transitiveClosure()
        else {
            closure = []
            for (var t = 0; t < ontology.terms(); ++t)
                closure.push ([t])
        }

        var gtCount = [], missing = {}
        geneTermList.forEach (function(gt) {
            var gene = gt[0], term = gt[1]
            if (!(gene in assocs.geneIndex)) {
                assocs.geneIndex[gene] = assocs.genes()
                assocs.geneName.push (gene)
                gtCount.push ({})
            }
            if (!(term in ontology.termIndex))
		missing[term] = (missing[term] || 0) + 1
	    else {
		var g = assocs.geneIndex[gene]
		var t = ontology.termIndex[term]
		closure[t].forEach (function(c) {
                    ++gtCount[g][c]
		})
	    }
        })

	var missingTerms = Object.keys(missing)
	if (missingTerms.length > 0) {
	    if (conf.ignoreMissingTerms)
		console.log ("Warning: the following terms were not found in the ontology: " + missingTerms)
	    else
                throw new Error ("Terms not found in the ontology: " + missingTerms)
	}

        assocs.genesByTerm = assocs.ontology.termName.map (function() { return [] })
        assocs.termsByGene = assocs.geneName.map (function() { return [] })
        assocs.geneHasTerm = assocs.geneName.map (function() { return {} })

        for (var g = 0; g < assocs.genes(); ++g) {
            Object.keys(gtCount[g]).forEach (function(tStr) {
                var t = parseInt (tStr)
                assocs.termsByGene[g].push (t)
                assocs.genesByTerm[t].push (g)
		assocs.geneHasTerm[g][t] = 1
		++assocs.nAssocs
            })
        }

        assocs.termsByGene = assocs.termsByGene.map (util.sortAscending)
        assocs.genesByTerm = assocs.genesByTerm.map (util.sortAscending)
    }

    module.exports = Assocs
}) ()
