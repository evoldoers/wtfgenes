#!/usr/bin/env node

var fs = require('fs')
var request = require('request-promise')
var zlib = require('zlib')
var Promise = require('bluebird')
var exec = Promise.promisify (require('child_process').exec)

var gaf2json = require('../lib/converters').gaf2json
var obo2json = require('../lib/converters').obo2json

var metadata_url = "http://viewvc.geneontology.org/viewvc/GO-SVN/trunk/gene-associations/go_annotation_metadata.all.js";
var go_url_prefix = "http://geneontology.org/ontology/"
var go_url_suffix = "go-basic.obo"
var gaf_url_prefix = "http://geneontology.org/gene-associations/"

var skip_id = { goa_uniprot_all_noiea: true,
                goa_uniprot_all: true }

var deploy_dir = "deploy"
var gaf_subdir = 'gaf'
var go_subdir = 'go'

var go_path = go_subdir + '/' + go_url_suffix.replace('.obo','.json')

// set up deploy directory
var init_promise = fs.existsSync(deploy_dir)
    ? Promise.resolve(true)
    : (exec("cp -r web " + deploy_dir)
       .then (() => exec("cd " + deploy_dir + "; make"))
       .then (() => exec("mkdir " + deploy_dir + '/' + gaf_subdir))
       .then (() => exec("mkdir " + deploy_dir + '/' + go_subdir))
       .then (() => console.log("initialized " + deploy_dir)))

// download GO
init_promise
  .then (() => request (go_url_prefix + go_url_suffix))
  .then (function (obo) {
    console.log ("downloaded " + go_url_suffix)
    var go_json = obo2json ({ obo: obo,
			      compress: true,
			      includeTermInfo: true })
    fs.writeFileSync (deploy_dir + '/' + go_path, JSON.stringify (go_json))
    
  })
// download GAF metadata
  .then (() => request(metadata_url))
  .then (function (html) {
    eval (html)  // defines global_go_annotation_metadata
    return global_go_annotation_metadata
  }).then (function (metadata) {
    var resources = metadata.resources
    return Promise.all
    (resources
     .filter (resource => !skip_id[resource.id])
     .map (function (resource) {
       var gaf_filename = resource.gaf_filename
       var gaf_url = gaf_url_prefix + gaf_filename
       var gaf_promise = gaf_filename.match(/\.gz$/)
           ? (request ({ uri: gaf_url, encoding: null })
              .then ((buffer) => zlib.gunzipSync(buffer).toString()))
           : request(gaf_url)
       return gaf_promise
         .then (function (gaf_file) {
           console.log ("downloaded " + gaf_filename)
           var gaf_json = gaf2json ({ gaf: gaf_file })
           var gaf_path = gaf_subdir + '/' + resource.id + '.json'
           fs.writeFileSync (deploy_dir + '/' + gaf_path, JSON.stringify (gaf_json))
           return {
             name: resource.label,
             ontologies: [
               { name: "Gene Ontology (basic)",
                 ontology: go_path,
                 assocs: gaf_path,
                 examples: [] }
             ]
           }
         })
     }))
  }).then (function (organisms) {
    organisms = organisms.sort (function (a, b) { return a.name < b.name ? -1 : +1 })
    fs.writeFileSync (deploy_dir + '/datasets.json', JSON.stringify ({ organisms }))
    console.log ("done")
  })
