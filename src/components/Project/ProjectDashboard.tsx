import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'
import Avatar from '../Avatar'
import LogoUpload from '../LogoUpload'
import AddFeatureModal from './AddFeatureModal'
import EditFeatureModal from './EditFeatureModal'
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
interface ProfileLite {
  id?: string
  full_name: string | null
  email: string
  avatar_url: string | null
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

// Design tokens
const C = {
  bg:       '#0a0a0f',
  surface:  'rgba(255,255,255,0.035)',
  border:   '#252535',
  text:     '#e8e8f0',
  muted:    '#9090a8',
  faint:    '#5a5a72',
  accent:   '#7c3aed',
  accentLt: '#a78bfa',
}

const LINK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  github:   { bg: 'rgba(255,255,255,0.05)', text: '#c0c0d4', border: 'rgba(255,255,255,0.1)'  },
  live:     { bg: 'rgba(22,163,74,0.1)',    text: '#4ade80', border: 'rgba(22,163,74,0.25)'   },
  figma:    { bg: 'rgba(219,39,119,0.1)',   text: '#f472b6', border: 'rgba(219,39,119,0.25)'  },
  supabase: { bg: 'rgba(62,207,142,0.1)',   text: '#3ecf8e', border: 'rgba(62,207,142,0.25)'  },
  notion:   { bg: 'rgba(255,255,255,0.05)', text: '#b0b0c8', border: 'rgba(255,255,255,0.1)'  },
  other:    { bg: 'rgba(124,58,237,0.1)',   text: '#a78bfa', border: 'rgba(124,58,237,0.25)'  },
}
const LINK_ICONS: Record<string, string> = {
  github:'GH', live:'↗', figma:'FG', supabase:'SB', notion:'NO', other:'🔗',
}
const HEALTH = {
  on_track: { label: 'On track', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  border: 'rgba(22,163,74,0.25)'  },
  at_risk:  { label: 'At risk',  color: '#d97706', bg: 'rgba(217,119,6,0.1)',  border: 'rgba(217,119,6,0.25)'  },
  blocked:  { label: 'Blocked',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)',  border: 'rgba(220,38,38,0.25)'  },
}
const ROLE_CFG = {
  owner:   { label: 'Owner',   color: '#a78bfa', bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.3)' },
  manager: { label: 'Manager', color: '#60a5fa', bg: 'rgba(37,99,235,0.12)',  border: 'rgba(37,99,235,0.3)'  },
  member:  { label: 'Member',  color: '#9090a8', bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.1)' },
}
const ACTIVITY_COLORS: Record<string, string> = {
  complete: '#16a34a', block: '#dc2626', move: '#7c3aed', add: '#2563eb',
}

// Map workspace roles → project roles
function mapWsRole(wsRole: string): 'owner' | 'manager' | 'member' {
  if (wsRole === 'admin') return 'manager'
  return 'member'
}

function timeAgo(ts: string) {
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Yesterday' : `${d}d ago`
}

