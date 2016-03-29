#ifndef LOGSUMEXP_INCLUDED
#define LOGSUMEXP_INCLUDED

#include <gsl/gsl_vector.h>
#include <vector>
#include <cmath>

using namespace std;

/* uncomment to disable lookup table */
/*
#define LOGSUMEXP_DEBUG
*/

/* uncomment to catch NaN errors */
/*
#define NAN_DEBUG
*/

#define LOG_SUM_EXP_LOOKUP_MAX 10
#define LOG_SUM_EXP_LOOKUP_PRECISION .0001

#define LOG_SUM_EXP_LOOKUP_ENTRIES (((int) (LOG_SUM_EXP_LOOKUP_MAX / LOG_SUM_EXP_LOOKUP_PRECISION)) + 1)

double log_sum_exp_unary_slow (double x);  /* does not use lookup table */

struct LogSumExpLookupTable {
  double *lookup;
  LogSumExpLookupTable();
  ~LogSumExpLookupTable();
};

extern LogSumExpLookupTable logSumExpLookupTable;

inline double log_sum_exp_unary (double x) {
  /* returns log(1 + exp(-x)) for nonnegative x */
#ifdef LOGSUMEXP_DEBUG
  return log_sum_exp_unary_slow(x);
#else /* LOGSUMEXP_DEBUG */
  int n;
  double dx, f0, f1, df;
  if (x >= LOG_SUM_EXP_LOOKUP_MAX || std::isnan(x) || std::isinf(x))
    return 0;
  if (x < 0) {  /* really dumb approximation for x < 0. Should never be encountered, so issue a warning */
    cerr << "Called log_sum_exp_unary(x) for negative x = " << x << endl;
    return -x;
  }
  n = (int) (x / LOG_SUM_EXP_LOOKUP_PRECISION);
  dx = x - (n * LOG_SUM_EXP_LOOKUP_PRECISION);
  f0 = logSumExpLookupTable.lookup[n];
  f1 = logSumExpLookupTable.lookup[n+1];
  df = f1 - f0;
  return f0 + df * (dx / LOG_SUM_EXP_LOOKUP_PRECISION);
#endif /* LOGSUMEXP_DEBUG */
}

inline double log_sum_exp (double a, double b) {
  /* returns log(exp(a) + exp(b)) */
  double max, diff, ret;
  // Note: Infinity plus or minus a finite quantity is still Infinity,
  // but Infinity - Infinity = NaN.
  // Thus, we are susceptible to NaN errors when trying to add 0+0 in log-space.
  // To work around this, we explicitly test for a==b.
  if (a == b) { max = a; diff = 0; }
  else if (a < b) { max = b; diff = b - a; }
  else { max = a; diff = a - b; }
  ret = max + log_sum_exp_unary (diff);
#if defined(NAN_DEBUG)
  if (std::isnan(ret)) {
    cerr << "NaN error in log_sum_exp" << endl;
    throw;
  }
#endif
  return ret;
}

inline double log_sum_exp (double a, double b, double c) {
    return log_sum_exp (log_sum_exp (a, b), c);
}

inline double log_sum_exp (double a, double b, double c, double d) {
    return log_sum_exp (log_sum_exp (log_sum_exp (a, b), c), d);
}

inline void log_accum_exp (double& a, double b) {
  a = log_sum_exp (a, b);
}  

inline double log_sum_exp (double a, double b, double c, double d, double e) {
    return log_sum_exp (log_sum_exp (log_sum_exp (log_sum_exp (a, b), c), d), e);
}

double log_sum_exp_slow (double a, double b);  /* does not use lookup table */
double log_sum_exp_slow (double a, double b, double c);
double log_sum_exp_slow (double a, double b, double c, double d);

void log_accum_exp_slow (double& a, double b);

typedef double LogProb;
std::vector<LogProb> log_gsl_vector (gsl_vector* v);
std::vector<double> gsl_vector_to_stl (gsl_vector* v);

inline LogProb logInnerProduct (const vector<LogProb>& v1, const vector<LogProb>& v2) {
  LogProb lip = -numeric_limits<double>::infinity();
  for (vector<LogProb>::const_iterator iter1 = v1.begin(), iter2 = v2.begin(); iter1 != v1.end(); ++iter1, ++iter2)
    lip = log_sum_exp (lip, *iter1 + *iter2);
  return lip;
}

double logBetaPdf (double prob, double yesCount, double noCount);
double logGammaPdf (double rate, double eventCount, double waitTime);
double logDirichletPdf (const vector<double>& prob, const vector<double>& count);

#endif /* LOGSUMEXP_INCLUDED */
