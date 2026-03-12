import type { PricePoint } from '../../../shared/index';

/**
 * PriceProvider — abstract interface for historical price data sources.
 *
 * The concrete implementation (Yahoo Finance, Twelve Data, etc.) is wired up
 * in providers/index.ts. Swap one line there to change the data source for
 * the entire app — nothing else should need to change.
 */
export interface PriceProvider {
  /**
   * Returns daily adjusted close prices for a ticker over a date range.
   * Only returns trading days (no weekends or market holidays).
   * Prices are in the ticker's native currency (VWRL.L → GBP).
   *
   * @param ticker  e.g. 'VWRL.L'
   * @param from    Start date (inclusive)
   * @param to      End date (inclusive)
   */
  getHistoricalPrices(
    ticker: string,
    from: Date,
    to: Date
  ): Promise<PricePoint[]>;

  /**
   * Returns the adjusted close price on or immediately before the given date.
   * If the exact date is a non-trading day (weekend/holiday), returns the most
   * recent prior trading day's price.
   * Returns null if no data is available at or before that date.
   *
   * @param ticker  e.g. 'VWRL.L'
   * @param date    Target date — will look back up to 7 days if needed
   */
  getPriceOnOrBefore(
    ticker: string,
    date: Date
  ): Promise<PricePoint | null>;

  /**
   * Returns the most recent available price.
   * This is the last trading day's close — not real-time intraday.
   *
   * @param ticker  e.g. 'VWRL.L'
   */
  getLatestPrice(ticker: string): Promise<PricePoint>;

  /**
   * Human-readable name used in logs and error messages.
   * e.g. 'Yahoo Finance (yahoo-finance2)'
   */
  readonly providerName: string;
}
