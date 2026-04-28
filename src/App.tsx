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
import TodayView from './components/TodayView'
import WorkspacePanel from './components/WorkspacePanel'
import Avatar from './components/Avatar'
import NexAssistant from './components/Nex/NexAssistant'
import NexErrorBoundary from './components/Nex/NexErrorBoundary'
import SettingsModal from './components/SettingsModal'
import OnboardingFlow from './components/OnboardingFlow'
import InviteNotifications from './components/InviteNotifications'
import FlowGraph from './components/Flow/FlowGraph'
import type { FlowBranch } from './hooks/useFlowData'
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
  const [view, setView] = useState<'today' | 'board' | 'calendar' | 'flow'>(() => {
    try {
      const saved = localStorage.getItem('nex_default_view')
      if (saved === 'board' || saved === 'calendar' || saved === 'today' || saved === 'flow') return saved
    } catch (e) { void e }
    return 'today'
  })
  const [showSettings, setShowSettings] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  // Branch filter — set when clicking a branch in Flow view
  const [branchFilter, setBranchFilter] = useState<{ assigneeId: string; name: string } | null>(null)
  const navigate = useNavigate()

  const isPro = true

  const [nexEnabled, setNexEnabled] = useState(() => {
    try { return localStorage.getItem('nex_enabled') !== 'false' }
    catch { return true }
  })

  const toggleNex = () => {
    setNexEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('nex_enabled', String(next)) } catch (e) { void e }
      return next
    })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data)
      if (!data.onboarding_completed) setShowOnboarding(true)
    }
  }

  const fetchProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return
    const unique = [...new Set(userIds)]
    const { data } = await supabase.from('profiles').select('*').in('id', unique)
    if (data) {
      const map: Record<string, Profile> = {}
      data.forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setUserId(session.user.id); fetchProfile(session.user.id) }
      else navigate('/auth')
    }
    checkAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setUserId(session.user.id); fetchProfile(session.user.id) }
      else navigate('/auth')
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (!userId) return
    const fetchTasks = async () => {
      setLoading(true)
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: true })
      if (currentWorkspace) query = query.eq('workspace_id', currentWorkspace.id)
      else query = query.is('workspace_id', null).eq('user_id', userId)
      const { data, error } = await query
      if (error) console.error('Fetch error:', error)
      else {
        setTasks(data ?? [])
        const editorIds = (data ?? []).filter(t => t.last_edited_by).map(t => t.last_edited_by as string)
        const creatorIds = (data ?? []).map(t => t.user_id)
        const assigneeIds = (data ?? []).filter(t => t.assignee_id).map(t => t.assignee_id as string)
        fetchProfiles([...editorIds, ...creatorIds, ...assigneeIds])
      }
      setLoading(false)
    }
    fetchTasks()
    const channelName = currentWorkspace ? `workspace-${currentWorkspace.id}` : `personal-${userId}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newTask = payload.new as Task
          const belongs = currentWorkspace ? newTask.workspace_id === currentWorkspace.id : !newTask.workspace_id && newTask.user_id === userId
          if (belongs) setTasks(prev => [...prev, newTask])
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t))
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as Task).id))
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, currentWorkspace])

  const refetchTasks = async () => {
    if (!userId) return
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: true })
    if (currentWorkspace) query = query.eq('workspace_id', currentWorkspace.id)
    else query = query.is('workspace_id', null).eq('user_id', userId)
    const { data } = await query
    setTasks(data ?? [])
    if (data) {
      const editorIds = data.filter(t => t.last_edited_by).map(t => t.last_edited_by as string)
      const creatorIds = data.map(t => t.user_id)
      const assigneeIds = data.filter(t => t.assignee_id).map(t => t.assignee_id as string)
      fetchProfiles([...editorIds, ...creatorIds, ...assigneeIds])
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
    const { error } = await supabase.from('tasks')
      .update({ status: newStatus, last_edited_by: userId, last_edited_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) { console.error('Update error:', error); refetchTasks() }
  }

  const handleAddTask = (status: Status) => { setDefaultStatus(status); setShowModal(true) }
  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/auth') }

  // Branch click — switch to Board view filtered to that assignee
  const handleBranchClick = (branch: FlowBranch) => {
    if (branch.id === 'unassigned') {
      setBranchFilter(null)
    } else {
      setBranchFilter({ assigneeId: branch.id, name: branch.name })
    }
    setView('board')
  }

  const total     = tasks.length
  const completed = tasks.filter(t => t.status === 'done').length
  const overdue   = tasks.filter(t => {
    if (!t.due_date) return false
    const [y, m, d] = t.due_date.split('-').map(Number)
    return new Date(y, m - 1, d) < new Date(new Date().setHours(0, 0, 0, 0))
  }).length

  // Tasks filtered by branch (when coming from Flow)
  const filteredTasks = branchFilter
    ? tasks.filter(t => t.assignee_id === branchFilter.assigneeId)
    : tasks

  return (
    <div style={{ minHeight: '100vh', background: '#000', overflowX: 'hidden', fontFamily: 'Space Grotesk, sans-serif' }}>

      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-240px', left: '-240px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-240px', right: '-240px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)' }} />
      </div>

      {/* HEADER */}
      <div style={{ position: 'relative', zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? '12px 16px' : '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>

          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white' }}>N</div>
            <div>
              <h1 style={{ color: 'white', fontWeight: 800, fontSize: isMobile ? '15px' : '17px', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>NEX<span style={{ color: '#8b5cf6' }}>TASK</span></h1>
              {!isMobile && <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.2em', margin: 0 }}>AI-POWERED BOARD</p>}
            </div>
          </motion.div>

          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowWorkspacePanel(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '7px 12px', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: currentWorkspace ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white' }}>
              {currentWorkspace ? currentWorkspace.name.charAt(0).toUpperCase() : '👤'}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, maxWidth: isMobile ? '70px' : '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentWorkspace ? currentWorkspace.name : 'Personal'}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>⌄</span>
          </motion.button>

          {!isMobile && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[
                { label: 'TOTAL', value: total, color: '#a78bfa' },
                { label: 'DONE', value: completed, color: '#34d399' },
                { label: 'OVERDUE', value: overdue, color: '#f87171' },
              ].map((stat, i) => (
                <div key={stat.label} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {i > 0 && <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.12)', marginRight: '6px' }} />}
                  <span style={{ color: stat.color, fontWeight: 700, fontSize: '16px', fontFamily: 'Space Mono' }}>{String(stat.value).padStart(2, '0')}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>{stat.label}</span>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {!isMobile && (
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>⌕</span>
                <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', paddingLeft: '30px', paddingRight: '14px', paddingTop: '8px', paddingBottom: '8px', color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', width: '180px' }} />
              </div>
            )}

            {userId && profile?.email && (
              <InviteNotifications userId={userId} userEmail={profile.email} onInviteAccepted={() => { void refetchTasks() }} />
            )}

            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => handleAddTask('todo')}
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '8px', padding: isMobile ? '8px 12px' : '8px 18px', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, boxShadow: '0 0 20px rgba(139,92,246,0.4)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
              {!isMobile && 'New Task'}
            </motion.button>

            <div style={{ position: 'relative', isolation: 'isolate' as const }}>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setShowProfileMenu(p => !p)}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '5px 10px 5px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar name={profile?.full_name ?? profile?.email ?? 'User'} avatarUrl={profile?.avatar_url} size={28} />
                {!isMobile && <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{profile?.full_name?.split(' ')[0] ?? 'User'}</span>}
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>⌄</span>
              </motion.button>

              {showProfileMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowProfileMenu(false)} />
                  <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '230px', zIndex: 9999, borderRadius: '14px', padding: '6px', border: '1px solid #333', boxShadow: '0 32px 80px rgba(0,0,0,0.9)', backgroundColor: '#111111', isolation: 'isolate' as const }}>
                    <div style={{ padding: '12px', marginBottom: '4px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar name={profile?.full_name ?? profile?.email ?? 'User'} avatarUrl={profile?.avatar_url} size={38} />
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700, fontFamily: 'Space Grotesk', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name ?? 'User'}</p>
                        <p style={{ color: '#aaa', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.email}</p>
                      </div>
                    </div>
                    {[
                      { icon: '⚙', label: 'Settings', action: () => { setShowSettings(true); setShowProfileMenu(false) } },
                      { icon: '👥', label: 'Workspaces', action: () => { setShowWorkspacePanel(true); setShowProfileMenu(false) } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#ccc', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', marginBottom: '2px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#fff' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc' }}>
                        <span style={{ fontSize: '14px' }}>{item.icon}</span>{item.label}
                      </button>
                    ))}
                    <div style={{ height: '1px', background: '#333', margin: '4px 0' }} />
                    <button onClick={handleLogout}
                      style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#ef4444' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f87171' }}>
                      <span>↩</span>Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {isMobile && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>⌕</span>
              <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', paddingLeft: '30px', paddingRight: '14px', paddingTop: '8px', paddingBottom: '8px', color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div style={{ position: 'relative', zIndex: 10, maxWidth: view === 'flow' ? '100%' : '1400px', margin: '0 auto', padding: view === 'flow' ? '0' : (isMobile ? '16px' : '28px 32px') }}>

        {/* View toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: view === 'flow' ? '0' : '20px', flexWrap: 'wrap', padding: view === 'flow' ? (isMobile ? '12px 16px' : '16px 28px') : '0', borderBottom: view === 'flow' ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '4px' }}>
            {[
              { id: 'today',    label: '☀ Today' },
              { id: 'board',    label: '⊞ Board' },
              { id: 'calendar', label: '⊟ Calendar' },
              { id: 'flow',     label: '⚡ Flow' },
            ].map(v => (
              <button key={v.id}
                onClick={() => { setView(v.id as typeof view); if (v.id !== 'board') setBranchFilter(null) }}
                style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', background: view === v.id ? 'rgba(139,92,246,0.25)' : 'transparent', color: view === v.id ? '#a78bfa' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: view === v.id ? 600 : 400, transition: 'all 0.15s' }}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Branch filter badge */}
          {branchFilter && view === 'board' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '20px', padding: '4px 10px 4px 8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6' }} />
              <span style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Space Grotesk' }}>{branchFilter.name}</span>
              <button onClick={() => setBranchFilter(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.5)', cursor: 'pointer', fontSize: '12px', padding: '0', lineHeight: 1, marginLeft: '2px' }}>✕</button>
            </div>
          )}

          {isMobile && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ value: total, color: '#a78bfa', label: 'total' }, { value: completed, color: '#34d399', label: 'done' }, { value: overdue, color: '#f87171', label: 'late' }].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px 8px' }}>
                  <span style={{ color: s.color, fontSize: '13px', fontWeight: 700, fontFamily: 'Space Mono' }}>{s.value}</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: 'Space Mono' }}>{s.label}</span>
                </div>
              ))}
            </div>
          )}

          {view !== 'flow' && <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />}

          {currentWorkspace && view !== 'flow' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '4px 10px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 6px #8b5cf6' }} />
              <span style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{currentWorkspace.name}</span>
            </div>
          )}

          {!isMobile && view !== 'flow' && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontFamily: 'Space Mono' }}>{total} tasks</span>}
        </div>

        {/* Views */}
        {loading ? (
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ width: 'min(300px, 85vw)', minWidth: 'min(300px, 85vw)', height: '400px', borderRadius: '16px', flexShrink: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }} />
            ))}
          </div>
        ) : view === 'today' ? (
          <TodayView tasks={tasks} onOpen={setSelectedTask} onAddTask={() => handleAddTask('todo')} userId={userId} onTaskUpdated={refetchTasks} />
        ) : view === 'board' ? (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
              {COLUMNS.map((column, i) => (
                <motion.div key={column.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }} style={{ scrollSnapAlign: 'start' }}>
                  <Column
                    id={column.id}
                    tasks={filteredTasks
                      .filter(t => t.status === column.id)
                      .filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
                    }
                    onDeleted={refetchTasks} onOpen={setSelectedTask}
                    onAddTask={handleAddTask} profiles={profiles} userId={userId}
                  />
                </motion.div>
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div style={{ transform: 'rotate(2deg) scale(1.05)' }}>
                  <TaskCard task={activeTask} onDeleted={() => {}} onOpen={() => {}} profiles={profiles} userId={userId} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : view === 'calendar' ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <CalendarView tasks={tasks} onOpenTask={setSelectedTask} />
          </motion.div>
        ) : view === 'flow' ? (
          !currentWorkspace ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '12px', padding: '28px' }}>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Mono', fontSize: '12px', letterSpacing: '0.12em' }}>FLOW REQUIRES A WORKSPACE</p>
              <p style={{ color: 'rgba(255,255,255,0.15)', fontFamily: 'Space Grotesk', fontSize: '13px' }}>Select or create a workspace to see your execution map.</p>
              <button onClick={() => setShowWorkspacePanel(true)}
                style={{ marginTop: '8px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '8px 18px', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk' }}>
                Open Workspaces
              </button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              style={{ height: 'calc(100vh - 160px)', overflow: 'hidden' }}
            >
              <FlowGraph
                workspaceId={currentWorkspace.id}
                userId={userId}
                onBranchClick={handleBranchClick}
              />
            </motion.div>
          )
        ) : null}
      </div>

      {/* Modals */}
      {showModal && userId && (
        <CreateTaskModal userId={userId} onClose={() => setShowModal(false)} onTaskCreated={refetchTasks} defaultStatus={defaultStatus} workspaceId={currentWorkspace?.id} />
      )}
      {selectedTask && userId && (
        <TaskDetailPanel task={selectedTask} userId={userId} onClose={() => setSelectedTask(null)} onUpdated={() => { refetchTasks(); setSelectedTask(null) }} profiles={profiles} />
      )}
      <AnimatePresence>
        {showWorkspacePanel && userId && (
          <WorkspacePanel userId={userId} currentWorkspace={currentWorkspace} onWorkspaceChange={setCurrentWorkspace} onClose={() => setShowWorkspacePanel(false)} />
        )}
      </AnimatePresence>
      {showOnboarding && userId && (
        <OnboardingFlow userId={userId} userName={profile?.full_name ?? profile?.email ?? ''} onComplete={() => { setShowOnboarding(false); setProfile(prev => prev ? { ...prev, onboarding_completed: true } : prev); refetchTasks() }} />
      )}
      <AnimatePresence>
        {showSettings && userId && (
          <SettingsModal userId={userId} profile={profile} onClose={() => setShowSettings(false)} onProfileUpdated={setProfile} nexEnabled={nexEnabled} onToggleNex={toggleNex} defaultView={view} onDefaultViewChange={(v) => { setView(v); try { localStorage.setItem('nex_default_view', v) } catch (e) { void e } }} />
        )}
      </AnimatePresence>
      {userId && (
        <NexErrorBoundary>
          <NexAssistant workspaceId={currentWorkspace?.id ?? null} userId={userId} isPro={isPro} nexEnabled={nexEnabled} onTaskCreated={refetchTasks} panelOpen={showSettings} />
        </NexErrorBoundary>
      )}
    </div>
  )
}

export default App