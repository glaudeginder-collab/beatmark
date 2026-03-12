/**
 * POST /api/calculate
 *
 * The core BeatMark endpoint. Accepts a portfolio of holdings and returns
 * a full comparison against VWRL.L — per-holding returns, benchmark equivalents,
 * portfolio-level aggregates, and a beating/trailing/matching verdict.
 *
 * This is what Jamie's results panel runs on. The response shape is locked in
 * shared/index.ts — don't change field names without coordinating with frontend.
 *
 * Design decisions:
 *   - In-request memoisation of VWRL price lookups (avoid duplicate Yahoo calls
 *     when multiple holdings share a purchase date)
 *   - Pure calculation logic lives in src/calculator.ts (no I/O, fully testable)
 *   - All validation happens before any external calls
 *   - Warnings are non-fatal; they surface edge cases the user should know about
 *
 * See API_DESIGN.md for the full contract, edge cases, and rationale.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { priceProvider } from '../src/providers/index';
import type {
  CalculateRequest,
  CalculateResponse,
  HoldingInput,
  HoldingResult,
  Warning,
  PricePoint,
} from '../../shared/index';
import {
  calculateHoldingResult,
  calculatePortfolioSummary,
  calculateBenchmarkSummary,
  calculateComparison,
} from '../src/calculator';

// ─── Constants ───────────────────────────────────────────────────────────────

const VWRL_TICKER = 'VWRL.L';
const VWRL_LISTING_DATE = '2012-01-23';
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** Emit NEAR_LISTING_DATE warning for holdings within this many days of VWRL listing */
const NEAR_LISTING_THRESHOLD_DAYS = 30;
/** Emit DATA_MAY_BE_STALE if the latest price is older than this many calendar days */
const STALE_DATA_THRESHOLD_DAYS = 3;
/** Maximum number of holdings per request */
const MAX_HOLDINGS = 50;
/** Maximum length of a holding name */
const MAX_NAME_LENGTH = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ErrorBody {
  error: string;
  code: string;
  details?: string;
}

function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  error: string,
  details?: string
): void {
  const body: ErrorBody = { error, code, ...(details ? { details } : {}) };
  res.status(status).json(body);
}

/** Format a Date as YYYY-MM-DD (UTC) */
function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** True if the string is a syntactically valid ISO date (YYYY-MM-DD) */
function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE_REGEX.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

/** Number of calendar days between two ISO date strings (a - b) */
function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / msPerDay);
}

// ─── Validation ──────────────────────────────────────────────────────────────

type ValidationResult =
  | { valid: true }
  | { valid: false; status: number; code: string; error: string; details?: string };

/**
 * Full validation of the request body.
 * Returns early on first error — we don't accumulate multiple errors in v1.
 */
function validateRequest(body: unknown, today: string): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      valid: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      error: 'Request body must be a JSON object.',
    };
  }

  const req = body as Record<string, unknown>;

  // currency — must be 'GBP'
  if (req.currency !== 'GBP') {
    return {
      valid: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      error: 'Only GBP is supported in v1.',
      details: `Received currency: ${JSON.stringify(req.currency)}`,
    };
  }

  // holdings — must be a non-empty array, max 50 items
  if (!Array.isArray(req.holdings) || req.holdings.length === 0) {
    return {
      valid: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      error: '`holdings` must be a non-empty array.',
    };
  }

  if (req.holdings.length > MAX_HOLDINGS) {
    return {
      valid: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      error: `Too many holdings. Maximum is ${MAX_HOLDINGS}.`,
      details: `Received ${req.holdings.length} holdings.`,
    };
  }

  // Validate each holding
  for (let i = 0; i < req.holdings.length; i++) {
    const h = req.holdings[i] as Record<string, unknown>;
    const prefix = `holdings[${i}]`;

    if (!h || typeof h !== 'object') {
      return {
        valid: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        error: `${prefix} must be an object.`,
      };
    }

    // id — non-empty string
    if (typeof h.id !== 'string' || h.id.trim() === '') {
      return {
        valid: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        error: `${prefix}.id must be a non-empty string.`,
      };
    }

    // name — non-empty string, max 100 chars
    if (typeof h.name !== 'string' || h.name.trim() === '') {
      return {
        valid: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        error: `${prefix}.name must be a non-empty string.`,
      };
    }
    if (h.name.length > MAX_NAME_LENGTH) {
      return {
        valid: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        error: `${prefix}.name exceeds maximum length of ${MAX_NAME_LENGTH} characters.`,
        details: `"${h.name.substring(0, 30)}..." is ${h.name.length} chars.`,
      };
    }

    // amountInvested — number > 0
    if (typeof h.amountInvested !== 'number' || !isFinite(h.amountInvested) || h.amountInvested <= 0) {
      return {
        valid: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        error: `${prefix}.amountInvested must be a number greater than 0.`,
        details: `Received: ${JSON.stringify(h.amountInvested)}`,
      };
    }

    // currentValue — number >= 0
    if (typeof h.currentValue !== 'number' || !isFinite(h.currentValue) || h.currentValue < 0) {
      return {
        valid: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        error: `${prefix}.currentValue must be a number >= 0.`,
        details: `Received: ${JSON.stringify(h.currentValue)}`,
      };
    }

    // purchaseDate — valid YYYY-MM-DD
    if (typeof h.purchaseDate !== 'string' || !isValidIsoDate(h.purchaseDate)) {
      return {
        valid: false,
        status: 400,
        code: 'VALIDATION_ERROR',
        error: `${prefix}.purchaseDate must be a valid date in YYYY-MM-DD format.`,
        details: `Received: ${JSON.stringify(h.purchaseDate)}`,
      };
    }

    // purchaseDate — not in the future
    if (h.purchaseDate > today) {
      return {
        valid: false,
        status: 400,
        code: 'DATE_IN_FUTURE',
        error: `${prefix}.purchaseDate cannot be in the future.`,
        details: `Today is ${today}; received purchaseDate="${h.purchaseDate}"`,
      };
    }

    // purchaseDate — not before VWRL.L listing date
    if (h.purchaseDate < VWRL_LISTING_DATE) {
      return {
        valid: false,
        status: 400,
        code: 'DATE_TOO_EARLY',
        error: `VWRL.L was listed on ${VWRL_LISTING_DATE}. No price data is available before this date.`,
        details: `${prefix}.purchaseDate="${h.purchaseDate}"`,
      };
    }
  }

  return { valid: true };
}

