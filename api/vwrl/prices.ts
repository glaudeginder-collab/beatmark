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
 * Fallback cache:
 *   A module-level in-memory cache stores the last successful price response.
 *   If Yahoo Finance fails and the cache is less than 24h old, the cached data
 *   is returned with a DATA_MAY_BE_STALE warning instead of a 503. This keeps
 *   the app functional through short upstream outages.
 *
 * VWRL.L earliest listing date: 2012-01-23 — reject any `from` before this.
 */

const VWRL_TICKER = 'VWRL.L';
const VWRL_LISTING_DATE = '2012-01-23';
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Module-level fallback cache ───────────────────────────────────────────────
// Survives across warm Lambda invocations (not across cold starts, but that's
// fine — we just fall back to a 503 in that case).
interface PriceCacheEntry {
  body: VwrlPricesResponse;
  cachedAt: number; // unix ms
  /** The query key this response corresponds to: "{from}|{to}" */
  key: string;
}

let priceCache: PriceCacheEntry | null = null;

/** Structured error response shape — matches ApiError from shared/index.ts */
interface ErrorBody {
  error: string;
  code: string;
  details?: string;
  warning?: string;
}

/**
 * Send a structured API error response.
 * Always sets Cache-Control: no-store so error responses are never cached
 * at the CDN or in the browser.
 */
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
  res.setHeader('Cache-Control', 'no-store');
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
  // ── Outer try/catch: catch anything unexpected (bug, crash, bad import, etc.)
  // This ensures we always return a structured JSON response, never a raw 500.
  try {
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

    const cacheKey = `${from}|${to}`;
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

      // ── Fallback cache: serve stale data if it's less than 24h old ──────
      const now = Date.now();
      if (
        priceCache !== null &&
        priceCache.key === cacheKey &&
        now - priceCache.cachedAt < FALLBACK_CACHE_TTL_MS
      ) {
        const ageMinutes = Math.round((now - priceCache.cachedAt) / 60_000);
        console.warn(
          `[vwrl/prices] Serving stale cache (${ageMinutes}m old) due to upstream failure.`
        );

        const staleBody: VwrlPricesResponse & { warning?: string } = {
          ...priceCache.body,
          warning: 'DATA_MAY_BE_STALE',
        };

        // Don't let the CDN cache a stale/fallback response — browser may
        // re-validate sooner once Yahoo comes back.
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(staleBody);
        return;
      }

      // No usable cache — return 503
      sendError(
        res,
        503,
        'PRICE_SOURCE_UNAVAILABLE',
        'Market data is temporarily unavailable. Please try again in a few minutes.'
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

    // ── Update module-level fallback cache with this successful response ──
    priceCache = {
      body,
      cachedAt: Date.now(),
      key: cacheKey,
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

  } catch (unexpectedErr) {
    // Catch-all: something crashed that shouldn't have (bug, bad module, etc.)
    // Log it loudly and return a 503 — never let Vercel emit a raw 500 with a
    // stacktrace, and never leave the client hanging with no JSON body.
    const message = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);
    console.error(`[vwrl/prices] Unexpected handler error: ${message}`, unexpectedErr);

    // Only write headers if they haven't been sent yet
    if (!res.headersSent) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({
        error: 'Market data is temporarily unavailable. Please try again in a few minutes.',
        code: 'PRICE_SOURCE_UNAVAILABLE',
      });
    }
  }
}
