import { useEffect, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { supabase } from './supabase'
import type { Task, Status, Workspace, Profile } from './types'
import { COLUMNS } from './types'
import Column from './components/Column'
import CreateTaskModal from './components/CreateTaskModal'
import TaskCard from './components/TaskCard'
import TaskDetailPanel from './components/TaskDetailPanel'
import CalendarView from './components/CalendarView'
import WorkspacePanel from './components/WorkspacePanel'
import Avatar from './components/Avatar'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

function App() {
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo')
  const [view, setView] = useState<'board' | 'calendar'>('board')
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const navigate = useNavigate()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        fetchProfile(session.user.id)
      } else {
        navigate('/auth')
      }
    }
    checkAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUserId(session.user.id)
        fetchProfile(session.user.id)
      } else {
        navigate('/auth')
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()
    if (data) setProfile(data)
  }

  const fetchProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return
    const unique = [...new Set(userIds)]
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('id', unique)
    if (data) {
      const map: Record<string, Profile> = {}
      data.forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
  }

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
      if (error) console.error('Fetch error:', error)
      else {
        setTasks(data ?? [])
        // fetch profiles for all editors
        const editorIds = (data ?? [])
          .filter(t => t.last_edited_by)
          .map(t => t.last_edited_by as string)
        const creatorIds = (data ?? []).map(t => t.user_id)
        fetchProfiles([...editorIds, ...creatorIds])
      }
      setLoading(false)
    }

    fetchTasks()

    const channelName = currentWorkspace
      ? `workspace-${currentWorkspace.id}`
      : `personal-${userId}`

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
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
      })
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
    if (data) {
      const editorIds = data.filter(t => t.last_edited_by).map(t => t.last_edited_by as string)
      fetchProfiles(editorIds)
    }
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
      .update({
        status: newStatus,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      })
      .eq('id', taskId)
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
    return new Date(y, m - 1, d) < new Date(new Date().setHours(0, 0, 0, 0))
  }).length

  return (
    <div style={{ minHeight: '100vh', background: '#000', overflowX: 'hidden', fontFamily: 'Space Grotesk, sans-serif' }}>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-240px', left: '-240px',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-240px', right: '-240px',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
        }} />
      </div>

      {/* HEADER */}
      <div style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{
          maxWidth: '1400px', margin: '0 auto',
          padding: isMobile ? '12px 16px' : '16px 32px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px',
        }}>

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}
          >
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 800, color: 'white',
            }}>N</div>
            <div>
              <h1 style={{
                color: 'white', fontWeight: 800,
                fontSize: isMobile ? '15px' : '17px',
                letterSpacing: '-0.02em', margin: 0, lineHeight: 1,
              }}>
                NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
              </h1>
              {!isMobile && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.2em', margin: 0 }}>
                  AI-POWERED BOARD
                </p>
              )}
            </div>
          </motion.div>

          {/* Workspace switcher */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowWorkspacePanel(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', padding: '7px 12px',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '4px',
              background: currentWorkspace ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, color: 'white',
            }}>
              {currentWorkspace ? currentWorkspace.name.charAt(0).toUpperCase() : '👤'}
            </div>
            <span style={{
              color: 'rgba(255,255,255,0.6)', fontSize: '12px',
              fontFamily: 'Space Grotesk', fontWeight: 600,
              maxWidth: isMobile ? '70px' : '120px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentWorkspace ? currentWorkspace.name : 'Personal'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>⌄</span>
          </motion.button>

          {/* Stats — desktop only */}
          {!isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {[
                { label: 'TOTAL', value: total, color: '#8b5cf6' },
                { label: 'DONE', value: completed, color: '#10b981' },
                { label: 'OVERDUE', value: overdue, color: '#ef4444' },
              ].map((stat, i) => (
                <div key={stat.label} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {i > 0 && <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.08)', marginRight: '6px' }} />}
                  <span style={{ color: stat.color, fontWeight: 700, fontSize: '16px', fontFamily: 'Space Mono' }}>
                    {String(stat.value).padStart(2, '0')}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>
                    {stat.label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Right actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
          >
            {!isMobile && (
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>⌕</span>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', paddingLeft: '30px',
                    paddingRight: '14px', paddingTop: '8px', paddingBottom: '8px',
                    color: 'rgba(255,255,255,0.7)', fontSize: '13px',
                    fontFamily: 'Space Grotesk', outline: 'none', width: '180px',
                  }}
                />
              </div>
            )}

            {/* New Task */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleAddTask('todo')}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                border: 'none', borderRadius: '8px',
                padding: isMobile ? '8px 12px' : '8px 18px',
                color: 'white', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700,
                boxShadow: '0 0 20px rgba(139,92,246,0.4)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
              {!isMobile && 'New Task'}
            </motion.button>

            {/* Profile avatar + dropdown */}
            <div style={{ position: 'relative' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowProfileMenu(p => !p)}
                style={{
                  background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
              >
                <Avatar
                  name={profile?.full_name ?? profile?.email ?? 'User'}
                  avatarUrl={profile?.avatar_url}
                  size={34}
                  showTooltip
                />
                {!isMobile && (
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ color: 'white', fontSize: '12px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1.2 }}>
                      {profile?.full_name?.split(' ')[0] ?? 'User'}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', margin: 0 }}>
                      {profile?.email?.split('@')[0] ?? ''}
                    </p>
                  </div>
                )}
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>⌄</span>
              </motion.button>

              {/* Profile dropdown */}
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute', top: '44px', right: 0,
                      background: '#0a0a0a',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px', padding: '8px',
                      minWidth: '200px',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                      zIndex: 100,
                    }}
                  >
                    {/* Profile info */}
                    <div style={{
                      padding: '10px 12px', marginBottom: '4px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Avatar
                          name={profile?.full_name ?? profile?.email ?? 'User'}
                          avatarUrl={profile?.avatar_url}
                          size={36}
                        />
                        <div>
                          <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, fontFamily: 'Space Grotesk', margin: 0 }}>
                            {profile?.full_name ?? 'User'}
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0 }}>
                            {profile?.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Menu items */}
                    {[
                      { icon: '⊞', label: 'My Board', action: () => { setCurrentWorkspace(null); setShowProfileMenu(false) } },
                      { icon: '👥', label: 'Workspaces', action: () => { setShowWorkspacePanel(true); setShowProfileMenu(false) } },
                    ].map(item => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        style={{
                          width: '100%', padding: '9px 12px',
                          background: 'transparent',
                          border: 'none', borderRadius: '8px',
                          color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                          fontSize: '13px', fontFamily: 'Space Grotesk',
                          display: 'flex', alignItems: 'center', gap: '10px',
                          textAlign: 'left', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                          e.currentTarget.style.color = 'white'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
                        }}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%', padding: '9px 12px',
                        background: 'transparent',
                        border: 'none', borderRadius: '8px',
                        color: 'rgba(239,68,68,0.7)', cursor: 'pointer',
                        fontSize: '13px', fontFamily: 'Space Grotesk',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        textAlign: 'left', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
                        e.currentTarget.style.color = '#ef4444'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.color = 'rgba(239,68,68,0.7)'
                      }}
                    >
                      <span>↩</span>
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Mobile search */}
        {isMobile && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>⌕</span>
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px', paddingLeft: '30px',
                  paddingRight: '14px', paddingTop: '8px', paddingBottom: '8px',
                  color: 'rgba(255,255,255,0.7)', fontSize: '13px',
                  fontFamily: 'Space Grotesk', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close profile menu */}
      {showProfileMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9 }}
          onClick={() => setShowProfileMenu(false)}
        />
      )}

      {/* MAIN CONTENT */}
      <div style={{
        position: 'relative', zIndex: 10,
        maxWidth: '1400px', margin: '0 auto',
        padding: isMobile ? '16px' : '28px 32px',
      }}>
        {/* View toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
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
                  padding: '6px 14px', borderRadius: '7px', border: 'none',
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

          {/* Mobile stats */}
          {isMobile && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { value: total, color: '#8b5cf6', label: 'total' },
                { value: completed, color: '#10b981', label: 'done' },
                { value: overdue, color: '#ef4444', label: 'late' },
              ].map(s => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px', padding: '4px 8px',
                }}>
                  <span style={{ color: s.color, fontSize: '13px', fontWeight: 700, fontFamily: 'Space Mono' }}>{s.value}</span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Space Mono' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />

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

          {!isMobile && (
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'Space Mono' }}>
              {total} tasks
            </span>
          )}
        </div>

        {/* Board or Calendar */}
        {loading ? (
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{
                width: 'min(300px, 85vw)', minWidth: 'min(300px, 85vw)',
                height: '400px', borderRadius: '16px', flexShrink: 0,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }} />
            ))}
          </div>
        ) : view === 'board' ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{
              display: 'flex', gap: '16px',
              overflowX: 'auto', paddingBottom: '16px',
              WebkitOverflowScrolling: 'touch',
              scrollSnapType: 'x mandatory',
            }}>
              {COLUMNS.map((column, i) => (
                <motion.div
                  key={column.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  style={{ scrollSnapAlign: 'start' }}
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
                    profiles={profiles}
                  />
                </motion.div>
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div style={{ transform: 'rotate(2deg) scale(1.05)' }}>
                  <TaskCard task={activeTask} onDeleted={() => {}} onOpen={() => {}} profiles={profiles} />
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
          profiles={profiles}
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