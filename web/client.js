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

    function bgColorStyle (r, g, b) {
	var bg = 0x10000*r + 0x100*g + b
	var bgStr = "000000" + bg.toString(16)
	bgStr = bgStr.substring (bgStr.length - 6)
	return 'style="background-color:#' + bgStr + '"'
    }
    
    var ratioScale = 32 / Math.log(2)
    function ratioStyle (r) {
	var bg
	var l = Math.log(r)
	var level = Math.max (Math.floor (255 - ratioScale*Math.abs(l)), 0)
	if (l > 0)
	    return bgColorStyle (level, 255, level)
	else
	    return bgColorStyle (255, level, level)
    }

    function probStyle (p) {
	var level = Math.floor ((1-p) * 255)
	return bgColorStyle (level, 255, level)
    }

    function blankStyle() {
	return 'style="background-color:#c0c0c0"'
    }

    function ratioText (r) {
	return r < 1
	    ? (isFinite(1/r) ? ((1/r).toFixed(2) + "x less") : "Never")
	    : (isFinite(r) ? (r.toFixed(2) + "x more") : "Always")
    }

    var interactionThreshold = .1
    function runMCMC() {
        var wtf = this
        if (wtf.paused)
            setTimeout (runMCMC.bind(wtf), 100)
        else {
            wtf.mcmc.run (wtf.samplesPerRun)
	    var now = Date.now()
	    if (wtf.lastRun) {
		var elapsedSecs = (now - wtf.lastRun) / 1000
		wtf.ui.samplesPerSec.text ((wtf.samplesPerRun / elapsedSecs).toPrecision(2))
	    }
	    wtf.lastRun = now
	    wtf.ui.totalSamples.text (wtf.mcmc.samples.toString())
	    wtf.ui.samplesPerTerm.text ((wtf.mcmc.samples / wtf.mcmc.nVariables()).toString())
	    if (wtf.redraw) {
		showTermTable (wtf)
		showGeneTable (wtf, wtf.ui.falsePosTableParent, wtf.mcmc.geneFalsePosSummary(0), "false pos")
		showGeneTable (wtf, wtf.ui.falseNegTableParent, wtf.mcmc.geneFalseNegSummary(0), "false neg")
		wtf.redraw = false
	    }
	    wtf.samplesPerRun = wtf.mcmc.nVariables()
            setTimeout (runMCMC.bind(wtf), 10)
        }
    }

    function showTermTable (wtf) {
	var termTable = $('<table></table>')
	var termProb = wtf.mcmc.termSummary(0)
	var terms = util.sortKeys(termProb).reverse()
	var topTerms = []
	terms.forEach (function (t) {
	    if (termProb[t] > interactionThreshold)
		topTerms.push (t)
	})
	var termPairProb
	if (wtf.showPairs) {
	    termPairProb = wtf.mcmc.termPairSummary (0, topTerms)
	}
	termTable.append ($('<tr><th>Term</th><th>P(Term)</th>'
			    + (wtf.showPairs
			       ? topTerms.map (function(t) {
				   return '<th>' + t + '</th>'
			       }).join('')
			       : '')
			    + '</tr>'))
        terms.forEach (function (t,i) {
	    var p = termProb[t]
	    var pStyle = probStyle(p)
	    termTable
		.append ($('<tr>'
			   + '<td ' + pStyle + '><a target="_blank" href="' + wtf.termURL + t + '">' + t + '</a></td>'
			   + '<td ' + pStyle + '>' + p.toPrecision(5) + '</td>'
			   + (wtf.showPairs
			      ? (p > interactionThreshold
				 ? topTerms.map (function(t2,i2) {
				     var ratio = termPairProb[t][t2] / (termProb[t] * termProb[t2])
				     var rStyle = i==i2 ? blankStyle() : ratioStyle(ratio)
				     return '<td ' + rStyle + '>' + (i == i2 ? '' : ratioText(ratio) + '</td>')
				 }).join('')
				 : topTerms.map (function() { return '<td></td>' }))
			      : '')
			   + '</tr>'))
        })
	wtf.ui.termTableParent.empty()
	wtf.ui.termTableParent.append (termTable)
    }

    function showGeneTable (wtf, parent, geneProb, label) {
	var geneTable = $('<table></table>')
	var genes = util.sortKeys(geneProb).reverse()
	geneTable.append ($('<tr><th>Gene</th><th>P(' + label + ')</th></tr>'))
        genes.forEach (function (g,i) {
	    var p = geneProb[g]
	    var pStyle = probStyle(p)
	    geneTable
		.append ($('<tr>'
			   + '<td ' + pStyle + '>' + g + '</td>'
			   + '<td ' + pStyle + '>' + p.toPrecision(5) + '</td>'
			   + '</tr>'))
        })
	parent.empty()
	parent.append (geneTable)
    }

    function plotLogLikelihood() {
        var wtf = this
        Plotly.plot( wtf.ui.logLikePlot[0], [{
	    y: wtf.mcmc.logLikelihoodTrace }],
                     { title: "MCMC convergence",
		       xaxis: { title: "Number of samples" },
                       yaxis: { title: "Log-likelihood" },
		       margin: 0,
		       width: 400,
		       height: 400 } )

        setTimeout (redrawLogLikelihood.bind(wtf), 100)
    }

    function redrawLogLikelihood() {
        var wtf = this
        Plotly.redraw( wtf.ui.logLikePlot[0] )
        setTimeout (redrawLogLikelihood.bind(wtf), 100)
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

	    var prior = {
		succ: {
		    t: 1,
		    fp: 1,
		    fn: 1
		},
		fail: {
		    t: wtf.assocs.relevantTerms().length,
		    fp: wtf.assocs.genes(),
		    fn: wtf.assocs.genes()
		}
	    }

            wtf.mcmc = new MCMC ({ assocs: wtf.assocs,
			           geneSets: [geneNames],
				   prior: prior,
				   seed: 123456789
			         })

            wtf.mcmc.logLogLikelihood()
            
            resumeAnalysis.call(wtf)
            wtf.ui.startButton.prop('disabled',false)

	    wtf.ui.tablesDiv.show()

	    wtf.ui.interButton.show()
	    wtf.ui.interButton.click (function() {
		wtf.ui.interButton.prop('disabled',true)
		wtf.mcmc.logTermPairs()
		wtf.showPairs = true
                if (wtf.paused)
                    resumeAnalysis.call(wtf)
	    })

	    wtf.ui.totalSamples = $('<span>0</span>')
	    wtf.ui.samplesPerTerm = $('<span>0</span>')
	    wtf.ui.samplesPerSec = $('<span>0</span>')
	    wtf.ui.mcmcStats = $('<span/>')
	    wtf.ui.mcmcStats.append (wtf.ui.totalSamples, " samples<br/>", wtf.ui.samplesPerTerm, " samples/term<br/>", wtf.ui.samplesPerSec, " samples/sec")

	    wtf.ui.statusDiv.append (wtf.ui.mcmcStats)
	    wtf.ui.statusDiv.show()
            
            runMCMC.call(wtf)
            plotLogLikelihood.call(wtf)
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
    
    function log() {
        this.ui.logDiv.append ('<br/><i>' + Array.prototype.slice.call(arguments).join('') + '</i>')
    }

    function WTFgenes (conf) {
        var wtf = this

	// populate wtf object
        $.extend (wtf, { ontologyURL: conf.ontology,
                         assocsURL: conf.assocs,
                         exampleURL: conf.example,
                         termURL: conf.termURL || 'http://amigo.geneontology.org/amigo/term/',
			 log: log,
			 ui: {} })

	// initialize UI
        if (!wtf.ui.parentDiv) {
            wtf.ui.parentDiv = $('<div id="wtf" class="wtfparent"/>')
            $("body").append (wtf.ui.parentDiv)
        }

	wtf.ui.logDiv = $('<div class="wtflog"/>')
        wtf.ui.parentDiv.append (wtf.ui.logDiv)

        // load data files, initialize ontology & associations
        var ontologyReady = $.Deferred(),
            assocsReady = $.Deferred()

	// load ontology
        wtf.log ("Loading ontology...")
        $.get(wtf.ontologyURL)
            .done (function (ontologyJson) {
                wtf.ontology = new Ontology ({ termParents: ontologyJson })
                wtf.log ("Loaded ontology with ", wtf.ontology.terms(), " terms")
                ontologyReady.resolve()
            })

	// load associations
        ontologyReady.done (function() {
            wtf.log ("Loading gene-term associations...")
            $.get(wtf.assocsURL)
                .done (function (assocsJson) {
                    wtf.assocs = new Assocs ({ ontology: wtf.ontology,
                                               assocs: assocsJson })
                    wtf.log ("Loaded ", wtf.assocs.nAssocs, " associations (", wtf.assocs.genes(), " genes, ", wtf.assocs.relevantTerms().length, " terms)")
                    assocsReady.resolve()
                })
        })

	// initialize form
        assocsReady.done (function() {

            wtf.ui.parentDiv
		.prepend ($('<div class="wtfcontrolplot"/>')
			  .append ($('<div class="wtfcontrol"/>')
				   .append (wtf.ui.helpText = $('<span>Enter gene names, one per line </span>'),
					    wtf.ui.geneSetTextArea = $('<textarea class="wtfgenesettextarea" rows="10"/>'),
					    wtf.ui.startButton = $('<button class="wtfstartbutton">Start analysis</button>'),
					    wtf.ui.interButton = $('<button>Track co-occurence</button>')),
				   wtf.ui.termPairPlot = $('<div class="wtftermpair"/>'),
				   $('<div class="wtfmcmc"/>')
				   .append (wtf.ui.logLikePlot = $('<div class="wtfloglike"/>'),
					    wtf.ui.statusDiv = $('<div class="wtfstatus"/>')),
				   (wtf.ui.tablesDiv = $('<div/>'))
				   .append ($('<div class="wtftermtable">Enriched terms</div>')
					    .append (wtf.ui.termTableParent = $('<div/>')),
					    $('<div class="wtfgenetable">Unexplained genes</div>')
					    .append (wtf.ui.falsePosTableParent = $('<div/>')),
					    $('<div class="wtfgenetable">Missing genes</div>')
					    .append (wtf.ui.falseNegTableParent = $('<div/>')))
				   .hide()))
            wtf.ui.startButton
                .on('click', startAnalysis.bind(wtf))

	    wtf.ui.interButton.hide()
	    wtf.ui.termPairPlot.hide()
	    wtf.ui.statusDiv.hide()

            if (wtf.exampleURL) {
                wtf.ui.exampleLink = $('<a href="#">(example)</a>')
                wtf.ui.helpText.append(wtf.ui.exampleLink)
                enableExampleLink (wtf)
            }
            
	    setInterval (setRedraw.bind(wtf), 500)
	})
    }

    global.WTFgenes = WTFgenes
})()
