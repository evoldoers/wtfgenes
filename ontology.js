(function() {
    var extend = require('util')._extend,
        assert = require('assert')

    function toJSON (conf) {
        var onto = this
        var json = []
        conf = extend ({'compress': false}, conf)
        var parentLookup = conf.compress
            ? function(j) { return j }
            : function(j) { return onto.termName[j] }
        for (var i = 0; i < onto.terms(); ++i) {
            json.push ([onto.termName[i]].concat (onto.parents[i].map (parentLookup)))
        }
        return { "termParents" : json }
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

    function toposort() {
        var onto = this

        if (onto.isToposorted())
            return onto
        
        var L = toposortTermIndex(onto)
        if (typeof(L) === 'undefined')
            throw new Error ("Ontology graph is not a DAG")
        
        var json = onto.toJSON().termParents
        var toposortedJson = L.map (function(idx) { return json[idx] })

        return new Ontology ({ "termParents": toposortedJson })
    }

    function isToposorted() {
        for (var i = 0; i < this.terms(); ++i)
            if (this.parents[i].some (function(p) { return p >= i }))
                return false;
        return true;
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
    
    function Ontology (conf) {
        var onto = this
        extend (onto,
                { 'termName': [],
                  'termIndex': {},
                  'parents': [],
                  'children': [],
                  'terms': function() { return this.termName.length },
                  'toJSON': toJSON,
                  'isCyclic': isCyclic,
                  'isToposorted': isToposorted,
                  'toposort': toposort,
                  'equals': equals })

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
            extTermParents.forEach (function (tp) {
                onto.parents[onto.termIndex[tp[0]]] = tp.slice([1]).map (function(n) {
                    return typeof(n) === 'number' ? n : onto.termIndex[n]
                })
            })
        } else
            throw new Error ("Can't parse Ontology config")
        
        buildChildren (onto)
    }

    module.exports = Ontology
}) ()
