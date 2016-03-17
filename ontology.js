(function() {
    var extend = require('util')._extend,
        assert = require('assert')

    function toJSON() {
        var onto = this
        var json = []
        for (var i = 0; i < onto.terms(); ++i) {
            json.push ([onto.termName[i]].concat (onto.parents[i].map (function(j) { return onto.termName[j] })))
        }
        return json
    }

    function toposortTermIndex() {
        // Kahn, Arthur B. (1962), "Topological sorting of large networks", Communications of the ACM 5 (11): 558–562, doi:10.1145/368996.369025
        // https://en.wikipedia.org/wiki/Topological_sorting
        var onto = this
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
        var L = this._toposortTermIndex()
        return typeof(L) === 'undefined'
    }

    function toposort() {
        var onto = this

        var L = onto._toposortTermIndex()
        if (typeof(L) === 'undefined')
            throw new Error ("Ontology graph is not a DAG")
        
        var json = onto.toJSON()
        var toposortedJson = L.map (function(idx) { return json[idx] })

        return new Ontology (toposortedJson)
    }

    function Ontology (termParents) {
        var onto = this
        extend (onto,
                { 'termName': [],
                  'termIndex': {},
                  'parents': [],
                  'children': [],
                  'terms': function() { return this.termName.length },
                  'toJSON': toJSON,
                  '_toposortTermIndex': toposortTermIndex,
                  'isCyclic': isCyclic,
                  'toposort': toposort })
        var extTermParents = []
        termParents.forEach (function (tp) {
            extTermParents.push (tp)
            var term = tp[0]
            onto.termIndex[term] = onto.terms()
            onto.termName.push (term)
        })
        termParents.forEach (function (tp) {
            for (var n = 1; n < tp.length; ++n) {
                if (!(tp[n] in onto.termIndex)) {
                    onto.termIndex[tp[n]] = onto.terms()
                    onto.termName.push (tp[n])
                    extTermParents.push ([tp[n]])
                }
            }
        })
        extTermParents.forEach (function (tp) {
            onto.parents[onto.termIndex[tp[0]]] = tp.slice([1]).map (function(n) { return onto.termIndex[n] })
        })
        onto.children = onto.parents.map (function() { return [] })
        for (var c = 0; c < onto.terms(); ++c)
            onto.parents[c].forEach (function(p) {
                onto.children[p].push (c)
            })
    }

    module.exports = Ontology
}) ()
