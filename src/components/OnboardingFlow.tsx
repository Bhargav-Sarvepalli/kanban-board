import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../supabase'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
}

const ONBOARDING_VERSION = '2026-flow-productivity-v2'

const steps = [
  {
    eyebrow: 'Welcome',
    title: 'Your calm command center',
    body: 'NexTask keeps daily work, projects, meetings, focus sessions, and AI help in one simple workspace.',
    points: ['Personal tasks live in Personal', 'Team work lives inside workspaces', 'Projects unlock Dashboard, Board, Flow, Calendar, and Timer'],
  },
  {
    eyebrow: 'Board',
    title: 'Move work by dragging cards',
    body: 'The board is the operating surface. Create tasks, assign owners, set due dates, and drag cards through the columns as work changes.',
    points: ['To Do starts work', 'In Progress shows active ownership', 'Review catches handoffs', 'Done powers progress'],
  },
  {
    eyebrow: 'Flow',
    title: 'See the project like a manager',
    body: 'Flow turns project features into branches on a clean trunk. Open a feature branch to manage its board, then merge when its work is complete.',
    points: ['Phases show the main project timeline', 'Branches show feature ownership and risk', 'Standup mode gives a fast meeting brief'],
  },
  {
    eyebrow: 'Focus',
    title: 'Plan time, then protect it',
    body: 'Use Calendar for meetings and manual entries, Timer for deep work, and Nex when you want quick help creating or organizing tasks.',
    points: ['Calendar keeps tasks and meetings together', 'Timer gives a fullscreen focus clock with optional beats', 'Nex can help create and reason about work'],
  },
]

export default function OnboardingFlow({ userId, userName, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const firstName = userName.split(' ')[0] || 'there'
  const current = steps[step]
  const isLast = step === steps.length - 1

  const complete = async () => {
    setSaving(true)
    try {
      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', userId)
      localStorage.setItem('nex_onboarding_version_seen', ONBOARDING_VERSION)
      onComplete()
    } catch (err) {
      console.error('Onboarding complete error:', err)
      toast.error('Could not save onboarding status')
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
      background: 'radial-gradient(circle at 18% 18%, rgba(236,72,153,0.18), transparent 30%), radial-gradient(circle at 82% 20%, rgba(6,182,212,0.16), transparent 28%), rgba(3,4,10,0.9)',
      backdropFilter: 'blur(18px)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.98 }}
          transition={{ type: 'spring', damping: 30, stiffness: 280 }}
          style={{
            width: 'min(760px, 100%)',
            overflow: 'hidden',
            borderRadius: '28px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'linear-gradient(180deg, rgba(18,20,31,0.98), rgba(9,10,17,0.98))',
            boxShadow: '0 42px 120px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #06b6d4)' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '28px', padding: '32px' }}>
            <div style={{
              minHeight: '360px',
              borderRadius: '22px',
              padding: '22px',
              background: 'radial-gradient(circle at 35% 20%, rgba(255,255,255,0.16), transparent 24%), linear-gradient(150deg, rgba(236,72,153,0.2), rgba(139,92,246,0.18), rgba(6,182,212,0.14))',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
                  color: 'white',
                  fontWeight: 900,
                  boxShadow: '0 18px 46px rgba(139,92,246,0.36)',
                }}>N</div>
                <p style={{ margin: '18px 0 0', color: 'rgba(255,255,255,0.62)', fontSize: '12px', fontWeight: 850, letterSpacing: '0.14em' }}>NEXTASK</p>
              </div>

              <div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  {steps.map((_, index) => (
                    <div key={index} style={{
                      height: '6px',
                      width: index === step ? '28px' : '8px',
                      borderRadius: '999px',
                      background: index <= step ? 'white' : 'rgba(255,255,255,0.22)',
                      transition: 'all 0.2s ease',
                    }} />
                  ))}
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: '12px', lineHeight: 1.5 }}>
                  Step {step + 1} of {steps.length}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '360px' }}>
              <p style={{ margin: 0, color: '#67e8f9', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {current.eyebrow}
              </p>
              <h1 style={{ margin: '12px 0 10px', color: 'white', fontSize: '34px', lineHeight: 1.05, fontWeight: 870, letterSpacing: 0 }}>
                {step === 0 ? `Welcome, ${firstName}.` : current.title}
              </h1>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.54)', fontSize: '15px', lineHeight: 1.65 }}>
                {step === 0 ? current.body : current.body}
              </p>

              <div style={{ display: 'grid', gap: '10px', marginTop: '26px' }}>
                {current.points.map((point, index) => (
                  <motion.div
                    key={point}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * index }}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '13px 14px',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.035)',
                    }}
                  >
                    <span style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 850,
                      background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                    }}>{index + 1}</span>
                    <span style={{ color: 'rgba(255,255,255,0.78)', fontSize: '13px', lineHeight: 1.45 }}>{point}</span>
                  </motion.div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', gap: '12px', paddingTop: '28px' }}>
                <button
                  type="button"
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  disabled={step === 0}
                  style={{
                    height: '44px',
                    padding: '0 18px',
                    borderRadius: '13px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)',
                    color: step === 0 ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.72)',
                    cursor: step === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 760,
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isLast) void complete()
                    else setStep(s => s + 1)
                  }}
                  disabled={saving}
                  style={{
                    height: '44px',
                    padding: '0 22px',
                    borderRadius: '13px',
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
                    color: 'white',
                    cursor: saving ? 'wait' : 'pointer',
                    fontWeight: 840,
                    boxShadow: '0 18px 42px rgba(139,92,246,0.34)',
                  }}
                >
                  {saving ? 'Saving...' : isLast ? 'Enter NexTask' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  )
}
