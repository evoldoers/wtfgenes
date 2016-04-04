(function() {
    var MersenneTwister = require('mersennetwister'),
        assert = require('assert'),
        util = require('../lib/util'),
        Ontology = require('../lib/ontology'),
        Assocs = require('../lib/assocs'),
        Model = require('../lib/model'),
        MCMC = require('../lib/mcmc')

    function runMCMC() {
        var wtf = this
        if (wtf.paused)
            setTimeout (runMCMC.bind(wtf), 100)
        else {
            wtf.mcmc.run (wtf.mcmc.nVariables())
            var table = $('<table></table>')
            table.append ($('<tr><th>Term</th><th>Probability</th></tr>'))
            var termProb = wtf.mcmc.termSummary(0)
            util.sortKeys(termProb)
                .reverse()
                .forEach (function (t) {
                    var p = termProb[t]
                    var bg = 0xff00 + Math.floor((1-p)*255) * 0x10001
                    var bgStr = "00" + bg.toString(16)
                    bgStr = bgStr.substring (bgStr.length - 6)
                    table.append ($('<tr style="background-color:#' + bgStr + '"><td><a target="_blank" href="' + wtf.termURL + t + '">' + t + '</a></td><td>' + p + '</td></tr>'))
                })
            wtf.resultsDiv.empty()
            wtf.resultsDiv.append (table)
            setTimeout (runMCMC.bind(wtf), 10)
        }
    }

    function startAnalysis() {
        var wtf = this
        wtf.startButton.prop('disabled',true)
        wtf.geneSetTextArea.prop('disabled',true)
        if (wtf.exampleLink)
            disableExampleLink(wtf)
        var geneNames = wtf.geneSetTextArea.val().split("\n")
            .filter (function (sym) { return sym.length > 0 })
        var validation = wtf.assocs.validateGeneNames (geneNames)
	if (validation.missingGeneNames.length > 0) {
	    alert ("Please check the following gene names, which were not found in the associations list: " + validation.missingGeneNames)
            wtf.startButton.prop('disabled',false)
            wtf.geneSetTextArea.prop('disabled',false)
        } else {
            wtf.mcmc = new MCMC ({ assocs: wtf.assocs,
			           geneSets: [geneNames]
			         })
            resumeAnalysis.apply(wtf)
            wtf.startButton.prop('disabled',false)
            runMCMC.apply(wtf)
        }
    }

    function pauseAnalysis() {
        var wtf = this
        wtf.paused = true
        wtf.startButton.html('Resume analysis')
        wtf.startButton.off('click')
        wtf.startButton.on('click',resumeAnalysis.bind(wtf))
    }

    function resumeAnalysis() {
        var wtf = this
        wtf.paused = false
        wtf.startButton.html('Pause analysis')
        wtf.startButton.off('click')
        wtf.startButton.on('click',pauseAnalysis.bind(wtf))
    }

    function disableExampleLink(wtf) {
        wtf.exampleLink.off('click')
    }
    
    function enableExampleLink(wtf) {
        wtf.exampleLink.on('click',loadExample.bind(wtf))
    }
    
    function loadExample() {
        var wtf = this
        wtf.geneSetTextArea.load (wtf.exampleURL)
    }
    
    function WTFgenes (conf) {
        var wtf = this

        $.extend (wtf, { ontologyURL: conf.ontology,
                         assocsURL: conf.assocs,
                         exampleURL: conf.example,
                         termURL: conf.termURL || 'http://amigo.geneontology.org/amigo/term/' })

        function log() {
            wtf.parentDiv.append ('<br/><i>' + Array.prototype.slice.call(arguments).join('') + '</i>')
        }
        
        var ontologyReady = $.Deferred(),
            assocsReady = $.Deferred()

        if (!wtf.parentDiv) {
            wtf.parentDiv = $('<div id="wtf"/>')
            $("body").append (wtf.parentDiv)
        }

        log ("Loading ontology...")
        $.get(wtf.ontologyURL)
            .done (function (ontologyJson) {
                wtf.ontology = new Ontology ({ termParents: ontologyJson })
                log ("Loaded ontology with ", wtf.ontology.terms(), " terms")
                ontologyReady.resolve()
            })

        ontologyReady.done (function() {
            log()
            log ("Loading gene-term associations...")
            $.get(wtf.assocsURL)
                .done (function (assocsJson) {
                    wtf.assocs = new Assocs ({ ontology: wtf.ontology,
                                               assocs: assocsJson })
                    log ("Loaded ", wtf.assocs.nAssocs, " associations (", wtf.assocs.genes(), " genes, ", wtf.assocs.relevantTerms().length, " terms)")
                    assocsReady.resolve()
                })
        })

        assocsReady.done (function() {
            wtf.helpText = $('<span>Enter gene names, one per line </span>')
            if (wtf.exampleURL) {
                wtf.exampleLink = $('<a href="#">(example)</a>')
                wtf.helpText.append(wtf.exampleLink)
                enableExampleLink (wtf)
            }

            wtf.geneSetTextArea = $('<textarea id="wtfgenes" rows="10" cols="80"/>')
            wtf.startButton = $('<button type="button">Start analysis</button>')
                .on('click', startAnalysis.bind(wtf))

            wtf.resultsDiv = $('<div id="wtfterms"/>')
            
            wtf.parentDiv.append ('<br/><br/>',
                                  wtf.helpText,
                                  '<br/>',
                                  wtf.geneSetTextArea,
                                  '<br/>',
                                  wtf.startButton,
                                  '<br/>',
                                  wtf.resultsDiv)
        })
    }

    global.WTFgenes = WTFgenes
})()
