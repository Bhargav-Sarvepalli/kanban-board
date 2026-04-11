import { useEffect, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { supabase } from './supabase'
import type { Task, Status, Workspace } from './types'
import { COLUMNS } from './types'
import Column from './components/Column'
import CreateTaskModal from './components/CreateTaskModal'
import TaskCard from './components/TaskCard'
import TaskDetailPanel from './components/TaskDetailPanel'
import CalendarView from './components/CalendarView'
import WorkspacePanel from './components/WorkspacePanel'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo')
  const [view, setView] = useState<'board' | 'calendar'>('board')
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const navigate = useNavigate()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setUserId(session.user.id)
      else navigate('/auth')
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setUserId(session.user.id)
      else navigate('/auth')
    })

    return () => subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (!userId) return

    const fetchTasks = async () => {
      setLoading(true)
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true })

      if (currentWorkspace) {
        query = query.eq('workspace_id', currentWorkspace.id)
      } else {
        query = query.is('workspace_id', null).eq('user_id', userId)
      }

      const { data, error } = await query
      console.log('Tasks fetched:', data, 'Error:', error)
      if (error) console.error('Fetch error:', error)
      else setTasks(data ?? [])
      setLoading(false)
    }

    fetchTasks()

    // Realtime
    const channelName = currentWorkspace
      ? `workspace-${currentWorkspace.id}`
      : `personal-${userId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task
            const belongs = currentWorkspace
              ? newTask.workspace_id === currentWorkspace.id
              : !newTask.workspace_id && newTask.user_id === userId
            if (belongs) setTasks(prev => [...prev, newTask])
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t =>
              t.id === (payload.new as Task).id ? payload.new as Task : t
            ))
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== (payload.old as Task).id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, currentWorkspace])

  const refetchTasks = async () => {
    if (!userId) return
    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })

    if (currentWorkspace) {
      query = query.eq('workspace_id', currentWorkspace.id)
    } else {
      query = query.is('workspace_id', null).eq('user_id', userId)
    }

    const { data } = await query
    setTasks(data ?? [])
  }

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return
    const taskId = active.id as string
    const newStatus = over.id as Status
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (error) { console.error('Update error:', error); refetchTasks() }
  }

  const handleAddTask = (status: Status) => {
    setDefaultStatus(status)
    setShowModal(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const total = tasks.length
  const completed = tasks.filter(t => t.status === 'done').length
  const overdue = tasks.filter(t => {
    if (!t.due_date) return false
    const [y, m, d] = t.due_date.split('-').map(Number)
    const due = new Date(y, m - 1, d)
    return due < new Date(new Date().setHours(0, 0, 0, 0))
  }).length

  return (
    <div className="min-h-screen bg-black relative overflow-hidden font-sans">

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-60 -left-60 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)',
            backgroundSize: '100% 6px',
          }} />
      </div>

      {/* HEADER */}
      <div className="relative z-10 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center justify-between">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
              <span className="text-white text-sm font-bold">N</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight leading-none">
                NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
              </h1>
              <p className="text-white/20 text-[10px] font-mono tracking-[0.2em] uppercase">
                AI-Powered Board
              </p>
            </div>
          </motion.div>

          {/* Workspace switcher */}
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowWorkspacePanel(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: '20px', height: '20px', borderRadius: '5px',
              background: currentWorkspace
                ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, color: 'white',
            }}>
              {currentWorkspace ? currentWorkspace.name.charAt(0).toUpperCase() : '👤'}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
              {currentWorkspace ? currentWorkspace.name : 'Personal'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>⌄</span>
          </motion.button>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-1"
          >
            {[
              { label: 'TOTAL', value: total, color: '#8b5cf6' },
              { label: 'DONE', value: completed, color: '#10b981' },
              { label: 'OVERDUE', value: overdue, color: '#ef4444' },
            ].map((stat, i) => (
              <div key={stat.label} className="px-4 py-2 flex items-center gap-2">
                {i > 0 && <div className="w-px h-4 bg-white/10 mr-2" />}
                <span className="font-bold text-lg" style={{ color: stat.color, fontFamily: 'Space Mono' }}>
                  {String(stat.value).padStart(2, '0')}
                </span>
                <span className="text-white/30 text-[10px] font-mono tracking-widest">{stat.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Right */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">⌕</span>
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-2 text-sm text-white/70 placeholder-white/20 outline-none focus:border-violet-500/50 w-48 transition-all font-sans"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLogout}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', padding: '8px 16px',
                color: 'rgba(255,255,255,0.35)',
                cursor: 'pointer', fontSize: '12px',
                fontFamily: 'Space Grotesk', fontWeight: 600,
              }}
            >
              Sign Out
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleAddTask('todo')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                boxShadow: '0 0 20px rgba(139,92,246,0.4)',
              }}
            >
              <span>+</span>
              New Task
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-8 py-8">

        {/* View toggle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 mb-6"
        >
          <div style={{
            display: 'flex', gap: '4px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '10px', padding: '4px',
          }}>
            {[
              { id: 'board', label: '⊞ Board' },
              { id: 'calendar', label: '⊟ Calendar' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id as 'board' | 'calendar')}
                style={{
                  padding: '6px 16px', borderRadius: '7px', border: 'none',
                  background: view === v.id ? 'rgba(139,92,246,0.2)' : 'transparent',
                  color: view === v.id ? '#8b5cf6' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', fontSize: '12px',
                  fontFamily: 'Space Grotesk',
                  fontWeight: view === v.id ? 600 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex-1 h-px bg-white/5" />

          {/* Workspace badge */}
          {currentWorkspace && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '8px', padding: '4px 10px',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 6px #8b5cf6' }} />
              <span style={{ color: '#8b5cf6', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                {currentWorkspace.name}
              </span>
            </div>
          )}

          <span className="text-white/20 text-xs font-mono">{total} tasks</span>
        </motion.div>

        {/* Board or Calendar */}
        {loading ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-2xl w-72 h-96 animate-pulse"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
            ))}
          </div>
        ) : view === 'board' ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-5 overflow-x-auto pb-4">
              {COLUMNS.map((column, i) => (
                <motion.div
                  key={column.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <Column
                    id={column.id}
                    label={column.label}
                    tasks={tasks
                      .filter(t => t.status === column.id)
                      .filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
                    }
                    onDeleted={refetchTasks}
                    onOpen={setSelectedTask}
                    onAddTask={handleAddTask}
                  />
                </motion.div>
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div className="rotate-1 scale-105">
                  <TaskCard task={activeTask} onDeleted={() => {}} onOpen={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <CalendarView tasks={tasks} onOpenTask={setSelectedTask} />
          </motion.div>
        )}
      </div>

      {/* Modals */}
      {showModal && userId && (
        <CreateTaskModal
          userId={userId}
          onClose={() => setShowModal(false)}
          onTaskCreated={refetchTasks}
          defaultStatus={defaultStatus}
          workspaceId={currentWorkspace?.id}
        />
      )}

      {selectedTask && userId && (
        <TaskDetailPanel
          task={selectedTask}
          userId={userId}
          onClose={() => setSelectedTask(null)}
          onUpdated={() => { refetchTasks(); setSelectedTask(null) }}
        />
      )}

      <AnimatePresence>
        {showWorkspacePanel && userId && (
          <WorkspacePanel
            userId={userId}
            currentWorkspace={currentWorkspace}
            onWorkspaceChange={setCurrentWorkspace}
            onClose={() => setShowWorkspacePanel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App