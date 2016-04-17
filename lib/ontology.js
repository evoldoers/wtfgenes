(function() {
    var util = require('./util'),
        extend = util.extend,
        assert = require('assert')

    function toJSON (conf) {
        var onto = this
        var json = []
        conf = extend ({ compress: false,
			 includeTermInfo: true },
		       conf)
        var parentLookup = conf.compress
            ? function(j) { return j }
            : function(j) { return onto.termName[j] }
        for (var i = 0; i < onto.terms(); ++i) {
            json.push ([onto.termName[i]].concat (onto.parents[i].map (parentLookup)))
        }
        var result = { "termParents" : json }
	if (conf.includeTermInfo && onto.termInfo)
	    result.termInfo = onto.termInfo
        var doNotAnnotate = util.iota(onto.terms()).filter (util.objPredicate (onto.doNotAnnotate))
        if (doNotAnnotate.length)
            result.doNotAnnotate = doNotAnnotate.map (onto.getTermName.bind(onto))
	return result
    }

    function toposortTermIndex (onto) {
        // Kahn, Arthur B. (1962), "Topological sorting of large networks", Communications of the ACM 5 (11): 558–562, doi:10.1145/368996.369025
        // https://en.wikipedia.org/wiki/Topological_sorting
        var S = [], L = []
        var nParents = [], edges = 0
        for (var c = 0; c < onto.terms(); ++c) {
            nParents[c] = onto.parents[c].length
            edges += nParents[c]
            if (nParents[c] == 0)
                S.push (c)
        }
        while (S.length > 0) {
            var n = S.shift()
            L.push (n)
            onto.children[n].forEach (function(m) {
                --edges
                if (--nParents[m] == 0)
                    S.push (m)
            })
        }
        if (edges > 0)
            return undefined

        return L
    }

    function isCyclic() {
        var L = toposortTermIndex(this)
        return typeof(L) === 'undefined'
    }

    function toposortTermIndexOrDie (onto) {
        var L = toposortTermIndex(onto)
        if (typeof(L) === 'undefined')
            throw new Error ("Ontology graph is not a DAG")
        
        return L
    }

    function toposort() {
        var onto = this

        if (onto.isToposorted())
            return onto
        
        var L = toposortTermIndexOrDie (onto)

        var json = onto.toJSON()
        var toposortedJson = { termParents: util.permuteList (json.termParents, L) }
	if (json.termInfo)
	    toposortedJson.termInfo = util.permuteList (json.termInfo, L)
	
        return new Ontology (toposortedJson)
    }

    function isToposorted() {
        for (var i = 0; i < this.terms(); ++i)
            if (this.parents[i].some (function(p) { return p >= i }))
                return false;
        return true;
    }

    function toposortTermOrder() {
	var onto = this
	var L = toposortTermIndexOrDie (onto)
	var order = onto.termName.map (function() { return null })
	L.forEach (function (term, index) { order[term] = index })
	return order
    }

    function buildChildren (onto) {
        onto.children = onto.parents.map (function() { return [] })
        for (var c = 0; c < onto.terms(); ++c)
            onto.parents[c].forEach (function(p) {
                onto.children[p].push (c)
            })
    }

    function equals (onto) {
        return JSON.stringify (this.toJSON({'compress':true})) == JSON.stringify (onto.toJSON({'compress':true}));
    }

    function transitiveClosure() {
        var onto = this
        if (!('_closure' in onto)) {
            var clos = []
            var L = toposortTermIndexOrDie (onto)
            L.forEach (function(n) {
                var closIndex = {}
                onto.parents[n].forEach (function(p) {
                    clos[p].forEach (function(c) {
                        closIndex[c] = 1
                    })
                })
                closIndex[n] = 1
                clos[n] = Object.keys(closIndex)
                    .sort (util.numCmp)
            })
            onto._closure = clos
        }
        return onto._closure
    }

    function getTermInfo (name) {
	var onto = this
	if (name in onto.termIndex && onto.termInfo)
	    return onto.termInfo[onto.termIndex[name]]
	return undefined
    }

    function subgraphRootedAt (rootTermList) {
        var onto = this
        var inSubgraph = {}
        var inSubFunc = util.objPredicate(inSubgraph)
        rootTermList.forEach (function (tn) {
            if (tn in onto.termIndex)
                inSubgraph[onto.termIndex[tn]] = true
        })
        onto.toposortTermIndex().forEach (function (ti) {
            var parents = onto.parents[ti]
            inSubgraph[ti] = inSubgraph[ti] || (parents.length ? parents.every(inSubFunc) : false)
        })
        return onto.subgraph (inSubFunc)
    }

    function subgraphWithAncestors (termList) {
        var onto = this
        var inSubgraph = {}
        var closure = onto.transitiveClosure()
        termList.forEach (function (tn) {
            if (tn in onto.termIndex)
                closure[onto.termIndex[tn]].forEach (function(c) {
                    inSubgraph[c] = true
                })
        })
        return onto.subgraph (util.objPredicate (inSubgraph))
    }

    function subgraph (termIndexPredicate) {
        var onto = this
        var termParents = [],
            termInfo = onto.termInfo ? [] : undefined
        onto.termName.forEach (function (tn, ti) {
            if (termIndexPredicate(ti)) {
                termParents.push ([tn].concat (onto.parents[ti].filter(termIndexPredicate).map (onto.getTermName.bind(onto))))
                if (termInfo)
                    termInfo.push (onto.termInfo[ti])
            }
        })
                          
        return new Ontology ({ termParents: termParents, termInfo: termInfo })
    }
    
    function Ontology (conf) {
        var onto = this
        extend (onto,
                { 'termName': [],  // this is actually the term ID. ahem
                  'termIndex': {},  // mapping from term ID to term index
		  'termInfo': null,  // the array of term names (in the OBO sense) goes here, if available
                  'doNotAnnotate': {},
                  'parents': [],
                  'children': [],
                  'terms': function() { return this.termName.length },
                  'toJSON': toJSON,
                  'isCyclic': isCyclic,
                  'isToposorted': isToposorted,
                  'toposort': toposort,
		  'toposortTermOrder': toposortTermOrder,
                  'toposortTermIndex': function() { return toposortTermIndexOrDie(this) },
                  'equals': equals,
                  'transitiveClosure': transitiveClosure,
		  'getTermInfo': getTermInfo,
                  'getTermName': function(ti) { return this.termName[ti] },
                  'subgraphRootedAt': subgraphRootedAt,
                  'subgraphWithAncestors': subgraphWithAncestors,
                  'subgraph': subgraph
                })

        if (Object.prototype.toString.call(conf) === '[object Array]')
            conf = { 'termParents': conf }
        
        if ('termParents' in conf) {
            var extTermParents = []
            conf.termParents.forEach (function (tp) {
                extTermParents.push (tp)
                var term = tp[0]
                onto.termIndex[term] = onto.terms()
                onto.termName.push (term)
            })
            conf.termParents.forEach (function (tp) {
                for (var n = 1; n < tp.length; ++n) {
                    if (typeof(tp[n]) === 'string' && !(tp[n] in onto.termIndex)) {
                        onto.termIndex[tp[n]] = onto.terms()
                        onto.termName.push (tp[n])
                        extTermParents.push ([tp[n]])
                    }
                }
            })
 
            extTermParents.forEach (function (tp,term) {
                onto.parents[term] = tp.slice([1])
                    .map (function(n) {
                        return typeof(n) === 'number' ? n : onto.termIndex[n]
                    })
            })
        } else
            throw new Error ("Can't parse Ontology config")

	if ('termInfo' in conf)
	    onto.termInfo = conf.termInfo

        if ('doNotAnnotate' in conf)
            conf.doNotAnnotate.forEach (function (tn) {
                if (tn in onto.termIndex)
                    onto.doNotAnnotate[onto.termIndex[tn]] = true
            })
        
        buildChildren (onto)
    }

    module.exports = Ontology
}) ()
