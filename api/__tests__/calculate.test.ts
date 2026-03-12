/**
 * Integration tests for /api/calculate
 *
 * Covers:
 *  1. Pure calculator.ts functions — no I/O, fully deterministic
 *  2. Full handler with a mocked PriceProvider — no Yahoo Finance calls
 *  3. Runtime-error regression: tests that would have caught the TS4/moduleResolution
 *     bug by confirming the module actually loads and the handler executes
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PriceProvider } from '../../backend/src/providers/PriceProvider';
import type { PricePoint } from '../../shared/index';
import {
  calculateHoldingResult,
  calculatePortfolioSummary,
  calculateBenchmarkSummary,
  calculateComparison,
  getVerdict,
  round2dp,
  sum,
} from '../../backend/src/calculator';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VWRL_ON_PURCHASE: PricePoint = { date: '2022-01-03', close: 100.00 };
const VWRL_TODAY: PricePoint = { date: '2024-01-02', close: 130.00 };

const HOLDING_INPUT = {
  id: 'h1',
  name: 'Fundsmith Equity T Acc',
  amountInvested: 10_000,
  currentValue: 12_500,
  purchaseDate: '2022-01-03',
};

// ─── Pure function tests ───────────────────────────────────────────────────────

describe('round2dp', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2dp(3.14159)).toBe(3.14);
    expect(round2dp(3.145)).toBe(3.15);
    expect(round2dp(10)).toBe(10);
    expect(round2dp(-5.678)).toBe(-5.68);
    expect(round2dp(0)).toBe(0);
  });
});

describe('sum', () => {
  it('returns 0 for empty array', () => expect(sum([])).toBe(0));
  it('sums correctly', () => expect(sum([1, 2, 3])).toBe(6));
});

describe('getVerdict', () => {
  it('returns beating for outperformance > 0.1', () => {
    expect(getVerdict(0.2)).toBe('beating');
    expect(getVerdict(5)).toBe('beating');
  });
  it('returns trailing for outperformance < -0.1', () => {
    expect(getVerdict(-0.2)).toBe('trailing');
  });
  it('returns matching within ±0.1 dead zone', () => {
    expect(getVerdict(0.1)).toBe('matching');
    expect(getVerdict(-0.1)).toBe('matching');
    expect(getVerdict(0)).toBe('matching');
  });
});

describe('calculateHoldingResult', () => {
  it('computes correct returns for a beating holding', () => {
    // Portfolio: +25% (10k → 12.5k)
    // VWRL: +30% (100 → 130)
    // Outperformance: 25 - 30 = -5% (trailing)
    const result = calculateHoldingResult(HOLDING_INPUT, VWRL_ON_PURCHASE, VWRL_TODAY);

    expect(result.id).toBe('h1');
    expect(result.amountInvested).toBe(10_000);
    expect(result.currentValue).toBe(12_500);
    expect(result.totalReturn).toBe(25);           // (12500-10000)/10000 * 100
    expect(result.totalReturnAbsolute).toBe(2_500);
    expect(result.vwrlReturn).toBe(30);            // (130/100 - 1) * 100
    expect(result.vwrlReturnAbsolute).toBe(3_000); // 10000 * 0.30
    expect(result.vwrlEquivalentValue).toBe(13_000);
    expect(result.outperformance).toBe(-5);        // 25 - 30
  });

  it('handles a +0% VWRL period (no growth)', () => {
    const flat: PricePoint = { date: '2022-01-03', close: 100 };
    const result = calculateHoldingResult(HOLDING_INPUT, flat, flat);
    expect(result.vwrlReturn).toBe(0);
    expect(result.outperformance).toBe(25); // still beating a flat market
  });

  it('handles currentValue of zero (fully written off)', () => {
    const zeroed = { ...HOLDING_INPUT, currentValue: 0 };
    const result = calculateHoldingResult(zeroed, VWRL_ON_PURCHASE, VWRL_TODAY);
    expect(result.totalReturn).toBe(-100);
    expect(result.totalReturnAbsolute).toBe(-10_000);
    expect(result.outperformance).toBe(-130); // -100 - 30
  });
});

describe('calculatePortfolioSummary', () => {
  it('aggregates multiple holdings correctly', () => {
    const h1 = calculateHoldingResult(HOLDING_INPUT, VWRL_ON_PURCHASE, VWRL_TODAY);
    const h2 = calculateHoldingResult(
      { ...HOLDING_INPUT, id: 'h2', amountInvested: 5_000, currentValue: 6_000 },
      VWRL_ON_PURCHASE,
      VWRL_TODAY
    );
    const summary = calculatePortfolioSummary([h1, h2]);
    expect(summary.totalInvested).toBe(15_000);
    expect(summary.totalCurrentValue).toBe(18_500);
    expect(summary.totalReturnAbsolute).toBe(3_500);
    expect(summary.totalReturn).toBeCloseTo(23.33, 1);
  });

  it('handles single holding', () => {
    const h = calculateHoldingResult(HOLDING_INPUT, VWRL_ON_PURCHASE, VWRL_TODAY);
    const summary = calculatePortfolioSummary([h]);
    expect(summary.totalInvested).toBe(10_000);
    expect(summary.totalReturn).toBe(25);
  });
});

describe('calculateBenchmarkSummary', () => {
  it('computes benchmark returns correctly', () => {
    const h = calculateHoldingResult(HOLDING_INPUT, VWRL_ON_PURCHASE, VWRL_TODAY);
    const bench = calculateBenchmarkSummary([h], 10_000);
    expect(bench.ticker).toBe('VWRL.L');
    expect(bench.totalEquivalentValue).toBe(13_000);
    expect(bench.totalReturn).toBe(30);
    expect(bench.totalReturnAbsolute).toBe(3_000);
  });
});

describe('calculateComparison', () => {
  it('produces correct verdict and delta', () => {
    const h = calculateHoldingResult(HOLDING_INPUT, VWRL_ON_PURCHASE, VWRL_TODAY);
    const portfolio = calculatePortfolioSummary([h]);
    const benchmark = calculateBenchmarkSummary([h], portfolio.totalInvested);
    const comparison = calculateComparison(portfolio, benchmark);

    expect(comparison.outperformance).toBe(-5);          // 25 - 30
    expect(comparison.outperformanceAbsolute).toBe(-500); // 2500 - 3000
    expect(comparison.verdict).toBe('trailing');
  });
});

// ─── Handler integration tests (mocked PriceProvider) ─────────────────────────

/**
 * Build a minimal Vercel-style mock request/response pair.
 * The important thing: calling handler() must return a real HTTP response
 * shape, not throw. This catches module-load errors and unhandled exceptions.
 */
