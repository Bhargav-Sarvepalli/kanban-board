import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import type { Status, Profile } from '../types'
import { generateTaskDescription, suggestPriority } from '../lib/ai'
import toast from 'react-hot-toast'
import ConfirmDialog from './ConfirmDialog'
import Avatar from './Avatar'
import ShowOnFlowToggle from './Project/ShowOnFlowToggle'

interface Props {
  onClose: () => void
  onTaskCreated: () => void
  userId: string
  defaultStatus?: Status
  workspaceId?: string
  projectId?: string | null
  featureId?: string | null
}

interface Member {
  user_id: string
  email: string
  profile?: Profile
}

const priorityOptions = [
  { value: 'low',    label: 'Low',    color: '#94a3b8', glow: 'rgba(148,163,184,0.3)' },
  { value: 'normal', label: 'Normal', color: '#a78bfa', glow: 'rgba(139,92,246,0.3)'  },
  { value: 'high',   label: 'High',   color: '#f87171', glow: 'rgba(239,68,68,0.3)'   },
]

const statusOptions = [
  { value: 'todo',        label: 'To Do',       color: '#94a3b8' },
  { value: 'in_progress', label: 'In Progress',  color: '#a78bfa' },
  { value: 'in_review',   label: 'In Review',    color: '#fbbf24' },
  { value: 'done',        label: 'Done',         color: '#34d399' },
]

const recurringOptions = [
  { value: null,      label: 'One-time', icon: '○', color: '#94a3b8', glow: 'rgba(148,163,184,0.25)' },
  { value: 'weekly',  label: 'Weekly',   icon: '↻', color: '#06b6d4', glow: 'rgba(6,182,212,0.25)'   },
  { value: 'monthly', label: 'Monthly',  icon: '↻', color: '#a78bfa', glow: 'rgba(139,92,246,0.25)'  },
]

