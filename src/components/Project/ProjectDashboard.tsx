import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../supabase'
import type { Profile } from '../../types'
import Avatar from '../Avatar'

// ── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string
  name: string
  position: number
  target_date: string | null
  is_current: boolean
}

interface FeatureTask {
  id: string
  title: string
  status: string
  priority: string
  assignee_id: string | null
  due_date: string | null
}

interface Feature {
  id: string
  name: string
  milestone_id: string | null
  tasks: FeatureTask[]
  taskTotal: number
  taskDone: number
  taskInProgress: number
  taskBlocked: number   // overdue + high priority not started
  progress: number
  assignees: Profile[]
  health: 'on_track' | 'at_risk' | 'blocked'
}

interface Props {
  projectId: string
  projectName: string
  userId: string
  onClose: () => void
  onFeatureClick: (featureId: string, featureName: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeHealth(f: Feature): 'on_track' | 'at_risk' | 'blocked' {
  const overdue = f.tasks.filter(t =>
    t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()
  ).length
  if (overdue > 0 || f.taskBlocked > 0) return 'blocked'
  if (f.progress < 30 && f.taskTotal > 2) return 'at_risk'
  return 'on_track'
}

const HEALTH_CONFIG = {
  on_track: { label: 'ON TRACK', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  at_risk:  { label: 'AT RISK',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  blocked:  { label: 'BLOCKED',  color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
}

const FEATURE_COLORS = [
  '#8b5cf6', '#38bdf8', '#34d399', '#f472b6',
  '#fb923c', '#a78bfa', '#22d3ee', '#f87171',
]

const STATUS_COLS = [
  { key: 'todo',        label: 'To Do',      color: '#64748b' },
  { key: 'in_progress', label: 'In Progress', color: '#8b5cf6' },
  { key: 'in_review',   label: 'In Review',   color: '#f59e0b' },
  { key: 'done',        label: 'Done',        color: '#34d399' },
]

function isOverdue(t: FeatureTask) {
  return !!t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date()
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ProjectDashboard({ projectId, projectName, onClose, onFeatureClick }: Props) {
  const [milestones, setMilestones]           = useState<Milestone[]>([])
  const [features, setFeatures]               = useState<Feature[]>([])
  const [loading, setLoading]                 = useState(true)
  const [currentMsId, setCurrentMsId]         = useState<string | null>(null)
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null)
  const [addingFeature, setAddingFeature]     = useState<string | null>(null)
  const [newFeatureName, setNewFeatureName]   = useState('')
  const [addingPhase, setAddingPhase]         = useState(false)
  const [newPhaseName, setNewPhaseName]       = useState('')
  const [newPhaseDate, setNewPhaseDate]       = useState('')
  const [saving, setSaving]                   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [msRes, featRes, taskRes] = await Promise.all([
      supabase.from('project_milestones').select('*').eq('project_id', projectId).order('position'),
      supabase.from('project_features').select('*').eq('project_id', projectId).order('name'),
      supabase.from('tasks')
        .select('id, title, status, priority, feature_id, assignee_id, due_date')
        .eq('project_id', projectId),
    ])

    const ms    = (msRes.data   ?? []) as Milestone[]
    const feats = featRes.data  ?? []
    const tasks = taskRes.data  ?? []

    // Fetch assignee profiles
    const assigneeIds = [...new Set(tasks.filter(t => t.assignee_id).map(t => t.assignee_id as string))]
    const profileMap: Record<string, Profile> = {}
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', assigneeIds)
      profiles?.forEach(p => { profileMap[p.id] = p })
    }

    // Enrich features
    const enriched: Feature[] = feats.map(f => {
      const fTasks = tasks.filter(t => t.feature_id === f.id) as FeatureTask[]
      const done        = fTasks.filter(t => t.status === 'done').length
      const inProgress  = fTasks.filter(t => t.status === 'in_progress').length
      const blocked     = fTasks.filter(t => isOverdue(t) || (t.priority === 'high' && t.status === 'todo')).length
      const assigneeSet = [...new Set(fTasks.filter(t => t.assignee_id).map(t => t.assignee_id as string))]
      const assignees   = assigneeSet.slice(0, 5).map(id => profileMap[id]).filter(Boolean) as Profile[]
      const base: Omit<Feature, 'health'> = {
        id: f.id, name: f.name, milestone_id: f.milestone_id,
        tasks: fTasks, taskTotal: fTasks.length, taskDone: done,
        taskInProgress: inProgress, taskBlocked: blocked,
        progress: fTasks.length > 0 ? Math.round((done / fTasks.length) * 100) : 0,
        assignees,
      }
      return { ...base, health: computeHealth(base as Feature) }
    })

    // Restore current milestone
    const saved = localStorage.getItem(`nex_current_ms_${projectId}`)
    const currentId = (saved && ms.find(m => m.id === saved))
      ? saved
      : ms.find(m => m.is_current)?.id ?? ms[0]?.id ?? null

    setMilestones(ms)
    setFeatures(enriched)
    setCurrentMsId(currentId)
    setLoading(false)
  }, [projectId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData() }, [fetchData])

  const selectPhase = async (id: string) => {
    setCurrentMsId(id)
    localStorage.setItem(`nex_current_ms_${projectId}`, id)
    await supabase.from('project_milestones')
      .update({ is_current: false }).eq('project_id', projectId)
    await supabase.from('project_milestones')
      .update({ is_current: true }).eq('id', id)
  }

  const addPhase = async () => {
    if (!newPhaseName.trim()) return
    setSaving(true)
    await supabase.from('project_milestones').insert({
      project_id: projectId,
      name: newPhaseName.trim(),
      position: milestones.length,
      target_date: newPhaseDate || null,
      is_current: false,
    })
    setNewPhaseName(''); setNewPhaseDate(''); setAddingPhase(false)
    setSaving(false)
    void fetchData()
  }

  const addFeature = async (milestoneId: string | null) => {
    if (!newFeatureName.trim()) return
    setSaving(true)
    await supabase.from('project_features').insert({
      project_id: projectId,
      milestone_id: milestoneId,
      name: newFeatureName.trim(),
    })
    setNewFeatureName(''); setAddingFeature(null)
    setSaving(false)
    void fetchData()
  }

  const deleteFeature = async (id: string) => {
    await supabase.from('project_features').delete().eq('id', id)
    void fetchData()
  }

  const deletePhase = async (id: string) => {
    await supabase.from('project_milestones').delete().eq('id', id)
    void fetchData()
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const currentMs       = milestones.find(m => m.id === currentMsId)
  const currentMsIdx    = milestones.findIndex(m => m.id === currentMsId)
  const totalTasks      = features.reduce((s, f) => s + f.taskTotal, 0)
  const totalDone       = features.reduce((s, f) => s + f.taskDone, 0)
  const blockedFeatures = features.filter(f => f.health === 'blocked').length
  const atRisk          = features.filter(f => f.health === 'at_risk').length
  const overallProgress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0

  const featuresInCurrentPhase = features.filter(f => f.milestone_id === currentMsId)
  const featuresUnattached     = features.filter(f => !f.milestone_id)
  const featuresInOtherPhases  = features.filter(f => f.milestone_id && f.milestone_id !== currentMsId)

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '36px', height: '36px', margin: '0 auto 12px', border: '2px solid rgba(139,92,246,0.2)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'pdSpin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', fontSize: '10px', letterSpacing: '0.2em' }}>LOADING PROJECT…</p>
        <style>{`@keyframes pdSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '16px' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.22 }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: '1200px', background: '#07070f', border: '1px solid rgba(139,92,246,0.18)', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 48px 120px rgba(0,0,0,0.95)' }}>

          {/* Top accent */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #34d399, #38bdf8)', flexShrink: 0 }} />

          {/* ── HEADER ── */}
          <div style={{ padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.25em', margin: '0 0 2px' }}>PROJECT MISSION CONTROL</p>
                <h2 style={{ color: 'white', fontSize: '20px', fontFamily: 'Space Grotesk', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{projectName}</h2>
              </div>

              {/* Stats strip */}
              <div style={{ display: 'flex', gap: '1px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
                {[
                  { label: 'TASKS', value: totalTasks, color: '#a78bfa' },
                  { label: 'DONE', value: totalDone, color: '#34d399' },
                  { label: 'AT RISK', value: atRisk, color: '#f59e0b' },
                  { label: 'BLOCKED', value: blockedFeatures, color: '#f87171' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '8px 16px', background: '#0d0d1a', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                    <span style={{ color: s.color, fontSize: '16px', fontFamily: 'Space Mono', fontWeight: 700 }}>{String(s.value).padStart(2, '0')}</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '8px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Progress ring */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                  <svg width="40" height="40" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke={overallProgress > 60 ? '#34d399' : overallProgress > 30 ? '#f59e0b' : '#8b5cf6'} strokeWidth="3"
                      strokeDasharray={`${(overallProgress / 100) * 100.5} 100.5`} strokeLinecap="round"
                      style={{ transition: 'stroke-dasharray 1s ease' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '8px', fontFamily: 'Space Mono', fontWeight: 700 }}>{overallProgress}%</span>
                  </div>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontFamily: 'Space Mono', margin: 0, letterSpacing: '0.1em' }}>OVERALL</p>
                  <p style={{ color: 'white', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0 }}>{totalDone}/{totalTasks}</p>
                </div>
              </div>
            </div>

            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>✕</button>
          </div>

          {/* ── PHASE TIMELINE ── */}
          <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', minWidth: 'max-content' }}>
              {milestones.map((ms, i) => {
                const isCurrent = ms.id === currentMsId
                const isPast    = i < currentMsIdx
                const col = isPast ? '#34d399' : isCurrent ? '#8b5cf6' : 'rgba(255,255,255,0.18)'
                const featCount = features.filter(f => f.milestone_id === ms.id).length
                const msProgress = (() => {
                  const msTasks = features.filter(f => f.milestone_id === ms.id)
                  const total = msTasks.reduce((s, f) => s + f.taskTotal, 0)
                  const done  = msTasks.reduce((s, f) => s + f.taskDone, 0)
                  return total > 0 ? Math.round((done / total) * 100) : 0
                })()

                return (
                  <div key={ms.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '110px' }}>
                      {/* Phase node */}
                      <button onClick={() => selectPhase(ms.id)}
                        title="Set as current phase"
                        style={{ width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${col}`, background: isCurrent ? 'rgba(139,92,246,0.2)' : isPast ? `${col}20` : 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isCurrent ? `0 0 20px ${col}50, inset 0 0 12px ${col}20` : 'none', transition: 'all 0.25s', flexShrink: 0 }}>
                        {isPast
                          ? <span style={{ color: col, fontSize: '16px' }}>✓</span>
                          : isCurrent
                            ? <span style={{ color: col, fontSize: '15px' }}>⚡</span>
                            : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'Space Mono' }}>{i + 1}</span>
                        }
                      </button>

