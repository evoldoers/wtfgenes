(function() {

    function obo2json (conf) {

	if (typeof(conf) == 'string')
	    conf = { obo: conf }
	
	var oboString = conf['obo']

	var termList = [], termInfo = [], currentTerm, termIndex = {}
	function clear() { currentTerm = { parents: [], name: "" } }
	clear()

        function newTerm (id, parents, name) {
	    termIndex[id] = termList.length
	    termList.push ([id].concat (parents))
	    termInfo.push (name)
        }
        
	function addTerm() {
	    if (currentTerm.id) {
                newTerm (currentTerm.id, currentTerm.parents, currentTerm.name)
		clear()
	    }
	}

	oboString.split("\n").forEach (function (line) {
	    var m
	    if (line.match (/^\[Term\]/))
		addTerm()
	    else if (m = line.match (/^id: (GO:\d+)/))
		currentTerm.id = m[1]
	    else if (m = line.match (/^name: (\S.*\S)/))
		currentTerm.name = m[1]
	    else if (m = line.match (/^is_a: (GO:\d+)/))
		currentTerm.parents.push (m[1])
	    else if (m = line.match (/^relationship: part_of (GO:\d+)/))
		currentTerm.parents.push (m[1])
	    else if (line.match(/^is_obsolete/))
		clear()
	})
	addTerm()

        if (conf.discardMissingParents)
            termList = termList.map (function (termParents) {
                return [termParents[0]].concat (termParents.slice(1).filter (function (p) {
                    return p in termIndex
                }))
            })
        
	if (conf['compress'])
	    termList.forEach (function (termParents) {
		for (var i = 1; i < termParents.length; ++i) {
                    var p = termParents[i]
                    if (!(p in termIndex))
                        newTerm (p, [], '')
		    termParents[i] = termIndex[p]
                }
	    })

	var result = { termParents: termList}
	if (conf['includeTermInfo'])
	    result.termInfo = termInfo

	return result
    }

    function gaf2json (conf) {

	if (typeof(conf) == 'string')
	    conf = { gaf: conf }

	var primary = {}, isAlias = {}, isDuplicate = {}
        function addAlias (id, alias) {
            if (id in primary) {
                if (primary[id] == alias)
                    return
                id = primary[id]
            }

            if (!(id in isAlias))
                isAlias[id] = {}
            primary[id] = id

            if (alias in isDuplicate) {
                isDuplicate[alias][id] = true
                return
            }

            if ((alias in primary) && primary[alias] != id) {
                var oldPrimary = primary[alias]
                if (conf.mergeDuplicates) {
                    var toMerge = Object.keys (isAlias[oldPrimary])
                    toMerge.push (oldPrimary)
                    toMerge.forEach (function (mergeId) {
                        primary[mergeId] = id
                        isAlias[id][mergeId] = true
                    })
                    delete isAlias[oldPrimary]
                } else {
                    delete isAlias[oldPrimary][alias]
                    isDuplicate[alias] = {}
                    isDuplicate[alias][oldPrimary] = true
                    isDuplicate[alias][id] = true
                    return
                }
            }

            if (id != alias)
                isAlias[id][alias] = 1
            primary[alias] = id
        }

        if (conf.aliases) {
	    var stripRegex = /^\s*(.+?)\s*$/
            conf.aliases.split("\n").forEach (function (aliasLine) {
	        var stripMatch = stripRegex.exec(aliasLine)
	        if (stripMatch != null) {
                    var a = stripMatch[1].split(/\s+/)
                    a.forEach (function (alias) {
                        addAlias (a[0], alias)
                    })
                }
            })
        }

	var gafString = conf['gaf']
	var useDatabaseID = conf['useDatabaseID']

        var gafs = []
	gafString.split("\n").forEach (function (line) {
	    if (!line.match(/^\s*\!/)) {
		var fields = line.split("\t")
		if (fields.length >= 7) {
		    var id = fields[useDatabaseID ? 1 : 2]
		    var alt = fields[useDatabaseID ? 2 : 1]
                    addAlias (id, alt)
                    gafs.push ({ id: id,
                                 qualifier: fields[3],
                                 go_id: fields[4] })
                }
            }
        })

        var assocs = {}
        Object.keys(isAlias).forEach (function (id) {
            if (!(id in isDuplicate))
                assocs[id] = []
        })

        gafs.forEach (function (gaf) {
            if (gaf.qualifier != "NOT") {
                if (!(gaf.id in isDuplicate)) {
                    var p = primary[gaf.id]
                    if (!(p in assocs))
                        assocs[p] = []
		    assocs[p].push (gaf.go_id)
                }
	    }
	})

        if (Object.keys(isDuplicate).length)
            console.warn ("Warning: the following duplicate aliases were discarded:\n"
                          + Object.keys(isDuplicate).sort().map (function (dup) {
                              return dup + " -> " + Object.keys(isDuplicate[dup]).sort().join(" ") + "\n"
                          }).join(""))
        
        var idAliasesTermsList = Object.keys(assocs).sort()
            .map (function (id) {
                return [ id, Object.keys(isAlias[id]).sort(), assocs[id] ]
            })
	return { idAliasTerm: idAliasesTermsList }
    }

    function flatfile2list (conf) {

	if (typeof(conf) == 'string')
	    conf = { text: conf }
	
	var text = conf['text']
        var filter = conf.filter || function(line) { return line.length > 0 }
	
	var list = []
	text.split("\n").forEach (function (line) {
            list.push (line)
	})

	return list.filter (filter)
    }

    module.exports.obo2json = obo2json
    module.exports.gaf2json = gaf2json
    module.exports.flatfile2list = flatfile2list
}) ()
