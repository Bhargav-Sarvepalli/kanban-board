import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { supabase } from '../supabase'
import type { Task } from '../types'
import toast from 'react-hot-toast'

interface Props {
  task: Task
  onDeleted: () => void
  onOpen: () => void
}

const priorityConfig = {
  low: { color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'LOW', bar: '#64748b' },
  normal: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'NORMAL', bar: '#8b5cf6' },
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'HIGH', bar: '#ef4444' },
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
      console.error(error)
      setDeleting(false)
      toast.error('Failed to delete task')
    } else {
      toast.success('Task deleted')
      onDeleted()
    }
  }

  const getDueDateInfo = () => {
    if (!task.due_date) return null
    const due = new Date(task.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { label: `OVERDUE ${Math.abs(diffDays)}D`, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    if (diffDays === 0) return { label: 'DUE TODAY', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    if (diffDays <= 2) return { label: `DUE IN ${diffDays}D`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    return { label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: '#475569', bg: 'rgba(71,85,105,0.1)' }
  }

  const dueDateInfo = getDueDateInfo()

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        zIndex: isDragging ? 999 : undefined,
        opacity: isDragging ? 0.3 : deleting ? 0 : 1,
        position: 'relative',
        touchAction: 'none',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
        borderLeftColor: priority.bar,
        borderLeftWidth: '2px',
        borderRadius: '10px',
        padding: '12px',
        transition: 'all 0.15s ease',
        boxShadow: hovered ? `0 4px 20px rgba(0,0,0,0.3), -2px 0 8px ${priority.bar}40` : 'none',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Drag handle */}
          <div
            {...listeners}
            {...attributes}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              color: 'rgba(255,255,255,0.2)',
              fontSize: '14px',
              lineHeight: 1,
              padding: '2px',
              userSelect: 'none',
            }}
          >
            ⠿
          </div>

          {/* Priority badge */}
          <span style={{
            fontSize: '9px',
            fontFamily: 'Space Mono, monospace',
            fontWeight: 'bold',
            letterSpacing: '0.15em',
            padding: '2px 6px',
            borderRadius: '4px',
            color: priority.color,
            background: priority.bg,
          }}>
            {priority.label}
          </span>
        </div>

        {/* Delete button */}
        {hovered && !isDragging && (
          <button
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              handleDelete()
            }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              color: 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
              width: '20px', height: '20px',
              borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px',
            }}
          >✕</button>
        )}
      </div>

      {/* Title */}
      <p
        onClick={onOpen}
        style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          marginBottom: '6px',
          marginLeft: '20px',
          cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'white')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
      >
        {task.title}
      </p>

      {/* Description preview */}
      {task.description && (
        <p style={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: '11px',
          lineHeight: 1.5,
          marginBottom: '8px',
          marginLeft: '20px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {task.description}
        </p>
      )}

      {/* Footer badges */}
      <div style={{ marginLeft: '20px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {dueDateInfo && (
          <span style={{
            fontSize: '9px',
            fontFamily: 'Space Mono, monospace',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            padding: '2px 8px',
            borderRadius: '4px',
            color: dueDateInfo.color,
            background: dueDateInfo.bg,
          }}>
            {dueDateInfo.label}
          </span>
        )}

        {task.recurring && (
          <span style={{
            fontSize: '9px',
            fontFamily: 'Space Mono, monospace',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            padding: '2px 8px',
            borderRadius: '4px',
            color: task.recurring === 'weekly' ? '#06b6d4' : '#8b5cf6',
            background: task.recurring === 'weekly' ? 'rgba(6,182,212,0.1)' : 'rgba(139,92,246,0.1)',
          }}>
            ↻ {task.recurring.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

export default TaskCard