/**
 * POST /api/extract/holdings
 *
 * Screenshot-to-holdings extraction via Google Gemini Flash 2.0.
 *
 * Accepts a PNG/JPG/WEBP image file (multipart or JSON base64),
 * calls Gemini with an extraction prompt, and returns structured holdings data.
 *
 * The image is never stored — it lives only in memory during the request.
 *
 * Request (multipart/form-data):
 *   POST /api/extract/holdings
 *   Content-Type: multipart/form-data; boundary=...
 *   [image file as 'image' field]
 *
 * Request (JSON, for testing):
 *   POST /api/extract/holdings
 *   Content-Type: application/json
 *   { "imageBase64": "<base64>", "mimeType": "image/png" }
 *
 * Response (success, 200):
 *   {
 *     "totalValue": 50000 | null,
 *     "currency": "GBP",
 *     "holdings": [
 *       { "name": "VWRL", "value": 25000, "percentage": 50 },
 *       { "name": "VGVD", "value": null, "percentage": 50 }
 *     ],
 *     "confidence": {
 *       "overall": "medium",
 *       "nullFieldCount": 1,
 *       "totalFieldCount": 5,
 *       "warnings": ["1 field(s) could not be extracted — please review and fill in manually"]
 *     }
 *   }
 *
 * Response (error, 4xx/5xx):
 *   {
 *     "error": "File too large. Maximum size is 4MB.",
 *     "code": "FILE_TOO_LARGE",
 *     "fallbackToManual": true
 *   }
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseMultipartBody } from '../../backend/src/utils/multipart';
import { callGeminiExtract } from '../../backend/src/services/geminiService';
import { validateExtractionResult } from '../../backend/src/validation/extractionSchema';
import type { ExtractionResult, ExtractionErrorResponse } from '../../shared/index';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

// ─── Main Handler ────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      fallbackToManual: true,
    });
  }

  let imageBuffer: Buffer;
  let mimeType: string;

  // ─── Parse request body ───────────────────────────────────────────────────

  try {
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
      // Parse multipart form
      const parsed = await parseMultipartBody(req);
      imageBuffer = parsed.imageBuffer;
      mimeType = parsed.mimeType;
    } else if (contentType.includes('application/json')) {
      // JSON body (for testing)
      const body = req.body as any;
      if (!body.imageBase64 || !body.mimeType) {
        return res.status(400).json({
          error: 'Invalid request body. Expected imageBase64 and mimeType.',
          code: 'INVALID_REQUEST',
          fallbackToManual: true,
        });
      }
      imageBuffer = Buffer.from(body.imageBase64, 'base64');
      mimeType = body.mimeType;
    } else {
      return res.status(400).json({
        error: 'Content-Type must be multipart/form-data or application/json',
        code: 'INVALID_REQUEST',
        fallbackToManual: true,
      });
    }
  } catch (err) {
    console.error('Request parse error:', err);
    return res.status(400).json({
      error: 'Failed to parse request body',
      code: 'INVALID_REQUEST',
      fallbackToManual: true,
    });
  }

  // ─── Validate MIME type ───────────────────────────────────────────────────

  if (!ACCEPTED_MIME_TYPES.includes(mimeType as any)) {
    return res.status(400).json({
      error: `Unsupported file type: ${mimeType}. Accepted: PNG, JPG, WEBP.`,
      code: 'UNSUPPORTED_FILE_TYPE',
      fallbackToManual: true,
    });
  }

  // ─── Validate file size ────────────────────────────────────────────────────

  if (imageBuffer.length > MAX_FILE_SIZE_BYTES) {
    return res.status(413).json({
      error: 'File too large. Maximum size is 4MB.',
      code: 'FILE_TOO_LARGE',
      fallbackToManual: true,
    });
  }

  // ─── Call Gemini ──────────────────────────────────────────────────────────

  let rawResult: unknown;
  try {
    rawResult = await callGeminiExtract(imageBuffer, mimeType);
  } catch (err) {
    const errorMessage = String(err);
    console.error('Gemini API error:', err);

    // Handle rate limiting specially
    if (errorMessage.includes('RATE_LIMITED')) {
      return res.status(429).json({
        error: 'Service temporarily unavailable. Please try again in a moment.',
        code: 'RATE_LIMITED',
        fallbackToManual: true,
      });
    }

    // Other Gemini errors
    if (errorMessage.includes('GEMINI_API_KEY')) {
      console.error('CRITICAL: GEMINI_API_KEY not configured');
      return res.status(502).json({
        error: 'Screenshot extraction service is not configured. Please enter your holdings manually.',
        code: 'GEMINI_API_ERROR',
        fallbackToManual: true,
      });
    }

    return res.status(502).json({
      error: 'Screenshot extraction failed. Please enter your holdings manually.',
      code: 'GEMINI_API_ERROR',
      fallbackToManual: true,
    });
  }

  // ─── Parse and validate result ─────────────────────────────────────────────

  let extractionResult: ExtractionResult;
  try {
    extractionResult = validateExtractionResult(rawResult);
  } catch (err) {
    console.error('Extraction validation error:', err, 'rawResult:', rawResult);
    return res.status(422).json({
      error: 'Could not parse holdings from screenshot. Please enter your holdings manually.',
      code: 'EXTRACTION_PARSE_ERROR',
      fallbackToManual: true,
      partialResult: rawResult,
    });
  }

  // ─── Success ───────────────────────────────────────────────────────────────

  return res.status(200).json(extractionResult);
}
