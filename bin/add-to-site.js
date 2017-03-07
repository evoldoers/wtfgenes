#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    Getopt = require('node-getopt'),
    Promise = require('bluebird'),
    exec = Promise.promisify (require('child_process').exec),
    converters = require('../lib/converters')

var getopt = new Getopt([
    ['h' , 'help', 'display this help message']
])              // create Getopt instance
    .bindHelp()
    .setHelp ("Usage: create-site.js <directory>")

var getopt = new Getopt([
  ['o', 'obo=PATH', 'ontology in OBO format'],
  ['a', 'gaf=PATH', 'associations file in GAF format'],
  ['n', 'ontology=NAME', 'ontology name'],
  ['s', 'species=NAME', 'species name'],
  ['e', 'example-name=STRING+', 'name of example gene set'],
  ['g', 'example-genes=STRING+', 'example gene set (space-separated list of gene IDs)'],
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
function readJson (filename) {
  var path = dir + "/" + filename
  fs.existsSync (path) || inputError ("Can't find " + path)
  return JSON.parse (fs.readFileSync(path).toString())
}
function writeJson (filename, json) {
  var path = dir + "/" + filename
  fs.writeFileSync (path, JSON.stringify (json))
}

var datasets = readJson ("datasets.json")

opt.options.obo || inputError ("Please specify an OBO file")
opt.options.gaf || inputError ("Please specify a GAF file")

fs.existsSync(opt.options.obo) || inputError ("OBO file not found")
fs.existsSync(opt.options.gaf) || inputError ("GAF file not found")

var oboFile = fs.readFileSync(opt.options.obo).toString()
var gafFile = fs.readFileSync(opt.options.gaf).toString()

var ontologyName = opt.options.ontology || opt.options.obo
var speciesName = opt.options.species || opt.options.gaf

var organism
for (var i = 0; !organism && i < datasets.organisms.length; ++i)
  if (datasets.organisms[i].name === speciesName)
    organism = datasets.organisms[i]
if (!organism)
  datasets.organisms.push (organism = { name: speciesName, ontologies: [] })

var ontologyJSON = obo2json ({ obo: text,
			       compress: !expand,
                               discardMissingParents: opt.options['discard-missing'],
			       includeTermInfo: includeTermInfo })

