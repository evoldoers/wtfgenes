#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    Getopt = require('node-getopt'),
    Promise = require('bluebird'),
    exec = Promise.promisify (require('child_process').exec)

var getopt = new Getopt([
    ['h' , 'help', 'display this help message']
])              // create Getopt instance
    .bindHelp()
    .setHelp ("Usage: create-site.js <directory>")

var getopt = new Getopt([
  ['o', 'obo=PATH', 'ontology in OBO format'],
  ['g', 'gaf=PATH', 'associations file in GAF format'],
  ['s', 'species=NAME', 'species name'],
  ['n', 'ontology=NAME', 'ontology name'],
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
  return JSON.parse (fs.readFileSync (path))
}
function writeJson (filename, json) {
  var path = dir + "/" + filename
  fs.writeFileSync (path, JSON.stringify (json))
}

var datasets = readJson ("datasets.json")
var ontologies = readJson ("ontologies.json")

opt.options.gaf || opt.options.species || inputError ("Please specify a GAF file or a species name")
opt.options.obo || opt.options.ontology || inputError ("Please specify an OBO file or an ontology name")
