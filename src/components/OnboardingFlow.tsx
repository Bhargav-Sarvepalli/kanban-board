import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
}

const ONBOARDING_VERSION = '2026-visual-quickstart-v3'

const slides = [
  {
    title: 'Run work from one calm screen',
    caption: 'Tasks, projects, meetings, focus, and Nex.',
    visual: 'command',
    chips: ['Personal', 'Workspace', 'Projects'],
  },
  {
    title: 'Move cards. See progress.',
    caption: 'Drag work through the board as the team updates.',
    visual: 'board',
    chips: ['To do', 'Progress', 'Review', 'Done'],
  },
  {
    title: 'Flow is your manager map',
    caption: 'Branches show features. Merge when work is done.',
    visual: 'flow',
    chips: ['Phases', 'Branches', 'Standup'],
  },
  {
    title: 'Nex keeps meetings sharp',
    caption: 'Ask for briefs, risks, next actions, or task changes.',
    visual: 'nex',
    chips: ['Brief', 'Create', 'Update', 'Delete'],
  },
]

function Visual({ type }: { type: string }) {
  if (type === 'board') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', height: '160px' }}>
        {['#ec4899', '#8b5cf6', '#06b6d4', '#22c55e'].map((color, col) => (
          <div key={color} style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.08)', padding: '8px' }}>
            {[0, 1, 2].slice(0, col === 3 ? 1 : 3).map(i => (
              <div key={i} style={{ height: i === 0 ? '34px' : '26px', borderRadius: '9px', marginBottom: '7px', background: `${color}${i === 0 ? '44' : '22'}`, border: `1px solid ${color}55` }} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'flow') {
    return (
      <svg viewBox="0 0 360 160" style={{ width: '100%', height: '160px', overflow: 'visible' }}>
        <defs>
          <linearGradient id="flowLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="52%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
        <path d="M34 84 H326" stroke="url(#flowLine)" strokeWidth="8" strokeLinecap="round" opacity="0.88" />
        {[52, 170, 294].map((x, i) => (
          <circle key={x} cx={x} cy="84" r={i === 1 ? 18 : 14} fill="#111827" stroke={i === 1 ? '#8b5cf6' : '#67e8f9'} strokeWidth="4" />
        ))}
        <path d="M96 80 C116 34 152 34 170 66" fill="none" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" />
        <path d="M184 102 C212 132 248 132 270 94" fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />
        <rect x="108" y="24" width="96" height="28" rx="10" fill="rgba(236,72,153,0.18)" stroke="rgba(236,72,153,0.45)" />
        <rect x="218" y="118" width="92" height="28" rx="10" fill="rgba(6,182,212,0.16)" stroke="rgba(6,182,212,0.42)" />
      </svg>
    )
  }

  if (type === 'nex') {
    return (
      <div style={{ height: '160px', display: 'grid', placeItems: 'center' }}>
        <div style={{ width: '116px', height: '116px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff, #a78bfa 24%, #7c3aed 54%, #111827 82%)', boxShadow: '0 0 70px rgba(139,92,246,0.5), inset 0 1px 0 rgba(255,255,255,0.5)' }} />
      </div>
    )
  }

  return (
    <div style={{ height: '160px', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '12px' }}>
      <div style={{ borderRadius: '18px', background: 'linear-gradient(135deg, rgba(236,72,153,0.22), rgba(139,92,246,0.2))', border: '1px solid rgba(255,255,255,0.1)', padding: '14px' }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 900 }}>N</div>
        <div style={{ height: '10px', width: '76%', borderRadius: '99px', background: 'rgba(255,255,255,0.38)', marginTop: '30px' }} />
        <div style={{ height: '10px', width: '52%', borderRadius: '99px', background: 'rgba(255,255,255,0.18)', marginTop: '10px' }} />
      </div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {['#ec4899', '#8b5cf6', '#06b6d4'].map(color => (
          <div key={color} style={{ borderRadius: '15px', background: `${color}22`, border: `1px solid ${color}44` }} />
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
          width: 'min(560px, 100%)',
          borderRadius: '30px',
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'linear-gradient(180deg, rgba(18,20,31,0.98), rgba(8,9,15,0.98))',
          boxShadow: '0 42px 120px rgba(0,0,0,0.74), inset 0 1px 0 rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' }} />
        <div style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.46)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em' }}>WELCOME {step === 0 ? firstName.toUpperCase() : ''}</p>
              <h1 style={{ margin: '7px 0 0', color: 'white', fontSize: '30px', lineHeight: 1.05, fontWeight: 880, letterSpacing: 0 }}>{slide.title}</h1>
            </div>
            <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 900 }}>N</div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
              <Visual type={slide.visual} />
              <p style={{ margin: '22px 0 0', color: 'rgba(255,255,255,0.58)', fontSize: '15px', lineHeight: 1.45 }}>{slide.caption}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                {slide.chips.map(chip => (
                  <span key={chip} style={{ padding: '7px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.74)', fontSize: '12px', fontWeight: 720 }}>{chip}</span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '30px' }}>
            <div style={{ display: 'flex', gap: '7px' }}>
              {slides.map((_, index) => (
                <button key={index} type="button" onClick={() => setStep(index)} aria-label={`Go to onboarding slide ${index + 1}`} style={{ width: index === step ? '28px' : '8px', height: '8px', borderRadius: '999px', border: 'none', background: index === step ? 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' : 'rgba(255,255,255,0.18)', cursor: 'pointer', transition: 'all 0.18s ease' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ height: '42px', padding: '0 16px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: step === 0 ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.72)', cursor: step === 0 ? 'not-allowed' : 'pointer', fontWeight: 760 }}>Back</button>
              <button type="button" onClick={() => { if (isLast) void complete(); else setStep(s => s + 1) }} disabled={saving} style={{ height: '42px', padding: '0 20px', borderRadius: '13px', border: '1px solid rgba(255,255,255,0.16)', background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)', color: 'white', cursor: saving ? 'wait' : 'pointer', fontWeight: 840, boxShadow: '0 18px 42px rgba(139,92,246,0.34)' }}>{saving ? 'Saving...' : isLast ? 'Start' : 'Next'}</button>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
