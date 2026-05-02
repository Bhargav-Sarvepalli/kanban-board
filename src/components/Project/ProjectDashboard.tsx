import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'
import Avatar from '../Avatar'
import AddFeatureModal from './AddFeatureModal'
import InviteMemberModal from './InviteMemberModal'

interface Props {
  projectId: string
  projectName: string
  userId: string
  onClose: () => void
  onFeatureClick: (featureId: string, featureName: string) => void
  onProjectRenamed?: (newName: string) => void
  onProjectDeleted?: () => void
  inline?: boolean
}

interface Member {
  user_id: string
  role: 'owner' | 'manager' | 'member'
  profile: { full_name: string | null; email: string; avatar_url: string | null }
  activeTaskCount: number
  doneTaskCount: number
}
interface Feature {
  id: string; name: string; color: string; milestone_id: string | null
  totalTasks: number; doneTasks: number; overdueTasks: number
  health: 'on_track' | 'at_risk' | 'blocked'
}
interface Milestone {
  id: string; name: string; position: number
  target_date: string | null; is_current: boolean
}
interface ProjectLink {
  label: string; url: string
  type: 'github' | 'live' | 'figma' | 'supabase' | 'notion' | 'other'
}
interface ProjectData {
  name: string; description: string | null; links: ProjectLink[]
  target_date: string | null; owner_id: string; workspace_id: string | null
}
interface ActivityItem {
  id: string; actor: string; action: string; target: string
  timestamp: string; type: 'complete' | 'block' | 'move' | 'add'
}

// ── Design tokens — higher contrast than before ──
const C = {
  bg:       '#0a0a0f',
  surface:  'rgba(255,255,255,0.03)',
  border:   '#1e1e2e',
  text:     '#e2e2e8',       // primary
  muted:    '#8b8ba0',       // was #3d3d52 — now readable
  faint:    '#52526a',       // was #2a2a3d
  accent:   '#7c3aed',
  accentLt: '#a78bfa',
}

const LINK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  github:   { bg: 'rgba(255,255,255,0.06)', text: '#c9c9d4',  border: 'rgba(255,255,255,0.12)' },
  live:     { bg: 'rgba(22,163,74,0.1)',    text: '#4ade80',  border: 'rgba(22,163,74,0.3)'    },
  figma:    { bg: 'rgba(219,39,119,0.1)',   text: '#f472b6',  border: 'rgba(219,39,119,0.3)'   },
  supabase: { bg: 'rgba(62,207,142,0.1)',   text: '#3ecf8e',  border: 'rgba(62,207,142,0.3)'   },
  notion:   { bg: 'rgba(255,255,255,0.06)', text: '#b8b8cc',  border: 'rgba(255,255,255,0.1)'  },
  other:    { bg: 'rgba(124,58,237,0.1)',   text: '#a78bfa',  border: 'rgba(124,58,237,0.3)'   },
}
const LINK_ICONS: Record<string, string> = {
  github: 'GH', live: '↗', figma: 'FG', supabase: 'SB', notion: 'NO', other: '🔗',
}
const HEALTH = {
  on_track: { label: 'On track', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.3)'  },
  at_risk:  { label: 'At risk',  color: '#d97706', bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.3)'  },
  blocked:  { label: 'Blocked',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.3)'  },
}
const ROLE = {
  owner:   { label: 'Owner',   color: C.accentLt, bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)' },
  manager: { label: 'Manager', color: '#60a5fa',  bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.3)'  },
  member:  { label: 'Member',  color: C.muted,    bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.12)'},
}
const ACTIVITY_COLORS: Record<string, string> = {
  complete: '#16a34a', block: '#dc2626', move: C.accent, add: '#2563eb',
}

function timeAgo(ts: string) {
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Yesterday' : `${d}d ago`
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <p style={{ color: C.muted, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.06em', margin: 0, textTransform: 'uppercase' }}>{children}</p>
      {action}
    </div>
  )
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '3px', borderRadius: '5px', display: 'flex', alignItems: 'center', lineHeight: 1 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.accentLt }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted }}>
      {children}
    </button>
  )
}

