/**
 * GET /api/share/{token}
 *
 * Retrieves a previously stored BeatMark result by its share token.
 * Constructs the Vercel Blob URL directly from the store token — avoids
 * list() which is eventually consistent and caused 404s on fresh blobs.
 *
 * Fix: 2026-04-11 — replaced list()+head() with direct URL construction
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
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

/**
 * Derive the public Vercel Blob store base URL from BLOB_READ_WRITE_TOKEN.
 * Token format: vercel_blob_rw_<STORE_ID>_<SECRET>
 * Store URL:    https://<STORE_ID>.public.blob.vercel-storage.com
 */
function getBlobStoreBaseUrl(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const match = token.match(/vercel_blob_rw_([A-Za-z0-9]+)/);
  if (!match) throw new Error('Could not parse store ID from BLOB_READ_WRITE_TOKEN');
  return `https://${match[1]}.public.blob.vercel-storage.com`;
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

  // ── Fetch blob directly ───────────────────────────────────────────────────
  // Construct the URL from the store ID — no list() call, no eventual consistency issues.

  let blobUrl: string;
  try {
    const storeBase = getBlobStoreBaseUrl();
    blobUrl = `${storeBase}/shares/${token}.json`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share/token] Could not construct blob URL: ${message}`);
    sendError(res, 503, 'STORAGE_UNAVAILABLE', 'Storage not configured correctly.', message);
    return;
  }

  let payload: CalculateResponse;
  try {
    const blobRes = await fetch(blobUrl);

    if (blobRes.status === 404) {
      sendError(res, 404, 'NOT_FOUND', 'This shared result does not exist or has expired.');
      return;
    }

    if (!blobRes.ok) {
      throw new Error(`Blob fetch returned ${blobRes.status}`);
    }

    payload = (await blobRes.json()) as CalculateResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share/token] Blob fetch failed for token ${token}: ${message}`);
    sendError(res, 503, 'STORAGE_UNAVAILABLE', 'Could not read the stored result. Please try again.', message);
    return;
  }

  // ── Cache headers ─────────────────────────────────────────────────────────
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json(payload);
}
