#ifndef BERNOUILLI_INCLUDED
#define BERNOUILLI_INCLUDED

#include <random>
#include <map>
#include <set>
#include "vguard.h"
#include "logsumexp.h"

LogProb logBetaBernouilli (double alpha, double beta, double succ, double fail);

typedef string BernouilliParamName;
typedef int BernouilliParamIndex;
typedef vector<double> BernouilliParams;

class BernouilliParamCounts {
public:
  map<BernouilliParamIndex,int> succ, fail;

  LogProb logBetaBernouilli (const BernouilliParamCounts& prior) const;
  LogProb deltaLogBetaBernouilli (const BernouilliParamCounts& old) const;

  template<class Generator>
  BernouilliParams sampleParams (Generator& generator) const {
    map<BernouilliParamIndex,int> mySucc(succ), myFail(fail);  // copy to leverage default-constructible property of map
    auto idx = allIndices();
    BernouilliParams p (idx.size() ? (*idx.rbegin() + 1) : 0);
    for (auto i : allIndices()) {
      gamma_distribution<double> gamma (mySucc[i] + 1, myFail[i] + 1);
      p[i] = gamma (generator);
    }
    return p;
  }

  BernouilliParamCounts& operator+= (const BernouilliParamCounts& c);

private:
  set<BernouilliParamIndex> allIndices() const;
  set<BernouilliParamIndex> combinedIndices (const BernouilliParamCounts& other) const;
};

struct BernouilliParamSet {
  vguard<BernouilliParamName> paramName;
  map<BernouilliParamName,BernouilliParamIndex> paramIndex;

  void addParam (const BernouilliParamName& name) {
    if (!paramIndex.count(name)) {
      paramIndex[name] = params();
      paramName.push_back (name);
    }
  }
  BernouilliParamIndex params() const { return paramName.size(); }
};

#endif /* BERNOUILLI_INCLUDED */
