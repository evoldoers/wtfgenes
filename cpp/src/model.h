#ifndef MODEL_INCLUDED
#define MODEL_INCLUDED

#include <iostream>
#include "ontology.h"
#include "assocs.h"
#include "bernoulli.h"
#include "stacktrace.h"

// uncomment to log random numbers
// #define LOG_RANDOM_NUMBERS

struct Parameterization {
  vguard<BernoulliParamIndex> termPrior, geneFalsePos, geneFalseNeg;
  BernoulliParamSet params;
  Parameterization (const Assocs& assocs);
  int nParams() const { return params.nParams(); }
};

#ifdef LOG_RANDOM_NUMBERS
struct MTLogger : mt19937 {
  MTLogger() : mt19937() { }
  MTLogger(uint_fast32_t seed) : mt19937(seed) { }
  uint_fast32_t operator()() { uint_fast32_t r = mt19937::operator()(); cerr << r << endl; return r; }
};
#endif /* LOG_RANDOM_NUMBERS */

class Model {
public:
  typedef Ontology::TermName TermName;
  typedef Ontology::TermIndex TermIndex;
  typedef Assocs::GeneName GeneName;
  typedef Assocs::GeneIndex GeneIndex;
  typedef Assocs::GeneIndexSet GeneIndexSet;
  typedef Assocs::GeneNameSet GeneNameSet;

  typedef map<TermIndex,bool> TermStateAssignment;

#ifdef LOG_RANDOM_NUMBERS
  typedef MTLogger RandomGenerator;
#else
  typedef mt19937 RandomGenerator;
#endif /* LOG_RANDOM_NUMBERS */

  enum MoveType : size_t { Flip = 0, Step = 1, Jump = 2, Randomize = 3, TotalMoveTypes };
  struct Move {
    size_t samples, totalSamples;
    Model *model;
    MoveType type;
    TermStateAssignment termStates;
    BernoulliCounts delta;
    LogProb logLikelihoodRatio;
    double proposalHastingsRatio, hastingsRatio;
    bool accepted;
    Move() : proposalHastingsRatio(1) { }
    void propose (vguard<Model>& models, const vguard<double>& modelWeight, RandomGenerator& generator);
    string toJSON() const;
  };

  const Assocs& assocs;
  const Parameterization& parameterization;
  const vguard<TermName>& termName;
  const vguard<GeneName>& geneName;

  GeneIndexSet geneSet;
  vguard<bool> inGeneSet;  // indexed by GeneIndex
  vguard<bool> isRelevant;  // indexed by TermIndex
  vguard<TermIndex> relevantTerms;
  vguard<vguard<TermIndex> > relevantNeighbors;

private:
  vguard<bool> termState;  // indexed by GeneIndex
  vguard<int> nActiveTermsByGene;  // indexed by GeneIndex

  set<TermIndex> _activeTerms;
  set<GeneIndex> _falseGenes;

public:
  Model (const Assocs& assocs, const Parameterization& param);
  void init (const GeneNameSet& geneNames);

  const TermIndex terms() const { return assocs.ontology.terms(); }
  const GeneIndex genes() const { return assocs.genes(); }

  const set<TermIndex>& activeTerms() const { return _activeTerms; }
  const set<GeneIndex>& falseGenes() const { return _falseGenes; }

  bool getTermState (TermIndex t) const { return termState[t]; }
  void setTermState (TermIndex t, bool val);
  void setTermStates (const TermStateAssignment& tsa);

  TermStateAssignment invert (const TermStateAssignment& tsa) const;

  BernoulliCounts getCounts() const;
  BernoulliCounts getCountDelta (const TermStateAssignment& tsa) const;

  void proposeFlipMove (Move& move, RandomGenerator& generator) const;
  void proposeStepMove (Move& move, RandomGenerator& generator) const;
  void proposeJumpMove (Move& move, RandomGenerator& generator) const;
  void proposeRandomizeMove (Move& move, RandomGenerator& generator) const;

  bool sampleMoveCollapsed (Move& move, BernoulliCounts& counts, RandomGenerator& generator);

  string tsaToJSON (const TermStateAssignment& tsa) const;
  
private:
  void countTerm (BernoulliCounts& counts, int inc, TermIndex t, bool state) const;
  void countObs (BernoulliCounts& counts, int inc, bool isActive, GeneIndex g) const;
};

#endif /* MODEL_INCLUDED */
