#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    Getopt = require('node-getopt'),
    Promise = require('bluebird'),
    exec = Promise.promisify (require('child_process').exec),
    converters = require('../lib/converters'),
    Ontology = require('../lib/ontology'),
    Assocs = require('../lib/assocs')

var getopt = new Getopt([
    ['h' , 'help', 'display this help message']
])              // create Getopt instance
    .bindHelp()
    .setHelp ("Usage: create-site.js <directory>")

var getopt = new Getopt([
  ['o', 'obo=PATH', 'ontology in OBO format'],
  ['g', 'gaf=PATH', 'associations file in GAF format'],
  ['a', 'aliases=PATH', 'gene name aliases file'],
  ['n', 'ontology=NAME', 'ontology name'],
  ['s', 'species=NAME', 'species name'],
  ['e', 'example=STRING+', 'name of example gene set'],
  ['i', 'ids=STRING+', 'example gene set (space-separated ID list)'],
  ['h' , 'help', 'display this help message']
])              // create Getopt instance
    .bindHelp()
    .setHelp ("Usage: add-to-site.js <directory>\n"
	      + "[[OPTIONS]]\n")

var opt = getopt.parseSystem() // parse command line

function inputError (err, showHelp) {
  if (showHelp) getopt.showHelp()
  console.warn (err)
  process.exit(1)
}

opt.argv.length || inputError ("Please specify a directory", true)
opt.argv.length === 1 || inputError ("Too many arguments", true)

var dir = opt.argv[0]
var datasetsPath = "datasets.json"
function dirPath (filename) { return dir + "/" + filename }

fs.existsSync(dirPath(datasetsPath)) || inputError ("Can't find " + dirPath(datasetsPath))

opt.options.obo || inputError ("Please specify an OBO file", true)
opt.options.gaf || inputError ("Please specify a GAF file", true)

fs.existsSync(opt.options.obo) || inputError ("OBO file not found")
fs.existsSync(opt.options.gaf) || inputError ("GAF file not found")

var examples
if (opt.options.example || opt.options.ids) {
  var exampleName = opt.options.example || []
  var exampleIds = opt.options.ids || []
  exampleName.length === exampleIds.length || inputError ("Please supply as many example gene-set names as example gene-sets", true)
  examples = exampleName.map (function (name, n) { return { name: name, genes: exampleIds[n].split(" ") } })
}

function readJson (filename) {
  var path = dirPath(filename)
  fs.existsSync (path) || inputError ("Can't find " + path)
  return JSON.parse (fs.readFileSync(path).toString())
}

function writeJson (filename, json) {
  fs.writeFileSync (dirPath(filename), JSON.stringify (json))
}

var datasets = readJson (datasetsPath)
var oboText = fs.readFileSync(opt.options.obo).toString()
var gafText = fs.readFileSync(opt.options.gaf).toString()

var aliasesText
if ('aliases' in opt.options)
    aliasesText = fs.readFileSync(opt.options.aliases).toString()

var ontologyName = opt.options.ontology || opt.options.obo
var speciesName = opt.options.species || opt.options.gaf

var organism, orgNum
for (var i = 0; !organism && i < datasets.organisms.length; ++i)
  if (datasets.organisms[i].name === speciesName) {
    organism = datasets.organisms[i]
    orgNum = i + 1
  }
if (!organism)
  orgNum = datasets.organisms.push (organism = { name: speciesName, ontologies: [] })

var ontologyJson = converters.obo2json ({ obo: oboText,
			                  compress: true,
			                  includeTermInfo: true })

var assocsJson = converters.gaf2json ({ gaf: gafText,
                                        aliases: aliasesText,
                                        mergeDuplicates: true })

var ontology = new Ontology (ontologyJson)
var trimmedAssocs = new Assocs ({ idAliasTerm: assocsJson.idAliasTerm,
                                  ontology: ontology,
                                  ignoreMissingTerms: true,
                                  closure: false })

var slimOntology = ontology.subgraphWithAncestors (trimmedAssocs.relevantTerms().map (ontology.getTermName.bind(ontology)))

var trimmedAssocsJson = trimmedAssocs.toJSON()
var slimOntologyJson = slimOntology.toJSON()

var ontNum = organism.ontologies.length + 1
var ontologyPath = "json/ontology." + orgNum + "-" + ontNum + ".json"
var assocsPath = "json/assocs." + orgNum + "-" + ontNum + ".json"
writeJson (ontologyPath, slimOntologyJson)
writeJson (assocsPath, trimmedAssocsJson)

organism.ontologies.push ({ name: ontologyName,
                            ontology: "./" + ontologyPath,
                            assocs: "./" + assocsPath,
                            examples: examples })
writeJson (datasetsPath, datasets)

console.log ("done")
