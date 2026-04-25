/**
 * Extraction Result Validation
 *
 * Validates and enriches Gemini's raw extraction output with confidence scoring.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import type {
  ExtractionResult,
  ExtractionConfidence,
  ExtractedHolding,
} from '../../../shared/index';

export interface GeminiRawExtractionResult {
  totalValue: number | null;
  currency: string;
  holdings: Array<{
    name: string;
    value: number | null;
    percentage: number | null;
  }>;
}

/**
 * Validate and enrich a Gemini extraction result.
 *
 * @param raw - Raw data from Gemini
 * @returns Validated ExtractionResult with confidence scoring
 * @throws If validation fails
 */
export function validateExtractionResult(raw: unknown): ExtractionResult {
  // Type checking
  if (!raw || typeof raw !== 'object') {
    throw new Error('Extraction result is not an object');
  }

  const obj = raw as Record<string, any>;

  // Validate structure
  if (!Array.isArray(obj.holdings)) {
    throw new Error('holdings must be an array');
  }

  if (obj.currency !== 'GBP') {
    throw new Error('currency must be GBP');
  }

  // Validate each holding
  const holdings: ExtractedHolding[] = [];
  for (let i = 0; i < obj.holdings.length; i++) {
    const h = obj.holdings[i];

    if (!h || typeof h !== 'object') {
      throw new Error(`holding[${i}] is not an object`);
    }

    if (typeof h.name !== 'string' || h.name.trim() === '') {
      throw new Error(`holding[${i}].name must be a non-empty string`);
    }

    // value and percentage can be null or number
    const value = h.value === null ? null : Number(h.value);
    const percentage = h.percentage === null ? null : Number(h.percentage);

    if (value !== null && (isNaN(value) || !isFinite(value))) {
      throw new Error(`holding[${i}].value must be a valid number or null`);
    }

    if (percentage !== null && (isNaN(percentage) || !isFinite(percentage))) {
      throw new Error(`holding[${i}].percentage must be a valid number or null`);
    }

    holdings.push({
      name: h.name.trim(),
      value,
      percentage,
    });
  }

  // Validate totalValue (can be null or number)
  const totalValue = obj.totalValue === null ? null : Number(obj.totalValue);
  if (totalValue !== null && (isNaN(totalValue) || !isFinite(totalValue))) {
    throw new Error('totalValue must be a valid number or null');
  }

  // Calculate confidence
  const confidence = calculateConfidence(holdings, totalValue);

  return {
    totalValue,
    currency: 'GBP',
    holdings,
    confidence,
  };
}

/**
 * Calculate confidence scores based on the number of null fields.
 */
function calculateConfidence(
  holdings: ExtractedHolding[],
  totalValue: number | null
): ExtractionConfidence {
  if (holdings.length === 0) {
    return {
      overall: 'low',
      nullFieldCount: 0,
      totalFieldCount: 0,
      warnings: ['No holdings were extracted from the screenshot'],
    };
  }

  // Count null fields
  const fieldCounts = holdings.map(() => [
    { name: 'name', isNull: false }, // name is required, never null
    { name: 'value', isNull: true },
    { name: 'percentage', isNull: true },
  ]);

  let nullFieldCount = 0;
  for (const holding of holdings) {
    if (holding.value === null) nullFieldCount++;
    if (holding.percentage === null) nullFieldCount++;
  }

  // Add totalValue to count
  const totalValueIsNull = totalValue === null;
  if (totalValueIsNull) nullFieldCount++;

  const totalFieldCount =
    holdings.length * 2 + // value + percentage per holding
    (totalValueIsNull ? 1 : 0); // totalValue

  const nullRatio = totalFieldCount > 0 ? nullFieldCount / totalFieldCount : 0;

  const warnings: string[] = [];

  let overall: 'high' | 'medium' | 'low';
  if (nullRatio === 0) {
    overall = 'high';
  } else if (nullRatio < 0.2) {
    overall = 'medium';
    warnings.push(`${nullFieldCount} field(s) could not be extracted — please review and fill in manually`);
  } else {
    overall = 'low';
    warnings.push(`${nullFieldCount} field(s) could not be extracted — please review carefully or enter your holdings manually`);
  }

  return {
    overall,
    nullFieldCount,
    totalFieldCount,
    warnings,
  };
}
