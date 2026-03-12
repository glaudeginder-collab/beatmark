interface EmptyStateProps {
  isCalculating?: boolean;
}

export default function EmptyState({ isCalculating }: EmptyStateProps) {
  if (isCalculating) {
    return <LoadingState />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '400px',
      padding: '40px',
      textAlign: 'center',
    }}>
      <ChartIcon />
      <h3 style={{
        marginTop: '20px',
        marginBottom: '8px',
        color: 'var(--color-text-secondary)',
        fontWeight: 600,
        fontSize: '1.05rem',
      }}>
        Enter your portfolio on the left
      </h3>
      <p style={{
        color: 'var(--color-text-muted)',
        fontSize: '0.875rem',
        maxWidth: '280px',
        lineHeight: 1.6,
      }}>
        Add your holdings and hit <strong style={{ color: 'var(--color-text-secondary)' }}>Calculate</strong> to
        see how you compare to VWRL.
      </p>
      <div style={{
        marginTop: '28px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {['Your return %', 'VWRL benchmark', 'Difference in £'].map((label) => (
          <span key={label} style={{
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: '20px',
            padding: '5px 14px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
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
    <div style={{ padding: '8px' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #e2e8f0 25%, #edf2f7 50%, #e2e8f0 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite linear;
          border-radius: 6px;
        }
      `}</style>

      {/* Headline numbers skeleton */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1,
            background: '#fff',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
          }}>
            <div className="skeleton" style={{ height: '12px', width: '60%', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '32px', width: '80%', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '10px', width: '90%' }} />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <div className="skeleton" style={{ height: '14px', width: '200px', marginBottom: '20px' }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', height: '160px', padding: '0 20px' }}>
          <div className="skeleton" style={{ flex: 1, height: '60%', borderRadius: '4px 4px 0 0' }} />
          <div className="skeleton" style={{ flex: 1, height: '90%', borderRadius: '4px 4px 0 0' }} />
        </div>
      </div>

      {/* Table skeleton */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '12px',
          }}>
            <div className="skeleton" style={{ height: '12px', flex: 2 }} />
            <div className="skeleton" style={{ height: '12px', flex: 1 }} />
            <div className="skeleton" style={{ height: '12px', flex: 1 }} />
            <div className="skeleton" style={{ height: '12px', flex: 1 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Chart icon ───────────────────────────────────────────────────────────────
function ChartIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#EBF4FF" />
      {/* Bar chart bars */}
      <rect x="12" y="36" width="10" height="16" rx="2" fill="#90CDF4" />
      <rect x="27" y="24" width="10" height="28" rx="2" fill="#63B3ED" />
      <rect x="42" y="16" width="10" height="36" rx="2" fill="#2B6CB0" />
      {/* Baseline */}
      <line x1="10" y1="52" x2="54" y2="52" stroke="#BEE3F8" strokeWidth="2" strokeLinecap="round" />
      {/* Trend arrow */}
      <path d="M14 32 L28 20 L42 14" stroke="#2B6CB0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" />
    </svg>
  );
}
