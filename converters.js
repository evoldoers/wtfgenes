(function() {

    function obo2json (conf) {

	if (typeof(conf) == 'string')
	    conf = { obo: conf }
	
	var oboString = conf['obo']

	var termList = [], currentTerm, termIndex = {}
	function clear() { currentTerm = { parents: [] } }
	clear()
	
	function addTerm() {
	    if (currentTerm.id) {
		termIndex[currentTerm.id] = termList.length
		termList.push ([currentTerm.id].concat (currentTerm.parents))
		clear()
	    }
	}

	oboString.split("\n").forEach (function (line) {
	    var m
	    if (line.match (/^\[Term\]/))
		addTerm()
	    else if (m = line.match (/^id: (GO:\d+)/))
		currentTerm.id = m[1]
	    else if (m = line.match (/^is_a: (GO:\d+)/))
		currentTerm.parents.push (m[1])
	    else if (m = line.match (/^relationship: part_of (GO:\d+)/))
		currentTerm.parents.push (m[1])
	    else if (line.match(/^is_obsolete/))
		clear()
	})
	addTerm()

	if (conf['compress'])
	    termList.forEach (function (termParents) {
		for (var i = 1; i < termParents.length; ++i)
		    termParents[i] = termIndex[termParents[i]]
	    })

	return termList
    }

    function goa2json (conf) {

	if (typeof(conf) == 'string')
	    conf = { goa: conf }
	
	var goaString = conf['goa']
	var useSymbol = conf['useSymbol']
	
	var assocs = []
	goaString.split("\n").forEach (function (line) {
	    if (!line.match(/^\s*\!/)) {
		var fields = line.split("\t")
		if (fields.length >= 7) {
		    var id = fields[useSymbol ? 2 : 1]
		    var qualifier = fields[3]
		    var go_id = fields[4]
		    if (qualifier != "NOT")
			assocs.push ([id, go_id])
		}
	    }
	})
	return assocs
    }
    
    module.exports.obo2json = obo2json
    module.exports.goa2json = goa2json
}) ()
