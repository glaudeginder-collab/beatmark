import { useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { CalculateResponse } from '../../../shared/index';
import Disclaimer from './Disclaimer';

// ─── Plausible helper ─────────────────────────────────────────────────────────
function plausible(event: string, opts?: Record<string, unknown>) {
  (window as unknown as { plausible?: (e: string, o?: unknown) => void })
    .plausible?.(event, opts);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtGbp(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number, forceSign = true): string {
  const sign = forceSign && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function returnColor(n: number): string {
  if (n > 0) return 'var(--color-beating)';
  if (n < 0) return 'var(--color-trailing)';
  return 'var(--color-text-secondary)';
}

// ─── Verdict Hero Banner ──────────────────────────────────────────────────────
interface VerdictBannerProps {
  verdict: 'beating' | 'trailing' | 'matching';
  outperformanceAbsolute: number;
  outperformance: number;
  portfolioReturn: number;
  vwrlReturn: number;
}

function VerdictBanner({
  verdict,
  outperformanceAbsolute,
  outperformance,
  portfolioReturn,
  vwrlReturn,
}: VerdictBannerProps) {
  const configs = {
    beating: {
      bg:         'var(--color-beating-bg)',
      border:     'var(--color-beating-border)',
      accentBar:  'var(--color-beating-mid)',
      textColor:  'var(--color-beating)',
      label:      'Ahead of VWRL by',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 7L13.5 15.5 8.5 10.5 2 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 7h6v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      sublabel: 'Your portfolio is outperforming the global benchmark.',
    },
    trailing: {
      bg:         'var(--color-trailing-bg)',
      border:     'var(--color-trailing-border)',
      accentBar:  'var(--color-trailing-mid)',
      textColor:  'var(--color-trailing)',
      label:      'Behind VWRL by',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M22 17L13.5 8.5 8.5 13.5 2 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 17h6v-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      sublabel: 'A low-cost VWRL index fund would have returned more.',
    },
    matching: {
      bg:         'var(--color-matching-bg)',
      border:     'var(--color-matching-border)',
      accentBar:  '#d97706',
      textColor:  'var(--color-matching)',
      label:      'Roughly matching VWRL',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      ),
      sublabel: `Difference within 0.5% — effectively in line with the benchmark.`,
    },
  };

  const c = configs[verdict];
  const absPounds = Math.abs(outperformanceAbsolute);
  const absPct    = Math.abs(outperformance);

  return (
    <div style={{
      background:    c.bg,
      border:        `1.5px solid ${c.border}`,
      borderRadius:  'var(--radius-xl)',
      padding:       'var(--sp-5) var(--sp-6)',
      marginBottom:  'var(--sp-5)',
      position:      'relative',
      overflow:      'hidden',
    }}>
      {/* Accent left bar */}
      <div style={{
        position:     'absolute',
        left:         0,
        top:          0,
        bottom:       0,
        width:        '4px',
        background:   c.accentBar,
        borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)',
      }} />

      <div style={{ paddingLeft: 'var(--sp-3)' }}>
        {/* Top row: icon + label */}
        <div style={{
          display:     'flex',
          alignItems:  'center',
          gap:         'var(--sp-3)',
          marginBottom: 'var(--sp-3)',
          color:       c.textColor,
        }}>
          {c.icon}
          <span style={{
            fontSize:    '0.8125rem',
            fontWeight:  600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {c.label}
          </span>
        </div>

        {/* Hero number — the £ difference */}
        {verdict !== 'matching' && (
          <p style={{
            fontSize:   '3rem',
            fontWeight: 800,
            color:      c.textColor,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            marginBottom: 'var(--sp-2)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtGbp(absPounds)}
          </p>
        )}

        {/* Percentage summary */}
        <p style={{
          fontSize:    '0.9375rem',
          fontWeight:  600,
          color:       c.textColor,
          marginBottom: 'var(--sp-2)',
          opacity:     verdict === 'matching' ? 1 : 0.8,
        }}>
          {verdict !== 'matching'
            ? `${fmtPct(absPct, false)} difference in total return`
            : `${fmtPct(absPct, false)} difference`}
        </p>

        {/* Sub line: portfolio vs VWRL breakdown */}
        <p style={{
          fontSize:  '0.8125rem',
          color:     'var(--color-text-secondary)',
          lineHeight: 1.5,
        }}>
          Your portfolio <strong style={{ color: returnColor(portfolioReturn) }}>{fmtPct(portfolioReturn)}</strong>
          {' '}·{' '}
          VWRL <strong style={{ color: 'var(--color-vwrl)' }}>{fmtPct(vwrlReturn)}</strong>
          {' '}·{' '}
          <em style={{ fontStyle: 'normal', color: 'var(--color-text-muted)' }}>{c.sublabel}</em>
        </p>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
interface MetricCardProps {
  label:      string;
  returnPct:  number;
  invested:   number;
  valueLine:  string;
  neutral?:   boolean;
  highlight?: boolean;
}

function MetricCard({ label, returnPct, invested: _invested, valueLine, neutral, highlight }: MetricCardProps) {
  const color = neutral
    ? 'var(--color-vwrl)'
    : highlight
      ? returnColor(returnPct)
      : returnColor(returnPct);

  return (
    <div style={{
      flex:         1,
      background:   'var(--color-surface)',
      border:       `1.5px solid var(--color-border)`,
      borderRadius: 'var(--radius-lg)',
      padding:      'var(--sp-4) var(--sp-5)',
      boxShadow:    'var(--shadow-sm)',
      minWidth:     0,
    }}>
      <p style={{
        fontSize:      '0.6875rem',
        fontWeight:    700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color:         'var(--color-text-muted)',
        marginBottom:  'var(--sp-2)',
      }}>
        {label}
      </p>
      <p style={{
        fontSize:           '1.875rem',
        fontWeight:         800,
        color,
        lineHeight:         1,
        marginBottom:       'var(--sp-2)',
        letterSpacing:      '-0.03em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fmtPct(returnPct)}
      </p>
      <p style={{
        fontSize:  '0.75rem',
        color:     'var(--color-text-secondary)',
        lineHeight: 1.4,
      }}>
        {valueLine}
      </p>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
interface CustomTooltipProps {
  active?:  boolean;
  payload?: Array<{ value: number; name: string }>;
  label?:   string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{
      background:   'var(--color-surface)',
      border:       '1.5px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding:      'var(--sp-2) var(--sp-3)',
      boxShadow:    'var(--shadow-md)',
      fontSize:     '0.8125rem',
    }}>
      <p style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
        {label}
      </p>
      <p style={{ color: returnColor(item.value), fontWeight: 600 }}>
        {fmtPct(item.value)}
      </p>
    </div>
  );
}

// ─── Holdings Table ───────────────────────────────────────────────────────────
interface HoldingsTableProps {
  holdings:  CalculateResponse['holdings'];
  portfolio: CalculateResponse['portfolio'];
}

function HoldingsTable({ holdings, portfolio }: HoldingsTableProps) {
  const thStyle: React.CSSProperties = {
    textAlign:     'left',
    fontSize:      '0.6875rem',
    fontWeight:    700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color:         'var(--color-text-muted)',
    padding:       'var(--sp-2) var(--sp-3) var(--sp-3)',
    borderBottom:  '2px solid var(--color-border)',
    whiteSpace:    'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding:     'var(--sp-3)',
    borderBottom: '1px solid var(--color-border)',
    fontSize:    '0.8125rem',
    color:       'var(--color-text-primary)',
    lineHeight:  1.4,
    whiteSpace:  'nowrap',
  };

  const tdTotalStyle: React.CSSProperties = {
    ...tdStyle,
    fontWeight:  700,
    borderBottom: 'none',
    borderTop:   '2px solid var(--color-border)',
    background:  'var(--color-bg)',
    fontSize:    '0.875rem',
  };

  return (
    <div style={{
      background:    'var(--color-surface)',
      border:        '1.5px solid var(--color-border)',
      borderRadius:  'var(--radius-lg)',
      overflow:      'hidden',
      boxShadow:     'var(--shadow-sm)',
    }}>
      <div style={{ padding: 'var(--sp-4) var(--sp-5) var(--sp-3)' }}>
        <h3>Holdings Breakdown</h3>
      </div>
      {/* Horizontal scroll wrapper for mobile */}
      <div className="table-scroll-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Holding</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Invested</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Current value</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Return</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.id} style={{ transition: 'background var(--transition-fast)' }}>
                <td style={tdStyle}>{h.name}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="num">
                  {fmtGbp(h.amountInvested)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="num">
                  {fmtGbp(h.currentValue)}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: returnColor(h.totalReturn) }} className="num">
                  {fmtPct(h.totalReturn)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={tdTotalStyle}>Total</td>
              <td style={{ ...tdTotalStyle, textAlign: 'right' }} className="num">
                {fmtGbp(portfolio.totalInvested)}
              </td>
              <td style={{ ...tdTotalStyle, textAlign: 'right' }} className="num">
                {fmtGbp(portfolio.totalCurrentValue)}
              </td>
              <td style={{ ...tdTotalStyle, textAlign: 'right', color: returnColor(portfolio.totalReturn) }} className="num">
                {fmtPct(portfolio.totalReturn)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── ResultsPanel ─────────────────────────────────────────────────────────────
interface ResultsPanelProps {
  results: CalculateResponse;
}

export default function ResultsPanel({ results }: ResultsPanelProps) {
  const { portfolio, benchmark, comparison } = results;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');

  const chartData = [
    { name: 'Your Portfolio', return: portfolio.totalReturn },
    { name: 'VWRL',           return: benchmark.totalReturn },
  ];

  const dataAsOf = new Date(results.dataAsOf + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── PDF export ──────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!containerRef.current || isExporting) return;
    plausible('export');
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f7f8fa',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth  = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth   = pageWidth;
      const imgHeight  = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let yOffset    = 0;

      // First page
      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Additional pages if content is long
      while (heightLeft > 0) {
        yOffset = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const date = new Date().toISOString().split('T')[0];
      pdf.save(`beatmark-results-${date}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (shareStatus !== 'idle') return;
    setShareStatus('sharing');
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      plausible('share');
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch {
      // Fallback: try native share, or show a brief error
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'My BeatMark Results',
            text: `My portfolio returned ${fmtPct(portfolio.totalReturn)} vs VWRL ${fmtPct(benchmark.totalReturn)}`,
            url: window.location.href,
          });
          setShareStatus('idle');
        } catch {
          setShareStatus('idle');
        }
      } else {
        setShareStatus('error');
        setTimeout(() => setShareStatus('idle'), 2000);
      }
    }
  };

  return (
    <div ref={containerRef}>

      {/* Section heading + action buttons */}
      <div style={{ marginBottom: 'var(--sp-5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div>
          <h2 style={{ marginBottom: 'var(--sp-1)' }}>Your Results</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
            Compared to VWRL · data as of {dataAsOf}
          </p>
        </div>

        {/* Action buttons: Export PDF + Share */}
        <div className="results-actions" style={{ marginBottom: 0 }}>
          <button
            className="btn-action"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            title="Download results as PDF"
            aria-label="Download results as PDF"
          >
            {isExporting ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} aria-hidden="true">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                Download PDF
              </>
            )}
          </button>

          <button
            className="btn-action"
            onClick={handleShare}
            disabled={shareStatus !== 'idle'}
            title="Share results"
            aria-label="Share results"
          >
            {shareStatus === 'sharing' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} aria-hidden="true">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Sharing…
              </>
            ) : shareStatus === 'copied' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copied!
              </>
            ) : shareStatus === 'error' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 3v5M8 11v1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                Couldn't generate link
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="4"  cy="8" r="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10.5 3.75L5.5 7.25M10.5 12.25L5.5 8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Hero verdict banner ── */}
      <VerdictBanner
        verdict={comparison.verdict}
        outperformance={comparison.outperformance}
        outperformanceAbsolute={comparison.outperformanceAbsolute}
        portfolioReturn={portfolio.totalReturn}
        vwrlReturn={benchmark.totalReturn}
      />

      {/* ── Three metric cards (stack on mobile) ── */}
      <div className="metric-cards-row">
        <MetricCard
          label="Your Portfolio"
          returnPct={portfolio.totalReturn}
          invested={portfolio.totalInvested}
          valueLine={`${fmtGbp(portfolio.totalInvested)} → ${fmtGbp(portfolio.totalCurrentValue)}`}
        />
        <MetricCard
          label="VWRL Benchmark"
          returnPct={benchmark.totalReturn}
          invested={portfolio.totalInvested}
          valueLine={`Same investment → ${fmtGbp(benchmark.totalEquivalentValue)}`}
          neutral
        />
        <MetricCard
          label="Difference"
          returnPct={comparison.outperformance}
          invested={0}
          valueLine={
            comparison.outperformance >= 0
              ? `${fmtGbp(comparison.outperformanceAbsolute)} ahead`
              : `${fmtGbp(Math.abs(comparison.outperformanceAbsolute))} behind`
          }
        />
      </div>

      {/* ── Bar chart ── */}
      <div style={{
        background:    'var(--color-surface)',
        border:        '1.5px solid var(--color-border)',
        borderRadius:  'var(--radius-lg)',
        padding:       'var(--sp-5) var(--sp-5) var(--sp-3)',
        marginBottom:  'var(--sp-5)',
        boxShadow:     'var(--shadow-sm)',
      }}>
        <h3 style={{ marginBottom: 'var(--sp-4)', color: 'var(--color-text-secondary)' }}>
          Return Comparison
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'Inter, sans-serif' }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-bg)' }} />
            <Bar dataKey="return" name="Return %" radius={[6, 6, 0, 0]} maxBarSize={72}>
              {chartData.map((_entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={
                    idx === 0
                      ? portfolio.totalReturn >= 0 ? '#16a34a' : '#dc2626'
                      : '#0369a1'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Results-page legal disclaimer — sits between results and holdings */}
      <Disclaimer variant="results" />

      {/* Data accuracy notice */}
      <Disclaimer variant="data" />

      {/* ── Holdings breakdown (horizontally scrollable on mobile) ── */}
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <HoldingsTable holdings={results.holdings} portfolio={results.portfolio} />
      </div>

      {/* ── Warnings ── */}
      {results.warnings.length > 0 && (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          {results.warnings.map((w, i) => (
            <p key={i} style={{
              fontSize:    '0.75rem',
              color:       'var(--color-text-muted)',
              display:     'flex',
              alignItems:  'flex-start',
              gap:         'var(--sp-1)',
              marginBottom: 'var(--sp-1)',
              lineHeight:  1.5,
            }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              {w.message}
            </p>
          ))}
        </div>
      )}

      {/* ── BeatMark branding footer (shows in PDF) ── */}
      <div style={{
        marginTop:   'var(--sp-6)',
        paddingTop:  'var(--sp-4)',
        borderTop:   '1px solid var(--color-border)',
        display:     'flex',
        alignItems:  'center',
        gap:         'var(--sp-2)',
        justifyContent: 'space-between',
        flexWrap:    'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', borderRadius: '4px',
            background: 'var(--color-brand)', flexShrink: 0,
          }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 13V3M4 7l4-4 4 4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            BeatMark
          </span>
        </div>
        <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
          Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' '}· project-shtzw.vercel.app
        </p>
      </div>

    </div>
  );
}
