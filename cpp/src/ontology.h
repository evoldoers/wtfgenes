#ifndef ONTOLOGY_INCLUDED
#define ONTOLOGY_INCLUDED

#include <string>
#include <map>
#include <set>
#include "vguard.h"

using namespace std;

struct Ontology {
  typedef string TermName;
  typedef int TermIndex;
  typedef map<TermName,set<TermName> > TermParentsMap;

  vguard<TermName> termName;
  map<TermName,TermIndex> termIndex;
  vguard<vguard<TermIndex> > parents, children;

  TermIndex terms() const { return termName.size(); }
  vguard<TermIndex> toposortTermIndex() const;
  vguard<set<TermIndex> > transitiveClosure() const;

  void init (const TermParentsMap& termParents);
  void parseOBO (istream& in);
};

#endif /* ONTOLOGY_INCLUDED */
