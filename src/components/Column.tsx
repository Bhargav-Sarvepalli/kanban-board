import { useDroppable } from '@dnd-kit/core'
import type { Task, Status } from '../types'
import TaskCard from './TaskCard'
import type { Profile } from '../types'

interface Props {
  id: Status
  tasks: Task[]
  onDeleted: () => void
  onOpen: (task: Task) => void
  onAddTask: (status: Status) => void
  profiles?: Record<string, Profile>
  userId?: string | null
}

const columnConfig: Record<Status, {
  color: string
  glow: string
  border: string
  bg: string
  count: string
  header: string
  emptyIcon: string
  emptyTitle: string
  emptyDesc: string
}> = {
  todo: {
    color: '#94a3b8',
    glow: 'rgba(148,163,184,0.2)',
    border: 'rgba(148,163,184,0.4)',
    bg: 'rgba(148,163,184,0.06)',
    count: 'rgba(148,163,184,0.15)',
    header: 'TO DO',
    emptyIcon: '📋',
    emptyTitle: 'Nothing queued',
    emptyDesc: 'Click + to add your first task',
  },
  in_progress: {
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.2)',
    border: 'rgba(139,92,246,0.5)',
    bg: 'rgba(139,92,246,0.06)',
    count: 'rgba(139,92,246,0.2)',
    header: 'IN PROGRESS',
    emptyIcon: '⚡',
    emptyTitle: 'Nothing in flight',
    emptyDesc: 'Drag a task here or start a new one',
  },
  in_review: {
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.2)',
    border: 'rgba(245,158,11,0.5)',
    bg: 'rgba(245,158,11,0.06)',
    count: 'rgba(245,158,11,0.2)',
    header: 'IN REVIEW',
    emptyIcon: '👀',
    emptyTitle: 'Nothing to review',
    emptyDesc: 'Move tasks here when they\'re ready to check',
  },
  done: {
    color: '#10b981',
    glow: 'rgba(16,185,129,0.2)',
    border: 'rgba(16,185,129,0.5)',
    bg: 'rgba(16,185,129,0.06)',
    count: 'rgba(16,185,129,0.2)',
    header: 'DONE',
    emptyIcon: '✓',
    emptyTitle: 'Nothing completed yet',
    emptyDesc: 'Drag finished tasks here — celebrate every win',
  },
}

function Column({ id, tasks, onDeleted, onOpen, onAddTask, profiles, userId }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const config = columnConfig[id]
  const isDone = id === 'done'

  return (
    <div
      style={{
        width: 'min(300px, 85vw)',
        minWidth: 'min(300px, 85vw)',
        height: '100%',
        minHeight: 0,
        background: isOver ? config.bg : 'rgba(255,255,255,0.045)',
        border: `1px solid ${isOver ? config.border : 'rgba(255,255,255,0.16)'}`,
        boxShadow: isOver ? `0 0 30px ${config.glow}` : '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        borderRadius: '16px',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s',
      }}
    >
      {/* Column header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.13)',
        background: 'rgba(255,255,255,0.045)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '3px', height: '16px', borderRadius: '2px',
            background: config.color,
            boxShadow: `0 0 8px ${config.color}`,
          }} />
          <span style={{
            color: config.color, fontSize: '11px',
            fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.15em',
          }}>
            {config.header}
          </span>
        </div>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: config.count, color: config.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700, fontFamily: 'Space Mono',
          border: `1px solid ${config.border}`,
        }}>
          {tasks.length}
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1, padding: '12px',
          display: 'flex', flexDirection: 'column', gap: '8px',
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        {tasks.length === 0 ? (
          // ── EMPTY STATE ──
          <div
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '10px',
              borderRadius: '12px',
              border: `1px dashed ${isOver ? config.border : 'rgba(255,255,255,0.14)'}`,
              background: isOver ? config.bg : isDone ? 'rgba(16,185,129,0.03)' : 'transparent',
              minHeight: '200px',
              cursor: isDone ? 'default' : 'pointer',
              transition: 'all 0.2s',
              padding: '24px 16px',
            }}
            onClick={() => !isDone && onAddTask(id)}
          >
            {/* Icon */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${config.color}12`,
              border: `1px solid ${config.color}30`,
              fontSize: '18px',
            }}>
              {config.emptyIcon}
            </div>

            {/* Text */}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: config.color + 'cc', fontSize: '12px', fontWeight: 600,
                fontFamily: 'Space Grotesk', margin: '0 0 4px',
              }}>
                {config.emptyTitle}
              </p>
              <p style={{
                color: 'rgba(255,255,255,0.5)', fontSize: '11px',
                fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1.5,
              }}>
                {config.emptyDesc}
              </p>
            </div>

            {/* Add button — not on Done column */}
            {!isDone && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                marginTop: '4px',
                padding: '6px 14px', borderRadius: '20px',
                background: `${config.color}12`,
                border: `1px solid ${config.color}30`,
              }}>
                <span style={{ color: config.color, fontSize: '13px', lineHeight: 1 }}>+</span>
                <span style={{ color: config.color + 'aa', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.08em' }}>
                  ADD TASK
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onDeleted={onDeleted}
                onOpen={() => onOpen(task)}
                profiles={profiles}
                userId={userId}
              />
            ))}

            {/* Done column celebration */}
            {isDone && tasks.length > 0 && (
              <div style={{
                padding: '12px', borderRadius: '10px', marginTop: '4px',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.15)',
                textAlign: 'center',
              }}>
                <p style={{
                  color: '#10b981', fontSize: '11px',
                  fontFamily: 'Space Grotesk', margin: 0,
                }}>
                  {tasks.length === 1
                    ? '1 task completed ✓'
                    : `${tasks.length} tasks completed 🎉`}
                </p>
              </div>
            )}

            {/* Add task button — not on Done */}
            {!isDone && (
              <div
                onClick={() => onAddTask(id)}
                style={{
                  padding: '8px', borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,0.16)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  cursor: 'pointer', marginTop: '4px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = config.border
                  e.currentTarget.style.background = config.bg
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ color: config.color + '99', fontSize: '12px' }}>+</span>
                <span style={{ color: config.color + '99', fontSize: '10px', fontFamily: 'Space Mono' }}>ADD TASK</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Column