                      {/* Phase name */}
                      <span style={{ color: isCurrent ? '#c4b5fd' : isPast ? '#34d399' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: isCurrent ? 700 : 500, textAlign: 'center', lineHeight: 1.3 }}>{ms.name}</span>

                      {/* Mini progress + feature count */}
                      <div style={{ width: '60px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${msProgress}%`, height: '100%', background: col, borderRadius: '2px', transition: 'width 0.8s ease' }} />
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono' }}>{featCount} feature{featCount !== 1 ? 's' : ''} · {msProgress}%</span>

                      {/* Target date */}
                      {ms.target_date && (
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Space Mono' }}>
                          {new Date(ms.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}

                      {/* CURRENT badge */}
                      {isCurrent && (
                        <span style={{ fontSize: '8px', fontFamily: 'Space Mono', color: '#8b5cf6', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', padding: '1px 7px', borderRadius: '4px', letterSpacing: '0.1em' }}>CURRENT</span>
                      )}

                      {/* Delete */}
                      <button onClick={() => deletePhase(ms.id)}
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.12)', cursor: 'pointer', fontSize: '10px', padding: '0' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.12)' }}>
                        ✕ remove
                      </button>
                    </div>

                    {i < milestones.length - 1 && (
                      <div style={{ width: '40px', height: '2px', background: isPast ? '#34d399' : 'rgba(255,255,255,0.08)', margin: '22px 4px 0', transition: 'background 0.3s', flexShrink: 0 }} />
                    )}
                  </div>
                )
              })}

