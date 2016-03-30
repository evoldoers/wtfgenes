#include "assocs.h"
#include "regexmacros.h"

const regex bang_re (RE_WHITE_OR_EMPTY "!" RE_DOT_STAR, regex_constants::basic);
const regex nonwhite_re (RE_WHITE_OR_EMPTY RE_NONWHITE_CHAR_CLASS RE_DOT_STAR, regex_constants::basic);

void Assocs::parseGOA (istream& in) {
  GeneTermList gt;
  while (in && !in.eof()) {
    string line;
    getline(in,line);
    if (regex_match (line, bang_re))
      continue;
    else if (regex_match (line, nonwhite_re)) {
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
  while (in && !in.eof()) {
    string line;
    getline(in,line);
    if (regex_match (line, nonwhite_re))
      gs.push_back (line);
  }
  return gs;
}
