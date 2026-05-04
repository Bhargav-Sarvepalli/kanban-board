import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'focus' | 'short' | 'long'
type BrowserAudioContext = typeof AudioContext

const MODES: Record<Mode, { label: string; minutes: number; tone: string; sub: string }> = {
  focus: { label: 'Focus', minutes: 25, tone: '#8b5cf6', sub: 'Deep work' },
  short: { label: 'Break', minutes: 5, tone: '#2dd4bf', sub: 'Reset' },
  long:  { label: 'Long', minutes: 15, tone: '#60a5fa', sub: 'Recover' },
}

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return {
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  }
}

function SoftButton({
  children, onClick, primary = false,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button onClick={onClick} style={{
      height: '48px',
      borderRadius: '16px',
      border: primary ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.09)',
      background: primary
        ? 'linear-gradient(180deg, #9f7aea 0%, #7c3aed 55%, #5b21b6 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025))',
      color: primary ? '#fff' : 'rgba(255,255,255,0.78)',
      cursor: 'pointer',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px',
      fontWeight: 800,
      boxShadow: primary
        ? '0 18px 40px rgba(124,58,237,0.36), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -10px 18px rgba(55,28,122,0.28)'
        : '0 12px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
    }}>
      {children}
    </button>
  )
}

function FlipTile({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'grid', gap: '10px', justifyItems: 'center' }}>
      <div style={{
        width: '138px',
        height: '124px',
        borderRadius: '24px',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #fbfdff 0%, #eef3f9 49.5%, #d7e0ec 50%, #fbfdff 100%)',
        boxShadow: '0 24px 52px rgba(0,0,0,0.48), inset 0 2px 0 rgba(255,255,255,0.95), inset 0 -18px 34px rgba(148,163,184,0.22)',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(15,23,42,0.16)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '46%', background: 'linear-gradient(180deg, rgba(255,255,255,0.72), transparent)' }} />
        <span style={{ color: '#0f172a', fontSize: '68px', lineHeight: 1, fontWeight: 900, letterSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '10px', fontWeight: 850, letterSpacing: '0.18em' }}>{label}</span>
    </div>
  )
}

