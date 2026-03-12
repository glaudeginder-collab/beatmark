import { YahooFinanceProvider } from './YahooFinanceProvider';
import type { PriceProvider } from './PriceProvider';

/**
 * The active price provider for the entire app.
 *
 * To swap data sources (e.g. Yahoo → Twelve Data), change this one line.
 * All routes and services consume this export — nothing else needs to change.
 */
export const priceProvider: PriceProvider = new YahooFinanceProvider();

export type { PriceProvider } from './PriceProvider';
