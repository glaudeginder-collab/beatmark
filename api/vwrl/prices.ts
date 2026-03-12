import type { VercelRequest, VercelResponse } from '@vercel/node';
import { priceProvider } from '../backend/src/providers/index';
import type { VwrlPricesResponse } from '../shared/index';

/**
 * GET /api/vwrl/prices
 *
 * Returns historical adjusted close prices for VWRL.L over a given date range.
 * Used by the frontend to render the benchmark chart line.
 *
 * Query parameters:
 *   from  (required) — ISO date YYYY-MM-DD — start of range
 *   to    (optional) — ISO date YYYY-MM-DD — end of range (defaults to today)
 *
 * Caching strategy:
 *   CDN cache via Cache-Control headers (Vercel Edge Network).
 *   s-maxage=86400 → cached at CDN for 24 hours
 *   stale-while-revalidate=3600 → serves stale while revalidating in background
 *   This is the right call for v1: zero infra, zero cost, zero complexity.
 *   See API_DESIGN.md §4 for the full caching rationale.
 *
 * VWRL.L earliest listing date: 2012-01-23 — reject any `from` before this.
 */

const VWRL_TICKER = 'VWRL.L';
const VWRL_LISTING_DATE = '2012-01-23';
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Structured error response shape — matches ApiError from shared/index.ts */
interface ErrorBody {
  error: string;
  code: string;
  details?: string;
}

/** Send a structured API error response */
function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  error: string,
  details?: string
): void {
  const body: ErrorBody = {
    error,
    code,
    ...(details ? { details } : {}),
  };
  res.status(status).json(body);
}

/** Validate that a string is a valid ISO date (YYYY-MM-DD) */
function isValidIsoDate(dateStr: string): boolean {
  if (!ISO_DATE_REGEX.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/** Format a Date as YYYY-MM-DD in UTC */
function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const origin = req.headers.origin as string | undefined;
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Only allow GET
  if (req.method !== 'GET') {
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET requests are supported.');
    return;
  }

  const today = toIsoDate(new Date());

  // ── Extract & validate query params ──────────────────────────────────────

  const { from, to: toParam } = req.query as Record<string, string | undefined>;

  if (!from || typeof from !== 'string') {
    sendError(res, 400, 'VALIDATION_ERROR', 'Query parameter `from` is required.');
    return;
  }

  if (!isValidIsoDate(from)) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      '`from` must be a valid ISO date in YYYY-MM-DD format.',
      `Received: "${from}"`
    );
    return;
  }

  const to = toParam && typeof toParam === 'string' ? toParam : today;

  if (!isValidIsoDate(to)) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      '`to` must be a valid ISO date in YYYY-MM-DD format.',
      `Received: "${to}"`
    );
    return;
  }

  // from must not be in the future
  if (from > today) {
    sendError(
      res,
      400,
      'DATE_IN_FUTURE',
      '`from` cannot be in the future.',
      `Today is ${today}; received from="${from}"`
    );
    return;
  }

  // to must not be in the future (clamp silently would hide bugs; reject instead)
  if (to > today) {
    sendError(
      res,
      400,
      'DATE_IN_FUTURE',
      '`to` cannot be in the future.',
      `Today is ${today}; received to="${to}"`
    );
    return;
  }

  // from must not predate VWRL.L listing
  if (from < VWRL_LISTING_DATE) {
    sendError(
      res,
      400,
      'DATE_TOO_EARLY',
      `VWRL.L was listed on ${VWRL_LISTING_DATE}. No price data is available before this date.`,
      `Received from="${from}"`
    );
    return;
  }

  // from must be before or equal to to
  if (from > to) {
    sendError(
      res,
      400,
      'INVALID_DATE_RANGE',
      '`from` must be on or before `to`.',
      `Received from="${from}", to="${to}"`
    );
    return;
  }

  // ── Fetch price data ──────────────────────────────────────────────────────

  let prices;
  try {
    prices = await priceProvider.getHistoricalPrices(
      VWRL_TICKER,
      new Date(from),
      new Date(to)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[vwrl/prices] Price fetch failed: ${message}`);
    sendError(
      res,
      503,
      'PRICE_SOURCE_UNAVAILABLE',
      'Market data is temporarily unavailable. Please try again in a few minutes.',
      message
    );
    return;
  }

  // ── Build response ────────────────────────────────────────────────────────

  const dataAsOf = prices.length > 0 ? prices[prices.length - 1].date : from;
  const cachedAt = new Date().toISOString();

  const body: VwrlPricesResponse = {
    ticker: 'VWRL.L',
    name: 'Vanguard FTSE All-World UCITS ETF',
    currency: 'GBP',
    prices,
    dataAsOf,
    cachedAt,
  };

  // CDN cache: 24h, serve stale for 1h while revalidating
  // Vercel's Edge Network respects s-maxage on serverless function responses.
  // This means the first request of the day hits Yahoo Finance; subsequent
  // requests in the same 24h window are served from Vercel's CDN. Free, reliable.
  res.setHeader(
    'Cache-Control',
    's-maxage=86400, stale-while-revalidate=3600'
  );
  res.setHeader('Content-Type', 'application/json');

  res.status(200).json(body);
}
