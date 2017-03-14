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
  ['i', 'ids=STRING+', 'example gene set (whitespace-separated)'],
  ['h' , 'help', 'display this help message']
])              // create Getopt instance
    .bindHelp()
    .setHelp ("Usage: add-to-site.js <directory>\n"
	      + "[[OPTIONS]]\n\n"
              + "The gene ID aliases file, if it exists, should have\n"
              + "one set of synonyms per line, whitespace-separated.\n")

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
function makeJsonFilename (stem, orgNum, ontNum) { return "json/" + stem + "." + (orgNum+1) + "-" + (ontNum+1) + ".json" }

function readJson (filename) {
  var path = dirPath(filename)
  fs.existsSync (path) || inputError ("Can't find " + path)
  return JSON.parse (fs.readFileSync(path).toString())
}

function writeJson (filename, json) {
  fs.writeFileSync (dirPath(filename), JSON.stringify (json))
}


fs.existsSync(dirPath(datasetsPath)) || inputError ("Can't find " + dirPath(datasetsPath))
var datasets = readJson (datasetsPath)

var organism, organismOntology, orgNum, ontNum, examples
function findOrganism (name) {
  for (var i = 0; i < datasets.organisms.length; ++i)
    if (datasets.organisms[i].name === name) {
      organism = datasets.organisms[orgNum = i]
      break
    }
}

function findOntology (name) {
  for (var i = 0; i < organism.ontologies.length; ++i)
    if (organism.ontologies[i].name === name) {
      organismOntology = organism.ontologies[ontNum = i]
      break
    }
}

if (opt.options.example || opt.options.ids) {
  var exampleIds = opt.options.ids || []
  var exampleName = opt.options.example
      || exampleIds.map (function (ids) { return "Example (" + ids.length + " gene" + (ids.length == 1 ? "" : "s") + ")" })
  exampleName.length === exampleIds.length || inputError ("Please supply as many example gene-set names as example gene-sets", true)
  examples = exampleName.map (function (name, n) { return { name: name, genes: exampleIds[n].split(" ") } })
}

if (opt.options.obo || opt.options.gaf) {
  opt.options.obo || inputError ("Please specify an OBO file", true)
  opt.options.gaf || inputError ("Please specify a GAF file", true)

  fs.existsSync(opt.options.obo) || inputError ("OBO file '" + opt.options.obo + "' not found")
  fs.existsSync(opt.options.gaf) || inputError ("GAF file '" + opt.options.gaf + "' not found")

  var ontologyName = opt.options.ontology || opt.options.obo
  var speciesName = opt.options.species || opt.options.gaf

  findOrganism (speciesName)
  if (!organism)
    orgNum = datasets.organisms.push (organism = { name: speciesName, ontologies: [] }) - 1

  findOntology (ontologyName)
  organismOntology && inputError ("An ontology named '" + ontologyName + "' for species '" + speciesName + "' already exists")
  
  var oboText = fs.readFileSync(opt.options.obo).toString()
  var gafText = fs.readFileSync(opt.options.gaf).toString()

  var aliasesText
  if (opt.options.aliases)
    aliasesText = fs.readFileSync(opt.options.aliases).toString()

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

  ontNum = organism.ontologies.length
  var ontologyPath = makeJsonFilename("ontology",orgNum,ontNum)
  var assocsPath = makeJsonFilename("assocs",orgNum,ontNum)
  writeJson (ontologyPath, slimOntologyJson)
  writeJson (assocsPath, trimmedAssocsJson)

  organismOntology = { name: ontologyName,
                       ontology: "./" + ontologyPath,
                       assocs: "./" + assocsPath,
                       examples: [] }

  organism.ontologies.push (organismOntology)

} else {
  if (opt.options.species)
    findOrganism (opt.options.species)
  else if (datasets.organisms.length === 1)
    organism = datasets.organisms[0];

  if (opt.options.ontology)
    findOntology (opt.options.ontology)
  else if (organism && organism.ontologies.length === 1)
    organismOntology = organism.ontologies[0];
  
  ((opt.options.species || organism) && (opt.options.ontology || organismOntology))
    || inputError ("Please specify GAF and OBO files\n(or species & ontology names, if adding example gene-sets to an existing entry)", true);
  organism || inputError ("Organism '" + opt.options.species + "' not found in " + dirPath(datasetsPath))
  organismOntology || inputError ("Ontology '" + opt.options.ontology + "' not found for organism '" + opt.options.species + "' in " + dirPath(datasetsPath))

  (examples && examples.length) || inputError ("Please specify at least one example gene-set to add to an existing entry,\nor GAF and OBO files to create a new entry");
  opt.options.aliases && inputError ("Can't specify an aliases file without a GAF file");
}

if (examples)
  organismOntology.examples = organismOntology.examples.concat (examples)

writeJson (datasetsPath, datasets)
console.log ("done")
