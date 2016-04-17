#include <sstream>
#include <gsl/gsl_sf_gamma.h>
#include "bernoulli.h"

LogProb logBetaBernoulli (double alpha, double beta, double succ, double fail) {
  return gsl_sf_lnbeta (alpha + succ, beta + fail) - gsl_sf_lnbeta (alpha, beta);
}

LogProb BernoulliCounts::logBetaBernoulli (const BernoulliCounts& prior) const {
  LogProb lp = 0;
  for (int n = 0; n < nParams(); ++n)
    lp += ::logBetaBernoulli (prior.succ[n] + 1, prior.fail[n] + 1, succ[n], fail[n]);
  return lp;
}

LogProb BernoulliCounts::deltaLogBetaBernoulli (const BernoulliCounts& delta) const {
  LogProb lp = 0;
  for (int n = 0; n < nParams(); ++n)
    if (delta.succ[n] != 0 || delta.fail[n] != 0)
      lp += gsl_sf_lnbeta (succ[n] + delta.succ[n] + 1, fail[n] + delta.fail[n] + 1)
	- gsl_sf_lnbeta (succ[n] + 1, fail[n] + 1);
  return lp;
}

BernoulliCounts& BernoulliCounts::operator+= (const BernoulliCounts& c) {
  for (int n = 0; n < nParams(); ++n) {
    succ[n] += c.succ[n];
    fail[n] += c.fail[n];
  }
  return *this;
}

string BernoulliCounts::toJSON (const vguard<BernoulliParamName>& params) const {
  return string("{\"succ\":") + countsToJSON(params,succ) + ",\"fail\":" + countsToJSON(params,fail) + "}";
}
  
string BernoulliCounts::countsToJSON (const vguard<BernoulliParamName>& params, const vguard<double>& c) {
  ostringstream json;
  json << "{";
  for (size_t n = 0; n < c.size(); ++n)
    json << (n ? "," : "") << "\"" << params[n] << "\":" << c[n];
  json << "}";
  return json.str();
}

BernoulliCounts BernoulliParamSet::laplaceCounts() const {
  BernoulliCounts c (nParams());
  for (BernoulliParamIndex p = 0; p < nParams(); ++p)
    c.succ[p] = c.fail[p] = 1;
  return c;
}
