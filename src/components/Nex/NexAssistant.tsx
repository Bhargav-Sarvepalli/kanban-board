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
  results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean } }
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export default function NexAssistant({ workspaceId, userId, isPro }: NexAssistantProps) {
  const [globeState, setGlobeState] = useState<GlobeState>('idle')
  const [isActive, setIsActive] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [displayText, setDisplayText] = useState('')
  const [taskCtx, setTaskCtx] = useState<TaskContext>({
    tasks: [], workspaceName: '', userName: '', isPersonal: true,
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const globeStateRef = useRef<GlobeState>('idle')
  const displayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { globeStateRef.current = globeState }, [globeState])

  useEffect(() => {
    if (document.getElementById('nex-styles')) return
    const style = document.createElement('style')
    style.id = 'nex-styles'
    style.textContent = `
      @keyframes nexPulse {
        0%   { transform: scale(1);   opacity: 0.6; }
        100% { transform: scale(1.7); opacity: 0;   }
      }
      @keyframes nexFadeUp {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      @keyframes nexBlink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.2; }
      }
      @keyframes nexScanline {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(300%);  }
      }
    `
    document.head.appendChild(style)
  }, [])

  const loadContext = useCallback(async () => {
    if (!userId) return

    let tasksQuery = supabase
      .from('tasks')
      .select('id,title,status,priority,due_date,description')

    if (workspaceId) {
      tasksQuery = tasksQuery.eq('workspace_id', workspaceId)
    } else {
      tasksQuery = tasksQuery.is('workspace_id', null).eq('user_id', userId)
    }

    const [{ data: tasks }, { data: profile }] = await Promise.all([
      tasksQuery,
      supabase.from('profiles').select('full_name').eq('id', userId).single(),
    ])

    let workspaceName = 'Personal'
    if (workspaceId) {
      const { data: ws } = await supabase
        .from('workspaces').select('name').eq('id', workspaceId).single()
      workspaceName = ws?.name ?? 'Workspace'
    }

    const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

    setTaskCtx({
      tasks: tasks ?? [],
      workspaceName,
      userName: firstName,
      isPersonal: !workspaceId,
    })

    return { tasks: tasks ?? [], workspaceName, userName: firstName, isPersonal: !workspaceId }
  }, [workspaceId, userId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadContext() }, [loadContext])

  const showText = useCallback((text: string, duration = 6000) => {
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current)
    setDisplayText(text)
    if (duration > 0) {
      displayTimeoutRef.current = setTimeout(() => setDisplayText(''), duration)
    }
  }, [])

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v => v.name.includes('Google UK English Male')) ??
        voices.find(v => v.name === 'Daniel') ??
        voices.find(v => v.name === 'Alex') ??
        voices.find(v => v.lang === 'en-GB') ??
        voices.find(v => v.lang.startsWith('en'))

      if (preferred) utter.voice = preferred
      utter.rate = 0.88
      utter.pitch = 0.82
      utter.volume = 1

      utter.onstart = () => {
        setGlobeState('speaking')
        showText(text, 0) // hold until speech ends
      }
      utter.onend = () => {
        setGlobeState('idle')
        setDisplayText('')
        onDone?.()
      }
      window.speechSynthesis.speak(utter)
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak()
    } else {
      window.speechSynthesis.onvoiceschanged = trySpeak
    }
  }, [showText])

  const handleAction = useCallback((action: NexActionResult) => {
    if (action.type === 'create_task' || action.type === 'update_task_status') {
      void loadContext()
    }
  }, [loadContext])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      speak('Voice recognition unavailable. Switch to Chrome.')
      return
    }

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      setTranscript(text)
      setGlobeState('thinking')
      showText('', 0)

      void (async () => {
        if (!userId) { speak('Authentication required.'); return }
        try {
          const { speech, action } = await askNex(text, taskCtx, workspaceId, userId)
          if (action) handleAction(action)
          speak(speech)
        } catch (err) {
          console.error('Nex error:', err)
          speak('Systems encountered an error.')
          setGlobeState('idle')
        }
      })()
    }

    recognition.onerror = () => {
      setGlobeState('idle')
      setTranscript('')
      setDisplayText('')
    }

    recognition.onend = () => {
      if (globeStateRef.current === 'listening') setGlobeState('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
    setGlobeState('listening')
    setTranscript('')
    showText('', 0)
  }, [taskCtx, workspaceId, userId, speak, handleAction, showText])

  const handleGlobeClick = useCallback(() => {
    if (!isPro) {
      speak('Nex is available on the Pro plan.')
      return
    }
    if (!userId) {
      speak('Authentication required.')
      return
    }

    // Stop if already active
    if (globeStateRef.current === 'listening') {
      recognitionRef.current?.stop()
      window.speechSynthesis.cancel()
      setGlobeState('idle')
      setDisplayText('')
      setTranscript('')
      return
    }
    if (globeStateRef.current === 'speaking') {
      window.speechSynthesis.cancel()
      setGlobeState('idle')
      setDisplayText('')
      return
    }
    if (globeStateRef.current === 'thinking') return

    if (!isActive) {
      // First activation — load context, deliver Jarvis greeting, then listen
      setIsActive(true)
      void loadContext().then((ctx) => {
        if (!ctx) { startListening(); return }
        const greeting = buildGreeting(ctx)
        // Speak greeting, then immediately go to listening
        speak(greeting, () => {
          setTimeout(() => startListening(), 300)
        })
      })
      return
    }

    startListening()
  }, [isPro, userId, isActive, speak, startListening, loadContext])

  const isListening = globeState === 'listening'
  const isThinking = globeState === 'thinking'
  const isSpeaking = globeState === 'speaking'
  const isEngaged = isListening || isThinking || isSpeaking

  const hudColor = isThinking
    ? 'rgba(180,160,255,0.9)'
    : isListening
    ? 'rgba(0,255,230,0.95)'
    : 'rgba(0,229,255,0.88)'

  const hudGlow = isThinking
    ? '0 0 14px rgba(123,47,255,0.7)'
    : isListening
    ? '0 0 14px rgba(0,255,230,0.8)'
    : '0 0 8px rgba(0,229,255,0.4)'

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>

      {/* ── HUD READOUT ───────────────────────────────── */}
      <div style={{
        marginBottom: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        minHeight: '52px',
        justifyContent: 'flex-end',
      }}>

        {/* State label */}
        {isEngaged && (
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '9px',
            letterSpacing: '0.3em',
            color: hudColor,
            textShadow: hudGlow,
            animation: 'nexFadeUp 0.2s ease',
          }}>
            {isListening ? (
              <span>
                LISTENING
                <span style={{ animation: 'nexBlink 0.9s ease infinite', marginLeft: '2px' }}>_</span>
              </span>
            ) : isThinking ? 'PROCESSING' : 'NEX'}
          </div>
        )}

        {/* Main display text — spoken words or status */}
        {(displayText && isSpeaking) && (
          <div
            key={displayText.slice(0, 20)}
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: hudColor,
              textShadow: hudGlow,
              animation: 'nexFadeUp 0.25s ease',
              maxWidth: '300px',
              textAlign: 'center',
              lineHeight: 1.6,
              position: 'relative',
              padding: '0 4px',
            }}
          >
            {/* Scanline effect */}
            <span style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(0,229,255,0.08) 50%, transparent 100%)',
              animation: 'nexScanline 2.5s ease infinite',
              pointerEvents: 'none',
            }} />
            {displayText.length > 80 ? displayText.slice(0, 80) + '…' : displayText}
          </div>
        )}

        {/* Transcript echo while thinking */}
        {transcript && isThinking && (
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '10px',
            color: 'rgba(160,140,255,0.5)',
            letterSpacing: '0.08em',
            fontStyle: 'italic',
            animation: 'nexFadeUp 0.2s ease',
            maxWidth: '240px',
            textAlign: 'center',
          }}>
            "{transcript.length > 42 ? transcript.slice(0, 42) + '…' : transcript}"
          </div>
        )}
      </div>

      {/* ── NEX LABEL ─────────────────────────────────── */}
      {isActive && (
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '8px',
          letterSpacing: '0.38em',
          color: isEngaged ? hudColor : 'rgba(0,229,255,0.28)',
          textShadow: isEngaged ? hudGlow : 'none',
          marginBottom: '4px',
          transition: 'all 0.5s ease',
        }}>
          NEX
        </div>
      )}

      {/* ── GLOBE ─────────────────────────────────────── */}
      <div style={{ pointerEvents: 'all' }}>
        <NexGlobe state={globeState} onClick={handleGlobeClick} />
      </div>

      {/* ── STATUS BAR ────────────────────────────────── */}
      {isActive && (
        <div style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'Space Mono, monospace',
          fontSize: '8px',
          letterSpacing: '0.22em',
          color: isEngaged ? 'rgba(0,229,255,0.45)' : 'rgba(0,229,255,0.2)',
          transition: 'color 0.4s ease',
        }}>
          {/* Status dot */}
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: isListening
              ? 'rgba(0,255,230,1)'
              : isSpeaking
              ? 'rgba(0,229,255,0.9)'
              : isThinking
              ? 'rgba(160,140,255,0.9)'
              : 'rgba(0,229,255,0.25)',
            boxShadow: isEngaged
              ? isThinking
                ? '0 0 8px rgba(160,140,255,0.9)'
                : '0 0 8px rgba(0,229,255,0.9)'
              : 'none',
            transition: 'all 0.3s ease',
          }} />
          <span>
            {taskCtx.isPersonal ? 'PERSONAL' : taskCtx.workspaceName.toUpperCase().slice(0, 14)}
          </span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>{taskCtx.tasks.length} TASKS</span>
        </div>
      )}
    </div>
  )
}