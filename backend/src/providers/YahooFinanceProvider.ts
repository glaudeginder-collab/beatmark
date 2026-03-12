import yahooFinance from 'yahoo-finance2';
import type { PricePoint } from '../../../shared/index';
import type { PriceProvider } from './PriceProvider';

/**
 * Shape of a single row from yahoo-finance2's _chart() quotes array.
 * We define this locally because the package doesn't expose subpath types.
 */
interface ChartRow {
  date: Date;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  adjclose?: number; // Note: lowercase 'c' — yahoo-finance2 _chart uses 'adjclose'
  volume?: number;
}

/**
 * YahooFinanceProvider — default implementation of PriceProvider.
 *
 * Uses the unofficial yahoo-finance2 npm package (v2.3.x). No API key required.
 *
 * Uses the `_chart()` method (backed by Yahoo's v8 chart API) rather than
 * `historical()` (backed by the v7 CSV API, which Yahoo has restricted).
 * `_chart()` returns `adjclose` (lowercase), which represents the dividend-
 * adjusted closing price — correct for total return benchmark comparisons.
 *
 * IMPORTANT: adjclose for VWRL.L implicitly assumes dividend reinvestment.
 * Surface this in the UI: "VWRL benchmark assumes dividend reinvestment."
 *
 * Risk: Yahoo Finance is unofficial and has broken without notice before.
 * Mitigation: PriceProvider interface allows a drop-in swap (e.g. Twelve Data)
 * without changing any other code — swap one line in providers/index.ts.
 */
export class YahooFinanceProvider implements PriceProvider {
  readonly providerName = 'Yahoo Finance (yahoo-finance2 _chart)';

  /**
   * Fetches daily adjusted close prices for the given ticker and date range.
   * Returns only trading days (no weekends / market holidays).
   */
  async getHistoricalPrices(
    ticker: string,
    from: Date,
    to: Date
  ): Promise<PricePoint[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await (yahooFinance as any)._chart(ticker, {
      period1: from.toISOString().split('T')[0],
      period2: to.toISOString().split('T')[0],
      interval: '1d',
    });

    const quotes: ChartRow[] = result?.quotes ?? [];

    return quotes
      .filter(r => r.date != null && (r.adjclose != null || r.close != null))
      .map(r => ({
        date: new Date(r.date).toISOString().split('T')[0],
        // Prefer adjclose (dividend-adjusted total return); fall back to close only if null
        close: r.adjclose ?? (r.close as number),
      }))
      // Ensure ascending date order
      .sort((a: PricePoint, b: PricePoint) => a.date.localeCompare(b.date));
  }

  /**
   * Returns the adjusted close price on or immediately before the given date.
   *
   * Fetches a 7-day window ending on `date` to handle non-trading days
   * (weekends, UK bank holidays). Returns the most recent data point in that
   * window — i.e. the last trading day at or before `date`.
   *
   * Returns null only if no data exists within the lookback window — this
   * should only happen for dates before VWRL.L's listing (2012-01-23).
   */
  async getPriceOnOrBefore(
    ticker: string,
    date: Date
  ): Promise<PricePoint | null> {
    const lookbackDays = 7;
    const from = new Date(date);
    from.setDate(from.getDate() - lookbackDays);

    // Add 1-day buffer to `to` so the target date itself is included
    // when it falls on a trading day
    const to = new Date(date);
    to.setDate(to.getDate() + 1);

    const prices = await this.getHistoricalPrices(ticker, from, to);

    if (prices.length === 0) return null;

    // Exclude any dates after the requested date (the +1 buffer can
    // occasionally return next day's data near market open)
    const targetDateStr = date.toISOString().split('T')[0];
    const eligible = prices.filter(p => p.date <= targetDateStr);

    if (eligible.length === 0) return null;

    // Most recent price at or before the requested date
    return eligible[eligible.length - 1];
  }

  /**
   * Returns the most recent available trading day's close price.
   * Looks back up to 7 days to find the last trading day.
   */
  async getLatestPrice(ticker: string): Promise<PricePoint> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);

    const prices = await this.getHistoricalPrices(ticker, from, to);

    if (prices.length === 0) {
      throw new Error(
        `[${this.providerName}] No recent price data found for ${ticker}. ` +
        `Yahoo Finance may be unavailable or the ticker may be invalid.`
      );
    }

    return prices[prices.length - 1];
  }
}
