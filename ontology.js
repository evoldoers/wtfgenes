(function() {
    var extend = require('util')._extend

    function toJSON() {
        var onto = this
        var json = []
        for (var i = 0; i < onto.terms(); ++i) {
            json.push ([onto.termName[i]].concat (onto.parents[i].map (function(j) { return onto.termName[j] })))
        }
        return json
    }

    function toposort() {
        // Kahn, Arthur B. (1962), "Topological sorting of large networks", Communications of the ACM 5 (11): 558–562, doi:10.1145/368996.369025
        // https://en.wikipedia.org/wiki/Topological_sorting
        var onto = this
        var S = [], L = []
        var children = onto.parents.map (function() { return [] })
        var nParents = [], edges = 0
        for (var c = 0; c < onto.terms(); ++c) {
            onto.parents[c].forEach (function(p) {
                children[p].push (c)
                ++edges
            })
            nParents[c] = onto.parents[c].length
            if (nParents[c] == 0)
                S.push (c)
        }
        while (S.length > 0) {
            var n = S.shift()
            L.push (n)
            children[n].forEach (function(m) {
                --edges
                if (--nParents[m] == 0)
                    S.push (m)
            })
        }
        if (edges > 0)
            throw ("Ontology graph is not a DAG")

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
                  'closure': [],
                  'terms': function() { return this.termName.length },
                  'toJSON': toJSON,
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
    }

    module.exports = Ontology
}) ()
