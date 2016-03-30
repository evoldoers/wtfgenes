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
      const auto f = split (line, "\t");
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
