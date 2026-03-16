/**
 * POST /api/share
 *
 * Accepts a BeatMark CalculateResponse payload, stores it in Vercel KV
 * with a 30-day TTL, and returns a short UUID token.
 *
 * The token can then be used with GET /api/share/{token} to retrieve the
 * payload for rendering a shared results view at /r/{token}.
 *
 * Storage notes:
 *   - No PII stored — only the calculation result payload
 *   - TTL is 30 days (2,592,000 seconds)
 *   - Keys are prefixed with "share:" to avoid collisions with future KV usage
 *
 * KV setup (Vercel KV / Upstash Redis):
 *   Requires KV_REST_API_URL and KV_REST_API_TOKEN environment variables.
 *   Create a free Upstash Redis database at https://upstash.com and add the
 *   REST API URL + token to your Vercel project environment variables.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import type { CalculateResponse } from '../shared/index';

// ─── Constants ───────────────────────────────────────────────────────────────

const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const KV_PREFIX = 'share:';
const MAX_PAYLOAD_BYTES = 256 * 1024; // 256 KB sanity cap

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
 * Light validation — we just check the payload looks like a CalculateResponse.
 * Deep validation is out of scope; the calculate endpoint already produced this.
 */
function isValidPayload(body: unknown): body is CalculateResponse {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.holdings) &&
    typeof b.portfolio === 'object' &&
    typeof b.benchmark === 'object' &&
    typeof b.comparison === 'object' &&
    typeof b.calculatedAt === 'string'
  );
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS — allow the frontend origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST requests are supported.');
    return;
  }

  // ── Validate payload ─────────────────────────────────────────────────────

  if (!isValidPayload(req.body)) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Request body must be a valid BeatMark calculation result (CalculateResponse).'
    );
    return;
  }

  // Sanity-check size — protects against oversized payloads filling KV
  const payloadStr = JSON.stringify(req.body);
  if (payloadStr.length > MAX_PAYLOAD_BYTES) {
    sendError(
      res,
      413,
      'PAYLOAD_TOO_LARGE',
      `Payload exceeds the ${MAX_PAYLOAD_BYTES / 1024}KB limit.`,
      `Received ${Math.round(payloadStr.length / 1024)}KB`
    );
    return;
  }

  // ── Generate token & store ────────────────────────────────────────────────

  const token = crypto.randomUUID();
  const key = `${KV_PREFIX}${token}`;

  try {
    await kv.set(key, req.body, { ex: TTL_SECONDS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share] KV set failed for token ${token}: ${message}`);
    sendError(
      res,
      503,
      'STORAGE_UNAVAILABLE',
      'Could not store the result. Please try again.',
      message
    );
    return;
  }

  // ── Respond ───────────────────────────────────────────────────────────────

  res.status(200).json({
    token,
    url: `/r/${token}`,
    expiresIn: TTL_SECONDS,
    expiresAt: new Date(Date.now() + TTL_SECONDS * 1000).toISOString(),
  });
}
