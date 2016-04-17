(function() {
    var util = require('./util'),
	extend = util.extend,
	jStat = require('jstat').jStat,
	assert = require('assert')

    function toJSON(conf) {
        var assocs = this
        conf = conf || {}
        if (conf.shortForm) {
            var gt = []
            for (var g = 0; g < assocs.genes(); ++g)
                assocs.termsByGene[g].forEach (function(t) {
                    gt.push ([assocs.geneName[g], assocs.ontology.termName[t]])
                })
            return gt
        }
        var seen = {}
        var idAliasTerm = assocs.geneName.map (function(gn,gi) {
            seen[gn.toUpperCase()] = 1
            return [gn,[],assocs.termsByGene[gi].map (assocs.ontology.getTermName.bind(assocs.ontology))]
        })
        Object.keys(assocs.geneIndex).sort().forEach (function(gn) {
            var uc = gn.toUpperCase()
            if (!seen[uc]) {
                seen[uc] = true
                var gi = assocs.geneIndex[gn]
                if (gn != assocs.geneName[gi])
                    idAliasTerm[gi][1].push(gn)
            }
        })
        return { idAliasTerm: idAliasTerm }
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

    function validateGeneNames (geneNames) {
        var assocs = this
        var missing = {}
        var geneIndices = []
        var suppliedGeneName = assocs.geneName.slice(0)
	var regex = /^\s*(.+?)\s*$/
	geneNames.map (function (name) {
	    var match = regex.exec(name)
	    if (match != null) {
		var g = match[1]
		if (g in assocs.geneIndex) {
                    var gi = assocs.geneIndex[g]
		    geneIndices.push (gi)
                    suppliedGeneName[gi] = g
		} else if (g.toUpperCase() in assocs.geneIndex) {
                    var gi = assocs.geneIndex[g.toUpperCase()]
		    geneIndices.push (gi)
                    suppliedGeneName[gi] = g
		} else
		    missing[g] = (missing[g] || 0) + 1
	    }
        })
	var missingGeneNames = Object.keys(missing)
        return { geneNames: geneNames,
		 resolvedGeneIndices: util.removeDups(geneIndices),
                 missingGeneNames: missingGeneNames,
                 suppliedGeneName: suppliedGeneName }
    }
    
    function Assocs (conf) {
        var assocs = this
        conf = extend ({closure:true}, conf)
	var ontology = conf.ontology
        if (conf.assocs) {
	    var geneTermList = conf.assocs
            conf.idAliasTerm = geneTermList.map (function(gt) {
                return [gt[0], [], [gt[1]]]
            })
        }
        var idAliasTerm = conf.idAliasTerm
        extend (assocs,
                { 'ontology': ontology,
                  'geneName': [],
                  'geneIndex': {},

                  'genesByTerm': [],
                  'termsByGene': [],
		  'geneHasTerm': {},

                  'genes': function() { return this.geneName.length },
                  'terms': function() { return this.ontology.terms() },

		  'relevantTerms': function() {
		      var assocs = this
		      return util.iota(assocs.terms()).filter (function(term) {
			  return assocs.genesByTerm[term].length > 0
                              && assocs.termIsExemplar(term)
                              && !ontology.doNotAnnotate[term]
		      })
		  },
		  'relevantTermsForGeneSet': function (geneSet) {
		      var assocs = this
		      return util.removeDups (geneSet.reduce (function(termList,g) {
			  return termList.concat (assocs.termsByGene[g])
		      }, [])).filter (function (term) {
			  return assocs.termIsExemplar(term)
                              && !ontology.doNotAnnotate[term]
		      }).sort(util.numCmp)
		  },

                  'equivClassByTerm': [],
                  'termsInEquivClass': [],
		  'getExemplar': function(termIndex) {
                      return this.termsInEquivClass[this.equivClassByTerm[termIndex]][0]
		  },
                  'termIsExemplar': function(termIndex) {
                      return this.getExemplar(termIndex) == termIndex
                  },
                  'termEquivalents': function() {
                      var assocs = this
                      return util.keyValListToObj (assocs.termsInEquivClass.filter (function(l) {
                          return l.length > 1
                      }).map (function(l) {
                          var n = l.map (function(ti) { return assocs.ontology.termName[ti] })
                          return [n[0], n.slice(1)]
                      }))
                  },
                  
		  'nAssocs': 0,
		  'hypergeometricPValues': hypergeometricPValues,
                  'validateGeneNames': validateGeneNames,
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
        idAliasTerm.forEach (function(iat) {
            var gene = iat[0]
            var aliases = iat[1]
            var terms = iat[2]

            if (!(gene in assocs.geneIndex)) {
                var gi = assocs.genes()
                assocs.geneName.push (gene)
                gtCount.push ({})
                assocs.geneIndex[gene] = gi
                assocs.geneIndex[gene.toUpperCase()] = gi
                assocs.geneIndex[gene.toLowerCase()] = gi
                aliases.forEach (function (alias) {
                    assocs.geneIndex[alias] = gi
                    assocs.geneIndex[alias.toUpperCase()] = gi
                    assocs.geneIndex[alias.toLowerCase()] = gi
                })
            }

            terms.forEach (function (term) {
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
        })

	var missingTerms = Object.keys(missing)
	if (missingTerms.length > 0 && !conf.ignoreMissingTerms)
	    console.warn ("Warning: the following terms were not found in the ontology: " + missingTerms)

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

        var termClass = {}
        var reverseToposort = ontology.toposortTermIndex().slice(0).reverse()
        assocs.equivClassByTerm = ontology.termName.map (function() { return null })
        reverseToposort.forEach (function (term) {
            var genesStr = "#" + assocs.genesByTerm[term].join(",")
            if (!(genesStr in termClass)) {
                termClass[genesStr] = assocs.termsInEquivClass.length
                assocs.termsInEquivClass.push ([])
            }
            var c = termClass[genesStr]
            assocs.equivClassByTerm[term] = c
            assocs.termsInEquivClass[c].push (term)
        })
    }

    module.exports = Assocs
}) ()
