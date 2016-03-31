#include <fstream>
#include <stdexcept>
#include <boost/program_options.hpp>
#include "../src/ontology.h"
#include "../src/assocs.h"
#include "../src/bernoulli.h"
#include "../src/model.h"
#include "../src/mcmc.h"
#include "../src/logger.h"

namespace po = boost::program_options;

int main (int argc, char** argv) {

  try {
    // Declare the supported options.
    po::options_description desc("Allowed options");
    desc.add_options()
      ("help,h", "display this help message")
      ("ontology,o", po::value<string>(), "path to ontology file")
      ("assocs,a", po::value<string>(), "path to gene-term association file")
      ("genes,g", po::value<vector<string> >(), "path to gene-set file(s)")
      ("samples,s", po::value<int>()->default_value(100), "number of samples per term")
      ("terms,T", po::value<int>()->default_value(1), "pseudocount: active terms")
      ("absent-terms,t", po::value<int>(), "pseudocount: inactive terms (default=#terms)")
      ("false-negatives,N", po::value<int>()->default_value(1), "pseudocount: false negatives")
      ("true-positives,p", po::value<int>(), "pseudocount: true positives (default=#genes)")
      ("false-positives,P", po::value<int>()->default_value(1), "pseudocount: false positives")
      ("true-negatives,n", po::value<int>(), "pseudocount: true negatives (default=#genes)")
      ("flip-rate,F", po::value<int>()->default_value(1), "relative rate of term-toggling moves")
      ("swap-rate,S", po::value<int>()->default_value(1), "relative rate of term-swapping moves")
      ("randomize-rate,R", po::value<int>()->default_value(0), "relative rate of term-randomizing moves")
      ("rnd-seed,r", po::value<int>()->default_value(123456789), "seed random number generator")
      ("verbose,v", po::value<int>()->default_value(1), "verbosity level")
      ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);    

    logger.setVerbose (vm["verbose"].as<int>());
    
    if (vm.count("help")) {
      cout << desc << "\n";
      return 1;
    }

    Ontology ontology;
    if (vm.count("ontology")) {
      auto ontologyPath = vm["ontology"].as<string>();
      ifstream in (ontologyPath);
      if (!in)
	Abort ("File not found: %s", ontologyPath.c_str());
      ontology.parseOBO (in);
      LogThisAt(1,"Read " << ontology.terms() << "-term ontology from " << ontologyPath << endl);
    } else {
      throw runtime_error ("You must specify an ontology");
    }

    Assocs assocs (ontology);
    if (vm.count("assocs")) {
      auto assocsPath = vm["assocs"].as<string>();
      ifstream in (assocsPath);
      if (!in)
	Abort ("File not found: %s", assocsPath.c_str());
      assocs.parseGOA (in);
      LogThisAt(1,"Read " << assocs.nAssocs << " associations (" << assocs.genes() << " genes, " << assocs.relevantTerms().size() << " terms) from " << assocsPath << endl);
    } else {
      throw runtime_error ("You must specify a gene-term associations file");
    }

    vguard<Assocs::GeneNameSet> geneSets;
    if (vm.count("genes")) {
      auto geneSetPaths = vm["genes"].as<vector<string> >();
      for (const auto& geneSetPath: geneSetPaths) {
	ifstream in (geneSetPath);
	if (!in)
	  Abort ("File not found: %s", geneSetPath.c_str());
	geneSets.push_back (Assocs::parseGeneSet (in));
	LogThisAt(1,"Read " << geneSets.back().size() << " genes from " << geneSetPath << endl);
      }
    } else
      throw runtime_error ("You must specify at least one file of gene names (one per line)");

    Parameterization parameterization (assocs);
    BernoulliParamSet& params (parameterization.params);
    
    BernoulliCounts prior;
    prior.succ[params.paramIndex["t"]] = vm["terms"].as<int>();
    prior.fail[params.paramIndex["t"]] = vm.count("absent-terms") ? vm["absent-terms"].as<int>() : assocs.relevantTerms().size();
    prior.succ[params.paramIndex["fn"]] = vm["false-negatives"].as<int>();
    prior.fail[params.paramIndex["fn"]] = vm.count("true-positives") ? vm["true-positives"].as<int>() : assocs.genes();
    prior.succ[params.paramIndex["fp"]] = vm["false-positives"].as<int>();
    prior.fail[params.paramIndex["fp"]] = vm.count("true-negatives") ? vm["true-negatives"].as<int>() : assocs.genes();
    
    Model::RandomGenerator generator (vm["rnd-seed"].as<int>());

    MCMC mcmc (assocs, parameterization.params, prior);
    mcmc.moveRate[Model::Flip] = vm["flip-rate"].as<int>();
    mcmc.moveRate[Model::Swap] = vm["swap-rate"].as<int>();
    mcmc.moveRate[Model::Randomize] = vm["randomize-rate"].as<int>();
    
    mcmc.initModels (geneSets);

    const int samplesPerTerm = vm["samples"].as<int>(), nSamples = samplesPerTerm * mcmc.nVariables;
    LogThisAt(1,"Model has " << mcmc.nVariables << " variables; running MCMC for " << nSamples << " steps" << endl);
    
    mcmc.run (nSamples, generator);

    auto summ = mcmc.summary();
    cout << summ.toJSON() << endl;
    
  } catch (const std::exception& e) {
    cerr << e.what() << endl;
  }
  
  return 0;
}
