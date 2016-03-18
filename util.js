(function() {
    var extend = require('util')._extend

    function numCmp (a, b) { return a-b }

    function sortAscending (list) {
        return list.sort (numCmp)
    }

    function listToCounts (list) {
	var c = {}
	list.forEach (function(x) {
            c[x] = (c[x] || 0) + 1
        })
        return c
    }
    
    function removeDups (list) {
	return Object.keys (listToCounts (list))
    }

    function parseDecInt (x) {
        return parseInt (x)
    }
    
    module.exports.numCmp = numCmp
    module.exports.sortAscending = sortAscending
    module.exports.listToCounts = listToCounts
    module.exports.removeDups = removeDups
    module.exports.parseDecInt = parseDecInt
    module.exports.extend = extend
}) ()
