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
		showGeneTable (wtf, $('#wtf-false-pos-table-parent'), wtf.mcmc.geneFalsePosSummary(0),
			       "mislabeled")
		showGeneTable (wtf, $('#wtf-false-neg-table-parent'), wtf.mcmc.geneFalseNegSummary(0),
			       "mislabeled", terms)
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
    
    var termPairProbThreshold = .05, termOddsRatioThreshold = 100
    function showTermTable (wtf) {
	var termTable = $('<table></table>')
	var termProb = wtf.mcmc.termSummary(0)
	var terms = util.sortKeys(termProb).reverse()

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

	termTable.append ($('<tr>'
			    + [[gotEquivalents ? 'Term(s)' : 'Term', 'An ontology term' + (gotEquivalents ? ', or class of terms. (Terms that have exactly the same gene associations are collapsed into a single equivalence class and their probabilities aggregated, since they are statistically indistinguishable under this model.)' : '')],
			       ['P(Term)', 'The posterior probability that the term is activated.'],
			       ['Explains', 'Genes that are associated with the term and are in the active set.'],
			       ['Also predicts', 'Genes that are associated with the term but are not in the active set.'],
			       gotBosons ? ['Positively correlated with', 'Other terms from this table that often co-occur with this term. An interpretation is that these terms collaborate to explain complementary/disjoint subsets of the active genes.'] : [],
			       gotFermions ? ['Negatively correlated with', 'Other terms from this table that rarely co-occur with this term. An interpretation is that these terms compete to explain similar/overlapping subsets of the active genes.'] : []]
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
                           + '<td>' + equivalents[t].map(function(e) {
			       return linkTerm.call(wtf,e) + ' ' + wtf.ontology.getTermInfo(e)
			   }).join('<br/>') + '</td>'
			   + '<td>' + p.toPrecision(5) + '</td>'
			   + '<td>' + explained.join(", ") + '</td>'
			   + '<td>' + predicted.join(", ") + '</td>'
			   + (gotBosons ? '<td>' + bosons[i].map(function(b){return equivalents[b].map(linkTerm.bind(wtf)).join(", ")}).join("<br/>") + '</td>' : '')
			   + (gotFermions ? '<td>' + fermions[i].map(function(f){return equivalents[f].map(linkTerm.bind(wtf)).join(", ")}).join("<br/>") + '</td>' : '')
			   + '</tr>'))
        })
	$('#wtf-term-table-parent').empty()
	    .append (termTable)

        return terms
    }

    function showGeneTable (wtf, parent, geneProb, label, terms) {
	var geneTable = $('<table></table>')
	var genes = util.sortKeys(geneProb).reverse()
        var showTerm = terms ? util.listToCounts(terms) : {}
	geneTable.append ($('<tr><th>Gene name</th><th>P(' + label + ')</th>'
                            + (terms ? '<th>Predicted by terms</th>' : '')
                            + '</tr>'))
        genes.forEach (function (g,i) {
	    var p = geneProb[g]
	    var pStyle = probStyle(p)
	    geneTable
		.append ($('<tr>'
			   + '<td ' + pStyle + '>' + g + '</td>'
			   + '<td ' + pStyle + '>' + p.toPrecision(5) + '</td>'
                           + (terms
                              ? ('<td ' + pStyle + '>' + wtf.assocs.termsByGene[wtf.assocs.geneIndex[g]]
                                 .map (function (ti) { return wtf.ontology.termName[ti] })
                                 .filter (function (t) { return showTerm[t] })
                                 .map (function (t) {
			             return linkTerm.call(wtf,t) + ' ' + wtf.ontology.getTermInfo(t)
			         }).join('<br/>') + '</td>')
                              : '')
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
    
    function cancelStart (wtf, msg) {
	if (msg) {
            $("#wtf-cancel-start-text").html (msg)
            $("#wtf-cancel-start").modal()
        }
	$('.wtf-reset').prop('disabled',false)
        $('.wtf-start').prop('disabled',false)
        enableInputControls()
    }

    function startAnalysis (evt) {
        var wtf = this
	if (evt)
	    evt.preventDefault()

        if (!wtf.assocs) {
	    cancelStart (wtf, "Please select an organism and ontology, before running the sampler.")
            return
        }
        
	$('.wtf-reset').prop('disabled',true)
        $('.wtf-start').prop('disabled',true)
        $('#wtf-gene-set-textarea').prop('disabled',true)
        $('#wtf-load-gene-set-button').prop('disabled',true)
	$('.wtf-prior').prop('disabled',true)
        disableInputControls()
        var geneNames = $('#wtf-gene-set-textarea').val().split("\n")
            .filter (function (sym) { return sym.length > 0 })
        var validation = wtf.assocs.validateGeneNames (geneNames)
	if (geneNames.length == 0) {
	    cancelStart (wtf, "Please provide some gene names, before running the sampler.")
	} else if (validation.missingGeneNames.length > 0)
	    cancelStart (wtf, "Please check the following gene names, which were not found in the associations list: <i>" + validation.missingGeneNames.join(" ") + '</i>')
	else {

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
        }
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
    
    function loadExample (evt) {
        var wtf = this
	if (evt)
	    evt.preventDefault()

	if (wtf.exampleText) {
	    $('#wtf-gene-set-textarea').val (wtf.exampleText)
            showOrHideSamplerControls.call(wtf)
	} else
            $.get (wtf.exampleURL, function (data) {
		$('#wtf-gene-set-textarea').val (wtf.exampleText = data)
                showOrHideSamplerControls.call(wtf)
	    })
    }
    
    function log() {
        console.log (Array.prototype.slice.call(arguments).join(''))
    }

    function textInput() {
	return $('<input type="text" size="5"/>')
    }

    function selectPage (id) {
        $('.wtf-page').hide()
        $('.wtf-link').removeClass('active-menu')
        $('#wtf-' + id + '-page').show()
        $('#wtf-' + id + '-link').addClass('active-menu')
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
					       assocs: assocsJson })
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

	    if (wtf.exampleURL)
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
		delete wtf.ontologyName
                delete wtf.ontology
                delete wtf.assocs

		$('#wtf-select-organism-button-text').text (orgJson.name)
		$('.wtf-organism-name').text (orgJson.name)

                showOrHideSamplerControls.call(wtf)
                $('#wtf-example-gene-set-button').hide()
		$('#wtf-select-ontology-button').show()
		$('#wtf-select-ontology-button-text').text('Select ontology')

                $('#wtf-ontology-notifications').empty()

		$('#wtf-ontology-list').empty()
		$('#wtf-ontology-list').append (orgJson.ontologies.map (function (ontoJson) {
		    return $('<li><a href="#">' + ontoJson.name + '</a></li>')
			.click (ontologySelector(wtf,ontoJson))
		}))

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
		wtf.exampleURL = ontoJson.example
                wtf.termURL = ontoJson.term || 'http://amigo.geneontology.org/amigo/term/'
		
                $('#wtf-ontology-notifications').empty()
		$('#wtf-select-ontology-button-text').text (ontoJson.name)
		$('.wtf-ontology-name').text (ontoJson.name)

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
        selectPage ('data')
        $('.wtf-page-inner').show()
        $('.wtf-link').click (function (evt) {
	    evt.preventDefault()
            selectPage (evt.target.getAttribute('data-target'))
        })
        
	// set up data page
	$('#wtf-select-organism-button-text').text('Select organism')
	$('#wtf-select-ontology-button').hide()
        $('#wtf-example-gene-set-button').hide()
	$('#wtf-sampler-controls').hide()

        $('#wtf-gene-set-textarea').bind ('input propertychange', showOrHideSamplerControls.bind(wtf))
	$('#wtf-example-gene-set-button').on('click',loadExample.bind(wtf))

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
	    .on('click', reset.bind(wtf))

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
