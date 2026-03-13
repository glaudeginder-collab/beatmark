// ─── Disclaimer ───────────────────────────────────────────────────────────────
// Legal disclaimer copy authored by Darren (Product Owner, Niko Labs Ltd).
// See /decisions/LEGAL_DISCLAIMER.md for context and rationale.

interface DisclaimerProps {
  /** 'footer' = compact 1–2 line version for every page footer.
   *  'results' = expanded version shown below the results panel.
   *  'data'    = data-accuracy notice near the VWRL attribution. */
  variant: 'footer' | 'results' | 'data';
}

export default function Disclaimer({ variant }: DisclaimerProps) {
  const baseStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--color-text-muted)',
    lineHeight: 1.6,
  };

  if (variant === 'footer') {
    return (
      <p style={{ ...baseStyle, textAlign: 'center' }}>
        <strong style={{ fontWeight: 600 }}>BeatMark is for informational purposes only and does not constitute financial advice.</strong>{' '}
        Always consult a qualified financial adviser before making investment decisions.
      </p>
    );
  }

  if (variant === 'results') {
    return (
      <div style={{
        marginTop: '20px',
        padding: '14px 16px',
        background: '#f7fafc',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <p style={{ ...baseStyle, marginBottom: '6px' }}>
          The comparison shown is based on the figures you entered and publicly available VWRL price
          data. It reflects a simple total return calculation and does not account for taxes, fees,
          dividends, currency fluctuations, or individual circumstances.
        </p>
        <p style={baseStyle}>
          <strong style={{ fontWeight: 600 }}>This is not financial advice.</strong> BeatMark is a
          free benchmarking tool to help you ask better questions — not to tell you what to do with
          your money. Past performance is not a reliable indicator of future results.
        </p>
      </div>
    );
  }

  // variant === 'data'
  return (
    <p style={{ ...baseStyle, marginTop: '8px' }}>
      VWRL price data is sourced from Yahoo Finance and may be delayed by up to 24 hours. Figures
      are provided for informational purposes only. Niko Labs Ltd makes no guarantee as to the
      accuracy, completeness, or timeliness of this data.
    </p>
  );
}
