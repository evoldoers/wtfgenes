#include "mcmc.h"

void MCMC::initModels (const vguard<Assocs::GeneNameSet>& geneSets) {
  models.reserve (models.size() + geneSets.size());
  for (auto& gs : geneSets) {
    models.push_back (Model (assocs, parameterization));
    models.back().init (gs);
    const size_t vars = models.back().relevantTerms.size();
    modelWeight.push_back (vars);
    nVariables += vars;
    termStateOccupancy.push_back (vguard<int> (assocs.terms()));
    geneFalseOccupancy.push_back (vguard<int> (assocs.genes()));
  }
}

BernoulliCounts MCMC::computeCounts() const {
  BernoulliCounts c;
  for (auto& m : models)
    c += m.getCounts();
  return c;
}

BernoulliCounts MCMC::computeCountsWithPrior() const {
  BernoulliCounts c (prior);
  for (auto& m : models)
    c += m.getCounts();
  return c;
}

LogProb MCMC::collapsedLogLikelihood() const {
  return computeCounts().logBetaBernoulli (prior);
}

void MCMC::run (size_t nSamples) {
  if (accumulate (modelWeight.begin(), modelWeight.end(), 0) <= 0) {
    Warn ("Refusing to run MCMC on a model with no variables");
    return;
  }

  MoveRate mr = moveRate;
  mr[Model::Swap] = 0;  // set this later: it depends on number of active terms

  for (size_t sample = 0; sample < nSamples; ++sample) {
    vguard<size_t> nActiveTerms;
    nActiveTerms.reserve (models.size());
    for (auto& m : models)
      nActiveTerms.push_back (m.activeTerms().size());
    mr[Model::Swap] = moveRate[Model::Swap] * accumulate (nActiveTerms.begin(), nActiveTerms.end(), 0);

    Move move;
    move.samples = sample;
    move.totalSamples = nSamples;
    move.type = (MoveType) random_index (mr, generator);
    move.propose (models, modelWeight, generator);
    move.model->sampleMoveCollapsed (move, countsWithPrior, generator);

    ++samples;

    for (ModelIndex n = 0; n < models.size(); ++n) {
      Model& model = models[n];
      for (auto t: model.activeTerms())
	++termStateOccupancy[n][t];
      for (auto g: model.falseGenes())
	++geneFalseOccupancy[n][g];
    }
  }
}

MCMC::Summary MCMC::summary() const {
  Summary summ;
  summ.prior = prior;
  summ.moveRate = moveRate;
  for (ModelIndex m = 0; m < models.size(); ++m) {
    auto& model = models[m];
    GeneSetSummary gss;
    for (auto t: model.relevantTerms)
      gss.termPosterior[assocs.ontology.termName[t]] = termStateOccupancy[m][t] / (double) samples;
    for (Assocs::GeneIndex g = 0; g < assocs.genes(); ++g) {
      GeneProb& geneProb (model.inGeneSet[g] ? gss.geneFalsePosPosterior : gss.geneFalseNegPosterior);
      geneProb[assocs.geneName[g]] = geneFalseOccupancy[m][g] / (double) samples;
    }
    gss.hypergeometricPValue = assocs.hypergeometricPValues (geneSets[m]);
    summ.geneSetSummary.push_back (gss);
  }
  return summ;
}