// ─── Price Fetching (with in-request memoisation) ────────────────────────────

/**
 * Build a memoised VWRL price lookup function for a single request invocation.
 *
 * Multiple holdings may share a purchase date. We memoise by date string so
 * we don't call Yahoo Finance multiple times for the same date within a request.
 * (In-memory memoisation is fine here — it only lives for the duration of this
 * serverless invocation.)
 */
function buildPriceFetcher() {
  const cache = new Map<string, PricePoint | null>();

  return async function getVwrlPriceOnOrBefore(
    dateStr: string
  ): Promise<PricePoint | null> {
    if (cache.has(dateStr)) return cache.get(dateStr)!;
    const price = await priceProvider.getPriceOnOrBefore(
      VWRL_TICKER,
      new Date(dateStr)
    );
    cache.set(dateStr, price);
    return price;
  };
}

// ─── Warning Builders ────────────────────────────────────────────────────────

function buildPurchaseDateAdjustedWarning(
  holdingId: string,
  holdingName: string,
  requestedDate: string,
  actualDate: string
): Warning {
  return {
    code: 'PURCHASE_DATE_ADJUSTED',
    holdingId,
    message:
      `Price data for ${requestedDate} was not available for "${holdingName}" ` +
      `(non-trading day). Using ${actualDate} instead.`,
  };
}

function buildNearListingDateWarning(holding: HoldingInput): Warning {
  return {
    code: 'NEAR_LISTING_DATE',
    holdingId: holding.id,
    message:
      `Purchase date ${holding.purchaseDate} for "${holding.name}" is within ` +
      `${NEAR_LISTING_THRESHOLD_DAYS} days of VWRL.L's listing date (${VWRL_LISTING_DATE}). ` +
      `Early price data may be sparse or less reliable.`,
  };
}

function buildCurrentValueZeroWarning(holding: HoldingInput): Warning {
  return {
    code: 'CURRENT_VALUE_ZERO',
    holdingId: holding.id,
    message:
      `"${holding.name}" has a current value of £0. ` +
      `It is included in portfolio totals and will show a -100% return.`,
  };
}

function buildSingleDayRangeWarning(holding: HoldingInput, today: string): Warning {
  return {
    code: 'SINGLE_DAY_RANGE',
    holdingId: holding.id,
    message:
      `Purchase date for "${holding.name}" is today (${today}). ` +
      `The VWRL comparison covers zero time — results are not meaningful yet.`,
  };
}

