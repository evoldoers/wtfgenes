(function() {
    var assert = require('assert'),
    BernouilliParams = require('./bernouilli'),
    util = require('./util'),
    extend = util.extend

    function getTermState(t) { return this._termState[t] }

    function setTermState(t,val) {
	var explan = this
	if (explan._termState[t] != val) {
	    var delta = val ? +1 : -1
	    explan.assocs.genesByTerm[t].forEach (function(g) {
		explan._nActiveTermsByGene[g] += delta
	    })
	    if (val)
		explan._isActiveTerm[t] = 1
	    else
		delete explan._isActiveTerm[t]
	    explan._termState[t] = val
	}
    }

    function countTerm(explan,counts,inc,t,state) {
        var countObj = state ? counts.succ : counts.fail
        var countParam = explan.param.termPrior[t]
        countObj[countParam] = inc + (countObj[countParam] || 0)
    }
    
    function countObs(explan,counts,inc,isActive,g) {
        var inGeneSet = explan._inGeneSet[g]
	// isActive inGeneSet param
	// 0        0         !falsePos
	// 0        1         falsePos
	// 1        0         falseNeg
	// 1        1         !falseNeg
        var isFalse = isActive ? !inGeneSet : inGeneSet
        var countObj = isFalse ? counts.succ : counts.fail
        var countParam = (isActive ? explan.param.geneFalseNeg : explan.param.geneFalsePos)[g]
        countObj[countParam] = inc + (countObj[countParam] || 0)
    }
    
    function getCounts() {
	var explan = this
	var counts = explan.params.newCounts()
	var param = explan.param
	explan.relevantTerms.forEach (function (t) {
            countTerm (explan, counts, +1, t, explan._termState[t])
	})
	explan._nActiveTermsByGene.forEach (function (active, g) {
            countObs (explan, counts, +1, active > 0, g)
	})
	return counts
    }

    function getCountDelta(t,val) {
	var explan = this
	var param = explan.param
	var cd = param.newCounts()
	if (explan._termState[t] != val) {
            countTerm (explan, cd, -1, t, explan._termState[t])
            countTerm (explan, cd, +1, t, val)
	    var delta = val ? +1 : -1
	    explan.assocs.genesByTerm[t].forEach (function(g) {
		var activeTerms = explan._nActiveTermsByGene[g]
		var oldActive = activeTerms > 0
		var newActive = (activeTerms + delta) > 0
		if (oldActive != newActive) {
                    countObs (explan, cd, -1, oldActive, g)
                    countObs (explan, cd, +1, newActive, g)
		}
	    })
	}
	return cd
    }

    function Explanation (conf) {
        var explan = this
	var isActive = {}
	conf = extend ( { 'termPrior': function(term) { return "t" },
			  'geneFalsePos': function(gene) { return "fp" },
			  'geneFalseNeg': function(gene) { return "fn" },
			  'termState': function(term) { return isActive[term] ? 1 : 0 }
			},
			conf)
	var assocs = conf.assocs
	var termName = assocs.ontology.termName
	var geneName = assocs.geneName

        var geneSet = conf.geneSet.map (function(g) {
            return assocs.geneIndex[g]
        })

	if ('terms' in conf)
	    conf.terms.forEach (function(term) { isActive[term] = true })
	var termState = termName.map (conf.termState)

        // "relevant" terms are ones which have at least one associated gene in the geneSet
        var relevantTerms = util.removeDups (geneSet.reduce (function(termList,g) {
	    return termList.concat (assocs.termsByGene[g])
	}, [])).map(util.parseDecInt).sort(util.numCmp)
        var isRelevant = util.listToCounts (relevantTerms)

        extend (explan,
                { assocs: assocs,
		  geneSet: geneSet,
		  termName: termName,
		  geneName: geneName,

		  _inGeneSet: geneName.map (function() { return false }),
		  _termState: termState,
		  _isActiveTerm: {},

		  _nActiveTermsByGene: assocs.termsByGene.map (function(terms) {
		      return terms.reduce (function(accum,t) {
			  return accum + (termState[t] ? 1 : 0)
		      }, 0)
		  }),

                  isRelevant: isRelevant,
		  relevantTerms: relevantTerms,
                  relevantParents: assocs.ontology.parents.map (function(p) {
                      return p.filter (function(t) { return isRelevant[t] })
                  }),
                  
		  getTermState: getTermState,
		  setTermState: setTermState,

		  getCounts: getCounts,
		  getCountDelta: getCountDelta,

		  param: {
		      termPrior: termName.map (conf.termPrior),
		      geneFalsePos: geneName.map (conf.geneFalsePos),
		      geneFalseNeg: geneName.map (conf.geneFalseNeg)
		  },

		  params: null,
                  genes: function() { return this.assocs.genes() },
                  terms: function() { return this.assocs.terms() },

		  toJSON: function() {
		      var explan = this
		      return Object.keys(explan._isActiveTerm)
			  .map (util.parseDecInt)
			  .sort (util.numCmp)
			  .map (function(t) { return explan.termName[t] })
		  }
                })

	termState.forEach (function(s,t) { if (s) explan._isActiveTerm[t] = 1 })
	geneSet.forEach (function(g) { explan._inGeneSet[g] = true })

	var param = {}
	function initParam(p) { param[p] = .5 }
	explan.param.termPrior.map (initParam)
	explan.param.geneFalsePos.map (initParam)
	explan.param.geneFalseNeg.map (initParam)
	explan.params = conf.params || new BernouilliParams (param)
    }

    module.exports = Explanation
}) ()