export default function ProjectDashboard({
  projectId, projectName, userId, onClose, onFeatureClick,
  onProjectRenamed, onProjectDeleted, inline = false,
}: Props) {
  const [project,    setProject]    = useState<ProjectData | null>(null)
  const [members,    setMembers]    = useState<Member[]>([])
  const [features,   setFeatures]   = useState<Feature[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [activity,   setActivity]   = useState<ActivityItem[]>([])
  const [loading,    setLoading]    = useState(true)

  // Edit states
  const [editDesc,      setEditDesc]      = useState('')
  const [editingDesc,   setEditingDesc]   = useState(false)
  const [addingLink,    setAddingLink]    = useState(false)
  const [newLink,       setNewLink]       = useState({ label: '', url: '', type: 'other' as ProjectLink['type'] })
  const [saving,        setSaving]        = useState(false)

  // Modals
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [showInvite,     setShowInvite]     = useState(false)
  const [showSettings,   setShowSettings]   = useState(false)

  // Phase editing
  const [editingPhase,   setEditingPhase]   = useState<string | null>(null)
  const [phaseName,      setPhaseName]      = useState('')
  const [phaseDate,      setPhaseDate]      = useState('')

  // Project settings
  const [editingProjName, setEditingProjName] = useState(false)
  const [newProjName,     setNewProjName]     = useState(projectName)
  const [confirmDelete,   setConfirmDelete]   = useState(false)

  const isOwnerOrManager = members.some(m => m.user_id === userId && (m.role === 'owner' || m.role === 'manager'))
    || project?.owner_id === userId

  const fetchAll = useCallback(async () => {
    setLoading(true)

    // Get workspace_id from project first
    const { data: proj } = await supabase
      .from('projects')
      .select('name,description,links,target_date,owner_id,workspace_id')
      .eq('id', projectId).single()

    const wsId = proj?.workspace_id ?? ''

    const [membersRes, featuresRes, milestonesRes, tasksRes, wsMembersRes] = await Promise.all([
      supabase.from('project_members').select('user_id,role,profiles(full_name,email,avatar_url)').eq('project_id', projectId),
      supabase.from('project_features').select('id,name,color,milestone_id').eq('project_id', projectId),
      supabase.from('project_milestones').select('id,name,position,target_date,is_current').eq('project_id', projectId).order('position'),
      supabase.from('tasks').select('id,status,due_date,feature_id,last_edited_by,last_edited_at,title,assignee_id').eq('project_id', projectId),
      wsId ? supabase.from('workspace_members').select('user_id,role,profiles(full_name,email,avatar_url)').eq('workspace_id', wsId) : Promise.resolve({ data: [] }),
    ])

    if (proj) { setProject(proj as ProjectData); setEditDesc(proj.description ?? '') }
    if (milestonesRes.data) setMilestones(milestonesRes.data as Milestone[])

    const tasks = tasksRes.data ?? []
    const now   = new Date()

    // Merge project + workspace members, deduplicate
    type RawM = { user_id: string; role: 'owner'|'manager'|'member'; profiles: { full_name: string|null; email: string; avatar_url: string|null } }
    const seen = new Set<string>()
    const allRaw: RawM[] = []
    for (const m of (membersRes.data ?? []) as unknown as RawM[]) { seen.add(m.user_id); allRaw.push(m) }
    for (const m of ((wsMembersRes as { data: unknown[] | null }).data ?? []) as unknown as RawM[]) {
      if (!seen.has(m.user_id)) allRaw.push({ ...m, role: 'member' })
    }
    const built = allRaw.map(m => ({
      user_id: m.user_id, role: m.role, profile: m.profiles,
      activeTaskCount: tasks.filter(t => t.assignee_id === m.user_id && t.status === 'in_progress').length,
      doneTaskCount:   tasks.filter(t => t.assignee_id === m.user_id && t.status === 'done').length,
    }))
    built.sort((a, b) => ({ owner:0, manager:1, member:2 }[a.role] - { owner:0, manager:1, member:2 }[b.role]))
    setMembers(built)

    if (featuresRes.data) {
      type RawF = { id: string; name: string; color: string; milestone_id: string | null }
      const fBuilt: Feature[] = (featuresRes.data as RawF[]).map(f => {
        const ft = tasks.filter(t => t.feature_id === f.id)
        const done = ft.filter(t => t.status === 'done').length
        const over = ft.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < now).length
        const pct  = ft.length ? Math.round((done / ft.length) * 100) : 0
        let health: Feature['health'] = 'on_track'
        if (over > 0) health = 'blocked'
        else if (pct < 30 && ft.length > 2) health = 'at_risk'
        return { ...f, totalTasks: ft.length, doneTasks: done, overdueTasks: over, health }
      })
      setFeatures(fBuilt)
    }

    const recent = [...tasks].filter(t => t.last_edited_at)
      .sort((a, b) => new Date(b.last_edited_at!).getTime() - new Date(a.last_edited_at!).getTime())
      .slice(0, 5)
    const mMap: Record<string, string> = {}
    for (const m of allRaw) {
      mMap[m.user_id] = m.profiles?.full_name?.split(' ')[0] ?? m.profiles?.email ?? 'Someone'
    }
    setActivity(recent.map(t => ({
      id: t.id, actor: mMap[t.last_edited_by ?? ''] ?? 'Someone',
      action: t.status === 'done' ? 'completed' : 'updated',
      target: t.title, timestamp: t.last_edited_at!,
      type: t.status === 'done' ? 'complete' : 'move',
    })))
    setLoading(false)
  }, [projectId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchAll() }, [fetchAll])

  const saveDesc = async () => {
    setSaving(true)
    await supabase.from('projects').update({ description: editDesc }).eq('id', projectId)
    setProject(p => p ? { ...p, description: editDesc } : p)
    setEditingDesc(false); setSaving(false)
  }

  const addLink = async () => {
    if (!newLink.label || !newLink.url) return
    setSaving(true)
    const updated = [...(project?.links ?? []), newLink]
    await supabase.from('projects').update({ links: updated }).eq('id', projectId)
    setProject(p => p ? { ...p, links: updated } : p)
    setNewLink({ label: '', url: '', type: 'other' }); setAddingLink(false); setSaving(false)
  }

  const removeLink = async (idx: number) => {
    const updated = (project?.links ?? []).filter((_, i) => i !== idx)
    await supabase.from('projects').update({ links: updated }).eq('id', projectId)
    setProject(p => p ? { ...p, links: updated } : p)
  }

  const setCurrentMilestone = async (id: string) => {
    await supabase.from('project_milestones').update({ is_current: false }).eq('project_id', projectId)
    await supabase.from('project_milestones').update({ is_current: true }).eq('id', id)
    setMilestones(prev => prev.map(m => ({ ...m, is_current: m.id === id })))
  }

  const savePhase = async (id: string) => {
    setSaving(true)
    await supabase.from('project_milestones').update({
      name: phaseName.trim() || undefined,
      target_date: phaseDate || null,
    }).eq('id', id)
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, name: phaseName || m.name, target_date: phaseDate || null } : m))
    setEditingPhase(null); setSaving(false)
  }

  const deletePhase = async (id: string) => {
    await supabase.from('project_milestones').delete().eq('id', id)
    setMilestones(prev => prev.filter(m => m.id !== id))
  }

  const addPhase = async () => {
    const position = milestones.length
    const { data } = await supabase.from('project_milestones')
      .insert({ project_id: projectId, name: 'New Phase', position, is_current: false })
      .select().single()
    if (data) {
      setMilestones(prev => [...prev, { ...data, target_date: null, is_current: false }])
      setEditingPhase(data.id); setPhaseName('New Phase'); setPhaseDate('')
    }
  }

  const renameProject = async () => {
    if (!newProjName.trim()) return
    setSaving(true)
    await supabase.from('projects').update({ name: newProjName.trim() }).eq('id', projectId)
    onProjectRenamed?.(newProjName.trim())
    setEditingProjName(false); setSaving(false)
  }

  const deleteProject = async () => {
    await supabase.from('projects').delete().eq('id', projectId)
    onProjectDeleted?.()
    onClose()
  }

  // Derived stats
  const totalTasks   = features.reduce((s, f) => s + f.totalTasks, 0)
  const doneTasks    = features.reduce((s, f) => s + f.doneTasks, 0)
  const blockedCount = features.filter(f => f.health === 'blocked').length
  const overallPct   = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0
  const currentMs    = milestones.find(m => m.is_current)
  const overallHealth: Feature['health'] = blockedCount > 0 ? 'blocked'
    : features.some(f => f.health === 'at_risk') ? 'at_risk' : 'on_track'
  const days = project?.target_date
    ? Math.ceil((new Date(project.target_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    : null

  const plusIcon = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  const editIcon = (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
  const trashIcon = (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 3h9M4 3V2h4v1M2.5 3l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  // ── Shared header ──
  const headerSection = (
    <div style={{ padding: inline ? '0 0 20px' : '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {projectName.charAt(0).toUpperCase()}
          </div>
          {editingProjName ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input value={newProjName} onChange={e => setNewProjName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') renameProject(); if (e.key === 'Escape') setEditingProjName(false) }}
                style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${C.accent}`, borderRadius: '6px', padding: '4px 10px', color: C.text, fontSize: '17px', fontFamily: 'Inter, sans-serif', fontWeight: 600, outline: 'none', width: '200px' }} />
              <button onClick={renameProject} disabled={saving} style={{ padding: '4px 10px', background: C.accent, border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingProjName(false)} style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.muted, fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
            </div>
          ) : (
            <h2 style={{ color: C.text, fontSize: '17px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>{projectName}</h2>
          )}
          {currentMs && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(124,58,237,0.12)', border: `1px solid rgba(124,58,237,0.3)`, borderRadius: '5px', padding: '2px 9px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: C.accent }} />
              <span style={{ color: C.accentLt, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{currentMs.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {editingDesc ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(124,58,237,0.4)`, borderRadius: '7px', padding: '7px 11px', color: C.text, fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button onClick={saveDesc} disabled={saving} style={{ padding: '5px 12px', background: C.accent, border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', cursor: 'pointer' }}>{saving ? '…' : 'Save'}</button>
              <button onClick={() => setEditingDesc(false)} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.muted, fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p onClick={() => isOwnerOrManager && setEditingDesc(true)}
            style={{ color: project?.description ? C.muted : C.faint, fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '4px 0 0', cursor: isOwnerOrManager ? 'text' : 'default', fontStyle: project?.description ? 'normal' : 'italic', lineHeight: 1.5 }}>
            {project?.description ?? (isOwnerOrManager ? 'Add a project description…' : 'No description')}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '16px' }}>
        {isOwnerOrManager && (
          <IconBtn onClick={() => setShowSettings(s => !s)} title="Project settings">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7.5 1v1.5M7.5 12.5V14M14 7.5h-1.5M2.5 7.5H1M12 3.5l-1 1M4 11l-1 1M12 11.5l-1-1M4 4l-1-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </IconBtn>
        )}
        {!inline && (
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: '7px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, cursor: 'pointer', fontSize: '14px' }}>✕</button>
        )}
      </div>
    </div>
  )

  // ── Project settings panel ──
  const settingsPanel = showSettings && isOwnerOrManager && (
    <div style={{ margin: inline ? '0 0 16px' : '0 28px 16px', background: 'rgba(124,58,237,0.06)', border: `1px solid rgba(124,58,237,0.2)`, borderRadius: '10px', padding: '16px 18px' }}>
      <p style={{ color: C.accentLt, fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 14px' }}>Project settings</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button onClick={() => { setEditingProjName(true); setShowSettings(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '7px', color: C.text, cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
          {editIcon} Rename project
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '7px', color: '#f87171', cursor: 'pointer', fontSize: '13px', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
            {trashIcon} Delete project
          </button>
        ) : (
          <div style={{ padding: '10px 12px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '7px' }}>
            <p style={{ color: '#f87171', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '0 0 10px' }}>Delete <strong>{projectName}</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={deleteProject} style={{ padding: '6px 14px', background: '#dc2626', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600, cursor: 'pointer' }}>Yes, delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.muted, fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const bodySection = loading ? (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: `2px solid rgba(124,58,237,0.2)`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'pdSpin 0.8s linear infinite' }} />
    </div>
  ) : (
    <div style={{ padding: inline ? '0' : '20px 28px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>

      {/* ── STAT STRIP ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        {[
          { label: 'Health',   value: HEALTH[overallHealth].label, sub: `${blockedCount} blocked`, color: HEALTH[overallHealth].color, dot: true },
          { label: 'Progress', value: `${overallPct}%`,  sub: `${doneTasks} / ${totalTasks} tasks`,  color: C.accentLt },
          { label: 'Team',     value: String(members.length), sub: `${members.filter(m => m.activeTaskCount > 0).length} active`, color: '#60a5fa' },
          {
            label: days === null ? 'Deadline' : days < 0 ? 'Overdue by' : 'Days left',
            value: days === null ? '—' : String(Math.abs(days)),
            sub:   project?.target_date ? new Date(project.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline set',
            color: days !== null && days < 7 ? '#dc2626' : days !== null && days < 14 ? '#d97706' : '#16a34a',
          },
        ].map(s => (
          <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '14px 16px' }}>
            <p style={{ color: C.muted, fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', margin: '0 0 6px', textTransform: 'uppercase' }}>{s.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              {s.dot && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />}
              <p style={{ color: s.color, fontSize: '20px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>{s.value}</p>
            </div>
            <p style={{ color: C.muted, fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: '3px 0 0' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── PHASE TIMELINE ── */}
      {milestones.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '14px 18px' }}>
          <SectionLabel action={
            isOwnerOrManager ? (
              <IconBtn onClick={addPhase} title="Add phase">{plusIcon}</IconBtn>
            ) : undefined
          }>
            Phase timeline <span style={{ color: C.faint, fontWeight: 400 }}>· click to set current</span>
          </SectionLabel>
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {milestones.map((m, i) => {
              const activeIdx = milestones.findIndex(x => x.is_current) >= 0 ? milestones.findIndex(x => x.is_current) : 0
              const isPast    = i < activeIdx
              const isCurrent = i === activeIdx
              const col       = isPast ? '#16a34a' : isCurrent ? C.accent : C.border
              const isEditing = editingPhase === m.id
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', flex: i < milestones.length - 1 ? 1 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
                    <div onClick={() => isOwnerOrManager && setCurrentMilestone(m.id)}
                      style={{ width: '26px', height: '26px', borderRadius: '50%', background: isPast ? '#16a34a' : isCurrent ? C.accent : 'rgba(255,255,255,0.04)', border: `2px solid ${col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: isPast || isCurrent ? 'white' : C.faint, fontWeight: 600, cursor: isOwnerOrManager ? 'pointer' : 'default' }}>
                      {isPast ? '✓' : isCurrent ? '⚡' : '○'}
                    </div>

                    {isEditing ? (
                      <div style={{ position: 'absolute', top: '32px', left: '50%', transform: 'translateX(-50%)', background: '#111118', border: `1px solid ${C.accent}`, borderRadius: '8px', padding: '10px 12px', zIndex: 10, width: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
                        <input value={phaseName} onChange={e => setPhaseName(e.target.value)} placeholder="Phase name"
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '5px 8px', color: C.text, fontSize: '12px', outline: 'none', marginBottom: '6px', fontFamily: 'Inter, sans-serif' }} />
                        <input type="date" value={phaseDate} onChange={e => setPhaseDate(e.target.value)}
                          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '5px 8px', color: C.text, fontSize: '12px', outline: 'none', marginBottom: '8px', fontFamily: 'Inter, sans-serif' }} />
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button onClick={() => savePhase(m.id)} style={{ flex: 1, padding: '5px', background: C.accent, border: 'none', borderRadius: '5px', color: 'white', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditingPhase(null)} style={{ flex: 1, padding: '5px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.muted, fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                          <button onClick={() => deletePhase(m.id)} style={{ padding: '5px 7px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '5px', color: '#f87171', fontSize: '11px', cursor: 'pointer' }}>Del</button>
                        </div>
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <span style={{ color: isCurrent ? C.accentLt : isPast ? '#4ade80' : C.muted, fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: isCurrent ? 600 : 400, whiteSpace: 'nowrap' }}>{m.name}</span>
                      {isOwnerOrManager && (
                        <IconBtn onClick={() => { setEditingPhase(m.id); setPhaseName(m.name); setPhaseDate(m.target_date ?? '') }} title="Edit phase">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 1.5l1.5 1.5-5 5H2v-1.5l5-5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>
                        </IconBtn>
                      )}
                    </div>
                    {m.target_date && (
                      <span style={{ color: C.faint, fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                        {new Date(m.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {i < milestones.length - 1 && (
                    <div style={{ flex: 1, height: '2px', background: isPast ? '#16a34a' : C.border, margin: '12px 4px 0', flexShrink: 1 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── FEATURES + TEAM ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '14px 18px' }}>
          <SectionLabel action={isOwnerOrManager ? <IconBtn onClick={() => setShowAddFeature(true)} title="Add feature">{plusIcon}</IconBtn> : undefined}>Features</SectionLabel>
          {features.length === 0
            ? <p style={{ color: C.faint, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No features yet — click + to add one</p>
            : features.map(f => {
                const hc  = HEALTH[f.health]
                const pct = f.totalTasks ? Math.round((f.doneTasks / f.totalTasks) * 100) : 0
                const ms  = milestones.find(m => m.id === f.milestone_id)
                return (
                  <div key={f.id} onClick={() => onFeatureClick(f.id, f.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`, borderRadius: '7px', cursor: 'pointer', marginBottom: '6px', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = f.color + '60' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.text, fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                      {ms && <p style={{ color: C.muted, fontSize: '10px', fontFamily: 'Inter, sans-serif', margin: 0 }}>{ms.name}</p>}
                    </div>
                    <div style={{ width: '44px', height: '2px', background: C.border, borderRadius: '1px', flexShrink: 0 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: f.color, borderRadius: '1px' }} />
                    </div>
                    <span style={{ color: C.muted, fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', minWidth: '24px', textAlign: 'right' }}>{pct}%</span>
                    <div style={{ background: hc.bg, border: `1px solid ${hc.border}`, borderRadius: '4px', padding: '1px 6px', flexShrink: 0 }}>
                      <span style={{ color: hc.color, fontSize: '9px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{hc.label}</span>
                    </div>
                  </div>
                )
              })
          }
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '14px 18px' }}>
          <SectionLabel action={isOwnerOrManager ? <IconBtn onClick={() => setShowInvite(true)} title="Add member">{plusIcon}</IconBtn> : undefined}>Team</SectionLabel>
          {members.length === 0
            ? <p style={{ color: C.faint, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No members yet</p>
            : members.map((m, i) => {
                const rc   = ROLE[m.role]
                const name = m.profile.full_name ?? m.profile.email
                return (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < members.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <Avatar name={name} avatarUrl={m.profile.avatar_url} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: C.text, fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                      <p style={{ color: C.muted, fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: '1px 0 0' }}>
                        {m.activeTaskCount > 0 ? `${m.activeTaskCount} active` : 'No active tasks'} · {m.doneTaskCount} done
                      </p>
                    </div>
                    <div style={{ background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: '4px', padding: '2px 7px', flexShrink: 0 }}>
                      <span style={{ color: rc.color, fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{rc.label}</span>
                    </div>
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* ── LINKS + ACTIVITY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '14px 18px' }}>
          <SectionLabel>Project links</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(project?.links ?? []).map((link, i) => {
              const lc = LINK_COLORS[link.type] ?? LINK_COLORS.other
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', background: lc.bg, border: `1px solid ${lc.border}`, borderRadius: '7px' }}>
                  <span style={{ color: lc.text, fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, flexShrink: 0, minWidth: '22px', textAlign: 'center' }}>{LINK_ICONS[link.type] ?? '↗'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: C.text, fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: 0 }}>{link.label}</p>
                    <a href={link.url} target="_blank" rel="noreferrer" style={{ color: lc.text, fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {link.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                  {isOwnerOrManager && <IconBtn onClick={() => removeLink(i)}><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg></IconBtn>}
                </div>
              )
            })}
            {isOwnerOrManager && (addingLink ? (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: '7px', padding: '10px' }}>
                {['Label', 'https://…'].map((ph, idx) => (
                  <input key={ph} placeholder={ph}
                    value={idx === 0 ? newLink.label : newLink.url}
                    onChange={e => setNewLink(p => idx === 0 ? { ...p, label: e.target.value } : { ...p, url: e.target.value })}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '5px 9px', color: C.text, fontSize: '12px', fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: '5px' }} />
                ))}
                <select value={newLink.type} onChange={e => setNewLink(p => ({ ...p, type: e.target.value as ProjectLink['type'] }))}
                  style={{ width: '100%', background: '#111118', border: `1px solid ${C.border}`, borderRadius: '5px', padding: '5px 9px', color: C.text, fontSize: '12px', fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: '8px' }}>
                  {['github','live','figma','supabase','notion','other'].map(t => <option key={t} value={t} style={{ background: '#111118' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={addLink} disabled={saving} style={{ flex: 1, padding: '5px', background: C.accent, border: 'none', borderRadius: '5px', color: 'white', fontSize: '12px', cursor: 'pointer' }}>{saving ? '…' : 'Add'}</button>
                  <button onClick={() => setAddingLink(false)} style={{ flex: 1, padding: '5px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '5px', color: C.muted, fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingLink(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: '7px', color: C.muted, cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }}>
                + Add link (Figma, GitHub, staging URL…)
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '14px 18px' }}>
          <SectionLabel>Recent activity</SectionLabel>
          {activity.length === 0
            ? <p style={{ color: C.faint, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No recent activity</p>
            : activity.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '7px 0', borderBottom: i < activity.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ACTIVITY_COLORS[a.type] ?? C.accent, flexShrink: 0, marginTop: '5px' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: C.muted, fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0, lineHeight: 1.4 }}>
                      <span style={{ color: C.text, fontWeight: 500 }}>{a.actor}</span>
                      {' '}{a.action}{' '}
                      <span style={{ color: C.text }}>{a.target}</span>
                    </p>
                    <p style={{ color: C.faint, fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', margin: '2px 0 0' }}>{timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )

  const modals = (
    <>
      {showAddFeature && <AddFeatureModal projectId={projectId} onAdded={fetchAll} onClose={() => setShowAddFeature(false)} />}
      {showInvite    && <InviteMemberModal projectId={projectId} onInvited={fetchAll} onClose={() => setShowInvite(false)} />}
    </>
  )

  if (inline) {
    return (
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {headerSection}
        {settingsPanel}
        <div style={{ flex: 1, padding: '20px 0' }}>
          {bodySection}
        </div>
        {modals}
        <style>{`@keyframes pdSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 'min(860px, 96vw)', height: '100vh', overflowY: 'auto', background: C.bg, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
        {headerSection}
        {settingsPanel}
        {bodySection}
        {modals}
        <style>{`@keyframes pdSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}