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

const regex term_re ("\\[Term\\]" RE_DOT_STAR, regex_constants::basic);
const regex id_re ("id: " RE_GROUP("GO:" RE_PLUS(RE_NUMERIC_CHAR_CLASS)) RE_DOT_STAR, regex_constants::basic);
const regex isa_re ("is_a: " RE_GROUP("GO:" RE_PLUS(RE_NUMERIC_CHAR_CLASS)) RE_DOT_STAR, regex_constants::basic);
const regex relationship_re ("relationship: part_of " RE_GROUP("GO:" RE_PLUS(RE_NUMERIC_CHAR_CLASS)) RE_DOT_STAR, regex_constants::basic);
const regex obsolete_re ("is_obsolete" RE_DOT_STAR, regex_constants::basic);

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
  while (in && !in.eof()) {
    string line;
    getline(in,line);
    if (regex_match (line, term_re))
      addTerm();
    else if (regex_match (line, sm, id_re))
      id = sm.str(1);
    else if (regex_match (line, sm, isa_re))
      parents.insert (sm.str(1));
    else if (regex_match (line, sm, relationship_re))
      parents.insert (sm.str(1));
    else if (regex_match (line, obsolete_re))
      clear();
  }
  addTerm();
  init (tp);
}
