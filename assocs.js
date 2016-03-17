(function() {
    var extend = require('util')._extend,
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

    function sortAscending (list) {
        return list.sort (function(a,b) { return a-b })
    }
    
    function Assocs (ontology, geneTermList, conf) {
        var assocs = this
        conf = extend ({closure:false}, conf)
        extend (assocs,
                { 'ontology': ontology,
                  'geneName': [],
                  'geneIndex': {},
                  'genesByTerm': [],
                  'termsByGene': [],
                  'genes': function() { return this.geneName.length },
                  'terms': function() { return this.ontology.terms() },
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

        var gtCount = []
        geneTermList.forEach (function(gt) {
            var gene = gt[0], term = gt[1]
            if (!(gene in assocs.geneIndex)) {
                assocs.geneIndex[gene] = assocs.genes()
                assocs.geneName.push (gene)
                gtCount.push ({})
            }
            if (!(term in ontology.termIndex))
                throw new Error ("Term " + term + " not found in the ontology")

            var g = assocs.geneIndex[gene]
            var t = ontology.termIndex[term]
            closure[t].forEach (function(c) {
                ++gtCount[g][c]
            })
        })

        assocs.genesByTerm = assocs.ontology.termName.map (function() { return [] })
        assocs.termsByGene = assocs.geneName.map (function() { return [] })

        for (var g = 0; g < assocs.genes(); ++g) {
            Object.keys(gtCount[g]).forEach (function(tStr) {
                var t = parseInt (tStr)
                assocs.termsByGene[g].push (t)
                assocs.genesByTerm[t].push (g)
            })
        }

        assocs.termsByGene = assocs.termsByGene.map (sortAscending)
        assocs.genesByTerm = assocs.genesByTerm.map (sortAscending)
    }

    module.exports = Assocs
}) ()