export default function PomodoroView() {
  const [mode, setMode] = useState<Mode>('focus')
  const [seconds, setSeconds] = useState(MODES.focus.minutes * 60)
  const [running, setRunning] = useState(false)
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('nex_pomo_sound') === 'true')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [focusCount, setFocusCount] = useState(() => Number(localStorage.getItem('nex_pomo_count') ?? 0))
  const [intention, setIntention] = useState(() => localStorage.getItem('nex_pomo_intention') ?? '')
  const rootRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const beatTimerRef = useRef<number | null>(null)

  const display = mmss(seconds)
  const totalSeconds = MODES[mode].minutes * 60
  const progress = 1 - seconds / totalSeconds
  const radius = 150
  const circumference = 2 * Math.PI * radius

  const nextMode = useMemo<Mode>(() => {
    if (mode !== 'focus') return 'focus'
    return (focusCount + 1) % 4 === 0 ? 'long' : 'short'
  }, [mode, focusCount])

  const ensureAudio = useCallback(() => {
    const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext
    if (!AudioCtor) return null
    if (!audioRef.current) audioRef.current = new AudioCtor()
    if (audioRef.current.state === 'suspended') void audioRef.current.resume()
    return audioRef.current
  }, [])

  const playTone = useCallback((kind: 'beat' | 'start' | 'done', force = false) => {
    if (!soundOn && !force) return
    const ctx = ensureAudio()
    if (!ctx) return
    const now = ctx.currentTime
    const makeTone = (frequency: number, start: number, volume: number, duration: number, type: OscillatorType) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration + 0.02)
    }

    if (kind === 'beat') {
      makeTone(1120, now, 0.18, 0.045, 'square')
      makeTone(220, now, 0.055, 0.09, 'sine')
      return
    }

    makeTone(kind === 'done' ? 740 : 440, now, 0.16, 0.28, 'triangle')
  }, [ensureAudio, soundOn])

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
        playTone('done')
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
  }, [running, mode, nextMode, playTone])

  useEffect(() => {
    if (!running || !soundOn) {
      if (beatTimerRef.current) window.clearInterval(beatTimerRef.current)
      beatTimerRef.current = null
      return
    }

    playTone('beat')
    beatTimerRef.current = window.setInterval(() => playTone('beat'), 1000)
    return () => {
      if (beatTimerRef.current) window.clearInterval(beatTimerRef.current)
      beatTimerRef.current = null
    }
  }, [running, soundOn, playTone])

  const chooseMode = (next: Mode) => {
    setMode(next)
    setSeconds(MODES[next].minutes * 60)
    setRunning(false)
  }

  const toggleRun = () => {
    if (!running) {
      if (soundOn) playTone('start')
      else void ensureAudio()?.resume()
    }
    setRunning(r => !r)
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('nex_pomo_sound', String(next))
    if (next) {
      ensureAudio()
      playTone('start', true)
    }
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
      display: 'grid',
      placeItems: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: isFullscreen ? 'clamp(24px, 4vh, 54px)' : 0,
      background: 'radial-gradient(circle at 50% 18%, rgba(139,92,246,0.16), transparent 36%), radial-gradient(circle at 30% 80%, rgba(45,212,191,0.08), transparent 32%), #07080d',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <section style={{
        width: isFullscreen ? 'min(1280px, 100%)' : 'min(980px, calc(100vw - 72px))',
        minHeight: isFullscreen ? '100%' : undefined,
        boxSizing: 'border-box',
        borderRadius: isFullscreen ? '42px' : '36px',
        padding: isFullscreen ? 'clamp(30px, 4vw, 56px)' : '26px',
        display: isFullscreen ? 'flex' : undefined,
        flexDirection: isFullscreen ? 'column' : undefined,
        background: 'linear-gradient(180deg, rgba(34,37,50,0.97), rgba(14,16,25,0.99))',
        border: '1px solid rgba(255,255,255,0.11)',
        boxShadow: '0 38px 110px rgba(0,0,0,0.66), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.16em' }}>NEX FOCUS</p>
            <h2 style={{ margin: '4px 0 0', color: 'white', fontSize: '22px', fontWeight: 850, letterSpacing: 0 }}>{MODES[mode].label}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {(Object.keys(MODES) as Mode[]).map(m => (
              <button key={m} onClick={() => chooseMode(m)}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '999px',
                  border: `1px solid ${mode === m ? MODES[m].tone : 'rgba(255,255,255,0.1)'}`,
                  background: mode === m ? `${MODES[m].tone}24` : 'rgba(255,255,255,0.035)',
                  color: mode === m ? 'white' : 'rgba(255,255,255,0.58)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 800,
                  boxShadow: mode === m ? `0 10px 26px ${MODES[m].tone}22, inset 0 1px 0 rgba(255,255,255,0.12)` : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                }}>
                {MODES[m].sub}
              </button>
            ))}
            <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))',
              color: 'rgba(255,255,255,0.7)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}>
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                {isFullscreen ? (
                  <path d="M6.6 2.8v3.8H2.8M11.4 15.2v-3.8h3.8M11.4 2.8v3.8h3.8M6.6 15.2v-3.8H2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <path d="M6.6 2.8H2.8v3.8M11.4 2.8h3.8v3.8M6.6 15.2H2.8v-3.8M11.4 15.2h3.8v-3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isFullscreen ? 'minmax(560px, 1fr) 340px' : 'minmax(420px, 1fr) 286px', gap: isFullscreen ? '54px' : '32px', alignItems: 'center', flex: isFullscreen ? 1 : undefined }}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <div style={{
              width: isFullscreen ? 'min(58vh, 560px)' : '430px',
              height: isFullscreen ? 'min(58vh, 560px)' : '430px',
              borderRadius: '50%',
              position: 'relative',
              display: 'grid',
              placeItems: 'center',
              background: `radial-gradient(circle at 50% 38%, ${MODES[mode].tone}18, rgba(255,255,255,0.026) 44%, rgba(0,0,0,0.34) 72%)`,
              boxShadow: '0 34px 82px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -28px 68px rgba(0,0,0,0.36)',
            }}>
              {soundOn && (
                <div style={{
                  position: 'absolute',
                  inset: '34px',
                  borderRadius: '50%',
                  border: `1px solid ${MODES[mode].tone}55`,
                  boxShadow: `0 0 36px ${MODES[mode].tone}22`,
                }} />
              )}
              <svg width="100%" height="100%" viewBox="0 0 430 430" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="215" cy="215" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="18" />
                <circle cx="215" cy="215" r={radius} fill="none" stroke={MODES[mode].tone} strokeWidth="18" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
                  style={{ filter: `drop-shadow(0 0 18px ${MODES[mode].tone}70)`, transition: 'stroke-dashoffset 0.35s linear' }} />
              </svg>
              <div style={{
                display: 'flex',
                gap: '18px',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FlipTile value={display.minutes} label="MIN" />
                <span style={{ color: MODES[mode].tone, fontSize: '52px', lineHeight: 1, fontWeight: 900, transform: 'translateY(-10px)' }}>:</span>
                <FlipTile value={display.seconds} label="SEC" />
              </div>
              <p style={{ position: 'absolute', bottom: '56px', margin: 0, color: running ? MODES[mode].tone : 'rgba(255,255,255,0.44)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.16em' }}>
                {running ? 'IN FLOW' : 'READY'}
              </p>
            </div>
          </div>

          <div>
            <label style={{ color: 'rgba(255,255,255,0.48)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em' }}>INTENTION</label>
            <textarea value={intention} onChange={e => { setIntention(e.target.value); localStorage.setItem('nex_pomo_intention', e.target.value) }}
              placeholder="One outcome for this session"
              style={{ marginTop: '8px', width: '100%', minHeight: '78px', resize: 'none', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(5,7,12,0.45)', color: 'white', outline: 'none', padding: '12px', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              <SoftButton onClick={toggleRun} primary>{running ? 'Pause' : 'Start flow'}</SoftButton>
              <SoftButton onClick={reset}>Reset</SoftButton>
              <SoftButton onClick={() => chooseMode(nextMode)}>Skip</SoftButton>
              <SoftButton onClick={toggleSound}>{soundOn ? 'Beats on' : 'Beats off'}</SoftButton>
            </div>

            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ margin: 0, color: MODES[mode].tone, fontSize: '22px', fontWeight: 900, letterSpacing: 0 }}>{focusCount}</p>
                <span style={{ color: 'rgba(255,255,255,0.46)', fontSize: '10px', fontWeight: 850, letterSpacing: '0.12em' }}>BLOCKS</span>
              </div>
              <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ margin: 0, color: soundOn ? MODES[mode].tone : 'rgba(255,255,255,0.82)', fontSize: '14px', fontWeight: 850 }}>{soundOn ? '60 BPM' : MODES[nextMode].label}</p>
                <span style={{ color: 'rgba(255,255,255,0.46)', fontSize: '10px', fontWeight: 850, letterSpacing: '0.12em' }}>{soundOn ? 'FOCUS BEAT' : 'NEXT'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
