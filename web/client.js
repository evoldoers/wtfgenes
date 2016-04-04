(function() {
    var MersenneTwister = require('mersennetwister'),
        assert = require('assert'),
        util = require('../lib/util'),
        Ontology = require('../lib/ontology'),
        Assocs = require('../lib/assocs'),
        Model = require('../lib/model'),
        MCMC = require('../lib/mcmc')

    function startAnalysis() {
        var wtf = this
        var geneSet = wtf.geneSetTextArea.val().split("\n")
            .filter (function (sym) { return sym.length > 0 })
        var validation = assocs.validateGeneNames (geneSet)
	if (validation.missingGeneNames.length > 0)
	    alert ("Please check the following gene names, which were not found in the associations list: " + validation.missingGeneNames)
        else {
            wtf.geneSet = validation.geneIndices
            wtf.mcmc = new MCMC ({ assocs: assocs,
			           geneSets: [wtf.geneSet]
			         })
            // WRITE ME
        }
    }

    function WTFgenes (conf) {
        var wtf = this

        $.extend (wtf, { ontologyURL: conf.ontology,
                         assocsURL: conf.assocs })

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
            wtf.helpText = $('<span>Enter gene names, one per line:</span>')
            wtf.geneSetTextArea = $('<textarea id="wtfgenes" rows="10" cols="80"/>')
            wtf.startButton = $('<button type="button">Start analysis</button>')
                .click (startAnalysis.bind(wtf))

            wtf.parentDiv.append ('<br/><br/>',
                                  wtf.helpText,
                                  '<br/>',
                                  wtf.geneTextArea,
                                  '<br/>',
                                  wtf.startButton)
        })
    }

    global.WTFgenes = WTFgenes
})()
