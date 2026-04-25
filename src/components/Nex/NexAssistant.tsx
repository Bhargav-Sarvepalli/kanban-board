import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../supabase'
import NexGlobe from './NexGlobe'
import { askNex, buildGreeting } from '../../lib/nex'
import type { TaskContext, NexActionResult } from '../../lib/nex'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexAssistantProps {
  workspaceId: string | null
  userId: string | null
  isPro: boolean
  nexEnabled: boolean
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionEvent extends Event {
  results: { [i: number]: { [i: number]: { transcript: string }; isFinal: boolean } }
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const TOOLTIP_KEY = 'nex_tooltip_seen'

export default function NexAssistant({ workspaceId, userId, isPro, nexEnabled }: NexAssistantProps) {
  const [globeState, setGlobeState]     = useState<GlobeState>('idle')
  const [isActive, setIsActive]         = useState(false)
  const [speechText, setSpeechText]     = useState('')
  const [collapsed, setCollapsed]       = useState(false)
  const [showTooltip, setShowTooltip]   = useState(false)
  const [showDismiss, setShowDismiss]   = useState(false)
  const [taskCtx, setTaskCtx]           = useState<TaskContext>({
    tasks: [], workspaceName: '', userName: '', isPersonal: true,
  })

  const recognitionRef  = useRef<SpeechRecognition | null>(null)
  const globeStateRef   = useRef<GlobeState>('idle')
  const clearRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { globeStateRef.current = globeState }, [globeState])

  // Show tooltip once — after 2s on first load
  useEffect(() => {
    if (!nexEnabled) return
    const seen = localStorage.getItem(TOOLTIP_KEY)
    if (!seen) {
      tooltipTimerRef.current = setTimeout(() => setShowTooltip(true), 2000)
    }
    return () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current) }
  }, [nexEnabled])

  // Dismiss × timer handlers — driven by mouse events, no useEffect needed
  const handleMouseEnter = useCallback(() => {
    dismissTimerRef.current = setTimeout(() => setShowDismiss(true), 400)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    setShowDismiss(false)
  }, [])

  // Inject base styles
  useEffect(() => {
    if (document.getElementById('nex-assistant-styles')) return
    const s = document.createElement('style')
    s.id = 'nex-assistant-styles'
    s.textContent = `
      @keyframes nexFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes nexSlideIn {
        from { opacity: 0; transform: translateY(8px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `
    document.head.appendChild(s)
  }, [])

  const loadContext = useCallback(async () => {
    if (!userId) return undefined
    let q = supabase.from('tasks').select('id,title,status,priority,due_date,description')
    if (workspaceId) {
      q = q.eq('workspace_id', workspaceId)
    } else {
      q = q.is('workspace_id', null).eq('user_id', userId)
    }
    const [{ data: tasks }, { data: profile }] = await Promise.all([
      q,
      supabase.from('profiles').select('full_name').eq('id', userId).single(),
    ])
    let workspaceName = 'Personal'
    if (workspaceId) {
      const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
      workspaceName = ws?.name ?? 'Workspace'
    }
    const ctx: TaskContext = {
      tasks: tasks ?? [],
      workspaceName,
      userName: profile?.full_name?.split(' ')[0] ?? '',
      isPersonal: !workspaceId,
    }
    setTaskCtx(ctx)
    return ctx
  }, [workspaceId, userId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate async Supabase fetch; setState runs after await, not synchronously
  useEffect(() => { void loadContext() }, [loadContext])

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel()
    if (clearRef.current) clearTimeout(clearRef.current)
    const utter = new SpeechSynthesisUtterance(text)

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      // Deep, natural female voice — priority order
      const preferred =
        voices.find(v => v.name === 'Google UK English Female') ??
        voices.find(v => v.name === 'Samantha') ??     // macOS warm female
        voices.find(v => v.name === 'Karen') ??         // macOS Australian female
        voices.find(v => v.name === 'Moira') ??         // macOS Irish female
        voices.find(v => v.name === 'Serena') ??        // macOS UK female
        voices.find(v => v.name === 'Google US English') ??
        voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ??
        voices.find(v => v.lang.startsWith('en'))
      if (preferred) utter.voice = preferred
      utter.rate = 1.1      // confident pace — not slow, not rushed
      utter.pitch = 0.82    // lower = deeper, warmer, less robotic
      utter.volume = 1
      utter.onstart = () => { setGlobeState('speaking'); setSpeechText(text) }
      utter.onend   = () => {
        setGlobeState('idle')
        clearRef.current = setTimeout(() => setSpeechText(''), 2200)
        onDone?.()
      }
      window.speechSynthesis.speak(utter)
    }

    if (window.speechSynthesis.getVoices().length > 0) trySpeak()
    else window.speechSynthesis.onvoiceschanged = trySpeak
  }, [])

  const handleAction = useCallback((action: NexActionResult) => {
    if (action.type === 'create_task' || action.type === 'update_task_status') void loadContext()
  }, [loadContext])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { speak('Voice recognition is unavailable. Please use Chrome.'); return }
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      setGlobeState('thinking')
      setSpeechText('')
      void (async () => {
        if (!userId) { speak('Authentication required.'); return }
        try {
          const { speech, action } = await askNex(text, taskCtx, workspaceId, userId)
          if (action) handleAction(action)
          speak(speech)
        } catch (err) {
          console.error('[Nex]', err)
          speak('Systems encountered an error.')
          setGlobeState('idle')
        }
      })()
    }
    recognition.onerror = () => { setGlobeState('idle') }
    recognition.onend   = () => { if (globeStateRef.current === 'listening') setGlobeState('idle') }

    recognitionRef.current = recognition
    recognition.start()
    setGlobeState('listening')
    setSpeechText('')
  }, [taskCtx, workspaceId, userId, speak, handleAction])

  const handleGlobeClick = useCallback(() => {
    // Dismiss tooltip on first interaction
    if (showTooltip) { setShowTooltip(false); localStorage.setItem(TOOLTIP_KEY, '1') }
    if (collapsed) { setCollapsed(false); return }
    if (!isPro) { speak('Nex is available on the Pro plan.'); return }
    if (!userId) { speak('Authentication required.'); return }

    const cur = globeStateRef.current
    if (cur === 'listening') {
      recognitionRef.current?.stop(); window.speechSynthesis.cancel()
      setGlobeState('idle'); setSpeechText(''); return
    }
    if (cur === 'speaking') {
      window.speechSynthesis.cancel(); setGlobeState('idle'); setSpeechText(''); return
    }
    if (cur === 'thinking') return

    if (!isActive) {
      setIsActive(true)
      void loadContext().then(ctx => {
        if (!ctx) { startListening(); return }
        speak(buildGreeting(ctx), () => setTimeout(startListening, 300))
      })
      return
    }
    startListening()
  }, [showTooltip, collapsed, isPro, userId, isActive, speak, startListening, loadContext])

  // Global keyboard shortcut — Space activates Nex (when not typing)
  // Must be declared AFTER handleGlobeClick
  useEffect(() => {
    if (!nexEnabled) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        handleGlobeClick()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nexEnabled, handleGlobeClick])

  const dismissTooltip = () => { setShowTooltip(false); localStorage.setItem(TOOLTIP_KEY, '1') }

  if (!nexEnabled) return null

  // ── COLLAPSED STATE ──────────────────────────────────────────
  if (collapsed) {
    return (
      <div style={{
        position: 'fixed', bottom: '28px', left: '50%',
        transform: 'translateX(-50%)', zIndex: 9999,
        animation: 'nexFadeIn 0.3s ease',
      }}>
        <button
          onClick={() => setCollapsed(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '20px', padding: '5px 12px',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#8b5cf6',
            boxShadow: '0 0 6px rgba(139,92,246,0.8)',
            animation: 'nexGlowPulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '10px', letterSpacing: '0.2em',
            color: 'rgba(139,92,246,0.8)',
          }}>
            NEX
          </span>
        </button>
      </div>
    )
  }

  // ── FULL ORB STATE ───────────────────────────────────────────
  const isListening = globeState === 'listening'
  const isThinking  = globeState === 'thinking'
  const isSpeaking  = globeState === 'speaking'

  const statusLine =
    isSpeaking  ? speechText :
    isListening ? 'Listening…' :
    isThinking  ? 'Thinking…' :
    ''

  const accentColor = isThinking
    ? 'rgba(244,114,182,0.8)'
    : isListening
    ? 'rgba(103,232,249,0.85)'
    : 'rgba(192,132,252,0.7)'

  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%',
      transform: 'translateX(-50%)', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '8px',
      pointerEvents: 'none', userSelect: 'none',
    }}>

      {/* ── TOOLTIP — first visit only ── */}
      {showTooltip && (
        <div
          className="nex-tooltip"
          style={{
            background: 'rgba(15,5,35,0.95)',
            border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            pointerEvents: 'all',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#8b5cf6', boxShadow: '0 0 6px rgba(139,92,246,0.9)',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: '10px',
              letterSpacing: '0.2em', color: '#a78bfa', fontWeight: 500,
            }}>
              NEX · AI ASSISTANT
            </span>
          </div>
          <p style={{
            fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px',
            color: 'rgba(255,255,255,0.65)', margin: 0, textAlign: 'center', lineHeight: 1.5,
          }}>
            Click or press <span style={{
              fontFamily: 'Space Mono, monospace', fontSize: '10px',
              background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '4px', padding: '1px 5px', color: '#c084fc',
            }}>Space</span> to talk
          </p>
          <button
            onClick={dismissTooltip}
            style={{
              marginTop: '4px', background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)', fontSize: '10px',
              cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            got it
          </button>
        </div>
      )}

      {/* ── STATUS TEXT — above globe ── */}
      {statusLine && (
        <p
          key={statusLine.slice(0, 10)}
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '12px', fontWeight: 400,
            color: isSpeaking ? 'rgba(255,255,255,0.6)' : accentColor,
            margin: 0, maxWidth: '260px',
            textAlign: 'center', lineHeight: 1.5,
            animation: 'nexFadeIn 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          {statusLine}
        </p>
      )}

      {/* ── ALWAYS VISIBLE NEX LABEL ── */}
      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: '8px', letterSpacing: '0.32em',
        color: globeState !== 'idle' ? accentColor : 'rgba(139,92,246,0.35)',
        transition: 'color 0.4s ease',
        pointerEvents: 'none',
      }}>
        NEX
      </div>

      {/* ── GLOBE ── */}
      <div
        style={{ pointerEvents: 'all' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <NexGlobe
          state={globeState}
          onClick={handleGlobeClick}
          onDismiss={() => setCollapsed(true)}
          showDismiss={showDismiss && globeState === 'idle'}
        />
      </div>

      {/* ── KEYBOARD HINT — shown briefly after first activation ── */}
      {!isActive && !showTooltip && (
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '8px', letterSpacing: '0.16em',
          color: 'rgba(139,92,246,0.22)',
          pointerEvents: 'none',
        }}>
          SPACE
        </div>
      )}
    </div>
  )
}