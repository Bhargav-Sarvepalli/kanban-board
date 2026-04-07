import { useEffect, useState } from 'react'
import { DndContext } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { supabase } from './supabase'
import type { Task, Status } from './types'
import { COLUMNS } from './types'
import Column from './components/Column'
import CreateTaskModal from './components/CreateTaskModal'

function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const signInAnonymously = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
      } else {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) console.error('Auth error:', error)
        else setUserId(data.user?.id ?? null)
      }
    }
    signInAnonymously()
  }, [])

  useEffect(() => {
    if (!userId) return
    const fetchTasks = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) console.error('Fetch error:', error)
      else setTasks(data ?? [])
      setLoading(false)
    }
    fetchTasks()
  }, [userId])

  const refetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })
    setTasks(data ?? [])
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    // If not dropped on a column, do nothing
    if (!over) return

    const taskId = active.id as string
    const newStatus = over.id as Status

    // Find the task being dragged
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return

    // Optimistically update UI immediately
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    )

    // Save to Supabase
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)

    if (error) {
      console.error('Update error:', error)
      // Revert if failed
      refetchTasks()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d0d1a',
      padding: '32px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h1 style={{ color: '#e2e8f0', fontSize: '24px', margin: 0, fontWeight: 700 }}>
              🗂️ Kanban Board
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
              {tasks.length} tasks total
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            + New Task
          </button>
        </div>

        {/* Search bar */}
        <input
          type="text"
          placeholder="🔍 Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#1e1e2e',
            border: '1px solid #2e2e3e',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#e2e8f0',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Stats bar */}
      {(() => {
        const total = tasks.length
        const completed = tasks.filter(t => t.status === 'done').length
        const overdue = tasks.filter(t => {
          if (!t.due_date) return false
          return new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0))
        }).length

        return (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total Tasks', value: total, color: '#6366f1' },
              { label: 'Completed', value: completed, color: '#22c55e' },
              { label: 'Overdue', value: overdue, color: '#ef4444' },
            ].map(stat => (
              <div key={stat.label} style={{
                backgroundColor: '#13131f',
                border: '1px solid #2e2e3e',
                borderRadius: '10px',
                padding: '12px 20px',
                minWidth: '120px',
              }}>
                <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, marginBottom: '4px' }}>
                  {stat.label}
                </p>
                <p style={{ color: stat.color, fontSize: '24px', fontWeight: 700, margin: 0 }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Modal */}
      {showModal && userId && (
        <CreateTaskModal
          userId={userId}
          onClose={() => setShowModal(false)}
          onTaskCreated={refetchTasks}
        />
      )}

      {/* Board */}
      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto' }}>
            {COLUMNS.map(column => (
              <Column
                key={column.id}
                id={column.id}
                label={column.label}
                tasks={tasks
                  .filter(t => t.status === column.id)
                  .filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
                }
                onDeleted={refetchTasks}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  )
}

export default App