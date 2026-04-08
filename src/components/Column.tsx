import { useDroppable } from '@dnd-kit/core'
import type { Task, Status } from '../types'
import TaskCard from './TaskCard'

interface Props {
  id: Status
  label: string
  tasks: Task[]
  onDeleted: () => void
  onOpen: (task: Task) => void
}

const columnColors: Record<Status, string> = {
  todo: 'text-slate-400',
  in_progress: 'text-blue-400',
  in_review: 'text-yellow-400',
  done: 'text-emerald-400',
}

const columnDots: Record<Status, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-400',
  in_review: 'bg-yellow-400',
  done: 'bg-emerald-400',
}

function Column({ id, label, tasks, onDeleted, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      className={`
        relative rounded-2xl p-4 w-72 flex-shrink-0 flex flex-col
        transition-all duration-200
        ${isOver
          ? 'bg-indigo-500/10 border border-indigo-500/40 shadow-lg shadow-indigo-500/10'
          : 'glass'
        }
      `}
      style={{ minHeight: '70vh' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${columnDots[id]}`} />
          <h3 className={`font-semibold text-sm ${columnColors[id]}`}>{label}</h3>
        </div>
        <span className="bg-white/5 text-slate-500 text-xs px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <div ref={setNodeRef} className="flex-1 flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className={`
            flex-1 flex items-center justify-center rounded-xl border border-dashed
            transition-colors duration-200 min-h-32
            ${isOver ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-white/5'}
          `}>
            <p className="text-slate-700 text-xs">Drop here</p>
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