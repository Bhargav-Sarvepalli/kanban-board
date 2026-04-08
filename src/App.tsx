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
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
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
    setTasks(prev =>
      prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    )
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
    if (error) {
      console.error('Update error:', error)
      refetchTasks()
    }
  }

  const total = tasks.length
  const completed = tasks.filter(t => t.status === 'done').length
  const overdue = tasks.filter(t => {
    if (!t.due_date) return false
    return new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0))
  }).length

  return (
    <div className="min-h-screen bg-[#020208] relative overflow-hidden">

      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-purple-600/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>

      {/* Grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Nex<span className="text-indigo-400">Task</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {tasks.length} tasks · {completed} completed
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-indigo-500/25"
          >
            <span className="text-lg leading-none">+</span>
            New Task
          </motion.button>
        </motion.div>

        {/* Search + Stats */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-4 mb-8 flex-wrap"
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="glass pl-9 pr-4 py-2.5 rounded-xl text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500/50 w-64 transition-colors"
            />
          </div>
          <div className="flex gap-3">
            {[
              { label: 'Total', value: total, color: 'text-indigo-400' },
              { label: 'Done', value: completed, color: 'text-emerald-400' },
              { label: 'Overdue', value: overdue, color: 'text-red-400' },
            ].map(stat => (
              <div key={stat.label} className="glass px-4 py-2 rounded-xl flex items-center gap-2">
                <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
                <span className="text-slate-500 text-xs">{stat.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Board */}
        {loading ? (
          <div className="flex gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="glass rounded-2xl w-72 h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map((column, i) => (
                <motion.div
                  key={column.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
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
                <div className="rotate-2 opacity-90">
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