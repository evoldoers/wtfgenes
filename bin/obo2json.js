#!/usr/bin/env node

var fs = require('fs'),
    getopt = require('node-getopt'),
    converters = require('../lib/converters'),
    obo2json = converters.obo2json,
    gaf2json = converters.gaf2json
    Ontology = require('../lib/ontology'),
    Assocs = require('../lib/assocs')

var opt = getopt.create([
    ['e' , 'expand'           , 'do not compress output'],
    ['n' , 'names'            , 'include term names'],
    ['d' , 'discard-missing'  , 'do not add implicit parent terms'],
    ['i' , 'ignore=OBOFILE'   , 'ignore (do not annotate) terms'],
    ['r' , 'root-ids=LIST'    , 'return subgraph rooted at terms (comma-separated list)'],
    ['R' , 'root-names=LIST'  , 'as --root, but specify term name(s)'],
    ['s' , 'slim=GAFFILE'     , 'make a slim ontology for given annotations'],
    ['a' , 'aliases=PATH'     , 'file of aliases for GAF file'],
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
                               discardMissingParents: opt.options['discard-missing'],
			       includeTermInfo: includeTermInfo })

if ('ignore' in opt.options) {
    var ignoreOntology = new Ontology (obo2json ({ obo: fs.readFileSync(opt.options.ignore).toString(),
			                           compress: false,
                                                   discardMissingParents: true,
			                           includeTermInfo: false }))
    ontologyJSON.doNotAnnotate = ignoreOntology.termName
}

var ontology = new Ontology (ontologyJSON)

if ('root-names' in opt.options) {
    if (!includeTermInfo)
        throw new Error ("Can't specify --root-names option without --names option")
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

if ('slim' in opt.options) {
    var aliases
    if ('aliases' in opt.options)
        aliases = fs.readFileSync(opt.options.aliases).toString()

    var assocsJson = gaf2json ({ gaf: fs.readFileSync(opt.options.slim).toString(),
                                 aliases: aliases,
                                 mergeDuplicates: true })
    
    var assocs = new Assocs ({ idAliasTerm: assocsJson.idAliasTerm,
                               ontology: ontology,
                               ignoreMissingTerms: true,
                               closure: true })

    ontology = ontology.subgraphWithAncestors (assocs.relevantTerms().map (ontology.getTermName.bind(ontology)))
}

console.log (JSON.stringify (ontology.toJSON(),
			     null,
			     expand ? 2 : undefined))
