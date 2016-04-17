#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt'),
    obo2json = require('../lib/converters').obo2json,
    Ontology = require('../lib/ontology')

var opt = getopt.create([
    ['e' , 'expand'           , 'do not compress output'],
    ['n' , 'names'            , 'include term names'],
    ['r' , 'root-ids=LIST'    , 'return subgraph rooted at terms (comma-separated ID list)'],
    ['R' , 'root-names=LIST'  , 'as --root, but specify term name(s)'],
    ['h' , 'help'             , 'display this help message']
])              // create Getopt instance
.bindHelp()     // bind option 'help' to default action
.parseSystem(); // parse command line

function inputError(err) {
    throw new Error (err)
}

opt.argv.length || inputError ("You must specify an OBO format input file")
var expand = opt.options['expand']
var includeTermInfo = opt.options['names']

var text = ""
opt.argv.forEach (function (filename) {
    if (!fs.existsSync (filename))
        inputError ("File does not exist: " + filename)
    var data = fs.readFileSync (filename)
    text += data.toString()
})

var ontologyJSON = obo2json ({ obo: text,
			       compress: !expand,
			       includeTermInfo: includeTermInfo })

var ontology = new Ontology (ontologyJSON)

if ('root-names' in opt.options) {
    var info2id = {}
    ontology.termInfo.forEach (function (info, index) {
        info2id[info] = ontology.termName[index]
    })
    ontology = ontology.subgraphRootedAt(opt.options['root-names'].split(',')
                                         .map (function(info) {
                                             if (!(info in info2id))
                                                 console.warn ("Warning: term not found: " + info)
                                             return info2id[info]
                                         }))
}

if ('root-ids' in opt.options) {
    ontology = ontology.subgraphRootedAt(opt.options['root-ids'].split(','))
}

console.log (JSON.stringify (ontology.toJSON(),
			     null,
			     expand ? 2 : undefined))
