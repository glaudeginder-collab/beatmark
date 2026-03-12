import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { CalculateResponse } from '../../../shared/index';

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
  if (n > 0) return 'var(--color-success)';
  if (n < 0) return '#c53030';
  return 'var(--color-neutral)';
}

// ─── HeadlineCard ─────────────────────────────────────────────────────────────
interface HeadlineCardProps {
  title: string;
  returnPct: number;
  subLine: string;
  neutral?: boolean;
}

function HeadlineCard({ title, returnPct, subLine, neutral }: HeadlineCardProps) {
  const color = neutral ? 'var(--color-neutral)' : returnColor(returnPct);
  return (
    <div style={{
      flex: 1,
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <p style={{
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--color-text-muted)',
        marginBottom: '10px',
      }}>
        {title}
      </p>
      <p style={{
        fontSize: '2rem',
        fontWeight: 800,
        color,
        lineHeight: 1,
        marginBottom: '6px',
      }}>
        {fmtPct(returnPct)}
      </p>
      <p style={{
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
        lineHeight: 1.4,
      }}>
        {subLine}
      </p>
    </div>
  );
}

// ─── Verdict Banner ───────────────────────────────────────────────────────────
interface VerdictBannerProps {
  verdict: 'beating' | 'trailing' | 'matching';
  outperformanceAbsolute: number;
  outperformance: number;
}

function VerdictBanner({ verdict, outperformanceAbsolute, outperformance }: VerdictBannerProps) {
  const configs = {
    beating: {
      bg: 'var(--color-success-bg)',
      border: '#9ae6b4',
      icon: '🎉',
      text: `You're beating VWRL by ${fmtPct(outperformance)} (${fmtGbp(outperformanceAbsolute)} ahead)`,
      color: 'var(--color-success)',
    },
    trailing: {
      bg: 'var(--color-danger-bg)',
      border: '#feb2b2',
      icon: '📉',
      text: `You're trailing VWRL by ${fmtPct(Math.abs(outperformance))} (${fmtGbp(Math.abs(outperformanceAbsolute))} behind)`,
      color: 'var(--color-danger)',
    },
    matching: {
      bg: '#fffff0',
      border: '#faf089',
      icon: '⚖️',
      text: `You're roughly matching VWRL — ${fmtPct(Math.abs(outperformance))} difference`,
      color: '#744210',
    },
  };
  const c = configs[verdict];

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '14px 18px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    }}>
      <span style={{ fontSize: '22px' }}>{c.icon}</span>
      <p style={{ fontSize: '14px', fontWeight: 600, color: c.color }}>
        {c.text}
      </p>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      boxShadow: 'var(--shadow-md)',
      fontSize: '13px',
    }}>
      <p style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>
        {item.name}
      </p>
      <p style={{ color: returnColor(item.value) }}>
        {fmtPct(item.value)}
      </p>
    </div>
  );
}

// ─── Holdings Table ───────────────────────────────────────────────────────────
interface HoldingsTableProps {
  holdings: CalculateResponse['holdings'];
  portfolio: CalculateResponse['portfolio'];
}

function HoldingsTable({ holdings, portfolio }: HoldingsTableProps) {
  const totalInvested = portfolio.totalInvested;
  const totalCurrent = portfolio.totalCurrentValue;
  const totalReturn = portfolio.totalReturn;

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-muted)',
    padding: '0 12px 10px',
    borderBottom: '2px solid var(--color-border)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--color-border)',
    fontSize: '13px',
    color: 'var(--color-text-primary)',
  };

  const tdTotalStyle: React.CSSProperties = {
    ...tdStyle,
    fontWeight: 700,
    borderBottom: 'none',
    borderTop: '2px solid var(--color-border)',
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ padding: '16px 20px 12px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          Holdings Breakdown
        </h3>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Holding</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Invested</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Current</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Return</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.id} style={{ transition: 'background 0.1s' }}>
              <td style={tdStyle}>{h.name}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmtGbp(h.amountInvested)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmtGbp(h.currentValue)}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: returnColor(h.totalReturn) }}>
                {fmtPct(h.totalReturn)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...tdTotalStyle }}>Total</td>
            <td style={{ ...tdTotalStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {fmtGbp(totalInvested)}
            </td>
            <td style={{ ...tdTotalStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {fmtGbp(totalCurrent)}
            </td>
            <td style={{ ...tdTotalStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: returnColor(totalReturn) }}>
              {fmtPct(totalReturn)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── ResultsPanel ─────────────────────────────────────────────────────────────
interface ResultsPanelProps {
  results: CalculateResponse;
}

export default function ResultsPanel({ results }: ResultsPanelProps) {
  const { portfolio, benchmark, comparison } = results;

  // Chart data
  const chartData = [
    { name: 'Your Portfolio', return: portfolio.totalReturn },
    { name: 'VWRL', return: benchmark.totalReturn },
  ];

  const dataAsOf = new Date(results.dataAsOf + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div>
      {/* Section heading */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '4px' }}>Your Results</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
          Compared to VWRL · data as of {dataAsOf}
        </p>
      </div>

      {/* Verdict banner */}
      <VerdictBanner
        verdict={comparison.verdict}
        outperformance={comparison.outperformance}
        outperformanceAbsolute={comparison.outperformanceAbsolute}
      />

      {/* Headline numbers */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <HeadlineCard
          title="Your Portfolio"
          returnPct={portfolio.totalReturn}
          subLine={`${fmtGbp(portfolio.totalInvested)} invested → ${fmtGbp(portfolio.totalCurrentValue)} today`}
        />
        <HeadlineCard
          title="VWRL Benchmark"
          returnPct={benchmark.totalReturn}
          subLine={`Same investment would be ${fmtGbp(benchmark.totalEquivalentValue)}`}
          neutral
        />
        <HeadlineCard
          title="Difference"
          returnPct={comparison.outperformance}
          subLine={
            comparison.outperformance >= 0
              ? `You're ${fmtGbp(comparison.outperformanceAbsolute)} ahead`
              : `You're ${fmtGbp(Math.abs(comparison.outperformanceAbsolute))} behind`
          }
        />
      </div>

      {/* Bar chart */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 20px 12px',
        marginBottom: '20px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--color-text-secondary)',
          marginBottom: '16px',
        }}>
          Return Comparison
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#718096' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: '#a0aec0' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f7fafc' }} />
            <Bar dataKey="return" name="Return %" radius={[4, 4, 0, 0]} maxBarSize={80}>
              {chartData.map((_entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={
                    idx === 0
                      ? portfolio.totalReturn >= 0 ? '#48bb78' : '#fc8181'
                      : '#63b3ed'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Holdings breakdown */}
      <HoldingsTable holdings={results.holdings} portfolio={results.portfolio} />

      {/* Warnings */}
      {results.warnings.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          {results.warnings.map((w, i) => (
            <p key={i} style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '4px',
              marginBottom: '4px',
            }}>
              <span>⚠️</span> {w.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
