import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
}

const ONBOARDING_VERSION = '2026-action-quickstart-v4'

const slides = [
  {
    eyebrow: 'Command center',
    title: 'Choose where work lives',
    caption: 'Personal is private. Workspaces are for teams. Projects unlock Flow, board, calendar, and Nex.',
    visual: 'command',
    action: 'Try it',
    done: 'Done',
    chips: ['Personal', 'Workspace', 'Project'],
  },
  {
    eyebrow: 'Board',
    title: 'Move work once it changes',
    caption: 'Drag cards through the board. Progress updates from what is actually done, not what someone promised.',
    visual: 'board',
    action: 'Try it',
    done: 'Moved',
    chips: ['Todo', 'Doing', 'Review', 'Done'],
  },
  {
    eyebrow: 'Flow',
    title: 'Read the project in standup',
    caption: 'Flow shows phases as the trunk and features as branches. Open a branch, clear blockers, merge when complete.',
    visual: 'flow',
    action: 'Try it',
    done: 'Brief ready',
    chips: ['Risks', 'Branches', 'Merge'],
  },
  {
    eyebrow: 'Nex',
    title: 'Ask Nex to operate',
    caption: 'Nex can brief the manager, create tasks, update details, move cards, and delete work when you ask clearly.',
    visual: 'nex',
    action: 'Try it',
    done: 'Briefed',
    chips: ['Create', 'Modify', 'Delete'],
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
        <div style={{ width: '116px', height: '116px', borderRadius: '50%', margin: '0 auto', background: 'radial-gradient(circle at 35% 30%, #fff, #a78bfa 24%, #7c3aed 54%, #111827 82%)', boxShadow: '0 0 70px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.5)', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '39px', top: '47px', width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.72)', boxShadow: '0 0 18px rgba(255,255,255,0.55)' }} />
          <span style={{ position: 'absolute', right: '39px', top: '47px', width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.72)', boxShadow: '0 0 18px rgba(255,255,255,0.55)' }} />
        </div>
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
  const [completed, setCompleted] = useState<number[]>([])
  const firstName = userName.split(' ')[0] || 'there'
  const slide = slides[step]
  const isLast = step === slides.length - 1
  const acted = completed.includes(step)

  const complete = async () => {
    setSaving(true)
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId)
      localStorage.setItem('nex_onboarding_version_seen', ONBOARDING_VERSION)
      onComplete()
    } catch (err) {
      console.error('Onboarding complete error:', err)
      toast.error('Could not save onboarding')
    } finally {
      setSaving(false)
    }
  }

  const runAction = () => {
    setCompleted(prev => prev.includes(step) ? prev : [...prev, step])
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
          borderRadius: '30px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(18,20,31,0.98), rgba(8,9,15,0.98))',
          boxShadow: '0 42px 120px rgba(0,0,0,0.74), inset 0 1px 0 rgba(255,255,255,0.08)',
          overflow: 'hidden',
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
                <button key={index} type="button" onClick={() => setStep(index)} aria-label={`Go to onboarding slide ${index + 1}`} style={{ width: index === step ? '30px' : '8px', height: '8px', borderRadius: '999px', border: 'none', background: index === step ? 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' : completed.includes(index) ? '#22c55e' : 'rgba(255,255,255,0.18)', cursor: 'pointer', transition: 'all 0.18s ease' }} />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
              <Visual type={slide.visual} acted={acted} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '18px', alignItems: 'center', marginTop: '20px' }}>
                <div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.62)', fontSize: '15px', lineHeight: 1.48 }}>{slide.caption}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
                    {slide.chips.map(chip => <MiniLabel key={chip}>{chip}</MiniLabel>)}
                  </div>
                </div>
                <button type="button" onClick={runAction} aria-label={`${slide.action}: ${slide.title}`} style={{ width: '46px', height: '46px', borderRadius: '50%', border: acted ? '1px solid rgba(34,197,94,0.55)' : '1px solid rgba(255,255,255,0.18)', background: acted ? 'rgba(34,197,94,0.16)' : 'linear-gradient(135deg, rgba(236,72,153,0.94), rgba(139,92,246,0.94), rgba(6,182,212,0.94))', color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: '18px', boxShadow: acted ? 'none' : '0 16px 34px rgba(139,92,246,0.26)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {acted ? '✓' : '›'}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px' }}>
            <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ height: '42px', padding: '0 16px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: step === 0 ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.72)', cursor: step === 0 ? 'not-allowed' : 'pointer', fontWeight: 760 }}>Back</button>
            <button type="button" onClick={() => { if (isLast) void complete(); else setStep(s => s + 1) }} disabled={saving} style={{ height: '42px', padding: '0 20px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.16)', background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)', color: 'white', cursor: saving ? 'wait' : 'pointer', fontWeight: 840, boxShadow: '0 18px 42px rgba(139,92,246,0.34)' }}>{saving ? 'Saving...' : isLast ? 'Enter NexTask' : 'Next'}</button>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
