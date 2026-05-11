import type { DailyPriority } from '../../types/daily'

interface TodayPrioritiesCardProps {
  priorities: DailyPriority[]
  onOpenTask?: (taskId: string) => void
}

export default function TodayPrioritiesCard({ priorities, onOpenTask }: TodayPrioritiesCardProps) {
  return (
    <section style={{
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '18px',
      background: 'rgba(255,255,255,0.04)',
      padding: '18px',
    }}>
      <p style={{ color: '#aeb0c8', fontSize: '11px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Top priorities</p>
      <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
        {priorities.slice(0, 3).map((priority, index) => (
          <button
            key={priority.id}
            type="button"
            onClick={() => priority.linkedTaskId && onOpenTask?.(priority.linkedTaskId)}
            disabled={!priority.linkedTaskId}
            style={{
              border: '1px solid rgba(255,255,255,0.13)',
              background: 'rgba(255,255,255,0.045)',
              borderRadius: '14px',
              padding: '13px',
              cursor: priority.linkedTaskId ? 'pointer' : 'default',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 900,
                flexShrink: 0,
              }}>
                {index + 1}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ color: '#fff', display: 'block', fontSize: '14px', fontWeight: 800, lineHeight: 1.3 }}>{priority.title}</span>
                <span style={{ color: '#adadc4', display: 'block', fontSize: '12px', lineHeight: 1.45, marginTop: '4px' }}>{priority.reason}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

