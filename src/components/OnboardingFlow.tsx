import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import toast from 'react-hot-toast'

interface Props {
  userId: string
  userName: string
  onComplete: () => void
}

type UseCase = 'personal' | 'team' | 'freelance'

const USE_CASES: { id: UseCase; label: string; icon: string; desc: string }[] = [
  { id: 'personal', label: 'Personal',   icon: '🎯', desc: 'Track my own goals and tasks' },
  { id: 'team',     label: 'Team',       icon: '👥', desc: 'Manage work with my team'    },
  { id: 'freelance',label: 'Freelance',  icon: '💼', desc: 'Manage clients and projects'  },
]

const EXAMPLE_TASKS: Record<UseCase, string> = {
  personal:  'Plan my week',
  team:      'Set up team workspace',
  freelance: 'Onboard new client',
}

const TIPS = [
  { icon: '☀', title: 'Start with Today view', desc: 'Every morning, open Today to see exactly what needs your attention.' },
  { icon: '◉', title: 'Talk to Nex', desc: 'Click the orb at the bottom or press Space. Say "Add a task" or "Give me a briefing."' },
  { icon: '👥', title: 'Invite your team', desc: 'Open Workspaces from your profile menu and invite teammates by email.' },
]

export default function OnboardingFlow({ userId, userName, onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [useCase, setUseCase] = useState<UseCase>('personal')
  const [taskTitle, setTaskTitle] = useState(EXAMPLE_TASKS.personal)
  const [creating, setCreating] = useState(false)
  const [completing, setCompleting] = useState(false)

  const firstName = userName.split(' ')[0] || 'there'

  const handleUseCaseSelect = (uc: UseCase) => {
    setUseCase(uc)
    setTaskTitle(EXAMPLE_TASKS[uc])
  }

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return
    setCreating(true)
    const { error } = await supabase.from('tasks').insert({
      title: taskTitle.trim(),
      status: 'todo',
      priority: 'normal',
      user_id: userId,
      workspace_id: null,
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
    })
    if (error) {
      toast.error('Failed to create task')
      setCreating(false)
      return
    }
    setCreating(false)
    setStep(3)
  }

  const handleComplete = async () => {
    setCompleting(true)
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', userId)
    setCompleting(false)
    onComplete()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.88)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <AnimatePresence mode="wait">

        {/* ── STEP 1: WELCOME ── */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              background: '#0d0d0d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '24px',
              width: '100%', maxWidth: '480px',
              overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(0,0,0,0.9), 0 0 80px rgba(139,92,246,0.08)',
            }}
          >
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

            <div style={{ padding: '40px 36px 36px' }}>
              {/* Logo mark */}
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', fontWeight: 800, color: 'white',
                marginBottom: '24px',
                boxShadow: '0 0 30px rgba(139,92,246,0.4)',
              }}>
                N
              </div>

              <h1 style={{
                color: 'white', fontSize: '26px', fontWeight: 700,
                fontFamily: 'Space Grotesk', letterSpacing: '-0.02em',
                margin: '0 0 8px', lineHeight: 1.2,
              }}>
                Welcome, {firstName}. 👋
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.45)', fontSize: '14px',
                fontFamily: 'Space Grotesk', margin: '0 0 32px', lineHeight: 1.6,
              }}>
                NexTask takes 2 minutes to set up. Let's get you moving.
              </p>

              {/* Use case picker */}
              <p style={{
                color: 'rgba(255,255,255,0.3)', fontSize: '10px',
                fontFamily: 'Space Mono', letterSpacing: '0.18em',
                margin: '0 0 12px',
              }}>
                I'M USING NEXTASK FOR...
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
                {USE_CASES.map(uc => (
                  <motion.button
                    key={uc.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleUseCaseSelect(uc.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '14px', border: 'none',
                      background: useCase === uc.id
                        ? 'rgba(139,92,246,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      outline: `1.5px solid ${useCase === uc.id ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '22px', lineHeight: 1 }}>{uc.icon}</span>
                    <div>
                      <p style={{
                        color: useCase === uc.id ? '#c084fc' : 'rgba(255,255,255,0.85)',
                        fontSize: '14px', fontWeight: 600,
                        fontFamily: 'Space Grotesk', margin: 0, transition: 'color 0.15s',
                      }}>
                        {uc.label}
                      </p>
                      <p style={{
                        color: 'rgba(255,255,255,0.3)', fontSize: '12px',
                        fontFamily: 'Space Grotesk', margin: 0,
                      }}>
                        {uc.desc}
                      </p>
                    </div>
                    {useCase === uc.id && (
                      <span style={{ marginLeft: 'auto', color: '#8b5cf6', fontSize: '16px' }}>✓</span>
                    )}
                  </motion.button>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setStep(2)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  border: 'none', borderRadius: '12px', padding: '14px',
                  color: 'white', cursor: 'pointer',
                  fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 700,
                  boxShadow: '0 0 30px rgba(139,92,246,0.35)',
                }}
              >
                Let's go →
              </motion.button>

              {/* Step indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '20px' }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{
                    width: s === step ? '20px' : '6px', height: '6px',
                    borderRadius: '3px',
                    background: s === step ? '#8b5cf6' : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.3s ease',
                  }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: CREATE FIRST TASK ── */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              background: '#0d0d0d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '24px',
              width: '100%', maxWidth: '480px',
              overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
            }}
          >
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

            <div style={{ padding: '40px 36px 36px' }}>
              <div style={{ fontSize: '36px', marginBottom: '16px', lineHeight: 1 }}>✏️</div>

              <h2 style={{
                color: 'white', fontSize: '24px', fontWeight: 700,
                fontFamily: 'Space Grotesk', letterSpacing: '-0.02em',
                margin: '0 0 8px',
              }}>
                Create your first task
              </h2>
              <p style={{
                color: 'rgba(255,255,255,0.4)', fontSize: '13px',
                fontFamily: 'Space Grotesk', margin: '0 0 32px', lineHeight: 1.6,
              }}>
                We've pre-filled one based on your goal. Edit it or keep it — just hit Create.
              </p>

              {/* Task input */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: '14px', padding: '16px 18px',
                marginBottom: '24px',
                boxShadow: '0 0 20px rgba(139,92,246,0.1)',
              }}>
                <p style={{
                  color: 'rgba(255,255,255,0.3)', fontSize: '10px',
                  fontFamily: 'Space Mono', letterSpacing: '0.15em',
                  margin: '0 0 8px',
                }}>
                  TASK TITLE
                </p>
                <input
                  autoFocus
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !creating && handleCreateTask()}
                  style={{
                    width: '100%', background: 'transparent',
                    border: 'none', outline: 'none',
                    color: 'white', fontSize: '16px',
                    fontFamily: 'Space Grotesk', fontWeight: 500,
                    padding: 0,
                  }}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleCreateTask}
                disabled={creating || !taskTitle.trim()}
                style={{
                  width: '100%',
                  background: creating ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  border: 'none', borderRadius: '12px', padding: '14px',
                  color: 'white', cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 700,
                  boxShadow: creating ? 'none' : '0 0 30px rgba(139,92,246,0.35)',
                  marginBottom: '12px',
                }}
              >
                {creating ? '⟳ Creating...' : '+ Create task →'}
              </motion.button>

              <button
                onClick={() => setStep(3)}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.25)', cursor: 'pointer',
                  fontSize: '12px', fontFamily: 'Space Grotesk', padding: '6px',
                }}
              >
                Skip for now
              </button>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '20px' }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{
                    width: s === step ? '20px' : '6px', height: '6px',
                    borderRadius: '3px',
                    background: s === step ? '#8b5cf6' : s < step ? '#34d399' : 'rgba(255,255,255,0.15)',
                    transition: 'all 0.3s ease',
                  }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: YOU'RE READY ── */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              background: '#0d0d0d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '24px',
              width: '100%', maxWidth: '480px',
              overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
            }}
          >
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)' }} />

            <div style={{ padding: '40px 36px 36px' }}>
              {/* Success animation */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(52,211,153,0.15)',
                  border: '2px solid rgba(52,211,153,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', marginBottom: '20px',
                  boxShadow: '0 0 30px rgba(52,211,153,0.2)',
                }}
              >
                ✓
              </motion.div>

              <h2 style={{
                color: 'white', fontSize: '24px', fontWeight: 700,
                fontFamily: 'Space Grotesk', letterSpacing: '-0.02em',
                margin: '0 0 6px',
              }}>
                You're all set, {firstName}.
              </h2>
              <p style={{
                color: 'rgba(255,255,255,0.4)', fontSize: '13px',
                fontFamily: 'Space Grotesk', margin: '0 0 28px', lineHeight: 1.6,
              }}>
                Here's what to explore next.
              </p>

              {/* Tips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                {TIPS.map((tip, i) => (
                  <motion.div
                    key={tip.title}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.08 }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '14px',
                      padding: '14px 16px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <span style={{
                      fontSize: '20px', lineHeight: 1, flexShrink: 0,
                      width: '32px', height: '32px',
                      background: 'rgba(139,92,246,0.12)',
                      borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tip.icon}
                    </span>
                    <div>
                      <p style={{
                        color: 'white', fontSize: '13px', fontWeight: 600,
                        fontFamily: 'Space Grotesk', margin: '0 0 2px',
                      }}>
                        {tip.title}
                      </p>
                      <p style={{
                        color: 'rgba(255,255,255,0.35)', fontSize: '12px',
                        fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1.5,
                      }}>
                        {tip.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleComplete}
                disabled={completing}
                style={{
                  width: '100%',
                  background: completing ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  border: 'none', borderRadius: '12px', padding: '14px',
                  color: 'white', cursor: completing ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 700,
                  boxShadow: completing ? 'none' : '0 0 30px rgba(139,92,246,0.35)',
                }}
              >
                {completing ? '⟳ Loading...' : 'Go to NexTask →'}
              </motion.button>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '20px' }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{
                    width: s === step ? '20px' : '6px', height: '6px',
                    borderRadius: '3px',
                    background: '#34d399',
                    transition: 'all 0.3s ease',
                  }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}