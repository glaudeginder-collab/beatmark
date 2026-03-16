/**
 * SharedResultsPage
 *
 * Renders a shared BeatMark result fetched from /api/share/{token}.
 * Accessed via the /r/{token} URL pattern.
 *
 * Full results styling deferred to Jamie — for now this shows the key
 * data (verdict, portfolio metrics, benchmark metrics, holdings) in a
 * clean, readable layout with a "Run your own comparison" CTA.
 *
 * — Rob, Backend Developer, Niko Labs Ltd
 */

import { useState, useEffect } from 'react';
import type { CalculateResponse } from '../../../shared/index';

interface Props {
  token: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; data: CalculateResponse }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

// ─── Verdict badge ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: 'beating' | 'trailing' | 'matching' }) {
  const styles: Record<string, React.CSSProperties> = {
    beating: { background: 'var(--color-beating-bg, #d1fae5)', color: 'var(--color-beating, #065f46)' },
    trailing: { background: 'var(--color-trailing-bg, #fee2e2)', color: 'var(--color-trailing, #991b1b)' },
    matching: { background: 'var(--color-matching-bg, #fef9c3)', color: 'var(--color-matching, #713f12)' },
  };
  const labels = { beating: '✓ Beating the market', trailing: '✗ Trailing the market', matching: '≈ Matching the market' };

  return (
    <span style={{
      display: 'inline-block',
      padding: '6px 16px',
      borderRadius: '999px',
      fontWeight: 700,
      fontSize: '0.9375rem',
      letterSpacing: '-0.01em',
      ...styles[verdict],
    }}>
      {labels[verdict]}
    </span>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface, #fff)',
      border: '1px solid var(--color-border, #e5e7eb)',
      borderRadius: '10px',
      padding: '16px 20px',
      minWidth: '140px',
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #6b7280)', fontWeight: 500, marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--color-text-primary, #111827)', letterSpacing: '-0.02em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary, #6b7280)', marginTop: '2px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SharedResultsPage({ token }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/share/${token}`);
        if (cancelled) return;

        if (res.status === 404) {
          setState({ status: 'not_found' });
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setState({ status: 'error', message: err.error ?? `HTTP ${res.status}` });
          return;
        }
        const data: CalculateResponse = await res.json();
        setState({ status: 'loaded', data });
      } catch (e) {
        if (!cancelled) {
          setState({ status: 'error', message: 'Network error — please try again.' });
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [token]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (state.status === 'loading') {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--color-text-secondary, #6b7280)' }}>
          Loading shared results…
        </div>
      </PageShell>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (state.status === 'not_found') {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Result not found</h2>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: '24px' }}>
            This shared result has expired or doesn't exist. Shared links are valid for 30 days.
          </p>
          <CTAButton />
        </div>
      </PageShell>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (state.status === 'error') {
    return (
      <PageShell>
        <div style={{ textAlign: 'center', padding: '64px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: '24px' }}>{state.message}</p>
          <CTAButton />
        </div>
      </PageShell>
    );
  }

  // ── Loaded ───────────────────────────────────────────────────────────────

  const { data } = state;
  const { portfolio, benchmark, comparison, holdings, calculatedAt, dataAsOf } = data;

  return (
    <PageShell>
      {/* ── Verdict ── */}
      <section style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '1.625rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          marginBottom: '12px',
          color: 'var(--color-text-primary, #111827)',
        }}>
          BeatMark Results
        </h1>
        <VerdictBadge verdict={comparison.verdict} />
        <p style={{ marginTop: '12px', color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
          Portfolio {comparison.verdict === 'beating' ? 'outperformed' : comparison.verdict === 'trailing' ? 'underperformed' : 'matched'} VWRL by{' '}
          <strong style={{ color: comparison.outperformance >= 0 ? 'var(--color-beating, #065f46)' : 'var(--color-trailing, #991b1b)' }}>
            {fmtPct(comparison.outperformance)}
          </strong>{' '}
          ({fmt(Math.abs(comparison.outperformanceAbsolute))})
        </p>
      </section>

      {/* ── Key metrics ── */}
      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary, #6b7280)', marginBottom: '12px' }}>
          Portfolio vs Benchmark
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <MetricCard
            label="Portfolio return"
            value={fmtPct(portfolio.totalReturn)}
            sub={`${fmt(portfolio.totalReturnAbsolute)} absolute`}
          />
          <MetricCard
            label="VWRL equivalent return"
            value={fmtPct(benchmark.totalReturn)}
            sub={`${fmt(benchmark.totalReturnAbsolute)} absolute`}
          />
          <MetricCard
            label="Total invested"
            value={fmt(portfolio.totalInvested)}
          />
          <MetricCard
            label="Current value"
            value={fmt(portfolio.totalCurrentValue)}
          />
        </div>
      </section>

      {/* ── Holdings table ── */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-secondary, #6b7280)', marginBottom: '12px' }}>
          Holdings ({holdings.length})
        </h2>
        <div style={{
          background: 'var(--color-surface, #fff)',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg, #f9fafb)', borderBottom: '1px solid var(--color-border, #e5e7eb)' }}>
                {['Holding', 'Invested', 'Current', 'Your return', 'VWRL return', 'vs VWRL'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary, #6b7280)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr key={h.id} style={{ borderBottom: i < holdings.length - 1 ? '1px solid var(--color-border, #e5e7eb)' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-text-primary, #111827)' }}>{h.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary, #6b7280)' }}>{fmt(h.amountInvested)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary, #6b7280)' }}>{fmt(h.currentValue)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: h.totalReturn >= 0 ? 'var(--color-beating, #065f46)' : 'var(--color-trailing, #991b1b)' }}>
                    {fmtPct(h.totalReturn)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary, #6b7280)' }}>{fmtPct(h.vwrlReturn)}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: h.outperformance >= 0 ? 'var(--color-beating, #065f46)' : 'var(--color-trailing, #991b1b)' }}>
                    {fmtPct(h.outperformance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        background: 'var(--color-surface, #fff)',
        border: '1px solid var(--color-border, #e5e7eb)',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>Is your portfolio beating the market?</div>
          <div style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem' }}>
            Enter your holdings and find out in 60 seconds.
          </div>
        </div>
        <CTAButton />
      </section>

      {/* ── Footer metadata ── */}
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #6b7280)', textAlign: 'center' }}>
        Calculated {new Date(calculatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · VWRL data as of {dataAsOf} · For informational purposes only
      </p>
    </PageShell>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function CTAButton() {
  return (
    <a
      href="/"
      style={{
        display: 'inline-block',
        padding: '10px 20px',
        background: 'var(--color-brand, #2563eb)',
        color: '#fff',
        borderRadius: '8px',
        fontWeight: 600,
        fontSize: '0.875rem',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      Run your own comparison →
    </a>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface, #fff)',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
        padding: '0 32px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--color-brand, #2563eb)',
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 13V3M4 7l4-4 4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--color-text-primary, #111827)' }}>
            BeatMark
          </span>
        </a>
        <div style={{ width: '1px', height: '20px', background: 'var(--color-border, #e5e7eb)' }} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary, #6b7280)' }}>
          Shared results
        </span>
      </header>

      {/* Content */}
      <main style={{
        flex: 1,
        maxWidth: '900px',
        width: '100%',
        margin: '0 auto',
        padding: '32px 24px',
        boxSizing: 'border-box',
      }}>
        {children}
      </main>
    </div>
  );
}
