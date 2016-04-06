#ifndef MCMC_INCLUDED
#define MCMC_INCLUDED

#include "model.h"

struct MCMC {
  typedef Ontology::TermName TermName;
  typedef Assocs::GeneName GeneName;

  typedef Assocs::TermProb TermProb;
  typedef Assocs::GeneProb GeneProb;

  typedef Model::RandomGenerator RandomGenerator;

  typedef Model::Move Move;
  typedef Model::MoveType MoveType;
  typedef vguard<double> MoveRate;

  typedef size_t ModelIndex;

  struct GeneSetSummary {
    TermProb hypergeometricPValue, termPosterior;
    GeneProb geneFalsePosPosterior, geneFalseNegPosterior;
    string toJSON() const;
    static string probsToJson (const map<string,double>& p);
  };

  struct Summary {
    BernoulliParamSet params;
    BernoulliCounts prior;
    MoveRate moveRate;
    vguard<GeneSetSummary> geneSetSummary;
    string toJSON() const;
  };

  const Assocs& assocs;
  const BernoulliParamSet& params;
  const BernoulliCounts& prior;

  Parameterization parameterization;

  vguard<Assocs::GeneIndexSet> geneSets;
  vguard<Model> models;
  size_t nVariables;

  BernoulliCounts countsWithPrior;

  MoveRate moveRate;
  vguard<double> modelWeight;

  size_t samples, samplesIncludingBurn, burn;
  vguard<vguard<int> > termStateOccupancy;  // indexed by model index & TermIndex
  vguard<vguard<int> > geneFalseOccupancy;  // indexed by model index & GeneIndex

  MCMC (const Assocs& assocs, const BernoulliParamSet& params, const BernoulliCounts& prior)
    : assocs(assocs),
      params(params),
      prior(prior),
      parameterization(assocs),
      nVariables(0),
      moveRate(Model::TotalMoveTypes),
      samples(0),
      samplesIncludingBurn(0),
      burn(0)
  {
    moveRate[Model::Flip] = moveRate[Model::Step] = 1;
  }

  inline bool finishedBurn() const { return samplesIncludingBurn > burn; }

  void initModels (const vguard<Assocs::GeneNameSet>& geneSets);

  BernoulliCounts computeCounts() const;
  BernoulliCounts computeCountsWithPrior() const;
  LogProb collapsedLogLikelihood() const;

  void run (size_t nSamples, RandomGenerator& generator);
  Summary summary (double postProbThreshold = .01, double pValueThreshold = .05) const;
};

#endif /* MCMC_INCLUDED */
