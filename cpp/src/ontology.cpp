#include <stdexcept>
#include <deque>
#include "ontology.h"
#include "regexmacros.h"

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
  auto newTerm = [&](const TermName& term) -> void
    {
      termIndex[term] = terms();
      termName.push_back (term);
      parents.push_back (vguard<TermIndex>());
      children.push_back (vguard<TermIndex>());
    };
  for (auto& tp : termParents)
    newTerm (tp.first);
  for (auto& tp : termParents) {
    const TermIndex t = termIndex[tp.first];
    for (auto& pn : tp.second) {
      if (!termIndex.count(pn))
	newTerm (pn);
      const TermIndex p = termIndex[pn];
      parents[t].push_back (p);
      children[p].push_back (t);
    }
  }
}

vguard<set<Ontology::TermIndex> > Ontology::transitiveClosure() const {
  vguard<set<TermIndex> > tc (terms());
  auto L = toposortTermIndex();
  for (TermIndex n : L) {
    tc[n].insert (n);
    for (TermIndex p : parents[n])
      tc[n].insert (tc[p].begin(), tc[p].end());
  }
  return tc;
}

const regex term_re ("^\\[Term\\]", regex_constants::basic);
const regex id_re ("^id: " RE_GROUP("GO:" RE_PLUS(RE_NUMERIC_CHAR_CLASS)), regex_constants::basic);
const regex isa_re ("^is_a: " RE_GROUP("GO:" RE_PLUS(RE_NUMERIC_CHAR_CLASS)), regex_constants::basic);
const regex relationship_re ("^relationship: part_of " RE_GROUP("GO:" RE_PLUS(RE_NUMERIC_CHAR_CLASS)), regex_constants::basic);
const regex obsolete_re ("^is_obsolete", regex_constants::basic);

void Ontology::parseOBO (istream& in) {
  smatch sm;
  TermName id;
  set<TermName> parents;
  TermParentsMap tp;
  auto clear = [&]() -> void
    {
	id.clear();
	parents.clear();
    };
  auto addTerm = [&]() -> void
    {
      if (id.size()) {
	tp[id] = parents;
	clear();
      }
    };
  string line;
  while (in && !in.eof()) {
    getline(in,line);
    if (regex_search (line, term_re))
      addTerm();
    else if (regex_search (line, sm, id_re))
      id = sm.str(1);
    else if (regex_search (line, sm, isa_re))
      parents.insert (sm.str(1));
    else if (regex_search (line, sm, relationship_re))
      parents.insert (sm.str(1));
    else if (regex_search (line, obsolete_re))
      clear();
  }
  addTerm();
  init (tp);
}
