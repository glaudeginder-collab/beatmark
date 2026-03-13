/**
 * smoke.test.ts — End-to-end smoke tests for BeatMark (live Vercel deployment)
 *
 * These tests hit the LIVE deployment at https://project-shtzw.vercel.app.
 * No mocks. No local server. Real HTTP calls, real Yahoo Finance data.
 *
 * Run with: npm run test:smoke
 *
 * Test inventory:
 *   1. GET /api/vwrl/prices → 200 with prices array (date + close fields)
 *   2. POST /api/calculate single holding → 200, correct response shape
 *   3. POST /api/calculate multiple holdings → 200, money-weighted benchmark correct
 *   4. POST /api/calculate invalid currency → 400
 *   5. POST /api/calculate amountInvested=0 → 400
 *   6. POST /api/calculate date before 2012-01-23 → 400
 *   7. POST /api/calculate date in future → 400
 *   8. Frontend → 200 HTML with "BeatMark" in title
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import { describe, it, expect } from 'vitest';

const BASE_URL = 'https://project-shtzw.vercel.app';

// Generous timeout for live API calls (Yahoo Finance can be slow)
const TIMEOUT_MS = 30_000;

// ─── Test 1: GET /api/vwrl/prices ─────────────────────────────────────────────

describe('GET /api/vwrl/prices', () => {
  it(
    'returns 200 with a prices array containing date and close fields',
    async () => {
      const res = await fetch(`${BASE_URL}/api/vwrl/prices?from=2023-01-01`);

      expect(res.status).toBe(200);

      const body = await res.json();

      // Top-level shape
      expect(body).toHaveProperty('ticker', 'VWRL.L');
      expect(body).toHaveProperty('currency', 'GBP');
      expect(body).toHaveProperty('prices');
      expect(Array.isArray(body.prices)).toBe(true);
      expect(body.prices.length).toBeGreaterThan(0);

      // Each price point has date and close
      const first = body.prices[0];
      expect(typeof first.date).toBe('string');
      expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof first.close).toBe('number');
      expect(first.close).toBeGreaterThan(0);

      // Dates should be >= from parameter
      for (const point of body.prices) {
        expect(point.date >= '2023-01-01').toBe(true);
      }
    },
    TIMEOUT_MS
  );
});

// ─── Test 2: POST /api/calculate — single valid holding ──────────────────────

describe('POST /api/calculate (single holding)', () => {
  it(
    'returns 200 with verdict, portfolio, and benchmark for a single holding',
    async () => {
      const payload = {
        currency: 'GBP',
        holdings: [
          {
            id: 'smoke-h1',
            name: 'Fundsmith Equity T Acc',
            amountInvested: 10_000,
            currentValue: 13_500,
            purchaseDate: '2020-01-15',
          },
        ],
      };

      const res = await fetch(`${BASE_URL}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);

      const body = await res.json();

      // Top-level keys
      expect(body).toHaveProperty('holdings');
      expect(body).toHaveProperty('portfolio');
      expect(body).toHaveProperty('benchmark');
      expect(body).toHaveProperty('comparison');
      expect(body).toHaveProperty('calculatedAt');
      expect(body).toHaveProperty('dataAsOf');
      expect(body).toHaveProperty('warnings');

      // Holdings
      expect(Array.isArray(body.holdings)).toBe(true);
      expect(body.holdings).toHaveLength(1);
      const h = body.holdings[0];
      expect(h.id).toBe('smoke-h1');
      expect(typeof h.totalReturn).toBe('number');
      expect(typeof h.vwrlReturn).toBe('number');
      expect(typeof h.outperformance).toBe('number');
      expect(typeof h.vwrlEquivalentValue).toBe('number');
      expect(h.vwrlEquivalentValue).toBeGreaterThan(0);

      // Portfolio
      expect(body.portfolio.totalInvested).toBe(10_000);
      expect(body.portfolio.totalCurrentValue).toBe(13_500);
      expect(body.portfolio.totalReturn).toBeCloseTo(35, 0); // 35% gain

      // Benchmark
      expect(body.benchmark.ticker).toBe('VWRL.L');
      expect(typeof body.benchmark.totalReturn).toBe('number');
      expect(typeof body.benchmark.totalEquivalentValue).toBe('number');
      expect(body.benchmark.totalEquivalentValue).toBeGreaterThan(0);

      // Verdict — must be one of the three valid values
      expect(['beating', 'trailing', 'matching']).toContain(body.comparison.verdict);
      expect(typeof body.comparison.outperformance).toBe('number');
    },
    TIMEOUT_MS
  );
});

// ─── Test 3: POST /api/calculate — multiple holdings, money-weighted benchmark ─

describe('POST /api/calculate (multiple holdings)', () => {
  it(
    'returns 200 and computes money-weighted benchmark (sum of per-holding VWRL equivalents)',
    async () => {
      const payload = {
        currency: 'GBP',
        holdings: [
          {
            id: 'smoke-h2a',
            name: 'Global Growth Fund',
            amountInvested: 5_000,
            currentValue: 6_200,
            purchaseDate: '2019-06-01',
          },
          {
            id: 'smoke-h2b',
            name: 'UK Equity Fund',
            amountInvested: 8_000,
            currentValue: 9_100,
            purchaseDate: '2021-03-15',
          },
        ],
      };

      const res = await fetch(`${BASE_URL}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(200);

      const body = await res.json();

      expect(body.holdings).toHaveLength(2);

      // Money-weighted benchmark: totalEquivalentValue = sum of per-holding vwrlEquivalentValue
      const sumOfHoldingVwrlEquivalents: number = body.holdings.reduce(
        (acc: number, h: { vwrlEquivalentValue: number }) => acc + h.vwrlEquivalentValue,
        0
      );
      expect(body.benchmark.totalEquivalentValue).toBeCloseTo(sumOfHoldingVwrlEquivalents, 1);

      // Portfolio totals add up correctly
      expect(body.portfolio.totalInvested).toBeCloseTo(13_000, 1);
      expect(body.portfolio.totalCurrentValue).toBeCloseTo(15_300, 1);

      // Each holding used its own purchase date (not a single shared date)
      expect(body.holdings[0].purchaseDate).toBe('2019-06-01');
      expect(body.holdings[1].purchaseDate).toBe('2021-03-15');

      // Verdict present and valid
      expect(['beating', 'trailing', 'matching']).toContain(body.comparison.verdict);
    },
    TIMEOUT_MS
  );
});

// ─── Test 4: POST /api/calculate — invalid currency → 400 ────────────────────

describe('POST /api/calculate (invalid currency)', () => {
  it('returns 400 when currency is not GBP', async () => {
    const res = await fetch(`${BASE_URL}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'USD',
        holdings: [
          {
            id: 'smoke-h3',
            name: 'Some Fund',
            amountInvested: 1_000,
            currentValue: 1_200,
            purchaseDate: '2020-01-15',
          },
        ],
      }),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body.error).toMatch(/GBP/i);
  });
});

// ─── Test 5: POST /api/calculate — amountInvested=0 → 400 ────────────────────

describe('POST /api/calculate (amountInvested=0)', () => {
  it('returns 400 when amountInvested is 0', async () => {
    const res = await fetch(`${BASE_URL}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'GBP',
        holdings: [
          {
            id: 'smoke-h4',
            name: 'Zero Investment Fund',
            amountInvested: 0,
            currentValue: 0,
            purchaseDate: '2020-01-15',
          },
        ],
      }),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(body.error).toMatch(/amountInvested/i);
  });
});

// ─── Test 6: POST /api/calculate — date before 2012-01-23 → 400 ──────────────

describe('POST /api/calculate (date before VWRL listing)', () => {
  it('returns 400 for a purchaseDate before 2012-01-23', async () => {
    const res = await fetch(`${BASE_URL}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'GBP',
        holdings: [
          {
            id: 'smoke-h5',
            name: 'Pre-VWRL Fund',
            amountInvested: 5_000,
            currentValue: 6_000,
            purchaseDate: '2011-06-15',
          },
        ],
      }),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('code', 'DATE_TOO_EARLY');
    expect(body.error).toMatch(/2012-01-23/);
  });
});

// ─── Test 7: POST /api/calculate — date in future → 400 ──────────────────────

describe('POST /api/calculate (date in future)', () => {
  it('returns 400 for a purchaseDate in the future', async () => {
    const res = await fetch(`${BASE_URL}/api/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'GBP',
        holdings: [
          {
            id: 'smoke-h6',
            name: 'Future Fund',
            amountInvested: 5_000,
            currentValue: 6_000,
            purchaseDate: '2030-01-01',
          },
        ],
      }),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('code', 'DATE_IN_FUTURE');
    expect(body.error).toMatch(/future/i);
  });
});

// ─── Test 8: Frontend loads ───────────────────────────────────────────────────

describe('Frontend', () => {
  it('returns 200 HTML with "BeatMark" in the title', async () => {
    const res = await fetch(`${BASE_URL}/`);

    expect(res.status).toBe(200);

    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toMatch(/text\/html/i);

    const html = await res.text();
    expect(html).toMatch(/<title[^>]*>.*BeatMark.*<\/title>/i);
  });
});
