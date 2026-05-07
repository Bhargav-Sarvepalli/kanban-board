import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Mode = 'focus' | 'short' | 'long'
type BeatPattern = 'pulse' | 'tick'
type DurationMap = Record<Mode, number>
type BrowserAudioContext = typeof AudioContext

const BASE_DURATIONS: DurationMap = { focus: 25, short: 5, long: 15 }

const MODES: Record<Mode, { label: string; tone: string; sub: string }> = {
  focus: { label: 'Focus', tone: '#8b5cf6', sub: 'Deep work' },
  short: { label: 'Break', tone: '#2dd4bf', sub: 'Short break' },
  long:  { label: 'Long', tone: '#60a5fa', sub: 'Long break' },
}

const BEAT_PATTERNS: Record<BeatPattern, { label: string; hint: string; bpm: number }> = {
  pulse: { label: 'Pulse', hint: 'Warm steady focus pulse', bpm: 60 },
  tick:  { label: 'Tick', hint: 'Clean second ticks', bpm: 60 },
}

const STORAGE = {
  durations: 'nex_pomo_durations',
  sound: 'nex_pomo_sound',
  beat: 'nex_pomo_beat',
  count: 'nex_pomo_count',
  intention: 'nex_pomo_intention',
  alert: 'nex_pomo_nex_alert',
  autoFlow: 'nex_pomo_auto_flow',
}

function mmss(seconds: number) {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return {
    minutes: String(m).padStart(2, '0'),
    seconds: String(s).padStart(2, '0'),
  }
}

function clampMinutes(value: number, fallback = 25) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(180, Math.max(1, Math.round(value)))
}

function readDurations(): DurationMap {
  try {
    const raw = localStorage.getItem(STORAGE.durations)
    if (!raw) return BASE_DURATIONS
    const parsed = JSON.parse(raw) as Partial<Record<Mode, number>>
    return {
      focus: clampMinutes(Number(parsed.focus), BASE_DURATIONS.focus),
      short: clampMinutes(Number(parsed.short), BASE_DURATIONS.short),
      long: clampMinutes(Number(parsed.long), BASE_DURATIONS.long),
    }
  } catch {
    return BASE_DURATIONS
  }
}

function readBeatPattern(): BeatPattern {
  try {
    const saved = localStorage.getItem(STORAGE.beat)
    return saved === 'tick' || saved === 'pulse' ? saved : 'pulse'
  } catch {
    return 'pulse'
  }
}

const presetsForMode = (mode: Mode) => {
  if (mode === 'focus') return [25, 45, 60]
  if (mode === 'short') return [5, 10, 15]
  return [15, 20, 30]
}

function timerVoiceAllowed() {
  try { return localStorage.getItem('nex_voice_enabled') !== 'false' }
  catch { return true }
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
      height: '44px',
      borderRadius: '16px',
      border: primary ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.14)',
      background: primary
        ? 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 55%, #5b21b6 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))',
      color: primary ? '#fff' : 'rgba(255,255,255,0.86)',
      cursor: 'pointer',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px',
      fontWeight: 800,
      boxShadow: primary
        ? '0 18px 40px rgba(124,58,237,0.38), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -10px 18px rgba(55,28,122,0.28)'
        : '0 12px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.1)',
    }}>
      {children}
    </button>
  )
}

