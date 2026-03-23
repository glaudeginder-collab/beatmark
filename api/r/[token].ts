/**
 * GET /api/r/{token}  (routed from /r/{token} via vercel.json rewrite)
 *
 * Dynamic Open Graph meta injection for shared BeatMark result pages.
 *
 * Problem: BeatMark is a Vite SPA. Crawlers (WhatsApp, LinkedIn, Twitter/X,
 * Telegram, Slack, Discord) hit /r/{token} and see the static index.html with
 * generic OG tags — because client-side JS doesn't run in their headless fetchers.
 *
 * Solution: This serverless function intercepts /r/{token} requests:
 *   1. Fetches the share payload from /api/share/{token} (Vercel Blob)
 *   2. Builds a dynamic og:title + og:description from the result verdict
 *   3. Fetches the built index.html from the origin (to get Vite's hashed asset refs)
 *   4. Injects the dynamic OG tags by replacing the static placeholders
 *   5. Returns the modified HTML — both crawlers AND real users receive it
 *
 * Real users: browser receives this HTML, the Vite SPA mounts normally
 * (main.tsx sees /r/{token} in the URL, renders SharedResultsPage → fetches
 * /api/share/{token} → displays results). No redirect needed.
 *
 * Crawlers: they stop at the HTML head, read the OG tags, done.
 *
 * — Jamie, Frontend Dev, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CalculateResponse } from '../../shared/index';

// ─── Token validation (same regex as api/share/[token].ts) ───────────────────

const TOKEN_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.abs(n).toFixed(1)}%`;
}

/** Build the dynamic og:title from share data. e.g.
 *  "My portfolio is +4.2% ahead of VWRL — BeatMark"
 *  "My portfolio is -1.8% behind VWRL — BeatMark"
 *  "My portfolio matches VWRL — BeatMark"
 */
function buildTitle(comparison: CalculateResponse['comparison']): string {
  const { verdict, outperformance } = comparison;
  if (verdict === 'matching') {
    return 'My portfolio matches VWRL — BeatMark';
  }
  const direction = verdict === 'beating' ? 'ahead of' : 'behind';
  return `My portfolio is ${fmtPct(outperformance)} ${direction} VWRL — BeatMark`;
}

/** Build the dynamic og:description from share data. */
function buildDescription(
  comparison: CalculateResponse['comparison'],
  portfolio: CalculateResponse['portfolio']
): string {
  const { verdict, outperformance } = comparison;
  const emoji = verdict === 'beating' ? '✅' : verdict === 'trailing' ? '❌' : '↔️';
  const action =
    verdict === 'beating'
      ? `outperforming VWRL by ${fmtPct(outperformance)}`
      : verdict === 'trailing'
      ? `underperforming VWRL by ${fmtPct(Math.abs(outperformance))}`
      : 'matching VWRL';
  return `${emoji} This portfolio is ${action}. Check if your wealth manager is beating the market — free, takes 60 seconds.`;
}

// ─── HTML tag injection helpers ───────────────────────────────────────────────

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Replace OG / Twitter meta content in the index.html string.
 * Also updates the <title> and og:url tags.
 */
function injectOgTags(
  html: string,
  opts: {
    title: string;
    description: string;
    url: string;
  }
): string {
  const { title, description, url } = opts;
  const t = escapeAttr(title);
  const d = escapeAttr(description);
  const u = escapeAttr(url);

  return html
    // <title>
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    // og:title
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${t}" />`
    )
    // og:description
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:description" content="${d}" />`
    )
    // og:url
    .replace(
      /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${u}" />`
    )
    // twitter:title
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:title" content="${t}" />`
    )
    // twitter:description
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:description" content="${d}" />`
    );
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { token } = req.query;

  // Validate token format before any fetch
  if (typeof token !== 'string' || !TOKEN_REGEX.test(token)) {
    res.status(400).send('Invalid share token.');
    return;
  }

  // Resolve origin URL — VERCEL_URL is set by Vercel on each deployment
  // VERCEL_PROJECT_PRODUCTION_URL is the stable production URL (no branch preview suffix)
  const origin =
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://project-shtzw.vercel.app';

  // ── Step 1: Fetch share data ──────────────────────────────────────────────
  // Default OG values — used as fallback if share fetch fails (e.g. expired token)
  let ogTitle = 'BeatMark — Is your wealth manager beating the market?';
  let ogDescription =
    'Compare your investment portfolio against VWRL. Find out if your wealth manager is actually worth their fees.';

  try {
    const shareRes = await fetch(`${origin}/api/share/${token}`, {
      headers: { Accept: 'application/json' },
      // Short timeout — if the blob store is slow, fall back to static tags
      signal: AbortSignal.timeout(4000),
    });

    if (shareRes.ok) {
      const data = (await shareRes.json()) as CalculateResponse;
      ogTitle = buildTitle(data.comparison);
      ogDescription = buildDescription(data.comparison, data.portfolio);
    }
    // If 404 or other error: fall through to static defaults — still serve the page
  } catch {
    // Network / timeout — use static defaults
  }

  // ── Step 2: Fetch the built index.html ────────────────────────────────────
  // We fetch / from the origin to get the Vite-built HTML with correct hashed
  // asset filenames (/assets/index-abc123.js etc). We then inject our dynamic
  // OG tags into it before returning.
  let baseHtml: string;

  try {
    const htmlRes = await fetch(`${origin}/`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!htmlRes.ok) {
      throw new Error(`index.html fetch returned ${htmlRes.status}`);
    }

    baseHtml = await htmlRes.text();
  } catch (err) {
    // If we can't fetch the base HTML, something is very wrong — 503 is appropriate
    console.error('[og/r] Failed to fetch base index.html:', err);
    res.status(503).send('Service temporarily unavailable.');
    return;
  }

  // ── Step 3: Inject dynamic OG tags ───────────────────────────────────────

  const finalHtml = injectOgTags(baseHtml, {
    title: ogTitle,
    description: ogDescription,
    url: `${origin}/r/${token}`,
  });

  // ── Step 4: Return ────────────────────────────────────────────────────────
  // Cache at the CDN for 1 hour (share results are immutable once stored)
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400'
  );
  res.status(200).send(finalHtml);
}
