/**
 * POST /api/share
 *
 * Accepts a BeatMark CalculateResponse payload, stores it in Vercel Blob
 * as shares/{token}.json, and returns the UUID token.
 *
 * The token is used with GET /api/share/{token} to retrieve the payload
 * for rendering a shared results view at /r/{token}.
 *
 * Storage notes:
 *   - No PII stored — only the calculation result payload
 *   - No TTL (Vercel Blob does not support TTL). Stored indefinitely for MVP.
 *     A cleanup job can be added later if needed.
 *   - Blobs are stored at path shares/{token}.json with public access
 *
 * Vercel Blob setup:
 *   Requires the BLOB_READ_WRITE_TOKEN environment variable, which Vercel
 *   injects automatically when a Blob store is linked to the project.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import type { CalculateResponse } from '../shared/index';

// ─── Constants ───────────────────────────────────────────────────────────────

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

  // Sanity-check size — protects against oversized payloads filling Blob storage
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
  const pathname = `shares/${token}.json`;

  try {
    await put(pathname, payloadStr, {
      access: 'public',
      contentType: 'application/json',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[share] Blob put failed for token ${token}: ${message}`);
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
  });
}
