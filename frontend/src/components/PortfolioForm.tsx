import { useState, useCallback } from 'react';
import type { HoldingInput } from '../../../shared/index';

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_HOLDINGS = 15;
const TODAY = new Date().toISOString().split('T')[0];

function emptyHolding(): HoldingInput {
  return {
    id: crypto.randomUUID(),
    name: '',
    amountInvested: 0,
    currentValue: 0,
    purchaseDate: '',
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────
interface HoldingErrors {
  name?: string;
  amountInvested?: string;
  currentValue?: string;
  purchaseDate?: string;
}

function validateHolding(h: HoldingInput): HoldingErrors {
  const errors: HoldingErrors = {};
  if (!h.name.trim()) errors.name = 'Asset name is required';
  else if (h.name.trim().length > 100) errors.name = 'Max 100 characters';

  if (!h.amountInvested || h.amountInvested <= 0)
    errors.amountInvested = 'Amount invested must be greater than £0';

  if (h.currentValue < 0)
    errors.currentValue = 'Current value cannot be negative';

  const VWRL_LISTING_DATE = '2012-01-23';
  if (!h.purchaseDate) {
    errors.purchaseDate = 'Date purchased is required';
  } else if (h.purchaseDate > TODAY) {
    errors.purchaseDate = 'Date cannot be in the future';
  } else if (h.purchaseDate < VWRL_LISTING_DATE) {
    errors.purchaseDate = `Must be on or after ${VWRL_LISTING_DATE} (VWRL listing date)`;
  }

  return errors;
}

function hasErrors(e: HoldingErrors) {
  return Object.keys(e).length > 0;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatGbp(value: number): string {
  if (!value && value !== 0) return '';
  return value.toString();
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
interface FieldProps {
  label:    string;
  hint?:    string;
  error?:   string;
  children: React.ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <label style={{
        display:       'block',
        fontSize:      '0.6875rem',
        fontWeight:    700,
        color:         'var(--color-text-secondary)',
        marginBottom:  'var(--sp-1)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p style={{
          fontSize:    '0.6875rem',
          color:       'var(--color-text-muted)',
          marginTop:   'var(--sp-1)',
          lineHeight:  1.4,
        }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{
          fontSize:    '0.6875rem',
          color:       'var(--color-error)',
          marginTop:   'var(--sp-1)',
          fontWeight:  500,
          lineHeight:  1.4,
          display:     'flex',
          alignItems:  'center',
          gap:         '4px',
        }}>
          <span aria-hidden="true">●</span>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── £ prefixed number input ──────────────────────────────────────────────────
interface GbpInputProps {
  value:       number;
  onChange:    (v: number) => void;
  placeholder?: string;
  disabled?:   boolean;
  hasError?:   boolean;
}

function GbpInput({ value, onChange, placeholder, disabled, hasError }: GbpInputProps) {
  return (
    <div style={{
      position: 'relative',
      display:  'flex',
    }}>
      {/* £ prefix badge */}
      <div style={{
        position:        'absolute',
        left:            0,
        top:             0,
        bottom:          0,
        width:           '36px',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        color:           disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        fontWeight:      600,
        fontSize:        '0.875rem',
        pointerEvents:   'none',
        userSelect:      'none',
        borderRight:     `1px solid ${hasError ? 'var(--color-error-border)' : 'var(--color-border)'}`,
        background:      disabled ? 'transparent' : 'var(--color-bg)',
        borderRadius:    'var(--radius-md) 0 0 var(--radius-md)',
        transition:      'border-color var(--transition-fast)',
      }}>
        £
      </div>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value === 0 ? '' : formatGbp(value)}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder={placeholder ?? '0.00'}
        disabled={disabled}
        className={hasError ? 'error' : ''}
        style={{
          paddingLeft:  '44px',
          borderRadius: 'var(--radius-md)',
        }}
      />
    </div>
  );
}

// ─── HoldingCard ─────────────────────────────────────────────────────────────
interface HoldingCardProps {
  holding:   HoldingInput;
  index:     number;
  errors:    HoldingErrors;
  showRemove: boolean;
  disabled:  boolean;
  onChange:  (id: string, updates: Partial<HoldingInput>) => void;
  onRemove:  (id: string) => void;
}

function HoldingCard({
  holding, index, errors, showRemove, disabled, onChange, onRemove,
}: HoldingCardProps) {
  return (
    <div style={{
      background:    'var(--color-bg)',
      border:        '1.5px solid var(--color-border)',
      borderRadius:  'var(--radius-lg)',
      padding:       'var(--sp-4)',
      marginBottom:  'var(--sp-3)',
      transition:    `border-color var(--transition-fast)`,
    }}>
      {/* Card header */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   'var(--sp-3)',
      }}>
        <span style={{
          fontSize:      '0.6875rem',
          fontWeight:    700,
          color:         'var(--color-brand)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          Holding {index + 1}
        </span>
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(holding.id)}
            disabled={disabled}
            title={`Remove holding ${index + 1}`}
            aria-label={`Remove holding ${index + 1}`}
            style={{
              background:  'var(--color-surface)',
              border:      '1.5px solid var(--color-border)',
              borderRadius: '50%',
              width:        '24px',
              height:       '24px',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              color:        'var(--color-text-muted)',
              fontSize:     '1.1rem',
              lineHeight:   1,
              padding:      0,
              cursor:       disabled ? 'not-allowed' : 'pointer',
              opacity:      disabled ? 0.5 : 1,
              transition:   `color var(--transition-fast), border-color var(--transition-fast)`,
              flexShrink:   0,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-trailing)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-trailing-border)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Asset name */}
      <Field
        label="Asset name"
        hint='e.g. "Fundsmith Equity T Acc" or "Apple (AAPL)"'
        error={errors.name}
      >
        <input
          type="text"
          value={holding.name}
          onChange={(e) => onChange(holding.id, { name: e.target.value })}
          placeholder="e.g. Fundsmith Equity T Acc"
          maxLength={100}
          disabled={disabled}
          className={errors.name ? 'error' : ''}
        />
      </Field>

      {/* Amount invested */}
      <Field
        label="Amount invested"
        hint="Total cost paid, including any fees (GBP)"
        error={errors.amountInvested}
      >
        <GbpInput
          value={holding.amountInvested}
          onChange={(v) => onChange(holding.id, { amountInvested: v })}
          placeholder="e.g. 10000"
          disabled={disabled}
          hasError={!!errors.amountInvested}
        />
      </Field>

      {/* Current value */}
      <Field
        label="Current value"
        hint="Today's market value of this holding (GBP)"
        error={errors.currentValue}
      >
        <GbpInput
          value={holding.currentValue}
          onChange={(v) => onChange(holding.id, { currentValue: v })}
          placeholder="e.g. 12500"
          disabled={disabled}
          hasError={!!errors.currentValue}
        />
      </Field>

      {/* Date purchased */}
      <Field
        label="Date purchased"
        hint="When you first bought this holding (on or after Jan 2012)"
        error={errors.purchaseDate}
      >
        <input
          type="date"
          value={holding.purchaseDate}
          onChange={(e) => onChange(holding.id, { purchaseDate: e.target.value })}
          max={TODAY}
          min="2012-01-23"
          disabled={disabled}
          className={errors.purchaseDate ? 'error' : ''}
        />
      </Field>
    </div>
  );
}

// ─── PortfolioForm ────────────────────────────────────────────────────────────
interface PortfolioFormProps {
  onCalculate:    (holdings: HoldingInput[]) => Promise<void>;
  isCalculating:  boolean;
}

export default function PortfolioForm({ onCalculate, isCalculating }: PortfolioFormProps) {
  const [holdings, setHoldings]   = useState<HoldingInput[]>([emptyHolding()]);
  const [submitted, setSubmitted] = useState(false);

  const allErrors: HoldingErrors[] = holdings.map(validateHolding);
  const hasAnyError = allErrors.some(hasErrors);
  const isFormValid = !hasAnyError;

  const updateHolding = useCallback((id: string, updates: Partial<HoldingInput>) => {
    setHoldings((prev) => prev.map((h) => (h.id === id ? { ...h, ...updates } : h)));
  }, []);

  const addHolding = useCallback(() => {
    if (holdings.length >= MAX_HOLDINGS) return;
    setHoldings((prev) => [...prev, emptyHolding()]);
  }, [holdings.length]);

  const removeHolding = useCallback((id: string) => {
    setHoldings((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((h) => h.id !== id);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!isFormValid) return;
    await onCalculate(holdings);
  };

  const showErrors = submitted;
  const ctaDisabled = isCalculating || (submitted && !isFormValid);

  return (
    <form onSubmit={handleSubmit} noValidate>

      {/* Section heading */}
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 style={{ marginBottom: 'var(--sp-1)' }}>Your Portfolio</h2>
        <p style={{
          color:    'var(--color-text-secondary)',
          fontSize: '0.8125rem',
          lineHeight: 1.5,
        }}>
          Enter each holding below. All values in <strong style={{ fontWeight: 600 }}>GBP (£)</strong>.
        </p>
      </div>

      {/* Holdings list */}
      {holdings.map((holding, idx) => (
        <HoldingCard
          key={holding.id}
          holding={holding}
          index={idx}
          errors={showErrors ? allErrors[idx] : {}}
          showRemove={holdings.length > 1}
          disabled={isCalculating}
          onChange={updateHolding}
          onRemove={removeHolding}
        />
      ))}

      {/* Add holding button */}
      {holdings.length < MAX_HOLDINGS && (
        <button
          type="button"
          onClick={addHolding}
          disabled={isCalculating}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            'var(--sp-2)',
            background:     'transparent',
            border:         '1.5px dashed var(--color-border)',
            borderRadius:   'var(--radius-lg)',
            color:          'var(--color-brand)',
            fontSize:       '0.8125rem',
            fontWeight:     500,
            padding:        'var(--sp-3) var(--sp-4)',
            width:          '100%',
            justifyContent: 'center',
            cursor:         isCalculating ? 'not-allowed' : 'pointer',
            marginBottom:   'var(--sp-4)',
            opacity:        isCalculating ? 0.5 : 1,
            transition:     `border-color var(--transition-fast), background var(--transition-fast)`,
          }}
          onMouseEnter={(e) => {
            if (!isCalculating) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-surface)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add another holding
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginLeft: 'var(--sp-1)' }}>
            ({holdings.length}/{MAX_HOLDINGS})
          </span>
        </button>
      )}

      {holdings.length >= MAX_HOLDINGS && (
        <p style={{
          fontSize:     '0.75rem',
          color:        'var(--color-text-muted)',
          textAlign:    'center',
          marginBottom: 'var(--sp-4)',
        }}>
          Maximum {MAX_HOLDINGS} holdings reached.
        </p>
      )}

      {/* Validation summary (only after first submit) */}
      {showErrors && hasAnyError && (
        <div style={{
          background:   'var(--color-error-bg)',
          border:       '1.5px solid var(--color-error-border)',
          borderRadius: 'var(--radius-md)',
          padding:      'var(--sp-3) var(--sp-4)',
          marginBottom: 'var(--sp-3)',
          fontSize:     '0.8125rem',
          color:        'var(--color-trailing)',
          fontWeight:   500,
          display:      'flex',
          alignItems:   'center',
          gap:          'var(--sp-2)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M8 1.5L14.5 13h-13L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Please fix the errors above before calculating.
        </div>
      )}

      {/* Calculate CTA */}
      <button
        type="submit"
        disabled={ctaDisabled}
        style={{
          width:           '100%',
          padding:         'var(--sp-3) var(--sp-5)',
          fontSize:        '0.9375rem',
          fontWeight:      700,
          letterSpacing:   '0.01em',
          borderRadius:    'var(--radius-lg)',
          background:      ctaDisabled
            ? 'var(--color-disabled)'
            : 'var(--color-brand)',
          color:           ctaDisabled ? 'var(--color-disabled-text)' : '#fff',
          cursor:          ctaDisabled ? 'not-allowed' : 'pointer',
          opacity:         isCalculating ? 0.9 : 1,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             'var(--sp-2)',
          boxShadow:       ctaDisabled ? 'none' : '0 2px 8px rgba(29, 78, 216, 0.3)',
          transition:      `background var(--transition-fast), box-shadow var(--transition-fast)`,
          lineHeight:      1,
          height:          '48px',
        }}
        onMouseEnter={(e) => {
          if (!ctaDisabled)
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-hover)';
        }}
        onMouseLeave={(e) => {
          if (!ctaDisabled)
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand)';
        }}
      >
        {isCalculating ? (
          <>
            <Spinner /> Calculating…
          </>
        ) : (
          'Calculate'
        )}
      </button>
    </form>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
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
