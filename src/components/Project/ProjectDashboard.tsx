import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'
import Avatar from '../Avatar'

interface Props {
  projectId: string
  projectName: string
  userId: string
  onClose: () => void
  onFeatureClick: (featureId: string, featureName: string) => void
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
  github:   { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.85)', border: 'rgba(255,255,255,0.15)' },
  live:     { bg: 'rgba(34,197,94,0.12)',   text: '#4ade80',                border: 'rgba(34,197,94,0.3)' },
  figma:    { bg: 'rgba(236,72,153,0.12)',   text: '#f472b6',                border: 'rgba(236,72,153,0.3)' },
  supabase: { bg: 'rgba(62,207,142,0.12)',   text: '#3ecf8e',                border: 'rgba(62,207,142,0.3)' },
  notion:   { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.75)', border: 'rgba(255,255,255,0.12)' },
  other:    { bg: 'rgba(167,139,250,0.12)',  text: '#a78bfa',                border: 'rgba(167,139,250,0.3)' },
}
const HEALTH_CONFIG = {
  on_track: { label: 'On track', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  at_risk:  { label: 'At risk',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  blocked:  { label: 'Blocked',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
}
const ROLE_CONFIG = {
  owner:   { label: 'Owner',   color: '#a78bfa', bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)' },
  manager: { label: 'Manager', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  border: 'rgba(96,165,250,0.35)' },
  member:  { label: 'Member',  color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)' },
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)
  return Math.ceil(diff / 86400000)
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'Just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  return `${d} days ago`
}

export default function ProjectDashboard({ projectId, projectName, userId, onClose, onFeatureClick }: Props) {
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
  const [saving,     setSaving]     = useState(false)

  const isOwnerOrManager = members.some(
    m => m.user_id === userId && (m.role === 'owner' || m.role === 'manager')
  ) || project?.owner_id === userId

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [projRes, membersRes, featuresRes, milestonesRes, tasksRes] = await Promise.all([
      supabase.from('projects').select('name,description,links,target_date,owner_id').eq('id', projectId).single(),
      supabase.from('project_members').select('user_id,role,profiles(full_name,email,avatar_url)').eq('project_id', projectId),
      supabase.from('project_features').select('id,name,color,milestone_id').eq('project_id', projectId),
      supabase.from('project_milestones').select('id,name,position,target_date,is_current').eq('project_id', projectId).order('position'),
      supabase.from('tasks').select('id,status,due_date,feature_id,last_edited_by,last_edited_at,title,assignee_id').eq('project_id', projectId),
    ])

    if (projRes.data) {
      setProject(projRes.data as ProjectData)
      setEditDesc(projRes.data.description ?? '')
    }
    if (milestonesRes.data) setMilestones(milestonesRes.data as Milestone[])

    const tasks = tasksRes.data ?? []
    const now = new Date()

    // Build members with task counts
    if (membersRes.data) {
      type RawMember = { user_id: string; role: 'owner' | 'manager' | 'member'; profiles: { full_name: string | null; email: string; avatar_url: string | null } }
      const built: Member[] = (membersRes.data as unknown as RawMember[]).map(m => ({
        user_id: m.user_id,
        role: m.role,
        profile: m.profiles,
        activeTaskCount: tasks.filter(t => t.assignee_id === m.user_id && t.status === 'in_progress').length,
        doneTaskCount:   tasks.filter(t => t.assignee_id === m.user_id && t.status === 'done').length,
      }))
      // Sort: owner first, then manager, then member
      built.sort((a, b) => {
        const order = { owner: 0, manager: 1, member: 2 }
        return order[a.role] - order[b.role]
      })
      setMembers(built)
    }

    // Build features with health
    if (featuresRes.data) {
      type RawFeature = { id: string; name: string; color: string; milestone_id: string | null }
      const built: Feature[] = (featuresRes.data as RawFeature[]).map(f => {
        const fTasks = tasks.filter(t => t.feature_id === f.id)
        const doneTasks = fTasks.filter(t => t.status === 'done').length
        const overdueTasks = fTasks.filter(t =>
          t.due_date && t.status !== 'done' && new Date(t.due_date) < now
        ).length
        const progress = fTasks.length ? Math.round((doneTasks / fTasks.length) * 100) : 0
        const hasHighPriorityStuck = false
        let health: Feature['health'] = 'on_track'
        if (overdueTasks > 0 || hasHighPriorityStuck) health = 'blocked'
        else if (progress < 30 && fTasks.length > 2) health = 'at_risk'
        return { ...f, totalTasks: fTasks.length, doneTasks, overdueTasks, health }
      })
      setFeatures(built)
    }

    // Build recent activity from last_edited_at on tasks (max 5)
    const recentTasks = [...tasks]
      .filter(t => t.last_edited_at)
      .sort((a, b) => new Date(b.last_edited_at!).getTime() - new Date(a.last_edited_at!).getTime())
      .slice(0, 5)

    const memberMap: Record<string, string> = {}
    if (membersRes.data) {
      type RawMember2 = { user_id: string; profiles: { full_name: string | null; email: string } }
      for (const m of membersRes.data as unknown as RawMember2[]) {
        memberMap[m.user_id] = m.profiles?.full_name?.split(' ')[0] ?? m.profiles?.email ?? 'Someone'
      }
    }

    setActivity(recentTasks.map(t => ({
      id: t.id,
      actor: memberMap[t.last_edited_by ?? ''] ?? 'Someone',
      action: t.status === 'done' ? 'completed' : 'updated',
      target: t.title,
      timestamp: t.last_edited_at!,
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
    setEditMode(false)
    setSaving(false)
  }

  const addLink = async () => {
    if (!newLink.label || !newLink.url) return
    setSaving(true)
    const currentLinks: ProjectLink[] = project?.links ?? []
    const updated = [...currentLinks, newLink]
    await supabase.from('projects').update({ links: updated }).eq('id', projectId)
    setProject(p => p ? { ...p, links: updated } : p)
    setNewLink({ label: '', url: '', type: 'other' })
    setAddingLink(false)
    setSaving(false)
  }

  const removeLink = async (idx: number) => {
    const updated = (project?.links ?? []).filter((_, i) => i !== idx)
    await supabase.from('projects').update({ links: updated }).eq('id', projectId)
    setProject(p => p ? { ...p, links: updated } : p)
  }

  const days = daysUntil(project?.target_date ?? null)
  const totalTasks = features.reduce((s, f) => s + f.totalTasks, 0)
  const doneTasks  = features.reduce((s, f) => s + f.doneTasks, 0)
  const blockedCount = features.filter(f => f.health === 'blocked').length
  const overallPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0
  const currentMilestone = milestones.find(m => m.is_current)

  const overallHealth = blockedCount > 0 ? 'blocked'
    : features.some(f => f.health === 'at_risk') ? 'at_risk'
    : 'on_track'

  const ACTIVITY_COLORS: Record<string, string> = {
    complete: '#22c55e', block: '#ef4444', move: '#8b5cf6', add: '#60a5fa',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      {/* ── Slide-in panel (not modal — feels more native) ── */}
      <div style={{
        width: 'min(860px, 96vw)', height: '100vh', overflowY: 'auto',
        background: '#080410', borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexShrink: 0, position: 'sticky', top: 0,
          background: '#080410', zIndex: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#8b5cf6,#ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {projectName.charAt(0).toUpperCase()}
              </div>
              <h2 style={{ color: 'white', fontSize: '18px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0 }}>{projectName}</h2>
              {currentMilestone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '6px', padding: '3px 10px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#a78bfa' }} />
                  <span style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 600 }}>{currentMilestone.name}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {editMode ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={2}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(139,92,246,0.4)',
                    borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px',
                    fontFamily: 'Space Grotesk', resize: 'none', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button onClick={saveDescription} disabled={saving}
                    style={{ padding: '6px 14px', background: '#8b5cf6', border: 'none', borderRadius: '7px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, cursor: 'pointer' }}>
                    {saving ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '7px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'Space Grotesk', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p
                onClick={() => isOwnerOrManager && setEditMode(true)}
                style={{
                  color: project?.description ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                  fontSize: '13px', fontFamily: 'Space Grotesk', margin: '4px 0 0',
                  cursor: isOwnerOrManager ? 'text' : 'default',
                  fontStyle: project?.description ? 'normal' : 'italic',
                }}>
                {project?.description ?? (isOwnerOrManager ? 'Add a project description…' : 'No description')}
              </p>
            )}
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px', flexShrink: 0, marginLeft: '16px' }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '36px', height: '36px', margin: '0 auto 12px', border: '2px solid rgba(139,92,246,0.2)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'pdSpin 0.8s linear infinite' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', fontSize: '10px', letterSpacing: '0.2em' }}>LOADING…</p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ── STAT STRIP ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
              {[
                {
                  label: 'Overall health',
                  value: HEALTH_CONFIG[overallHealth].label,
                  sub: `${blockedCount} feature${blockedCount !== 1 ? 's' : ''} blocked`,
                  color: HEALTH_CONFIG[overallHealth].color,
                  dot: true,
                },
                {
                  label: 'Progress',
                  value: `${overallPct}%`,
                  sub: `${doneTasks} of ${totalTasks} tasks done`,
                  color: '#a78bfa',
                  dot: false,
                },
                {
                  label: 'Team size',
                  value: String(members.length),
                  sub: `${members.filter(m => m.activeTaskCount > 0).length} active now`,
                  color: '#60a5fa',
                  dot: false,
                },
                {
                  label: days === null ? 'Deadline' : days < 0 ? 'Overdue by' : 'Days left',
                  value: days === null ? '—' : Math.abs(days).toString(),
                  sub: project?.target_date ? `Target: ${new Date(project.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No deadline set',
                  color: days !== null && days < 7 ? '#ef4444' : days !== null && days < 14 ? '#f59e0b' : '#4ade80',
                  dot: false,
                },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 16px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: '0 0 6px' }}>{s.label.toUpperCase()}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    {s.dot && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />}
                    <p style={{ color: s.color, fontSize: '20px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0 }}>{s.value}</p>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '4px 0 0' }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* ── MILESTONE TIMELINE ── */}
            {milestones.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 20px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: '0 0 14px' }}>PHASE TIMELINE</p>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {milestones.map((m, i) => {
                    // Derive current from is_current flag; if none set, treat first as current
                    const currentIdx = milestones.findIndex(x => x.is_current)
                    const activeIdx  = currentIdx >= 0 ? currentIdx : 0
                    const isPast     = i < activeIdx
                    const isCurrent  = i === activeIdx
                    const col        = isPast ? '#4ade80' : isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.2)'
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', flex: i < milestones.length - 1 ? 1 : 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: isPast ? '#4ade80' : isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.06)',
                            border: `2px solid ${col}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700,
                            color: isPast ? '#000' : isCurrent ? '#fff' : 'rgba(255,255,255,0.35)',
                          }}>
                            {isPast ? '✓' : isCurrent ? '⚡' : '○'}
                          </div>
                          <span style={{ color: isCurrent ? '#a78bfa' : isPast ? '#4ade80' : 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Grotesk', fontWeight: isCurrent ? 700 : 400, marginTop: '6px', whiteSpace: 'nowrap' }}>
                            {m.name}
                          </span>
                          {m.target_date && (
                            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono', marginTop: '2px' }}>
                              {new Date(m.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {i < milestones.length - 1 && (
                          <div style={{ flex: 1, height: '2px', background: isPast ? '#4ade80' : 'rgba(255,255,255,0.1)', margin: '0 4px', marginBottom: '22px' }} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── FEATURES + TEAM side by side ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

              {/* Features */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 20px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: '0 0 12px' }}>FEATURES</p>
                {features.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', fontFamily: 'Space Grotesk' }}>No features yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {features.map(f => {
                      const hc = HEALTH_CONFIG[f.health]
                      const pct = f.totalTasks ? Math.round((f.doneTasks / f.totalTasks) * 100) : 0
                      return (
                        <div key={f.id}
                          onClick={() => onFeatureClick(f.id, f.name)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = f.color + '60' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}
                        >
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <div style={{ width: '60px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', flexShrink: 0 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: f.color, borderRadius: '2px' }} />
                          </div>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', flexShrink: 0, minWidth: '28px', textAlign: 'right' }}>{pct}%</span>
                          <div style={{ background: hc.bg, border: `1px solid ${hc.border}`, borderRadius: '5px', padding: '2px 7px', flexShrink: 0 }}>
                            <span style={{ color: hc.color, fontSize: '9px', fontFamily: 'Space Mono', fontWeight: 700 }}>{hc.label.toUpperCase()}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Team */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 20px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: '0 0 12px' }}>TEAM</p>
                {members.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', fontFamily: 'Space Grotesk' }}>No team members yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {members.map(m => {
                      const rc = ROLE_CONFIG[m.role]
                      const name = m.profile.full_name ?? m.profile.email
                      return (
                        <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <Avatar name={name} avatarUrl={m.profile.avatar_url} size={30} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {name}
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: '1px 0 0' }}>
                              {m.activeTaskCount > 0 ? `${m.activeTaskCount} active` : 'No active tasks'} · {m.doneTaskCount} done
                            </p>
                          </div>
                          <div style={{ background: rc.bg, border: `1px solid ${rc.border}`, borderRadius: '5px', padding: '2px 8px', flexShrink: 0 }}>
                            <span style={{ color: rc.color, fontSize: '10px', fontFamily: 'Space Mono', fontWeight: 600 }}>{rc.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── LINKS + ACTIVITY side by side ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

              {/* Links */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 20px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: '0 0 12px' }}>PROJECT LINKS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(project?.links ?? []).map((link, i) => {
                    const lc = LINK_COLORS[link.type] ?? LINK_COLORS.other
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: lc.bg, border: `1px solid ${lc.border}`, borderRadius: '8px' }}>
                        <span style={{ color: lc.text, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700, flexShrink: 0, minWidth: '24px', textAlign: 'center' }}>
                          {LINK_ICONS[link.type] ?? '↗'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>{link.label}</p>
                          <a href={link.url} target="_blank" rel="noreferrer"
                            style={{ color: lc.text, fontSize: '11px', fontFamily: 'Space Mono', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {link.url.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                        {isOwnerOrManager && (
                          <button onClick={() => removeLink(i)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}>✕</button>
                        )}
                      </div>
                    )
                  })}

                  {/* Add link */}
                  {isOwnerOrManager && (
                    addingLink ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                        <input placeholder="Label (e.g. GitHub)" value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))}
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', outline: 'none' }} />
                        <input placeholder="https://…" value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))}
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', outline: 'none' }} />
                        <select value={newLink.type} onChange={e => setNewLink(p => ({ ...p, type: e.target.value as ProjectLink['type'] }))}
                          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', outline: 'none' }}>
                          {['github','live','figma','supabase','notion','other'].map(t => (
                            <option key={t} value={t} style={{ background: '#1a1a2e' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={addLink} disabled={saving}
                            style={{ flex: 1, padding: '6px', background: '#8b5cf6', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, cursor: 'pointer' }}>
                            {saving ? '…' : 'Add'}
                          </button>
                          <button onClick={() => setAddingLink(false)}
                            style={{ flex: 1, padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'Space Grotesk', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingLink(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '8px', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', width: '100%', textAlign: 'left' }}>
                        + Add link (Figma, Notion, staging URL…)
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Activity */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 20px' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: '0 0 12px' }}>RECENT ACTIVITY</p>
                {activity.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', fontFamily: 'Space Grotesk' }}>No recent activity</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {activity.map((a, i) => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: i < activity.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: ACTIVITY_COLORS[a.type] ?? '#8b5cf6', flexShrink: 0, marginTop: '4px' }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1.4 }}>
                            <span style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 600 }}>{a.actor}</span>
                            {' '}{a.action}{' '}
                            <span style={{ color: 'rgba(255,255,255,0.85)' }}>{a.target}</span>
                          </p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', margin: '2px 0 0' }}>{timeAgo(a.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      <style>{`@keyframes pdSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}