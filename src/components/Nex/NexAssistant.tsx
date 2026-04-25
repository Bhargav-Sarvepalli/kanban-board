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
  const [speechText, setSpeechText] = useState('')   // full text of what Nex is saying
  const [taskCtx, setTaskCtx] = useState<TaskContext>({
    tasks: [], workspaceName: '', userName: '', isPersonal: true,
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const globeStateRef = useRef<GlobeState>('idle')
  const speechClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { globeStateRef.current = globeState }, [globeState])

  useEffect(() => {
    if (document.getElementById('nex-styles')) return
    const style = document.createElement('style')
    style.id = 'nex-styles'
    style.textContent = `
      @keyframes nexPulse {
        0%   { transform: scale(1);   opacity: 0.55; }
        100% { transform: scale(1.8); opacity: 0;    }
      }
      @keyframes nexSlideUp {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      @keyframes nexBlink {
        0%, 100% { opacity: 1;   }
        50%       { opacity: 0.2; }
      }
    `
    document.head.appendChild(style)
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
      const { data: ws } = await supabase
        .from('workspaces').select('name').eq('id', workspaceId).single()
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadContext() }, [loadContext])

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel()
    if (speechClearRef.current) clearTimeout(speechClearRef.current)

    const utter = new SpeechSynthesisUtterance(text)

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      // Prefer a British male voice — sounds closest to Jarvis
      const preferred =
        voices.find(v => v.name === 'Google UK English Male') ??
        voices.find(v => v.name === 'Daniel') ??           // macOS British male
        voices.find(v => v.name === 'Arthur') ??           // macOS British male
        voices.find(v => v.name === 'Google US English') ??
        voices.find(v => v.lang === 'en-GB') ??
        voices.find(v => v.lang.startsWith('en'))

      if (preferred) utter.voice = preferred
      utter.rate  = 0.9
      utter.pitch = 0.8    // lower = more Jarvis-like
      utter.volume = 1

      utter.onstart = () => {
        setGlobeState('speaking')
        setSpeechText(text)
      }
      utter.onend = () => {
        setGlobeState('idle')
        // Keep text visible for 1.5s after speaking ends
        speechClearRef.current = setTimeout(() => setSpeechText(''), 1500)
        onDone?.()
      }
      window.speechSynthesis.speak(utter)
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak()
    } else {
      window.speechSynthesis.onvoiceschanged = trySpeak
    }
  }, [])

  const handleAction = useCallback((action: NexActionResult) => {
    if (action.type === 'create_task' || action.type === 'update_task_status') {
      void loadContext()
    }
  }, [loadContext])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      speak('Voice recognition is unavailable. Switch to Chrome.')
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
    }
    recognition.onend = () => {
      if (globeStateRef.current === 'listening') setGlobeState('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
    setGlobeState('listening')
    setTranscript('')
    setSpeechText('')
  }, [taskCtx, workspaceId, userId, speak, handleAction])

  const handleGlobeClick = useCallback(() => {
    if (!isPro) { speak('Nex is available on the Pro plan.'); return }
    if (!userId) { speak('Authentication required.'); return }

    const cur = globeStateRef.current
    if (cur === 'listening') {
      recognitionRef.current?.stop()
      window.speechSynthesis.cancel()
      setGlobeState('idle')
      setSpeechText('')
      setTranscript('')
      return
    }
    if (cur === 'speaking') {
      window.speechSynthesis.cancel()
      setGlobeState('idle')
      setSpeechText('')
      return
    }
    if (cur === 'thinking') return

    if (!isActive) {
      setIsActive(true)
      void loadContext().then(ctx => {
        if (!ctx) { startListening(); return }
        const greeting = buildGreeting(ctx)
        speak(greeting, () => setTimeout(startListening, 280))
      })
      return
    }
    startListening()
  }, [isPro, userId, isActive, speak, startListening, loadContext])

  const isListening = globeState === 'listening'
  const isThinking  = globeState === 'thinking'
  const isSpeaking  = globeState === 'speaking'
  const isEngaged   = isListening || isThinking || isSpeaking

  // Matches app purple/pink palette
  const accentColor = isThinking
    ? 'rgba(244,114,182,0.9)'   // pink while thinking
    : 'rgba(192,132,252,0.9)'  // purple otherwise

  const accentGlow = isThinking
    ? '0 0 12px rgba(244,114,182,0.6)'
    : '0 0 10px rgba(192,132,252,0.5)'

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
      pointerEvents: 'none',
      userSelect: 'none',
      gap: '0',
    }}>

      {/* ── SPEECH TEXT — full sentence, no truncation ── */}
      {(speechText || isListening || isThinking) && (
        <div
          key={`${globeState}-${speechText.slice(0, 10)}`}
          style={{
            marginBottom: '10px',
            maxWidth: '320px',
            textAlign: 'center',
            animation: 'nexSlideUp 0.2s ease',
          }}
        >
          {/* State chip */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: 'rgba(139,92,246,0.12)',
            border: `1px solid ${isThinking ? 'rgba(244,114,182,0.25)' : 'rgba(139,92,246,0.25)'}`,
            borderRadius: '20px',
            padding: '3px 10px 3px 7px',
            marginBottom: speechText ? '6px' : '0',
          }}>
            <div style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: accentColor,
              boxShadow: accentGlow,
              animation: isListening ? 'nexBlink 0.85s ease infinite' : 'none',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '9px',
              letterSpacing: '0.22em',
              color: accentColor,
              textShadow: accentGlow,
            }}>
              {isListening ? 'LISTENING' : isThinking ? 'THINKING' : 'NEX'}
            </span>
          </div>

          {/* Full speech text — no truncation */}
          {speechText && isSpeaking && (
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '13px',
              fontWeight: 400,
              color: 'rgba(255,255,255,0.82)',
              lineHeight: 1.55,
              letterSpacing: '0.01em',
              padding: '8px 14px',
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '12px',
              backdropFilter: 'blur(12px)',
            }}>
              {speechText}
            </div>
          )}

          {/* Transcript echo — dim, while thinking */}
          {transcript && isThinking && (
            <div style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: '10px',
              color: 'rgba(244,114,182,0.5)',
              fontStyle: 'italic',
              letterSpacing: '0.06em',
              marginTop: '4px',
            }}>
              "{transcript.length > 44 ? transcript.slice(0, 44) + '…' : transcript}"
            </div>
          )}
        </div>
      )}

      {/* ── NEX LABEL — subtle, only when active ── */}
      {isActive && !isEngaged && (
        <div style={{
          fontFamily: 'Space Mono, monospace',
          fontSize: '8px',
          letterSpacing: '0.35em',
          color: 'rgba(139,92,246,0.35)',
          marginBottom: '4px',
        }}>
          NEX
        </div>
      )}

      {/* ── GLOBE ── */}
      <div style={{ pointerEvents: 'all' }}>
        <NexGlobe state={globeState} onClick={handleGlobeClick} />
      </div>

      {/* ── STATUS BAR — board + task count ── */}
      {isActive && (
        <div style={{
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'Space Mono, monospace',
          fontSize: '8px',
          letterSpacing: '0.2em',
          color: isEngaged ? 'rgba(192,132,252,0.55)' : 'rgba(139,92,246,0.25)',
          transition: 'color 0.4s ease',
        }}>
          <div style={{
            width: '4px', height: '4px', borderRadius: '50%',
            background: isListening
              ? 'rgba(192,132,252,1)'
              : isSpeaking ? 'rgba(192,132,252,0.8)'
              : isThinking ? 'rgba(244,114,182,0.9)'
              : 'rgba(139,92,246,0.25)',
            boxShadow: isEngaged
              ? isThinking
                ? '0 0 6px rgba(244,114,182,0.8)'
                : '0 0 6px rgba(192,132,252,0.8)'
              : 'none',
            transition: 'all 0.3s ease',
          }} />
          <span>{taskCtx.isPersonal ? 'PERSONAL' : taskCtx.workspaceName.toUpperCase().slice(0, 14)}</span>
          <span style={{ opacity: 0.3 }}>·</span>
          <span>{taskCtx.tasks.length} TASKS</span>
        </div>
      )}
    </div>
  )
}