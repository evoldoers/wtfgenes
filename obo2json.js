#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt')

var opt = getopt.create([
    ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

function inputError(err) {
    throw new Error (err)
}

opt.argv.length || inputError ("You must specify an OBO format input file")

var terms = [], currentTerm, termIndex = {}
function clear() { currentTerm = { parents: [] } }
clear()

function addTerm() {
    if (currentTerm.id) {
	termIndex[currentTerm.id] = terms.length
	terms.push ([currentTerm.id].concat (currentTerm.parents))
	clear()
    }
}

opt.argv.forEach (function (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    data.toString().split("\n").forEach (function (line) {
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
})

terms.forEach (function (termParents) {
    for (var i = 1; i < termParents.length; ++i)
	termParents[i] = termIndex[termParents[i]]
})

console.log (JSON.stringify(terms))
