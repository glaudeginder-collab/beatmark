# Rob's Findings — Sprint 3, Task 27

## Overview
Successfully implemented `POST /api/extract/holdings` endpoint for automatic holdings extraction from wealth manager screenshots via Google Gemini Flash 2.0.

## Implementation Summary

### Files Created
1. **`api/extract/holdings.ts`** — Main endpoint handler
   - Accepts multipart/form-data or JSON (base64) payloads
   - Validates file type (PNG, JPG, WEBP only) and size (4MB max)
   - Calls Gemini service and validates/enriches response
   - Returns structured JSON with confidence scoring
   - Graceful error handling with `fallbackToManual` flag for all failure modes

2. **`backend/src/services/geminiService.ts`** — Gemini API integration
   - Calls Gemini Flash 2.0 model via REST API
   - Handles base64 image encoding
   - Temperature=0 for deterministic extraction
   - Strips markdown code fences from Gemini response (common issue)
   - Proper error logging and rate-limit detection

3. **`backend/src/validation/extractionSchema.ts`** — Validation & confidence scoring
   - Validates Gemini response structure (required fields, types)
   - Calculates confidence scores: 'high' (0 nulls), 'medium' (<20% nulls), 'low' (≥20% nulls)
   - Generates warnings for users about missing fields
   - Type-safe validation with clear error messages

4. **`backend/src/utils/multipart.ts`** — Multipart form parser
   - Parses multipart/form-data request bodies
   - Extracts image file and MIME type from 'image' field
   - Handles boundary parsing manually (no external dependency)

5. **`api/__tests__/extract.test.ts`** — Test suite (8 tests, all passing)
   - Tests successful extraction with full data
   - Tests confidence scoring for partial data
   - Tests file type and size validation
   - Tests Gemini API error handling and rate limiting
   - Tests extraction result validation
   - Tests invalid request handling

6. **`shared/index.ts`** — Type definitions
   - Added `ExtractionResult`, `ExtractedHolding`, `ExtractionConfidence`
   - Added `ExtractionErrorResponse` with all error codes

### Frontend Components (Already Implemented by Jamie)
- `frontend/src/components/ScreenshotUpload.tsx` — File upload UI
- `frontend/src/components/ReviewHoldingsScreen.tsx` — Results review interface

## API Contract

### Request
```bash
POST /api/extract/holdings
Content-Type: application/json

{
  "imageBase64": "<base64-encoded-image>",
  "mimeType": "image/png|image/jpeg|image/webp"
}
```

OR multipart:
```bash
POST /api/extract/holdings
Content-Type: multipart/form-data; boundary=...

--boundary
Content-Disposition: form-data; name="image"; filename="portfolio.png"
Content-Type: image/png

[binary image data]
--boundary--
```

### Success Response (200)
```json
{
  "totalValue": 50000,
  "currency": "GBP",
  "holdings": [
    { "name": "VWRL", "value": 25000, "percentage": 50 },
    { "name": "VGVD", "value": 15000, "percentage": 30 },
    { "name": "Cash", "value": 10000, "percentage": 20 }
  ],
  "confidence": {
    "overall": "high",
    "nullFieldCount": 0,
    "totalFieldCount": 10,
    "warnings": []
  }
}
```

### Error Response (4xx/5xx)
```json
{
  "error": "File too large. Maximum size is 4MB.",
  "code": "FILE_TOO_LARGE",
  "fallbackToManual": true,
  "partialResult": null
}
```

## Key Design Decisions

1. **No Image Storage** — Image never written to disk or stored. Only in-memory processing. Privacy-first design.

2. **Temperature=0 for Extraction** — Ensures deterministic, consistent results. No creative/generative behavior.

3. **Null-Safe Extraction Prompt** — Gemini instructed to return `null` for missing fields rather than guessing. Better to have incomplete data than hallucinated values.

4. **Confidence Scoring** — Not just "success/failure" but granular feedback:
   - High: All data extracted
   - Medium: <20% fields missing, user still gets useful pre-fill
   - Low: ≥20% missing, user should review carefully

5. **Fallback to Manual** — Every error path includes `fallbackToManual: true`. Extraction is a shortcut, never a requirement.

6. **No external dependencies for multipart** — Implemented custom parser rather than adding dependency. Minimal, focused, auditable code.

## Testing Notes

All 8 tests pass:
- ✅ Method validation (reject non-POST)
- ✅ File type validation (reject unsupported types)
- ✅ Successful extraction with full data
- ✅ Confidence scoring for partial data (medium confidence)
- ✅ Gemini API error handling (502 response)
- ✅ Rate limiting (429 response)
- ✅ Extraction result validation (reject malformed responses)
- ✅ Invalid request handling (400 response)

Test patterns follow existing repo conventions (vitest, mocking external services).

## Environment Setup Required

Before deployment to Vercel:
1. Set `GEMINI_API_KEY` in Vercel environment variables (all three environments: Production, Preview, Development)
2. Nico has provided the key: `AIzaSyCohRnqUVpX2vmheYOaDzDTFJ6k8tRQNeQ`

## What's Left for Jamie (Frontend)

The ScreenshotUpload and ReviewHoldingsScreen components are already implemented. Integration steps:

1. Wire `/api/extract/holdings` call from ScreenshotUpload component
2. Parse `ExtractionResult` response and pre-fill HoldingsEntry form
3. Display confidence banner at top of holdings table
4. Show null fields as editable cells with yellow highlight
5. Maintain fallback to manual entry if extraction fails

The endpoint is fully functional and ready for integration.

## Potential Future Improvements (Not in Scope)

- [ ] Batch upload support (multiple screenshots)
- [ ] PDF support (current: PNG/JPG/WEBP only)
- [ ] Compression of client-side images before upload (if 4MB limit becomes a problem)
- [ ] Caching of extraction results (currently disabled for privacy)
- [ ] Historical data tracking (didn't include purchase_date in extraction — users still enter manually)

## Blockers / Issues Encountered

None. Clean implementation from spec.

One minor note: Existing ScreenshotUpload and ReviewHoldingsScreen components were already in the repo but not hooked up to the endpoint. This suggests the feature was partially started. The endpoint is now complete and ready for Jamie to wire up.

---

**Status: Ready for integration testing** ✅

The backend is done. Jamie can now integrate the extraction results with the frontend form state and test the full flow with real images.
