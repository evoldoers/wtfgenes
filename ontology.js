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

    module.exports = function (termParents) {
        var onto = this
        extend (onto,
                { 'termName': [],
                  'termIndex': {},
                  'parents': [],
                  'closure': [],
                  'toJSON': toJSON,
                  'terms': function() { return this.termName.length } })
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
}) ()
