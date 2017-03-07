#!/usr/bin/env node

var fs = require('fs'),
    path = require('path'),
    Getopt = require('node-getopt'),
    exec = require('child_process').exec

var getopt = new Getopt([
    ['h' , 'help', 'display this help message']
])              // create Getopt instance
    .bindHelp()
    .setHelp ("Usage: create-site.js <directory>")

var opt = getopt.parseSystem() // parse command line

function inputError (err, showHelp) {
  if (showHelp) getopt.showHelp()
  console.warn (err)
  process.exit(1)
}

opt.argv.length || inputError ("Please specify a directory", true)
opt.argv.length === 1 || inputError ("Too many arguments", true)
var dir = opt.argv[0]

fs.existsSync(dir) && inputError ("Directory " + dir + " already exists - can't create")
exec ("cp -r " + path.resolve(__dirname + "/../web") + " " + dir,
      () => {
	fs.mkdirSync (dir + "/organism")
	fs.writeFileSync (dir + "/datasets.json",
			  JSON.stringify ({ organisms: [] }))
	fs.writeFileSync (dir + "/ontologies.json",
			  JSON.stringify ({}))
	console.log ("created empty site in " + dir)
      })
