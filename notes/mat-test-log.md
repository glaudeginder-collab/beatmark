# Mat's QA Test Log — Sprint 2

**Date:** 2026-04-11  
**Tester:** Mat (QA Engineer, Niko Labs)  
**Environment:** https://project-shtzw.vercel.app (production)  
**Repo:** https://github.com/glaudeginder-collab/beatmark  

---

## Overall Verdict

| Area | Status | Issues Filed |
|------|--------|-------------|
| Core flow | ✅ Pass | — |
| Prices endpoint | ✅ Pass | — |
| Share link | ❌ Fail | #5 |
| OG tags | ✅ Pass (⚠️ Twitter/X caveat) | #7 |
| Mobile layout | ✅ Pass | — |
| Assets | ❌ Fail (favicon 404) | #6 |
| CORS | ⚠️ Warning | #8 |

Sprint 2 is **not shippable** until #5 (share broken) and #6 (favicon 404) are resolved.

---

## 1. Core Flow

**Test:** Entered a 3-holding portfolio via the API:
- Global Equity Fund: £50,000 invested, £55,000 current, purchased 2024-01-02
- Bonds Fund: £20,000 invested, £19,000 current, purchased 2024-01-02
- Cash: £13,333 invested, £13,333 current, purchased 2024-01-02
- Total invested: £83,333

**API response:**
```json
{
  "portfolio": { "totalInvested": 83333, "totalCurrentValue": 87333, "totalReturn": 4.8 },
  "benchmark": { "totalReturn": 39.23, "totalReturnAbsolute": 32694.77 },
  "comparison": { "outperformance": -34.43, "verdict": "trailing" },
  "dataAsOf": "2026-04-10"
}
```

**Checks:**
- ✅ Totals correct (£83,333 invested)
- ✅ VWRL return 39.23% is accurate (£90.48 Jan 2024 → £125.98 Apr 2026)
- ✅ Portfolio return 4.8% is correct (£4,000 gain on £83,333)
- ✅ Verdict "trailing" is correct — portfolio significantly behind VWRL
- ✅ `calculatedAt` and `dataAsOf` populated
- ✅ No warnings emitted (expected — clean input)
- ✅ Holdings breakdown per-holding with outperformance values
- ✅ Response time: ~2s (acceptable for cold start)

**Result: ✅ Pass**

---

## 2. Prices Endpoint

**Request:** `GET /api/vwrl/prices?from=2024-01-01`

**Response:** 200 OK, `application/json`

**Checks:**
- ✅ Returns 574 price data points
- ✅ JSON well-formed, valid structure
- ✅ `ticker`, `name`, `currency`, `prices`, `dataAsOf`, `cachedAt` fields all present
- ✅ First price: `{"date":"2024-01-02","close":90.48}` (correct — 2024-01-01 was NY Day)
- ✅ Latest price: `{"date":"2026-04-10","close":125.98}` (yesterday, expected for T+0)
- ✅ Response time: ~5.6s (cold start hit — subsequent requests should be CDN-cached)
- ℹ️ No `source` field in response (correct — `source` only appears in fallback/stale paths)
- ✅ Live data is current (not hitting static fallback)

**Result: ✅ Pass**

---

## 3. Share Link

**Test:** POST /api/share with CalculateResponse payload, then GET /api/share/{token}

**POST response:**
```json
{"token":"f4c21108-db4a-4ff7-86a4-aa4a90c04238","url":"/r/f4c21108-db4a-4ff7-86a4-aa4a90c04238"}
```
Status: 200 ✅

**GET response (immediate):**
```json
{"error":"This shared result does not exist.","code":"NOT_FOUND","details":"Token: f4c21108-db4a-4ff7-86a4-aa4a90c04238"}
```
Status: 404 ❌

**GET response (after 10s — ruling out eventual consistency):**
Same 404 ❌

**Tested with 2 different tokens — both 404.**

**Frontend behaviour (code review):**
- `main.tsx` routes `/r/{token}` to `SharedResultsPage` — correct ✅
- `ResultsPanel.tsx` share handler: POST → get token → construct full URL → copy to clipboard — correct ✅
- The UI would show "copied" even though the URL is dead ❌

**Root cause (suspected):**  
Vercel Blob storage misconfiguration. `put()` in `api/share.ts` doesn't throw (returns 200), but `list()` in `api/share/[token].ts` finds zero blobs. Check `BLOB_READ_WRITE_TOKEN` in Vercel environment variables.

**Reproduction steps:**
1. Any valid POST to `/api/share` with CalculateResponse
2. Use returned token in GET `/api/share/{token}`
3. Always returns 404

