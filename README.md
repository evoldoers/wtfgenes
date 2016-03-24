# wtfgenes

What is The Function of these genes?

Implements MCMC term enrichment, loosely based on the following model:

Nucleic Acids Res. 2010 Jun;38(11):3523-32. doi: 10.1093/nar/gkq045.
GOing Bayesian: model-based gene set analysis of genome-scale data.
Bauer S, Gagneur J, Robinson PN.

http://www.ncbi.nlm.nih.gov/pubmed/20172960

<pre><code>
Usage: node wtfgenes.js

  -o, --ontology=PATH     path to ontology file
  -a, --assoc=PATH        path to gene-term association file
  -g, --genes=PATH+       path to gene-set file
  -n, --numsamples=N      number of samples
  -i, --ignore-missing    ignore missing terms & genes
  -A, --term-absent=N     pseudocount for absent terms (default=#terms)
  -N, --true-positive=N   pseudocount for true positives (default=#genes)
  -P, --true-negative=N   pseudocount for true negatives (default=#genes)
  -F, --flip-rate=N       relative rate of term-toggling moves (default=1)
  -S, --swap-rate=N       relative rate of term-swapping moves (default=1)
  -R, --randomize-rate=N  relative rate of term-randomizing moves (default=0)
  -l, --log=TAG+          log various things (e.g. "move", "state")
  -s, --seed=N            seed random number generator (default=123456789)
  -h, --help              display this help

</code></pre>
