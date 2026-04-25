/**
 * Gemini API Integration
 *
 * Calls Google's Gemini Flash 2.0 model with an image + extraction prompt
 * to extract structured holdings data from wealth manager screenshots.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const EXTRACTION_PROMPT = `You are extracting investment holdings data from a wealth manager portfolio screenshot.

The screenshot may display holdings in any format: a table, a list of cards, a summary view, or a combination.

Extract ALL holdings visible in the screenshot. For each holding, extract:
- name: the fund, stock, or asset name as shown
- value: the current market value in GBP (as a number, no currency symbols or commas)
- percentage: the percentage of the total portfolio this holding represents (as a number, no % symbol)

Also extract:
- totalValue: the total portfolio value in GBP (as a number)
- currency: always "GBP" for this product

Return ONLY valid JSON. No explanation. No markdown. No code fences. Just the raw JSON object.

Use exactly this format:
{
  "totalValue": number | null,
  "currency": "GBP",
  "holdings": [
    {
      "name": string,
      "value": number | null,
      "percentage": number | null
    }
  ]
}

Rules:
- If a field cannot be determined from the screenshot, use null — never guess or invent values.
- If a value appears as a range (e.g. "£10,000 - £12,000"), use the midpoint.
- If percentages are shown as allocation targets (not current) and current percentages are not visible, use null for percentage.
- Include ALL holdings visible, even if some fields are null.
- Do not include holdings that are clearly zero-value or closed accounts unless they show a non-zero current value.
- Numbers must be plain numbers. 1250.50, not "£1,250.50" or "1,250.50".`;

export interface GeminiExtractionRawResult {
  totalValue: number | null;
  currency: string;
  holdings: Array<{
    name: string;
    value: number | null;
    percentage: number | null;
  }>;
}

/**
 * Call Gemini Flash 2.0 with an image buffer and extract holdings.
 *
 * @param imageBuffer - Raw image bytes
 * @param mimeType - Image MIME type (e.g. "image/png")
 * @returns Parsed extraction result or throws on error
 */
export async function callGeminiExtract(
  imageBuffer: Buffer,
  mimeType: string
): Promise<GeminiExtractionRawResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured in environment');
  }

  const base64Image = imageBuffer.toString('base64');

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
          {
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topP: 1,
      topK: 1,
      maxOutputTokens: 2048,
    },
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const statusCode = response.status;

    // Handle rate limiting
    if (statusCode === 429) {
      throw new Error('RATE_LIMITED');
    }

    throw new Error(`Gemini API returned ${statusCode}: ${errorText}`);
  }

  const data = await response.json() as any;

  // Extract the text content from Gemini's response envelope
  const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('No text in Gemini response');
  }

  // Strip markdown code fences if present (Gemini sometimes wraps JSON in ```json ```)
  const cleaned = textContent
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '');

  // Parse the JSON from Gemini's text output
  return JSON.parse(cleaned) as GeminiExtractionRawResult;
}
