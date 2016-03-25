# wtfgenes

What is The Function of these genes?

Implements MCMC term enrichment, loosely based on the following model:

Nucleic Acids Res. 2010 Jun;38(11):3523-32. doi: 10.1093/nar/gkq045.
GOing Bayesian: model-based gene set analysis of genome-scale data.
Bauer S, Gagneur J, Robinson PN.

http://www.ncbi.nlm.nih.gov/pubmed/20172960

<pre><code>
Usage: node wtfgenes.js

  -o, --ontology=PATH      path to ontology file
  -a, --assoc=PATH         path to gene-term association file
  -g, --genes=PATH+        path to gene-set file(s)
  -s, --samples=N          number of samples per term (default=100)
  -i, --ignore-missing     ignore missing terms & genes
  -T, --terms=N            pseudocount: active terms (default=1)
  -t, --absent-terms=N     pseudocount: inactive terms (default=#terms)
  -N, --false-negatives=N  pseudocount: false negatives (default=1)
  -p, --true-positives=N   pseudocount: true positives (default=#genes)
  -P, --false-positives=N  pseudocount: false positives (default=1)
  -n, --true-negatives=N   pseudocount: true negatives (default=#genes)
  -F, --flip-rate=N        relative rate of term-toggling moves (default=1)
  -S, --swap-rate=N        relative rate of term-swapping moves (default=1)
  -R, --randomize-rate=N   relative rate of term-randomizing moves (default=0)
  -l, --log=TAG+           log various extra things (e.g. "move", "state")
  -q, --quiet              don't log the usual things ("data", "progress")
  -r, --rnd-seed=N         seed random number generator (default=123456789)
  -m, --simulate=N         instead of doing inference, simulate N gene sets
  -x, --exclude-redundant  exclude redundant terms from simulation
  -b, --benchmark          benchmark by running inference on simulated data
  -h, --help               display this help message

</code></pre>
