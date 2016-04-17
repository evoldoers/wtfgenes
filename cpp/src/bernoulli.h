#ifndef BERNOUILLI_INCLUDED
#define BERNOUILLI_INCLUDED

#include <random>
#include <map>
#include <set>
#include "vguard.h"
#include "logsumexp.h"

LogProb logBetaBernoulli (double alpha, double beta, double succ, double fail);

typedef string BernoulliParamName;
typedef int BernoulliParamIndex;
typedef vguard<double> BernoulliParams;

class BernoulliCounts {
public:
  vguard<double> succ, fail;

  BernoulliCounts() { }
  BernoulliCounts (size_t nParams) : succ(nParams), fail(nParams) { }
  size_t nParams() const { return succ.size(); }

  LogProb logBetaBernoulli (const BernoulliCounts& prior) const;
  LogProb deltaLogBetaBernoulli (const BernoulliCounts& old) const;

  template<class Generator>
  BernoulliParams sampleParams (Generator& generator) const {
    BernoulliParams p (nParams());
    for (BernoulliParamIndex i = 0; i < nParams(); ++i) {
      gamma_distribution<double> gamma (succ[i] + 1, fail[i] + 1);
      p[i] = gamma (generator);
    }
    return p;
  }

  BernoulliCounts& operator+= (const BernoulliCounts& c);

  string toJSON (const vguard<BernoulliParamName>& params) const;
  
private:
  static string countsToJSON (const vguard<BernoulliParamName>& params, const vguard<double>& c);
};

struct BernoulliParamSet {
  vguard<BernoulliParamName> paramName;
  map<BernoulliParamName,BernoulliParamIndex> paramIndex;

  void addParam (const BernoulliParamName& name) {
    if (!paramIndex.count(name)) {
      paramIndex[name] = nParams();
      paramName.push_back (name);
    }
  }

  BernoulliParamIndex nParams() const { return paramName.size(); }
  BernoulliCounts laplaceCounts() const;
};

#endif /* BERNOUILLI_INCLUDED */
