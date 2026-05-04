import { useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'focus' | 'short' | 'long'

const MODES: Record<Mode, { label: string; minutes: number; tone: string }> = {
  focus: { label: 'Focus', minutes: 25, tone: '#8b5cf6' },
  short: { label: 'Short break', minutes: 5, tone: '#22c55e' },
  long:  { label: 'Long break', minutes: 15, tone: '#60a5fa' },
}

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PomodoroView() {
  const [mode, setMode] = useState<Mode>('focus')
  const [seconds, setSeconds] = useState(MODES.focus.minutes * 60)
  const [running, setRunning] = useState(false)
  const [focusCount, setFocusCount] = useState(() => Number(localStorage.getItem('nex_pomo_count') ?? 0))
  const [intention, setIntention] = useState(() => localStorage.getItem('nex_pomo_intention') ?? '')
  const rootRef = useRef<HTMLDivElement>(null)

  const totalSeconds = MODES[mode].minutes * 60
  const progress = 1 - seconds / totalSeconds
  const radius = 132
  const circumference = 2 * Math.PI * radius

  const nextMode = useMemo<Mode>(() => {
    if (mode !== 'focus') return 'focus'
    return (focusCount + 1) % 4 === 0 ? 'long' : 'short'
  }, [mode, focusCount])

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
    } catch { /* browser refused fullscreen */ }
  }

  return (
    <div ref={rootRef} style={{
      minHeight: '100%',
      height: '100%',
      background: 'radial-gradient(circle at 50% 30%, rgba(139,92,246,0.14), transparent 38%), #08080d',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.16em' }}>DEEP WORK TIMER</p>
          <h2 style={{ margin: '4px 0 0', color: 'white', fontSize: '18px', fontFamily: 'Space Grotesk' }}>{MODES[mode].label}</h2>
        </div>
        <button onClick={toggleFullscreen} title="Fullscreen timer" style={{ width: '36px', height: '36px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.74)', cursor: 'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M6.6 2.8H2.8v3.8M11.4 2.8h3.8v3.8M6.6 15.2H2.8v-3.8M11.4 15.2h3.8v-3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', padding: '30px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 460px) minmax(260px, 360px)', gap: '42px', alignItems: 'center', maxWidth: '980px', width: '100%' }}>
          <div style={{ position: 'relative', width: '340px', height: '340px', margin: '0 auto' }}>
            <svg width="340" height="340" viewBox="0 0 340 340" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="170" cy="170" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
              <circle cx="170" cy="170" r={radius} fill="none" stroke={MODES[mode].tone} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div>
                <p style={{ margin: 0, color: 'white', fontSize: '64px', fontFamily: 'Space Mono', fontWeight: 800 }}>{mmss(seconds)}</p>
                <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.14em' }}>
                  {running ? 'IN SESSION' : 'READY'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '18px' }}>
              {(Object.keys(MODES) as Mode[]).map(m => (
                <button key={m} onClick={() => chooseMode(m)}
                  style={{ padding: '10px 8px', borderRadius: '10px', border: `1px solid ${mode === m ? MODES[m].tone : 'rgba(255,255,255,0.1)'}`, background: mode === m ? `${MODES[m].tone}22` : 'rgba(255,255,255,0.035)', color: mode === m ? 'white' : 'rgba(255,255,255,0.62)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700 }}>
                  {MODES[m].label}
                </button>
              ))}
            </div>

            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.14em' }}>SESSION INTENTION</label>
            <textarea value={intention} onChange={e => { setIntention(e.target.value); localStorage.setItem('nex_pomo_intention', e.target.value) }}
              placeholder="One clear outcome for this session"
              style={{ marginTop: '8px', width: '100%', minHeight: '88px', resize: 'none', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.035)', color: 'white', outline: 'none', padding: '12px', fontSize: '13px', fontFamily: 'Space Grotesk', boxSizing: 'border-box' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '18px' }}>
              <button onClick={() => setRunning(r => !r)} style={{ height: '42px', borderRadius: '11px', border: 'none', background: MODES[mode].tone, color: '#05050a', fontSize: '12px', fontFamily: 'Space Mono', fontWeight: 900, cursor: 'pointer' }}>
                {running ? 'PAUSE' : 'START'}
              </button>
              <button onClick={reset} style={{ height: '42px', borderRadius: '11px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.76)', fontSize: '12px', fontFamily: 'Space Mono', fontWeight: 800, cursor: 'pointer' }}>
                RESET
              </button>
              <button onClick={() => chooseMode(nextMode)} style={{ height: '42px', borderRadius: '11px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.76)', fontSize: '12px', fontFamily: 'Space Mono', fontWeight: 800, cursor: 'pointer' }}>
                SKIP
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '18px' }}>
              <div style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ margin: 0, color: MODES.focus.tone, fontSize: '18px', fontFamily: 'Space Mono', fontWeight: 800 }}>{focusCount}</p>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.44)', fontSize: '10px', fontFamily: 'Space Mono' }}>FOCUS BLOCKS</p>
              </div>
              <button onClick={() => { if (!window.confirm('Clear today focus count?')) return; setFocusCount(0); localStorage.setItem('nex_pomo_count', '0') }} style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '12px', background: 'rgba(255,255,255,0.025)', color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontFamily: 'Space Mono', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
                CLEAR COUNT
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.32)', fontSize: '11px', fontFamily: 'Space Mono', display: 'flex', justifyContent: 'space-between' }}>
        <span>Next: {MODES[nextMode].label}</span>
        <span>Simple cycles. No feed. No clutter.</span>
      </div>
    </div>
  )
}
