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

        var gtIndexList = []
        geneTermList.forEach (function(gt) {
            var gene = gt[0], term = gt[1]
            if (!(gene in assocs.geneIndex)) {
                assocs.geneIndex[gene] = assocs.genes()
                assocs.geneName.push (gene)
            }
            if (!(term in ontology.termIndex))
                throw new Error ("Term " + term + " not found in the ontology")
        })

        assocs.genesByTerm = assocs.ontology.termName.map (function() { return [] })
        assocs.termsByGene = assocs.geneName.map (function() { return [] })

        var closure
        if (conf.closure)
            closure = ontology.transitiveClosure()
        else {
            closure = []
            for (var t = 0; t < ontology.terms(); ++t)
                closure.push ([t])
        }

        geneTermList.forEach (function(gt) {
            var gene = assocs.geneIndex[gt[0]], term = ontology.termIndex[gt[1]]
            closure[term].forEach (function(t) {
                assocs.termsByGene[gene].push (t)
                assocs.genesByTerm[t].push (gene)
            })
        })
    }

    module.exports = Assocs
}) ()
