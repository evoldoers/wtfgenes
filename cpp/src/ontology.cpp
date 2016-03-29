#include <stdexcept>
#include <deque>
#include "ontology.h"

vguard<Ontology::TermIndex> Ontology::toposortTermIndex() const {
  deque<TermIndex> S;
  vguard<TermIndex> L, nParents (terms());
  int edges = 0;
  for (TermIndex c = 0; c < terms(); ++c) {
    nParents[c] = parents[c].size();
    edges += nParents[c];
    if (nParents[c] == 0)
      S.push_back (c);
  }
  while (S.size()) {
    const TermIndex n = S.front();
    S.pop_front();
    L.push_back (n);
    for (auto m : children[n]) {
      --edges;
      if (--nParents[m] == 0)
	S.push_back (m);
    }
  }
  if (edges > 0)
    throw std::domain_error ("Ontology graph is cyclic, can't toposort");
  return L;
}

void Ontology::init (const TermParentsMap& termParents) {
  for (auto& tp : termParents) {
    termIndex[tp.first] = terms();
    termName.push_back (tp.first);
  }
  for (auto& tp : termParents) {
    const TermIndex t = termIndex[tp.first];
    for (auto& pn : tp.second) {
      if (!termIndex.count(pn)) {
	termIndex[pn] = terms();
	termName.push_back (pn);
      }
      const TermIndex p = termIndex[pn];
      parents[t].push_back (p);
      children[p].push_back (t);
    }
  }
}

vguard<set<Ontology::TermIndex> > Ontology::transitiveClosure() const {
  vguard<set<TermIndex> > tc (terms());
  auto L = toposortTermIndex();
  for (TermIndex n : L)
    for (TermIndex p : parents[n])
      tc[n].insert (tc[p].begin(), tc[p].end());
  return tc;
}

void Ontology::parseOBO (ifstream& in) {
  // WRITE ME
  throw new runtime_error("unimplemented");
}
