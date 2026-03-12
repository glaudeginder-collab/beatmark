/**
 * calculator.ts — Pure calculation functions for BeatMark.
 *
 * No I/O. No side effects. No external dependencies beyond shared types.
 * Every function here is deterministic and independently testable.
 *
 * These are the maths at the heart of BeatMark: given VWRL prices and
 * a portfolio holding, compute returns, benchmark equivalents, and verdicts.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type {
  HoldingInput,
  HoldingResult,
  PortfolioSummary,
  BenchmarkSummary,
  ComparisonSummary,
  PricePoint,
} from '../../shared/index';

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Round a number to 2 decimal places.
 * Used at the final output step only — never accumulate rounding errors
 * by calling this mid-calculation.
 */
export const round2dp = (n: number): number => Math.round(n * 100) / 100;

/**
 * Sum an array of numbers. Returns 0 for empty arrays.
 */
export const sum = (nums: number[]): number =>
  nums.reduce((a, b) => a + b, 0);

/**
 * Determine the verdict given an outperformance percentage.
 * "matching" is a ±0.1% dead zone to avoid spurious beating/trailing verdicts.
 */
export function getVerdict(
  outperformance: number
): 'beating' | 'trailing' | 'matching' {
  if (outperformance > 0.1) return 'beating';
  if (outperformance < -0.1) return 'trailing';
  return 'matching';
}

// ─── Per-Holding Calculation ─────────────────────────────────────────────────

/**
 * Calculate all metrics for a single holding.
 *
 * The core maths:
 *   - Portfolio return: (currentValue - amountInvested) / amountInvested
 *   - VWRL growth factor: vwrlToday.close / vwrlOnPurchase.close
 *   - VWRL equivalent value: amountInvested × vwrlGrowthFactor
 *   - VWRL return: (vwrlEquivalentValue - amountInvested) / amountInvested
 *   - Outperformance: totalReturn% - vwrlReturn%
 *
 * The vwrlPurchaseDate may differ from holding.purchaseDate if it was adjusted
 * to a trading day — that's the caller's concern (it emits a warning). This
 * function just does the maths with whatever prices it receives.
 *
 * @param holding             The raw holding input from the user
 * @param vwrlOnPurchaseDate  VWRL price on (or nearest to) the holding's purchase date
 * @param vwrlToday           Most recent available VWRL price
 */
export function calculateHoldingResult(
  holding: HoldingInput,
  vwrlOnPurchaseDate: PricePoint,
  vwrlToday: PricePoint
): HoldingResult {
  // Portfolio return for this holding
  const totalReturnAbsolute = holding.currentValue - holding.amountInvested;
  const totalReturn = (totalReturnAbsolute / holding.amountInvested) * 100;

  // What VWRL would have returned over the same period, starting from the same amount
  const vwrlGrowthFactor = vwrlToday.close / vwrlOnPurchaseDate.close;
  const vwrlEquivalentValue = holding.amountInvested * vwrlGrowthFactor;
  const vwrlReturnAbsolute = vwrlEquivalentValue - holding.amountInvested;
  const vwrlReturn = (vwrlReturnAbsolute / holding.amountInvested) * 100;

  // Delta: positive = beating VWRL, negative = trailing
  const outperformance = totalReturn - vwrlReturn;

  return {
    id: holding.id,
    name: holding.name,
    amountInvested: holding.amountInvested,
    currentValue: holding.currentValue,
    purchaseDate: holding.purchaseDate,
    // Round at output step only — don't round intermediate values above
    totalReturn: round2dp(totalReturn),
    totalReturnAbsolute: round2dp(totalReturnAbsolute),
    vwrlReturn: round2dp(vwrlReturn),
    vwrlReturnAbsolute: round2dp(vwrlReturnAbsolute),
    vwrlEquivalentValue: round2dp(vwrlEquivalentValue),
    outperformance: round2dp(outperformance),
  };
}

// ─── Portfolio-Level Aggregation ─────────────────────────────────────────────

/**
 * Aggregate all holding results into a portfolio summary.
 *
 * totalReturn is a simple portfolio-level return:
 *   (sum(currentValues) - sum(amountInvested)) / sum(amountInvested)
 *
 * This is NOT money-weighted (IRR). It's a cost-basis return, which is
 * the right metric for v1's single-transaction-per-holding model.
 */
export function calculatePortfolioSummary(
  holdings: HoldingResult[]
): PortfolioSummary {
  const totalInvested = sum(holdings.map(h => h.amountInvested));
  const totalCurrentValue = sum(holdings.map(h => h.currentValue));
  const totalReturnAbsolute = totalCurrentValue - totalInvested;
  // Guard against divide-by-zero (should never happen — amountInvested > 0 is validated upstream)
  const totalReturn =
    totalInvested > 0 ? (totalReturnAbsolute / totalInvested) * 100 : 0;

  return {
    totalInvested: round2dp(totalInvested),
    totalCurrentValue: round2dp(totalCurrentValue),
    totalReturn: round2dp(totalReturn),
    totalReturnAbsolute: round2dp(totalReturnAbsolute),
  };
}

// ─── Benchmark Aggregation ───────────────────────────────────────────────────

/**
 * Aggregate per-holding VWRL equivalent values into a benchmark summary.
 *
 * This is a money-weighted benchmark: we're asking "if each holding's capital
 * had gone into VWRL on that holding's purchase date, what would it be worth
 * today in total?". This correctly accounts for when money entered the market.
 *
 * It is NOT the same as "what if all money went into VWRL on the earliest
 * purchase date" — that would overstate VWRL's returns for later investments.
 *
 * @param holdingResults  Per-holding results (already computed)
 * @param totalInvested   Sum of amountInvested across all holdings
 */
export function calculateBenchmarkSummary(
  holdingResults: HoldingResult[],
  totalInvested: number
): BenchmarkSummary {
  const totalEquivalentValue = sum(holdingResults.map(h => h.vwrlEquivalentValue));
  const totalReturnAbsolute = totalEquivalentValue - totalInvested;
  const totalReturn =
    totalInvested > 0 ? (totalReturnAbsolute / totalInvested) * 100 : 0;

  return {
    ticker: 'VWRL.L',
    name: 'Vanguard FTSE All-World UCITS ETF',
    totalEquivalentValue: round2dp(totalEquivalentValue),
    totalReturn: round2dp(totalReturn),
    totalReturnAbsolute: round2dp(totalReturnAbsolute),
  };
}

// ─── Comparison ──────────────────────────────────────────────────────────────

/**
 * Compute the overall portfolio vs. benchmark comparison.
 *
 * outperformance: how many percentage points the portfolio returned
 *   above/below VWRL.
 * outperformanceAbsolute: the GBP difference between what the portfolio
 *   is actually worth vs what it would have been worth in VWRL.
 * verdict: 'beating' / 'trailing' / 'matching' (±0.1% dead zone).
 */
export function calculateComparison(
  portfolio: PortfolioSummary,
  benchmark: BenchmarkSummary
): ComparisonSummary {
  const outperformance = round2dp(
    portfolio.totalReturn - benchmark.totalReturn
  );
  const outperformanceAbsolute = round2dp(
    portfolio.totalReturnAbsolute - benchmark.totalReturnAbsolute
  );

  return {
    outperformance,
    outperformanceAbsolute,
    verdict: getVerdict(outperformance),
  };
}
