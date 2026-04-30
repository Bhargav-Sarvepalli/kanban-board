import { useState } from 'react'
import { supabase } from '../../supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  userId: string
  workspaceId?: string | null
  onCreated: (project: Project) => void   // used by App.tsx
  onComplete?: (project: Project) => void // kept for backward compat
  onClose: () => void
}

export interface Project {
  id: string
  name: string
  description: string | null
  start_date: string | null
  target_date: string | null
  owner_id: string
  workspace_id: string | null
  created_at: string
}

const STEPS = ['Create Project', 'Add Team', 'Plan Flow', 'Create Features']

export default function ProjectCreationWizard({ userId, workspaceId, onCreated, onComplete, onClose }: Props) {
  const finish = (p: Project) => { onCreated(p); onComplete?.(p) }

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [targetDate, setTargetDate] = useState('')

  // Step 2
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitedEmails, setInvitedEmails] = useState<string[]>([])

  // Step 3
  const [milestones, setMilestones] = useState<{ name: string }[]>([
    { name: 'Kickoff' },
    { name: 'Phase 1' },
    { name: 'Review' },
    { name: 'Delivery' },
  ])
  const [newMilestone, setNewMilestone] = useState('')
  const [nexPrompt, setNexPrompt] = useState('')
  const [nexLoading, setNexLoading] = useState(false)

  // Step 4
  const [features, setFeatures] = useState<{ name: string; milestone: string; startDate: string; endDate: string }[]>([])
  const [showFeatureForm, setShowFeatureForm] = useState(false)
  const [featureName, setFeatureName] = useState('')
  const [featureMilestone, setFeatureMilestone] = useState('')
  const [featureStart, setFeatureStart] = useState('')
  const [featureEnd, setFeatureEnd] = useState('')

  const [createdProject, setCreatedProject] = useState<Project | null>(null)

  const canNext = () => step === 0 ? name.trim().length > 0 : true

  const handleStep1 = async () => {
    setLoading(true); setError('')
    try {
      const { data, error: err } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          start_date: startDate || null,
          target_date: targetDate || null,
          owner_id: userId,
          workspace_id: workspaceId || null,
        })
        .select().single()
      if (err) throw err
      setCreatedProject(data)
      await supabase.from('project_members').insert({ project_id: data.id, user_id: userId, role: 'owner' })
      setStep(1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project')
    } finally { setLoading(false) }
  }

  const addMilestone = () => {
    if (!newMilestone.trim()) return
    setMilestones(prev => [...prev, { name: newMilestone.trim() }])
    setNewMilestone('')
  }

  const removeMilestone = (i: number) => setMilestones(prev => prev.filter((_, idx) => idx !== i))

  const generateWithNex = async () => {
    if (!nexPrompt.trim()) return
    setNexLoading(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{ role: 'user', content: `You are a project planning assistant. Given this project description: "${nexPrompt}", suggest 4-6 milestone names. Return ONLY a JSON array of strings, nothing else. Example: ["Kickoff","Design","Development","Testing","Launch"]` }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text ?? '[]'
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      if (Array.isArray(parsed)) setMilestones(parsed.map((m: string) => ({ name: m })))
    } catch { /* silent */ }
    finally { setNexLoading(false) }
  }

  const handleStep3 = async () => {
    if (!createdProject) return setStep(3)
    setLoading(true)
    try {
      await supabase.from('project_milestones').insert(
        milestones.map((m, i) => ({ project_id: createdProject.id, name: m.name, position: i }))
      )
    } finally { setLoading(false); setStep(3) }
  }

  const addFeature = () => {
    if (!featureName.trim()) return
    setFeatures(prev => [...prev, { name: featureName.trim(), milestone: featureMilestone, startDate: featureStart, endDate: featureEnd }])
    setFeatureName(''); setFeatureMilestone(''); setFeatureStart(''); setFeatureEnd('')
    setShowFeatureForm(false)
  }

  const handleComplete = async () => {
    if (!createdProject) return
    setLoading(true)
    try {
      if (features.length > 0) {
        const { data: msData } = await supabase.from('project_milestones').select('id,name').eq('project_id', createdProject.id)
        const msMap: Record<string, string> = {}
        msData?.forEach(m => { msMap[m.name] = m.id })
        await supabase.from('project_features').insert(
          features.map(f => ({
            project_id: createdProject.id,
            milestone_id: msMap[f.milestone] || null,
            name: f.name,
            start_date: f.startDate || null,
            end_date: f.endDate || null,
          }))
        )
      }
      finish(createdProject)
    } catch { finish(createdProject!) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        style={{ background: '#0d0d14', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '20px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div style={{ padding: '28px 32px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
            <h2 style={{ color: 'white', fontSize: '22px', fontFamily: 'Space Grotesk', fontWeight: 800, margin: 0 }}>Create New Project</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: i <= step ? '#8b5cf6' : 'rgba(255,255,255,0.08)', border: i === step ? '2px solid #a78bfa' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: i === step ? '0 0 16px rgba(139,92,246,0.5)' : 'none', transition: 'all 0.3s' }}>
                  {i < step
                    ? <span style={{ color: 'white', fontSize: '14px' }}>✓</span>
                    : <span style={{ color: i === step ? 'white' : 'rgba(255,255,255,0.3)', fontSize: '13px', fontFamily: 'Space Mono', fontWeight: 700 }}>{i + 1}</span>
                  }
                </div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: '2px', background: i < step ? '#8b5cf6' : 'rgba(255,255,255,0.08)', margin: '0 8px', transition: 'background 0.3s' }} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
            {STEPS.map((s, i) => (
              <span key={s} style={{ color: i === step ? '#a78bfa' : 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', flex: 1, textAlign: i === 0 ? 'left' : i === STEPS.length - 1 ? 'right' : 'center' }}>
                {s.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '0 32px 32px' }}>
          <AnimatePresence mode="wait">

            {/* STEP 1 */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Project Name *</label>
                  <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g., NexTask Launch" style={inputStyle} onKeyDown={e => e.key === 'Enter' && canNext() && handleStep1()} />
                </div>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Start Date *</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} /></div>
                  <div style={{ flex: 1 }}><label style={labelStyle}>Target Date <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label><input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} style={inputStyle} /></div>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={labelStyle}>Description <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your project goals and objectives..." rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }} />
                </div>
                {error && <p style={{ color: '#f87171', fontSize: '12px', fontFamily: 'Space Grotesk', marginBottom: '12px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
                  <button onClick={handleStep1} disabled={!canNext() || loading} style={primaryBtnStyle(canNext() && !loading)}>{loading ? 'Creating…' : 'Next: Add Team →'}</button>
                </div>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 style={{ color: 'white', fontSize: '16px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: '0 0 6px' }}>👥 Add Collaborators</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontFamily: 'Space Grotesk', margin: '0 0 20px' }}>Invite team members. You can skip and add them later.</p>
                <label style={labelStyle}>Invite by Email</label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@example.com" style={{ ...inputStyle, flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter' && inviteEmail.trim()) { setInvitedEmails(p => [...p, inviteEmail.trim()]); setInviteEmail('') } }} />
                  <button onClick={() => { if (inviteEmail.trim()) { setInvitedEmails(p => [...p, inviteEmail.trim()]); setInviteEmail('') } }} style={{ ...primaryBtnStyle(true), padding: '0 20px', flexShrink: 0 }}>Invite</button>
                </div>
                {invitedEmails.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    {invitedEmails.map(email => (
                      <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '20px', padding: '4px 10px' }}>
                        <span style={{ color: '#c4b5fd', fontSize: '12px', fontFamily: 'Space Grotesk' }}>{email}</span>
                        <button onClick={() => setInvitedEmails(p => p.filter(e => e !== email))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button onClick={() => setStep(0)} style={secondaryBtnStyle}>Back</button>
                  <button onClick={() => setStep(2)} style={{ ...secondaryBtnStyle, flex: 1 }}>Skip for Now</button>
                  <button onClick={() => setStep(2)} style={primaryBtnStyle(true)}>Next: Plan Flow →</button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ color: 'white', fontSize: '15px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: '0 0 14px' }}>⚡ Manual Input</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                      {milestones.map((m, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>⠿</span>
                          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontFamily: 'Space Grotesk', flex: 1 }}>{m.name}</span>
                          <button onClick={() => removeMilestone(i)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <input value={newMilestone} onChange={e => setNewMilestone(e.target.value)} placeholder="Add milestone..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && addMilestone()} />
                      <button onClick={addMilestone} style={{ width: '36px', height: '38px', borderRadius: '8px', background: '#8b5cf6', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
                    </div>
                    <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span>✨</span>
                        <span style={{ color: '#a78bfa', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700 }}>NEX Assistant</span>
                      </div>
                      <textarea value={nexPrompt} onChange={e => setNexPrompt(e.target.value)} placeholder="Describe your project... e.g., 'Build SaaS MVP in 2 months'" rows={3} style={{ ...inputStyle, resize: 'none', marginBottom: '10px', fontSize: '12px' }} />
                      <button onClick={generateWithNex} disabled={nexLoading || !nexPrompt.trim()} style={{ ...primaryBtnStyle(!!nexPrompt.trim() && !nexLoading), width: '100%', fontSize: '12px', padding: '9px' }}>
                        {nexLoading ? 'Generating…' : '✨ Generate with Nex'}
                      </button>
                    </div>
                  </div>
                  <div style={{ width: '170px', flexShrink: 0 }}>
                    <h3 style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.1em', margin: '0 0 16px' }}>LIVE PREVIEW</h3>
                    <div style={{ position: 'relative', paddingLeft: '22px' }}>
                      <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(139,92,246,0.3)', borderRadius: '1px' }} />
                      {milestones.map((m, i) => (
                        <div key={i} style={{ position: 'relative', marginBottom: '18px' }}>
                          <div style={{ position: 'absolute', left: '-22px', width: '14px', height: '14px', borderRadius: '50%', background: '#8b5cf6', border: '2px solid #a78bfa', boxShadow: '0 0 8px rgba(139,92,246,0.5)' }} />
                          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>{m.name}</span>
                        </div>
                      ))}
                      {milestones.length > 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono', marginTop: '4px' }}>{milestones.length} milestone{milestones.length !== 1 ? 's' : ''}</p>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button onClick={() => setStep(1)} style={secondaryBtnStyle}>Back</button>
                  <button onClick={() => setStep(3)} style={{ ...secondaryBtnStyle, flex: 1 }}>Skip for Now</button>
                  <button onClick={handleStep3} disabled={loading} style={primaryBtnStyle(!loading)}>{loading ? 'Saving…' : 'Next: Create Features →'}</button>
                </div>
              </motion.div>
            )}

            {/* STEP 4 */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h3 style={{ color: 'white', fontSize: '15px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: '0 0 6px' }}>🌿 Create Features (Branches)</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontFamily: 'Space Grotesk', margin: '0 0 16px' }}>Define features as branches. Each gets its own Kanban board automatically.</p>

                {features.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px' }}>
                    <span>🌿</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>{f.name}</p>
                      {f.milestone && <p style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Space Mono', margin: '2px 0 0' }}>→ {f.milestone}</p>}
                    </div>
                    <button onClick={() => setFeatures(p => p.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                  </div>
                ))}

                {showFeatureForm ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                    <p style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: '0 0 12px' }}>New Feature</p>
                    <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Feature Name *</label><input autoFocus value={featureName} onChange={e => setFeatureName(e.target.value)} placeholder="e.g., Authentication, Dashboard UI" style={inputStyle} /></div>
                    <div style={{ marginBottom: '10px' }}>
                      <label style={labelStyle}>Attach to Phase <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label>
                      <select value={featureMilestone} onChange={e => setFeatureMilestone(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                        <option value="">Select milestone...</option>
                        {milestones.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}><label style={labelStyle}>Start Date <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label><input type="date" value={featureStart} onChange={e => setFeatureStart(e.target.value)} style={inputStyle} /></div>
                      <div style={{ flex: 1 }}><label style={labelStyle}>End Date <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span></label><input type="date" value={featureEnd} onChange={e => setFeatureEnd(e.target.value)} style={inputStyle} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setShowFeatureForm(false)} style={secondaryBtnStyle}>Cancel</button>
                      <button onClick={addFeature} disabled={!featureName.trim()} style={primaryBtnStyle(!!featureName.trim())}>Add Feature</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowFeatureForm(true)} style={{ width: '100%', padding: '14px', background: 'transparent', border: '1.5px dashed rgba(139,92,246,0.4)', borderRadius: '12px', color: '#a78bfa', cursor: 'pointer', fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 600, marginBottom: '20px', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    + Add Feature
                  </button>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button onClick={() => setStep(2)} style={secondaryBtnStyle}>Back</button>
                  <button onClick={handleComplete} style={{ ...secondaryBtnStyle, flex: 1 }}>Skip for Now</button>
                  <button onClick={handleComplete} disabled={loading} style={primaryBtnStyle(!loading)}>{loading ? 'Finishing…' : '🚀 Complete Setup'}</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.03em' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontFamily: 'Space Grotesk', outline: 'none', transition: 'border-color 0.2s' }
const secondaryBtnStyle: React.CSSProperties = { padding: '10px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600 }
const primaryBtnStyle = (enabled: boolean): React.CSSProperties => ({ padding: '10px 24px', background: enabled ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(139,92,246,0.3)', border: 'none', borderRadius: '10px', color: enabled ? 'white' : 'rgba(255,255,255,0.4)', cursor: enabled ? 'pointer' : 'not-allowed', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, boxShadow: enabled ? '0 0 20px rgba(139,92,246,0.4)' : 'none', transition: 'all 0.2s' })