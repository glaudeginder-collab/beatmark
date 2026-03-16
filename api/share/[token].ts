/**
 * GET /api/share/{token}
 *
 * Retrieves a previously stored BeatMark result by its share token.
 * Used by the /r/{token} shared results page to fetch the payload.
 *
 * Returns 404 if the token doesn't exist (expired or never existed).
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { CalculateResponse } from '../../shared/index';

// ─── Constants ───────────────────────────────────────────────────────────────

const KV_PREFIX = 'share:';

// UUID v4 pattern — prevents KV lookups for obviously invalid tokens
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

  // ── Fetch from KV ─────────────────────────────────────────────────────────

  const key = `${KV_PREFIX}${token}`;
  let payload: CalculateResponse | null;

  try {
    payload = await kv.get<CalculateResponse>(key);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share/token] KV get failed for token ${token}: ${message}`);
    sendError(
      res,
      503,
      'STORAGE_UNAVAILABLE',
      'Could not retrieve the result. Please try again.',
      message
    );
    return;
  }

  if (!payload) {
    sendError(
      res,
      404,
      'NOT_FOUND',
      'This shared result does not exist or has expired.',
      `Token: ${token}`
    );
    return;
  }

  // ── Cache headers ─────────────────────────────────────────────────────────
  // Results are immutable once stored — cache aggressively at the CDN layer
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  res.status(200).json(payload);
}
