import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { supabase } from '../supabase'
import type { Task } from '../types'

interface Props {
  task: Task
  onDeleted: () => void
  onOpen: () => void
}

const priorityConfig = {
  low: { color: 'text-slate-400', bg: 'bg-slate-400/10', dot: 'bg-slate-400', label: 'Low' },
  normal: { color: 'text-blue-400', bg: 'bg-blue-400/10', dot: 'bg-blue-400', label: 'Normal' },
  high: { color: 'text-red-400', bg: 'bg-red-400/10', dot: 'bg-red-400', label: 'High' },
}

function TaskCard({ task, onDeleted, onOpen }: Props) {
  const [hovered, setHovered] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const priority = priorityConfig[task.priority]

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) {
      console.error('Delete error:', error)
      setDeleting(false)
    } else {
      onDeleted()
    }
  }

  const getDueDateInfo = () => {
    if (!task.due_date) return null
    const due = new Date(task.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, class: 'text-red-400 bg-red-400/10 border-red-400/20' }
    if (diffDays === 0) return { label: 'Due today', class: 'text-orange-400 bg-orange-400/10 border-orange-400/20' }
    if (diffDays <= 2) return { label: `Due in ${diffDays}d`, class: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' }
    return { label: due.toLocaleDateString(), class: 'text-slate-500 bg-white/5 border-white/10' }
  }

  const dueDateInfo = getDueDateInfo()

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        zIndex: isDragging ? 999 : undefined,
        opacity: isDragging ? 0.4 : deleting ? 0 : 1,
        position: 'relative',
        touchAction: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="glass glass-hover rounded-xl p-3 transition-all duration-200 select-none"
    >
      {/* Top row: drag handle + priority + delete */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors px-0.5"
          >
            ⠿
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${priority.bg} ${priority.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {priority.label}
          </span>
        </div>

        {hovered && (
          <button
            onClick={handleDelete}
            className="text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg p-1 transition-colors text-xs ml-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Title — click to open detail panel */}
      <p
        onClick={onOpen}
        className="text-slate-200 text-sm font-medium leading-snug mb-2 ml-5 cursor-pointer hover:text-indigo-300 transition-colors"
      >
        {task.title}
      </p>

      {/* Description preview */}
      {task.description && (
        <p className="text-slate-600 text-xs leading-relaxed mb-2 ml-5 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Due date */}
      {dueDateInfo && (
        <div className="ml-5">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${dueDateInfo.class}`}>
            📅 {dueDateInfo.label}
          </span>
        </div>
      )}
    </div>
  )
}

export default TaskCard