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
typedef vector<double> BernoulliParams;

class BernoulliCounts {
public:
  map<BernoulliParamIndex,int> succ, fail;

  LogProb logBetaBernoulli (const BernoulliCounts& prior) const;
  LogProb deltaLogBetaBernoulli (const BernoulliCounts& old) const;

  template<class Generator>
  BernoulliParams sampleParams (Generator& generator) const {
    map<BernoulliParamIndex,int> mySucc(succ), myFail(fail);  // copy to leverage default-constructible property of map
    auto idx = allIndices();
    BernoulliParams p (idx.size() ? (*idx.rbegin() + 1) : 0);
    for (auto i : allIndices()) {
      gamma_distribution<double> gamma (mySucc[i] + 1, myFail[i] + 1);
      p[i] = gamma (generator);
    }
    return p;
  }

  BernoulliCounts& operator+= (const BernoulliCounts& c);

private:
  set<BernoulliParamIndex> allIndices() const;
  set<BernoulliParamIndex> combinedIndices (const BernoulliCounts& other) const;
};

struct BernoulliParamSet {
  vguard<BernoulliParamName> paramName;
  map<BernoulliParamName,BernoulliParamIndex> paramIndex;

  void addParam (const BernoulliParamName& name) {
    if (!paramIndex.count(name)) {
      paramIndex[name] = params();
      paramName.push_back (name);
    }
  }

  BernoulliParamIndex params() const { return paramName.size(); }
  BernoulliCounts laplaceCounts() const;
};

#endif /* BERNOUILLI_INCLUDED */
