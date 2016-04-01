#include "assocs.h"
#include "regexmacros.h"

const regex bang_re ("^!", regex_constants::basic);
const regex nonwhite_re (RE_NONWHITE_CHAR_CLASS, regex_constants::basic);

void Assocs::parseGOA (istream& in) {
  GeneTermList gt;
  string line;
  while (in && !in.eof()) {
    getline(in,line);
    if (regex_search (line, bang_re))
      continue;
    else if (regex_search (line, nonwhite_re)) {
      const auto f = split (line, "\t", true);
      if (f.size() >= 7) {
	const string& id = f[2];
	const string& qualifier = f[3];
	const string& go_id = f[4];
	if (qualifier != "NOT")
	  gt.push_back (pair<GeneName,TermName> (id, go_id));
      }
    }
  }
  init (gt);
}

Assocs::GeneNameSet Assocs::parseGeneSet (istream& in) {
  GeneNameSet gs;
  string line;
  while (in && !in.eof()) {
    getline(in,line);
    if (regex_search (line, nonwhite_re))
      gs.push_back (line);
  }
  return gs;
}

void Assocs::init (GeneTermList& geneTermList) {
  auto closure = ontology.transitiveClosure();
  set<TermName> missing;
  vguard<set<GeneIndex> > genesByTerm_set (terms());
  for (auto& gt : geneTermList) {
    if (!geneIndex.count(gt.first)) {
      geneIndex[gt.first] = genes();
      geneName.push_back (gt.first);
      termsByGene.push_back (set<TermIndex>());
    }
    auto g = geneIndex[gt.first];
    if (!ontology.termIndex.count(gt.second))
      missing.insert (gt.second);
    else {
      const auto& terms = closure[ontology.termIndex.at(gt.second)];
      termsByGene[g].insert (terms.begin(), terms.end());
      for (auto t : terms)
	genesByTerm_set[t].insert (g);
      nAssocs += terms.size();
    }
  }
  if (missing.size())
    Warn ("Terms not found in the ontology: %s", join(missing).c_str());
  for (TermIndex t = 0; t < terms(); ++t) {
    genesByTerm_set[t].insert (genesByTerm[t].begin(), genesByTerm[t].end());
    genesByTerm[t] = vguard<GeneIndex> (genesByTerm_set[t].begin(), genesByTerm_set[t].end());
  }
}
