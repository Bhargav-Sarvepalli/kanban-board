import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'focus' | 'short' | 'long'

const MODES: Record<Mode, { label: string; minutes: number; tone: string }> = {
  focus: { label: 'Focus', minutes: 25, tone: '#8b5cf6' },
  short: { label: 'Break', minutes: 5, tone: '#2dd4bf' },
  long:  { label: 'Long break', minutes: 15, tone: '#60a5fa' },
}

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return [String(m).padStart(2, '0'), String(s).padStart(2, '0')]
}

function RaisedButton({
  children, onClick, active = false, primary = false, disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: '54px',
        borderRadius: '14px',
        border: primary || active ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.08)',
        background: primary
          ? 'linear-gradient(180deg, #8b5cf6, #6d28d9)'
          : active
          ? 'linear-gradient(180deg, rgba(139,92,246,0.26), rgba(139,92,246,0.14))'
          : 'linear-gradient(180deg, #232633, #171a24)',
        color: primary ? 'white' : active ? '#ddd6fe' : 'rgba(255,255,255,0.78)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '12px',
        fontWeight: 800,
        letterSpacing: '0.02em',
        boxShadow: primary
          ? '0 10px 24px rgba(109,40,217,0.32), inset 0 1px 0 rgba(255,255,255,0.18)'
          : '0 10px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}

function FlipUnit({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{
        width: '154px',
        height: '138px',
        borderRadius: '18px',
        background: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 48%, #dfe5ee 49%, #f7f9fc 100%)',
        border: '1px solid rgba(255,255,255,0.72)',
        boxShadow: '0 22px 50px rgba(0,0,0,0.48), inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -18px 36px rgba(15,23,42,0.08)',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1px', background: 'rgba(15,23,42,0.12)' }} />
        <span style={{
          color: '#111827',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '74px',
          fontWeight: 850,
          letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {value}
        </span>
      </div>
      <p style={{ margin: '12px 0 0', textAlign: 'center', color: 'rgba(255,255,255,0.42)', fontSize: '11px', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, letterSpacing: '0.12em' }}>
        {label}
      </p>
    </div>
  )
}

export default function PomodoroView() {
  const [mode, setMode] = useState<Mode>('focus')
  const [seconds, setSeconds] = useState(MODES.focus.minutes * 60)
  const [running, setRunning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [focusCount, setFocusCount] = useState(() => Number(localStorage.getItem('nex_pomo_count') ?? 0))
  const [intention, setIntention] = useState(() => localStorage.getItem('nex_pomo_intention') ?? '')
  const rootRef = useRef<HTMLDivElement>(null)

  const totalSeconds = MODES[mode].minutes * 60
  const progress = 1 - seconds / totalSeconds
  const [minutes, secs] = mmss(seconds)

  const nextMode = useMemo<Mode>(() => {
    if (mode !== 'focus') return 'focus'
    return (focusCount + 1) % 4 === 0 ? 'long' : 'short'
  }, [mode, focusCount])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSeconds(prev => {
        if (prev > 1) return prev - 1
        setRunning(false)
        if (mode === 'focus') {
          setFocusCount(c => {
            const next = c + 1
            localStorage.setItem('nex_pomo_count', String(next))
            return next
          })
        }
        setMode(nextMode)
        return MODES[nextMode].minutes * 60
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, mode, nextMode])

  const chooseMode = (next: Mode) => {
    setMode(next)
    setSeconds(MODES[next].minutes * 60)
    setRunning(false)
  }

  const reset = () => {
    setSeconds(MODES[mode].minutes * 60)
    setRunning(false)
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await rootRef.current?.requestFullscreen()
    } catch {
      setIsFullscreen(v => !v)
    }
  }

  return (
    <div ref={rootRef} style={{
      height: '100%',
      minHeight: '100%',
      background: 'radial-gradient(circle at 50% 15%, rgba(139,92,246,0.1), transparent 36%), #090a0f',
      display: 'grid',
      placeItems: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} style={{
        position: 'absolute',
        top: '18px',
        right: '18px',
        width: '34px',
        height: '34px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'linear-gradient(180deg, #1f2230, #131620)',
        color: 'rgba(255,255,255,0.72)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        boxShadow: '0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}>
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          {isFullscreen ? (
            <path d="M6.6 2.8v3.8H2.8M11.4 15.2v-3.8h3.8M11.4 2.8v3.8h3.8M6.6 15.2v-3.8H2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M6.6 2.8H2.8v3.8M11.4 2.8h3.8v3.8M6.6 15.2H2.8v-3.8M11.4 15.2h3.8v-3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>

      <section style={{
        width: 'min(900px, calc(100vw - 72px))',
        borderRadius: '28px',
        padding: '34px',
        background: 'linear-gradient(180deg, #242735, #171a24)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
          <div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.48)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em' }}>FOCUS TIMER</p>
            <h2 style={{ margin: '6px 0 0', color: 'white', fontSize: '22px', fontWeight: 820, letterSpacing: '-0.02em' }}>{MODES[mode].label}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(Object.keys(MODES) as Mode[]).map(m => (
              <button key={m} onClick={() => chooseMode(m)}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  border: `1px solid ${mode === m ? MODES[m].tone : 'rgba(255,255,255,0.1)'}`,
                  background: mode === m ? `${MODES[m].tone}22` : 'rgba(255,255,255,0.035)',
                  color: mode === m ? 'white' : 'rgba(255,255,255,0.58)',
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: '12px',
                  fontWeight: 750,
                }}>
                {MODES[m].label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '32px', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '18px' }}>
              <FlipUnit value={minutes} label="MIN" />
              <span style={{ color: MODES[mode].tone, fontSize: '58px', fontWeight: 850, transform: 'translateY(-12px)' }}>:</span>
              <FlipUnit value={secs} label="SEC" />
            </div>
            <div style={{ height: '8px', marginTop: '30px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, borderRadius: '999px', background: MODES[mode].tone, transition: 'width 0.35s linear' }} />
            </div>
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.48)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em' }}>INTENTION</label>
            <textarea value={intention} onChange={e => { setIntention(e.target.value); localStorage.setItem('nex_pomo_intention', e.target.value) }}
              placeholder="What should be done when the clock hits zero?"
              style={{
                marginTop: '8px',
                width: '100%',
                minHeight: '88px',
                resize: 'none',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(8,10,16,0.46)',
                color: 'white',
                outline: 'none',
                padding: '12px',
                fontSize: '13px',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <RaisedButton onClick={() => setRunning(r => !r)} primary>{running ? 'Pause' : 'Start'}</RaisedButton>
              <RaisedButton onClick={reset}>Reset</RaisedButton>
              <RaisedButton onClick={() => chooseMode(nextMode)}>Skip</RaisedButton>
              <RaisedButton onClick={() => { if (!window.confirm('Clear today focus count?')) return; setFocusCount(0); localStorage.setItem('nex_pomo_count', '0') }}>
                Clear
              </RaisedButton>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.42)', fontSize: '12px', fontWeight: 650 }}>
              <span>{focusCount} focus blocks</span>
              <span>Next: {MODES[nextMode].label}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
