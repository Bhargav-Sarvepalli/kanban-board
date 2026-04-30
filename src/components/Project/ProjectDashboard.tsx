import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../supabase'
import type { Profile } from '../../types'
import Avatar from '../Avatar'

interface Milestone {
  id: string
  name: string
  position: number
  target_date: string | null
  is_current?: boolean
}

interface Feature {
  id: string
  name: string
  milestone_id: string | null
  start_date: string | null
  end_date: string | null
  taskTotal: number
  taskDone: number
  progress: number
  assignees: Profile[]
}

interface Props {
  projectId: string
  projectName: string
  userId: string
  onClose: () => void
  onFeatureClick: (featureId: string, featureName: string) => void
}


export default function ProjectDashboard({ projectId, projectName, onClose, onFeatureClick }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMilestoneId, setCurrentMilestoneId] = useState<string | null>(null)
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [newMilestoneInput, setNewMilestoneInput] = useState('')
  const [addingFeature, setAddingFeature] = useState<string | null>(null) // milestone_id
  const [newFeatureInput, setNewFeatureInput] = useState('')
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [msRes, featRes, tasksRes] = await Promise.all([
      supabase.from('project_milestones').select('*').eq('project_id', projectId).order('position'),
      supabase.from('project_features').select('*').eq('project_id', projectId).order('name'),
      supabase.from('tasks').select('id, status, feature_id, assignee_id').eq('project_id', projectId),
    ])

    const ms = msRes.data ?? []
    const feats = featRes.data ?? []
    const tasks = tasksRes.data ?? []

    const assigneeIds = [...new Set(tasks.filter(t => t.assignee_id).map(t => t.assignee_id as string))]
    const profileMap: Record<string, Profile> = {}
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', assigneeIds)
      profiles?.forEach(p => { profileMap[p.id] = p })
    }

    const enriched: Feature[] = feats.map(f => {
      const fTasks = tasks.filter(t => t.feature_id === f.id)
      const done   = fTasks.filter(t => t.status === 'done').length
      const assigneeProfiles = [...new Set(fTasks.filter(t => t.assignee_id).map(t => t.assignee_id as string))]
        .slice(0, 4).map(id => profileMap[id]).filter(Boolean)
      return {
        id: f.id, name: f.name, milestone_id: f.milestone_id,
        start_date: f.start_date, end_date: f.end_date,
        taskTotal: fTasks.length, taskDone: done,
        progress: fTasks.length > 0 ? Math.round((done / fTasks.length) * 100) : 0,
        assignees: assigneeProfiles,
      }
    })

    const saved = localStorage.getItem(`project_current_ms_${projectId}`)
    const resolvedMs = saved && ms.find(m => m.id === saved) ? saved : ms[0]?.id ?? null

    return { ms, enriched, resolvedMs }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData().then(result => {
      if (cancelled || !result) return
      setMilestones(result.ms)
      setFeatures(result.enriched)
      setCurrentMilestoneId(result.resolvedMs)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [fetchData])

  const setCurrentMilestone = (id: string) => {
    setCurrentMilestoneId(id)
    localStorage.setItem(`project_current_ms_${projectId}`, id)
    // Update is_current in DB
    supabase.from('project_milestones').update({ is_current: false }).eq('project_id', projectId).then(() => {
      supabase.from('project_milestones').update({ is_current: true }).eq('id', id)
    })
  }

  const saveMilestoneName = async (id: string) => {
    if (!newMilestoneName.trim()) { setEditingMilestone(null); return }
    await supabase.from('project_milestones').update({ name: newMilestoneName.trim() }).eq('id', id)
    setEditingMilestone(null)
    void fetchData()
  }

  const deleteMilestone = async (id: string) => {
    await supabase.from('project_milestones').delete().eq('id', id)
    void fetchData()
  }

  const addMilestone = async () => {
    if (!newMilestoneInput.trim()) return
    const pos = milestones.length
    await supabase.from('project_milestones').insert({ project_id: projectId, name: newMilestoneInput.trim(), position: pos })
    setNewMilestoneInput(''); setAddingMilestone(false)
    void fetchData()
  }

  const addFeature = async (milestoneId: string | null) => {
    if (!newFeatureInput.trim()) return
    await supabase.from('project_features').insert({
      project_id: projectId,
      milestone_id: milestoneId,
      name: newFeatureInput.trim(),
    })
    setNewFeatureInput(''); setAddingFeature(null)
    void fetchData()
  }

  const deleteFeature = async (id: string) => {
    await supabase.from('project_features').delete().eq('id', id)
    void fetchData()
  }

  // Group features by milestone
  const featuresByMilestone = (milestoneId: string | null) =>
    features.filter(f => f.milestone_id === milestoneId)

  const unattachedFeatures = features.filter(f => !f.milestone_id)

  const totalTasks = features.reduce((s, f) => s + f.taskTotal, 0)
  const totalDone  = features.reduce((s, f) => s + f.taskDone, 0)
  const overallProgress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '20px' }}
        onClick={onClose}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25 }}
          onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: '1100px', background: '#080810', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.9)' }}>

          {/* Top gradient bar */}
          <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #34d399)', flexShrink: 0 }} />

          {/* Header */}
          <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em' }}>PROJECT</span>
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px' }}>/</span>
                  <span style={{ color: '#a78bfa', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>DASHBOARD</span>
                </div>
                <h2 style={{ color: 'white', fontSize: '22px', fontFamily: 'Space Grotesk', fontWeight: 800, margin: '2px 0 0', letterSpacing: '-0.02em' }}>{projectName}</h2>
              </div>

              {/* Overall progress ring */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}>
                <div style={{ position: 'relative', width: '36px', height: '36px' }}>
                  <svg width="36" height="36" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#8b5cf6" strokeWidth="3"
                      strokeDasharray={`${(overallProgress / 100) * 87.96} 87.96`} strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'white', fontSize: '8px', fontFamily: 'Space Mono', fontWeight: 700 }}>{overallProgress}%</span>
                  </div>
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.15em', margin: 0 }}>OVERALL</p>
                  <p style={{ color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0 }}>{totalDone}/{totalTasks} tasks</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { label: 'PHASES', value: milestones.length, color: '#a78bfa' },
                  { label: 'FEATURES', value: features.length, color: '#34d399' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ color: s.color, fontSize: '20px', fontFamily: 'Space Mono', fontWeight: 700, margin: 0 }}>{String(s.value).padStart(2, '0')}</p>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '8px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>✕</button>
          </div>

          {/* Milestone timeline */}
          <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', minWidth: 'max-content' }}>
              {milestones.map((ms, i) => {
                const isCurrent = ms.id === currentMilestoneId
                const isPast    = i < milestones.findIndex(m => m.id === currentMilestoneId)
                const col = isPast ? '#34d399' : isCurrent ? '#8b5cf6' : 'rgba(255,255,255,0.2)'
                return (
                  <div key={ms.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      {/* Node */}
                      <button
                        onClick={() => setCurrentMilestone(ms.id)}
                        title="Set as current phase"
                        style={{ width: '36px', height: '36px', borderRadius: '50%', border: `2px solid ${col}`, background: isPast ? col : isCurrent ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isCurrent ? `0 0 16px ${col}60` : 'none', transition: 'all 0.2s', flexShrink: 0 }}>
                        <span style={{ color: isPast ? 'rgba(0,0,0,0.8)' : col, fontSize: '13px', fontFamily: 'Space Mono' }}>
                          {isPast ? '✓' : isCurrent ? '⚡' : String(i + 1)}
                        </span>
                      </button>
                      {/* Label with inline edit */}
                      {editingMilestone === ms.id ? (
                        <input autoFocus value={newMilestoneName}
                          onChange={e => setNewMilestoneName(e.target.value)}
                          onBlur={() => saveMilestoneName(ms.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveMilestoneName(ms.id); if (e.key === 'Escape') setEditingMilestone(null) }}
                          style={{ width: '90px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '6px', padding: '3px 6px', color: 'white', fontSize: '11px', fontFamily: 'Space Grotesk', outline: 'none', textAlign: 'center' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            onDoubleClick={() => { setEditingMilestone(ms.id); setNewMilestoneName(ms.name) }}
                            style={{ color: isCurrent ? '#a78bfa' : isPast ? '#34d399' : 'rgba(255,255,255,0.45)', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: isCurrent ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            title="Double-click to rename">
                            {ms.name}
                          </span>
                          <button onClick={() => deleteMilestone(ms.id)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '10px', padding: 0, lineHeight: 1 }}
                            title="Delete phase">✕</button>
                        </div>
                      )}
                      {isCurrent && (
                        <span style={{ fontSize: '8px', fontFamily: 'Space Mono', color: '#8b5cf6', letterSpacing: '0.1em', background: 'rgba(139,92,246,0.1)', padding: '1px 6px', borderRadius: '4px' }}>CURRENT</span>
                      )}
                    </div>
                    {i < milestones.length - 1 && (
                      <div style={{ width: '60px', height: '2px', background: isPast ? '#34d399' : 'rgba(255,255,255,0.1)', margin: '0 4px', marginBottom: '28px', transition: 'background 0.3s' }} />
                    )}
                  </div>
                )
              })}

              {/* Add milestone */}
              {addingMilestone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: milestones.length > 0 ? '16px' : '0' }}>
                  {milestones.length > 0 && <div style={{ width: '40px', height: '2px', background: 'rgba(255,255,255,0.08)' }} />}
                  <input autoFocus value={newMilestoneInput} onChange={e => setNewMilestoneInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addMilestone(); if (e.key === 'Escape') setAddingMilestone(false) }}
                    placeholder="Phase name..."
                    style={{ width: '110px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '8px', padding: '6px 10px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', outline: 'none' }} />
                  <button onClick={addMilestone} style={{ background: '#8b5cf6', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '14px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</button>
                  <button onClick={() => setAddingMilestone(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setAddingMilestone(true)}
                  style={{ marginLeft: milestones.length > 0 ? '16px' : '0', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '10px', padding: '6px 14px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>
                  + Add Phase
                </button>
              )}
            </div>
          </div>

          {/* Features grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

            {/* Features grouped by milestone */}
            {milestones.map((ms, mi) => {
              const msFeatures = featuresByMilestone(ms.id)
              const isCurrent  = ms.id === currentMilestoneId
              return (
                <div key={ms.id} style={{ marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isCurrent ? '#8b5cf6' : mi < milestones.findIndex(m => m.id === currentMilestoneId) ? '#34d399' : 'rgba(255,255,255,0.2)', boxShadow: isCurrent ? '0 0 8px #8b5cf6' : 'none' }} />
                    <span style={{ color: isCurrent ? '#a78bfa' : 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', fontWeight: isCurrent ? 700 : 400 }}>
                      {ms.name.toUpperCase()}
                    </span>
                    {isCurrent && <span style={{ fontSize: '9px', fontFamily: 'Space Mono', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '1px 6px', borderRadius: '4px' }}>ACTIVE</span>}
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Space Mono' }}>{msFeatures.length} features</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                    {msFeatures.map((feat) => (
                      <FeatureCard key={feat.id} feat={feat} colorIndex={features.indexOf(feat)} hovered={hoveredFeature === feat.id}
                        onMouseEnter={() => setHoveredFeature(feat.id)}
                        onMouseLeave={() => setHoveredFeature(null)}
                        onClick={() => onFeatureClick(feat.id, feat.name)}
                        onDelete={() => deleteFeature(feat.id)} />
                    ))}

                    {/* Add feature to this milestone */}
                    {addingFeature === ms.id ? (
                      <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <input autoFocus value={newFeatureInput} onChange={e => setNewFeatureInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addFeature(ms.id); if (e.key === 'Escape') setAddingFeature(null) }}
                          placeholder="Feature name..."
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none' }} />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => addFeature(ms.id)} style={{ flex: 1, background: '#8b5cf6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '7px', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>Add</button>
                          <button onClick={() => setAddingFeature(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '7px 12px', fontSize: '12px' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingFeature(ms.id); setNewFeatureInput('') }}
                        style={{ background: 'transparent', border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: '14px', padding: '20px', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.color = '#a78bfa' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}>
                        <span style={{ fontSize: '18px' }}>+</span> New Feature
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Unattached features */}
            {(unattachedFeatures.length > 0 || milestones.length === 0) && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>UNATTACHED FEATURES</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {unattachedFeatures.map(feat => (
                    <FeatureCard key={feat.id} feat={feat} colorIndex={features.indexOf(feat)} hovered={hoveredFeature === feat.id}
                      onMouseEnter={() => setHoveredFeature(feat.id)}
                      onMouseLeave={() => setHoveredFeature(null)}
                      onClick={() => onFeatureClick(feat.id, feat.name)}
                      onDelete={() => deleteFeature(feat.id)} />
                  ))}
                  {addingFeature === 'none' ? (
                    <div style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input autoFocus value={newFeatureInput} onChange={e => setNewFeatureInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addFeature(null); if (e.key === 'Escape') setAddingFeature(null) }}
                        placeholder="Feature name..."
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none' }} />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => addFeature(null)} style={{ flex: 1, background: '#8b5cf6', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '7px', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>Add</button>
                        <button onClick={() => setAddingFeature(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '7px 12px', fontSize: '12px' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingFeature('none'); setNewFeatureInput('') }}
                      style={{ background: 'transparent', border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: '14px', padding: '20px', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.color = '#a78bfa' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}>
                      <span style={{ fontSize: '18px' }}>+</span> New Feature
                    </button>
                  )}
                </div>
              </div>
            )}

            {milestones.length === 0 && features.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Space Mono', fontSize: '11px', letterSpacing: '0.15em', marginBottom: '8px' }}>NO PHASES OR FEATURES YET</p>
                <p style={{ color: 'rgba(255,255,255,0.15)', fontFamily: 'Space Grotesk', fontSize: '13px' }}>Add a phase above to organize your features, or add features directly.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Feature Card ─────────────────────────────────────────────────────────────
const FEATURE_COLORS = [
  '#8b5cf6', '#38bdf8', '#34d399', '#f472b6',
  '#fb923c', '#a78bfa', '#22d3ee', '#f87171',
]

function FeatureCard({ feat, colorIndex, hovered, onMouseEnter, onMouseLeave, onClick, onDelete }: {
  feat: Feature
  colorIndex: number
  hovered: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onDelete: () => void
}) {
  const color = FEATURE_COLORS[colorIndex % FEATURE_COLORS.length]

  return (
    <motion.div
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{
        background: hovered ? `${color}10` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hovered ? color + '40' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '14px', padding: '16px', cursor: 'pointer',
        transition: 'all 0.2s', position: 'relative',
        boxShadow: hovered ? `0 0 20px ${color}20` : 'none',
      }}>

      {/* Color accent bar */}
      <div style={{ position: 'absolute', top: 0, left: '16px', right: '16px', height: '2px', background: color, borderRadius: '0 0 2px 2px', opacity: hovered ? 1 : 0.4, transition: 'opacity 0.2s' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }} onClick={onClick}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '14px' }}>🌿</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{feat.name}</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono', margin: '2px 0 0' }}>{feat.taskTotal} task{feat.taskTotal !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.15)' }}>✕</button>
      </div>

      {/* Progress bar */}
      <div onClick={onClick}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>PROGRESS</span>
          <span style={{ color: color, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700 }}>{feat.progress}%</span>
        </div>
        <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${feat.progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ height: '100%', background: color, borderRadius: '2px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ color: '#34d399', fontSize: '9px', fontFamily: 'Space Mono' }}>{feat.taskDone} done</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono' }}>{feat.taskTotal - feat.taskDone} left</span>
        </div>
      </div>

      {/* Assignee avatars + open board hint */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }} onClick={onClick}>
          {feat.assignees.length > 0 ? (
            feat.assignees.map((p, i) => (
              <div key={p.id} style={{ marginLeft: i > 0 ? '-8px' : '0', zIndex: feat.assignees.length - i, position: 'relative' }}>
                <Avatar name={p.full_name ?? p.email} avatarUrl={p.avatar_url} size={22} />
              </div>
            ))
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Grotesk' }}>No assignees</span>
          )}
        </div>
        <span onClick={onClick} style={{ color: color, fontSize: '10px', fontFamily: 'Space Mono', opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', cursor: 'pointer' }}>
          Open Board →
        </span>
      </div>
    </motion.div>
  )
}