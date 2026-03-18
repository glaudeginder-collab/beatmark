/**
 * GET /api/share/{token}
 *
 * Retrieves a previously stored BeatMark result by its share token.
 * Used by the /r/{token} shared results page to fetch the payload.
 *
 * Fetches the blob at shares/{token}.json via list() + head() + fetch.
 * Returns 404 if the token doesn't exist.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { head, list } from '@vercel/blob';
import type { CalculateResponse } from '../../shared/index';

// UUID v4 pattern — prevents Blob lookups for obviously invalid tokens
const TOKEN_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS — allow the frontend to read from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only GET requests are supported.');
    return;
  }

  // ── Extract & validate token ──────────────────────────────────────────────

  const { token } = req.query;

  if (typeof token !== 'string' || !TOKEN_REGEX.test(token)) {
    sendError(res, 400, 'INVALID_TOKEN', 'Invalid or malformed share token.');
    return;
  }

  // ── Locate blob ───────────────────────────────────────────────────────────
  // List blobs with the token as prefix to resolve the full blob URL,
  // then use head() to confirm existence before fetching content.

  const pathname = `shares/${token}.json`;
  let blobUrl: string;

  try {
    const { blobs } = await list({ prefix: pathname, limit: 1 });

    if (blobs.length === 0) {
      sendError(
        res,
        404,
        'NOT_FOUND',
        'This shared result does not exist.',
        `Token: ${token}`
      );
      return;
    }

    // Confirm the blob exists and get its canonical URL
    const metadata = await head(blobs[0].url);
    blobUrl = metadata.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share/token] Blob lookup failed for token ${token}: ${message}`);
    sendError(
      res,
      503,
      'STORAGE_UNAVAILABLE',
      'Could not retrieve the result. Please try again.',
      message
    );
    return;
  }

  // ── Fetch blob content ────────────────────────────────────────────────────

  let payload: CalculateResponse;

  try {
    const blobRes = await fetch(blobUrl);
    if (!blobRes.ok) {
      throw new Error(`Blob fetch returned ${blobRes.status}`);
    }
    payload = (await blobRes.json()) as CalculateResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share/token] Blob fetch failed for token ${token}: ${message}`);
    sendError(
      res,
      503,
      'STORAGE_UNAVAILABLE',
      'Could not read the stored result. Please try again.',
      message
    );
    return;
  }

  // ── Cache headers ─────────────────────────────────────────────────────────
  // Results are immutable once stored — cache aggressively at the CDN layer
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  res.status(200).json(payload);
}
