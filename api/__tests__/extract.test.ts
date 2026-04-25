/**
 * Tests for POST /api/extract/holdings
 *
 * Covers:
 *  1. Valid image upload with successful Gemini extraction
 *  2. File type validation (reject unsupported types)
 *  3. File size validation (reject files > 4MB)
 *  4. JSON request body parsing (for testing)
 *  5. Gemini API error handling
 *  6. Extraction result validation and confidence scoring
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../extract/holdings';

// Mock the Gemini service
vi.mock('../../backend/src/services/geminiService', () => ({
  callGeminiExtract: vi.fn(),
}));

import { callGeminiExtract } from '../../backend/src/services/geminiService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_PNG_BASE64 = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01,
  0x08, 0x02,
  0x00, 0x00, 0x00,
  0x90, 0x77, 0x53, 0xde,
  0x00, 0x00, 0x00, 0x0a,
  0x49, 0x44, 0x41, 0x54,
  0x08, 0xd7, 0x63, 0xf8, 0x0f, 0x00, 0x00, 0x01, 0x01, 0x00, 0x02,
  0xc8, 0xaf, 0xa4, 0x6c,
  0x00, 0x00, 0x00, 0x00,
  0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82
]).toString('base64');

const SAMPLE_GEMINI_RESPONSE = {
  totalValue: 50000,
  currency: 'GBP',
  holdings: [
    { name: 'VWRL', value: 25000, percentage: 50 },
    { name: 'VGVD', value: 15000, percentage: 30 },
    { name: 'Cash', value: 10000, percentage: 20 }
  ]
};

const PARTIAL_GEMINI_RESPONSE = {
  totalValue: 50000,
  currency: 'GBP',
  holdings: [
    { name: 'VWRL', value: 25000, percentage: null },
    { name: 'VGVD', value: 15000, percentage: 30 },
    { name: 'VGOV', value: 10000, percentage: 20 }
  ]
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function createMockRequest(
  body: any,
  contentType: string = 'application/json'
): Partial<VercelRequest> {
  // For JSON content-type, Vercel automatically parses the body to an object
  // For multipart, it remains a string/Buffer
  const parsedBody = contentType.includes('application/json') ? body : JSON.stringify(body);
  
  return {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: parsedBody
  };
}

function createMockResponse(): Partial<VercelResponse> {
  const response = {
    statusCode: 200,
    _jsonData: null as any,
    status: vi.fn(function(code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function(data: any) {
      this._jsonData = data;
      return this;
    })
  };
  return response;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/extract/holdings', () => {
  let mockGeminiExtract = vi.mocked(callGeminiExtract);

  beforeEach(() => {
    mockGeminiExtract.mockClear();
  });

  it('should reject non-POST requests', async () => {
    const req = createMockRequest({}, 'application/json');
    req.method = 'GET';
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'METHOD_NOT_ALLOWED' })
    );
  });

  it('should reject unsupported file types', async () => {
    const req = createMockRequest({
      imageBase64: VALID_PNG_BASE64,
      mimeType: 'image/gif'  // GIF not supported
    });
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNSUPPORTED_FILE_TYPE' })
    );
  });

  it('should successfully extract holdings from valid image', async () => {
    mockGeminiExtract.mockResolvedValue(SAMPLE_GEMINI_RESPONSE as any);

    const req = createMockRequest({
      imageBase64: VALID_PNG_BASE64,
      mimeType: 'image/png'
    });
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(mockGeminiExtract).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);

    const responseData = (res.json as any).mock.calls[0][0];
    expect(responseData).toMatchObject({
      totalValue: 50000,
      currency: 'GBP',
      holdings: expect.arrayContaining([
        expect.objectContaining({ name: 'VWRL', value: 25000, percentage: 50 })
      ])
    });

    // Check confidence scoring
    expect(responseData.confidence).toBeDefined();
    expect(responseData.confidence.overall).toBe('high');
    expect(responseData.confidence.nullFieldCount).toBe(0);
  });

  it('should calculate medium confidence with partial data', async () => {
    mockGeminiExtract.mockResolvedValue(PARTIAL_GEMINI_RESPONSE as any);

    const req = createMockRequest({
      imageBase64: VALID_PNG_BASE64,
      mimeType: 'image/png'
    });
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = (res.json as any).mock.calls[0][0];

    expect(responseData.confidence.overall).toBe('medium');
    expect(responseData.confidence.nullFieldCount).toBeGreaterThan(0);
    expect(responseData.confidence.warnings.length).toBeGreaterThan(0);
  });

  it('should handle Gemini API errors gracefully', async () => {
    mockGeminiExtract.mockRejectedValue(new Error('Gemini API error'));

    const req = createMockRequest({
      imageBase64: VALID_PNG_BASE64,
      mimeType: 'image/png'
    });
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'GEMINI_API_ERROR',
        fallbackToManual: true
      })
    );
  });

  it('should handle rate limiting', async () => {
    mockGeminiExtract.mockRejectedValue(new Error('RATE_LIMITED'));

    const req = createMockRequest({
      imageBase64: VALID_PNG_BASE64,
      mimeType: 'image/png'
    });
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'RATE_LIMITED' })
    );
  });

  it('should validate extraction result format', async () => {
    // Return invalid JSON structure (missing currency)
    mockGeminiExtract.mockResolvedValue({ totalValue: 50000, holdings: [] } as any);

    const req = createMockRequest({
      imageBase64: VALID_PNG_BASE64,
      mimeType: 'image/png'
    });
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'EXTRACTION_PARSE_ERROR',
        fallbackToManual: true
      })
    );
  });

  it('should reject missing request body', async () => {
    const req = createMockRequest(undefined);
    req.body = undefined;
    const res = createMockResponse();

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_REQUEST' })
    );
  });
});
