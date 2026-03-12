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
  else if (h.currentValue === 0 && h.amountInvested > 0) {
    // Allow £0 current value (total loss scenario) but warn via empty-ish treatment
  }

  if (!h.purchaseDate) {
    errors.purchaseDate = 'Date purchased is required';
  } else if (h.purchaseDate > TODAY) {
    errors.purchaseDate = 'Date must not be in the future';
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

// ─── Sub-components ──────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{ fontSize: '11px', color: '#e53e3e', marginTop: '3px' }}>
          {error}
        </p>
      )}
    </div>
  );
}

interface GbpInputProps {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

function GbpInput({ value, onChange, placeholder, disabled, hasError }: GbpInputProps) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span style={{
        position: 'absolute',
        left: '10px',
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
        fontWeight: 500,
        fontSize: '14px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>£</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value === 0 ? '' : formatGbp(value)}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder={placeholder ?? '0.00'}
        disabled={disabled}
        className={hasError ? 'error' : ''}
        style={{ paddingLeft: '24px' }}
      />
    </div>
  );
}

// ─── HoldingCard ─────────────────────────────────────────────────────────────

interface HoldingCardProps {
  holding: HoldingInput;
  index: number;
  errors: HoldingErrors;
  showRemove: boolean;
  disabled: boolean;
  onChange: (id: string, updates: Partial<HoldingInput>) => void;
  onRemove: (id: string) => void;
}

function HoldingCard({
  holding, index, errors, showRemove, disabled, onChange, onRemove,
}: HoldingCardProps) {
  return (
    <div style={{
      background: '#f7fafc',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      marginBottom: '12px',
      position: 'relative',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <span style={{
          fontSize: '12px',
          fontWeight: 700,
          color: 'var(--color-brand)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Holding #{index + 1}
        </span>
        {showRemove && (
          <button
            type="button"
            onClick={() => onRemove(holding.id)}
            disabled={disabled}
            title="Remove holding"
            style={{
              background: 'none',
              border: '1px solid #fed7d7',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e53e3e',
              fontSize: '16px',
              lineHeight: 1,
              padding: 0,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
            aria-label={`Remove holding ${index + 1}`}
          >
            ×
          </button>
        )}
      </div>

      {/* Asset name */}
      <Field label="Asset name" hint='e.g. "Fundsmith Equity T Acc"' error={errors.name}>
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
      <Field label="Amount invested" hint="Total cost paid in GBP" error={errors.amountInvested}>
        <GbpInput
          value={holding.amountInvested}
          onChange={(v) => onChange(holding.id, { amountInvested: v })}
          placeholder="Total cost paid"
          disabled={disabled}
          hasError={!!errors.amountInvested}
        />
      </Field>

      {/* Current value */}
      <Field label="Current value" hint="Current market value in GBP" error={errors.currentValue}>
        <GbpInput
          value={holding.currentValue}
          onChange={(v) => onChange(holding.id, { currentValue: v })}
          placeholder="Current market value"
          disabled={disabled}
          hasError={!!errors.currentValue}
        />
      </Field>

      {/* Date purchased */}
      <Field label="Date purchased" hint="When you first bought this holding" error={errors.purchaseDate}>
        <input
          type="date"
          value={holding.purchaseDate}
          onChange={(e) => onChange(holding.id, { purchaseDate: e.target.value })}
          min="2012-01-23"
          max={TODAY}
          disabled={disabled}
          className={errors.purchaseDate ? 'error' : ''}
        />
      </Field>
    </div>
  );
}

// ─── PortfolioForm ────────────────────────────────────────────────────────────

interface PortfolioFormProps {
  onCalculate: (holdings: HoldingInput[]) => Promise<void>;
  isCalculating: boolean;
}

export default function PortfolioForm({ onCalculate, isCalculating }: PortfolioFormProps) {
  const [holdings, setHoldings] = useState<HoldingInput[]>([emptyHolding()]);
  const [submitted, setSubmitted] = useState(false);

  // Compute errors for each holding (only show after first submit attempt)
  const allErrors: HoldingErrors[] = holdings.map(validateHolding);
  const hasAnyError = allErrors.some(hasErrors);
  const isFormValid = !hasAnyError;

  const updateHolding = useCallback((id: string, updates: Partial<HoldingInput>) => {
    setHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...updates } : h))
    );
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

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Section heading */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '4px' }}>Your Portfolio</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
          Enter each holding below. All values in GBP (£).
        </p>
      </div>

      {/* Holdings */}
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
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-brand)',
            fontSize: '13px',
            fontWeight: 500,
            padding: '10px 16px',
            width: '100%',
            justifyContent: 'center',
            cursor: isCalculating ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
            opacity: isCalculating ? 0.6 : 1,
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
          Add another holding
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
            ({holdings.length}/{MAX_HOLDINGS})
          </span>
        </button>
      )}

      {holdings.length >= MAX_HOLDINGS && (
        <p style={{
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          marginBottom: '16px',
        }}>
          Maximum {MAX_HOLDINGS} holdings reached.
        </p>
      )}

      {/* Validation summary (only after submit) */}
      {showErrors && hasAnyError && (
        <div style={{
          background: '#fff5f5',
          border: '1px solid #feb2b2',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          marginBottom: '14px',
          fontSize: '13px',
          color: '#9b2c2c',
        }}>
          Please fix the errors above before calculating.
        </div>
      )}

      {/* Calculate CTA */}
      <button
        type="submit"
        disabled={isCalculating || (submitted && !isFormValid)}
        style={{
          width: '100%',
          padding: '13px',
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '0.02em',
          borderRadius: 'var(--radius-md)',
          background: isCalculating
            ? 'var(--color-brand)'
            : submitted && !isFormValid
              ? 'var(--color-disabled)'
              : 'var(--color-brand)',
          color: submitted && !isFormValid ? 'var(--color-disabled-text)' : '#fff',
          cursor: isCalculating || (submitted && !isFormValid) ? 'not-allowed' : 'pointer',
          opacity: isCalculating ? 0.85 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: isCalculating || (submitted && !isFormValid)
            ? 'none'
            : '0 2px 8px rgba(43, 108, 176, 0.35)',
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

// ─── Tiny spinner ─────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: 'spin 0.75s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
