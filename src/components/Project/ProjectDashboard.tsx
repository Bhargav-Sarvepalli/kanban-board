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
  id: string
  name: string
  color: string
  milestone_id: string | null
  totalTasks: number
  doneTasks: number
  overdueTasks: number
  health: 'on_track' | 'at_risk' | 'blocked'
}

interface Milestone {
  id: string
  name: string
  position: number
  target_date: string | null
  is_current: boolean
}

interface ProjectLink {
  label: string
  url: string
  type: 'github' | 'live' | 'figma' | 'supabase' | 'notion' | 'other'
}

interface ProjectData {
  name: string
  description: string | null
  links: ProjectLink[]
  target_date: string | null
  owner_id: string
}

interface ActivityItem {
  id: string
  actor: string
  action: string
  target: string
  timestamp: string
  type: 'complete' | 'block' | 'move' | 'add'
}

const LINK_ICONS: Record<string, string> = {
  github: 'GH', live: '↗', figma: 'FG', supabase: 'SB', notion: 'NO', other: '🔗',
}
const LINK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  github:   { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.7)',  border: 'rgba(255,255,255,0.1)' },
  live:     { bg: 'rgba(22,163,74,0.1)',    text: '#4ade80',                border: 'rgba(22,163,74,0.25)' },
  figma:    { bg: 'rgba(219,39,119,0.1)',   text: '#f472b6',                border: 'rgba(219,39,119,0.25)' },
  supabase: { bg: 'rgba(62,207,142,0.1)',   text: '#3ecf8e',                border: 'rgba(62,207,142,0.25)' },
  notion:   { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.6)',  border: 'rgba(255,255,255,0.1)' },
  other:    { bg: 'rgba(124,58,237,0.1)',   text: '#a78bfa',                border: 'rgba(124,58,237,0.25)' },
}
const HEALTH_CFG = {
  on_track: { label: 'On track', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.25)' },
  at_risk:  { label: 'At risk',  color: '#d97706', bg: 'rgba(217,119,6,0.1)',   border: 'rgba(217,119,6,0.25)' },
  blocked:  { label: 'Blocked',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)',   border: 'rgba(220,38,38,0.25)' },
}
const ROLE_CFG = {
  owner:   { label: 'Owner',   color: '#a78bfa', bg: 'rgba(124,58,237,0.12)',  border: 'rgba(124,58,237,0.3)' },
  manager: { label: 'Manager', color: '#60a5fa', bg: 'rgba(37,99,235,0.12)',   border: 'rgba(37,99,235,0.3)' },
  member:  { label: 'Member',  color: '#6b6b7b', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
}
const ACTIVITY_COLORS: Record<string, string> = {
  complete: '#16a34a', block: '#dc2626', move: '#7c3aed', add: '#2563eb',
}

function timeAgo(ts: string): string {
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'Yesterday' : `${d} days ago`
}

// ── Stat card ──
function StatCard({ label, value, sub, color, dot }: { label: string; value: string; sub: string; color: string; dot?: boolean }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '14px 16px' }}>
      <p style={{ color: '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', margin: '0 0 6px', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        {dot && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />}
        <p style={{ color, fontSize: '20px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0 }}>{value}</p>
      </div>
      <p style={{ color: '#3d3d52', fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: '4px 0 0' }}>{sub}</p>
    </div>
  )
}

export default function ProjectDashboard({ projectId, projectName, userId, onClose, onFeatureClick, inline = false }: Props) {
  const [project,    setProject]    = useState<ProjectData | null>(null)
  const [members,    setMembers]    = useState<Member[]>([])
  const [features,   setFeatures]   = useState<Feature[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [activity,   setActivity]   = useState<ActivityItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [editMode,   setEditMode]   = useState(false)
  const [editDesc,   setEditDesc]   = useState('')
  const [addingLink, setAddingLink] = useState(false)
  const [newLink,    setNewLink]    = useState({ label: '', url: '', type: 'other' as ProjectLink['type'] })
  const [saving,          setSaving]          = useState(false)
  const [showAddFeature,  setShowAddFeature]  = useState(false)
  const [showInvite,      setShowInvite]      = useState(false)

  const isOwnerOrManager = members.some(m => m.user_id === userId && (m.role === 'owner' || m.role === 'manager'))
    || project?.owner_id === userId

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [projRes, membersRes, featuresRes, milestonesRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('name,description,links,target_date,owner_id').eq('id', projectId).single(),
      supabase.from('project_members').select('user_id,role,profiles(full_name,email,avatar_url)').eq('project_id', projectId),
      supabase.from('project_features').select('id,name,color,milestone_id').eq('project_id', projectId),
      supabase.from('project_milestones').select('id,name,position,target_date,is_current').eq('project_id', projectId).order('position'),
      supabase.from('tasks').select('id,status,due_date,feature_id,last_edited_by,last_edited_at,title,assignee_id').eq('project_id', projectId),
    ])

    if (projRes.data) { setProject(projRes.data as ProjectData); setEditDesc(projRes.data.description ?? '') }
    if (milestonesRes.data) setMilestones(milestonesRes.data as Milestone[])

    const tasks = tasksRes.data ?? []
    const now = new Date()

    if (membersRes.data) {
      type RawMember = { user_id: string; role: 'owner' | 'manager' | 'member'; profiles: { full_name: string | null; email: string; avatar_url: string | null } }
      const built: Member[] = (membersRes.data as unknown as RawMember[]).map(m => ({
        user_id: m.user_id, role: m.role, profile: m.profiles,
        activeTaskCount: tasks.filter(t => t.assignee_id === m.user_id && t.status === 'in_progress').length,
        doneTaskCount:   tasks.filter(t => t.assignee_id === m.user_id && t.status === 'done').length,
      }))
      built.sort((a, b) => ({ owner: 0, manager: 1, member: 2 }[a.role] - { owner: 0, manager: 1, member: 2 }[b.role]))
      setMembers(built)
    }

    if (featuresRes.data) {
      type RawFeature = { id: string; name: string; color: string; milestone_id: string | null }
      const built: Feature[] = (featuresRes.data as RawFeature[]).map(f => {
        const fTasks = tasks.filter(t => t.feature_id === f.id)
        const doneTasks    = fTasks.filter(t => t.status === 'done').length
        const overdueTasks = fTasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < now).length
        const progress = fTasks.length ? Math.round((doneTasks / fTasks.length) * 100) : 0
        let health: Feature['health'] = 'on_track'
        if (overdueTasks > 0) health = 'blocked'
        else if (progress < 30 && fTasks.length > 2) health = 'at_risk'
        return { ...f, totalTasks: fTasks.length, doneTasks, overdueTasks, health }
      })
      setFeatures(built)
    }

    const recentTasks = [...tasks].filter(t => t.last_edited_at)
      .sort((a, b) => new Date(b.last_edited_at!).getTime() - new Date(a.last_edited_at!).getTime())
      .slice(0, 5)

    const memberMap: Record<string, string> = {}
    if (membersRes.data) {
      type RawM2 = { user_id: string; profiles: { full_name: string | null; email: string } }
      for (const m of membersRes.data as unknown as RawM2[]) {
        memberMap[m.user_id] = m.profiles?.full_name?.split(' ')[0] ?? m.profiles?.email ?? 'Someone'
      }
    }
    setActivity(recentTasks.map(t => ({
      id: t.id, actor: memberMap[t.last_edited_by ?? ''] ?? 'Someone',
      action: t.status === 'done' ? 'completed' : 'updated',
      target: t.title, timestamp: t.last_edited_at!,
      type: t.status === 'done' ? 'complete' : 'move',
    })))
    setLoading(false)
  }, [projectId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchAll() }, [fetchAll])

  const saveDescription = async () => {
    setSaving(true)
    await supabase.from('projects').update({ description: editDesc }).eq('id', projectId)
    setProject(p => p ? { ...p, description: editDesc } : p)
    setEditMode(false); setSaving(false)
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

  const setCurrentMilestone = async (milestoneId: string) => {
    // Clear all is_current, then set the clicked one
    await supabase.from('project_milestones').update({ is_current: false }).eq('project_id', projectId)
    await supabase.from('project_milestones').update({ is_current: true }).eq('id', milestoneId)
    setMilestones(prev => prev.map(m => ({ ...m, is_current: m.id === milestoneId })))
  }
  const totalTasks    = features.reduce((s, f) => s + f.totalTasks, 0)
  const doneTasks     = features.reduce((s, f) => s + f.doneTasks, 0)
  const blockedCount  = features.filter(f => f.health === 'blocked').length
  const overallPct    = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0
  const currentMs     = milestones.find(m => m.is_current)
  const overallHealth: Feature['health'] = blockedCount > 0 ? 'blocked'
    : features.some(f => f.health === 'at_risk') ? 'at_risk' : 'on_track'

  const days = project?.target_date
    ? Math.ceil((new Date(project.target_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    : null

  // ── Shared content ──
  const headerSection = (
    <div style={{ padding: inline ? '0 0 20px' : '20px 28px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {projectName.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ color: '#e2e2e8', fontSize: '17px', fontFamily: 'Inter, sans-serif', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>{projectName}</h2>
          {currentMs && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '5px', padding: '2px 9px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#7c3aed' }} />
              <span style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{currentMs.name}</span>
            </div>
          )}
        </div>
        {editMode ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: '7px', padding: '7px 11px', color: '#e2e2e8', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button onClick={saveDescription} disabled={saving} style={{ padding: '5px 12px', background: '#7c3aed', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500, cursor: 'pointer' }}>{saving ? '…' : 'Save'}</button>
              <button onClick={() => setEditMode(false)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#6b6b7b', fontSize: '12px', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p onClick={() => isOwnerOrManager && setEditMode(true)}
            style={{ color: project?.description ? '#6b6b7b' : '#3d3d52', fontSize: '13px', fontFamily: 'Inter, sans-serif', margin: '4px 0 0', cursor: isOwnerOrManager ? 'text' : 'default', fontStyle: project?.description ? 'normal' : 'italic' }}>
            {project?.description ?? (isOwnerOrManager ? 'Add a project description…' : 'No description')}
          </p>
        )}
      </div>
      {!inline && (
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #1e1e2e', borderRadius: '7px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6b7b', cursor: 'pointer', fontSize: '14px', flexShrink: 0, marginLeft: '16px' }}>✕</button>
      )}
    </div>
  )

  const bodySection = loading ? (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '32px', height: '32px', border: '2px solid rgba(124,58,237,0.2)', borderTop: '2px solid #7c3aed', borderRadius: '50%', animation: 'pdSpin 0.8s linear infinite' }} />
    </div>
  ) : (
    <div style={{ padding: inline ? '20px 0' : '20px 28px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        <StatCard label="Health" value={HEALTH_CFG[overallHealth].label} sub={`${blockedCount} blocked`} color={HEALTH_CFG[overallHealth].color} dot />
        <StatCard label="Progress" value={`${overallPct}%`} sub={`${doneTasks} / ${totalTasks} tasks`} color="#7c3aed" />
        <StatCard label="Team" value={String(members.length)} sub={`${members.filter(m => m.activeTaskCount > 0).length} active now`} color="#2563eb" />
        <StatCard
          label={days === null ? 'Deadline' : days < 0 ? 'Overdue by' : 'Days left'}
          value={days === null ? '—' : String(Math.abs(days))}
          sub={project?.target_date ? new Date(project.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline set'}
          color={days !== null && days < 7 ? '#dc2626' : days !== null && days < 14 ? '#d97706' : '#16a34a'}
        />
      </div>

      {/* Milestone timeline */}
      {milestones.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '14px 18px' }}>
        <p style={{ color: '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', margin: '0 0 12px', textTransform: 'uppercase' }}>
          Phase timeline <span style={{ color: '#2a2a3d', fontWeight: 400 }}>· click to set current</span>
        </p>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {milestones.map((m, i) => {
              const activeIdx = (() => { const ci = milestones.findIndex(x => x.is_current); return ci >= 0 ? ci : 0 })()
              const isPast    = i < activeIdx
              const isCurrent = i === activeIdx
              const col       = isPast ? '#16a34a' : isCurrent ? '#7c3aed' : '#1e1e2e'
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', flex: i < milestones.length - 1 ? 1 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div
                      onClick={() => isOwnerOrManager && setCurrentMilestone(m.id)}
                      title={isOwnerOrManager ? 'Click to set as current phase' : undefined}
                      style={{ width: '26px', height: '26px', borderRadius: '50%', background: isPast ? '#16a34a' : isCurrent ? '#7c3aed' : 'rgba(255,255,255,0.04)', border: `2px solid ${col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: isPast || isCurrent ? 'white' : '#3d3d52', fontWeight: 600, cursor: isOwnerOrManager ? 'pointer' : 'default', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => { if (isOwnerOrManager && !isCurrent) (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}>
                      {isPast ? '✓' : isCurrent ? '⚡' : '○'}
                    </div>
                    <span style={{ color: isCurrent ? '#a78bfa' : isPast ? '#16a34a' : '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: isCurrent ? 600 : 400, marginTop: '5px', whiteSpace: 'nowrap' }}>{m.name}</span>
                    {m.target_date && <span style={{ color: '#2a2a3d', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>{new Date(m.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                  {i < milestones.length - 1 && <div style={{ flex: 1, height: '2px', background: isPast ? '#16a34a' : '#1e1e2e', margin: '0 4px', marginBottom: '22px' }} />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Features + Team */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ color: '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>Features</p>
            {isOwnerOrManager && (
              <button onClick={() => setShowAddFeature(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3d52', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7c3aed' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3d3d52' }}
                title="Add feature">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
          {features.length === 0
            ? <p style={{ color: '#2a2a3d', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No features yet</p>
            : features.map(f => {
                const hc  = HEALTH_CFG[f.health]
                const pct = f.totalTasks ? Math.round((f.doneTasks / f.totalTasks) * 100) : 0
                return (
                  <div key={f.id} onClick={() => onFeatureClick(f.id, f.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 9px', background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e', borderRadius: '6px', cursor: 'pointer', marginBottom: '6px', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = f.color + '50' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1e1e2e' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                    <span style={{ color: '#e2e2e8', fontSize: '13px', fontFamily: 'Inter, sans-serif', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <div style={{ width: '50px', height: '2px', background: '#1e1e2e', borderRadius: '1px', flexShrink: 0 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: f.color, borderRadius: '1px' }} />
                    </div>
                    <span style={{ color: '#3d3d52', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', minWidth: '26px', textAlign: 'right' }}>{pct}%</span>
                    <div style={{ background: hc.bg, border: `1px solid ${hc.border}`, borderRadius: '4px', padding: '1px 6px', flexShrink: 0 }}>
                      <span style={{ color: hc.color, fontSize: '9px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>{hc.label}</span>
                    </div>
                  </div>
                )
              })
          }
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ color: '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', margin: 0, textTransform: 'uppercase' }}>Team</p>
            {isOwnerOrManager && (
              <button onClick={() => setShowInvite(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3d52', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7c3aed' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3d3d52' }}
                title="Add team member">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
          {members.length === 0
            ? <p style={{ color: '#2a2a3d', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No members yet</p>
            : members.map((m, i) => {
                const rc   = ROLE_CFG[m.role]
                const name = m.profile.full_name ?? m.profile.email
                return (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 0', borderBottom: i < members.length - 1 ? '1px solid #1e1e2e' : 'none' }}>
                    <Avatar name={name} avatarUrl={m.profile.avatar_url} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: '#e2e2e8', fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                      <p style={{ color: '#3d3d52', fontSize: '11px', fontFamily: 'Inter, sans-serif', margin: '1px 0 0' }}>{m.activeTaskCount > 0 ? `${m.activeTaskCount} active` : 'No active tasks'}</p>
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

      {/* Links + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '14px 18px' }}>
          <p style={{ color: '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', margin: '0 0 10px', textTransform: 'uppercase' }}>Project links</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(project?.links ?? []).map((link, i) => {
              const lc = LINK_COLORS[link.type] ?? LINK_COLORS.other
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px 9px', background: lc.bg, border: `1px solid ${lc.border}`, borderRadius: '7px' }}>
                  <span style={{ color: lc.text, fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, flexShrink: 0, minWidth: '22px', textAlign: 'center' }}>{LINK_ICONS[link.type] ?? '↗'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#e2e2e8', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: 0 }}>{link.label}</p>
                    <a href={link.url} target="_blank" rel="noreferrer" style={{ color: lc.text, fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{link.url.replace(/^https?:\/\//, '')}</a>
                  </div>
                  {isOwnerOrManager && <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', color: '#3d3d52', cursor: 'pointer', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}>✕</button>}
                </div>
              )
            })}
            {isOwnerOrManager && (addingLink ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '9px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e2e', borderRadius: '7px' }}>
                <input placeholder="Label" value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '5px 9px', color: '#e2e2e8', fontSize: '12px', fontFamily: 'Inter, sans-serif', outline: 'none' }} />
                <input placeholder="https://…" value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '5px 9px', color: '#e2e2e8', fontSize: '12px', fontFamily: 'Inter, sans-serif', outline: 'none' }} />
                <select value={newLink.type} onChange={e => setNewLink(p => ({ ...p, type: e.target.value as ProjectLink['type'] }))} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: '5px', padding: '5px 9px', color: '#e2e2e8', fontSize: '12px', fontFamily: 'Inter, sans-serif', outline: 'none' }}>
                  {['github','live','figma','supabase','notion','other'].map(t => <option key={t} value={t} style={{ background: '#111118' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={addLink} disabled={saving} style={{ flex: 1, padding: '5px', background: '#7c3aed', border: 'none', borderRadius: '5px', color: 'white', fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500, cursor: 'pointer' }}>{saving ? '…' : 'Add'}</button>
                  <button onClick={() => setAddingLink(false)} style={{ flex: 1, padding: '5px', background: 'transparent', border: '1px solid #1e1e2e', borderRadius: '5px', color: '#6b6b7b', fontSize: '12px', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingLink(true)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 9px', background: 'transparent', border: '1px dashed #1e1e2e', borderRadius: '7px', color: '#3d3d52', cursor: 'pointer', fontSize: '12px', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }}>
                + Add link
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '14px 18px' }}>
          <p style={{ color: '#3d3d52', fontSize: '10px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.08em', margin: '0 0 10px', textTransform: 'uppercase' }}>Recent activity</p>
          {activity.length === 0
            ? <p style={{ color: '#2a2a3d', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>No recent activity</p>
            : activity.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '7px 0', borderBottom: i < activity.length - 1 ? '1px solid #1e1e2e' : 'none' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ACTIVITY_COLORS[a.type] ?? '#7c3aed', flexShrink: 0, marginTop: '5px' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#6b6b7b', fontSize: '12px', fontFamily: 'Inter, sans-serif', margin: 0, lineHeight: 1.4 }}>
                      <span style={{ color: '#e2e2e8', fontWeight: 500 }}>{a.actor}</span>
                      {' '}{a.action}{' '}
                      <span style={{ color: '#e2e2e8' }}>{a.target}</span>
                    </p>
                    <p style={{ color: '#2a2a3d', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', margin: '2px 0 0' }}>{timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )

  if (inline) {
    return (
      <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {headerSection}
        {bodySection}
        <style>{`@keyframes pdSpin { to { transform: rotate(360deg); } }`}</style>
        {showAddFeature && <AddFeatureModal projectId={projectId} onAdded={fetchAll} onClose={() => setShowAddFeature(false)} />}
        {showInvite && <InviteMemberModal projectId={projectId} onInvited={fetchAll} onClose={() => setShowInvite(false)} />}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: 'min(860px, 96vw)', height: '100vh', overflowY: 'auto', background: '#0a0a0f', borderLeft: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column' }}>
        {headerSection}
        {bodySection}
        <style>{`@keyframes pdSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
      {showAddFeature && <AddFeatureModal projectId={projectId} onAdded={fetchAll} onClose={() => setShowAddFeature(false)} />}
      {showInvite && <InviteMemberModal projectId={projectId} onInvited={fetchAll} onClose={() => setShowInvite(false)} />}
    </div>
  )
}