import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import type { Task, Profile } from '../types'
import { supabase } from '../supabase'
import ConfirmDialog from './ConfirmDialog'
import Avatar from './Avatar'
import { useWorkspaceRole, canDeleteTask } from '../hooks/useWorkspaceRole'

interface Props {
  task: Task
  onDeleted: () => void
  onOpen: () => void
  profiles?: Record<string, Profile>
  userId?: string | null
}

function TaskCard({ task, onDeleted, onOpen, profiles = {}, userId = null }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)

  const role = useWorkspaceRole(task.workspace_id, userId)
  const isPersonal = !task.workspace_id
  // Personal board: always can delete own tasks. Workspace: check role.
  const showDelete = isPersonal ? task.user_id === userId : canDeleteTask(role)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const style = transform ? {
    transform: `translate(${transform.x}px, ${transform.y}px)`,
  } : undefined

  const handleDelete = async () => {
    await supabase.from('tasks').delete().eq('id', task.id)
    onDeleted()
  }

  const getDueDateInfo = () => {
    if (!task.due_date) return null
    const [y, m, d] = task.due_date.split('-').map(Number)
    const due = new Date(y, m - 1, d)
    const today = new Date(new Date().setHours(0, 0, 0, 0))
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (due < today) return { label: `Overdue ${Math.abs(diffDays)}d`, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' }
    if (due.getTime() === today.getTime()) return { label: 'Due today', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
    if (due.getTime() === tomorrow.getTime()) return { label: 'Due tomorrow', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)' }
    if (diffDays <= 7) return { label: `Due in ${diffDays}d`, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
    return { label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' }
  }

  const priorityColors = { low: '#64748b', normal: '#8b5cf6', high: '#ef4444' }
  const priorityColor = priorityColors[task.priority]
  const dueDateInfo = getDueDateInfo()
  const isDone = task.status === 'done'

  return (
    <>
      <motion.div
        ref={setNodeRef}
        style={{
          ...style,
          opacity: isDragging ? 0.4 : 1,
          position: 'relative',
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderLeft: `2px solid ${priorityColor}`,
          padding: '12px',
          cursor: 'pointer',
          overflow: 'hidden',
          transition: 'border-color 0.2s, background 0.2s',
        }}
        whileHover={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }}
        layout
      >
        {/* Priority glow */}
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: '40px',
          background: `linear-gradient(to right, ${priorityColor}12, transparent)`,
          pointerEvents: 'none',
        }} />

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
          {/* Drag handle */}
          <div
            {...listeners} {...attributes}
            style={{ color: 'rgba(255,255,255,0.35)', cursor: 'grab', fontSize: '12px', marginTop: '2px', flexShrink: 0, userSelect: 'none' }}
          >
            ⠿
          </div>

          {/* Title */}
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={onOpen}>
            <p style={{
              color: isDone ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.92)',
              fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk',
              margin: 0, lineHeight: 1.4,
              textDecoration: isDone ? 'line-through' : 'none',
              letterSpacing: '-0.01em',
            }}>
              {task.title}
            </p>
          </div>

          {/* Delete button — role gated */}
          {showDelete && (
            <button
              onPointerDown={e => { e.stopPropagation(); setShowConfirm(true) }}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.25)',
                cursor: 'pointer', fontSize: '10px',
                padding: '2px 4px', flexShrink: 0,
                borderRadius: '4px', transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              ✕
            </button>
          )}
        </div>

        {/* Description preview */}
        {task.description && (
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Grotesk',
            margin: '0 0 8px 20px', lineHeight: 1.5, overflow: 'hidden',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
          }}>
            {task.description}
          </p>
        )}

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '20px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '9px', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.08em',
            color: priorityColor, background: `${priorityColor}20`,
            border: `1px solid ${priorityColor}40`, padding: '2px 6px', borderRadius: '4px',
            textTransform: 'uppercase',
          }}>
            {task.priority}
          </span>

          {task.recurring && (
            <span style={{
              fontSize: '9px', fontFamily: 'Space Mono',
              color: task.recurring === 'weekly' ? '#06b6d4' : '#8b5cf6',
              background: task.recurring === 'weekly' ? 'rgba(6,182,212,0.12)' : 'rgba(139,92,246,0.12)',
              border: `1px solid ${task.recurring === 'weekly' ? 'rgba(6,182,212,0.3)' : 'rgba(139,92,246,0.3)'}`,
              padding: '2px 6px', borderRadius: '4px',
            }}>
              ↻ {task.recurring}
            </span>
          )}

          {dueDateInfo && (
            <span style={{
              fontSize: '9px', fontFamily: 'Space Mono',
              color: dueDateInfo.color, background: dueDateInfo.bg,
              border: `1px solid ${dueDateInfo.border}`,
              padding: '2px 6px', borderRadius: '4px',
            }}>
              {dueDateInfo.label}
            </span>
          )}
        </div>

        {/* Last edited by */}
        {task.last_edited_by && profiles[task.last_edited_by] && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            marginLeft: '20px', marginTop: '6px', paddingTop: '6px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}>
            <Avatar
              name={profiles[task.last_edited_by].full_name ?? profiles[task.last_edited_by].email}
              avatarUrl={profiles[task.last_edited_by].avatar_url}
              size={14}
            />
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', fontFamily: 'Space Mono' }}>
              edited by {profiles[task.last_edited_by].full_name?.split(' ')[0] ?? profiles[task.last_edited_by].email?.split('@')[0]}
            </span>
          </div>
        )}
      </motion.div>

      {showConfirm && (
        <ConfirmDialog
          title="Delete Task?"
          message={`Are you sure you want to delete "${task.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          danger={true}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}

export default TaskCard