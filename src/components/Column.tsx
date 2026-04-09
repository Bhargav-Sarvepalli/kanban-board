import { useDroppable } from '@dnd-kit/core'
import type { Task, Status } from '../types'
import TaskCard from './TaskCard'

interface Props {
  id: Status
  label: string
  tasks: Task[]
  onDeleted: () => void
  onOpen: (task: Task) => void
  onAddTask: (status: Status) => void
}

const columnConfig: Record<Status, {
  color: string
  glow: string
  border: string
  dot: string
  bg: string
  count: string
  header: string
}> = {
  todo: {
    color: '#94a3b8',
    glow: 'rgba(148,163,184,0.15)',
    border: 'rgba(148,163,184,0.3)',
    dot: '#94a3b8',
    bg: 'rgba(148,163,184,0.03)',
    count: 'rgba(148,163,184,0.1)',
    header: 'TO DO',
  },
  in_progress: {
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.15)',
    border: 'rgba(139,92,246,0.4)',
    dot: '#8b5cf6',
    bg: 'rgba(139,92,246,0.03)',
    count: 'rgba(139,92,246,0.15)',
    header: 'IN PROGRESS',
  },
  in_review: {
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.4)',
    dot: '#f59e0b',
    bg: 'rgba(245,158,11,0.03)',
    count: 'rgba(245,158,11,0.15)',
    header: 'IN REVIEW',
  },
  done: {
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    border: 'rgba(16,185,129,0.4)',
    dot: '#10b981',
    bg: 'rgba(16,185,129,0.03)',
    count: 'rgba(16,185,129,0.15)',
    header: 'DONE',
  },
}

function Column({ id, tasks, onDeleted, onOpen, onAddTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const config = columnConfig[id]

  return (
    <div
      className="flex-shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        width: '300px',
        minHeight: '70vh',
        background: isOver ? config.bg : 'rgba(255,255,255,0.01)',
        border: `1px solid ${isOver ? config.border : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isOver ? `0 0 30px ${config.glow}` : 'none',
      }}
    >
      {/* Column header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1 h-4 rounded-full"
            style={{ background: config.color, boxShadow: `0 0 8px ${config.color}` }}
          />
          <span
            className="text-xs font-mono font-bold tracking-[0.2em]"
            style={{ color: config.color }}
          >
            {config.header}
          </span>
        </div>

        <div
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold font-mono"
          style={{ background: config.count, color: config.color }}
        >
          {tasks.length}
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 p-3 flex flex-col gap-2"
        style={{ minHeight: '400px' }}
      >
        {tasks.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-all duration-200"
            style={{
              borderColor: isOver ? config.border : 'rgba(255,255,255,0.05)',
              background: isOver ? config.bg : 'transparent',
              minHeight: '200px',
              cursor: 'pointer',
            }}
            onClick={() => onAddTask(id)}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.03)',
                color: config.color,
                border: `1px solid ${config.border}`,
              }}
            >
              +
            </div>
            <p className="text-xs font-mono" style={{ color: config.color + '60' }}>
              ADD TASK
            </p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onDeleted={onDeleted}
              onOpen={() => onOpen(task)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default Column