export default function PomodoroView() {
  const [durations, setDurations] = useState<DurationMap>(readDurations)
  const [mode, setMode] = useState<Mode>('focus')
  const [seconds, setSeconds] = useState(() => readDurations().focus * 60)
  const [running, setRunning] = useState(false)
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(STORAGE.sound) === 'true' }
    catch { return false }
  })
  const [beatPattern, setBeatPattern] = useState<BeatPattern>(readBeatPattern)
  const [nexAlertOn, setNexAlertOn] = useState(() => {
    try { return localStorage.getItem(STORAGE.alert) !== 'false' }
    catch { return true }
  })
  const [autoFlow, setAutoFlow] = useState(() => {
    try { return localStorage.getItem(STORAGE.autoFlow) !== 'false' }
    catch { return true }
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [focusCount, setFocusCount] = useState(() => {
    try { return Number(localStorage.getItem(STORAGE.count) ?? 0) }
    catch { return 0 }
  })
  const [intention, setIntention] = useState(() => {
    try { return localStorage.getItem(STORAGE.intention) ?? '' }
    catch { return '' }
  })

  const rootRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const beatTimerRef = useRef<number | null>(null)
  const autoStartTimerRef = useRef<number | null>(null)
  const fiveMinuteAlertRef = useRef(false)

  const display = mmss(seconds)
  const totalSeconds = Math.max(1, durations[mode] * 60)
  const progress = Math.min(1, Math.max(0, 1 - seconds / totalSeconds))
  const beat = BEAT_PATTERNS[beatPattern]
  const beatInterval = Math.round(60000 / beat.bpm)
  const durationStep = mode === 'focus' ? 5 : 1
  const durationPresets = presetsForMode(mode)
  const segments = 96

  const segmentList = useMemo(() => Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2
    const inner = 168
    const outer = 190
    return {
      id: i,
      x1: 210 + Math.cos(angle) * inner,
      y1: 210 + Math.sin(angle) * inner,
      x2: 210 + Math.cos(angle) * outer,
      y2: 210 + Math.sin(angle) * outer,
      active: i / segments <= progress,
    }
  }), [progress])

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

  const clearAutoStart = useCallback(() => {
    if (autoStartTimerRef.current) {
      window.clearTimeout(autoStartTimerRef.current)
      autoStartTimerRef.current = null
    }
  }, [])

  const speakTimerAlert = useCallback((text: string) => {
    if (!nexAlertOn || !timerVoiceAllowed() || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    const speak = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v => v.name === 'Microsoft Jenny Online (Natural) - English (United States)') ??
        voices.find(v => v.name === 'Microsoft Aria Online (Natural) - English (United States)') ??
        voices.find(v => v.name.toLowerCase().includes('natural') && v.lang.startsWith('en')) ??
        voices.find(v => v.lang.startsWith('en'))
      if (preferred) utter.voice = preferred
      utter.rate = 1.02
      utter.pitch = 1
      utter.volume = 0.92
      window.speechSynthesis.speak(utter)
    }
    if (window.speechSynthesis.getVoices().length > 0) speak()
    else window.speechSynthesis.onvoiceschanged = speak
  }, [nexAlertOn])

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
      if (beatPattern === 'tick') {
        makeTone(1080, now, 0.24, 0.045, 'square')
        makeTone(240, now, 0.08, 0.08, 'sine')
      } else {
        makeTone(196, now, 0.18, 0.16, 'sine')
        makeTone(392, now + 0.018, 0.08, 0.12, 'triangle')
        makeTone(98, now, 0.055, 0.2, 'sine')
      }
      return
    }

    makeTone(kind === 'done' ? 740 : 440, now, 0.16, 0.28, 'triangle')
  }, [ensureAudio, soundOn, beatPattern])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => () => clearAutoStart(), [clearAutoStart])

  useEffect(() => {
    const applyPendingFocusDuration = (duration: number) => {
      const minutes = clampMinutes(duration, durations.focus)
      setDurations(prev => {
        const next = { ...prev, focus: minutes }
        try { localStorage.setItem(STORAGE.durations, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      })
      setMode('focus')
      setSeconds(minutes * 60)
      setRunning(false)
      fiveMinuteAlertRef.current = false
    }

    try {
      const pending = Number(localStorage.getItem('nex_pomo_pending_focus'))
      if (Number.isFinite(pending) && pending > 0) {
        localStorage.removeItem('nex_pomo_pending_focus')
        applyPendingFocusDuration(pending)
      }
    } catch { /* ignore */ }

    const onDuration = (event: Event) => {
      const detail = (event as CustomEvent<{ duration?: number }>).detail
      if (detail?.duration) applyPendingFocusDuration(detail.duration)
    }
    window.addEventListener('nex-pomodoro-duration', onDuration)
    return () => window.removeEventListener('nex-pomodoro-duration', onDuration)
  }, [durations.focus])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSeconds(prev => {
        const nextSeconds = prev - 1
        if (totalSeconds > 300 && nextSeconds === 300 && !fiveMinuteAlertRef.current) {
          fiveMinuteAlertRef.current = true
          playTone('start', true)
          speakTimerAlert(`${MODES[mode].label} has five minutes left. Keep it steady.`)
        }
        if (prev > 1) return nextSeconds
        clearAutoStart()
        setRunning(false)
        fiveMinuteAlertRef.current = false
        playTone('done')
        if (mode === 'focus') {
          setFocusCount(c => {
            const next = c + 1
            try { localStorage.setItem(STORAGE.count, String(next)) } catch { /* ignore */ }
            return next
          })
        }
        setMode(nextMode)
        if (autoFlow) {
          autoStartTimerRef.current = window.setTimeout(() => {
            playTone('start', true)
            if (nexAlertOn) {
              speakTimerAlert(nextMode === 'focus' ? 'Focus is back on.' : `${MODES[nextMode].label} started. Step away for a moment.`)
            }
            setRunning(true)
            autoStartTimerRef.current = null
          }, 900)
        }
        return durations[nextMode] * 60
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, mode, nextMode, playTone, speakTimerAlert, totalSeconds, durations, autoFlow, nexAlertOn, clearAutoStart])

  useEffect(() => {
    if (!running || !soundOn) {
      if (beatTimerRef.current) window.clearInterval(beatTimerRef.current)
      beatTimerRef.current = null
      return
    }

    playTone('beat')
    beatTimerRef.current = window.setInterval(() => playTone('beat'), beatInterval)
    return () => {
      if (beatTimerRef.current) window.clearInterval(beatTimerRef.current)
      beatTimerRef.current = null
    }
  }, [running, soundOn, playTone, beatInterval])

  const chooseMode = (next: Mode) => {
    clearAutoStart()
    setMode(next)
    setSeconds(durations[next] * 60)
    setRunning(false)
    fiveMinuteAlertRef.current = false
  }

  const updateDuration = (target: Mode, value: number) => {
    const nextMinutes = clampMinutes(value, durations[target])
    setDurations(prev => {
      const next = { ...prev, [target]: nextMinutes }
      try { localStorage.setItem(STORAGE.durations, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    if (target === mode) {
      const nextSeconds = nextMinutes * 60
      setSeconds(prev => running ? Math.min(prev, nextSeconds) : nextSeconds)
      fiveMinuteAlertRef.current = false
    }
  }

  const toggleRun = () => {
    clearAutoStart()
    if (!running) {
      if (soundOn) playTone('start')
      else void ensureAudio()?.resume()
      fiveMinuteAlertRef.current = false
    }
    setRunning(r => !r)
  }

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    try { localStorage.setItem(STORAGE.sound, String(next)) } catch { /* ignore */ }
    if (next) {
      ensureAudio()
      playTone('start', true)
    }
  }

  const setSoundMode = (value: BeatPattern | 'off') => {
    if (value === 'off') {
      setSoundOn(false)
      try { localStorage.setItem(STORAGE.sound, 'false') } catch { /* ignore */ }
      return
    }
    setBeatPattern(value)
    setSoundOn(true)
    try {
      localStorage.setItem(STORAGE.beat, value)
      localStorage.setItem(STORAGE.sound, 'true')
    } catch { /* ignore */ }
    ensureAudio()
    window.setTimeout(() => playTone('beat', true), 40)
  }

  const toggleNexAlert = () => {
    const next = !nexAlertOn
    setNexAlertOn(next)
    try { localStorage.setItem(STORAGE.alert, String(next)) } catch { /* ignore */ }
  }

  const toggleAutoFlow = () => {
    const next = !autoFlow
    setAutoFlow(next)
    try { localStorage.setItem(STORAGE.autoFlow, String(next)) } catch { /* ignore */ }
  }

  const reset = () => {
    clearAutoStart()
    setSeconds(durations[mode] * 60)
    setRunning(false)
    fiveMinuteAlertRef.current = false
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
      overflow: isFullscreen ? 'hidden' : 'auto',
      padding: isFullscreen ? 'clamp(24px, 4vh, 54px)' : 0,
      background: isFullscreen
        ? '#05060a'
        : 'radial-gradient(circle at 50% 18%, rgba(139,92,246,0.14), transparent 36%), #07080d',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <section style={{
        width: isFullscreen ? 'min(1040px, 100%)' : 'min(1040px, calc(100vw - 72px))',
        minHeight: isFullscreen ? '100%' : undefined,
        boxSizing: 'border-box',
        borderRadius: isFullscreen ? '0' : '36px',
        padding: isFullscreen ? 'clamp(22px, 4vw, 52px)' : '20px',
        display: isFullscreen ? 'flex' : undefined,
        flexDirection: isFullscreen ? 'column' : undefined,
        background: isFullscreen ? 'transparent' : 'linear-gradient(180deg, rgba(24,27,39,0.96), rgba(11,13,20,0.98))',
        border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.14)',
        boxShadow: isFullscreen ? 'none' : '0 38px 110px rgba(0,0,0,0.66), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: isFullscreen ? '0' : '12px', opacity: isFullscreen ? 0.74 : 1 }}>
          <div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.58)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.16em' }}>NEX FOCUS</p>
            <h2 style={{ margin: '4px 0 0', color: 'white', fontSize: '22px', fontWeight: 850, letterSpacing: 0 }}>{MODES[mode].label}</h2>
            {!isFullscreen && (
              <p style={{ margin: '5px 0 0', color: 'rgba(255,255,255,0.54)', fontSize: '12px', fontWeight: 720 }}>
                {focusCount} block{focusCount === 1 ? '' : 's'} · {soundOn ? `${beat.label} ${beat.bpm} BPM` : `Next ${MODES[nextMode].label}`}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {(Object.keys(MODES) as Mode[]).map(m => (
              <button key={m} onClick={() => chooseMode(m)}
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '999px',
                  border: `1px solid ${mode === m ? MODES[m].tone : 'rgba(255,255,255,0.14)'}`,
                  background: mode === m ? `${MODES[m].tone}24` : 'rgba(255,255,255,0.05)',
                  color: mode === m ? 'white' : 'rgba(255,255,255,0.68)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 800,
                  boxShadow: mode === m ? `0 10px 26px ${MODES[m].tone}22, inset 0 1px 0 rgba(255,255,255,0.14)` : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                }}>
                {MODES[m].sub}
              </button>
            ))}
            <button onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
              color: 'rgba(255,255,255,0.78)',
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

        <div style={{
          display: 'grid',
          gridTemplateColumns: isFullscreen ? '1fr' : 'minmax(430px, 1fr) 318px',
          gap: isFullscreen ? '30px' : '22px',
          alignItems: 'center',
          justifyItems: isFullscreen ? 'center' : undefined,
          flex: isFullscreen ? 1 : undefined,
        }}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <div style={{
              width: isFullscreen ? 'min(72vh, 640px)' : 'clamp(380px, min(46vh, 430px), 430px)',
              height: isFullscreen ? 'min(72vh, 640px)' : 'clamp(380px, min(46vh, 430px), 430px)',
              borderRadius: '50%',
              position: 'relative',
              display: 'grid',
              placeItems: 'center',
              background: isFullscreen
                ? `radial-gradient(circle at 50% 50%, ${MODES[mode].tone}10, rgba(255,255,255,0.015) 48%, transparent 72%)`
                : `radial-gradient(circle at 50% 50%, ${MODES[mode].tone}16, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.28) 72%)`,
              boxShadow: isFullscreen ? 'none' : '0 34px 82px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}>
              {soundOn && (
                <div style={{
                  position: 'absolute',
                  inset: isFullscreen ? '8%' : '34px',
                  borderRadius: '50%',
                  border: `1px solid ${MODES[mode].tone}44`,
                  boxShadow: `0 0 42px ${MODES[mode].tone}20`,
                }} />
              )}
              <svg width="100%" height="100%" viewBox="0 0 420 420" style={{ position: 'absolute', inset: 0 }}>
                <circle cx="210" cy="210" r="142" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="2" />
                {segmentList.map(seg => (
                  <line
                    key={seg.id}
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke={seg.active ? '#f8fbff' : 'rgba(255,255,255,0.15)'}
                    strokeWidth={seg.active ? 4 : 3}
                    strokeLinecap="round"
                    style={{
                      filter: seg.active ? `drop-shadow(0 0 7px ${MODES[mode].tone})` : 'none',
                      transition: 'stroke 0.25s linear, opacity 0.25s linear',
                    }}
                  />
                ))}
              </svg>
              <div style={{
                display: 'grid',
                gap: '8px',
                justifyItems: 'center',
                zIndex: 1,
              }}>
                <span style={{
                  color: '#f8fafc',
                  fontSize: isFullscreen ? 'clamp(82px, 12vw, 148px)' : '82px',
                  lineHeight: 0.95,
                  fontWeight: 760,
                  letterSpacing: 0,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: `0 0 34px ${MODES[mode].tone}44`,
                }}>
                  {display.minutes}:{display.seconds}
                </span>
                <span style={{ color: running ? '#f8fafc' : 'rgba(255,255,255,0.66)', fontSize: isFullscreen ? '18px' : '13px', fontWeight: 720 }}>
                  {running ? 'Focus' : 'Ready'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ width: isFullscreen ? 'min(560px, 100%)' : undefined, opacity: isFullscreen ? 0.82 : 1 }}>
            {!isFullscreen && <label style={{ color: 'rgba(255,255,255,0.56)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em' }}>INTENTION</label>}
            <textarea value={intention} onChange={e => { setIntention(e.target.value); try { localStorage.setItem(STORAGE.intention, e.target.value) } catch { /* ignore */ } }}
              placeholder="One outcome for this session"
              style={{ display: isFullscreen ? 'none' : 'block', marginTop: '7px', width: '100%', minHeight: '58px', resize: 'none', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(5,7,12,0.5)', color: 'white', outline: 'none', padding: '11px 12px', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif' }} />

            {!isFullscreen && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ color: 'rgba(255,255,255,0.56)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em' }}>SESSION LENGTH</label>
                <div style={{
                  marginTop: '7px',
                  padding: '10px',
                  borderRadius: '16px',
                  border: `1px solid ${MODES[mode].tone}55`,
                  background: `linear-gradient(135deg, ${MODES[mode].tone}18, rgba(255,255,255,0.035))`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 34px ${MODES[mode].tone}12`,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 38px', alignItems: 'center', gap: '9px' }}>
                    <button type="button" onClick={() => updateDuration(mode, durations[mode] - durationStep)} aria-label={`Decrease ${MODES[mode].label} duration`} style={{
                      height: '38px',
                      borderRadius: '13px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(0,0,0,0.22)',
                      color: 'rgba(255,255,255,0.86)',
                      cursor: 'pointer',
                      fontSize: '22px',
                      fontWeight: 800,
                    }}>-</button>
                    <label style={{ display: 'grid', justifyItems: 'center', gap: '2px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: 850, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{MODES[mode].label}</span>
                      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '7px' }}>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={durations[mode]}
                          onChange={e => updateDuration(mode, Number(e.target.value))}
                          onFocus={e => e.currentTarget.select()}
                          aria-label={`${MODES[mode].label} minutes`}
                          style={{
                            width: '66px',
                            border: 'none',
                            background: 'transparent',
                            color: 'white',
                            outline: 'none',
                            textAlign: 'center',
                            fontSize: '29px',
                            lineHeight: 1,
                            fontWeight: 900,
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        />
                        <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 800 }}>min</span>
                      </span>
                    </label>
                    <button type="button" onClick={() => updateDuration(mode, durations[mode] + durationStep)} aria-label={`Increase ${MODES[mode].label} duration`} style={{
                      height: '38px',
                      borderRadius: '13px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: 'rgba(0,0,0,0.22)',
                      color: 'rgba(255,255,255,0.86)',
                      cursor: 'pointer',
                      fontSize: '20px',
                      fontWeight: 800,
                    }}>+</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', marginTop: '8px' }}>
                    {durationPresets.map(value => (
                      <button key={value} type="button" onClick={() => updateDuration(mode, value)} style={{
                        height: '28px',
                        borderRadius: '999px',
                        border: durations[mode] === value ? `1px solid ${MODES[mode].tone}` : '1px solid rgba(255,255,255,0.12)',
                        background: durations[mode] === value ? `${MODES[mode].tone}22` : 'rgba(255,255,255,0.04)',
                        color: durations[mode] === value ? 'white' : 'rgba(255,255,255,0.68)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 820,
                      }}>{value} min</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!isFullscreen && (
              <div style={{ marginTop: '10px' }}>
                <label style={{ color: 'rgba(255,255,255,0.56)', fontSize: '11px', fontWeight: 850, letterSpacing: '0.14em' }}>FOCUS BEAT</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '7px' }}>
                  {(['off', 'pulse', 'tick'] as const).map(option => {
                    const active = option === 'off' ? !soundOn : soundOn && beatPattern === option
                    const label = option === 'off' ? 'Off' : BEAT_PATTERNS[option].label
                    const hint = option === 'off' ? 'Silent focus' : BEAT_PATTERNS[option].hint
                    return (
                      <button key={option} type="button" onClick={() => setSoundMode(option)} title={hint} style={{
                        minHeight: '44px',
                        borderRadius: '13px',
                        border: active ? `1px solid ${MODES[mode].tone}` : '1px solid rgba(255,255,255,0.13)',
                        background: active ? `${MODES[mode].tone}22` : 'rgba(255,255,255,0.04)',
                        color: active ? 'white' : 'rgba(255,255,255,0.62)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 850,
                      }}>{label}</button>
                    )
                  })}
                </div>
              </div>
            )}

            {!isFullscreen && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                {[
                  { label: 'Auto-flow', active: autoFlow, onClick: toggleAutoFlow, detail: autoFlow ? 'Breaks start after focus' : 'Pause between sessions' },
                  { label: 'Nex 5-min', active: nexAlertOn, onClick: toggleNexAlert, detail: nexAlertOn ? 'Voice warning near the end' : 'No voice warning' },
                ].map(item => (
                  <button key={item.label} type="button" onClick={item.onClick} style={{
                    minHeight: '42px',
                    borderRadius: '14px',
                    border: item.active ? `1px solid ${MODES[mode].tone}88` : '1px solid rgba(255,255,255,0.13)',
                    background: item.active ? `${MODES[mode].tone}18` : 'rgba(255,255,255,0.035)',
                    color: item.active ? 'white' : 'rgba(255,255,255,0.64)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 850 }}>{item.label}</span>
                    <span style={{ display: 'block', marginTop: '3px', color: 'rgba(255,255,255,0.48)', fontSize: '10px', lineHeight: 1.25 }}>{item.detail}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isFullscreen ? 'repeat(4, 1fr)' : '1.25fr 1fr 1fr', gap: '9px', marginTop: isFullscreen ? 0 : '10px' }}>
              <SoftButton onClick={toggleRun} primary>{running ? 'Pause' : 'Start flow'}</SoftButton>
              <SoftButton onClick={reset}>Reset</SoftButton>
              <SoftButton onClick={() => chooseMode(nextMode)}>Skip</SoftButton>
              {isFullscreen && <SoftButton onClick={toggleSound}>{soundOn ? 'Beats on' : 'Beats off'}</SoftButton>}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