**Filed:** [Issue #5](https://github.com/glaudeginder-collab/beatmark/issues/5) — CRITICAL

**Result: ❌ Fail**

---

## 4. OG Tags

**Source check:**
```html
<meta property="og:title" content="BeatMark — Is your wealth manager beating the market?" />
<meta property="og:description" content="Compare your investment portfolio against VWRL..." />
<meta property="og:image" content="https://project-shtzw.vercel.app/og-image.svg" />
<meta property="og:url" content="https://project-shtzw.vercel.app" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="BeatMark — Is your wealth manager beating the market?" />
<meta name="twitter:image" content="https://project-shtzw.vercel.app/og-image.svg" />
```

**Checks:**
- ✅ All required OG tags present
- ✅ Twitter card tags present
- ✅ `og:image` URL returns 200, valid SVG, correct dimensions (1200×630)
- ✅ `og:description` relevant and compelling copy
- ⚠️ `og:image` is SVG — LinkedIn/WhatsApp/Telegram fine; **Twitter/X will not render SVG**
  - This is acknowledged in source code: _"convert to PNG in Sprint 3"_
  - Dynamic OG tags for `/r/{token}` are also deferred to Sprint 3 (also noted in code)

**Filed:** [Issue #7](https://github.com/glaudeginder-collab/beatmark/issues/7) — Low priority, Sprint 3 item

**Result: ✅ Pass (⚠️ Twitter/X caveat, known Sprint 3 backlog item)**

---

## 5. Mobile Layout

**Method:** curl with mobile UA + CSS source inspection

**CSS breakpoint found:**
```css
@media (max-width: 767px) {
  .app-main-layout { flex-direction: column; overflow: visible; }
  .app-form-panel { width: 100%; min-width: unset; max-width: none; border-right: none; 
                    border-bottom: 1px solid var(--color-border); }
  .app-results-panel { overflow-y: visible; padding: var(--sp-5) var(--sp-4) var(--sp-8); }
  .metric-cards-row { flex-direction: column; }
  input, input[type=number] { min-height: 44px; font-size: 1rem; } /* touch-friendly */
  button { min-height: 44px; }
  .header-tagline, .header-divider { display: none; }
}
html, body, #root { max-width: 100vw; overflow-x: hidden; }
```

**Checks:**
- ✅ Layout stacks vertically on mobile (flex-direction: column)
- ✅ Form panel goes full-width
- ✅ Metric cards stack vertically
- ✅ Touch targets are 44px min-height (Apple HIG compliant)
- ✅ Font size bumped to 1rem on inputs (prevents iOS zoom)
- ✅ No horizontal overflow
- ✅ Header cleans up nicely (tagline hidden)
- ✅ Page renders on mobile UA (HTTP 200 returned)

**Result: ✅ Pass**

---

## 6. Assets & Rough Edges

### Favicon
- ❌ `GET /favicon.svg` → **404**
- `frontend/index.html` references `/favicon.svg` but `frontend/public/` only contains `og-image.svg`
- No favicon file exists in the repo's public directory
- **Filed:** [Issue #6](https://github.com/glaudeginder-collab/beatmark/issues/6)

### JavaScript bundle
- ✅ `GET /assets/index-Cj8u_zI0.js` → 200

### CSS bundle
- ✅ `GET /assets/index-pXHad5KY.css` → 200

### OG Image
- ✅ `GET /og-image.svg` → 200, valid SVG

### CORS
- ⚠️ `/api/vwrl/prices` only allows `localhost:5173` and `localhost:3000` by default
  - No `CORS_ORIGINS` env var = production requests from other origins blocked
  - Same-origin production traffic is fine; Vercel preview deployments would fail
- ⚠️ `/api/calculate` has no CORS headers at all
- ✅ `/api/share` and `/api/share/[token]` correctly use `Access-Control-Allow-Origin: *`
- **Filed:** [Issue #8](https://github.com/glaudeginder-collab/beatmark/issues/8)

### Analytics
- ✅ Plausible script present (deferred, correct domain)

### No console errors visible in HTML source ✅
### No broken internal links ✅

---

## Issues Filed

| # | Title | Severity |
|---|-------|----------|
| [#5](https://github.com/glaudeginder-collab/beatmark/issues/5) | Share link broken — POST creates token but GET returns 404 | Critical ❌ |
| [#6](https://github.com/glaudeginder-collab/beatmark/issues/6) | favicon.svg missing — returns 404 | Medium ❌ |
| [#7](https://github.com/glaudeginder-collab/beatmark/issues/7) | og:image is SVG — Twitter/X won't render | Low ⚠️ |
| [#8](https://github.com/glaudeginder-collab/beatmark/issues/8) | CORS headers only allow localhost — preview deployments will fail | Low-Medium ⚠️ |

---

## What Still Needs Testing (Not Covered)

- **PDF export** — requires a browser (html2canvas) — not testable via curl
- **Chart rendering** — Recharts requires browser DOM — not testable via curl
- **Clipboard API** — browser only — tested via code review (looks correct)
- **Form validation edge cases** — needs browser or Playwright: empty fields, negative values, dates before VWRL listing, future dates
- **Accessibility** — keyboard navigation, screen reader labels (Sprint 3 item)
- **Cross-browser** — tested Safari UA (GET returns 200), Chrome/Firefox untested directly

---

*Filed by Mat, QA Engineer — Niko Labs Ltd*  
*Sprint 2 QA Pass complete. Site is NOT ready to call done until #5 and #6 are fixed.*
