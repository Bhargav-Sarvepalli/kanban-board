import { useEffect, useRef, useState } from 'react'
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
import PomodoroView from './components/PomodoroView'
import TodayView from './components/TodayView'
import WorkspacePanel from './components/WorkspacePanel'
import NexAssistant from './components/Nex/NexAssistant'
import NexErrorBoundary from './components/Nex/NexErrorBoundary'
import SettingsModal from './components/SettingsModal'
import OnboardingFlow from './components/OnboardingFlow'
import InviteNotifications from './components/InviteNotifications'
import FlowGraph from './components/Flow/FlowGraph'
import StandupMode from './components/Flow/StandupMode'
import ProjectCreationWizard, { type Project } from './components/Project/ProjectCreationWizard'
import ProjectDashboard from './components/Project/ProjectDashboard'
import Sidebar from './components/Sidebar'
import type { FlowBranch } from './hooks/useFlowData'
import { useProjects } from './hooks/useProjects'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'

type AppView = 'today' | 'board' | 'calendar' | 'flow' | 'dashboard' | 'pomodoro'
type BoardFocus = 'project' | 'mine' | 'week' | 'backlog' | 'done'

function isAppView(value: string | null): value is AppView {
  return value === 'today' || value === 'board' || value === 'calendar' || value === 'flow' || value === 'dashboard' || value === 'pomodoro'
}

function isBoardFocus(value: string | null): value is BoardFocus {
  return value === 'project' || value === 'mine' || value === 'week' || value === 'backlog' || value === 'done'
}