function makeMockReqRes(body: unknown, method = 'POST') {
  const req = { method, body, headers: {} };
  const res = {
    _status: 200,
    _body: null as unknown,
    _headers: {} as Record<string, string>,
    status(s: number) { this._status = s; return this; },
    json(b: unknown) { this._body = b; },
    setHeader(k: string, v: string) { this._headers[k] = v; },
  };
  return { req, res };
}

describe('calculate handler (mocked provider)', () => {
  // We mock the providers/index module so no Yahoo calls happen
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns 200 with valid request and mocked prices', async () => {
    // Mock the price provider before importing the handler
    vi.doMock('../../backend/src/providers/index', () => ({
      priceProvider: {
        getLatestPrice: vi.fn().mockResolvedValue(VWRL_TODAY),
        getPriceOnOrBefore: vi.fn().mockResolvedValue(VWRL_ON_PURCHASE),
        getHistoricalPrices: vi.fn().mockResolvedValue([VWRL_ON_PURCHASE, VWRL_TODAY]),
      } satisfies Partial<PriceProvider>,
    }));

    // Import handler AFTER mock is set up
    const { default: handler } = await import('../calculate');
    const { req, res } = makeMockReqRes({
      currency: 'GBP',
      holdings: [HOLDING_INPUT],
    });

    await handler(req as any, res as any);

    expect(res._status).toBe(200);
    const body = res._body as any;
    expect(body.holdings).toHaveLength(1);
    expect(body.holdings[0].id).toBe('h1');
    expect(body.holdings[0].totalReturn).toBe(25);
    expect(body.holdings[0].vwrlReturn).toBe(30);
    expect(body.holdings[0].outperformance).toBe(-5);
    expect(body.portfolio.totalInvested).toBe(10_000);
    expect(body.comparison.verdict).toBe('trailing');
    expect(body.calculatedAt).toBeTruthy();
    expect(body.dataAsOf).toBe('2024-01-02');
  });

  it('returns 405 for GET requests', async () => {
    vi.doMock('../../backend/src/providers/index', () => ({
      priceProvider: {
        getLatestPrice: vi.fn(),
        getPriceOnOrBefore: vi.fn(),
      } satisfies Partial<PriceProvider>,
    }));

    const { default: handler } = await import('../calculate');
    const { req, res } = makeMockReqRes(null, 'GET');
    await handler(req as any, res as any);
    expect(res._status).toBe(405);
    expect((res._body as any).code).toBe('METHOD_NOT_ALLOWED');
  });

  it('returns 400 for unsupported currency', async () => {
    vi.doMock('../../backend/src/providers/index', () => ({
      priceProvider: { getLatestPrice: vi.fn(), getPriceOnOrBefore: vi.fn() },
    }));

    const { default: handler } = await import('../calculate');
    const { req, res } = makeMockReqRes({ currency: 'USD', holdings: [HOLDING_INPUT] });
    await handler(req as any, res as any);
    expect(res._status).toBe(400);
    expect((res._body as any).code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty holdings', async () => {
    vi.doMock('../../backend/src/providers/index', () => ({
      priceProvider: { getLatestPrice: vi.fn(), getPriceOnOrBefore: vi.fn() },
    }));

    const { default: handler } = await import('../calculate');
    const { req, res } = makeMockReqRes({ currency: 'GBP', holdings: [] });
    await handler(req as any, res as any);
    expect(res._status).toBe(400);
  });

  it('returns 503 when PriceProvider throws', async () => {
    // This tests the error path that replaces the raw 500 on Vercel
    vi.doMock('../../backend/src/providers/index', () => ({
      priceProvider: {
        getLatestPrice: vi.fn().mockRejectedValue(new Error('Failed Yahoo Schema validation')),
        getPriceOnOrBefore: vi.fn(),
      } satisfies Partial<PriceProvider>,
    }));

    const { default: handler } = await import('../calculate');
    const { req, res } = makeMockReqRes({ currency: 'GBP', holdings: [HOLDING_INPUT] });
    await handler(req as any, res as any);

    // Should be a handled 503, NOT an unhandled 500
    expect(res._status).toBe(503);
    expect((res._body as any).code).toBe('PRICE_SOURCE_UNAVAILABLE');
  });

  it('emits PURCHASE_DATE_ADJUSTED warning when price date differs', async () => {
    const adjustedPrice: PricePoint = { date: '2022-01-05', close: 101 }; // weekend adjusted
    vi.doMock('../../backend/src/providers/index', () => ({
      priceProvider: {
        getLatestPrice: vi.fn().mockResolvedValue(VWRL_TODAY),
        getPriceOnOrBefore: vi.fn().mockResolvedValue(adjustedPrice),
      } satisfies Partial<PriceProvider>,
    }));

    const { default: handler } = await import('../calculate');
    const { req, res } = makeMockReqRes({ currency: 'GBP', holdings: [HOLDING_INPUT] });
    await handler(req as any, res as any);

    expect(res._status).toBe(200);
    const body = res._body as any;
    const warning = body.warnings.find((w: any) => w.code === 'PURCHASE_DATE_ADJUSTED');
    expect(warning).toBeTruthy();
    expect(warning.holdingId).toBe('h1');
  });
});
