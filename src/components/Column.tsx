import { useDroppable } from '@dnd-kit/core'
import type { Task, Status } from '../types'
import TaskCard from './TaskCard'
import type { Profile } from '../types'

interface Props {
  id: Status
  label: string
  tasks: Task[]
  onDeleted: () => void
  onOpen: (task: Task) => void
  onAddTask: (status: Status) => void
  profiles?: Record<string, Profile>
}

const columnConfig: Record<Status, {
  color: string
  glow: string
  border: string
  bg: string
  count: string
  header: string
}> = {
  todo: {
    color: '#94a3b8',
    glow: 'rgba(148,163,184,0.2)',
    border: 'rgba(148,163,184,0.4)',
    bg: 'rgba(148,163,184,0.06)',
    count: 'rgba(148,163,184,0.15)',
    header: 'TO DO',
  },
  in_progress: {
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.2)',
    border: 'rgba(139,92,246,0.5)',
    bg: 'rgba(139,92,246,0.06)',
    count: 'rgba(139,92,246,0.2)',
    header: 'IN PROGRESS',
  },
  in_review: {
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.2)',
    border: 'rgba(245,158,11,0.5)',
    bg: 'rgba(245,158,11,0.06)',
    count: 'rgba(245,158,11,0.2)',
    header: 'IN REVIEW',
  },
  done: {
    color: '#10b981',
    glow: 'rgba(16,185,129,0.2)',
    border: 'rgba(16,185,129,0.5)',
    bg: 'rgba(16,185,129,0.06)',
    count: 'rgba(16,185,129,0.2)',
    header: 'DONE',
  },
}

function Column({ id, tasks, onDeleted, onOpen, onAddTask, profiles = {} }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const config = columnConfig[id]

  return (
    <div
      style={{
        width: 'min(300px, 85vw)',
        minWidth: 'min(300px, 85vw)',
        minHeight: '70vh',
        background: isOver ? config.bg : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isOver ? config.border : 'rgba(255,255,255,0.1)'}`,
        boxShadow: isOver ? `0 0 30px ${config.glow}` : '0 2px 12px rgba(0,0,0,0.3)',
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
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '3px', height: '16px', borderRadius: '2px',
            background: config.color,
            boxShadow: `0 0 8px ${config.color}`,
          }} />
          <span style={{
            color: config.color,
            fontSize: '11px',
            fontFamily: 'Space Mono',
            fontWeight: 700,
            letterSpacing: '0.15em',
          }}>
            {config.header}
          </span>
        </div>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: config.count,
          color: config.color,
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
          minHeight: '400px',
        }}
      >
        {tasks.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '8px',
              borderRadius: '12px',
              border: `1px dashed ${isOver ? config.border : 'rgba(255,255,255,0.08)'}`,
              background: isOver ? config.bg : 'transparent',
              minHeight: '200px', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => onAddTask(id)}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              color: config.color,
              border: `1px solid ${config.border}`,
              fontSize: '18px',
              transition: 'all 0.2s',
            }}>+</div>
            <p style={{ color: config.color + '99', fontSize: '10px', fontFamily: 'Space Mono' }}>
              ADD TASK
            </p>
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
              />
            ))}
            {/* Add task button at bottom */}
            <div
              onClick={() => onAddTask(id)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: '1px dashed rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                cursor: 'pointer', marginTop: '4px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = config.border
                e.currentTarget.style.background = config.bg
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ color: config.color + '99', fontSize: '12px' }}>+</span>
              <span style={{ color: config.color + '99', fontSize: '10px', fontFamily: 'Space Mono' }}>ADD TASK</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Column