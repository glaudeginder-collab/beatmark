import { useState } from 'react';
import PortfolioForm from './components/PortfolioForm';
import EmptyState from './components/EmptyState';
import ResultsPanel from './components/ResultsPanel';
import Disclaimer from './components/Disclaimer';
import type { HoldingInput, CalculateResponse } from '../../shared/index';

export default function App() {
  const [results, setResults] = useState<CalculateResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async (formData: HoldingInput[]) => {
    setIsCalculating(true);
    setError(null);
    try {
      const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: formData, currency: 'GBP' }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'API error');
      }
      const data: CalculateResponse = await response.json();
      setResults(data);
    } catch (e) {
      setError('Something went wrong fetching VWRL data. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 var(--sp-8)',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        flexShrink: 0,
        boxShadow: 'var(--shadow-xs)',
      }}>
        {/* Logo mark */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          textDecoration: 'none',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-brand)',
            flexShrink: 0,
          }}>
            {/* Upward arrow mark */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 13V3M4 7l4-4 4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'var(--color-text-primary)',
          }}>
            BeatMark
          </span>
        </div>

        <div style={{
          width: '1px',
          height: '20px',
          background: 'var(--color-border)',
          flexShrink: 0,
        }} />

        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.8125rem',
          fontWeight: 400,
        }}>
          Is your portfolio beating the market? Find out in 60 seconds.
        </p>
      </header>

      {/* ── API error banner ── */}
      {error && (
        <div style={{
          background: 'var(--color-error-bg)',
          borderBottom: '1px solid var(--color-error-border)',
          padding: 'var(--sp-3) var(--sp-8)',
          fontSize: '0.8125rem',
          color: 'var(--color-trailing)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          fontWeight: 500,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M8 1.5L14.5 13h-13L8 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'var(--color-trailing)',
              cursor: 'pointer',
              padding: '0 var(--sp-1)',
              fontSize: '1rem',
              lineHeight: 1,
              opacity: 0.7,
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Main two-panel layout ── */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel — 40% — white, form */}
        <div style={{
          width: '40%',
          minWidth: '360px',
          maxWidth: '520px',
          borderRight: '1px solid var(--color-border)',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          padding: 'var(--sp-7) var(--sp-7) var(--sp-10)',
        }}>
          <PortfolioForm
            onCalculate={handleCalculate}
            isCalculating={isCalculating}
          />
        </div>

        {/* Right panel — 60% — grey bg, results */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--color-bg)',
          padding: 'var(--sp-7) var(--sp-8) var(--sp-10)',
        }}>
          {results ? (
            <ResultsPanel results={results} />
          ) : (
            <EmptyState isCalculating={isCalculating} />
          )}
        </div>
      </main>

      {/* ── Footer disclaimer ── */}
      <footer style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        padding: 'var(--sp-3) var(--sp-8)',
        flexShrink: 0,
      }}>
        <Disclaimer variant="footer" />
      </footer>
    </div>
  );
}
