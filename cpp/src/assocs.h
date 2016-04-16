#ifndef ASSOCS_INCLUDED
#define ASSOCS_INCLUDED

#include <algorithm>
#include <list>
#include <map>
#include <set>
#include "ontology.h"
#include "util.h"
#include "logsumexp.h"

struct Assocs {
  typedef string GeneName;
  typedef int GeneIndex;
  typedef Ontology::TermIndex TermIndex;
  typedef Ontology::TermName TermName;

  typedef list<pair<GeneName,TermName> > GeneTermList;

  typedef set<GeneIndex> GeneIndexSet;
  typedef list<GeneName> GeneNameSet;

  typedef map<TermName,double> TermProb;
  typedef map<GeneName,double> GeneProb;

  typedef int TermEquivClassIndex;

  const Ontology& ontology;
  vguard<GeneName> geneName;
  map<GeneName,GeneIndex> geneIndex;
  vguard<vguard<GeneIndex> > genesByTerm;
  vguard<set<TermIndex> > termsByGene;
  vguard<vguard<TermIndex> > termsInEquivClass;
  vguard<TermEquivClassIndex> equivClassByTerm;
  int nAssocs;

  Assocs (const Ontology& ontology)
    : ontology(ontology),
      genesByTerm(ontology.terms()),
      equivClassByTerm(ontology.terms()),
      nAssocs(0)
  { }

  GeneIndex genes() const { return geneName.size(); }
  TermIndex terms() const { return ontology.termName.size(); }
  bool geneHasTerm (GeneIndex g, TermIndex t) const { return termsByGene[g].count(t) > 0; }
  bool termIsExemplar (TermIndex t) const { return termsInEquivClass[equivClassByTerm[t]][0] == t; }
  vguard<TermIndex> relevantTerms() const {
    vguard<TermIndex> relevant;
    for (TermIndex t = 0; t < terms(); ++t)
      if (genesByTerm[t].size() && termIsExemplar(t))
	relevant.push_back (t);
    return relevant;
  }
  map<TermName,list<TermName> > termEquivalents() const {
    map<TermName,list<TermName> > termEquiv;
    for (auto& ec: termsInEquivClass)
      if (ec.size() > 1) {
	list<TermName> equivs;
	for (size_t n = 1; n < ec.size(); ++n)
	  equivs.push_back (ontology.termName[ec[n]]);
	termEquiv[ontology.termName[ec[0]]] = equivs;
      }
    return termEquiv;
  }

  void init (GeneTermList& geneTermList);
  void parseGOA (istream& in);

  static GeneNameSet parseGeneSet (istream& in);
  
  TermProb hypergeometricPValues (const GeneIndexSet& geneSet, double pValueThreshold = .05) const {
    TermProb hyp;
    for (TermIndex t = 0; t < terms(); ++t) {
      int genesForTermInSet = 0;
      for (auto g: genesByTerm[t])
	if (geneSet.count(g))
	  ++genesForTermInSet;
      const int n = genes(),
	nPresent = genesByTerm[t].size(),
	nAbsent = n - nPresent,
	nInSet = geneSet.size(),
	logDenominator = logBinomialCoefficient(n,nInSet);
      double p = 0;
      for (int nPresentInSet = genesForTermInSet;
	   nPresentInSet <= nInSet && nPresentInSet <= nPresent;
	   ++nPresentInSet) {
	const int nAbsentInSet = nInSet - nPresentInSet;
	p += exp (logBinomialCoefficient(nPresent,nPresentInSet)
		  + logBinomialCoefficient(nAbsent,nAbsentInSet)
		  - logDenominator);
      }
      if (p <= pValueThreshold)
	hyp[ontology.termName[t]] = p;
    }
    return hyp;
  }
};

#endif /* ASSOCS_INCLUDED */