              {/* Add phase */}
              <div style={{ marginLeft: milestones.length > 0 ? '12px' : '0', marginTop: '4px' }}>
                {addingPhase ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '140px' }}>
                    <input autoFocus value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addPhase(); if (e.key === 'Escape') setAddingPhase(false) }}
                      placeholder="Phase name..."
                      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '8px', padding: '6px 10px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', outline: 'none' }} />
                    <input type="date" value={newPhaseDate} onChange={e => setNewPhaseDate(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '5px 8px', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontFamily: 'Space Grotesk', outline: 'none', colorScheme: 'dark' }} />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={addPhase} disabled={saving} style={{ flex: 1, background: '#8b5cf6', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', padding: '5px', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{saving ? '...' : 'Add'}</button>
                      <button onClick={() => setAddingPhase(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '5px 8px' }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingPhase(true)}
                    style={{ background: 'transparent', border: '1.5px dashed rgba(255,255,255,0.12)', borderRadius: '10px', padding: '8px 14px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', marginTop: '10px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.color = '#a78bfa' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}>
                    + Add Phase
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── FEATURE SWIMLANES ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>

            {/* Current phase section */}
            {currentMs && (
              <div>
                <div style={{ padding: '14px 28px 10px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, background: '#07070f', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6' }} />
                  <span style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.18em', fontWeight: 700 }}>ACTIVE PHASE — {currentMs.name.toUpperCase()}</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(139,92,246,0.15)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Space Mono' }}>{featuresInCurrentPhase.length} features</span>
                </div>

                <div style={{ padding: '12px 28px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {featuresInCurrentPhase.map((feat, i) => (
                    <FeatureSwimlane key={feat.id} feat={feat} colorIndex={i}
                      expanded={expandedFeature === feat.id}
                      onToggle={() => setExpandedFeature(expandedFeature === feat.id ? null : feat.id)}
                      onOpenBoard={() => onFeatureClick(feat.id, feat.name)}
                      onDelete={() => deleteFeature(feat.id)} />
                  ))}
                  {featuresInCurrentPhase.length === 0 && (
                    <div style={{ padding: '20px', background: 'rgba(139,92,246,0.04)', border: '1px dashed rgba(139,92,246,0.15)', borderRadius: '12px', textAlign: 'center' }}>
                      <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Space Grotesk', fontSize: '13px', margin: 0 }}>No features in this phase yet</p>
                    </div>
                  )}
                  {/* Add feature to current phase */}
                  <AddFeatureRow milestoneId={currentMs.id} adding={addingFeature === currentMs.id}
                    value={newFeatureName} onChange={setNewFeatureName}
                    onStart={() => { setAddingFeature(currentMs.id); setNewFeatureName('') }}
                    onAdd={() => addFeature(currentMs.id)} onCancel={() => setAddingFeature(null)} saving={saving} />
                </div>
              </div>
            )}

            {/* Other phases — collapsed summary */}
            {featuresInOtherPhases.length > 0 && (
              <div>
                <div style={{ padding: '14px 28px 10px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.18em' }}>OTHER PHASES</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                </div>
                {milestones.filter(m => m.id !== currentMsId).map(ms => {
                  const msFeats = features.filter(f => f.milestone_id === ms.id)
                  if (msFeats.length === 0) return null
                  const isPast = milestones.findIndex(m => m.id === ms.id) < currentMsIdx
                  return (
                    <div key={ms.id} style={{ padding: '6px 28px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ color: isPast ? '#34d399' : 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>
                          {isPast ? '✓' : '○'} {ms.name}
                        </span>
                        <button onClick={() => selectPhase(ms.id)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '9px', fontFamily: 'Space Mono', padding: '1px 7px' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#a78bfa' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}>
                          SET CURRENT
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {msFeats.map((feat) => (
                          <PhaseFeatureChip key={feat.id} feat={feat} colorIndex={features.indexOf(feat)}
                            onClick={() => onFeatureClick(feat.id, feat.name)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Unattached features */}
            {featuresUnattached.length > 0 && (
              <div>
                <div style={{ padding: '14px 28px 10px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.18em' }}>UNASSIGNED TO PHASE</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                </div>
                <div style={{ padding: '6px 28px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {featuresUnattached.map(feat => (
                    <PhaseFeatureChip key={feat.id} feat={feat} colorIndex={features.indexOf(feat)}
                      onClick={() => onFeatureClick(feat.id, feat.name)} />
                  ))}
                </div>
              </div>
            )}

            {/* Add unattached feature */}
            <div style={{ padding: '8px 28px 20px' }}>
              <AddFeatureRow milestoneId={null} adding={addingFeature === 'none'}
                value={newFeatureName} onChange={setNewFeatureName}
                onStart={() => { setAddingFeature('none'); setNewFeatureName('') }}
                onAdd={() => addFeature(null)} onCancel={() => setAddingFeature(null)} saving={saving}
                label="+ Add feature without phase" />
            </div>

            {milestones.length === 0 && features.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono', fontSize: '11px', letterSpacing: '0.15em', marginBottom: '8px' }}>NO PHASES OR FEATURES YET</p>
                <p style={{ color: 'rgba(255,255,255,0.12)', fontFamily: 'Space Grotesk', fontSize: '13px' }}>Add a phase above to start tracking your project execution.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Feature Swimlane Row ─────────────────────────────────────────────────────

function FeatureSwimlane({ feat, colorIndex, expanded, onToggle, onOpenBoard, onDelete }: {
  feat: Feature; colorIndex: number; expanded: boolean
  onToggle: () => void; onOpenBoard: () => void; onDelete: () => void
}) {
  const color  = FEATURE_COLORS[colorIndex % FEATURE_COLORS.length]
  const health = HEALTH_CONFIG[feat.health]
  const overdueCount = feat.tasks.filter(isOverdue).length

  return (
    <div style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${expanded ? color + '40' : 'rgba(255,255,255,0.07)'}`, borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer' }} onClick={onToggle}>
        {/* Color indicator */}
        <div style={{ width: '4px', height: '36px', borderRadius: '2px', background: color, flexShrink: 0 }} />

        {/* Feature name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feat.name}</span>
            {overdueCount > 0 && (
              <span style={{ fontSize: '9px', fontFamily: 'Space Mono', color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>⚠ {overdueCount} OVERDUE</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
            <span style={{ color: color, fontSize: '10px', fontFamily: 'Space Mono', fontWeight: 700 }}>{feat.progress}%</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Space Grotesk' }}>{feat.taskDone}/{feat.taskTotal} done</span>
            {feat.taskInProgress > 0 && <span style={{ color: '#8b5cf6', fontSize: '10px', fontFamily: 'Space Grotesk' }}>· {feat.taskInProgress} active</span>}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100px', flexShrink: 0 }}>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${feat.progress}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{ height: '100%', background: color, borderRadius: '2px' }} />
          </div>
        </div>

        {/* Health badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: health.bg, border: `1px solid ${health.color}40`, borderRadius: '6px', padding: '3px 8px', flexShrink: 0 }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: health.color }} />
          <span style={{ color: health.color, fontSize: '9px', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.08em' }}>{health.label}</span>
        </div>

        {/* Assignee avatars */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {feat.assignees.length > 0
            ? feat.assignees.map((p, i) => (
                <div key={p.id} style={{ marginLeft: i > 0 ? '-7px' : '0', zIndex: feat.assignees.length - i, position: 'relative' }}>
                  <Avatar name={p.full_name ?? p.email} avatarUrl={p.avatar_url} size={24} />
                </div>
              ))
            : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Grotesk' }}>—</span>
          }
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onOpenBoard}
            style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: '6px', color: color, cursor: 'pointer', fontSize: '10px', fontFamily: 'Space Mono', padding: '4px 8px', fontWeight: 600 }}
            title="Open feature board">
            Board →
          </button>
          <button onClick={onDelete}
            style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '11px', padding: '4px 6px' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
            ✕
          </button>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', padding: '4px 2px', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex', alignItems: 'center' }}>⌄</span>
        </div>
      </div>

      {/* Expanded task breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: 'rgba(255,255,255,0.04)', padding: '12px 16px', gap: '8px' }}>
              {STATUS_COLS.map(col => {
                const colTasks = feat.tasks.filter(t => t.status === col.key)
                return (
                  <div key={col.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: col.color }} />
                      <span style={{ color: col.color, fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>{col.label.toUpperCase()}</span>
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono' }}>({colTasks.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {colTasks.slice(0, 5).map(t => (
                        <div key={t.id} style={{ background: isOverdue(t) ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isOverdue(t) ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '6px', padding: '5px 8px' }}>
                          <p style={{ color: isOverdue(t) ? '#fca5a5' : 'rgba(255,255,255,0.75)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                          {t.due_date && (
                            <p style={{ color: isOverdue(t) ? '#f87171' : 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono', margin: '2px 0 0' }}>
                              {isOverdue(t) ? '⚠ ' : ''}{t.due_date.slice(5)}
                            </p>
                          )}
                        </div>
                      ))}
                      {colTasks.length > 5 && (
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono', padding: '2px 4px' }}>+{colTasks.length - 5} more</span>
                      )}
                      {colTasks.length === 0 && (
                        <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px', fontFamily: 'Space Grotesk', padding: '4px' }}>—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Phase Feature Chip (compact, for non-current phases) ────────────────────

function PhaseFeatureChip({ feat, colorIndex, onClick }: { feat: Feature; colorIndex: number; onClick: () => void }) {
  const color  = FEATURE_COLORS[colorIndex % FEATURE_COLORS.length]
  const health = HEALTH_CONFIG[feat.health]
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: '10px', padding: '7px 12px', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color + '50'; e.currentTarget.style.background = `${color}10` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}>
      <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: color, flexShrink: 0 }} />
      <div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>{feat.name}</p>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Space Mono', margin: 0 }}>{feat.progress}% · {feat.taskDone}/{feat.taskTotal}</p>
      </div>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: health.color, flexShrink: 0 }} title={health.label} />
    </button>
  )
}

// ── Add Feature Row ──────────────────────────────────────────────────────────

function AddFeatureRow({ adding, value, onChange, onStart, onAdd, onCancel, saving, label }: {
  milestoneId: string | null; adding: boolean; value: string; onChange: (v: string) => void
  onStart: () => void; onAdd: () => void; onCancel: () => void; saving: boolean; label?: string
}) {
  if (adding) return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <input autoFocus value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onAdd(); if (e.key === 'Escape') onCancel() }}
        placeholder="Feature name..."
        style={{ flex: 1, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none' }} />
      <button onClick={onAdd} disabled={saving || !value.trim()} style={{ background: '#8b5cf6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '8px 16px', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{saving ? '...' : 'Add'}</button>
      <button onClick={onCancel} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '8px 10px' }}>✕</button>
    </div>
  )
  return (
    <button onClick={onStart} style={{ background: 'transparent', border: '1.5px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px 16px', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', width: '100%', textAlign: 'left', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = '#a78bfa' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}>
      {label ?? '+ Add feature to this phase'}
    </button>
  )
}