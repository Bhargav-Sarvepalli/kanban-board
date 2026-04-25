import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../supabase'
import NexGlobe from './NexGlobe'
import { askNex } from '../../lib/nex'
import type { TaskContext, NexActionResult } from '../../lib/nex'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexAssistantProps {
  workspaceId: string | null  // null = personal board
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

  // Inject keyframes once
  useEffect(() => {
    if (document.getElementById('nex-styles')) return
    const style = document.createElement('style')
    style.id = 'nex-styles'
    style.textContent = `
      @keyframes nexPulse {
        0%   { transform: scale(1);    opacity: 0.5; }
        100% { transform: scale(1.6);  opacity: 0;   }
      }
      @keyframes nexFadeUp {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes nexScan {
        0%   { background-position: 0% 0%;   }
        100% { background-position: 0% 100%; }
      }
      @keyframes nexBlink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0; }
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
      // Personal board — tasks with no workspace owned by this user
      tasksQuery = tasksQuery.is('workspace_id', null).eq('user_id', userId)
    }

    const [{ data: tasks }, { data: profile }] = await Promise.all([
      tasksQuery,
      supabase.from('profiles').select('full_name').eq('id', userId).single(),
    ])

    let workspaceName = 'Personal Board'
    if (workspaceId) {
      const { data: ws } = await supabase
        .from('workspaces').select('name').eq('id', workspaceId).single()
      workspaceName = ws?.name ?? 'Workspace'
    }

    setTaskCtx({
      tasks: tasks ?? [],
      workspaceName,
      userName: profile?.full_name?.split(' ')[0] ?? 'there',
      isPersonal: !workspaceId,
    })
  }, [workspaceId, userId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadContext() }, [loadContext])

  const showText = useCallback((text: string, duration = 5000) => {
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current)
    setDisplayText(text)
    displayTimeoutRef.current = setTimeout(() => setDisplayText(''), duration)
  }, [])

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v => v.name.includes('Google UK English Male')) ??
        voices.find(v => v.name.includes('Daniel')) ??
        voices.find(v => v.name === 'Alex') ??
        voices.find(v => v.lang === 'en-GB') ??
        voices.find(v => v.lang.startsWith('en'))

      if (preferred) utter.voice = preferred
      utter.rate = 0.9
      utter.pitch = 0.85
      utter.volume = 1

      utter.onstart = () => {
        setGlobeState('speaking')
        showText(text, text.length * 60 + 1000)
      }
      utter.onend = () => {
        setGlobeState('idle')
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
      speak('Voice recognition unavailable. Use Chrome.')
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
      showText('...')

      void (async () => {
        if (!userId) { speak('Not authenticated.'); return }
        try {
          const { speech, action } = await askNex(text, taskCtx, workspaceId, userId)
          if (action) handleAction(action)
          speak(speech)
        } catch (err) {
          console.error('Nex error:', err)
          speak('An error occurred.')
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
    showText('Listening')
  }, [taskCtx, workspaceId, userId, speak, handleAction, showText])

  const handleGlobeClick = useCallback(() => {
    if (!isPro) {
      speak('Nex is a Pro feature.')
      return
    }
    if (!userId) {
      speak('Not authenticated.')
      return
    }
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
    if (!isActive) {
      setIsActive(true)
      void loadContext().then(() => {
        setTimeout(() => startListening(), 300)
      })
      return
    }
    startListening()
  }, [isPro, userId, isActive, speak, startListening, loadContext])

  const isListening = globeState === 'listening'
  const isThinking = globeState === 'thinking'
  const isSpeaking = globeState === 'speaking'

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0px',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>

      {/* HUD display — Jarvis style readout */}
      <div style={{
        marginBottom: '12px',
        minHeight: '48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        pointerEvents: 'none',
      }}>

        {/* Main text line */}
        {(displayText || isListening || isThinking) && (
          <div
            key={displayText + globeState}
            style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '12px',
              fontWeight: 400,
              letterSpacing: '0.12em',
              color: isListening
                ? 'rgba(79,230,255,0.95)'
                : isThinking
                ? 'rgba(130,180,255,0.85)'
                : 'rgba(180,220,255,0.9)',
              textShadow: isListening
                ? '0 0 12px rgba(79,230,255,0.8)'
                : '0 0 8px rgba(100,180,255,0.5)',
              animation: 'nexFadeUp 0.25s ease',
              maxWidth: '280px',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {isListening ? (
              <span>
                LISTENING
                <span style={{ animation: 'nexBlink 1s ease infinite', marginLeft: '2px' }}>_</span>
              </span>
            ) : isThinking ? (
              <span style={{ opacity: 0.7 }}>PROCESSING</span>
            ) : (
              displayText
            )}
          </div>
        )}

        {/* Transcript echo — dim, smaller */}
        {transcript && isThinking && (
          <div style={{
            fontFamily: 'Space Mono, monospace',
            fontSize: '10px',
            color: 'rgba(100,160,220,0.45)',
            letterSpacing: '0.08em',
            maxWidth: '220px',
            textAlign: 'center',
            fontStyle: 'italic',
            animation: 'nexFadeUp 0.2s ease',
          }}>
            "{transcript.length > 38 ? transcript.slice(0, 38) + '…' : transcript}"
          </div>
        )}

        {/* Scan line decoration when speaking */}
        {isSpeaking && (
          <div style={{
            width: '120px',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(79,195,247,0.6), transparent)',
            marginTop: '2px',
            animation: 'nexFadeUp 0.3s ease',
          }} />
        )}
      </div>

      {/* NEX label — always shown when active, minimal when idle */}
      {isActive && (
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.3em',
          color: isListening
            ? 'rgba(79,230,255,0.7)'
            : isSpeaking
            ? 'rgba(100,180,255,0.7)'
            : 'rgba(79,195,247,0.35)',
          marginBottom: '6px',
          transition: 'color 0.4s ease',
          textShadow: isListening ? '0 0 10px rgba(79,230,255,0.5)' : 'none',
        }}>
          NEX
        </div>
      )}

      {/* Globe */}
      <div style={{ pointerEvents: 'all' }}>
        <NexGlobe state={globeState} onClick={handleGlobeClick} />
      </div>

      {/* Bottom status bar — thin line with state */}
      {isActive && (
        <div style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'Space Mono, monospace',
          fontSize: '9px',
          letterSpacing: '0.2em',
          color: 'rgba(79,195,247,0.25)',
        }}>
          <div style={{
            width: '4px', height: '4px', borderRadius: '50%',
            background: isListening
              ? 'rgba(79,230,255,0.9)'
              : isSpeaking
              ? 'rgba(100,180,255,0.8)'
              : 'rgba(79,195,247,0.3)',
            boxShadow: isListening ? '0 0 6px rgba(79,230,255,0.8)' : 'none',
            transition: 'all 0.3s ease',
          }} />
          <span>
            {taskCtx.isPersonal ? 'PERSONAL' : taskCtx.workspaceName.toUpperCase().slice(0, 12)}
          </span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{taskCtx.tasks.length} TASKS</span>
        </div>
      )}
    </div>
  )
}