function buildStalePriceWarning(latestPriceDate: string): Warning {
  return {
    code: 'DATA_MAY_BE_STALE',
    message:
      `The most recent VWRL price available is from ${latestPriceDate}. ` +
      `Market data may be stale — Yahoo Finance may have been temporarily unavailable.`,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // POST only
  if (req.method !== 'POST') {
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST requests are supported.');
    return;
  }

  const today = toIsoDate(new Date());

  // ── Validate request body ────────────────────────────────────────────────

  const validation = validateRequest(req.body, today);
  if (!validation.valid) {
    sendError(
      res,
      validation.status,
      validation.code,
      validation.error,
      validation.details
    );
    return;
  }

  const { holdings } = req.body as CalculateRequest;

  // ── Fetch VWRL prices ────────────────────────────────────────────────────

  // Get today's VWRL price (shared across all holdings — it's the same "today")
  let vwrlToday: PricePoint;
  try {
    vwrlToday = await priceProvider.getLatestPrice(VWRL_TICKER);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[calculate] Failed to fetch latest VWRL price: ${message}`);
    sendError(
      res,
      503,
      'PRICE_SOURCE_UNAVAILABLE',
      'Market data is temporarily unavailable. Please try again in a few minutes.',
      message
    );
    return;
  }

  // Build a memoised fetcher for per-holding purchase-date prices
  const getVwrlPriceOnOrBefore = buildPriceFetcher();

  // ── Per-holding processing ────────────────────────────────────────────────

  const holdingResults: HoldingResult[] = [];
  const warnings: Warning[] = [];

  for (const holding of holdings) {
    // Fetch VWRL price on or before the purchase date
    let vwrlOnPurchaseDate: PricePoint | null;
    try {
      vwrlOnPurchaseDate = await getVwrlPriceOnOrBefore(holding.purchaseDate);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[calculate] Failed to fetch VWRL price for ${holding.purchaseDate}: ${message}`
      );
      sendError(
        res,
        503,
        'PRICE_SOURCE_UNAVAILABLE',
        'Market data is temporarily unavailable. Please try again in a few minutes.',
        message
      );
      return;
    }

    // If no price found at or before the purchase date — this shouldn't happen
    // for valid dates post-listing, but be defensive
    if (!vwrlOnPurchaseDate) {
      sendError(
        res,
        503,
        'PRICE_SOURCE_UNAVAILABLE',
        `Could not find VWRL price data for or before ${holding.purchaseDate}.`,
        `Holding: "${holding.name}" (id: ${holding.id})`
      );
      return;
    }

    // ── Warnings for this holding ──────────────────────────────────────────

    // PURCHASE_DATE_ADJUSTED: the price date we got differs from what was requested
    if (vwrlOnPurchaseDate.date !== holding.purchaseDate) {
      warnings.push(
        buildPurchaseDateAdjustedWarning(
          holding.id,
          holding.name,
          holding.purchaseDate,
          vwrlOnPurchaseDate.date
        )
      );
    }

    // NEAR_LISTING_DATE: purchase date within 30 days of VWRL listing
    if (daysBetween(holding.purchaseDate, VWRL_LISTING_DATE) <= NEAR_LISTING_THRESHOLD_DAYS) {
      warnings.push(buildNearListingDateWarning(holding));
    }

    // CURRENT_VALUE_ZERO: holding has been sold / is worth nothing
    if (holding.currentValue === 0) {
      warnings.push(buildCurrentValueZeroWarning(holding));
    }

    // SINGLE_DAY_RANGE: purchased today — no meaningful comparison window
    if (holding.purchaseDate === today) {
      warnings.push(buildSingleDayRangeWarning(holding, today));
    }

    // ── Calculate ──────────────────────────────────────────────────────────

    const result = calculateHoldingResult(holding, vwrlOnPurchaseDate, vwrlToday);
    holdingResults.push(result);
  }

  // ── Portfolio & benchmark summaries ──────────────────────────────────────

  const portfolio = calculatePortfolioSummary(holdingResults);
  const benchmark = calculateBenchmarkSummary(holdingResults, portfolio.totalInvested);
  const comparison = calculateComparison(portfolio, benchmark);

  // ── DATA_MAY_BE_STALE warning ─────────────────────────────────────────────

  // If the latest VWRL price is more than STALE_DATA_THRESHOLD_DAYS old,
  // something is probably wrong with the data source.
  // (A gap of 1-2 days is normal over weekends/public holidays.)
  const daysOld = daysBetween(today, vwrlToday.date);
  if (daysOld > STALE_DATA_THRESHOLD_DAYS) {
    warnings.push(buildStalePriceWarning(vwrlToday.date));
  }

  // ── Build response ────────────────────────────────────────────────────────

  const response: CalculateResponse = {
    holdings: holdingResults,
    portfolio,
    benchmark,
    comparison,
    calculatedAt: new Date().toISOString(),
    dataAsOf: vwrlToday.date,
    warnings,
  };

  res.status(200).json(response);
}
