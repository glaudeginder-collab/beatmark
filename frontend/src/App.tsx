import { useState } from 'react';
import PortfolioForm from './components/PortfolioForm';
import EmptyState from './components/EmptyState';
import ResultsPanel from './components/ResultsPanel';
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
      setError('Something went wrong. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ── Header ── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid var(--color-border)',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'baseline',
        gap: '16px',
        flexShrink: 0,
      }}>
        <h1 style={{ color: 'var(--color-brand)', letterSpacing: '-0.5px' }}>
          BeatMark
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Is your portfolio beating the market? Find out in 60 seconds.
        </p>
      </header>

      {/* ── API error banner ── */}
      {error && (
        <div style={{
          background: '#fff5f5',
          borderBottom: '1px solid #feb2b2',
          padding: '10px 32px',
          fontSize: '13px',
          color: '#9b2c2c',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── Main two-panel layout ── */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel — 40% */}
        <div style={{
          width: '40%',
          minWidth: '380px',
          borderRight: '1px solid var(--color-border)',
          overflowY: 'auto',
          background: '#fff',
          padding: '28px 28px 40px',
        }}>
          <PortfolioForm
            onCalculate={handleCalculate}
            isCalculating={isCalculating}
          />
        </div>

        {/* Right panel — 60% */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--color-bg)',
          padding: '28px 32px 40px',
        }}>
          {results ? (
            <ResultsPanel results={results} />
          ) : (
            <EmptyState isCalculating={isCalculating} />
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        background: '#fff',
        borderTop: '1px solid var(--color-border)',
        padding: '12px 32px',
        flexShrink: 0,
      }}>
        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.75rem',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          This tool is for informational purposes only and does not constitute financial advice.
          Data may be delayed or inaccurate. VWRL benchmark assumes dividend reinvestment.
          Past performance is not a reliable indicator of future results.
        </p>
      </footer>
    </div>
  );
}
