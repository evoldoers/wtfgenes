#include "mcmc.h"
#include "logger.h"

void MCMC::initModels (const vguard<Assocs::GeneNameSet>& geneNameSets) {
  models.reserve (models.size() + geneSets.size());
  for (auto& gs : geneNameSets) {
    models.push_back (Model (assocs, parameterization));
    models.back().init (gs);
    geneSets.push_back (models.back().geneSet);
    const size_t vars = models.back().relevantTerms.size();
    modelWeight.push_back (vars);
    nVariables += vars;
    termStateOccupancy.push_back (vguard<int> (assocs.terms()));
    geneFalseOccupancy.push_back (vguard<int> (assocs.genes()));
  }
  countsWithPrior = computeCountsWithPrior();
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

void MCMC::run (size_t nSamples, RandomGenerator& generator) {
  if (accumulate (modelWeight.begin(), modelWeight.end(), 0) <= 0) {
    Warn ("Refusing to run MCMC on a model with no variables");
    return;
  }

  ProgressLog (plog, 1);
  plog.initProgress ("MCMC sampling run (%u models, %u variables)", models.size(), nVariables);

  for (size_t sample = 0; sample < nSamples; ++sample) {

    plog.logProgress (sample / (double) (nSamples - 1), "sample %u/%u", sample + 1, nSamples);

    Move move;
    move.samples = sample;
    move.totalSamples = nSamples;
    move.type = (MoveType) random_index (moveRate, generator);
    move.propose (models, modelWeight, generator);
    move.model->sampleMoveCollapsed (move, countsWithPrior, generator);

    LogThisAt(2,"Move #" << (samplesIncludingBurn+1) << ": " << move.toJSON() << endl);
    
    ++samplesIncludingBurn;
    if (finishedBurn()) {
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
}

MCMC::Summary MCMC::summary (double postProbThreshold, double pValueThreshold) const {
  Summary summ;
  summ.params = params;
  summ.prior = prior;
  summ.moveRate = moveRate;
  for (ModelIndex m = 0; m < models.size(); ++m) {
    auto& model = models[m];
    GeneSetSummary gss;
    for (auto t: model.relevantTerms) {
      const double p = termStateOccupancy[m][t] / (double) samples;
      if (p >= postProbThreshold)
	gss.termPosterior[assocs.ontology.termName[t]] = p;
    }
    for (Assocs::GeneIndex g = 0; g < assocs.genes(); ++g) {
      GeneProb& geneProb (model.inGeneSet[g] ? gss.geneFalsePosPosterior : gss.geneFalseNegPosterior);
      const double p = geneFalseOccupancy[m][g] / (double) samples;
      if (p >= postProbThreshold)
	geneProb[assocs.geneName[g]] = p;
    }
    gss.hypergeometricPValue = assocs.hypergeometricPValues (geneSets[m], pValueThreshold);
    summ.geneSetSummary.push_back (gss);
  }
  return summ;
}

string MCMC::GeneSetSummary::probsToJson (const map<string,double>& p) {
  ostringstream json;
  json << "{";
  int n = 0;
  for (auto& sd : p)
    json << (n++ ? "," : "") << "\"" << sd.first << "\":" << sd.second;
  json << "}";
  return json.str();
}

string MCMC::GeneSetSummary::toJSON() const {
  return string("{\"hypergeometricPValue\":{\"term\":") + probsToJson(hypergeometricPValue) + "},\"posteriorMarginal\":{\"term\":" + probsToJson(termPosterior) + ",\"gene\":{\"falsePos\":" + probsToJson(geneFalsePosPosterior) + ",\"falseNeg\":" + probsToJson(geneFalseNegPosterior) + "}}}";
}

string MCMC::Summary::toJSON() const {
  vguard<string> summJson;
  for (auto& gss: geneSetSummary)
    summJson.push_back (gss.toJSON());
  return string("{\"summary\":[") + join(summJson,",") + "]}";
}
