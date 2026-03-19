import { YahooFinanceProvider } from './YahooFinanceProvider';
import { FMPPriceProvider } from './FMPPriceProvider';
import type { PriceProvider } from './PriceProvider';

/**
 * The active price provider for the entire app.
 *
 * Priority:
 *   1. Financial Modeling Prep (FMP) — used when FMP_API_KEY env var is set.
 *      Free tier: 250 req/day. Register at https://financialmodelingprep.com
 *
 *   2. Yahoo Finance (fallback) — used when FMP_API_KEY is not set.
 *      No API key required; works out-of-the-box for local development.
 *      Warning: Yahoo Finance is an unofficial source and may break without notice.
 *
 * To switch providers entirely, change this one file.
 * All routes and services consume this export — nothing else needs to change.
 */
const fmpApiKey = process.env.FMP_API_KEY;

export const priceProvider: PriceProvider = fmpApiKey
  ? new FMPPriceProvider(fmpApiKey)
  : (() => {
      console.warn(
        '[providers] FMP_API_KEY is not set — falling back to Yahoo Finance. ' +
        'For production, set FMP_API_KEY (see .env.example). ' +
        'Register a free key at https://financialmodelingprep.com'
      );
      return new YahooFinanceProvider();
    })();

export type { PriceProvider } from './PriceProvider';
