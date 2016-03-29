#include <iostream>
#include <gsl/gsl_randist.h>
#include "logsumexp.h"
#include "util.h"

LogSumExpLookupTable logSumExpLookupTable = LogSumExpLookupTable();

LogSumExpLookupTable::LogSumExpLookupTable() {
  lookup = new double [LOG_SUM_EXP_LOOKUP_ENTRIES];
  int n;
  double x;
  for (n = 0; n < LOG_SUM_EXP_LOOKUP_ENTRIES; ++n) {
    x = n * LOG_SUM_EXP_LOOKUP_PRECISION;
    lookup[n] = log_sum_exp_unary_slow(x);
  }
}

LogSumExpLookupTable::~LogSumExpLookupTable() {
  delete[] lookup;
}

double log_sum_exp_slow (double a, double b) {
  double min, max, diff, ret;
  if (a < b) { min = a; max = b; }
  else { min = b; max = a; }
  diff = max - min;
  ret = max + log_sum_exp_unary_slow (diff);
#if defined(NAN_DEBUG)
  if (std::isnan(ret)) {
    cerr << "NaN error in log_sum_exp" << endl;
    throw;
  }
#endif
  return ret;
}

double log_sum_exp_slow (double a, double b, double c) {
  return log_sum_exp_slow (log_sum_exp_slow (a, b), c);
}

double log_sum_exp_slow (double a, double b, double c, double d) {
  return log_sum_exp_slow (log_sum_exp_slow (log_sum_exp_slow (a, b), c), d);
}

double log_sum_exp_unary_slow (double x) {
  return log (1. + exp(-x));
}

void log_accum_exp_slow (double& a, double b) {
  a = log_sum_exp_slow (a, b);
}

std::vector<LogProb> log_gsl_vector (gsl_vector* v) {
  std::vector<LogProb> l (v->size);
  for (size_t i = 0; i < v->size; ++i)
    l[i] = log (gsl_vector_get (v, i));
  return l;
}

std::vector<double> gsl_vector_to_stl (gsl_vector* v) {
  std::vector<double> stlv (v->size);
  for (size_t i = 0; i < v->size; ++i)
    stlv[i] = gsl_vector_get (v, i);
  return stlv;
}

double logBetaPdf (double prob, double yesCount, double noCount) {
  return log (gsl_ran_beta_pdf (prob, yesCount + 1, noCount + 1));
}

double logGammaPdf (double rate, double eventCount, double waitTime) {
  return log (gsl_ran_gamma_pdf (rate, eventCount + 1, 1. / waitTime));
}

double logDirichletPdf (const vector<double>& prob, const vector<double>& count) {
  Assert (prob.size() == count.size(), "Dimensionality of Dirichlet counts vector does not match that of probability parameter vector");
  vector<double> countPlusOne (count);
  for (auto& c : countPlusOne)
    ++c;
  return log (gsl_ran_dirichlet_pdf (prob.size(), countPlusOne.data(), prob.data()));
}
