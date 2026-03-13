interface EmptyStateProps {
  isCalculating?: boolean;
}

export default function EmptyState({ isCalculating }: EmptyStateProps) {
  if (isCalculating) {
    return <LoadingState />;
  }

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      height:         '100%',
      minHeight:      '440px',
      padding:        'var(--sp-10)',
      textAlign:      'center',
      userSelect:     'none',
    }}>
      {/* Illustration */}
      <ChartIllustration />

      {/* Heading */}
      <h3 style={{
        marginTop:   'var(--sp-6)',
        marginBottom: 'var(--sp-2)',
        fontSize:    '1.0625rem',
        fontWeight:  700,
        color:       'var(--color-text-primary)',
        letterSpacing: '-0.02em',
      }}>
        Ready to compare your portfolio?
      </h3>

      {/* Body */}
      <p style={{
        color:     'var(--color-text-secondary)',
        fontSize:  '0.875rem',
        maxWidth:  '300px',
        lineHeight: 1.65,
        marginBottom: 'var(--sp-7)',
      }}>
        Enter your holdings on the left and hit{' '}
        <strong style={{
          color:       'var(--color-brand)',
          fontWeight:  600,
        }}>
          Calculate
        </strong>
        {' '}to see how you stack up against VWRL.
      </p>

      {/* Preview chips — hint at what they'll see */}
      <div style={{
        display:         'flex',
        flexWrap:        'wrap',
        gap:             'var(--sp-2)',
        justifyContent:  'center',
        maxWidth:        '340px',
      }}>
        {[
          { label: 'Your return %',       color: 'var(--color-beating)',  bg: 'var(--color-beating-bg)',  border: 'var(--color-beating-border)' },
          { label: 'VWRL benchmark',       color: 'var(--color-vwrl)',     bg: 'var(--color-vwrl-bg)',     border: 'var(--color-vwrl-border)' },
          { label: '£ difference',          color: 'var(--color-trailing)', bg: 'var(--color-trailing-bg)', border: 'var(--color-trailing-border)' },
          { label: 'Holdings breakdown',   color: 'var(--color-text-secondary)', bg: 'var(--color-surface)', border: 'var(--color-border)' },
        ].map(({ label, color, bg, border }) => (
          <span key={label} style={{
            background:   bg,
            border:       `1px solid ${border}`,
            borderRadius: '20px',
            padding:      '5px 14px',
            fontSize:     '0.75rem',
            fontWeight:   500,
            color,
          }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div style={{ padding: 'var(--sp-2)' }}>

      {/* Section heading skeleton */}
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="skeleton" style={{ height: '22px', width: '160px', marginBottom: '10px' }} />
        <div className="skeleton" style={{ height: '14px', width: '240px' }} />
      </div>

      {/* Verdict banner skeleton */}
      <div style={{
        background:   'var(--color-surface)',
        border:       '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding:      'var(--sp-5) var(--sp-6)',
        marginBottom: 'var(--sp-5)',
        overflow:     'hidden',
        position:     'relative',
      }}>
        <div className="skeleton" style={{ height: '14px', width: '180px', marginBottom: 'var(--sp-3)' }} />
        <div className="skeleton" style={{ height: '52px', width: '220px', marginBottom: 'var(--sp-3)', borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: '12px', width: '60%' }} />
      </div>

      {/* Headline numbers skeleton */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            flex:         1,
            background:   'var(--color-surface)',
            border:       '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding:      'var(--sp-4) var(--sp-5)',
          }}>
            <div className="skeleton" style={{ height: '10px', width: '55%', marginBottom: 'var(--sp-3)' }} />
            <div className="skeleton" style={{ height: '36px', width: '75%', marginBottom: 'var(--sp-2)', borderRadius: 'var(--radius-md)' }} />
            <div className="skeleton" style={{ height: '10px', width: '90%' }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div style={{
        background:   'var(--color-surface)',
        border:       '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding:      'var(--sp-5)',
        marginBottom: 'var(--sp-5)',
      }}>
        <div className="skeleton" style={{ height: '14px', width: '180px', marginBottom: 'var(--sp-5)' }} />
        <div style={{
          display:     'flex',
          alignItems:  'flex-end',
          gap:         'var(--sp-6)',
          height:      '160px',
          padding:     '0 var(--sp-5)',
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <div className="skeleton" style={{ width: '100%', height: '60%', borderRadius: '6px 6px 0 0' }} />
            <div className="skeleton" style={{ height: '10px', width: '80%', borderRadius: 'var(--radius-sm)' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <div className="skeleton" style={{ width: '100%', height: '90%', borderRadius: '6px 6px 0 0' }} />
            <div className="skeleton" style={{ height: '10px', width: '60%', borderRadius: 'var(--radius-sm)' }} />
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div style={{
        background:   'var(--color-surface)',
        border:       '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding:      'var(--sp-5)',
      }}>
        <div className="skeleton" style={{ height: '14px', width: '180px', marginBottom: 'var(--sp-5)' }} />
        {/* Header row */}
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-3)', paddingBottom: 'var(--sp-3)', borderBottom: '2px solid var(--color-border)' }}>
          {[2, 1, 1, 1].map((flex, i) => (
            <div key={i} className="skeleton" style={{ height: '10px', flex }} />
          ))}
        </div>
        {/* Data rows */}
        {[1, 2].map((i) => (
          <div key={i} style={{
            display:      'flex',
            gap:          'var(--sp-4)',
            marginBottom: 'var(--sp-3)',
            paddingBottom: 'var(--sp-3)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            {[2, 1, 1, 1].map((flex, j) => (
              <div key={j} className="skeleton" style={{ height: '12px', flex }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart illustration ───────────────────────────────────────────────────────
function ChartIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="40" cy="40" r="40" fill="var(--color-brand-surface)" />

      {/* Grid lines */}
      <line x1="16" y1="56" x2="64" y2="56" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="44" x2="64" y2="44" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="16" y1="32" x2="64" y2="32" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="3 3" />

      {/* Bar 1 — portfolio (trailing, red) */}
      <rect x="22" y="40" width="14" height="16" rx="3" fill="#fca5a5" />
      {/* Bar 2 — VWRL (blue) */}
      <rect x="44" y="26" width="14" height="30" rx="3" fill="var(--color-vwrl)" opacity="0.5" />

      {/* Upward trending sparkline */}
      <path
        d="M18 50 L32 38 L50 30 L62 22"
        stroke="var(--color-brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />

      {/* Arrow head */}
      <path
        d="M58 20 L62 22 L60 26"
        stroke="var(--color-brand)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
