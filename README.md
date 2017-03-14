[![Build Status](https://travis-ci.org/evoldoers/wtfgenes.svg?branch=master)](https://travis-ci.org/evoldoers/wtfgenes)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

# wtfgenes

**"What's The Function of these genes?"**

Answer this question with Bayesian [Term Enrichment Analysis](https://en.wikipedia.org/wiki/Gene_Ontology_Term_Enrichment) (TEA)
using a model described [here](https://github.com/ihh/wtfgenes-appnote/blob/master/main.pdf)
and loosely based on the following method:

- Nucleic Acids Res. 2010. [GOing Bayesian: model-based gene set analysis of genome-scale data.](http://www.ncbi.nlm.nih.gov/pubmed/20172960) Bauer S, Gagneur J, Robinson PN.

The wtfgenes software also implements Frequentist TEA (a.k.a. Fisher's [tea-tasting test](https://en.wikipedia.org/wiki/Lady_tasting_tea)).

## Demo

A demo of the wtfgenes web client for the [annotated genomes](http://www.geneontology.org/page/download-annotations) of the GO consortium can be found at https://evoldoers.github.io/wtfgo/

## Repository structure

The repository contains two implementations of Bayesian and Frequentist TEA:
- a JavaScript implementation in the `lib` and `bin` directories, which can be used either with [node](https://nodejs.org/), or via a web client in the `web` directory
- a C++11 implementation in the `cpp` directory

The two implementations should be identical at the level of numerical output,
although the C++ version is about twice as fast.
This guide focuses mostly on the JavaScript implementation; the C++ version is similar but does not use JSON files.

## Installation

### JavaScript version

Prerequisites:
- node v6.0.0+

~~~~
    cd wtfgenes
    npm install
    bin/wtfgenes.js --help
~~~~

### C++11 version

Prerequisites:
- clang (Apple LLVM version 7.3.0+)
- gsl (version 2.2.1+)
- boost (version 1.63.0+)

~~~~
    cd wtfgenes/cpp
    make
    bin/wtfgenes --help
~~~~

## Input and output formats

The software requires several data files:
- An *ontology file* in [OBO format](http://owlcollab.github.io/oboformat/doc/GO.format.obo-1_2.html)
- A *gene-term association file* in [GAF format](http://www.geneontology.org/page/go-annotation-file-format-20)
- A *gene-set file* that is just a flatfile containing a list of gene names

The OBO and GAF files can be pre-converted to a more compact JSON format for setting up a static website.
The GAF converter can optionally accept a file of gene name aliases.

## Basic operation (node script)

The node script is [bin/wtfgenes.js](https://github.com/evoldoers/wtfgenes/blob/master/bin/wtfgenes.js).
The basic sequence of operations is described [here](https://github.com/ihh/wtfgenes-appnote).
Essentially, you run the [MCMC sampler](https://en.wikipedia.org/wiki/Markov_chain_Monte_Carlo) for a while, and then you get a report on which terms are enriched in the dataset.

## Basic operation (web client)

The web client is pretty much the same as the node script, except it comes pre-loaded with data, and you can visualize the MCMC sampling run using [plot.ly](https://plot.ly/).
You can see a demo of the web client [here](https://evoldoers.github.io/wtfgo/).

### Setting up the web client

To set up the web client as a [static site](https://en.wikipedia.org/wiki/Static_web_page), you need to perform the following steps:
- run the [bin/create-site.js](https://github.com/evoldoers/wtfgenes/blob/master/bin/create-site.js) script to create a static site directory
- run the [bin/add-to-site.js](https://github.com/evoldoers/wtfgenes/blob/master/bin/add-to-site.js) script as many times as you want to add GAF-format gene-term association files (and the accompanying OBO-format ontologies) to the site, optionally with gene ID aliases and example sets
- hand-edit the [index.html](https://github.com/evoldoers/wtfgenes/blob/master/web/index.html) file in the static site directory to include any additional text you want to include
- move the static site directory to someplace your webserver can see (it's OK to rename it)

Since the web client consists of web-browsable files and does not need to execute any code on a server,
you can serve it up from any static web hosting service; for example, [Amazon S3](https://aws.amazon.com/s3/) or [GitHub pages](https://pages.github.com/).

For example, to set up a static site for yeast:

    curl -O http://geneontology.org/ontology/go-basic.obo
    curl -O http://geneontology.org/gene-associations/gene_association.sgd.gz
    gunzip gene_association.sgd.gz
    bin/create-site.js yeast
    bin/add-to-site.js yeast -s "S.cerevisiae" -n "Gene ontology" -o go-basic.obo -g gene_association.sgd
    bin/add-to-site.js yeast -e "Mating genes" -i "STE2 STE3 STE5 GPA1 SST2 STE11 STE50 STE20 STE4 STE18 FUS3 KSS1 PTP2 MSG5 DIG1 DIG2 STE12"
    bin/add-to-site.js yeast -e "Sulfate assimilation and nitrogen utilization" -i "MET10 MET1 MET14 MET22 MET3 MET5 MET8 TRX1 SUL1 FZF1 SUL2 OAC1 ATF1 ATF2 ADY2 ATO2 ATO3 MEP1 MEP2 MEP3 UGA1 UGA3 YGR125W YPR003C YIL165C MKS1 NPR1 RSP5 URE2 VID30 AGC1 CPS1 GDH2 DAL80 GZF3 PPH3 GAT1 RTG2 UME6"

The `create-site.js` and `add-to-site.js` scripts should be self-documenting (use the `-h` option to show a brief help message).

Behind the scenes, the `create-site.js` script simply makes a copy of the `web/` directory.
Subsequently running `add-to-site.js` is roughly equivalent to manually performing the following steps:
- run the [bin/obo2json.js](https://github.com/evoldoers/wtfgenes/blob/master/bin/obo2json.js) script to convert OBO-format ontology file(s) to JSON
- run the [bin/gaf2json.js](https://github.com/evoldoers/wtfgenes/blob/master/bin/gaf2json.js) script to convert GAF-format gene-term association file(s) to JSON
- save the output of the above two steps to files in your static site directory with appropriate (unique) filenames
- hand-edit the copied [web/datasets.json](https://github.com/evoldoers/wtfgenes/blob/master/web/datasets.json) file to point to the JSON ontology and gene-term association files you just generated, and any example gene sets you want to include

## Command-line usage (node)

<pre><code>
Usage: node wtfgenes.js

  -o, --ontology=PATH      path to ontology file
  -a, --assoc=PATH         path to gene-term association file
  -g, --genes=PATH+        path to gene-set file(s)
  -s, --samples=N          number of samples per term (default=100)
  -u, --burn=N             number of burn-in samples per term (default=10)
  -t, --term-prob=N        mode of term probability prior (default=0.5)
  -T, --term-count=N       #pseudocounts of term probability prior (default=0)
  -n, --false-neg-prob=N   mode of false negative prior (default=0.5)
  -N, --false-neg-count=N  #pseudocounts of false negative prior (default=0)
  -p, --false-pos-prob=N   mode of false positive prior (default=0.5)
  -P, --false-pos-count=N  #pseudocounts of false positive prior (default=0)
  -F, --flip-rate=N        relative rate of term-toggling moves (default=1)
  -S, --step-rate=N        relative rate of term-stepping moves (default=1)
  -J, --jump-rate=N        relative rate of term-jumping moves (default=1)
  -R, --randomize-rate=N   relative rate of term-randomizing moves (default=0)
  -i, --init-terms=LIST+   specify initial state as comma-separated term list
  -l, --log=TAG+           log extra things (e.g. "move", "state", "mixing")
  -q, --quiet              don't log the usual things ("data", "progress")
  -r, --rnd-seed=N         seed random number generator (default=123456789)
  -m, --simulate=N         instead of doing inference, simulate N gene sets
  -x, --exclude-redundant  exclude redundant terms from simulation
  -X, --exclude-ancestral  exclude ancestral terms from simulation
  -w, --exclude-with=N     exclude terms with &gt;=N gene associations from simulation
  -A, --active-terms=N     specify number of active terms for simulation
  -O, --false-pos=P        specify false positive probability for simulation
  -E, --false-neg=P        specify false negative probability for simulation
  -b, --benchmark          benchmark by running inference on simulated data
  -B, --bench-reps=N       number of repetitions of benchmark (default=1)
  -h, --help               display this help message

</code></pre>
