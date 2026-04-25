import { useState, useCallback } from 'react';
import type { ExtractionResult } from '../../../shared/index';
import type { HoldingInput } from '../../../shared/index';

interface ReviewHoldingsScreenProps {
  extraction: ExtractionResult;
  onConfirm: (holdings: HoldingInput[]) => Promise<void>;
  onStartOver: () => void;
  isCalculating?: boolean;
}

interface EditableHolding {
  id: string;
  name: string;
  value: number | null;
  percentage: number | null;
  hasError: boolean;
}

const TODAY = new Date().toISOString().split('T')[0];
const MAX_HOLDINGS = 15;

export default function ReviewHoldingsScreen({
  extraction,
  onConfirm,
  onStartOver,
  isCalculating = false,
}: ReviewHoldingsScreenProps) {
  // Convert extracted holdings to editable format
  const [holdings, setHoldings] = useState<EditableHolding[]>(
    extraction.holdings.map((h, idx) => ({
      id: crypto.randomUUID(),
      name: h.name,
      value: h.value,
      percentage: h.percentage,
      hasError: false,
    }))
  );

  // ─── Validation & Actions ───────────────────────────────────────────────────

  function validateHolding(h: EditableHolding): boolean {
    return h.name.trim().length > 0 && (h.value !== null || h.percentage !== null);
  }

  function updateHolding(id: string, updates: Partial<EditableHolding>) {
    setHoldings((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const updated = { ...h, ...updates };
        return { ...updated, hasError: !validateHolding(updated) };
      })
    );
  }

  function addHolding() {
    if (holdings.length >= MAX_HOLDINGS) return;
    setHoldings((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        value: null,
        percentage: null,
        hasError: true,
      },
    ]);
  }

  function removeHolding(id: string) {
    if (holdings.length <= 1) return;
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  async function handleConfirm() {
    // Validate all holdings
    const valid = holdings.every(validateHolding);
    if (!valid) {
      setHoldings((prev) =>
        prev.map((h) => ({ ...h, hasError: !validateHolding(h) }))
      );
      return;
    }

    // Convert to HoldingInput format (for API)
    const holdingInputs: HoldingInput[] = holdings.map((h) => ({
      id: h.id,
      name: h.name,
      amountInvested: h.value || 0,
      currentValue: h.value || 0,
      purchaseDate: TODAY,
    }));

    await onConfirm(holdingInputs);
  }

  // ─── Confidence banner ───────────────────────────────────────────────────────

  const conf = extraction.confidence;
  const confLevel = conf.overall;
  const confColor =
    confLevel === 'high'
      ? 'var(--color-success)'
      : confLevel === 'medium'
        ? 'var(--color-warning)'
        : 'var(--color-trailing)';

  const confIcon =
    confLevel === 'high'
      ? '🟢'
      : confLevel === 'medium'
        ? '🟡'
        : '🔴';

  const confMessage =
    confLevel === 'high'
      ? `We extracted ${holdings.length} holding${holdings.length !== 1 ? 's' : ''}. Please review before running your comparison.`
      : confLevel === 'medium'
        ? `We extracted ${holdings.length} holding${holdings.length !== 1 ? 's' : ''}, but some values are missing. Please fill in the highlighted fields.`
        : `We had trouble reading your screenshot. Many fields are missing. Please review carefully.`;

  const hasNullFields = conf.nullFieldCount > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          padding: '0 var(--sp-8)',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          flexShrink: 0,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <button
          type="button"
          onClick={onStartOver}
          disabled={isCalculating}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontSize: '1.2rem',
            cursor: isCalculating ? 'not-allowed' : 'pointer',
            padding: 'var(--sp-2)',
            lineHeight: 1,
            opacity: isCalculating ? 0.5 : 1,
          }}
          title="Go back and upload a different screenshot"
          aria-label="Start over with a new screenshot"
        >
          ←
        </button>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
          Review your holdings
        </h2>
      </header>

      {/* ─── Main content ───────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        padding: 'var(--sp-8)',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
      }}>
        {/* ─── Confidence banner ────────────────────────────────────────────── */}
        <div
          style={{
            background: confLevel === 'high'
              ? 'var(--color-success-bg)'
              : confLevel === 'medium'
                ? 'var(--color-warning-bg)'
                : 'var(--color-error-bg)',
            border: `1.5px solid ${
              confLevel === 'high'
                ? 'var(--color-success-border)'
                : confLevel === 'medium'
                  ? 'var(--color-warning-border)'
                  : 'var(--color-error-border)'
            }`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--sp-3) var(--sp-4)',
            marginBottom: 'var(--sp-5)',
            display: 'flex',
            gap: 'var(--sp-2)',
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: '1.1rem', flexShrink: 0, lineHeight: 1 }}>
            {confIcon}
          </span>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: '0.8125rem',
                color:
                  confLevel === 'high'
                    ? 'var(--color-success-text)'
                    : confLevel === 'medium'
                      ? 'var(--color-warning-text)'
                      : 'var(--color-trailing)',
                margin: 0,
                fontWeight: 500,
              }}
            >
              {confMessage}
            </p>
            {conf.warnings.length > 0 && (
              <ul
                style={{
                  fontSize: '0.75rem',
                  margin: 'var(--sp-2) 0 0 0',
                  paddingLeft: 'var(--sp-3)',
                  color:
                    confLevel === 'high'
                      ? 'var(--color-success-text)'
                      : confLevel === 'medium'
                        ? 'var(--color-warning-text)'
                        : 'var(--color-trailing)',
                }}
              >
                {conf.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ─── Holdings table ────────────────────────────────────────────────── */}
        <div
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1.5px solid var(--color-border)',
            overflow: 'hidden',
            marginBottom: 'var(--sp-5)',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 150px 150px 40px',
              gap: 'var(--sp-3)',
              padding: 'var(--sp-4)',
              background: 'var(--color-bg)',
              borderBottom: '1.5px solid var(--color-border)',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-secondary)',
            }}
          >
            <div>Fund name</div>
            <div>Value (£)</div>
            <div>Type</div>
            <div />
          </div>

          {/* Table rows */}
          {holdings.map((holding, idx) => (
            <div
              key={holding.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 150px 150px 40px',
                gap: 'var(--sp-3)',
                padding: 'var(--sp-4)',
                borderBottom:
                  idx < holdings.length - 1 ? '1px solid var(--color-border)' : 'none',
                alignItems: 'center',
              }}
            >
              {/* Fund name */}
              <input
                type="text"
                value={holding.name}
                onChange={(e) => updateHolding(holding.id, { name: e.target.value })}
                placeholder="Enter fund name"
                disabled={isCalculating}
                className={holding.hasError && !holding.name ? 'error' : ''}
                style={{
                  background: holding.hasError && !holding.name
                    ? 'var(--color-warning-bg)'
                    : 'transparent',
                  border: holding.hasError && !holding.name
                    ? '1.5px solid var(--color-warning-border)'
                    : '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--sp-2) var(--sp-3)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              />

              {/* Value (£) */}
              <input
                type="number"
                value={holding.value || ''}
                onChange={(e) =>
                  updateHolding(holding.id, {
                    value: parseFloat(e.target.value) || null,
                  })
                }
                placeholder="0"
                disabled={isCalculating}
                className={holding.hasError && holding.value === null ? 'error' : ''}
                style={{
                  background: holding.hasError && holding.value === null
                    ? 'var(--color-warning-bg)'
                    : 'transparent',
                  border: holding.hasError && holding.value === null
                    ? '1.5px solid var(--color-warning-border)'
                    : '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--sp-2) var(--sp-3)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              />

              {/* Type */}
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 500,
                }}
              >
                {holding.value !== null ? '£ amount' : holding.percentage !== null ? '%' : '—'}
              </div>

              {/* Delete button */}
              {holdings.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeHolding(holding.id)}
                  disabled={isCalculating}
                  aria-label={`Remove holding: ${holding.name || 'empty'}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    fontSize: '1.1rem',
                    cursor: isCalculating ? 'not-allowed' : 'pointer',
                    padding: '0',
                    lineHeight: 1,
                    opacity: isCalculating ? 0.5 : 1,
                    transition: 'color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCalculating) {
                      (e.currentTarget as HTMLButtonElement).style.color =
                        'var(--color-trailing)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color =
                      'var(--color-text-muted)';
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ─── Add row button ────────────────────────────────────────────────── */}
        {holdings.length < MAX_HOLDINGS && (
          <button
            type="button"
            onClick={addHolding}
            disabled={isCalculating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              background: 'transparent',
              border: '1.5px dashed var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--color-brand)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              padding: 'var(--sp-3) var(--sp-4)',
              width: '100%',
              justifyContent: 'center',
              cursor: isCalculating ? 'not-allowed' : 'pointer',
              marginBottom: 'var(--sp-5)',
              opacity: isCalculating ? 0.5 : 1,
              transition: 'border-color var(--transition-fast), background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!isCalculating) {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  'var(--color-brand)';
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-brand-surface)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--color-border)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Add a holding
          </button>
        )}

        {/* ─── CTA buttons ────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            onClick={onStartOver}
            disabled={isCalculating}
            style={{
              flex: 1,
              minWidth: '150px',
              padding: 'var(--sp-3) var(--sp-5)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              cursor: isCalculating ? 'not-allowed' : 'pointer',
              opacity: isCalculating ? 0.5 : 1,
              transition: 'border-color var(--transition-fast), background var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!isCalculating) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-bg)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'var(--color-surface)';
            }}
          >
            Start over
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCalculating || holdings.some((h) => h.hasError)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: 'var(--sp-3) var(--sp-5)',
              fontSize: '0.9375rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-lg)',
              background:
                isCalculating || holdings.some((h) => h.hasError)
                  ? 'var(--color-disabled)'
                  : 'var(--color-brand)',
              color:
                isCalculating || holdings.some((h) => h.hasError)
                  ? 'var(--color-disabled-text)'
                  : '#fff',
              cursor:
                isCalculating || holdings.some((h) => h.hasError)
                  ? 'not-allowed'
                  : 'pointer',
              border: 'none',
              boxShadow:
                isCalculating || holdings.some((h) => h.hasError)
                  ? 'none'
                  : '0 2px 8px rgba(29, 78, 216, 0.3)',
              transition: 'background var(--transition-fast), box-shadow var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--sp-2)',
            }}
            onMouseEnter={(e) => {
              if (
                !isCalculating &&
                !holdings.some((h) => h.hasError)
              ) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-brand-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (
                !isCalculating &&
                !holdings.some((h) => h.hasError)
              ) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--color-brand)';
              }
            }}
          >
            {isCalculating ? (
              <>
                <Spinner /> Calculating…
              </>
            ) : (
              '✓ Looks good — run comparison'
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}
        aria-hidden="true"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    </>
  );
}
