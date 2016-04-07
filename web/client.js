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

            redrawLogLikelihood.call(wtf)
	    if (wtf.redraw) {
		showTermTable (wtf)
		showGeneTable (wtf, wtf.ui.falsePosTableParent, wtf.mcmc.geneFalsePosSummary(0), "misannotated active")
		showGeneTable (wtf, wtf.ui.falseNegTableParent, wtf.mcmc.geneFalseNegSummary(0), "misannotated inactive")
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

	    if (wtf.mcmc.finishedBurn())
		wtf.ui.results.show()
	    
	    setTimeout (runMCMC.bind(wtf), 10)
        }
    }

    function linkTerm (term) {
	var wtf = this
	return '<a target="_blank" href="' + wtf.termURL + term + '">' + term + '</a>'
    }
    
    var termPairProbThreshold = .05, termOddsRatioThreshold = 100
    function showTermTable (wtf) {
	var termTable = $('<table class="wtftermtable"></table>')
	var termProb = wtf.mcmc.termSummary(0)
	var terms = util.sortKeys(termProb).reverse()

	var bosons = terms.map (function() { return [] })
	var fermions = terms.map (function() { return [] })
	if (wtf.showTermPairs && wtf.mcmc.termPairSamples > wtf.mcmc.burn) {
	    var termPairProb = wtf.mcmc.termPairSummary (0, terms)

	    terms.forEach (function(t,i) {
		terms.forEach (function(t2) {
		    if (t != t2) {
			var ratio = termPairProb[t][t2] / (termProb[t] * termProb[t2])
			if (ratio > termOddsRatioThreshold)
			    bosons[i].push(t2)
			else if (ratio < 1 / termOddsRatioThreshold)
			    fermions[i].push(t2)
		    }
		})
	    })
	}
	var gotBosons = bosons.some (function(l) { return l.length > 0 })
	var gotFermions = fermions.some (function(l) { return l.length > 0 })

	var equivalents = terms.map (function(t) {
	    var ti = wtf.ontology.termIndex[t]
	    return wtf.assocs.termsInEquivClass[wtf.assocs.equivClassByTerm[ti]]
		.filter (function(tj) { return tj != ti })
		.map (function(tj) { return wtf.ontology.termName[tj] })
	})
	var gotEquivalents = equivalents.some (function(l) { return l.length > 0 })

	termTable.append ($('<tr>'
			    + [['Term ID', 'The database ID of the ontology term'],
			       ['P(Term)', 'The posterior probability that the term is activated'],
			       ['Term name', 'The name of the term'],
			       ['Explains', 'The genes that are associated to the term and are in the active set'],
			       ['Also predicts', 'The genes that are associated to the term and are not in the active set'],
			       gotEquivalents ? ['Resembles', 'Terms that have exactly the same gene associations as this term, and so were excluded from the analysis as being statistically indistinguishable'] : [],
			       gotBosons ? ['Complements', 'Terms that are positively correlated with this term: they collaborate to explain (complementary aspects of) the data'] : [],
			       gotFermions ? ['Excludes', 'Terms that are negatively correlated with this term: they compete to explain (similar aspects of) the data'] : []]
			    .map (function (text_mouseover) {
				return text_mouseover.length == 2
				    ? ('<th><span title="' + text_mouseover[1] + '">' + text_mouseover[0] + '</span></th>')
				    : ""
			    }).join('')
			    + '</tr>'))
        terms.forEach (function (t,i) {
	    var p = termProb[t]
	    var pStyle = probStyle(p)
	    var genes = wtf.assocs.genesByTerm[wtf.ontology.termIndex[t]]
	    var inGeneSet = util.objPredicate (wtf.mcmc.models[0].inGeneSet)
	    var explained = genes.filter (inGeneSet)
		.map (function(g) { return wtf.assocs.geneName[g] })
	    var predicted = genes.filter (util.negate (inGeneSet))
		.map (function(g) { return wtf.assocs.geneName[g] })
	    termTable
		.append ($('<tr ' + pStyle + '>'
			   + '<td>' + linkTerm.call(wtf,t) + '</td>'
			   + '<td>' + p.toPrecision(5) + '</td>'
			   + '<td>' + wtf.ontology.getTermInfo(t) + '</td>'
			   + '<td>' + explained.join(", ") + '</td>'
			   + '<td>' + predicted.join(", ") + '</td>'
			   + (gotEquivalents ? '<td>' + equivalents[i].map(function(t) {
			       return wtf.ontology.getTermInfo(t) + ' (' + linkTerm.call(wtf,t) + ')'
			   }).join("<br/>") + '</td>' : '')
			   + (gotBosons ? '<td>' + bosons[i].map(linkTerm.bind(wtf)).join(", ") + '</td>' : '')
			   + (gotFermions ? '<td>' + fermions[i].map(linkTerm.bind(wtf)).join(", ") + '</td>' : '')
			   + '</tr>'))
        })
	wtf.ui.termTableParent.empty()
	wtf.ui.termTableParent.append (termTable)
    }

    function showGeneTable (wtf, parent, geneProb, label) {
	var geneTable = $('<table class="wtfgenetable"></table>')
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
			name: "Halfway done",
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
                     { margin: { b:0, l:0, r:10, t:0, pad:10 },
		       // this is the plot title, but putting it as x-axis title looks better... hack
		       xaxis: { title: "Log-likelihood vs sample#" },
		       width: 398,
		       height: 198 },
		     { displayModeBar: false })
    }

    function redrawLogLikelihood() {
        var wtf = this
        if (!wtf.paused) {
	    getLogLikeRange (wtf)
            Plotly.redraw( wtf.ui.logLikePlot[0] )
	}
    }

    function trackTermPairs() {
	var wtf = this
	if (!wtf.showTermPairs) {
	    wtf.ui.pairButton.prop('disabled',true)
	    wtf.mcmc.logTermPairs()
	    wtf.showTermPairs = true
	}
        if (wtf.paused)
	    resumeAnalysis.call(wtf)
    }
    
    function cancelStart (wtf, msg) {
	alert (msg)
        wtf.ui.startButton.prop('disabled',false)
        wtf.ui.geneSetTextArea.prop('disabled',false)
	$('.wtfprior input').prop('disabled',false)
        enableExampleLink (wtf)
    }

    function startAnalysis() {
        var wtf = this
        wtf.ui.startButton.prop('disabled',true)
        wtf.ui.geneSetTextArea.prop('disabled',true)
	$('.wtfprior input').prop('disabled',true)
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
		    t: parseInt (wtf.ui.termPresentCount.val()),
		    fp: parseInt (wtf.ui.falsePosCount.val()),
		    fn: parseInt (wtf.ui.falseNegCount.val())
		},
		fail: {
		    t: parseInt (wtf.ui.termAbsentCount.val()),
		    fp: parseInt (wtf.ui.trueNegCount.val()),
		    fn: parseInt (wtf.ui.truePosCount.val())
		}
	    }

            wtf.mcmc = new MCMC ({ assocs: wtf.assocs,
			           geneSets: [geneNames],
				   prior: prior,
                                   moveRate: {
                                       flip: 1,
                                       step: 1,
                                       jump: 1
                                   },
				   seed: 123456789
			         })
	    wtf.mcmc.burn = 10 * wtf.mcmc.nVariables()
	    wtf.trackPairSamples = wtf.mcmc.burn + 50 * wtf.mcmc.nVariables()
	    wtf.targetSamples = wtf.mcmc.burn + 100 * wtf.mcmc.nVariables()

            wtf.mcmc.logLogLikelihood (true)

            wtf.trackPairSamplesPassed = false
	    wtf.targetSamplesPassed = false

            resumeAnalysis.call(wtf)

            wtf.ui.startButton.prop('disabled',false)

	    wtf.ui.statusDiv.show()
	    wtf.ui.mcmcPanel.show()

	    wtf.ui.pairButton.show()
	    wtf.ui.pairButton.click (trackTermPairs.bind(wtf))

	    wtf.ui.totalSamples = $('<span>0</span>')
	    wtf.ui.samplesPerTerm = $('<span>0</span>')
	    wtf.ui.samplesPerSec = $('<span>0</span>')
	    wtf.ui.mcmcStats = $('<span/>')
	    wtf.ui.mcmcStats.append (wtf.ui.totalSamples, " samples, ", wtf.ui.samplesPerTerm, " samples/term, ", wtf.ui.samplesPerSec, " samples/sec")

	    wtf.ui.statusDiv.append (wtf.ui.mcmcStats)
            
            plotLogLikelihood.call(wtf)
            runMCMC.call(wtf)
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

    function textInput() {
	return $('<input type="text" size="5"/>')
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
	$("body").append
	($('<div id="wtf" class="wtfparent"/>')
	 .append (wtf.ui.parentDiv = $('<div/>'),
		  wtf.ui.logDiv = $('<div class="wtflog"/>')))

        // load data files, initialize ontology & associations
        var ontologyReady = $.Deferred(),
            assocsReady = $.Deferred()

	// load ontology
        wtf.log ("Loading ontology...")
        $.get(wtf.ontologyURL)
            .done (function (ontologyJson) {
                wtf.ontology = new Ontology (ontologyJson)
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

            wtf.ui.parentDiv.prepend
	    ($('<div class="wtfcontrolpanels"/>')
	     .append ($('<div class="wtfleftpanel"/>')
		      .append ($('<div class="wtfgeneset"/>')
			       .append (wtf.ui.helpText = $('<span>Enter active gene names, one per line </span>'),
					wtf.ui.geneSetTextArea = $('<textarea class="wtfgenesettextarea" rows="10"/>'),
					wtf.ui.startButton = $('<button class="wtfstartbutton">Start sampling</button>'),
					wtf.ui.pairButton = $('<button>Track co-occurence</button>'))),
		      $('<div class="wtfmidpanel"/>')
		      .append ($('<div class="wtfprior"/>')
			       .append ($('<span>Pseudocounts</span>'),
					$('<br/>'),
					$('<table/>')
					.append ($('<tr><th/><th>#True</th><th>#False</th></tr>'),
						 $('<tr/>')
						 .append ($('<td>A term\'s associated genes are active</td>'),
							  $('<td/>')
							  .append (wtf.ui.termPresentCount = textInput()),
							  $('<td/>')
							  .append (wtf.ui.termAbsentCount = textInput())),
						 $('<tr/>')
						 .append ($('<td>Inactive gene is misannotated as active</td>'),
							  $('<td/>')
							  .append (wtf.ui.falsePosCount = textInput()),
							  $('<td/>')
							  .append (wtf.ui.trueNegCount = textInput())),
						 $('<tr/>')
						 .append ($('<td>Active gene is misannotated as inactive</td>'),
							  $('<td/>')
							  .append (wtf.ui.falseNegCount = textInput()),
							  $('<td/>')
							  .append (wtf.ui.truePosCount = textInput())))),
			       wtf.ui.statusDiv = $('<div class="wtfstatus"/>')),
		      (wtf.ui.mcmcPanel = $('<div class="wtfrightpanel"/>'))
		      .append (wtf.ui.logLikePlot = $('<div class="wtfloglike"/>'))),
	     (wtf.ui.results = $('<div class="wtfresults"/>'))
	     .append ($('<div class="wtftable wtftermtable">Enriched terms</div>')
		      .append (wtf.ui.termTableParent = $('<div/>')),
		      $('<div class="wtftable wtfgenetable">Unexplained genes</div>')
		      .append (wtf.ui.falsePosTableParent = $('<div/>')),
		      $('<div class="wtftable wtfgenetable">Missing genes</div>')
		      .append (wtf.ui.falseNegTableParent = $('<div/>'))))

            wtf.ui.termPresentCount.val(1)
	    wtf.ui.termAbsentCount.val(wtf.assocs.relevantTerms().length)
	    wtf.ui.falsePosCount.val(1)
	    wtf.ui.trueNegCount.val(wtf.assocs.genes())
	    wtf.ui.falseNegCount.val(1)
	    wtf.ui.truePosCount.val(wtf.assocs.genes())
	    
	    wtf.ui.startButton
                .on('click', startAnalysis.bind(wtf))

	    wtf.ui.pairButton.hide()
	    wtf.ui.statusDiv.hide()
	    wtf.ui.mcmcPanel.hide()
	    wtf.ui.results.hide()

            if (wtf.exampleURL) {
                wtf.ui.exampleLink = $('<a href="#">(example)</a>')
                wtf.ui.helpText.append(wtf.ui.exampleLink)
                enableExampleLink (wtf)
            }
            
	    setInterval (setRedraw.bind(wtf), 1000)
	})
    }

    global.WTFgenes = WTFgenes
})()
