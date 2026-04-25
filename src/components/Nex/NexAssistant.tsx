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
  const [speechText, setSpeechText] = useState('')
  const [taskCtx, setTaskCtx] = useState<TaskContext>({
    tasks: [], workspaceName: '', userName: '', isPersonal: true,
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const globeStateRef = useRef<GlobeState>('idle')
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { globeStateRef.current = globeState }, [globeState])

  useEffect(() => {
    if (document.getElementById('nex-styles')) return
    const style = document.createElement('style')
    style.id = 'nex-styles'
    style.textContent = `
      @keyframes nexPulse {
        0%   { transform: scale(1);   opacity: 0.6; }
        100% { transform: scale(1.9); opacity: 0;   }
      }
      @keyframes nexFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0);   }
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
    if (clearRef.current) clearTimeout(clearRef.current)

    const utter = new SpeechSynthesisUtterance(text)

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      // Best available voices in priority order — smooth, natural
      const preferred =
        voices.find(v => v.name === 'Google UK English Male') ??
        voices.find(v => v.name === 'Daniel') ??
        voices.find(v => v.name === 'Arthur') ??
        voices.find(v => v.name === 'Google US English') ??
        voices.find(v => v.lang === 'en-GB') ??
        voices.find(v => v.lang.startsWith('en'))

      if (preferred) utter.voice = preferred
      utter.rate   = 0.92   // natural pace — not rushed, not slow
      utter.pitch  = 0.9    // slightly lower — warm, professional
      utter.volume = 1

      utter.onstart = () => {
        setGlobeState('speaking')
        setSpeechText(text)
      }
      utter.onend = () => {
        setGlobeState('idle')
        clearRef.current = setTimeout(() => setSpeechText(''), 2000)
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
      speak('Voice recognition is unavailable. Please use Chrome.')
      return
    }

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
          console.error('Nex error:', err)
          speak('Systems encountered an error.')
          setGlobeState('idle')
        }
      })()
    }

    recognition.onerror = () => {
      setGlobeState('idle')
    }
    recognition.onend = () => {
      if (globeStateRef.current === 'listening') setGlobeState('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
    setGlobeState('listening')
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
        speak(greeting, () => setTimeout(startListening, 300))
      })
      return
    }
    startListening()
  }, [isPro, userId, isActive, speak, startListening, loadContext])

  const isListening = globeState === 'listening'
  const isThinking  = globeState === 'thinking'
  const isSpeaking  = globeState === 'speaking'

  // Single line of text below orb — what's happening
  const statusLine =
    isSpeaking  ? speechText :
    isListening ? 'Listening…' :
    isThinking  ? 'Thinking…' :
    ''

  return (
    <div style={{
      position: 'fixed',
      bottom: '28px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      pointerEvents: 'none',
      userSelect: 'none',
    }}>

      {/* Globe — the only visual element */}
      <div style={{ pointerEvents: 'all' }}>
        <NexGlobe state={globeState} onClick={handleGlobeClick} />
      </div>

      {/* Single text line below — minimal, no box, no banner */}
      <div style={{
        minHeight: '18px',
        maxWidth: '260px',
        textAlign: 'center',
      }}>
        {statusLine && (
          <p
            key={statusLine.slice(0, 12)}
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '12px',
              fontWeight: 400,
              color: isThinking
                ? 'rgba(244,114,182,0.7)'
                : 'rgba(255,255,255,0.55)',
              margin: 0,
              lineHeight: 1.5,
              letterSpacing: '0.01em',
              animation: 'nexFadeIn 0.25s ease',
            }}
          >
            {statusLine}
          </p>
        )}
      </div>
    </div>
  )
}