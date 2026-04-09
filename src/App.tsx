import { useEffect, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { supabase } from './supabase'
import type { Task, Status } from './types'
import { COLUMNS } from './types'
import Column from './components/Column'
import CreateTaskModal from './components/CreateTaskModal'
import TaskCard from './components/TaskCard'
import TaskDetailPanel from './components/TaskDetailPanel'
import { motion } from 'framer-motion'

function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
    if (error) { console.error('Update error:', error); refetchTasks() }
  }

  const total = tasks.length
  const completed = tasks.filter(t => t.status === 'done').length
  const overdue = tasks.filter(t => {
    if (!t.due_date) return false
    return new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0))
  }).length

  return (
    <div className="min-h-screen bg-black relative overflow-hidden font-sans">

      {/* Dramatic background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Main violet glow — top left */}
        <div className="absolute -top-60 -left-60 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
        {/* Pink glow — bottom right */}
        <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)' }} />
        {/* Cyan glow — middle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.04) 0%, transparent 70%)' }} />

        {/* Horizontal scan lines */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)',
            backgroundSize: '100% 6px'
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

          {/* Center stats */}
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

          {/* Right side */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            {/* Search */}
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

            {/* New task button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
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

      {/* BOARD */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-8 py-8">

        {/* Board label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 mb-6"
        >
          <span className="text-white/20 text-xs font-mono tracking-[0.3em] uppercase">Board View</span>
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-white/20 text-xs font-mono">{total} tasks</span>
        </motion.div>

        {loading ? (
          <div className="flex gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="rounded-2xl w-72 h-96 animate-pulse"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }} />
            ))}
          </div>
        ) : (
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
        )}
      </div>

      {/* Modals */}
      {showModal && userId && (
        <CreateTaskModal
          userId={userId}
          onClose={() => setShowModal(false)}
          onTaskCreated={refetchTasks}
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
    </div>
  )
}

export default App