[![Build Status](https://travis-ci.org/evoldoers/wtfgenes.svg?branch=master)](https://travis-ci.org/evoldoers/wtfgenes)

# wtfgenes

**What's The Function of these genes?**

Answer this question with Bayesian [Term Enrichment Analysis](https://en.wikipedia.org/wiki/Gene_Ontology_Term_Enrichment) (TEA)
using a model described [here](https://github.com/ihh/wtfgenes-appnote/blob/master/main.pdf)
and loosely based on the following method:

- Nucleic Acids Res. 2010. [GOing Bayesian: model-based gene set analysis of genome-scale data.](http://www.ncbi.nlm.nih.gov/pubmed/20172960) Bauer S, Gagneur J, Robinson PN.

The wtfgenes software also implements Frequentist TEA (a.k.a. Fisher's ["lady tasting tea"](https://en.wikipedia.org/wiki/Lady_tasting_tea) test).

## Demo

A demo of the wtfgenes web client for the [annotated genomes](http://www.geneontology.org/page/download-annotations) of the GO consortium can be found at https://evoldoers.github.io/wtfgo/

## Repository structure

The repository contains two implementations of Bayesian and Frequentist TEA:
- a JavaScript implementation in the `lib` and `bin` directories, which can be used either with [node](https://nodejs.org/), or via a web client in the `web` directory
- a C++11 implementation in the `cpp` directory

The two implementations should be identical at the level of numerical output,
although the C++ version is about twice as fast.
This guide focuses on the JavaScript implementation; the C++ version is similar but does not use JSON files.

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

At the moment, to set up the web client as a [static site](https://en.wikipedia.org/wiki/Static_web_page), you need to manually perform the following steps:
- run the [bin/obo2json.js](https://github.com/evoldoers/wtfgenes/blob/master/bin/obo2json.js) script to convert OBO-format ontology file(s) to JSON
- run the [bin/gaf2json.js](https://github.com/evoldoers/wtfgenes/blob/master/bin/gaf2json.js) script to convert GAF-format gene-term association file(s) to JSON
- save the output of the above two steps to files in the `web/` directory with appropriate (unique) filenames
- hand-edit the [web/datasets.json](https://github.com/evoldoers/wtfgenes/blob/master/web/datasets.json) file to point to the JSON ontology and gene-term association files you just generated, and any example gene sets you want to include
- hand-edit the [web/index.html](https://github.com/evoldoers/wtfgenes/blob/master/web/index.html) file to include any additional text you want to include
- move the `web/` directory to someplace your webserver can see (it's OK to rename it)

Since the web client consists of web-browsable files and does not need to execute any code on a server,
you can serve it up from any static web hosting service; for example, [Amazon S3](https://aws.amazon.com/s3/) or [GitHub pages](https://pages.github.com/).

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
  -A, --active-terms=N     specify number of active terms for simulation
  -O, --false-pos=P        specify false positive probability for simulation
  -E, --false-neg=P        specify false negative probability for simulation
  -b, --benchmark          benchmark by running inference on simulated data
  -B, --bench-reps=N       number of repetitions of benchmark (default=1)
  -h, --help               display this help message

</code></pre>
