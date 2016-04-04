(function() {
    var MersenneTwister = require('mersennetwister'),
        assert = require('assert'),
        util = require('../lib/util'),
        Ontology = require('../lib/ontology'),
        Assocs = require('../lib/assocs'),
        Model = require('../lib/model'),
        MCMC = require('../lib/mcmc')

    function setRedraw() {
	this.redraw = true
    }
    
    function runMCMC() {
        var wtf = this
        if (wtf.paused)
            setTimeout (runMCMC.bind(wtf), 100)
        else {
            wtf.mcmc.run (wtf.mcmc.nVariables())
	    if (wtf.redraw) {
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
		wtf.ui.tableParent.empty()
		wtf.ui.tableParent.append (table)
		wtf.redraw = false
	    }
            setTimeout (runMCMC.bind(wtf), 10)
        }
    }

    function cancelStart(wtf,msg) {
	alert (msg)
        wtf.ui.startButton.prop('disabled',false)
        wtf.ui.geneSetTextArea.prop('disabled',false)
        enableExampleLink (wtf)
    }

    function startAnalysis() {
        var wtf = this
        wtf.ui.startButton.prop('disabled',true)
        wtf.ui.geneSetTextArea.prop('disabled',true)
        if (wtf.ui.exampleLink)
            disableExampleLink(wtf)
        var geneNames = wtf.ui.geneSetTextArea.val().split("\n")
            .filter (function (sym) { return sym.length > 0 })
        var validation = wtf.assocs.validateGeneNames (geneNames)
	if (geneNames.length == 0) {
	    cancelStart (wtf, "Please provide some gene names")
	} else if (validation.missingGeneNames.length > 0)
	    cancelStart (wtf, "Please check the following gene names, which were not found in the associations list: " + validation.missingGeneNames)
	else {
            wtf.mcmc = new MCMC ({ assocs: wtf.assocs,
			           geneSets: [geneNames]
			         })
            resumeAnalysis.call(wtf)
            wtf.ui.startButton.prop('disabled',false)
            runMCMC.call(wtf)
        }
    }

    function pauseAnalysis() {
        var wtf = this
        wtf.paused = true
        wtf.ui.startButton.html('Resume analysis')
        wtf.ui.startButton.off('click')
        wtf.ui.startButton.on('click',resumeAnalysis.bind(wtf))
    }

    function resumeAnalysis() {
        var wtf = this
        wtf.paused = false
        wtf.ui.startButton.html('Pause analysis')
        wtf.ui.startButton.off('click')
        wtf.ui.startButton.on('click',pauseAnalysis.bind(wtf))
    }

    function disableExampleLink(wtf) {
        wtf.ui.exampleLink.off('click')
    }
    
    function enableExampleLink(wtf) {
        wtf.ui.exampleLink.on('click',loadExample.bind(wtf))
    }
    
    function loadExample() {
        var wtf = this
        wtf.ui.geneSetTextArea.load (wtf.exampleURL)
    }
    
    function WTFgenes (conf) {
        var wtf = this

        $.extend (wtf, { ontologyURL: conf.ontology,
                         assocsURL: conf.assocs,
                         exampleURL: conf.example,
                         termURL: conf.termURL || 'http://amigo.geneontology.org/amigo/term/',
			 ui: {} })

        function log() {
            wtf.ui.parentDiv.append ('<br/><i>' + Array.prototype.slice.call(arguments).join('') + '</i>')
        }
        
        var ontologyReady = $.Deferred(),
            assocsReady = $.Deferred()

        if (!wtf.ui.parentDiv) {
            wtf.ui.parentDiv = $('<div id="wtf"/>')
            $("body").append (wtf.ui.parentDiv)
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
            wtf.ui.helpText = $('<span>Enter gene names, one per line </span>')
            if (wtf.exampleURL) {
                wtf.ui.exampleLink = $('<a href="#">(example)</a>')
                wtf.ui.helpText.append(wtf.ui.exampleLink)
                enableExampleLink (wtf)
            }

            wtf.ui.geneSetTextArea = $('<textarea id="wtfgenes" rows="10" cols="80"/>')
            wtf.ui.startButton = $('<button type="button">Start analysis</button>')
                .on('click', startAnalysis.bind(wtf))

            wtf.ui.resultsDiv = $('<div/>')
	    wtf.ui.tableParent = $('<div/>')
	    wtf.ui.resultsDiv.append (wtf.ui.tableParent)
            
            wtf.ui.parentDiv.append ('<br/><br/>',
                                     wtf.ui.helpText,
                                     '<br/>',
                                     wtf.ui.geneSetTextArea,
                                     '<br/>',
                                     wtf.ui.startButton,
                                     '<br/>',
                                     wtf.ui.resultsDiv)

	    setInterval (setRedraw.bind(wtf), 500)
	})
    }

    global.WTFgenes = WTFgenes
})()
