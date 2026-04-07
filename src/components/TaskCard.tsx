import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { supabase } from '../supabase'
import type { Task } from '../types'

interface Props {
  task: Task
  onDeleted: () => void
}

function TaskCard({ task, onDeleted }: Props) {
  const [hovered, setHovered] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const priorityColors = {
    low: '#6b7280',
    normal: '#3b82f6',
    high: '#ef4444',
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDeleting(true)
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)
    if (error) {
      console.error('Delete error:', error)
      setDeleting(false)
    } else {
      onDeleted()
    }
  }

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#1e1e2e',
        border: '1px solid #2e2e3e',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '8px',
        opacity: isDragging || deleting ? 0.5 : 1,
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
        zIndex: isDragging ? 999 : undefined,
        position: 'relative',
      }}
    >
      {/* Drag handle area — only this part is draggable */}
      <div
        {...listeners}
        {...attributes}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: '8px',
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 1,
        }}
      />

      {/* Content — sits above drag handle */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Delete button */}
        {hovered && !isDragging && (
          <button
            onPointerDown={handleDelete}
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#ef444420',
              border: 'none',
              borderRadius: '4px',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px 6px',
              lineHeight: 1,
              zIndex: 3,
            }}
          >
            ✕
          </button>
        )}

        {/* Priority dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: priorityColors[task.priority],
          }} />
          <span style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase' }}>
            {task.priority}
          </span>
        </div>

        {/* Title */}
        <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0 }}>
          {task.title}
        </p>

        {/* Due date */}
        {task.due_date && (() => {
            const due = new Date(task.due_date)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const isOverdue = diffDays < 0
            const isDueSoon = diffDays >= 0 && diffDays <= 2

            return (
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '8px',
                backgroundColor: isOverdue ? '#ef444420' : isDueSoon ? '#f9731620' : '#ffffff10',
                border: `1px solid ${isOverdue ? '#ef4444' : isDueSoon ? '#f97316' : '#ffffff20'}`,
                borderRadius: '4px',
                padding: '2px 6px',
            }}>
                <span style={{ fontSize: '11px' }}>📅</span>
                <span style={{
                fontSize: '11px',
                color: isOverdue ? '#ef4444' : isDueSoon ? '#f97316' : '#6b7280',
                fontWeight: isOverdue || isDueSoon ? 600 : 400,
                }}>
                {isOverdue
                    ? `Overdue by ${Math.abs(diffDays)}d`
                    : isDueSoon
                    ? diffDays === 0 ? 'Due today' : `Due in ${diffDays}d`
                    : due.toLocaleDateString()}
                </span>
            </div>
            )
        })()}
      </div>
    </div>
  )
}

export default TaskCard