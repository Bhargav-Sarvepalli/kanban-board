import type { DailyWarning } from '../../types/daily'

interface BlockersCardProps {
  warnings: DailyWarning[]
}

const warningColors = {
  low: '#60a5fa',
  medium: '#f59e0b',
  high: '#f87171',
}

export default function BlockersCard({ warnings }: BlockersCardProps) {
  return (
    <section style={{
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '18px',
      background: 'rgba(255,255,255,0.04)',
      padding: '18px',
    }}>
      <p style={{ color: '#aeb0c8', fontSize: '11px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Warnings</p>
      {warnings.length === 0 ? (
        <div style={{ marginTop: '14px', border: '1px solid rgba(52,211,153,0.22)', background: 'rgba(52,211,153,0.07)', borderRadius: '14px', padding: '14px' }}>
          <p style={{ color: '#34d399', fontSize: '13px', fontWeight: 850, margin: 0 }}>No major blockers found.</p>
          <p style={{ color: '#a7f3d0', fontSize: '12px', lineHeight: 1.45, margin: '4px 0 0' }}>Keep the board updated as the day changes.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
          {warnings.map(warning => {
            const color = warningColors[warning.severity]
            return (
              <div key={warning.id} style={{ border: `1px solid ${color}55`, background: `${color}14`, borderRadius: '14px', padding: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 14px ${color}` }} />
                  <span style={{ color, fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{warning.type}</span>
                </div>
                <p style={{ color: '#f4f4fb', fontSize: '13px', lineHeight: 1.45, margin: '8px 0 0' }}>{warning.message}</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

