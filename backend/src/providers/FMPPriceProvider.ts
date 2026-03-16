import type { PricePoint } from '../../../shared/index';
import type { PriceProvider } from './PriceProvider';

/**
 * FMPPriceProvider — PriceProvider implementation backed by Financial Modeling Prep (FMP).
 *
 * Free tier: 250 requests/day — sufficient for MVP.
 * Register at https://financialmodelingprep.com and set FMP_API_KEY as an env var.
 *
 * Endpoints used:
 *   - Current price:   GET /api/v3/quote/{symbol}?apikey={key}
 *   - Historical data: GET /api/v3/historical-price-full/{symbol}?from=&to=&apikey={key}
 *
 * Ticker mapping:
 *   VWRL → VWRL.L  (London Stock Exchange, GBP)
 *   VWCE → VWCE.AS (Euronext Amsterdam, EUR)
 *
 * Note: FMP historical data includes `adjClose` (dividend-adjusted closing price),
 * which is consistent with what YahooFinanceProvider was using — correct for
 * total return benchmark comparisons.
 */

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

/** Shape of a single item from FMP's /quote endpoint */
interface FMPQuote {
  symbol: string;
  price: number;
  currency?: string;
}

/** Shape of a single row from FMP's /historical-price-full endpoint */
interface FMPHistoricalDay {
  date: string;       // YYYY-MM-DD
  open?: number;
  high?: number;
  low?: number;
  close: number;
  adjClose?: number;  // Dividend-adjusted close — prefer this for benchmark accuracy
  volume?: number;
  changePercent?: number;
}

/** Shape of the /historical-price-full response */
interface FMPHistoricalResponse {
  symbol: string;
  historical: FMPHistoricalDay[];
}

export class FMPPriceProvider implements PriceProvider {
  readonly providerName = 'Financial Modeling Prep (FMP)';

  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Fetches daily adjusted close prices for the given ticker and date range.
   * Returns only trading days (no weekends / market holidays).
   * Prices are in the ticker's native currency (VWRL.L → GBP).
   */
  async getHistoricalPrices(
    ticker: string,
    from: Date,
    to: Date
  ): Promise<PricePoint[]> {
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    const url = `${FMP_BASE_URL}/historical-price-full/${encodeURIComponent(ticker)}` +
      `?from=${fromStr}&to=${toStr}&apikey=${this.apiKey}`;

    let data: FMPHistoricalResponse;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `[${this.providerName}] HTTP ${response.status} ${response.statusText} ` +
          `fetching historical prices for ${ticker}`
        );
      }

      data = await response.json() as FMPHistoricalResponse;
    } catch (err) {
      // Re-throw fetch/parse errors with context
      if (err instanceof Error && err.message.startsWith(`[${this.providerName}]`)) {
        throw err;
      }
      throw new Error(
        `[${this.providerName}] Network error fetching historical prices for ${ticker}: ` +
        (err instanceof Error ? err.message : String(err))
      );
    }

    if (!data.historical || !Array.isArray(data.historical)) {
      // FMP returns an empty object or missing `historical` key when no data exists
      console.warn(
        `[${this.providerName}] No historical data returned for ${ticker} ` +
        `(from: ${fromStr}, to: ${toStr}). ` +
        'Check that the ticker is valid and the FMP free tier covers this exchange.'
      );
      return [];
    }

    return data.historical
      .filter(row => row != null && (row.adjClose != null || row.close != null))
      .map(row => ({
        date: row.date,
        // Prefer adjClose (dividend-adjusted total return); fall back to close
        close: row.adjClose ?? row.close,
      }))
      // FMP returns newest-first — sort ascending so callers get chronological order
      .sort((a: PricePoint, b: PricePoint) => a.date.localeCompare(b.date));
  }

  /**
   * Returns the adjusted close price on or immediately before the given date.
   * Looks back up to 7 days to handle weekends and market holidays.
   */
  async getPriceOnOrBefore(
    ticker: string,
    date: Date
  ): Promise<PricePoint | null> {
    const lookbackDays = 7;
    const from = new Date(date);
    from.setDate(from.getDate() - lookbackDays);

    // +1 day buffer so the target date itself is included if it's a trading day
    const to = new Date(date);
    to.setDate(to.getDate() + 1);

    const prices = await this.getHistoricalPrices(ticker, from, to);

    if (prices.length === 0) return null;

    const targetDateStr = date.toISOString().split('T')[0];
    const eligible = prices.filter(p => p.date <= targetDateStr);

    if (eligible.length === 0) return null;

    return eligible[eligible.length - 1];
  }

  /**
   * Returns the most recent available trading day's close price.
   * Uses the /quote endpoint for a single, current price point.
   */
  async getLatestPrice(ticker: string): Promise<PricePoint> {
    const url = `${FMP_BASE_URL}/quote/${encodeURIComponent(ticker)}?apikey=${this.apiKey}`;

    let quotes: FMPQuote[];

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `[${this.providerName}] HTTP ${response.status} ${response.statusText} ` +
          `fetching latest price for ${ticker}`
        );
      }

      quotes = await response.json() as FMPQuote[];
    } catch (err) {
      if (err instanceof Error && err.message.startsWith(`[${this.providerName}]`)) {
        throw err;
      }
      throw new Error(
        `[${this.providerName}] Network error fetching latest price for ${ticker}: ` +
        (err instanceof Error ? err.message : String(err))
      );
    }

    if (!Array.isArray(quotes) || quotes.length === 0 || quotes[0].price == null) {
      throw new Error(
        `[${this.providerName}] No price data returned for ${ticker}. ` +
        'Check the ticker symbol and FMP API key.'
      );
    }

    const today = new Date().toISOString().split('T')[0];

    return {
      date: today,
      close: quotes[0].price,
    };
  }
}
