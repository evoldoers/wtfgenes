(function() {
    var extend = require('util')._extend

    function numCmp (a, b) { return a-b }

    function sortAscending (list) {
        return list.sort (numCmp)
    }

    function removeDups (list) {
	var seen = {}
	list.forEach (function(x) { ++seen[x] })
	return Object.keys(seen)
    }

    module.exports.numCmp = numCmp
    module.exports.sortAscending = sortAscending
    module.exports.removeDups = removeDups
    module.exports.extend = extend
}) ()
