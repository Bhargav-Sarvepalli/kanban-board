import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Status } from '../types'
import { generateTaskDescription, suggestPriority } from '../lib/ai'
import toast from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  onClose: () => void
  onTaskCreated: () => void
  userId: string
  defaultStatus?: Status
  workspaceId?: string
}

const priorityOptions = [
  { value: 'low', label: 'Low', color: '#64748b', glow: 'rgba(100,116,139,0.3)' },
  { value: 'normal', label: 'Normal', color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  { value: 'high', label: 'High', color: '#ef4444', glow: 'rgba(239,68,68,0.3)' },
]

const statusOptions = [
  { value: 'todo', label: 'To Do', color: '#94a3b8' },
  { value: 'in_progress', label: 'In Progress', color: '#8b5cf6' },
  { value: 'in_review', label: 'In Review', color: '#f59e0b' },
  { value: 'done', label: 'Done', color: '#10b981' },
]

const recurringOptions = [
  { value: null, label: 'One-time', icon: '○', color: 'rgba(255,255,255,0.4)' },
  { value: 'weekly', label: 'Weekly', icon: '↻', color: '#06b6d4' },
  { value: 'monthly', label: 'Monthly', icon: '↻', color: '#8b5cf6' },
]

function CreateTaskModal({ onClose, onTaskCreated, userId, defaultStatus, workspaceId }: Props) {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<Status>(defaultStatus ?? 'todo')
  const [recurring, setRecurring] = useState<'weekly' | 'monthly' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [suggestingPriority, setSuggestingPriority] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClose = () => {
    if (title.trim() || description.trim()) {
      setShowConfirm(true)
    } else {
      onClose()
    }
  }

  const handleGenerateDescription = async () => {
    if (!title.trim()) return
    setGeneratingDesc(true)
    try {
      const desc = await generateTaskDescription(title)
      setDescription(desc)
      toast.success('Description generated!')
    } catch {
      toast.error('AI generation failed')
    }
    setGeneratingDesc(false)
  }

  const handleSuggestPriority = async () => {
    if (!title.trim()) return
    setSuggestingPriority(true)
    try {
      const suggested = await suggestPriority(title)
      setPriority(suggested)
      toast.success(`Priority → ${suggested}`)
    } catch {
      toast.error('AI suggestion failed')
    }
    setSuggestingPriority(false)
  }

  const handleSubmit = async () => {
    if (!title.trim()) return
    setLoading(true)
    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
      recurring,
      user_id: userId,
      workspace_id: workspaceId ?? null,
    })
    if (error) {
      toast.error('Failed to create task')
    } else {
      toast.success('Task created! 🚀')
      onTaskCreated()
      onClose()
    }
    setLoading(false)
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: '#050505',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '20px',
              width: '100%', maxWidth: '480px',
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.9), 0 0 60px rgba(139,92,246,0.08)',
            }}
          >
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

            <div style={{ padding: '28px' }}>
              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {[1, 2].map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: step >= s ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${step >= s ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700,
                        color: step >= s ? 'white' : 'rgba(255,255,255,0.2)',
                        fontFamily: 'Space Mono', transition: 'all 0.3s',
                      }}>
                        {s}
                      </div>
                      {s === 1 && (
                        <div style={{
                          width: '32px', height: '1px',
                          background: step >= 2 ? 'linear-gradient(90deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.08)',
                          transition: 'all 0.3s',
                        }} />
                      )}
                    </div>
                  ))}
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'Space Mono', marginLeft: '4px' }}>
                    {step === 1 ? 'DETAILS' : 'OPTIONS'}
                  </span>
                </div>
                <button onClick={handleClose} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', color: 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', width: '28px', height: '28px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px',
                }}>✕</button>
              </div>

              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div style={{ marginBottom: '24px' }}>
                      <input
                        autoFocus
                        value={title}
                        onChange={e => { setTitle(e.target.value); setError('') }}
                        onKeyDown={e => e.key === 'Enter' && title.trim() && setStep(2)}
                        placeholder="What needs to be done?"
                        style={{
                          width: '100%', background: 'transparent',
                          border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)',
                          padding: '8px 0', color: 'white', fontSize: '20px',
                          fontFamily: 'Space Grotesk', fontWeight: 600,
                          outline: 'none', letterSpacing: '-0.02em',
                        }}
                        onFocus={e => e.target.style.borderBottomColor = '#8b5cf6'}
                        onBlur={e => e.target.style.borderBottomColor = 'rgba(255,255,255,0.1)'}
                      />
                      <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'Space Mono', marginTop: '6px' }}>
                        PRESS ENTER TO CONTINUE
                      </p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>
                          DESCRIPTION
                        </span>
                        <button
                          onClick={handleGenerateDescription}
                          disabled={generatingDesc || !title.trim()}
                          style={{
                            background: 'rgba(139,92,246,0.08)',
                            border: '1px solid rgba(139,92,246,0.15)',
                            borderRadius: '6px', color: '#8b5cf6',
                            cursor: 'pointer', fontSize: '11px',
                            fontFamily: 'Space Grotesk', padding: '4px 12px',
                            opacity: !title.trim() ? 0.3 : 1,
                          }}
                        >
                          {generatingDesc ? '⟳ Writing...' : '✨ AI Write'}
                        </button>
                      </div>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe what needs to happen..."
                        rows={4}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '12px', padding: '14px',
                          color: 'rgba(255,255,255,0.7)', fontSize: '13px',
                          fontFamily: 'Space Grotesk', outline: 'none',
                          resize: 'none', lineHeight: 1.7,
                        }}
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        if (!title.trim()) { setError('Please enter a title first'); return }
                        setError('')
                        setStep(2)
                      }}
                      style={{
                        width: '100%',
                        background: title.trim() ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.05)',
                        border: 'none', borderRadius: '12px', padding: '14px',
                        color: title.trim() ? 'white' : 'rgba(255,255,255,0.2)',
                        cursor: title.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700,
                        boxShadow: title.trim() ? '0 0 25px rgba(139,92,246,0.3)' : 'none',
                        transition: 'all 0.2s',
                      }}
                    >
                      Continue →
                    </motion.button>

                    {error && (
                      <p style={{ color: '#ef4444', fontSize: '12px', textAlign: 'center', marginTop: '8px', fontFamily: 'Space Grotesk' }}>
                        ⚠ {error}
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Priority */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>
                          PRIORITY
                        </span>
                        <button
                          onClick={handleSuggestPriority}
                          disabled={suggestingPriority}
                          style={{
                            background: 'none', border: 'none',
                            color: 'rgba(139,92,246,0.7)', cursor: 'pointer',
                            fontSize: '11px', fontFamily: 'Space Grotesk',
                          }}
                        >
                          {suggestingPriority ? '⟳' : '🤖 AI Suggest'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {priorityOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setPriority(opt.value as 'low' | 'normal' | 'high')}
                            style={{
                              flex: 1, padding: '12px 8px', borderRadius: '12px',
                              border: `1px solid ${priority === opt.value ? opt.color : opt.color + '35'}`,
                              background: priority === opt.value ? `${opt.color}18` : `${opt.color}06`,
                              color: priority === opt.value ? opt.color : opt.color + '80',
                              cursor: 'pointer', fontSize: '12px',
                              fontFamily: 'Space Grotesk',
                              fontWeight: priority === opt.value ? 700 : 500,
                              transition: 'all 0.15s',
                              boxShadow: priority === opt.value ? `0 0 15px ${opt.glow}` : 'none',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Column */}
                    <div style={{ marginBottom: '20px' }}>
                      <span style={{ display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginBottom: '10px' }}>
                        COLUMN
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {statusOptions.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setStatus(opt.value as Status)}
                            style={{
                              padding: '10px 12px', borderRadius: '10px',
                              border: `1px solid ${status === opt.value ? opt.color + '60' : opt.color + '20'}`,
                              background: status === opt.value ? `${opt.color}12` : `${opt.color}05`,
                              color: status === opt.value ? opt.color : opt.color + '60',
                              cursor: 'pointer', fontSize: '12px',
                              fontFamily: 'Space Grotesk',
                              fontWeight: status === opt.value ? 600 : 400,
                              textAlign: 'left', transition: 'all 0.15s',
                              display: 'flex', alignItems: 'center', gap: '8px',
                            }}
                          >
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              background: opt.color,
                              boxShadow: status === opt.value ? `0 0 6px ${opt.color}` : 'none',
                              flexShrink: 0,
                            }} />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Due Date + Repeat */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                      <div>
                        <span style={{ display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginBottom: '10px' }}>
                          DUE DATE
                        </span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '10px', padding: '10px 12px',
                            color: 'rgba(255,255,255,0.6)', fontSize: '12px',
                            fontFamily: 'Space Grotesk', outline: 'none',
                            colorScheme: 'dark',
                          }}
                        />
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginBottom: '10px' }}>
                          REPEAT
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {recurringOptions.map(opt => (
                            <button
                              key={opt.value ?? 'none'}
                              onClick={() => setRecurring(opt.value as 'weekly' | 'monthly' | null)}
                              style={{
                                padding: '7px 10px', borderRadius: '8px',
                                border: `1px solid ${recurring === opt.value ? opt.color + '50' : 'rgba(255,255,255,0.06)'}`,
                                background: recurring === opt.value ? `${opt.color}12` : 'transparent',
                                color: recurring === opt.value ? opt.color : 'rgba(255,255,255,0.3)',
                                cursor: 'pointer', fontSize: '11px',
                                fontFamily: 'Space Grotesk', textAlign: 'left',
                                transition: 'all 0.15s',
                                display: 'flex', alignItems: 'center', gap: '6px',
                              }}
                            >
                              <span style={{ fontSize: '12px', color: opt.color }}>{opt.icon}</span>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setStep(1)}
                        style={{
                          flex: 1, background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '12px', padding: '13px',
                          color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                          fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600,
                        }}
                      >
                        ← Back
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSubmit}
                        disabled={loading}
                        style={{
                          flex: 2,
                          background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                          border: 'none', borderRadius: '12px', padding: '13px',
                          color: 'white', cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700,
                          boxShadow: loading ? 'none' : '0 0 25px rgba(139,92,246,0.35)',
                        }}
                      >
                        {loading ? '⟳ Creating...' : 'Create Task →'}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {showConfirm && (
        <ConfirmDialog
          title="Discard Task?"
          message="You have unsaved changes. Are you sure you want to discard this task?"
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          danger={true}
          onConfirm={onClose}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}

export default CreateTaskModal