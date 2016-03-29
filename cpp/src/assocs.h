#ifndef ASSOCS_INCLUDED
#define ASSOCS_INCLUDED

#include <algorithm>
#include <list>
#include "ontology.h"

struct Assocs {
  typedef string GeneName;
  typedef int GeneIndex;
  typedef Ontology::TermIndex TermIndex;

  typedef list<pair<GeneName,TermName> > GeneTermList;

  Ontology& ontology;
  vguard<GeneName> geneName;
  map<GeneName,GeneIndex> geneIndex;
  vguard<vguard<GeneIndex> > genesByTerm;
  vguard<set<TermIndex> > termsByGene;
  int nAssocs;

  Assocs() : nAssocs(0) { }

  GeneIndex genes() const { return geneName.size(); }
  TermIndex terms() const { return termName.size(); }
  bool geneHasTerm (GeneIndex g, TermIndex t) const { return termsByGene[g].count(t) > 0; }
  vguard<TermIndex> relevantTerms() const {
    vguard<TermIndex> relevant;
    for (TermIndex t = 0; t < terms(); ++t)
      if (genesByTerm[t].size())
	relevant.push_back (t);
    return relevant;
  }

  void init (GeneTermList& geneTermList) {
    auto closure = ontology.transitiveClosure();
    set<TermName> missing;
    for (auto& gt : geneTermList) {
      if (!geneIndex.count(gt.first)) {
	geneIndex[gt.first] = genes();
	geneName.push[gt.first];
	termsByGene.push (set<TermIndex>());
      }
      auto g = geneIndex[gt.first];
      if (!ontology.termIndex.count(gt.second))
	missing.insert (gt.second);
      else {
	const auto& terms = closure[ontology.termIndex[gt.second]];
	termsByGene[g].insert (terms.begin(), terms.end());
	for (auto t : terms)
	  genesByTerm[t].insert (g);
	nAssocs += terms.size();
      }
    }
    if (missing.size())
      throw new runtime_error((string("Terms not found in the ontology: ") + join(missing)).c_str());
  }
};

#endif /* ASSOCS_INCLUDED */
