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
	return 'background-color:#' + bgStr + ';'
    }
    
    function probStyle (p) {
	var rgb = util.HSVtoRGB (.43, p, 1)  // hue matches active-menu color in basic.css; value changed from .79 to 1 to fade naturally to white background
	return bgColorStyle (rgb.r, rgb.g, rgb.b)
    }

    function runMCMC() {
        var wtf = this
	var delayToNextRun = 100
        if (!wtf.paused) {
	    delayToNextRun = 10

            wtf.mcmc.run (wtf.samplesPerRun)
	    var now = Date.now()

	    if (wtf.lastRun) {
		var elapsedSecs = (now - wtf.lastRun) / 1000
		$('#wtf-samples-per-sec').text ((wtf.samplesPerRun / elapsedSecs).toPrecision(2))
	    }
	    wtf.lastRun = now
	    $('#wtf-total-samples').text (wtf.mcmc.samplesIncludingBurn.toString())
	    $('#wtf-samples-per-term').text ((wtf.mcmc.samplesIncludingBurn / wtf.mcmc.nVariables()).toString())

            redrawLogLikelihood.call(wtf)
	    if (wtf.redraw) {
		var terms = showTermTable (wtf)
		var falsePos = wtf.mcmc.geneFalsePosSummary(0)
		var falseNeg = wtf.mcmc.geneFalseNegSummary(0)
		showGeneTable (wtf, $('#wtf-false-pos-table-parent'), falsePos,
			       "mislabeled")
		showGeneTable (wtf, $('#wtf-false-neg-table-parent'), falseNeg,
			       "mislabeled", "Predicted by terms", terms)
		wtf.redraw = false
	    }
	    wtf.samplesPerRun = wtf.mcmc.nVariables()

            if (!wtf.milestonePassed.burnIn && wtf.mcmc.finishedBurn()) {
                $('.wtf-sampler-notifications').append (makeAlert ('info', 'The sampler finished its burn-in period. Results are now available on the Term Report and Gene Report pages, and will be continually updated while the sampler is running.'))
		$('.wtf-results').show()
                wtf.milestonePassed.burnIn = true
            }
            
	    if (!wtf.milestonePassed.targetSamples && wtf.mcmc.samplesIncludingBurn >= wtf.milestone.targetSamples) {
		pauseAnalysis.call (wtf, null, 'success', 'the target of ' + wtf.milestone.targetSamples + ' samples was reached')
		wtf.milestonePassed.targetSamples = true
		$("#wtf-target-samples-per-term").prop('disabled',false)
	    }

	    var percent = Math.round (100 * (wtf.mcmc.samplesIncludingBurn - wtf.milestone.startOfRun) / (wtf.milestone.targetSamples - wtf.milestone.startOfRun)) + '%'
	    $('.wtf-progress-percent').text (percent)
	    $('.wtf-progress-bar').css('width', percent)
        }
        wtf.mcmcTimer = setTimeout (runMCMC.bind(wtf), delayToNextRun)
    }

    function linkTerm (term) {
	var wtf = this
	return '<a target="_blank" href="' + wtf.termURL + term + '" title="' + wtf.ontology.getTermInfo(term) + '">' + term + '</a>'
    }

    function tableHeader (list) {
	return $('<thead><tr>'
		 + list.map (function (text_mouseover_cols) {
		     return text_mouseover_cols.length
			 ? ('<th'
			    + (text_mouseover_cols[2] ? (' colspan="' + text_mouseover_cols[2] + '"') : '')
			    + '><span title="' + text_mouseover_cols[1] + '">'
			    + text_mouseover_cols[0] + '</span></th>')
		     : ""
		 }).join('')
		 + '</tr></thead>')
    }
    
    var termPairProbThreshold = .05, termOddsRatioThreshold = 100
    function showTermTable (wtf) {
	var termTable = $('<table class="table table-responsive"/>')
	var termProb = wtf.mcmc.termSummary(0)
	var terms = util.sortKeys(termProb).reverse()
	wtf.termProb = termProb

	var bosons = terms.map (function() { return [] })
	var fermions = terms.map (function() { return [] })
	if (wtf.trackingTermPairs && wtf.mcmc.termPairSamples > wtf.mcmc.burn) {
	    var termPairSummary = wtf.mcmc.termPairSummary (0, terms)
	    var termPairProb = termPairSummary.pair, termPairMarginal = termPairSummary.single

	    terms.forEach (function(t,i) {
		terms.forEach (function(t2) {
		    if (t != t2) {
			var ratio = termPairProb[t][t2] / (termPairMarginal[t] * termPairMarginal[t2])
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

	var equivalents = util.keyValListToObj (terms.map (function(t) {
	    var ti = wtf.ontology.termIndex[t]
	    return [ t,
                     wtf.assocs.termsInEquivClass[wtf.assocs.equivClassByTerm[ti]]
		     .map (function(tj) { return wtf.ontology.termName[tj] }) ]
	}))
	var gotEquivalents = terms.some (function(t) { return equivalents[t].length > 0 })

	termTable.append (tableHeader
			  ([[gotEquivalents ? 'ID(s)' : 'ID', gotEquivalents ? 'IDs for ontology terms. (Terms that have exactly the same gene associations are collapsed into a single class and their probabilities aggregated, since they are statistically indistinguishable under this model.)' : 'ID of an ontology term.'],
			    [gotEquivalents ? 'Term(s)' : 'Term', 'Name of ontology term.' + (gotEquivalents ? ' (Terms that have exactly the same gene associations are collapsed into a single equivalence class and their probabilities aggregated, since they are statistically indistinguishable under this model.)' : '')],
			    ['P(Term)', 'The posterior probability that ' + (gotEquivalents ? 'one of the terms in the equivalence class' : 'the term') + ' is activated.'],
			    ['Explains', 'Genes that are associated with ' + (gotEquivalents ? 'this class of terms' : 'the term') + ' and are in the active set.'],
			    ['Also predicts', 'Genes that are associated with ' + (gotEquivalents ? 'this class of terms' : 'the term') + ' but are not in the active set.'],
			    gotBosons ? ['Positively correlated with', 'Other terms from this table that often co-occur with ' + (gotEquivalents ? 'this class of terms' : 'this term') + '. An interpretation is that these terms collaborate to explain complementary/disjoint subsets of the active genes.'] : [],
			    gotFermions ? ['Negatively correlated with', 'Other terms from this table that rarely co-occur with ' + (gotEquivalents ? 'this class of terms' : 'this term') + '. An interpretation is that these terms compete to explain similar/overlapping subsets of the active genes.'] : []]))
	var termTableBody = $('<tbody/>')
	var inGeneSet = util.objPredicate (wtf.mcmc.models[0].inGeneSet)
        terms.forEach (function (t,i) {
	    var p = termProb[t]
	    var pStyle = probStyle(p)
	    var genes = wtf.assocs.genesByTerm[wtf.ontology.termIndex[t]]
	    var explained = genes.filter (inGeneSet)
		.map (function(g) { return wtf.assocs.geneName[g] })
	    var predicted = genes.filter (util.negate (inGeneSet))
		.map (function(g) { return wtf.assocs.geneName[g] })
	    function eqtd(x) {
		return '<td rowspan="' + equivalents[t].length + '">' + x + '</td>'
	    }
	    function eqtdsets(l) {
		return eqtd (l.map(function(f){return equivalents[f].map(linkTerm.bind(wtf)).join(", ")}).join("<br/>"))
	    }
	    equivalents[t].forEach (function (e, ei) {
		termTableBody
		    .append ($('<tr style="' + pStyle + '"/>')
			     .append (stacktd(ei,linkTerm.call(wtf,e)),
				      stacktd(ei,wtf.ontology.getTermInfo(e)),
				      (ei == 0 ? eqtd(p.toPrecision(5)) : ''),
				      (ei == 0 ? eqtd(explained.join(", ")) : ''),
				      (ei == 0 ? eqtd(predicted.join(", ")) : ''),
				      (ei == 0 && gotBosons ? eqtdsets(bosons[i]) : ''),
				      (ei == 0 && gotFermions ? eqtdsets(fermions[i]) : '')))
	    })
        })
	termTable.append (termTableBody)
	$('#wtf-term-table-parent').empty()
	    .append (termTable)

        return terms
    }

    function stacktd(i,content,title) {
	var elt = (i == 0 ? $('<td/>') : $('<td style="border-top-style:none;"/>'))
	elt.html (content)
	if (title)
	    elt.attr('title',title)
	return elt
    }

    function showGeneTable (wtf, parent, geneProb, label, termsHeader, terms) {
	var geneTable = $('<table class="table table-responsive"/>')
	var genes = util.sortKeys(geneProb).reverse()
        var showTerm = terms ? util.listToCounts(terms) : {}
	geneTable.append (tableHeader
			  ([['Gene name', 'Name of the potential ' + label + ' gene.'],
			    ['P(' + label + ')', 'Posterior probability that the gene is ' + label + '.'],
			    terms ? ['Predicted by', 'A term that predicts this gene.', 2] : [],
			    terms ? ['Explains', 'Number of genes in the active set that are explained by this term.'] : [],
			    terms ? ['Also predicts', 'Number of genes that are NOT in the active set but are predicted by this term.'] : []]))
	var geneTableBody = $('<tbody/>')
	function pbtd(t,x) { return (t.length > 1 ? ('<td rowspan="' + t.length + '">') : '<td>') + x + '</td>' }
	var inGeneSet = util.objPredicate (wtf.mcmc.models[0].inGeneSet)
        genes.forEach (function (g,i) {
	    var p = geneProb[g]
	    var pStyle = probStyle(p)
	    var predictedBy = []
	    if (terms)
		wtf.assocs.termsByGene[wtf.assocs.geneIndex[g]].forEach (function (ti) {
		    var tx = wtf.assocs.getExemplar(ti)
		    if (showTerm[wtf.ontology.termName[tx]])
			predictedBy.push (wtf.ontology.termName[ti])
		})
	    if (predictedBy.length == 0)
		predictedBy = [null]

	    predictedBy.forEach (function (t, ti) {

		var genes = t ? wtf.assocs.genesByTerm[wtf.ontology.termIndex[t]] : []
		var explained = genes.filter (inGeneSet)
		    .map (function(g) { return wtf.assocs.geneName[g] })
		var predicted = genes.filter (util.negate (inGeneSet))
		    .map (function(g) { return wtf.assocs.geneName[g] })

		geneTableBody
		    .append ($('<tr style="' + pStyle + '"/>')
			     .append (ti == 0 ? pbtd(predictedBy,g) : '',
				      ti == 0 ? pbtd(predictedBy,p.toPrecision(5)) : '',
				      t ? stacktd(ti,linkTerm.call(wtf,t)) : '',
				      t ? stacktd(ti,wtf.ontology.getTermInfo(t)) : '',
				      t ? stacktd(ti,explained.length,explained.join(', ')) : '',
				      t ? stacktd(ti,predicted.length,predicted.join(', ')) : ''))
	    })
        })
	geneTable.append (geneTableBody)
	parent.empty()
	parent.append (geneTable)
    }

    var hypergeometricThreshold = .05
    function makeQuickReport() {
	var wtf = this
	if (!wtf.madeQuickReport) {
	    $('#wtf-hypergeometric-term-table-parent').empty()
	    $('#wtf-quick-report').hide()

	    getGeneSet(wtf)
		.fail (function (msg) { modalAlert (msg) })
		.done (function (validation) {
		    var relevantTerms = wtf.assocs.relevantTermsForGeneSet (validation.resolvedGeneIndices)
		    var hyperByTermIndex = wtf.assocs.hypergeometricPValues (validation.resolvedGeneIndices)
		    var sidakThreshold = 1 - Math.pow (1 - hypergeometricThreshold, 1 / relevantTerms.length)
		    var hyperByTerm = util.keyValListToObj (relevantTerms.map (function (ti) {
			return [wtf.ontology.termName[ti], hyperByTermIndex[ti]]
		    }).filter (function (tp) {
			return tp[1] < sidakThreshold
		    }))

		    wtf.hyperByTermIndex = hyperByTermIndex
		    wtf.hyperSidakThreshold = sidakThreshold

		    var termTable = $('<table class="table table-striped"/>')
		    var terms = util.sortKeys(hyperByTerm)
		    var inGeneSet = util.objPredicate (util.listToCounts (validation.resolvedGeneIndices))

		    termTable.append (tableHeader
				      ([['ID', 'The ID of an ontology term.'],
					['Name', 'The name of the term.'],
					['P-value', 'The P-value of this term, according to a one-tailed Fisher\'s exact test. This is the probability that, if the genes in the gene-set had been selected at random, they would include at least as many genes annotated to this term as they in fact did.'],
					['Explains', 'Number of genes in the specified gene-set that are explained by this term.'],
					['Also predicts', 'Number of genes that are NOT in the specified gene-set but are associated with this term.']]))
		    var termTableBody = $('<tbody/>')
		    terms.forEach (function (t,i) {
			var p = hyperByTerm[t]
			var genes = wtf.assocs.genesByTerm[wtf.ontology.termIndex[t]]
			var explained = genes.filter (inGeneSet)
			    .map (function(g) { return wtf.assocs.geneName[g] })
			var predicted = genes.filter (util.negate (inGeneSet))
			    .map (function(g) { return wtf.assocs.geneName[g] })
			termTableBody
			    .append ($('<tr/>')
				     .append ($('<td/>').html (linkTerm.call(wtf,t)),
					      $('<td/>').text (wtf.ontology.getTermInfo(t)),
					      $('<td/>').text (p.toPrecision(5)),
					      $('<td/>').text (explained.length).attr ('title', explained.join(", ")),
					      $('<td/>').text (predicted.length).attr ('title', predicted.join(", "))))
		    })
		    termTable.append (termTableBody)
		    $('#wtf-hypergeometric-term-table-parent').append (termTable)
		    $('#wtf-quick-report').show()
		    wtf.madeQuickReport = true
		})
	}
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
	wtf.targetX = [wtf.milestone.targetSamples, wtf.milestone.targetSamples]
        Plotly.newPlot( $('#wtf-loglike-plot')[0],
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
			 { x: wtf.targetX,
			   y: wtf.logLikeMinMax,
			   name: "End of run",
			   mode: 'lines',
			   hoverinfo: 'name',
			   line: { dash: 4 },
			   showlegend: false }],
			{ margin: { t:10, b:100, r:0 },
			  yaxis: { title: "Log-likelihood" },
			  xaxis: { title: "Sample number" } },
			{ autosizable: true,
			  frameMargins: .05,
			  displayModeBar: false })

	$(window).on('resize',function() {
	    redrawLogLikelihood.call(wtf)
	})
    }

    function redrawLogLikelihood() {
        var wtf = this
        if (!wtf.paused) {
	    getLogLikeRange (wtf)
            Plotly.redraw( $('#wtf-loglike-plot')[0] )
	}
    }

    function pairCheckboxClicked (evt) {
	var wtf = this

	if ($('#wtf-track-term-pairs').prop('checked')) {
	    if (!wtf.trackingTermPairs) {
		wtf.trackingTermPairs = true
		wtf.mcmc.logTermPairs()
	    }
	} else {
	    if (wtf.trackingTermPairs) {
		wtf.trackingTermPairs = false
		wtf.mcmc.stopLoggingTermPairs()
	    }
	}
    }

    function modalAlert (msg) {
        $("#wtf-modal-text").html (msg)
        $("#wtf-modal").modal()
    }
    
    function modalConfirm (msg, noText, yesText, callback) {
        $("#wtf-confirm-text").html (msg)
        $("#wtf-confirm-no-button").text(noText)
        $("#wtf-confirm-yes-button").text(yesText)
	    .on ('click', function (evt) {
		$("#wtf-confirm-yes-button").off ('click')
		callback (evt)
	    })
        $("#wtf-confirm").modal()
    }

    function cancelStart (wtf, msg) {
	if (msg)
	    modalAlert (msg)
	$('.wtf-reset').prop('disabled',false)
        $('.wtf-start').prop('disabled',false)
        enableInputControls()
    }

    function getGeneSet (wtf) {
	var def = $.Deferred()
        if (!wtf.assocs)
	    def.reject ('Please select an organism and ontology, before starting analysis.')
	else {
	    var geneNames = $('#wtf-gene-set-textarea').val().split(/\s*\n\s*/)
		.filter (function (sym) { return sym.length > 0 })
            var valid = wtf.assocs.validateGeneNames (geneNames)
	    if (valid.geneNames.length == 0)
		def.reject ('Please provide some gene names, before starting analysis.')
	    else if (valid.missingGeneNames.length > 0)
		def.reject ('Please check the following gene names, which were not found in the associations list: '
			    + '<i>' + valid.missingGeneNames.join(" ") + '</i>')
	    else
		def.resolve (valid)
	}
	return def
    }

    function startAnalysis (evt) {
        var wtf = this
	if (evt)
	    evt.preventDefault()

	$('.wtf-reset').prop('disabled',true)
        $('.wtf-start').prop('disabled',true)
        $('#wtf-gene-set-textarea').prop('disabled',true)
        $('#wtf-load-gene-set-button').prop('disabled',true)
	$('.wtf-prior').prop('disabled',true)
        disableInputControls()

	getGeneSet(wtf)
	    .fail (function (msg) { cancelStart (wtf, msg) })
	    .done (function (validation) {

		var prior = {
		    succ: {
			t: parseInt ($('#wtf-term-present-pseudocount').val()),
			fp: parseInt ($('#wtf-false-pos-pseudocount').val()),
			fn: parseInt ($('#wtf-false-neg-pseudocount').val())
		    },
		    fail: {
			t: parseInt ($('#wtf-term-absent-pseudocount').val()),
			fp: parseInt ($('#wtf-true-neg-pseudocount').val()),
			fn: parseInt ($('#wtf-true-pos-pseudocount').val())
		    }
		}

		makeQuickReport.call (wtf)

		wtf.mcmc = new MCMC ({ assocs: wtf.assocs,
			               geneSets: [validation.geneNames],
				       prior: prior,
                                       moveRate: {
					   flip: 1,
					   step: 1,
					   jump: 1
                                       },
				       seed: 123456789
			             })

		var samplesPerTerm = $('#wtf-target-samples-per-term').val()
		wtf.mcmc.burn = $('#wtf-burn-per-term').val() * wtf.mcmc.nVariables()
		wtf.milestone.targetSamples = wtf.mcmc.burn + samplesPerTerm * wtf.mcmc.nVariables()
		wtf.milestone.startOfRun = 0

		wtf.mcmc.logLogLikelihood (true)

		wtf.milestonePassed = {}
		wtf.trackingTermPairs = false

		$('.wtf-mcmc-status').show()

		$('.wtf-start').prop('disabled',false)
		$('.wtf-reset').show()

		$('.wtf-progress-header').show()
		$('.wtf-progress-bar').css('width','0%')

		resumeAnalysis.call(wtf)
		plotLogLikelihood.call(wtf)
		runMCMC.call(wtf)
            })
    }

    function pauseAnalysis (evt, type, reason) {
        var wtf = this
	if (evt)
	    evt.preventDefault()

        wtf.paused = true
        $('.wtf-start').html('More sampling')
        $('.wtf-start').off('click')
        $('.wtf-start').on('click',resumeAnalysis.bind(wtf))
	$('.wtf-reset').prop('disabled',false)

	$('#wtf-track-term-pairs').off('click')
        $('.wtf-sampler-notifications').append (makeAlert (type || 'warning',
                                                           'The sampler was paused at ' + Date() + (reason ? (', because ' + reason) : '') + '.'))

	$('#wtf-samples-per-sec').text(0)
	$('.wtf-progress-bar').removeClass('active')
    }

    function resumeAnalysis (evt) {
        var wtf = this
	if (evt)
	    evt.preventDefault()

	if (wtf.milestonePassed.targetSamples) {
	    delete wtf.milestonePassed.targetSamples
	    var samplesPerTerm = $('#wtf-target-samples-per-term').val()
	    wtf.milestone.startOfRun = wtf.mcmc.samplesIncludingBurn
	    wtf.milestone.targetSamples += samplesPerTerm * wtf.mcmc.nVariables()
	    wtf.targetX[0] = wtf.targetX[1] = wtf.milestone.targetSamples
	}

        wtf.paused = false
        $('.wtf-start').html('Stop sampling')
        $('.wtf-start').off('click')
        $('.wtf-start').on('click',pauseAnalysis.bind(wtf))
        $('.wtf-reset').prop('disabled',true)

	pairCheckboxClicked.call(wtf)
	$('#wtf-track-term-pairs').on('click',pairCheckboxClicked.bind(wtf))

        disableInputControls()
	$("#wtf-target-samples-per-term").prop('disabled',true)
        $('.wtf-sampler-notifications').append (makeAlert ('success', 'The sampler was started at ' + Date() + '.'))

	$('.wtf-progress-bar').addClass('active')
    }

    function reset (evt) {
	var wtf = this
	if (evt)
	    evt.preventDefault()
	if (wtf.mcmcTimer) {
	    clearTimeout (wtf.mcmcTimer)
	    delete wtf.mcmcTimer
	}

	delete wtf.mcmc
	wtf.paused = true

	$('.wtf-start').off('click')
	$('.wtf-start')
            .on('click', startAnalysis.bind(wtf))

	cancelStart(wtf)
        $('.wtf-start').text('Start sampling')

	$('.wtf-mcmc-status').hide()
	$('.wtf-results').hide()
        $('.wtf-reset').hide()
        $('.wtf-sampler-notifications').empty()
	$("#wtf-target-samples-per-term").prop('disabled',false)

	$('.wtf-progress-header').hide()
    }

    function inputControls() {
        return $('#wtf-example-gene-set-button, #wtf-select-organism-button, #wtf-select-ontology-button, #wtf-gene-set-textarea, #wtf-load-gene-set-button, .wtf-prior')

    }
    
    function disableInputControls() {
        inputControls().prop('disabled',true)
        $('.wtf-input-panel').attr('title','These controls are disabled once sampling begins. To modify them, reset the sampler.')
    }
    
    function enableInputControls() {
        inputControls().prop('disabled',false)
        $('.wtf-input-panel').attr('title','')
    }
    
    function exampleLoader (wtf, exampleJson) {
        return function (evt) {
	    evt.preventDefault()
	    $('#wtf-gene-set-textarea').val (exampleJson.genes.join("\n"))
            showOrHideSamplerControls.call(wtf)
        }
    }
    
    function log() {
        console.log (Array.prototype.slice.call(arguments).join(''))
    }

    function textInput() {
	return $('<input type="text" size="5"/>')
    }

    function selectPage (wtf, id) {
        $('.wtf-page').hide()
        $('.wtf-link').removeClass('active-menu')
        $('.wtf-' + id + '-link').addClass('active-menu')
        $('#wtf-' + id + '-page').show()
	if (id == 'quick-report')
	    setTimeout (makeQuickReport.bind(wtf), 1)  // don't delay redraw
	else if (id == 'term-report' || id == 'gene-report') {
	    if (!wtf.mcmc)
		modalAlert ("You won't see anything on this page until you start running the sampler.")
	}
    }

    function makeAlert (type, text) {
        return '<div class="alert alert-' + type + ' alert-dismissable">'
            + '<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>'
            + text
            + '</div>'
    }

    function makeLink (url, text) {
        return '<a href="' + url + '">' + text + '</a>'
    }
    
    function initialize() {
	var wtf = this

	var ontologyReady = $.Deferred(),
	assocsReady = $.Deferred()

	// load ontology
	wtf.log ("Loading ontology...")
        $('#wtf-ontology-notifications')
            .append (makeAlert ('info',
                                'Loading ' + wtf.ontologyName))
	$.get(wtf.ontologyURL)
	    .done (function (ontologyJson) {
		wtf.ontology = new Ontology (ontologyJson)
                
		wtf.log ("Loaded ontology ", wtf.ontologyName, " with ", wtf.ontology.terms(), " terms")

		$('.wtf-term-count').text (wtf.ontology.terms())

                $('#wtf-ontology-notifications')
                    .append (makeAlert ('success',
                                        'Loaded ' + wtf.ontologyName + ' with ' + wtf.ontology.terms() + ' terms'))

		ontologyReady.resolve()
	    }).fail (function() {
                $('#wtf-ontology-notifications')
                    .append (makeAlert ('warning',
                                        'There was a problem loading ' + wtf.ontologyName + ' from '
                                        + makeLink (ontologyURL, wtf.ontologyURL)))
	    })

	// load associations
	ontologyReady.done (function() {
	    wtf.log ("Loading gene-term associations...")
            $('#wtf-ontology-notifications')
                .append (makeAlert ('info',
                                    'Loading ' + wtf.ontologyName + '&harr;' + wtf.organismName + ' associations'))
	    $.get(wtf.assocsURL)
		.done (function (assocsJson) {
		    wtf.assocs = new Assocs ({ ontology: wtf.ontology,
					       idAliasTerm: assocsJson.idAliasTerm })

		    wtf.log ("Loaded ", wtf.assocs.nAssocs, " associations (", wtf.assocs.genes(), " genes, ", wtf.assocs.relevantTerms().length, " terms)")

		    $('.wtf-relevant-term-count').text (wtf.assocs.relevantTerms().length)
		    $('.wtf-gene-count').text (wtf.assocs.genes())

                    $('#wtf-ontology-notifications')
                        .append (makeAlert ('success',
                                            'Loaded ' + wtf.assocs.nAssocs + ' associations (' + wtf.assocs.genes() + ' genes, ' + wtf.assocs.relevantTerms().length + ' terms)'))

		    assocsReady.resolve()
		}).fail (function() {
                $('#wtf-ontology-notifications')
                    .append (makeAlert ('warning',
                                        'There was a problem loading ' + wtf.ontologyName + '&harr;' + wtf.organismName + ' associations from '
                                        + makeLink (wtf.assocsURL, wtf.assocsURL)))
		})
	})

	// initialize form
	assocsReady.done (function() {

            showOrHideSamplerControls.call(wtf)

            var examples = wtf.organismExamples.concat (wtf.ontologyExamples)
	    $('#wtf-example-list').empty()
	    $('#wtf-example-list').append (examples.map (function (exampleJson) {
		return $('<li><a href="#">' + exampleJson.name + '</a></li>')
		    .click (exampleLoader (wtf, exampleJson))
	    }))
            
	    if (examples.length)
		$('#wtf-example-gene-set-button').show()
	    else
		$('#wtf-example-gene-set-button').hide()
	})
    }

    function organismSelector(wtf,orgJson) {
	return function (evt) {
	    evt.preventDefault()
	    if (wtf.organismName != orgJson.name) {

		wtf.organismName = orgJson.name
                wtf.organismExamples = orgJson.examples || []

		delete wtf.ontologyName
                delete wtf.ontology
                delete wtf.assocs
		delete wtf.madeQuickReport
		delete wtf.hyperByTermIndex

		$('#wtf-select-organism-button-text').text (orgJson.name)
		$('.wtf-organism-name').text (orgJson.name)

		$('#wtf-select-ontology-button').show()
		$('#wtf-select-ontology-button-text').text('Select ontology')

		$('#wtf-ontology-list').empty()
		$('#wtf-ontology-list').append (orgJson.ontologies.map (function (ontoJson) {
		    return $('<li><a href="#">' + ontoJson.name + '</a></li>')
			.click (ontologySelector(wtf,ontoJson))
		}))

                $('#wtf-example-gene-set-button').hide()
                $('#wtf-ontology-notifications').empty()

                showOrHideSamplerControls.call(wtf)

	        reset.call (wtf)
            }
	}
    }

    function ontologySelector(wtf,ontoJson) {
	return function (evt) {
	    evt.preventDefault()
	    if (wtf.ontologyName != ontoJson.name) {

		wtf.ontologyName = ontoJson.name
		wtf.ontologyURL = ontoJson.ontology
		wtf.assocsURL = ontoJson.assocs
                wtf.termURL = ontoJson.term || 'http://amigo.geneontology.org/amigo/term/'
                wtf.ontologyExamples = ontoJson.examples || []
		
                delete wtf.ontology
                delete wtf.assocs
		delete wtf.madeQuickReport
		delete wtf.hyperByTermIndex

		$('#wtf-select-ontology-button-text').text (ontoJson.name)
		$('.wtf-ontology-name').text (ontoJson.name)
                $('#wtf-ontology-notifications').empty()

                showOrHideSamplerControls.call(wtf)

		initialize.call(wtf)
	    }
	}
    }

    function showOrHideSamplerControls() {
        var wtf = this
        if (wtf.assocs && $('#wtf-gene-set-textarea').val().search(/\S/) >= 0)
            $('#wtf-sampler-controls').show()
        else
            $('#wtf-sampler-controls').hide()
    }
    
    function WTFgenes (conf) {
        var wtf = this
	conf = conf || {}

	// populate wtf object
        $.extend (wtf, { datasetsURL: conf.datasets || "./datasets.json",
                         milestone: {},
                         milestonePassed: {},
			 log: log })

        // set up sidebar menu
        $('.wtf-page').hide()
        selectPage (wtf, 'data')
        $('.wtf-page-inner').show()
        $('.wtf-link').click (function (evt) {
	    evt.preventDefault()
            selectPage (wtf, evt.target.getAttribute('data-target'))
        })
        
	// set up data page
	$('#wtf-select-organism-button-text').text('Select organism')
	$('#wtf-select-ontology-button').hide()
        $('#wtf-example-gene-set-button').hide()
	$('#wtf-sampler-controls').hide()

        $('#wtf-gene-set-textarea').bind ('input propertychange', function() {
	    showOrHideSamplerControls.bind(wtf)
	    delete wtf.madeQuickReport
	    delete wtf.hyperByTermIndex
	})

	$('#wtf-gene-set-file-selector').on ('change', function (fileSelectEvt) {
	    var reader = new FileReader()
	    reader.onload = function (fileLoadEvt) {
		$('#wtf-gene-set-textarea').val (fileLoadEvt.target.result)
	    }
	    reader.readAsText(fileSelectEvt.target.files[0])
	})
	$('#wtf-load-gene-set-button')
	    .on ('click', function (evt) {
		evt.preventDefault()
		$('#wtf-gene-set-file-selector').click()
		return false
	    })

	$('.wtf-reset')
	    .on('click', function() {
		modalConfirm ("Do you really want to reset? This will erase all the statistics the sampler has accumulated (i.e. the Term and Gene reports).", "No, I've relented", "Yes, wipe it all", reset.bind(wtf))
	    })

        // set up parameters page
	$('#wtf-term-present-pseudocount').val(1)
	$('#wtf-term-absent-pseudocount').val(99)
	$('#wtf-false-pos-pseudocount').val(1)
	$('#wtf-true-neg-pseudocount').val(99)
	$('#wtf-false-neg-pseudocount').val(1)
	$('#wtf-true-pos-pseudocount').val(99)

        // set up sampler & results pages
	$('#wtf-burn-per-term').val(10)
	$('#wtf-target-samples-per-term').val(100)
        reset.call (wtf)
        
	// create the timer that sets the 'redraw' flag. Leave this running forever
	wtf.redrawTimer = setInterval (setRedraw.bind(wtf), 1000)

        // load dataset file
        wtf.log ("Loading datasets...")
        $.get(wtf.datasetsURL)
            .done (function (datasetsJson) {
		wtf.datasets = datasetsJson
		wtf.log ("Loaded " + wtf.datasets.organisms.length + " organisms")
		wtf.datasets.organisms.forEach (function (orgJson) {
		    $('#wtf-organism-list').append
		    ($('<li><a href="#">' + orgJson.name + '</a></li>')
		     .click (organismSelector(wtf,orgJson)))
		})

            }).fail (function() {
		wtf.log("Problem loading " + wtf.datasetsURL)
	    })
    }

    global.WTFgenes = WTFgenes
})()