function CreateTaskModal({ onClose, onTaskCreated, userId, defaultStatus, workspaceId, projectId, featureId }: Props) {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<Status>(defaultStatus ?? 'todo')
  const [recurring, setRecurring] = useState<'weekly' | 'monthly' | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [suggestingPriority, setSuggestingPriority] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showOnFlow, setShowOnFlow] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    const load = async () => {
      const { data: wm } = await supabase.from('workspace_members').select('user_id, email').eq('workspace_id', workspaceId)
      if (!wm || wm.length === 0) return
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', wm.map(m => m.user_id))
      const profileMap: Record<string, Profile> = {}
      profiles?.forEach(p => { profileMap[p.id] = p })
      const ownerInMembers = wm.some(m => m.user_id === userId)
      const allMembers: Member[] = wm.map(m => ({ user_id: m.user_id, email: m.email, profile: profileMap[m.user_id] }))
      if (!ownerInMembers) {
        const { data: op } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (op) allMembers.unshift({ user_id: userId, email: op.email, profile: op })
      }
      setMembers(allMembers)
    }
    void load()
  }, [workspaceId, userId])

  const handleClose = () => { if (title.trim() || description.trim()) setShowConfirm(true); else onClose() }

  const handleSubmit = async () => {
    if (loading || !title.trim()) return
    setLoading(true)
    const { error: err } = await supabase.from('tasks').insert({
      title: title.trim(), description: description.trim() || null,
      priority, status, due_date: dueDate || null, recurring,
      user_id: userId, workspace_id: workspaceId ?? null,
      assignee_id: assigneeId ?? null,
      project_id: projectId ?? null,
      feature_id: featureId ?? null,
      show_on_flow: showOnFlow,
      last_edited_by: userId, last_edited_at: new Date().toISOString(),
    })
    if (err) toast.error('Failed to create task')
    else { toast.success('Task created! 🚀'); onTaskCreated(); onClose() }
    setLoading(false)
  }

  const assignee = members.find(m => m.user_id === assigneeId)

  return (
    <>
      <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }} onClick={e => e.stopPropagation()}
            style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', width: '100%', maxWidth: '480px', maxHeight: 'calc(100vh - 32px)', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />
            <div style={{ padding: '28px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {[1, 2].map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: step >= s ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: step >= s ? 'white' : 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono' }}>{s}</div>
                      {s === 1 && <div style={{ width: '32px', height: '1px', background: step >= 2 ? 'linear-gradient(90deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.12)' }} />}
                    </div>
                  ))}
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', marginLeft: '4px' }}>{step === 1 ? 'DETAILS' : 'OPTIONS'}</span>
                </div>
                <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✕</button>
              </div>

              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <div style={{ marginBottom: '24px' }}>
                      <input autoFocus value={title} onChange={e => { setTitle(e.target.value); setError('') }}
                        onKeyDown={e => e.key === 'Enter' && title.trim() && setStep(2)} placeholder="What needs to be done?"
                        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', padding: '8px 0', color: 'white', fontSize: '20px', fontFamily: 'Space Grotesk', fontWeight: 600, outline: 'none', letterSpacing: '-0.02em' }}
                        onFocus={e => e.target.style.borderBottomColor = '#8b5cf6'}
                        onBlur={e => e.target.style.borderBottomColor = 'rgba(255,255,255,0.15)'} />
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Mono', marginTop: '6px' }}>PRESS ENTER TO CONTINUE</p>
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>DESCRIPTION</span>
                        <button onClick={async () => { if (!title.trim()) return; setGeneratingDesc(true); try { setDescription(await generateTaskDescription(title)); toast.success('Description generated!') } catch { toast.error('AI generation failed') } setGeneratingDesc(false) }} disabled={generatingDesc || !title.trim()}
                          style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '6px', color: '#a78bfa', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', padding: '4px 12px', opacity: !title.trim() ? 0.4 : 1 }}>
                          {generatingDesc ? '⟳ Writing...' : '✨ AI Write'}
                        </button>
                      </div>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what needs to happen..." rows={4}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px', color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', resize: 'none', lineHeight: 1.7, boxSizing: 'border-box' }} />
                    </div>
                    <button onClick={() => { if (!title.trim()) { setError('Please enter a title first'); return } setError(''); setStep(2) }}
                      style={{ width: '100%', background: title.trim() ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '12px', padding: '14px', color: title.trim() ? 'white' : 'rgba(255,255,255,0.3)', cursor: title.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, transition: 'all 0.2s' }}>
                      Continue →
                    </button>
                    {error && <p style={{ color: '#f87171', fontSize: '12px', textAlign: 'center', marginTop: '8px', fontFamily: 'Space Grotesk' }}>⚠ {error}</p>}
                  </motion.div>
                ) : (
                  <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    {/* Priority */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>PRIORITY</span>
                        <button onClick={async () => { if (!title.trim()) return; setSuggestingPriority(true); try { const s = await suggestPriority(title); setPriority(s); toast.success(`Priority → ${s}`) } catch { toast.error('AI suggestion failed') } setSuggestingPriority(false) }} disabled={suggestingPriority}
                          style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>{suggestingPriority ? '⟳' : '🤖 AI Suggest'}</button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {priorityOptions.map(opt => (
                          <button key={opt.value} onClick={() => setPriority(opt.value as 'low' | 'normal' | 'high')}
                            style={{ flex: 1, padding: '12px 8px', borderRadius: '12px', border: `1px solid ${priority === opt.value ? opt.color : opt.color + '40'}`, background: priority === opt.value ? `${opt.color}20` : `${opt.color}08`, color: priority === opt.value ? opt.color : opt.color + '99', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: priority === opt.value ? 700 : 500, transition: 'all 0.15s', boxShadow: priority === opt.value ? `0 0 15px ${opt.glow}` : 'none' }}>{opt.label}</button>
                        ))}
                      </div>
                    </div>

                    {/* Assign to */}
                    {workspaceId && members.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <span style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginBottom: '10px' }}>ASSIGN TO</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => setAssigneeId(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '20px', border: `1px solid ${assigneeId === null ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`, background: assigneeId === null ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)', color: assigneeId === null ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>— Unassigned</button>
                          {members.map(m => {
                            const name = m.profile?.full_name ?? m.email.split('@')[0]
                            const isSel = assigneeId === m.user_id
                            return <button key={m.user_id} onClick={() => setAssigneeId(m.user_id)} title={m.email}
                              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 12px 5px 5px', borderRadius: '20px', border: `1px solid ${isSel ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`, background: isSel ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)', color: isSel ? '#c084fc' : 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                              <Avatar name={name} avatarUrl={m.profile?.avatar_url ?? null} size={20} />{name.split(' ')[0]}
                            </button>
                          })}
                        </div>
                        {assignee && <p style={{ color: 'rgba(139,92,246,0.7)', fontSize: '11px', fontFamily: 'Space Grotesk', marginTop: '7px' }}>Assigned to {assignee.profile?.full_name ?? assignee.email}</p>}
                      </div>
                    )}

                    {/* Column */}
                    <div style={{ marginBottom: '20px' }}>
                      <span style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginBottom: '10px' }}>COLUMN</span>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {statusOptions.map(opt => (
                          <button key={opt.value} onClick={() => setStatus(opt.value as Status)}
                            style={{ padding: '10px 12px', borderRadius: '10px', border: `1px solid ${status === opt.value ? opt.color + '70' : opt.color + '30'}`, background: status === opt.value ? `${opt.color}18` : `${opt.color}08`, color: status === opt.value ? opt.color : opt.color + '80', cursor: 'pointer', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: status === opt.value ? 600 : 400, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />{opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Due Date + Repeat */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                      <div>
                        <span style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginBottom: '10px' }}>DUE DATE</span>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 12px', color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontFamily: 'Space Grotesk', outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.15em', marginBottom: '10px' }}>REPEAT</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {recurringOptions.map(opt => {
                            const isSel = recurring === opt.value
                            return <button key={opt.value ?? 'none'} onClick={() => setRecurring(opt.value as 'weekly' | 'monthly' | null)}
                              style={{ padding: '8px 10px', borderRadius: '8px', border: `1px solid ${isSel ? opt.color + '60' : 'rgba(255,255,255,0.1)'}`, background: isSel ? `${opt.color}18` : 'rgba(255,255,255,0.03)', color: isSel ? opt.color : 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Grotesk', textAlign: 'left', fontWeight: isSel ? 600 : 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px' }}>{opt.icon}</span>{opt.label}
                            </button>
                          })}
                        </div>
                      </div>
                    </div>

                    {/* ── Show on Flow — only for project tasks ── */}
                    {projectId && (
                      <div style={{ marginBottom: '20px' }}>
                        <ShowOnFlowToggle value={showOnFlow} onChange={setShowOnFlow} projectId={projectId} />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setStep(1)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '13px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>← Back</button>
                      <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, background: loading ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '12px', padding: '13px', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                        {loading ? '⟳ Creating...' : 'Create Task →'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {showConfirm && <ConfirmDialog title="Discard Task?" message="You have unsaved changes. Are you sure you want to discard this task?" confirmLabel="Discard" cancelLabel="Keep Editing" danger={true} onConfirm={onClose} onCancel={() => setShowConfirm(false)} />}
    </>
  )
}

export default CreateTaskModal
