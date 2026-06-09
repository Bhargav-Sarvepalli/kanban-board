import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'
import { onboardingStorageKey } from '../lib/onboarding'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
}

const slides = [
  {
    eyebrow: 'Command center',
    title: 'Choose where work lives',
    caption: 'Personal is private. Workspaces are for teams. Projects unlock Flow, board, calendar, and Nex.',
    visual: 'command',
  },
  {
    eyebrow: 'Board',
    title: 'Move work once it changes',
    caption: 'Drag cards through the board. Progress updates from what is actually done, not what someone promised.',
    visual: 'board',
  },
  {
    eyebrow: 'Flow',
    title: 'Read the project in standup',
    caption: 'Flow shows phases as the trunk and features as branches. Open a branch, clear blockers, merge when complete.',
    visual: 'flow',
  },
  {
    eyebrow: 'Nex',
    title: 'Ask Nex to operate',
    caption: 'Nex can brief the manager, create tasks, update details, move cards, and delete work when you ask clearly.',
    visual: 'nex',
  },
]

function MiniLabel({ children, active = false }: { children: string; active?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: '0 9px',
      borderRadius: '999px',
      background: active ? 'linear-gradient(135deg, rgba(236,72,153,0.32), rgba(6,182,212,0.24))' : 'rgba(255,255,255,0.065)',
      border: active ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.09)',
      color: active ? '#fff' : 'rgba(255,255,255,0.72)',
      fontSize: '11px',
      fontWeight: 780,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function NexOrb() {
  return (
    <div style={{ width: '116px', height: '116px', borderRadius: '50%', margin: '0 auto', background: 'radial-gradient(circle at 34% 24%, rgba(255,255,255,0.96), rgba(216,196,255,0.64) 10%, rgba(142,86,255,0.95) 38%, rgba(94,43,196,0.98) 72%, #27105b 100%)', boxShadow: '0 0 70px rgba(139,92,246,0.5), inset -18px -22px 42px rgba(18,8,55,0.34), inset 12px 14px 26px rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
      <motion.span
        animate={{ x: [0, 5, -2, 0], y: [0, -2, 2, 0], opacity: [0.78, 1, 0.86, 0.78] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', left: '43px', top: '53px', width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.8)', boxShadow: '0 0 18px rgba(255,255,255,0.6)' }}
      />
      <motion.span
        animate={{ x: [0, -4, 2, 0], y: [0, 2, -1, 0], opacity: [0.7, 0.92, 0.8, 0.7] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', left: '72px', top: '53px', width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.74)', boxShadow: '0 0 18px rgba(255,255,255,0.46)' }}
      />
      <motion.span
        animate={{ x: [0, 8, -3, 0], y: [0, 5, -4, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', left: '35px', top: '34px', width: '30px', height: '22px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', filter: 'blur(8px)' }}
      />
    </div>
  )
}

function Visual({ type, acted }: { type: string; acted: boolean }) {
  if (type === 'board') {
    const cols = [
      { name: 'Todo', color: '#ec4899', cards: ['Landing copy', 'Invite flow'] },
      { name: 'Doing', color: '#8b5cf6', cards: ['Auth polish'] },
      { name: 'Review', color: '#06b6d4', cards: acted ? ['Flow curves'] : [] },
      { name: 'Done', color: '#22c55e', cards: ['Sidebar'] },
    ]
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', minHeight: '172px' }}>
        {cols.map(col => (
          <div key={col.name} style={{ minWidth: 0, borderRadius: '15px', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', padding: '9px' }}>
            <p style={{ margin: '0 0 9px', color: col.color, fontSize: '10px', fontWeight: 850, letterSpacing: '0.08em' }}>{col.name}</p>
            {col.cards.map(card => (
              <div key={card} style={{ minHeight: '34px', borderRadius: '10px', marginBottom: '7px', padding: '8px', background: `${col.color}22`, border: `1px solid ${col.color}55`, color: 'rgba(255,255,255,0.86)', fontSize: '11px', fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card}</div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'flow') {
    return (
      <svg viewBox="0 0 420 184" style={{ width: '100%', height: '184px', overflow: 'visible' }}>
        <defs>
          <linearGradient id="flowLineOnboarding" x1="0" x2="1">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="52%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <path d="M34 98 H386" stroke="url(#flowLineOnboarding)" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
        <path d="M94 95 C108 44 160 44 178 76" fill="none" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" opacity={acted ? 1 : 0.55} />
        <path d="M190 120 C226 158 284 154 310 106" fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" opacity={acted ? 1 : 0.55} />
        <rect x="118" y="26" width="112" height="36" rx="12" fill="rgba(236,72,153,0.16)" stroke="rgba(236,72,153,0.45)" />
        <text x="174" y="49" textAnchor="middle" fill="white" fontSize="12" fontWeight="800">Auth branch</text>
        <rect x="254" y="136" width="116" height="36" rx="12" fill="rgba(6,182,212,0.14)" stroke="rgba(6,182,212,0.42)" />
        <text x="312" y="159" textAnchor="middle" fill="white" fontSize="12" fontWeight="800">Review merge</text>
        {[
          { x: 56, label: 'Kickoff', color: '#ec4899' },
          { x: 210, label: 'Design', color: '#8b5cf6' },
          { x: 360, label: 'Launch', color: '#06b6d4' },
        ].map(node => (
          <g key={node.label}>
            <circle cx={node.x} cy="98" r="16" fill="#10131f" stroke={node.color} strokeWidth="4" />
            <text x={node.x} y="132" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="11" fontWeight="800">{node.label}</text>
          </g>
        ))}
      </svg>
    )
  }

  if (type === 'nex') {
    return (
      <div style={{ minHeight: '172px', display: 'grid', gridTemplateColumns: '132px 1fr', gap: '16px', alignItems: 'center' }}>
        <NexOrb />
        <div style={{ display: 'grid', gap: '9px' }}>
          {['Health: at risk', 'Attention: Flow Graph', acted ? 'Decision: move to review' : 'Ask: standup brief'].map((line, i) => (
            <div key={line} style={{ borderRadius: '13px', padding: '10px 12px', background: i === 1 ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.055)', border: i === 1 ? '1px solid rgba(236,72,153,0.35)' : '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.84)', fontSize: '12px', fontWeight: 760 }}>{line}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '172px', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '12px' }}>
      <div style={{ borderRadius: '18px', background: 'linear-gradient(135deg, rgba(236,72,153,0.22), rgba(139,92,246,0.2))', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 900 }}>N</div>
          <div>
            <p style={{ margin: 0, color: 'white', fontSize: '14px', fontWeight: 850 }}>Product Launch</p>
            <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.54)', fontSize: '11px' }}>Team project</p>
          </div>
        </div>
        <MiniLabel active={acted}>Team workspace</MiniLabel>
        <MiniLabel>Board + Flow ready</MiniLabel>
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {['Personal', 'Team Workspace', 'New project'].map((label, i) => (
          <div key={label} style={{ borderRadius: '15px', padding: '12px', background: i === 1 && acted ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.045)', border: i === 1 && acted ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.84)', fontSize: '12px', fontWeight: 800 }}>{label}</div>
        ))}
      </div>
    </div>
  )
}

export default function OnboardingFlow({ userId, userName, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const firstName = userName.split(' ')[0] || 'there'
  const slide = slides[step]
  const isLast = step === slides.length - 1
  const acted = step > 0
  const [taskTitle, setTaskTitle] = useState('')
  const [taskCreated, setTaskCreated] = useState(false)
  const [creatingTask, setCreatingTask] = useState(false)

  const createFirstTask = async () => {
    if (!taskTitle.trim() || creatingTask) return
    setCreatingTask(true)
    try {
      const { error } = await supabase.from('tasks').insert({
        title: taskTitle.trim(),
        status: 'todo',
        user_id: userId,
        priority: 'normal',
        created_at: new Date().toISOString(),
      })
      if (error) throw error
      setTaskCreated(true)
      toast.success('First task created!')
    } catch (err) {
      console.error(err)
      toast.error('Could not create task. You can add it after setup.')
      setTaskCreated(true) // still let them through
    } finally {
      setCreatingTask(false)
    }
  }

  const complete = async () => {
    setSaving(true)
    try {
      localStorage.setItem(onboardingStorageKey(userId), 'done')
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: user?.email ?? '',
        full_name: userName || user?.email?.split('@')[0] || 'User',
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (error) console.warn('Onboarding profile update failed; local completion saved.', error)
      onComplete()
    } catch (err) {
      console.error('Onboarding complete error:', err)
      toast.error('Could not save onboarding')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9000,
      display: 'grid',
      placeItems: 'center',
      padding: '18px',
      background: 'radial-gradient(circle at 18% 16%, rgba(236,72,153,0.18), transparent 28%), radial-gradient(circle at 84% 20%, rgba(6,182,212,0.16), transparent 28%), rgba(3,4,10,0.9)',
      backdropFilter: 'blur(18px)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'calc(100vh - 36px)',
          borderRadius: '30px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(18,20,31,0.98), rgba(8,9,15,0.98))',
          boxShadow: '0 42px 120px rgba(0,0,0,0.74), inset 0 1px 0 rgba(255,255,255,0.08)',
          overflow: 'auto',
        }}
      >
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' }} />
        <div style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={{ margin: 0, color: '#67e8f9', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{slide.eyebrow}</p>
              <h1 style={{ margin: '8px 0 0', color: 'white', fontSize: '32px', lineHeight: 1.04, fontWeight: 880, letterSpacing: 0 }}>{step === 0 ? `Welcome, ${firstName}.` : slide.title}</h1>
            </div>
            <div style={{ display: 'flex', gap: '7px', paddingTop: '5px' }}>
              {slides.map((_, index) => (
                <button key={index} type="button" onClick={() => setStep(index)} aria-label={`Go to onboarding slide ${index + 1}`} style={{ width: index === step ? '30px' : '8px', height: '8px', borderRadius: '999px', border: 'none', background: index === step ? 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' : 'rgba(255,255,255,0.18)', cursor: 'pointer', transition: 'all 0.18s ease' }} />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
              <Visual type={slide.visual} acted={acted} />
              <p style={{ margin: '20px 0 0', color: 'rgba(255,255,255,0.62)', fontSize: '15px', lineHeight: 1.48 }}>{slide.caption}</p>
            </motion.div>
          </AnimatePresence>

          <div style={{ marginTop: '24px' }}>
            {isLast && !taskCreated && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.56)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.14em' }}>
                  CREATE YOUR FIRST TASK TO CONTINUE
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void createFirstTask() }}
                    placeholder="e.g. Set up project structure"
                    autoFocus
                    style={{
                      flex: 1, height: '42px', borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.16)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'white', outline: 'none',
                      padding: '0 14px', fontSize: '13px',
                      fontFamily: 'Space Grotesk',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void createFirstTask()}
                    disabled={!taskTitle.trim() || creatingTask}
                    style={{
                      height: '42px', padding: '0 18px', borderRadius: '10px',
                      border: 'none',
                      background: taskTitle.trim() ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'rgba(255,255,255,0.08)',
                      color: taskTitle.trim() ? 'white' : 'rgba(255,255,255,0.32)',
                      cursor: taskTitle.trim() ? 'pointer' : 'not-allowed',
                      fontSize: '12px', fontFamily: 'Space Mono', fontWeight: 800,
                    }}
                  >
                    {creatingTask ? 'ADDING...' : 'ADD TASK'}
                  </button>
                </div>
              </div>
            )}

            {isLast && taskCreated && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#34d399', fontSize: '16px' }}>✓</span>
                <p style={{ margin: 0, color: '#34d399', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                  "{taskTitle}" added to your board
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                style={{ height: '42px', padding: '0 16px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: step === 0 ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.72)', cursor: step === 0 ? 'not-allowed' : 'pointer', fontWeight: 760 }}>Back</button>
              <button type="button" onClick={() => void complete()} disabled={saving}
                style={{ height: '42px', padding: '0 14px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.62)', cursor: saving ? 'wait' : 'pointer', fontWeight: 760 }}>Skip setup</button>
              <button type="button"
                onClick={() => { if (isLast) void complete(); else setStep(s => s + 1) }}
                disabled={saving || (isLast && !taskCreated)}
                style={{
                  height: '42px', padding: '0 20px', borderRadius: '13px',
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: (isLast && !taskCreated) ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
                  color: (isLast && !taskCreated) ? 'rgba(255,255,255,0.32)' : 'white',
                  cursor: (saving || (isLast && !taskCreated)) ? 'not-allowed' : 'pointer',
                  fontWeight: 840,
                  boxShadow: (isLast && !taskCreated) ? 'none' : '0 18px 42px rgba(139,92,246,0.34)',
                }}>
                {saving ? 'Saving...' : isLast ? 'Enter NexTask' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
