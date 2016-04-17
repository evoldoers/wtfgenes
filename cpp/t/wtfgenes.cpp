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
      ("burn,u", po::value<int>()->default_value(10), "burn-in samples per term")
      ("term-prob,t", po::value<double>()->default_value(.5), "mode of term probability prior")
      ("term-count,T", po::value<double>()->default_value(0), "#pseudocounts of term probability prior")
      ("false-neg-prob,n", po::value<double>()->default_value(.5), "mode of false negative prior")
      ("false-neg-count,N", po::value<double>()->default_value(0), "#pseudocounts of false negative prior")
      ("false-pos-prob,p", po::value<double>()->default_value(.5), "mode of false positive prior")
      ("false-pos-count,P", po::value<double>()->default_value(0), "#pseudocounts of false positive prior")
      ("flip-rate,F", po::value<double>()->default_value(1), "relative rate of term-toggling moves")
      ("step-rate,S", po::value<double>()->default_value(1), "relative rate of term-stepping moves")
      ("jump-rate,J", po::value<double>()->default_value(1), "relative rate of term-jumping moves")
      ("randomize-rate,R", po::value<double>()->default_value(0), "relative rate of term-randomizing moves")
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
    
    BernoulliCounts prior (params.nParams());
    prior.succ[params.paramIndex["t"]] = vm["term-prob"].as<double>() * vm["term-count"].as<double>();
    prior.fail[params.paramIndex["t"]] = (1 - vm["term-prob"].as<double>()) * vm["term-count"].as<double>();
    prior.succ[params.paramIndex["fn"]] = vm["false-neg-prob"].as<double>() * vm["false-neg-count"].as<double>();
    prior.fail[params.paramIndex["fn"]] = (1 - vm["false-neg-prob"].as<double>()) * vm["false-neg-count"].as<double>();
    prior.succ[params.paramIndex["fp"]] = vm["false-pos-prob"].as<double>() * vm["false-pos-count"].as<double>();
    prior.fail[params.paramIndex["fp"]] = (1 - vm["false-pos-prob"].as<double>()) * vm["false-pos-count"].as<double>();
    
    Model::RandomGenerator generator (vm["rnd-seed"].as<int>());

    MCMC mcmc (assocs, parameterization.params, prior);
    mcmc.moveRate[Model::Flip] = vm["flip-rate"].as<double>();
    mcmc.moveRate[Model::Step] = vm["step-rate"].as<double>();
    mcmc.moveRate[Model::Jump] = vm["jump-rate"].as<double>();
    mcmc.moveRate[Model::Randomize] = vm["randomize-rate"].as<double>();
    
    mcmc.initModels (geneSets);

    const int samplesPerTerm = vm["samples"].as<int>(), nSamples = samplesPerTerm * mcmc.nVariables;
    const int burnPerTerm = vm["burn"].as<int>(), burn = burnPerTerm * mcmc.nVariables;
    LogThisAt(1,"Model has " << mcmc.nVariables << " variables; running MCMC for " << nSamples << " steps + " << burn << " burn-in" << endl);

    mcmc.burn = burn;
    mcmc.run (nSamples + burn, generator);

    auto summ = mcmc.summary();
    cout << summ.toJSON() << endl;
    
  } catch (const std::exception& e) {
    cerr << e.what() << endl;
  }
  
  return 0;
}
