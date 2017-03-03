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
