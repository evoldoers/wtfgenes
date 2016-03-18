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
	}
	explan._termState[t] = val
    }

    function getCounts() {
	var explan = this
	var counts = explan.params.newCounts()
	var param = explan.param
	explan._termState.forEach (function (state, t) {
	    ++(state ? counts.pos : counts.neg)[explan.param.termPrior[t]]
	})
	explan._nActiveTermsByGene.forEach (function (active, g) {
	    var isActive = active > 0
	    var inGeneSet = explan._inGeneSet[g]
	    var isFalse = isActive ? !inGeneSet : inGeneSet
	    // isActive inGeneSet param
	    // 0        0         !falsePos
	    // 0        1         falsePos
	    // 1        0         falseNeg
	    // 1        1         !falseNeg
	    ++(isFalse ? counts.pos : counts.neg)[(isActive ? param.falsePos : param.falseNeg)[g]]
	})
	return counts
    }

    function getCountDelta(t,val) {
	var explan = this
	var param = explan.param
	var cd = {}
	if (explan._termState[t] != val) {
	    var delta = val ? +1 : -1
	    explan.assocs.genesByTerm[t].forEach (function(g) {
		var activeTerms = explan._nActiveTermsByGene[g]
		var oldActive = activeTerms > 0
		var newActive = (activeTerms + delta) > 0
		if (oldActive != newActive) {
		    var inGeneSet = explan._inGeneSet[g]
		    var oldFalse = oldActive ? !inGeneSet : inGeneSet
		    var newFalse = !oldFalse
		    ++(newFalse ? cd.pos : cd.neg)[(newActive ? param.falsePos : param.falseNeg)[g]]
		    --(oldFalse ? cd.pos : cd.neg)[(oldActive ? param.falsePos : param.falseNeg)[g]]
		}
	    })
	}
	return cd
    }

    function Explanation (conf) {
        var explan = this
	var isActive = {}
	conf = extend ( { 'termPrior': function(term) { return "p" },
			  'geneFalsePos': function(gene) { return "a" },
			  'geneFalseNeg': function(gene) { return "b" },
			  'termState': function(term) { return isActive[term] }
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