// ── Small reusable icon button ──
function Btn({ onClick, title, danger, children }: { onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: danger ? '#f87171' : C.muted, padding: '4px', borderRadius: '5px', display: 'flex', alignItems: 'center', lineHeight: 1, flexShrink: 0 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = danger ? '#ef4444' : C.accentLt }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = danger ? '#f87171' : C.muted }}>
      {children}
    </button>
  )
}

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
)
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
)
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M4 3V2h4v1M2.5 3l.5 7h6l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)
const GripIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="4" cy="3" r="1" fill="currentColor"/><circle cx="8" cy="3" r="1" fill="currentColor"/>
    <circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="8" cy="6" r="1" fill="currentColor"/>
    <circle cx="4" cy="9" r="1" fill="currentColor"/><circle cx="8" cy="9" r="1" fill="currentColor"/>
  </svg>
)

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
  const [logoUrl,    setLogoUrl]    = useState<string | null>(null)

  // Edit states
  const [editDesc,    setEditDesc]    = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [addingLink,  setAddingLink]  = useState(false)
  const [newLink,     setNewLink]     = useState({ label: '', url: '', type: 'other' as ProjectLink['type'] })
  const [saving,      setSaving]      = useState(false)

  // Modals
  const [showAddFeature,  setShowAddFeature]  = useState(false)
  const [showInvite,      setShowInvite]      = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)
  const [editingFeature,  setEditingFeature]  = useState<Feature | null>(null)

  // Phase editing
  const [editingPhase, setEditingPhase] = useState<string | null>(null)
  const [phaseName,    setPhaseName]    = useState('')
  const [phaseDate,    setPhaseDate]    = useState('')
  const [dragPhase,    setDragPhase]    = useState<string | null>(null)
  const [dragOver,     setDragOver]     = useState<string | null>(null)

  // Project settings
  const [editingName,  setEditingName]  = useState(false)
  const [newName,      setNewName]      = useState(projectName)
  const [confirmDel,   setConfirmDel]   = useState(false)

  const isOwnerOrManager = members.some(m => m.user_id === userId && (m.role === 'owner' || m.role === 'manager'))
    || project?.owner_id === userId

  const fetchAll = useCallback(async () => {
    setLoading(true)

    const { data: proj } = await supabase
      .from('projects')
      .select('name,description,links,target_date,owner_id,workspace_id,logo_url')
      .eq('id', projectId).single()

    const wsId = proj?.workspace_id ?? ''
    if (proj?.logo_url) setLogoUrl(proj.logo_url)

    const [membersRes, featuresRes, milestonesRes, tasksRes, wsMembersRes] = await Promise.all([
      supabase.from('project_members')
        .select('user_id,role,profiles(full_name,email,avatar_url)')
        .eq('project_id', projectId),
      supabase.from('project_features')
        .select('id,name,color,milestone_id')
        .eq('project_id', projectId),
      supabase.from('project_milestones')
        .select('id,name,position,target_date,is_current')
        .eq('project_id', projectId).order('position'),
      supabase.from('tasks')
        .select('id,status,due_date,feature_id,last_edited_by,last_edited_at,title,assignee_id')
        .eq('project_id', projectId),
      wsId
        ? supabase.from('workspace_members')
            .select('user_id,email,role')
            .eq('workspace_id', wsId)
        : Promise.resolve({ data: [] as unknown[], error: null }),
    ])

    if (proj) { setProject(proj as ProjectData); setEditDesc(proj.description ?? '') }
    if (milestonesRes.data) setMilestones(milestonesRes.data as Milestone[])

    const tasks = tasksRes.data ?? []
    const now   = new Date()

    type RawM = {
      user_id: string
      role: string
      email?: string | null
      profiles?: ProfileLite | ProfileLite[] | null
    }
    const memberIds = [
      ...((membersRes.data ?? []) as unknown as RawM[]).map(m => m.user_id),
      ...((wsMembersRes.data ?? []) as unknown as RawM[]).map(m => m.user_id),
      proj?.owner_id,
    ].filter(Boolean) as string[]
    const { data: fetchedProfiles } = memberIds.length
      ? await supabase.from('profiles').select('id,full_name,email,avatar_url').in('id', [...new Set(memberIds)])
      : { data: [] as ProfileLite[] }
    const profileMap: Record<string, ProfileLite> = {}
    for (const p of (fetchedProfiles ?? []) as ProfileLite[]) {
      if (p.id) profileMap[p.id] = p
    }
    const profileFor = (m: RawM): ProfileLite => {
      const joined = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      return joined ?? profileMap[m.user_id] ?? {
        full_name: null,
        email: m.email ?? 'Unknown member',
        avatar_url: null,
      }
    }

    // Merge project_members + workspace_members. Project roles take priority;
    // workspace rows fill in the rest so project Team reflects real access.
    const seen = new Set<string>()
    const allRaw: (RawM & { sourceRole: 'owner'|'manager'|'member' })[] = []

    for (const m of (membersRes.data ?? []) as unknown as RawM[]) {
      if (!m.user_id) continue
      seen.add(m.user_id)
      const r = (m.role === 'owner' || m.role === 'manager' || m.role === 'member') ? m.role as 'owner'|'manager'|'member' : 'member'
      allRaw.push({ ...m, sourceRole: r })
    }
    for (const m of (wsMembersRes.data ?? []) as unknown as RawM[]) {
      if (!m.user_id) continue
      if (!seen.has(m.user_id)) {
        seen.add(m.user_id)
        allRaw.push({ ...m, sourceRole: mapWsRole(m.role) })
      }
    }
    if (proj?.owner_id && !seen.has(proj.owner_id)) {
      allRaw.unshift({
        user_id: proj.owner_id,
        role: 'owner',
        profiles: profileMap[proj.owner_id] ?? null,
        sourceRole: 'owner',
      })
    }

    const built: Member[] = allRaw.map(m => ({
      user_id: m.user_id,
      role: m.sourceRole,
      profile: profileFor(m),
      activeTaskCount: tasks.filter(t => t.assignee_id === m.user_id && t.status === 'in_progress').length,
      doneTaskCount:   tasks.filter(t => t.assignee_id === m.user_id && t.status === 'done').length,
    }))
    built.sort((a, b) => ({ owner:0, manager:1, member:2 }[a.role] - { owner:0, manager:1, member:2 }[b.role]))
    setMembers(built)

    if (featuresRes.data) {
      type RawF = { id: string; name: string; color: string; milestone_id: string | null }
      const fBuilt: Feature[] = (featuresRes.data as RawF[]).map(f => {
        const ft   = tasks.filter(t => t.feature_id === f.id)
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

    const recent = [...tasks]
      .filter(t => t.last_edited_at)
      .sort((a, b) => new Date(b.last_edited_at!).getTime() - new Date(a.last_edited_at!).getTime())
      .slice(0, 5)
    const mMap: Record<string, string> = {}
    for (const m of allRaw) {
      const p = profileFor(m)
      mMap[m.user_id] = p.full_name?.split(' ')[0] ?? p.email ?? 'Someone'
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

  // ── Actions ──
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

  const setCurrentMs = async (id: string) => {
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
    setEditingPhase(null)
  }

  const addPhase = async () => {
    const position = milestones.length
    const { data } = await supabase.from('project_milestones')
      .insert({ project_id: projectId, name: 'New Phase', position, is_current: false })
      .select().single()
    if (data) {
      const ms = { id: data.id, name: data.name, position: data.position, target_date: null, is_current: false }
      setMilestones(prev => [...prev, ms])
      setEditingPhase(data.id); setPhaseName('New Phase'); setPhaseDate('')
    }
  }

  // ── Drag-to-reorder phases ──
  const handleDragStart = (id: string) => setDragPhase(id)
  const handleDragOver  = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOver(id) }
  const handleDrop      = async (targetId: string) => {
    if (!dragPhase || dragPhase === targetId) { setDragPhase(null); setDragOver(null); return }
    const from = milestones.findIndex(m => m.id === dragPhase)
    const to   = milestones.findIndex(m => m.id === targetId)
    if (from < 0 || to < 0) return
    const reordered = [...milestones]
    const [moved]   = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const updated   = reordered.map((m, i) => ({ ...m, position: i }))
    setMilestones(updated)
    setDragPhase(null); setDragOver(null)
    // Persist all positions
    await Promise.all(updated.map(m =>
      supabase.from('project_milestones').update({ position: m.position }).eq('id', m.id)
    ))
  }

  const renameProject = async () => {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('projects').update({ name: newName.trim() }).eq('id', projectId)
    onProjectRenamed?.(newName.trim())
    setEditingName(false); setSaving(false)
  }

  const deleteProject = async () => {
    await supabase.from('projects').delete().eq('id', projectId)
    onProjectDeleted?.()
    onClose()
  }

  // ── Derived ──
  const totalTasks   = features.reduce((s, f) => s + f.totalTasks, 0)
  const doneTasks    = features.reduce((s, f) => s + f.doneTasks, 0)
  const blockedCount = features.filter(f => f.health === 'blocked').length
  const overallPct   = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0
  const currentMs    = milestones.find(m => m.is_current)
  const overallH: Feature['health'] = blockedCount > 0 ? 'blocked'
    : features.some(f => f.health === 'at_risk') ? 'at_risk' : 'on_track'
  const days = project?.target_date
    ? Math.ceil((new Date(project.target_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    : null

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const inner = loading ? (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'32px', height:'32px', border:`2px solid rgba(124,58,237,0.15)`, borderTop:`2px solid ${C.accent}`, borderRadius:'50%', animation:'pdSpin 0.8s linear infinite' }} />
    </div>
  ) : (
    <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: inline ? '20px 24px 16px' : '20px 28px 16px', borderBottom:`1px solid ${C.border}` }}>

        {/* Row 1: Logo + Name + Phase badge + Settings */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
          <LogoUpload
            currentUrl={logoUrl}
            fallbackText={projectName}
            accentColor="#7c3aed"
            bucket="project-logos"
            entityId={projectId}
            table="projects"
            size={34}
            onUploaded={url => setLogoUrl(url)}
            editable={isOwnerOrManager}
          />

          {editingName ? (
            <div style={{ display:'flex', alignItems:'center', gap:'7px', flex:1 }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key==='Enter') renameProject(); if (e.key==='Escape') setEditingName(false) }}
                style={{ flex:1, background:'rgba(255,255,255,0.07)', border:`1px solid ${C.accent}`, borderRadius:'7px', padding:'6px 12px', color:C.text, fontSize:'16px', fontFamily:'Inter, sans-serif', fontWeight:600, outline:'none' }} />
              <button onClick={renameProject} disabled={saving} style={{ padding:'5px 12px', background:C.accent, border:'none', borderRadius:'6px', color:'white', fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer', flexShrink:0 }}>Save</button>
              <button onClick={() => setEditingName(false)} style={{ padding:'5px 12px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'6px', color:C.muted, fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer', flexShrink:0 }}>Cancel</button>
            </div>
          ) : (
            <h2 style={{ color:C.text, fontSize:'17px', fontFamily:'Inter, sans-serif', fontWeight:600, margin:0, letterSpacing:'-0.02em', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{projectName}</h2>
          )}

          {currentMs && !editingName && (
            <div style={{ display:'flex', alignItems:'center', gap:'5px', background:'rgba(124,58,237,0.12)', border:`1px solid rgba(124,58,237,0.3)`, borderRadius:'5px', padding:'3px 10px', flexShrink:0 }}>
              <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:C.accent }} />
              <span style={{ color:C.accentLt, fontSize:'11px', fontFamily:'Inter, sans-serif', fontWeight:500 }}>{currentMs.name}</span>
            </div>
          )}

          {/* Settings button — always visible, right-aligned */}
          {isOwnerOrManager && !editingName && (
            <Btn onClick={() => setShowSettings(s => !s)} title="Project settings">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 1.5v1.3M8 13.2V14.5M14.5 8h-1.3M2.8 8H1.5M12.5 3.5l-.9.9M4.4 11.6l-.9.9M12.5 12.5l-.9-.9M4.4 4.4l-.9-.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </Btn>
          )}
          {!inline && (
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:'6px', width:'28px', height:'28px', display:'flex', alignItems:'center', justifyContent:'center', color:C.muted, cursor:'pointer', fontSize:'13px', flexShrink:0 }}>✕</button>
          )}
        </div>

        {/* Row 2: Description */}
        {editingDesc ? (
          <div style={{ display:'flex', gap:'8px' }}>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
              style={{ flex:1, background:'rgba(255,255,255,0.05)', border:`1px solid rgba(124,58,237,0.4)`, borderRadius:'7px', padding:'7px 11px', color:C.text, fontSize:'13px', fontFamily:'Inter, sans-serif', resize:'none', outline:'none' }} />
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <button onClick={saveDesc} disabled={saving} style={{ padding:'5px 12px', background:C.accent, border:'none', borderRadius:'6px', color:'white', fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>{saving ? '…' : 'Save'}</button>
              <button onClick={() => setEditingDesc(false)} style={{ padding:'5px 12px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'6px', color:C.muted, fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p onClick={() => isOwnerOrManager && setEditingDesc(true)}
            style={{ color: project?.description ? C.muted : C.faint, fontSize:'13px', fontFamily:'Inter, sans-serif', margin:0, cursor: isOwnerOrManager ? 'text' : 'default', fontStyle: project?.description ? 'normal' : 'italic', lineHeight:1.5 }}>
            {project?.description ?? (isOwnerOrManager ? 'Click to add a project description…' : 'No description')}
          </p>
        )}

        {/* Row 3: Settings panel (inline dropdown) */}
        {showSettings && isOwnerOrManager && (
          <div style={{ marginTop:'12px', padding:'14px', background:'rgba(124,58,237,0.06)', border:`1px solid rgba(124,58,237,0.2)`, borderRadius:'8px', display:'flex', flexDirection:'column', gap:'8px' }}>
            <p style={{ color:C.accentLt, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', margin:'0 0 4px' }}>Project settings</p>
            <button onClick={() => { setEditingName(true); setShowSettings(false) }}
              style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, borderRadius:'6px', color:C.text, cursor:'pointer', fontSize:'13px', fontFamily:'Inter, sans-serif', textAlign:'left' }}>
              <EditIcon /> Rename project
            </button>
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:'6px', color:'#f87171', cursor:'pointer', fontSize:'13px', fontFamily:'Inter, sans-serif', textAlign:'left' }}>
                <TrashIcon /> Delete project
              </button>
            ) : (
              <div style={{ padding:'10px 12px', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:'6px' }}>
                <p style={{ color:'#f87171', fontSize:'13px', fontFamily:'Inter, sans-serif', margin:'0 0 10px' }}>Delete <strong>{projectName}</strong>? This can't be undone.</p>
                <div style={{ display:'flex', gap:'7px' }}>
                  <button onClick={deleteProject} style={{ padding:'5px 14px', background:'#dc2626', border:'none', borderRadius:'5px', color:'white', fontSize:'12px', fontFamily:'Inter, sans-serif', fontWeight:600, cursor:'pointer' }}>Yes, delete</button>
                  <button onClick={() => setConfirmDel(false)} style={{ padding:'5px 14px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'5px', color:C.muted, fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STAT STRIP ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', padding: inline ? '16px 24px' : '16px 28px', borderBottom:`1px solid ${C.border}` }}>
        {[
          { label:'Health',   value: HEALTH[overallH].label, sub:`${blockedCount} blocked`,              color: HEALTH[overallH].color, dot:true },
          { label:'Progress', value:`${overallPct}%`,         sub:`${doneTasks} / ${totalTasks} tasks`,  color: C.accentLt },
          { label:'Team',     value:String(members.length),   sub:`${members.filter(m=>m.activeTaskCount>0).length} active now`, color:'#60a5fa' },
          {
            label: days===null ? 'Deadline' : days<0 ? 'Overdue by' : 'Days left',
            value: days===null ? '—' : String(Math.abs(days)),
            sub:   project?.target_date ? new Date(project.target_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'No deadline set',
            color: days!==null && days<7 ? '#dc2626' : days!==null && days<14 ? '#d97706' : '#16a34a',
          },
        ].map(s => (
          <div key={s.label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'12px 14px' }}>
            <p style={{ color:C.muted, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.07em', margin:'0 0 5px', textTransform:'uppercase' }}>{s.label}</p>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              {s.dot && <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:s.color, flexShrink:0 }} />}
              <p style={{ color:s.color, fontSize:'19px', fontFamily:'Inter, sans-serif', fontWeight:600, margin:0 }}>{s.value}</p>
            </div>
            <p style={{ color:C.muted, fontSize:'11px', fontFamily:'Inter, sans-serif', margin:'3px 0 0' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0', flex:1 }}>

        {/* LEFT COLUMN */}
        <div style={{ borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column' }}>

          {/* Phases — vertical list, drag to reorder */}
          <div style={{ padding: inline ? '16px 24px' : '16px 28px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <p style={{ color:C.muted, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', margin:0 }}>
                Phases <span style={{ color:C.faint, fontWeight:400, fontSize:'9px' }}>· drag to reorder · click to activate</span>
              </p>
              {isOwnerOrManager && <Btn onClick={addPhase} title="Add phase"><PlusIcon /></Btn>}
            </div>

            {milestones.length === 0 ? (
              <p style={{ color:C.faint, fontSize:'13px', fontFamily:'Inter, sans-serif', margin:0 }}>No phases yet — click + to add one</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                {milestones.map(m => {
                  const activeIdx = milestones.findIndex(x => x.is_current) >= 0 ? milestones.findIndex(x => x.is_current) : 0
                  const idx       = milestones.findIndex(x => x.id === m.id)
                  const isPast    = idx < activeIdx
                  const isCurrent = m.is_current
                  const isDraggedOver = dragOver === m.id && dragPhase !== m.id
                  const isEditing = editingPhase === m.id

                  return (
                    <div key={m.id}
                      draggable={isOwnerOrManager}
                      onDragStart={() => handleDragStart(m.id)}
                      onDragOver={e => handleDragOver(e, m.id)}
                      onDrop={() => handleDrop(m.id)}
                      onDragEnd={() => { setDragPhase(null); setDragOver(null) }}
                      style={{ opacity: dragPhase === m.id ? 0.4 : 1, transition:'opacity 0.15s' }}>

                      <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', background: isDraggedOver ? 'rgba(124,58,237,0.08)' : isCurrent ? 'rgba(124,58,237,0.06)' : 'rgba(255,255,255,0.02)', border:`1px solid ${isDraggedOver ? 'rgba(124,58,237,0.4)' : isCurrent ? 'rgba(124,58,237,0.25)' : C.border}`, borderRadius:'7px', cursor:'pointer', transition:'all 0.15s' }}>

                        {/* Drag handle */}
                        {isOwnerOrManager && (
                          <div style={{ color:C.faint, cursor:'grab', flexShrink:0, display:'flex' }}>
                            <GripIcon />
                          </div>
                        )}

                        {/* Status indicator */}
                        <div onClick={() => isOwnerOrManager && setCurrentMs(m.id)}
                          style={{ width:'22px', height:'22px', borderRadius:'50%', background: isPast ? '#16a34a' : isCurrent ? C.accent : 'rgba(255,255,255,0.05)', border:`2px solid ${isPast ? '#16a34a' : isCurrent ? C.accent : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color: isPast||isCurrent ? 'white' : C.faint, fontWeight:600, flexShrink:0 }}>
                          {isPast ? '✓' : isCurrent ? '⚡' : '○'}
                        </div>

                        {/* Name */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ color: isCurrent ? C.accentLt : isPast ? '#4ade80' : C.text, fontSize:'13px', fontFamily:'Inter, sans-serif', fontWeight: isCurrent ? 600 : 400, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</p>
                          {m.target_date && <p style={{ color:C.faint, fontSize:'10px', fontFamily:'JetBrains Mono, monospace', margin:'1px 0 0' }}>{new Date(m.target_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>}
                        </div>

                        {/* Edit button */}
                        {isOwnerOrManager && (
                          <Btn onClick={() => { setEditingPhase(isEditing ? null : m.id); setPhaseName(m.name); setPhaseDate(m.target_date ?? '') }} title="Edit phase">
                            <EditIcon />
                          </Btn>
                        )}
                      </div>

                      {/* Inline edit form */}
                      {isEditing && (
                        <div style={{ padding:'10px 12px', background:'rgba(124,58,237,0.05)', border:`1px solid rgba(124,58,237,0.2)`, borderRadius:'7px', marginTop:'4px', display:'flex', flexDirection:'column', gap:'6px' }}>
                          <input value={phaseName} onChange={e => setPhaseName(e.target.value)} placeholder="Phase name"
                            style={{ background:'rgba(255,255,255,0.06)', border:`1px solid ${C.border}`, borderRadius:'5px', padding:'6px 9px', color:C.text, fontSize:'13px', fontFamily:'Inter, sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }} />
                          <input type="date" value={phaseDate} onChange={e => setPhaseDate(e.target.value)}
                            style={{ background:'rgba(255,255,255,0.06)', border:`1px solid ${C.border}`, borderRadius:'5px', padding:'6px 9px', color:C.text, fontSize:'12px', fontFamily:'Inter, sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }} />
                          <div style={{ display:'flex', gap:'6px' }}>
                            <button onClick={() => savePhase(m.id)} disabled={saving} style={{ flex:1, padding:'6px', background:C.accent, border:'none', borderRadius:'5px', color:'white', fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>Save</button>
                            <button onClick={() => setEditingPhase(null)} style={{ flex:1, padding:'6px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'5px', color:C.muted, fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>Cancel</button>
                            <Btn onClick={() => deletePhase(m.id)} title="Delete phase" danger><TrashIcon /></Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Features — grouped by phase, color auto-assigned by phase position */}
          <div style={{ padding: inline ? '16px 24px' : '16px 28px', flex:1, overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <p style={{ color:C.muted, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', margin:0 }}>Features</p>
              {isOwnerOrManager && <Btn onClick={() => setShowAddFeature(true)} title="Add feature"><PlusIcon /></Btn>}
            </div>
            {features.length === 0
              ? <p style={{ color:C.faint, fontSize:'13px', fontFamily:'Inter, sans-serif', margin:0 }}>No features yet — click + to add one</p>
              : (() => {
                  // Phase color palette — one distinct color per phase position
                  const PHASE_PALETTE = [
                    '#4ade80', // Kickoff — green (done)
                    '#7c3aed', // Designing — violet (current)
                    '#2563eb', // Phase 1 — blue
                    '#d97706', // Review — amber
                    '#dc2626', // Delivery — red
                    '#0891b2', // extra
                    '#db2777', // extra
                    '#65a30d', // extra
                  ]

                  // Group features by milestone
                  const unphased = features.filter(f => !f.milestone_id)
                  const grouped = milestones.map(m => ({
                    milestone: m,
                    phaseColor: PHASE_PALETTE[m.position] ?? PHASE_PALETTE[m.position % PHASE_PALETTE.length],
                    features: features.filter(f => f.milestone_id === m.id),
                  })).filter(g => g.features.length > 0)

                  const renderFeatureRow = (f: Feature, phaseColor: string) => {
                    const hc  = HEALTH[f.health]
                    const pct = f.totalTasks ? Math.round((f.doneTasks / f.totalTasks) * 100) : 0
                    const displayColor = phaseColor // use phase color, ignore stored color
                    return (
                      <div key={f.id}
                        style={{ display:'flex', alignItems:'center', gap:'9px', padding:'7px 10px', background:'rgba(255,255,255,0.02)', border:`1px solid ${C.border}`, borderRadius:'7px', marginBottom:'5px', transition:'border-color 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = displayColor+'50' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}>
                        <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:displayColor, flexShrink:0 }} />
                        <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => onFeatureClick(f.id, f.name)}>
                          <p style={{ color:C.text, fontSize:'13px', fontFamily:'Inter, sans-serif', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</p>
                        </div>
                        <div style={{ width:'44px', height:'2px', background:C.border, borderRadius:'1px', flexShrink:0 }}>
                          <div style={{ width:`${pct}%`, height:'100%', background:displayColor, borderRadius:'1px' }} />
                        </div>
                        <span style={{ color:C.muted, fontSize:'10px', fontFamily:'JetBrains Mono, monospace', minWidth:'24px', textAlign:'right' }}>{pct}%</span>
                        <div style={{ background:hc.bg, border:`1px solid ${hc.border}`, borderRadius:'4px', padding:'1px 6px', flexShrink:0 }}>
                          <span style={{ color:hc.color, fontSize:'9px', fontFamily:'Inter, sans-serif', fontWeight:600 }}>{hc.label}</span>
                        </div>
                        {isOwnerOrManager && (
                          <button
                            onClick={e => { e.stopPropagation(); setEditingFeature(f) }}
                            title="Edit feature"
                            style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, padding:'4px', borderRadius:'5px', display:'flex', alignItems:'center', flexShrink:0 }}
                            onMouseEnter={e2 => { (e2.currentTarget as HTMLElement).style.color = C.accentLt }}
                            onMouseLeave={e2 => { (e2.currentTarget as HTMLElement).style.color = C.muted }}>
                            <EditIcon />
                          </button>
                        )}
                      </div>
                    )
                  }

                  return (
                    <>
                      {grouped.map(({ milestone: m, phaseColor, features: mFeatures }) => (
                        <div key={m.id} style={{ marginBottom:'14px' }}>
                          {/* Phase header */}
                          <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'6px' }}>
                            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:phaseColor, flexShrink:0 }} />
                            <span style={{ color:phaseColor, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>{m.name}</span>
                            <div style={{ flex:1, height:'1px', background:C.border }} />
                            <span style={{ color:C.faint, fontSize:'10px', fontFamily:'JetBrains Mono, monospace' }}>{mFeatures.length}</span>
                          </div>
                          {mFeatures.map(f => renderFeatureRow(f, phaseColor))}
                        </div>
                      ))}
                      {unphased.length > 0 && (
                        <div style={{ marginBottom:'14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'6px' }}>
                            <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:C.faint, flexShrink:0 }} />
                            <span style={{ color:C.faint, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>No phase</span>
                            <div style={{ flex:1, height:'1px', background:C.border }} />
                            <span style={{ color:C.faint, fontSize:'10px', fontFamily:'JetBrains Mono, monospace' }}>{unphased.length}</span>
                          </div>
                          {unphased.map(f => renderFeatureRow(f, C.faint))}
                        </div>
                      )}
                    </>
                  )
                })()
            }
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display:'flex', flexDirection:'column' }}>

          {/* Team */}
          <div style={{ padding: inline ? '16px 24px' : '16px 28px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <p style={{ color:C.muted, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', margin:0 }}>Team</p>
              {isOwnerOrManager && <Btn onClick={() => setShowInvite(true)} title="Add member"><PlusIcon /></Btn>}
            </div>
            {members.length === 0
              ? <p style={{ color:C.faint, fontSize:'13px', fontFamily:'Inter, sans-serif', margin:0 }}>No members — click + to add</p>
              : members.map((m, i) => {
                  const rc   = ROLE_CFG[m.role]
                  const name = m.profile?.full_name ?? m.profile?.email ?? 'Unknown'
                  return (
                    <div key={m.user_id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom: i < members.length-1 ? `1px solid ${C.border}` : 'none' }}>
                      <Avatar name={name} avatarUrl={m.profile?.avatar_url ?? null} size={30} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ color:C.text, fontSize:'13px', fontFamily:'Inter, sans-serif', fontWeight:500, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</p>
                        <p style={{ color:C.muted, fontSize:'11px', fontFamily:'Inter, sans-serif', margin:'1px 0 0' }}>
                          {m.activeTaskCount > 0 ? `${m.activeTaskCount} active` : 'No active tasks'} · {m.doneTaskCount} done
                        </p>
                      </div>
                      <div style={{ background:rc.bg, border:`1px solid ${rc.border}`, borderRadius:'4px', padding:'2px 7px', flexShrink:0 }}>
                        <span style={{ color:rc.color, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:500 }}>{rc.label}</span>
                      </div>
                    </div>
                  )
                })
            }
          </div>

          {/* Links */}
          <div style={{ padding: inline ? '16px 24px' : '16px 28px', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
              <p style={{ color:C.muted, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', margin:0 }}>Project links</p>
              {isOwnerOrManager && !addingLink && <Btn onClick={() => setAddingLink(true)} title="Add link"><PlusIcon /></Btn>}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {(project?.links ?? []).map((link, i) => {
                const lc = LINK_COLORS[link.type] ?? LINK_COLORS.other
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'9px', padding:'7px 10px', background:lc.bg, border:`1px solid ${lc.border}`, borderRadius:'7px' }}>
                    <span style={{ color:lc.text, fontSize:'10px', fontFamily:'JetBrains Mono, monospace', fontWeight:600, flexShrink:0, minWidth:'22px', textAlign:'center' }}>{LINK_ICONS[link.type]??'↗'}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:C.text, fontSize:'12px', fontFamily:'Inter, sans-serif', fontWeight:500, margin:0 }}>{link.label}</p>
                      <a href={link.url} target="_blank" rel="noreferrer" style={{ color:lc.text, fontSize:'11px', fontFamily:'JetBrains Mono, monospace', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{link.url.replace(/^https?:\/\//,'')}</a>
                    </div>
                    {isOwnerOrManager && (
                      <Btn onClick={() => removeLink(i)}>
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      </Btn>
                    )}
                  </div>
                )
              })}
              {addingLink ? (
                <div style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:'7px', padding:'10px' }}>
                  {[{ph:'Label', key:'label'},{ph:'https://…',key:'url'}].map(({ph,key}) => (
                    <input key={key} placeholder={ph}
                      value={key==='label' ? newLink.label : newLink.url}
                      onChange={e => setNewLink(p => ({...p, [key]: e.target.value}))}
                      style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, borderRadius:'5px', padding:'6px 9px', color:C.text, fontSize:'12px', fontFamily:'Inter, sans-serif', outline:'none', marginBottom:'5px' }} />
                  ))}
                  <select value={newLink.type} onChange={e => setNewLink(p=>({...p,type:e.target.value as ProjectLink['type']}))}
                    style={{ width:'100%', background:'#111118', border:`1px solid ${C.border}`, borderRadius:'5px', padding:'6px 9px', color:C.text, fontSize:'12px', fontFamily:'Inter, sans-serif', outline:'none', marginBottom:'8px' }}>
                    {['github','live','figma','supabase','notion','other'].map(t=><option key={t} value={t} style={{background:'#111118'}}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={addLink} disabled={saving} style={{ flex:1, padding:'6px', background:C.accent, border:'none', borderRadius:'5px', color:'white', fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>{saving?'…':'Add'}</button>
                    <button onClick={() => setAddingLink(false)} style={{ flex:1, padding:'6px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:'5px', color:C.muted, fontSize:'12px', fontFamily:'Inter, sans-serif', cursor:'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                (project?.links ?? []).length === 0 && isOwnerOrManager && (
                  <button onClick={() => setAddingLink(true)} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'7px 10px', background:'transparent', border:`1px dashed ${C.border}`, borderRadius:'7px', color:C.muted, cursor:'pointer', fontSize:'12px', fontFamily:'Inter, sans-serif', width:'100%', textAlign:'left' }}>
                    + Add link (Figma, GitHub, staging URL…)
                  </button>
                )
              )}
            </div>
          </div>

          {/* Activity */}
          <div style={{ padding: inline ? '16px 24px' : '16px 28px', flex:1 }}>
            <p style={{ color:C.muted, fontSize:'10px', fontFamily:'Inter, sans-serif', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', margin:'0 0 12px' }}>Recent activity</p>
            {activity.length === 0
              ? <p style={{ color:C.faint, fontSize:'13px', fontFamily:'Inter, sans-serif', margin:0 }}>No recent activity</p>
              : activity.map((a, i) => (
                  <div key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:'9px', padding:'7px 0', borderBottom: i<activity.length-1 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ width:'6px', height:'6px', borderRadius:'50%', background: ACTIVITY_COLORS[a.type]??C.accent, flexShrink:0, marginTop:'5px' }} />
                    <div style={{ flex:1 }}>
                      <p style={{ color:C.muted, fontSize:'12px', fontFamily:'Inter, sans-serif', margin:0, lineHeight:1.4 }}>
                        <span style={{ color:C.text, fontWeight:500 }}>{a.actor}</span>{' '}{a.action}{' '}<span style={{ color:C.text }}>{a.target}</span>
                      </p>
                      <p style={{ color:C.faint, fontSize:'10px', fontFamily:'JetBrains Mono, monospace', margin:'2px 0 0' }}>{timeAgo(a.timestamp)}</p>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
    </div>
  )

  const modals = (
    <>
      {showAddFeature && <AddFeatureModal projectId={projectId} onAdded={fetchAll} onClose={() => setShowAddFeature(false)} />}
      {showInvite     && <InviteMemberModal projectId={projectId} onInvited={fetchAll} onClose={() => setShowInvite(false)} />}
      {editingFeature && (
        <EditFeatureModal
          feature={editingFeature}
          projectId={projectId}
          onSaved={fetchAll}
          onDeleted={fetchAll}
          onClose={() => setEditingFeature(null)}
        />
      )}
      <style>{`@keyframes pdSpin { to { transform:rotate(360deg); } }`}</style>
    </>
  )

  if (inline) {
    return (
      <div style={{ width:'100%', height:'100%', overflowY:'auto', background:'transparent', display:'flex', flexDirection:'column' }}>
        {inner}
        {modals}
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', display:'flex', alignItems:'stretch', justifyContent:'flex-end' }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'min(900px,96vw)', height:'100vh', overflowY:'auto', background:C.bg, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column' }}>
        {inner}
        {modals}
      </div>
    </div>
  )
}
