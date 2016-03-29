#ifndef MCMC_INCLUDED
#define MCMC_INCLUDED

#include "model.h"

struct MCMC {
  typedef Ontology::TermName TermName;
  typedef Assocs::GeneName GeneName;

  typedef map<TermName,double> TermProb;
  typedef map<GeneName,double> GeneProb;

  typedef Model::RandomGenerator RandomGenerator;

  typedef Model::Move Move;
  typedef Model::MoveType MoveType;
  typedef vguard<double> MoveRate;

  typedef size_t ModelIndex;

  struct GeneSetSummary {
    TermProb hypergeometricPValue, termPosterior;
    GeneProb geneFalsePosPosterior, geneFalseNegPosterior;
  };

  struct Summary {
    BernoulliCounts prior;
    MoveRate moveRate;
    vguard<GeneSetSummary> geneSetSummary;
  };

  const Assocs& assocs;
  const BernoulliParamSet& params;
  const BernoulliCounts& prior;

  Parameterization parameterization;

  vguard<GeneIndexSet> geneSets;
  vguard<Model> models;
  int nVariables;

  BernoulliCounts countsWithPrior;

  RandomGenerator generator;
  MoveRate moveRate;
  vguard<double> modelWeight;

  size_t samples;
  vguard<vguard<int> > termStateOccupancy;  // indexed by model index & TermIndex
  vguard<vguard<int> > geneFalseOccupancy;  // indexed by model index & GeneIndex

  MCMC (const Assocs& assocs, const BernoulliParamSet& params, const BernoulliCounts& prior)
    : assocs(assocs),
      params(params),
      prior(prior),
      parameterization(assocs),
      nVariables(0),
      moveRate(Model::TotalMoveTypes),
      samples(0)
  {
    moveRate[Model::Flip] = moveRate[Model::Swap] = 1;
  }

  void initModels (const vguard<GeneNameSet>& geneSets);

  BernoulliCounts computeCounts() const;
  BernoulliCounts computeCountsWithPrior() const;
  LogProb collapsedLogLikelihood() const;

  void run (size_t nSamples);
  Summary summary() const;
};

#endif /* MCMC_INCLUDED */