function parseTaskDate(value?: string | null) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function App() {
  const [userId,   setUserId]   = useState<string | null>(null)
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading,  setLoading]  = useState(true)

  const [showModal,          setShowModal]          = useState(false)
  const [showWorkspacePanel, setShowWorkspacePanel] = useState(false)
  const [showProjectWizard,  setShowProjectWizard]  = useState(false)
  const [showSettings,       setShowSettings]       = useState(false)
  const [showOnboarding,     setShowOnboarding]     = useState(false)
  const [showStandup,        setShowStandup]        = useState(false)
  const [flowDrawerOpen,     setFlowDrawerOpen]     = useState(false)

  const [search,        setSearch]        = useState('')
  const [activeTask,    setActiveTask]    = useState<Task | null>(null)
  const [selectedTask,  setSelectedTask]  = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo')

  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [workspaces,       setWorkspaces]       = useState<Workspace[]>([])
  const [currentProject,   setCurrentProject]   = useState<Project | null>(null)

  const [branchFilter, setBranchFilter] = useState<{
    id: string; name: string; mode: 'assignee' | 'feature'
  } | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const isPro    = true

  const [nexEnabled, setNexEnabled] = useState(() => {
    try { return localStorage.getItem('nex_enabled') !== 'false' }
    catch { return true }
  })

  const availableTabs = currentProject
    ? (['dashboard', 'board', 'flow', 'calendar', 'pomodoro'] as const)
    : (['today', 'board', 'calendar', 'pomodoro'] as const)

  const getSavedDefaultView = (): AppView => {
    try {
      const saved = localStorage.getItem('nex_default_view')
      if (saved === 'board' || saved === 'calendar' || saved === 'today' || saved === 'pomodoro') return saved
    } catch { /* ignore */ }
    return 'today'
  }

  const [defaultViewPref, setDefaultViewPref] = useState<AppView>(getSavedDefaultView)
  const [view, setView] = useState<AppView>(defaultViewPref)
  const [boardFocus, setBoardFocus] = useState<BoardFocus>('project')

  const effectiveView = (view === 'flow' && !currentProject) ? 'board'
    : (view === 'dashboard' && !currentProject) ? 'today'
    : view

  const { projects, refetch: refetchProjects } = useProjects(userId, currentWorkspace?.id ?? null)

  const updateAppUrl = (
    nextView: AppView,
    opts?: {
      workspace?: Workspace | null
      project?: Project | null
      feature?: { id: string; name: string } | null
      board?: BoardFocus
      replace?: boolean
    },
  ) => {
    const params = new URLSearchParams()
    params.set('view', nextView)
    const workspaceForUrl = opts?.workspace !== undefined ? opts.workspace : currentWorkspace
    if (workspaceForUrl) params.set('workspace', workspaceForUrl.id)
    const projectForUrl = opts?.project !== undefined ? opts.project : currentProject
    if (projectForUrl) params.set('project', projectForUrl.id)
    if (opts?.feature) {
      params.set('feature', opts.feature.id)
      params.set('featureName', opts.feature.name)
    }
    const boardForUrl = opts?.board ?? boardFocus
    if (nextView === 'board') params.set('board', boardForUrl)
    const next = `/app?${params.toString()}`
    if (`${location.pathname}${location.search}` !== next) {
      navigate(next, { replace: opts?.replace ?? false })
    }
  }

  useEffect(() => {
    if (!location.pathname.startsWith('/app')) return
    const params = new URLSearchParams(location.search)
    const routeView = params.get('view')
    const workspaceId = params.get('workspace')
    const projectId = params.get('project')
    const featureId = params.get('feature')
    const featureName = params.get('featureName')
    const routeBoardFocus = params.get('board')

    if (isAppView(routeView) && routeView !== view) {
      queueMicrotask(() => setView(routeView))
    }
    if (isBoardFocus(routeBoardFocus) && routeBoardFocus !== boardFocus) {
      queueMicrotask(() => setBoardFocus(routeBoardFocus))
    }

    if (!workspaceId && currentWorkspace) {
      queueMicrotask(() => {
        setCurrentWorkspace(null)
        setCurrentProject(null)
        setBranchFilter(null)
      })
    } else if (workspaceId && workspaces.length > 0 && currentWorkspace?.id !== workspaceId) {
      const workspace = workspaces.find(ws => ws.id === workspaceId)
      if (workspace) queueMicrotask(() => setCurrentWorkspace(workspace))
    }

    if (!projectId && currentProject) {
      queueMicrotask(() => {
        setCurrentProject(null)
        setBranchFilter(null)
      })
    } else if (projectId && projects.length > 0 && currentProject?.id !== projectId) {
      const project = projects.find(p => p.id === projectId)
      if (project) queueMicrotask(() => setCurrentProject(project))
    }

    if (featureId) {
      queueMicrotask(() => {
        setBranchFilter(prev => prev?.id === featureId && prev.mode === 'feature'
          ? prev
          : { id: featureId, name: featureName ?? 'Feature', mode: 'feature' })
      })
    } else if (isAppView(routeView) && routeView !== 'board') {
      queueMicrotask(() => setBranchFilter(null))
    }
  }, [location.pathname, location.search, workspaces, projects, currentWorkspace, currentWorkspace?.id, currentProject, currentProject?.id, view, boardFocus])

  const prevWsRef = useRef<string | undefined>(currentWorkspace?.id)
  useEffect(() => {
    if (prevWsRef.current === currentWorkspace?.id) return
    prevWsRef.current = currentWorkspace?.id
    queueMicrotask(() => {
      setCurrentProject(null)
      setBranchFilter(null)
      if (view === 'flow' || view === 'dashboard') setView(currentWorkspace ? 'board' : 'today')
    })
  }, [currentWorkspace, currentWorkspace?.id, view])

  const toggleNex = () => {
    setNexEnabled(prev => {
      const next = !prev
      try { localStorage.setItem('nex_enabled', String(next)) } catch { /* ignore */ }
      return next
    })
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const fetchProfile = async (uid: string, email?: string | null, fullName?: string | null) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()

    if (data) {
      setProfile(data)
      setShowOnboarding(data.onboarding_completed !== true)
      return
    }

    if (error) console.error('Profile fetch error:', error)

    const fallbackProfile = {
      id: uid,
      email: email ?? '',
      full_name: fullName ?? email?.split('@')[0] ?? 'New user',
      avatar_url: null,
      onboarding_completed: false,
    }

    const { data: created, error: createError } = await supabase
      .from('profiles')
      .upsert({
        id: fallbackProfile.id,
        email: fallbackProfile.email,
        full_name: fallbackProfile.full_name,
        onboarding_completed: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      .select('*')
      .single()

    if (createError) console.error('Profile create error:', createError)
    setProfile(created ?? fallbackProfile)
    setShowOnboarding(true)
  }

  const fetchProfiles = async (userIds: string[]) => {
    if (!userIds.length) return
    const unique = [...new Set(userIds)]
    const { data } = await supabase.from('profiles').select('*').in('id', unique)
    if (data) {
      const map: Record<string, Profile> = {}
      data.forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
  }

  const fetchWorkspaces = async () => {
    const { data } = await supabase.from('workspaces').select('*').order('created_at', { ascending: true })
    if (data) setWorkspaces(data)
  }

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
        void fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name)
        fetchWorkspaces()
      }
      else navigate('/auth')
    }
    checkAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        setUserId(session.user.id)
        void fetchProfile(session.user.id, session.user.email, session.user.user_metadata?.full_name)
        fetchWorkspaces()
      }
      else navigate('/auth')
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (!userId) return
    const fetchTasks = async () => {
      setLoading(true)
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: true })
      if (currentProject)   query = query.eq('project_id', currentProject.id)
      else if (currentWorkspace) query = query.eq('workspace_id', currentWorkspace.id).is('project_id', null)
      else query = query.is('workspace_id', null).is('project_id', null).eq('user_id', userId)
      const { data, error } = await query
      if (error) console.error('Fetch error:', error)
      else {
        setTasks(data ?? [])
        fetchProfiles([
          ...(data ?? []).filter(t => t.last_edited_by).map(t => t.last_edited_by as string),
          ...(data ?? []).map(t => t.user_id),
          ...(data ?? []).filter(t => t.assignee_id).map(t => t.assignee_id as string),
        ])
      }
      setLoading(false)
    }
    fetchTasks()

    const channelName = currentProject ? `project-${currentProject.id}`
      : currentWorkspace ? `workspace-${currentWorkspace.id}`
      : `personal-${userId}`

    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
        if (payload.eventType === 'INSERT') {
          const t = payload.new as Task
          const belongs = currentProject ? t.project_id === currentProject.id
            : currentWorkspace ? t.workspace_id === currentWorkspace.id && !t.project_id
            : !t.workspace_id && !t.project_id && t.user_id === userId
          if (belongs) setTasks(prev => [...prev, t])
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t))
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== (payload.old as Task).id))
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, currentWorkspace, currentProject])

  const refetchTasks = async () => {
    if (!userId) return
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: true })
    if (currentProject)   query = query.eq('project_id', currentProject.id)
    else if (currentWorkspace) query = query.eq('workspace_id', currentWorkspace.id).is('project_id', null)
    else query = query.is('workspace_id', null).is('project_id', null).eq('user_id', userId)
    const { data } = await query
    setTasks(data ?? [])
    if (data) fetchProfiles([
      ...data.filter(t => t.last_edited_by).map(t => t.last_edited_by as string),
      ...data.map(t => t.user_id),
      ...data.filter(t => t.assignee_id).map(t => t.assignee_id as string),
    ])
  }

  const handleDragStart = (e: DragStartEvent) => {
    const task = tasks.find(t => t.id === e.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return
    const taskId    = active.id as string
    const newStatus = over.id as Status
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === newStatus) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    const { error } = await supabase.from('tasks')
      .update({ status: newStatus, last_edited_by: userId, last_edited_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) { console.error(error); refetchTasks() }
  }

  const handleAddTask = (status: Status) => { setDefaultStatus(status); setShowModal(true) }
  const handleLogout  = async () => { await supabase.auth.signOut(); navigate('/auth') }

  const handleBranchClick = (branch: FlowBranch) => {
    const nextFilter = branch.id === 'unassigned' ? null : {
      id: branch.id,
      name: branch.name,
      mode: currentProject ? 'feature' as const : 'assignee' as const,
    }
    setBranchFilter(nextFilter)
    setBoardFocus('project')
    setView('board')
    updateAppUrl('board', {
      feature: nextFilter?.mode === 'feature' ? { id: nextFilter.id, name: nextFilter.name } : null,
      board: 'project',
    })
  }

  const handleViewChange = (v: AppView) => {
    setView(v)
    if (v !== 'board') setBranchFilter(null)
    updateAppUrl(v, { feature: null, board: boardFocus })
  }

  const total     = tasks.length
  const completed = tasks.filter(t => t.status === 'done').length
  const today     = new Date(new Date().setHours(0, 0, 0, 0))
  const weekEnd   = new Date(today)
  weekEnd.setDate(today.getDate() + 7)
  const overdue   = tasks.filter(t => {
    const due = parseTaskDate(t.due_date)
    return due ? due < today && t.status !== 'done' : false
  }).length

  const scopedTasks = branchFilter
    ? tasks.filter(t => branchFilter.mode === 'feature'
        ? t.feature_id === branchFilter.id
        : t.assignee_id === branchFilter.id)
    : tasks

  const isMyTask = (task: Task) => {
    if (!userId) return false
    if (task.assignee_id) return task.assignee_id === userId
    return task.user_id === userId
  }
  const isDueThisWeek = (task: Task) => {
    const due = parseTaskDate(task.due_date)
    return Boolean(due && due <= weekEnd && task.status !== 'done')
  }
  const isBacklogTask = (task: Task) => !task.due_date && task.status !== 'done'
  const matchesSearch = (task: Task) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return task.title.toLowerCase().includes(q) || (task.description ?? '').toLowerCase().includes(q)
  }
  const byDueThenCreated = (a: Task, b: Task) => {
    const ad = parseTaskDate(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const bd = parseTaskDate(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (ad !== bd) return ad - bd
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }
  const filterByBoardFocus = (task: Task) => {
    if (boardFocus === 'mine') return isMyTask(task)
    if (boardFocus === 'week') return isDueThisWeek(task)
    if (boardFocus === 'backlog') return isBacklogTask(task)
    if (boardFocus === 'done') return task.status === 'done'
    return true
  }
  const boardTasks = scopedTasks
    .filter(filterByBoardFocus)
    .filter(matchesSearch)
    .sort(boardFocus === 'week' ? byDueThenCreated : (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const boardCounts: Record<BoardFocus, number> = {
    project: scopedTasks.length,
    mine: scopedTasks.filter(isMyTask).length,
    week: scopedTasks.filter(isDueThisWeek).length,
    backlog: scopedTasks.filter(isBacklogTask).length,
    done: scopedTasks.filter(t => t.status === 'done').length,
  }
  const openBoardTasks = scopedTasks.filter(t => t.status !== 'done').length
  const boardDoneTasks = scopedTasks.filter(t => t.status === 'done').length
  const boardProgress = scopedTasks.length > 0 ? Math.round((boardDoneTasks / scopedTasks.length) * 100) : 0
  const boardTitle = branchFilter
    ? `${branchFilter.mode === 'feature' ? 'Feature' : 'Owner'} board`
    : currentProject
      ? 'Project board'
      : currentWorkspace
        ? 'Workspace board'
        : 'Personal board'
  const boardDescription = boardFocus === 'mine'
    ? 'Only work owned by you, pulled from the same shared task list.'
    : boardFocus === 'week'
      ? 'Due, overdue, and review work that needs attention in the next 7 days.'
      : boardFocus === 'backlog'
        ? 'Open work without a date yet. Keep ideas here until they are ready to schedule.'
        : boardFocus === 'done'
          ? 'Completed work, kept out of the active execution board.'
          : currentProject
            ? 'The shared execution board for this project. Flow branches open into this same board.'
            : currentWorkspace
              ? 'Shared workspace tasks that are not tied to a project.'
              : 'Your private board for personal tasks and solo projects.'
  const boardFocusOptions: { id: BoardFocus; label: string; hint: string }[] = [
    { id: 'project', label: currentProject ? 'Project' : currentWorkspace ? 'Workspace' : 'All', hint: 'Shared source' },
    { id: 'mine', label: 'My work', hint: 'Assigned to me' },
    { id: 'week', label: 'This week', hint: 'Due soon' },
    { id: 'backlog', label: 'Backlog', hint: 'No due date' },
    { id: 'done', label: 'Done', hint: 'Completed' },
  ]
  const visibleColumns = boardFocus === 'done' ? COLUMNS.filter(col => col.id === 'done') : COLUMNS

  const isFlow      = effectiveView === 'flow'
  const isDashboard = effectiveView === 'dashboard'
  const isPomodoro  = effectiveView === 'pomodoro'
  const isFull      = isFlow || isDashboard || isPomodoro

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0a0a0f', fontFamily: 'Inter, -apple-system, sans-serif' }}>

      {/* ── SIDEBAR ── */}
      <Sidebar
        userId={userId ?? ''}
        profile={profile}
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onWorkspaceChange={ws => {
          setCurrentWorkspace(ws)
          setCurrentProject(null)
          setBranchFilter(null)
          setView(ws ? 'board' : 'today')
          updateAppUrl(ws ? 'board' : 'today', { workspace: ws, project: null, feature: null })
        }}
        onOpenWorkspacePanel={() => setShowWorkspacePanel(true)}
        projects={projects}
        currentProject={currentProject}
        onProjectChange={p => {
          const nextView: AppView = p ? 'board' : 'today'
          setCurrentProject(p)
          setBranchFilter(null)
          setView(nextView)
          updateAppUrl(nextView, { project: p, feature: null })
        }}
        onNewProject={() => setShowProjectWizard(true)}
        currentView={effectiveView}
        availableViews={availableTabs}
        onViewChange={handleViewChange}
        onSettings={() => setShowSettings(true)}
        onLogout={handleLogout}
        onWorkspaceLogoUpdated={url => {
          setWorkspaces(prev => prev.map(ws => ws.id === currentWorkspace?.id ? { ...ws, logo_url: url } : ws))
        }}
      />

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* TOPBAR */}
        <div style={{
          height: '52px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', borderBottom: '1px solid #3f3f5a',
          background: '#0a0a0f',
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#aaaac0', fontSize: '13px' }}>
              {currentWorkspace?.name ?? 'Personal'}
            </span>
            {currentProject && (
              <>
                <span style={{ color: '#575773' }}>/</span>
                <span style={{ color: '#c6c6d8', fontSize: '13px' }}>{currentProject.name}</span>
              </>
            )}
            <span style={{ color: '#575773' }}>/</span>
            <span style={{ color: '#e2e2e8', fontSize: '13px', fontWeight: 500, textTransform: 'capitalize' }}>
              {effectiveView}
            </span>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px' }}>
              {[
                { label: 'Total',   val: total,     color: '#c4c4d8' },
                { label: 'Done',    val: completed, color: '#22c55e' },
                { label: 'Overdue', val: overdue,   color: overdue > 0 ? '#ff4d5b' : '#aaaac0' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: s.color, fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{String(s.val).padStart(2, '0')}</span>
                  <span style={{ color: '#aaaac0', fontSize: '11px' }}>{s.label}</span>
                </div>
              ))}
            </div>

            <div style={{ width: '1px', height: '16px', background: '#3f3f5a' }} />

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="5.5" cy="5.5" r="3.5" stroke="#b5b5c9" strokeWidth="1.3"/>
                <path d="M8.5 8.5l2 2" stroke="#b5b5c9" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ background: '#171721', border: '1px solid #4b4b66', borderRadius: '6px', paddingLeft: '28px', paddingRight: '10px', paddingTop: '5px', paddingBottom: '5px', color: '#f6f6fb', fontSize: '12px', outline: 'none', width: '160px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.24), inset 0 1px 0 rgba(255,255,255,0.08)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#4b4b66'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.07)' }} />
            </div>

            {userId && profile?.email && (
              <InviteNotifications userId={userId} userEmail={profile.email} onInviteAccepted={() => { void refetchTasks() }} />
            )}

            <button onClick={() => handleAddTask('todo')}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#7c3aed', border: 'none', borderRadius: '6px', padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#6d28d9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#7c3aed' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              New task
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div style={{ flex: 1, overflow: isFull ? 'hidden' : 'auto', padding: isFull ? '0' : '20px 24px', minHeight: 0 }}>

          {effectiveView === 'board' && (
            <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px' }}>
              <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
                  <h2 style={{ color: '#f7f7fb', fontSize: '18px', lineHeight: 1.2, fontWeight: 750, margin: 0, letterSpacing: '-0.02em' }}>
                    {boardTitle}
                  </h2>
                  {branchFilter && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(167,139,250,0.42)', borderRadius: '999px', padding: '4px 9px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 10px rgba(167,139,250,0.75)' }} />
                      <span style={{ color: '#ddd6fe', fontSize: '12px', fontWeight: 700 }}>{branchFilter.name}</span>
                      <button type="button" onClick={() => { setBranchFilter(null); updateAppUrl('board', { feature: null, board: boardFocus }) }} aria-label="Clear board filter"
                        style={{ background: 'none', border: 'none', color: '#c4b5fd', cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}>
                        x
                      </button>
                    </div>
                  )}
                </div>
                <p style={{ color: '#b8b8cc', fontSize: '13px', lineHeight: 1.45, margin: 0, maxWidth: '720px' }}>
                  {boardDescription}
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '12px', background: 'rgba(255,255,255,0.045)' }}>
                  <div>
                    <p style={{ color: '#f7f7fb', fontSize: '12px', fontWeight: 800, margin: 0 }}>{boardProgress}%</p>
                    <p style={{ color: '#9f9fb6', fontSize: '10px', margin: 0 }}>progress</p>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.14)' }} />
                  <div>
                    <p style={{ color: '#f7f7fb', fontSize: '12px', fontWeight: 800, margin: 0 }}>{openBoardTasks}</p>
                    <p style={{ color: '#9f9fb6', fontSize: '10px', margin: 0 }}>open</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.04)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                  {boardFocusOptions.map(opt => {
                    const active = boardFocus === opt.id
                    return (
                      <button key={opt.id} type="button"
                        onClick={() => {
                          setBoardFocus(opt.id)
                          updateAppUrl('board', { board: opt.id, feature: branchFilter?.mode === 'feature' ? { id: branchFilter.id, name: branchFilter.name } : null })
                        }}
                        title={opt.hint}
                        style={{ border: active ? '1px solid rgba(167,139,250,0.72)' : '1px solid transparent', background: active ? 'rgba(124,58,237,0.26)' : 'transparent', color: active ? '#f7f7fb' : '#b8b8cc', borderRadius: '9px', padding: '8px 10px', cursor: 'pointer', minWidth: '78px', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: active ? 800 : 650 }}>
                        <span>{opt.label}</span>
                        <span style={{ marginLeft: '6px', color: active ? '#c4b5fd' : '#8d8da3', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>{boardCounts[opt.id]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {branchFilter && effectiveView === 'board' && branchFilter.id === '__legacy__' && (
            <div style={{ display: 'none', marginBottom: '14px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '5px', padding: '3px 10px' }}>
                <span style={{ color: '#a78bfa', fontSize: '12px' }}>
                  {branchFilter.mode === 'feature' ? 'Feature' : 'Owner'}: {branchFilter.name}
                </span>
                <button onClick={() => { setBranchFilter(null); updateAppUrl('board', { feature: null }) }} style={{ background: 'none', border: 'none', color: '#a4a4b8', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', gap: '14px' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ width: '270px', minWidth: '270px', height: '60vh', borderRadius: '8px', background: '#111118', border: '1px solid #2d2d40' }} />
              ))}
            </div>
          ) : effectiveView === 'today' ? (
            <TodayView tasks={tasks} onOpen={setSelectedTask} onAddTask={() => handleAddTask('todo')} userId={userId} onTaskUpdated={refetchTasks} />
          ) : effectiveView === 'board' ? (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: '14px', overflowX: 'auto', paddingBottom: '18px', minHeight: 'calc(100vh - 230px)' }}>
                {visibleColumns.map((col, i) => (
                  <motion.div key={col.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.05 }} style={{ display: 'flex' }}>
                    <Column id={col.id}
                      tasks={boardTasks.filter(t => t.status === col.id)}
                      onDeleted={refetchTasks} onOpen={setSelectedTask}
                      onAddTask={handleAddTask} profiles={profiles} userId={userId}
                      maxVisibleTasks={boardFocus === 'done' ? 10 : 6} />
                  </motion.div>
                ))}
              </div>
              <DragOverlay>
                {activeTask && (
                  <div style={{ transform: 'rotate(2deg) scale(1.03)' }}>
                    <TaskCard task={activeTask} onDeleted={() => {}} onOpen={() => {}} profiles={profiles} userId={userId} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          ) : effectiveView === 'calendar' ? (
            <CalendarView tasks={tasks} onOpenTask={setSelectedTask} contextKey={currentProject?.id ?? currentWorkspace?.id ?? userId ?? 'personal'} />
          ) : effectiveView === 'flow' && currentProject ? (
            <div style={{ height: '100%' }}>
              <FlowGraph workspaceId={currentWorkspace?.id ?? null} userId={userId}
                onBranchClick={handleBranchClick} projectId={currentProject.id}
                onOpenStandup={() => setShowStandup(true)}
                onBranchDrawerOpenChange={setFlowDrawerOpen} />
            </div>
          ) : effectiveView === 'pomodoro' ? (
            <PomodoroView />
          ) : effectiveView === 'dashboard' && currentProject ? (
            <ProjectDashboard
              projectId={currentProject.id}
              projectName={currentProject.name}
              userId={userId ?? ''}
              onClose={() => { setView('board'); updateAppUrl('board', { feature: null }) }}
              onProjectRenamed={newName => setCurrentProject(p => p ? { ...p, name: newName } : p)}
              onProjectDeleted={() => { setCurrentProject(null); setBranchFilter(null); setView('today'); updateAppUrl('today', { project: null, feature: null }); refetchProjects() }}
              onFeatureClick={(featureId, featureName) => {
                setBranchFilter({ id: featureId, name: featureName, mode: 'feature' })
                setView('board')
                updateAppUrl('board', { feature: { id: featureId, name: featureName } })
              }}
              inline={true}
            />
          ) : null}
        </div>
      </div>

      {/* ── OVERLAYS ── */}
      {showModal && userId && (
        <CreateTaskModal userId={userId} onClose={() => setShowModal(false)} onTaskCreated={refetchTasks}
          defaultStatus={defaultStatus}
          workspaceId={currentWorkspace?.id}
          projectId={currentProject?.id}
          featureId={branchFilter?.mode === 'feature' ? branchFilter.id : null} />
      )}
      {selectedTask && userId && (
        <TaskDetailPanel task={selectedTask} userId={userId} onClose={() => setSelectedTask(null)}
          onUpdated={() => { refetchTasks(); setSelectedTask(null) }} profiles={profiles} />
      )}
      <AnimatePresence>
        {showWorkspacePanel && userId && (
          <WorkspacePanel userId={userId} currentWorkspace={currentWorkspace}
            onWorkspaceChange={ws => {
              setCurrentWorkspace(ws)
              setCurrentProject(null)
              setBranchFilter(null)
              setView(ws ? 'board' : 'today')
              updateAppUrl(ws ? 'board' : 'today', { workspace: ws, project: null, feature: null })
              fetchWorkspaces()
            }}
            onClose={() => setShowWorkspacePanel(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProjectWizard && userId && (
          <ProjectCreationWizard userId={userId} workspaceId={currentWorkspace?.id ?? null}
            onClose={() => setShowProjectWizard(false)}
            onCreated={p => { setShowProjectWizard(false); refetchProjects(); setCurrentProject(p); setBranchFilter(null); setView('board'); updateAppUrl('board', { project: p, feature: null }) }} />
        )}
      </AnimatePresence>
      {showOnboarding && userId && (
        <OnboardingFlow userId={userId} userName={profile?.full_name ?? profile?.email ?? ''}
          onComplete={() => { setShowOnboarding(false); setProfile(p => p ? { ...p, onboarding_completed: true } : p); refetchTasks() }} />
      )}
      <AnimatePresence>
        {showSettings && userId && (
          <SettingsModal userId={userId} profile={profile} onClose={() => setShowSettings(false)}
            onProfileUpdated={setProfile} nexEnabled={nexEnabled} onToggleNex={toggleNex}
            defaultView={defaultViewPref === 'dashboard' || defaultViewPref === 'flow' ? 'board' : defaultViewPref}
            onReplayOnboarding={() => {
              setShowSettings(false)
              setShowOnboarding(true)
            }}
            onDefaultViewChange={v => {
              setDefaultViewPref(v)
              try { localStorage.setItem('nex_default_view', v) } catch { /* ignore */ }
            }} />
        )}
      </AnimatePresence>
      {showStandup && currentProject && (
        <StandupMode projectId={currentProject.id} onClose={() => setShowStandup(false)}
          onBranchClick={b => { setShowStandup(false); handleBranchClick(b) }} />
      )}
      {userId && (
        <NexErrorBoundary>
          <NexAssistant workspaceId={currentWorkspace?.id ?? null} userId={userId}
            projectId={currentProject?.id ?? null}
            isPro={isPro} nexEnabled={nexEnabled} onTaskCreated={refetchTasks}
            onOpenProjectWizard={() => setShowProjectWizard(true)}
            onOpenWorkspacePanel={() => setShowWorkspacePanel(true)}
            panelOpen={showSettings || flowDrawerOpen} />
        </NexErrorBoundary>
      )}
    </div>
  )
}

export default App
