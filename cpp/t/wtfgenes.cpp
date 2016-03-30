#include <fstream>
#include <stdexcept>
#include <boost/program_options.hpp>
#include "../src/ontology.h"

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
      ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);    
  
    if (vm.count("help")) {
      cout << desc << "\n";
      return 1;
    }

    Ontology ontology;
    if (vm.count("ontology")) {
      auto ontologyPath = vm["ontology"].as<string>();
      ifstream in (ontologyPath);
      ontology.parseOBO (in);
      cerr << "Read " << ontology.terms() << "-term ontology from " << ontologyPath << endl;
    } else {
      throw runtime_error ("You must specify an ontology");
    }

  } catch (const std::exception& e) {
    cerr << e.what() << endl;
  }
  
  return 0;
}
