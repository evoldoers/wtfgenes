#include <sstream>
#include <gsl/gsl_sf_gamma.h>
#include "bernoulli.h"

LogProb logBetaBernoulli (double alpha, double beta, double succ, double fail) {
  return gsl_sf_lnbeta (alpha + succ, beta + fail) - gsl_sf_lnbeta (alpha, beta);
}

set<BernoulliParamIndex> BernoulliCounts::combinedIndices (const BernoulliCounts& other) const {
  set<BernoulliParamIndex> idx = allIndices(), otherIdx = other.allIndices();
  idx.insert (otherIdx.begin(), otherIdx.end());
  return idx;
}

set<BernoulliParamIndex> BernoulliCounts::allIndices() const {
  set<BernoulliParamIndex> idx;
  for (auto& pc : succ)
    idx.insert (pc.first);
  for (auto& pc : fail)
    idx.insert (pc.first);
  return idx;
}

LogProb BernoulliCounts::logBetaBernoulli (const BernoulliCounts& prior) const {
  auto priorSucc(prior.succ), priorFail(prior.fail),
    mySucc(succ), myFail(fail);  // make copies to leverage default-constructible properties of map
  LogProb lp = 0;
  for (auto n : combinedIndices(prior))
    lp += ::logBetaBernoulli (priorSucc[n] + 1, priorFail[n] + 1, mySucc[n], myFail[n]);
  return lp;
}

map<int,map<int,double> > gsl_sf_lnbeta_cache;
double cached_gsl_sf_lnbeta (int alpha, int beta) {
  auto i = gsl_sf_lnbeta_cache.find(alpha);
  if (i != gsl_sf_lnbeta_cache.end()) {
    auto j = i->second.find(beta);
    if (j != i->second.end())
      return j->second;
  }
  return gsl_sf_lnbeta_cache[alpha][beta] = gsl_sf_lnbeta(alpha,beta);
}

LogProb BernoulliCounts::deltaLogBetaBernoulli (const BernoulliCounts& delta) const {
  auto deltaSucc(delta.succ), deltaFail(delta.fail),
    oldSucc(succ), oldFail(fail);  // make copies to leverage default-constructible properties of map
  LogProb lp = 0;
  for (auto n : combinedIndices(delta))
    lp += gsl_sf_lnbeta (oldSucc[n] + deltaSucc[n] + 1, oldFail[n] + deltaFail[n] + 1)
      - gsl_sf_lnbeta (oldSucc[n] + 1, oldFail[n] + 1);
  return lp;
}

BernoulliCounts& BernoulliCounts::operator+= (const BernoulliCounts& c) {
  for (auto pc : c.succ)
    if ((succ[pc.first] += pc.second) == 0)
      succ.erase (pc.first);
  for (auto pc : c.fail)
    if ((fail[pc.first] += pc.second) == 0)
      fail.erase (pc.first);
  return *this;

}

string BernoulliCounts::toJSON (const vguard<BernoulliParamName>& params) const {
  return string("{\"succ\":") + countsToJSON(params,succ) + ",\"fail\":" + countsToJSON(params,fail) + "}";
}
  
string BernoulliCounts::countsToJSON (const vguard<BernoulliParamName>& params, const map<int,int>& c) {
  ostringstream json;
  json << "{";
  int n = 0;
  for (auto& pc: c)
    json << (n++ ? "," : "") << "\"" << params[pc.first] << "\":" << pc.second;
  json << "}";
  return json.str();
}

BernoulliCounts BernoulliParamSet::laplaceCounts() const {
  BernoulliCounts c;
  for (BernoulliParamIndex p = 0; p < params(); ++p)
    c.succ[p] = c.fail[p] = 1;
  return c;
}
