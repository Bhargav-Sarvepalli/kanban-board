import { useState } from 'react'
import type { Status } from '../types'

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

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }

    setLoading(true)
    setError('')

    const { supabase } = await import('../supabase')

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

  const inputStyle = {
    width: '100%',
    backgroundColor: '#1e1e2e',
    border: '1px solid #2e2e3e',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    color: '#9ca3af',
    fontSize: '13px',
    marginBottom: '6px',
    display: 'block' as const,
  }

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
    >
      {/* Modal box */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#13131f',
          border: '1px solid #2e2e3e',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '480px',
          margin: '0 16px',
        }}
      >
        <h2 style={{ color: '#e2e8f0', fontSize: '18px', marginTop: 0, marginBottom: '24px' }}>
          Create New Task
        </h2>

        {/* Title */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Title *</label>
          <input
            style={inputStyle}
            placeholder="What needs to be done?"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
            placeholder="Add more details..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Priority + Status row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Priority</label>
            <select
              style={inputStyle}
              value={priority}
              onChange={e => setPriority(e.target.value as 'low' | 'normal' | 'high')}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Status</label>
            <select
              style={inputStyle}
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
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Due Date</label>
          <input
            type="date"
            style={inputStyle}
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #2e2e3e',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateTaskModal