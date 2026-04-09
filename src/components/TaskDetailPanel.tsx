import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Task, Comment, Status } from '../types'
// COLUMNS removed - not needed
import { breakIntoSubtasks } from '../lib/ai'
import toast from 'react-hot-toast'

interface Props {
  task: Task
  onClose: () => void
  onUpdated: () => void
  userId: string
}

function TaskDetailPanel({ task, onClose, onUpdated, userId }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [status, setStatus] = useState<Status>(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [saving, setSaving] = useState(false)
  const [subtasks, setSubtasks] = useState<string[]>([])
  const [generatingSubtasks, setGeneratingSubtasks] = useState(false)

  useEffect(() => {
    fetchComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  const handleSave = async () => {
    setSaving(true)
    const wasNotDone = task.status !== 'done'
    const isNowDone = status === 'done'
    const isRecurring = task.recurring

    const { error } = await supabase
      .from('tasks')
      .update({ title, description, status, priority })
      .eq('id', task.id)

    if (!error && wasNotDone && isNowDone && isRecurring && task.due_date) {
      const currentDue = new Date(task.due_date)
      const nextDue = new Date(currentDue)
      if (task.recurring === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
      else if (task.recurring === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1)

      await supabase.from('tasks').insert({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: 'todo',
        due_date: nextDue.toISOString().split('T')[0],
        recurring: task.recurring,
        user_id: task.user_id,
      })
      toast.success(`↻ Next ${task.recurring} task created!`)
    }

    setSaving(false)
    setEditingTitle(false)
    if (error) {
      toast.error('Failed to save changes')
    } else {
      toast.success('Changes saved!')
      onUpdated()
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    await supabase.from('comments').insert({
      task_id: task.id,
      user_id: userId,
      content: newComment.trim(),
    })
    setNewComment('')
    await fetchComments()
    setSubmitting(false)
  }

  const handleDeleteComment = async (id: string) => {
    await supabase.from('comments').delete().eq('id', id)
    await fetchComments()
  }

  const handleBreakIntoSubtasks = async () => {
    setGeneratingSubtasks(true)
    try {
      const result = await breakIntoSubtasks(title, description)
      setSubtasks(result)
      toast.success('Subtasks generated!')
    } catch {
      toast.error('Failed to generate subtasks')
    }
    setGeneratingSubtasks(false)
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const statusOptions = [
    { value: 'todo', label: 'To Do', color: '#94a3b8' },
    { value: 'in_progress', label: 'In Progress', color: '#8b5cf6' },
    { value: 'in_review', label: 'In Review', color: '#f59e0b' },
    { value: 'done', label: 'Done', color: '#10b981' },
  ]

  const priorityOptions = [
    { value: 'low', label: 'Low', color: '#64748b' },
    { value: 'normal', label: 'Normal', color: '#8b5cf6' },
    { value: 'high', label: 'High', color: '#ef4444' },
  ]

  const labelStyle = {
    display: 'block' as const,
    color: 'rgba(255,255,255,0.3)',
    fontSize: '10px',
    fontFamily: 'Space Mono, monospace',
    letterSpacing: '0.2em',
    marginBottom: '8px',
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 50,
        }}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 0, top: 0, bottom: 0,
            width: '100%', maxWidth: '520px',
            background: '#050505',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Top accent */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>
                TASK DETAILS
              </span>
              {task.recurring && (
                <span style={{
                  marginLeft: '8px',
                  fontSize: '9px',
                  fontFamily: 'Space Mono',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: task.recurring === 'weekly' ? '#06b6d4' : '#8b5cf6',
                  background: task.recurring === 'weekly' ? 'rgba(6,182,212,0.1)' : 'rgba(139,92,246,0.1)',
                }}>
                  ↻ {task.recurring.toUpperCase()}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
                width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px',
              }}
            >✕</button>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

            {/* Title */}
            <div style={{ marginBottom: '24px' }}>
              {editingTitle ? (
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #8b5cf6',
                    padding: '4px 0',
                    color: 'white',
                    fontSize: '20px',
                    fontFamily: 'Space Grotesk',
                    fontWeight: 700,
                    outline: 'none',
                    letterSpacing: '-0.02em',
                  }}
                />
              ) : (
                <h2
                  onClick={() => setEditingTitle(true)}
                  style={{
                    color: 'white',
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    cursor: 'pointer',
                    margin: 0,
                    lineHeight: 1.3,
                  }}
                  title="Click to edit"
                >
                  {title}
                </h2>
              )}
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '4px', fontFamily: 'Space Mono' }}>
                Click title to edit
              </p>
            </div>

            {/* Status */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>STATUS</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {statusOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value as Status)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: `1px solid ${status === opt.value ? opt.color + '60' : opt.color + '20'}`,
                      background: status === opt.value ? `${opt.color}15` : `${opt.color}05`,
                      color: status === opt.value ? opt.color : opt.color + '60',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontFamily: 'Space Grotesk',
                      fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>PRIORITY</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {priorityOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(opt.value as 'low' | 'normal' | 'high')}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: `1px solid ${priority === opt.value ? opt.color + '60' : opt.color + '30'}`,
                      background: priority === opt.value ? `${opt.color}15` : `${opt.color}08`,
                      color: priority === opt.value ? opt.color : opt.color + '70',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontFamily: 'Space Grotesk',
                      fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>DESCRIPTION</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Add a description..."
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  padding: '12px',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '13px',
                  fontFamily: 'Space Grotesk',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.6,
                }}
              />
            </div>

            {/* Save button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                background: saving ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontFamily: 'Space Grotesk',
                fontWeight: 700,
                marginBottom: '24px',
                boxShadow: saving ? 'none' : '0 0 20px rgba(139,92,246,0.3)',
              }}
            >
              {saving ? '⟳ Saving...' : 'Save Changes →'}
            </motion.button>

            {/* AI Subtasks */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>AI SUBTASKS</label>
                <button
                  onClick={handleBreakIntoSubtasks}
                  disabled={generatingSubtasks}
                  style={{
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: '6px',
                    color: '#8b5cf6',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontFamily: 'Space Grotesk',
                    padding: '4px 10px',
                  }}
                >
                  {generatingSubtasks ? '⟳ Breaking down...' : '✨ Generate'}
                </button>
              </div>

              {subtasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {subtasks.map((subtask, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        background: 'rgba(139,92,246,0.05)',
                        border: '1px solid rgba(139,92,246,0.1)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                      }}
                    >
                      <span style={{ color: '#8b5cf6', fontSize: '10px', fontFamily: 'Space Mono', marginTop: '2px', flexShrink: 0 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                        {subtask}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <label style={labelStyle}>COMMENTS ({comments.length})</label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {comments.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '12px', textAlign: 'center', padding: '20px 0', fontFamily: 'Space Mono' }}>
                    NO COMMENTS YET
                  </p>
                ) : (
                  comments.map(comment => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        padding: '12px',
                      }}
                      className="group"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: 0, lineHeight: 1.5, flex: 1 }}>
                          {comment.content}
                        </p>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          style={{
                            background: 'none', border: 'none',
                            color: 'rgba(255,255,255,0.15)',
                            cursor: 'pointer', fontSize: '10px',
                            flexShrink: 0,
                          }}
                        >✕</button>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', margin: '6px 0 0', fontFamily: 'Space Mono' }}>
                        {formatTime(comment.created_at)}
                      </p>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Add comment */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: '13px',
                    fontFamily: 'Space Grotesk',
                    outline: 'none',
                  }}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddComment}
                  disabled={submitting || !newComment.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontFamily: 'Space Grotesk',
                    fontWeight: 700,
                    opacity: !newComment.trim() ? 0.4 : 1,
                  }}
                >
                  {submitting ? '...' : 'Send'}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default TaskDetailPanel