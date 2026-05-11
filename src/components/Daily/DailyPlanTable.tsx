import type { BlockStatus, DailyScheduleBlock } from '../../types/daily'
import { blockStatusLabels, focusTypeLabels } from '../../types/daily'

interface DailyPlanTableProps {
  blocks: DailyScheduleBlock[]
  onStatusChange: (blockId: string, status: BlockStatus) => void
  onStartTask?: (taskId: string) => void
  updatingBlockId?: string | null
}

const focusColors: Record<string, string> = {
  deep_work: '#8b5cf6',
  admin: '#60a5fa',
  break: '#2dd4bf',
  meeting: '#f59e0b',
  personal: '#ec4899',
  review: '#34d399',
}

const statusColors: Record<BlockStatus, string> = {
  pending: '#b8b8cc',
  in_progress: '#60a5fa',
  completed: '#34d399',
  skipped: '#f59e0b',
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = '#8b5cf6',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        border: `1px solid ${tone}66`,
        background: disabled ? 'rgba(255,255,255,0.05)' : `${tone}22`,
        color: disabled ? '#77778c' : '#f7f7fb',
        borderRadius: '10px',
        padding: '8px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '12px',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

export default function DailyPlanTable({ blocks, onStatusChange, onStartTask, updatingBlockId }: DailyPlanTableProps) {
  return (
    <section style={{
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '18px',
      background: 'rgba(255,255,255,0.04)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
        <p style={{ color: '#aeb0c8', fontSize: '11px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0 }}>Today schedule</p>
        <h2 style={{ color: '#fff', fontSize: '24px', margin: '6px 0 0', letterSpacing: '-0.03em' }}>What to do and when</h2>
      </div>

      <div style={{ display: 'grid' }}>
        {blocks.map((block, index) => {
          const tone = focusColors[block.focusType] ?? '#8b5cf6'
          const statusTone = statusColors[block.status]
          const isUpdating = updatingBlockId === block.id
          const done = block.status === 'completed'
          return (
            <article key={block.id} style={{
              display: 'grid',
              gridTemplateColumns: '150px minmax(0, 1fr) auto',
              gap: '18px',
              padding: '18px',
              borderBottom: index === blocks.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.1)',
              background: done ? 'rgba(52,211,153,0.055)' : 'transparent',
              opacity: block.status === 'skipped' ? 0.72 : 1,
            }}>
              <div>
                <p style={{ color: '#f7f7fb', fontSize: '14px', fontWeight: 850, margin: 0 }}>{block.startTime}</p>
                <p style={{ color: '#9f9fb6', fontSize: '12px', margin: '3px 0 0' }}>{block.endTime}</p>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tone, boxShadow: `0 0 16px ${tone}` }} />
                  <span style={{ color: tone, fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {focusTypeLabels[block.focusType]}
                  </span>
                  <span style={{
                    color: statusTone,
                    border: `1px solid ${statusTone}55`,
                    background: `${statusTone}18`,
                    borderRadius: '999px',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 800,
                  }}>
                    {blockStatusLabels[block.status]}
                  </span>
                </div>
                <h3 style={{ color: '#fff', fontSize: '17px', lineHeight: 1.25, margin: '8px 0 6px', letterSpacing: '-0.02em' }}>
                  {block.title}
                </h3>
                <p style={{ color: '#d1d1df', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{block.description}</p>
                <p style={{ color: '#9f9fb6', fontSize: '12px', lineHeight: 1.45, margin: '8px 0 0' }}>
                  <strong style={{ color: '#c4b5fd' }}>Why:</strong> {block.reason}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', alignContent: 'center', minWidth: '220px' }}>
                {block.linkedTaskId && onStartTask && (
                  <ActionButton onClick={() => onStartTask(block.linkedTaskId as string)} disabled={isUpdating} tone="#60a5fa">Open task</ActionButton>
                )}
                <ActionButton onClick={() => onStatusChange(block.id, 'in_progress')} disabled={isUpdating || block.status === 'in_progress'} tone="#60a5fa">Start</ActionButton>
                <ActionButton onClick={() => onStatusChange(block.id, 'completed')} disabled={isUpdating || done} tone="#34d399">Complete</ActionButton>
                <ActionButton onClick={() => onStatusChange(block.id, 'skipped')} disabled={isUpdating || block.status === 'skipped'} tone="#f59e0b">Skip</ActionButton>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

