import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Status } from '../types'
import { generateTaskDescription, suggestPriority } from '../lib/ai'

interface Props {
  onClose: () => void
  onTaskCreated: () => void
  userId: string
}

function CreateTaskModal({ onClose, onTaskCreated, userId }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<Status>('todo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [suggestingPriority, setSuggestingPriority] = useState(false)

  const handleGenerateDescription = async () => {
    if (!title.trim()) {
      setError('Enter a title first')
      return
    }
    setGeneratingDesc(true)
    setError('')
    try {
      const desc = await generateTaskDescription(title)
      setDescription(desc)
    } catch (e) {
      setError('AI generation failed. Try again.')
    }
    setGeneratingDesc(false)
  }

  const handleSuggestPriority = async () => {
    if (!title.trim()) {
      setError('Enter a title first')
      return
    }
    setSuggestingPriority(true)
    setError('')
    try {
      const suggested = await suggestPriority(title)
      setPriority(suggested)
    } catch (e) {
      setError('AI suggestion failed. Try again.')
    }
    setSuggestingPriority(false)
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
      user_id: userId,
    })
    if (error) {
      setError('Failed to create task. Please try again.')
      console.error(error)
    } else {
      onTaskCreated()
      onClose()
    }
    setLoading(false)
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-all"
  const labelClass = "block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider"

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          onClick={e => e.stopPropagation()}
          className="glass rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/40"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">New Task</h2>
            <button onClick={onClose} className="text-slate-600 hover:text-slate-400 transition-colors text-lg">✕</button>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className={labelClass}>Title *</label>
            <input
              className={inputClass}
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description + AI button */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass} style={{ margin: 0 }}>Description</label>
              <button
                onClick={handleGenerateDescription}
                disabled={generatingDesc || !title.trim()}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generatingDesc ? (
                  <>
                    <span className="animate-spin">⟳</span> Generating...
                  </>
                ) : (
                  <>✨ AI Generate</>
                )}
              </button>
            </div>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Add more details... or use AI to generate"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Priority + Status */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass} style={{ margin: 0 }}>Priority</label>
                <button
                  onClick={handleSuggestPriority}
                  disabled={suggestingPriority || !title.trim()}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {suggestingPriority ? (
                    <span className="animate-spin">⟳</span>
                  ) : (
                    <>🤖 AI</>
                  )}
                </button>
              </div>
              <select
                className={inputClass}
                value={priority}
                onChange={e => setPriority(e.target.value as 'low' | 'normal' | 'high')}
              >
                <option value="low">🔵 Low</option>
                <option value="normal">⚪ Normal</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelClass}>Column</label>
              <select
                className={inputClass}
                value={status}
                onChange={e => setStatus(e.target.value as Status)}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Due date */}
          <div className="mb-6">
            <label className={labelClass}>Due Date</label>
            <input
              type="date"
              className={inputClass}
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm mb-4 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/8 border border-white/10 text-slate-400 rounded-xl py-2.5 text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default CreateTaskModal