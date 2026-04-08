import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Task, Comment, Status } from '../types'
import { COLUMNS } from '../types'

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
    await supabase
      .from('tasks')
      .update({ title, description, status, priority })
      .eq('id', task.id)
    setSaving(false)
    setEditingTitle(false)
    onUpdated()
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }


  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="absolute right-0 top-0 bottom-0 w-full max-w-lg glass border-l border-white/10 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <span className="text-slate-500 text-sm">Task Details</span>
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-slate-400 transition-colors text-lg"
            >
              ✕
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Title */}
            <div>
              {editingTitle ? (
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  className="w-full bg-white/5 border border-indigo-500/50 rounded-xl px-3 py-2 text-white text-xl font-semibold outline-none"
                />
              ) : (
                <h2
                  onClick={() => setEditingTitle(true)}
                  className="text-white text-xl font-semibold cursor-pointer hover:text-indigo-300 transition-colors"
                  title="Click to edit"
                >
                  {title}
                </h2>
              )}
            </div>

            {/* Status + Priority row */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as Status)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none"
                >
                  {COLUMNS.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'low' | 'normal' | 'high')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Add a description..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/50 resize-none transition-colors"
              />
            </div>

            {/* Save button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </motion.button>

            {/* Comments */}
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-3">
                Comments ({comments.length})
              </label>

              {/* Comment list */}
              <div className="space-y-3 mb-4">
                {comments.length === 0 ? (
                  <p className="text-slate-700 text-sm text-center py-4">No comments yet</p>
                ) : (
                  comments.map(comment => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/3 border border-white/5 rounded-xl p-3 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-slate-300 text-sm flex-1">{comment.content}</p>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-slate-700 hover:text-red-400 transition-colors text-xs opacity-0 group-hover:opacity-100"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-slate-600 text-xs mt-1">{formatTime(comment.created_at)}</p>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Add comment */}
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleAddComment}
                  disabled={submitting || !newComment.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl px-4 py-2 text-sm font-medium transition-all"
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