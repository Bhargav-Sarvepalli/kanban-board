import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../supabase'
import NexGlobe from './NexGlobe'
import { askNex } from '../../lib/nex'
import type { TaskContext, NexActionResult } from '../../lib/nex'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexAssistantProps {
  workspaceId: string | null
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

export default function NexAssistant({ workspaceId, isPro }: NexAssistantProps) {
  const [globeState, setGlobeState] = useState<GlobeState>('idle')
  const [isActive, setIsActive] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [statusText, setStatusText] = useState('')
  const [taskCtx, setTaskCtx] = useState<TaskContext>({ tasks: [], workspaceName: '', userName: '' })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const globeStateRef = useRef<GlobeState>('idle')

  useEffect(() => {
    globeStateRef.current = globeState
  }, [globeState])

  // Inject keyframe CSS once
  useEffect(() => {
    if (document.getElementById('nex-styles')) return
    const style = document.createElement('style')
    style.id = 'nex-styles'
    style.textContent = `
      @keyframes nexPulse {
        0%   { transform: scale(1);    opacity: 0.6; }
        100% { transform: scale(1.55); opacity: 0;   }
      }
      @keyframes nexFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
    `
    document.head.appendChild(style)
  }, [])

  // Fetch task context from Supabase and store in state.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional async data fetch; setState is called in an async callback, not synchronously in the effect body
  const loadContext = useCallback(async () => {
    if (!workspaceId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: tasks }, { data: workspace }, { data: profile }] = await Promise.all([
      supabase.from('tasks').select('id,title,status,priority,due_date,description').eq('workspace_id', workspaceId),
      supabase.from('workspaces').select('name').eq('id', workspaceId).single(),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    ])

    setTaskCtx({
      tasks: tasks ?? [],
      workspaceName: workspace?.name ?? 'My Workspace',
      userName: profile?.full_name ?? user.email ?? 'there',
    })
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch triggered by workspaceId change; setState runs after await, not synchronously
    void loadContext()
  }, [workspaceId, loadContext])

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v =>
          v.name.includes('Google UK English Male') ||
          v.name.includes('Daniel') ||
          v.name.includes('Alex') ||
          (v.lang === 'en-GB' && !v.name.toLowerCase().includes('female'))
        ) ?? voices.find(v => v.lang.startsWith('en'))

      if (preferred) utter.voice = preferred
      utter.rate = 0.92
      utter.pitch = 0.88
      utter.volume = 1
      utter.onstart = () => {
        setGlobeState('speaking')
        setStatusText(text.length > 60 ? text.slice(0, 60) + '...' : text)
      }
      utter.onend = () => {
        setGlobeState('idle')
        setStatusText('')
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
      speak('Voice recognition is not supported in this browser. Try Chrome.')
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
      setStatusText('Processing...')

      void (async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !workspaceId) { speak('No workspace selected.'); return }
        try {
          const { speech, action } = await askNex(text, taskCtx, workspaceId, user.id)
          if (action) handleAction(action)
          speak(speech)
        } catch (err) {
          console.error('Nex error:', err)
          speak('I encountered an error. Please try again.')
          setGlobeState('idle')
        }
      })()
    }

    recognition.onerror = () => {
      setGlobeState('idle')
      setStatusText('')
      setTranscript('')
    }

    recognition.onend = () => {
      if (globeStateRef.current === 'listening') setGlobeState('idle')
    }

    recognitionRef.current = recognition
    recognition.start()
    setGlobeState('listening')
    setStatusText('Listening...')
    setTranscript('')
  }, [taskCtx, workspaceId, speak, handleAction])

  const handleGlobeClick = useCallback(() => {
    if (!isPro) {
      speak('Nex requires a Pro subscription.')
      return
    }
    if (!workspaceId) {
      speak('Select a workspace first.')
      return
    }
    if (globeStateRef.current === 'listening') {
      recognitionRef.current?.stop()
      window.speechSynthesis.cancel()
      setGlobeState('idle')
      setStatusText('')
      setTranscript('')
      return
    }
    if (globeStateRef.current === 'speaking') {
      window.speechSynthesis.cancel()
      setGlobeState('idle')
      setStatusText('')
      return
    }
    if (!isActive) {
      setIsActive(true)
      void loadContext().then(() => {
        speak('Online. How can I help?')
        setTimeout(() => startListening(), 1900)
      })
      return
    }
    startListening()
  }, [isPro, workspaceId, isActive, speak, startListening, loadContext])

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
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {statusText && (
        <div style={{
          background: 'rgba(13,71,161,0.92)',
          color: '#e3f2fd',
          fontSize: '12px',
          fontFamily: 'Space Mono, monospace',
          letterSpacing: '0.04em',
          padding: '5px 14px',
          borderRadius: '20px',
          border: '1px solid rgba(79,195,247,0.3)',
          backdropFilter: 'blur(8px)',
          maxWidth: '260px',
          textAlign: 'center',
          animation: 'nexFadeIn 0.2s ease',
          pointerEvents: 'none',
        }}>
          {statusText}
        </div>
      )}

      {isActive && !statusText && (
        <div style={{
          color: 'rgba(79,195,247,0.65)',
          fontSize: '10px',
          fontFamily: 'Space Mono, monospace',
          letterSpacing: '0.18em',
          animation: 'nexFadeIn 0.3s ease',
          pointerEvents: 'none',
        }}>
          NEX
        </div>
      )}

      <div style={{ pointerEvents: 'all' }}>
        <NexGlobe state={globeState} onClick={handleGlobeClick} />
      </div>

      {transcript && globeState === 'thinking' && (
        <div style={{
          color: 'rgba(144,202,249,0.55)',
          fontSize: '11px',
          fontStyle: 'italic',
          fontFamily: 'Space Mono, monospace',
          animation: 'nexFadeIn 0.2s ease',
          pointerEvents: 'none',
          maxWidth: '200px',
          textAlign: 'center',
        }}>
          "{transcript.length > 40 ? transcript.slice(0, 40) + '...' : transcript}"
        </div>
      )}
    </div>
  )
}