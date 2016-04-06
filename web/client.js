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
    
    function probStyle (p) {
	var level = Math.floor ((1-p) * 255)
	return bgColorStyle (level, 255, level)
    }

    function blankStyle() {
	return 'style="background-color:#c0c0c0"'
    }

    function ratioText (r) {
	return (r > .5 && r < 1.5) ? "~1"
            : (r < 1
	       ? (isFinite(1/r) ? ("1/" + Math.round(1/r)) : "0")
	       : Math.round(r))
    }

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
	    wtf.ui.totalSamples.text (wtf.mcmc.samplesIncludingBurn.toString())
	    wtf.ui.samplesPerTerm.text ((wtf.mcmc.samplesIncludingBurn / wtf.mcmc.nVariables()).toString())
	    if (wtf.redraw) {
		showTermTable (wtf)
		showGeneTable (wtf, wtf.ui.falsePosTableParent, wtf.mcmc.geneFalsePosSummary(0), "FalsePos")
		showGeneTable (wtf, wtf.ui.falseNegTableParent, wtf.mcmc.geneFalseNegSummary(0), "FalseNeg")
		if (wtf.showTermPairs)
		    showTermPairs (wtf)
		wtf.redraw = false
	    }
	    wtf.samplesPerRun = wtf.mcmc.nVariables()

	    if (!wtf.trackPairSamplesPassed && wtf.mcmc.samplesIncludingBurn >= wtf.trackPairSamples) {
		trackTermPairs.call(wtf)
		wtf.trackPairSamplesPassed = true
	    }
	    
	    if (!wtf.targetSamplesPassed && wtf.mcmc.samplesIncludingBurn >= wtf.targetSamples) {
		pauseAnalysis.call(wtf)
		wtf.targetSamplesPassed = true
	    }
	    
	    setTimeout (runMCMC.bind(wtf), 10)
        }
    }

    function linkTerm (wtf, term) {
	return '<a target="_blank" href="' + wtf.termURL + term + '">' + term + '</a>'
    }
    
    function showTermTable (wtf) {
	var termTable = $('<table></table>')
	var termProb = wtf.mcmc.termSummary(0)
	var terms = util.sortKeys(termProb).reverse()
	termTable.append ($('<tr><th>Term</th><th>P(Term)</th></tr>'))
        terms.forEach (function (t,i) {
	    var p = termProb[t]
	    var pStyle = probStyle(p)
	    termTable
		.append ($('<tr>'
			   + '<td ' + pStyle + '>' + linkTerm(wtf,t) + '</td>'
			   + '<td ' + pStyle + '>' + p.toPrecision(5) + '</td></tr>'))
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

    function getLogLikeRange (wtf) {
	var len = wtf.mcmc.logLikelihoodTrace.length
	if (len > 0) {
	    var slice = wtf.mcmc.logLikelihoodTrace.slice(wtf.logLikeMinMaxSlice).concat (wtf.logLikeMinMax)
	    wtf.logLikeMinMax[0] = Math.min (...slice)
	    wtf.logLikeMinMax[1] = Math.max (...slice)
	    wtf.logLikeMinMaxSlice = len
	}
    }
    
    function plotLogLikelihood() {
        var wtf = this
	wtf.logLikeMinMax = []
	wtf.logLikeMinMaxSlice = 0
	getLogLikeRange (wtf)
        Plotly.plot( wtf.ui.logLikePlot[0],
		     [{ y: wtf.mcmc.logLikelihoodTrace,
			name: "Log-likelihood",
			showlegend: false },
		      { x: [wtf.mcmc.burn, wtf.mcmc.burn],
			y: wtf.logLikeMinMax,
			name: "Burn-in",
			mode: 'lines',
			hoverinfo: 'name',
			line: { dash: 4 },
			showlegend: false },
		      { x: [wtf.trackPairSamples, wtf.trackPairSamples],
			y: wtf.logLikeMinMax,
			name: "Term pairs",
			mode: 'lines',
			hoverinfo: 'name',
			line: { dash: 4 },
			showlegend: false },
		      { x: [wtf.targetSamples, wtf.targetSamples],
			y: wtf.logLikeMinMax,
			name: "End of run",
			mode: 'lines',
			hoverinfo: 'name',
			line: { dash: 4 },
			showlegend: false }],
                     { xaxis: { title: "Progress" },
		       margin: { b:0, l:0, r:10, t:0, pad:10 },
		       width: 390,
		       height: 200 },
		     { displayModeBar: false })
	
        setTimeout (redrawLogLikelihood.bind(wtf), 100)
    }

    function redrawLogLikelihood() {
        var wtf = this
        if (!wtf.paused) {
	    getLogLikeRange (wtf)
            Plotly.redraw( wtf.ui.logLikePlot[0] )
	}
        setTimeout (redrawLogLikelihood.bind(wtf), 100)
    }

    function trackTermPairs() {
	var wtf = this
	wtf.ui.pairButton.prop('disabled',true)
	wtf.mcmc.logTermPairs()
	wtf.showTermPairs = true
	wtf.ui.termPairs.show()
        if (wtf.paused)
            resumeAnalysis.call(wtf)
    }
    
    var termPairProbThreshold = .05, termOddsRatioThreshold = 100
    function showTermPairs (wtf) {
        if (!wtf.paused) {
	    var termProb = wtf.mcmc.termSummary(0)
	    var terms = util.sortKeys(termProb).reverse()
	    var topTerms = []
	    terms.forEach (function (t) {
	        if (termProb[t] > termPairProbThreshold)
		    topTerms.push (t)
	    })
	    var termPairProb = wtf.mcmc.termPairSummary (0, topTerms)

	    var bosons = topTerms.map (function() { return [] })
	    var fermions = topTerms.map (function() { return [] })
	    topTerms.forEach (function(t,i) {
		topTerms.forEach (function(t2) {
		    if (t != t2) {
			var ratio = termPairProb[t][t2] / (termProb[t] * termProb[t2])
			if (ratio > termOddsRatioThreshold)
			    bosons[i].push(t2)
			else if (ratio < 1 / termOddsRatioThreshold)
			    fermions[i].push(t2)
		    }
		})
	    })

	    listPairedTerms (wtf, topTerms, bosons, wtf.ui.bosonTableParent, "Often co-occurs with")
	    listPairedTerms (wtf, topTerms, fermions, wtf.ui.fermionTableParent, "Rarely co-occurs with")
	    
	}
    }

    function listPairedTerms (wtf, topTerms, partnerList, tableParent, header) {
	var pairedTerms = util.iota(topTerms.length)
	    .filter (function(i) { return partnerList[i].length > 0 })
	if (pairedTerms.length) {
	    var table = $('<table/>')
	    table.append ($('<tr><th>Term</th><th align="left">' + header + '</th></tr>'))
	    table.append (pairedTerms
			  .map (function(i) {
			      return $('<tr><td>' + linkTerm(wtf,topTerms[i]) + '</td><td>'
				       + partnerList[i].map (function (t) {
					   return linkTerm(wtf,t)
				       }).join(", ") + '</td></tr>')
			  }))
	    tableParent.empty()
	    tableParent.append (table)
	    tableParent.show()
	} else
	    tableParent.hide()
    }
    
    function cancelStart (wtf, msg) {
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
	    wtf.mcmc.burn = 10 * wtf.mcmc.nVariables()
	    wtf.trackPairSamples = wtf.mcmc.burn + 50 * wtf.mcmc.nVariables()
	    wtf.targetSamples = wtf.mcmc.burn + 100 * wtf.mcmc.nVariables()

            wtf.mcmc.logLogLikelihood (true)
            
            resumeAnalysis.call(wtf)
            wtf.ui.startButton.prop('disabled',false)

	    wtf.ui.results.show()
	    wtf.ui.mcmc.show()

	    wtf.ui.pairButton.show()
	    wtf.ui.pairButton.click (trackTermPairs.bind(wtf))

	    wtf.ui.totalSamples = $('<span>0</span>')
	    wtf.ui.samplesPerTerm = $('<span>0</span>')
	    wtf.ui.samplesPerSec = $('<span>0</span>')
	    wtf.ui.mcmcStats = $('<span/>')
	    wtf.ui.mcmcStats.append (wtf.ui.totalSamples, " samples, ", wtf.ui.samplesPerTerm, " samples/term, ", wtf.ui.samplesPerSec, " samples/sec")

	    wtf.ui.statusDiv.append (wtf.ui.mcmcStats)
            
            runMCMC.call(wtf)
            plotLogLikelihood.call(wtf)
        }
    }

    function pauseAnalysis() {
        var wtf = this
        wtf.paused = true
        wtf.ui.startButton.html('More sampling')
        wtf.ui.startButton.off('click')
        wtf.ui.startButton.on('click',resumeAnalysis.bind(wtf))
    }

    function resumeAnalysis() {
        var wtf = this
        wtf.paused = false
        wtf.ui.startButton.html('Stop sampling')
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
		.prepend ($('<div class="wtfcontrolmcmc"/>')
			  .append ($('<div class="wtfcontrol"/>')
				   .append (wtf.ui.helpText = $('<span>Enter gene names, one per line </span>'),
					    wtf.ui.geneSetTextArea = $('<textarea class="wtfgenesettextarea" rows="10"/>'),
					    wtf.ui.startButton = $('<button class="wtfstartbutton">Start analysis</button>'),
					    wtf.ui.pairButton = $('<button>Track co-occurence</button>')),
				   (wtf.ui.mcmc = $('<div class="wtfmcmc"/>'))
				   .append (wtf.ui.statusDiv = $('<div class="wtfstatus"/>'),
					    wtf.ui.logLikePlot = $('<div class="wtfloglike"/>'))),
			  (wtf.ui.results = $('<div class="wtfresults"/>'))
			  .append ($('<div class="wtftable">Enriched terms</div>')
				   .append (wtf.ui.termTableParent = $('<div/>')),
				   $('<div class="wtftable">Unexplained genes</div>')
				   .append (wtf.ui.falsePosTableParent = $('<div/>')),
				   $('<div class="wtftable">Missing genes</div>')
				   .append (wtf.ui.falseNegTableParent = $('<div/>')),
				   (wtf.ui.termPairs = $('<div class="wtftermpair"/>')
				    .append (wtf.ui.bosonTableParent = $('<div class="wtftable"/>'),
					     wtf.ui.fermionTableParent = $('<div class="wtftable"/>')))))
	    
            wtf.ui.startButton
                .on('click', startAnalysis.bind(wtf))

	    wtf.ui.pairButton.hide()
	    wtf.ui.mcmc.hide()
	    wtf.ui.results.hide()
	    wtf.ui.termPairs.hide()

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
