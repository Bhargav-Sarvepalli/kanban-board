import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../supabase'
import NexGlobe from './NexGlobe'
import { askNex, buildGreeting } from '../../lib/nex'
import type { TaskContext, NexActionResult, ConvMessage } from '../../lib/nex'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexAssistantProps {
  workspaceId: string | null
  projectId?: string | null
  userId: string | null
  isPro: boolean
  nexEnabled: boolean
  nexVoiceEnabled: boolean
  onTaskCreated?: () => void
  onOpenProjectWizard?: () => void
  onOpenWorkspacePanel?: () => void
  onOpenPomodoro?: (duration?: number) => void
  panelOpen?: boolean
  coveredByModal?: boolean
}

interface Message {
  id: string
  role: 'user' | 'nex'
  text: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string
  start(): void; stop(): void; abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  isFinal: boolean; length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative { transcript: string; confidence: number }
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

const TOOLTIP_KEY = 'nex_tooltip_seen'
const SILENCE_MS  = 1500
const ORB_SIZE    = 52
const MAX_HISTORY = 20
const MIN_CONFIDENCE = 0.35

export default function NexAssistant({ workspaceId, projectId = null, userId, isPro, nexEnabled, nexVoiceEnabled, onTaskCreated, onOpenProjectWizard, onOpenWorkspacePanel, onOpenPomodoro, panelOpen = false, coveredByModal = false }: NexAssistantProps) {
  const [globeState, setGlobeState]   = useState<GlobeState>('idle')
  const [expanded, setExpanded]       = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [messages, setMessages]       = useState<Message[]>([])
  const [taskCtx, setTaskCtx]         = useState<TaskContext>({ tasks: [], workspaceName: '', userName: '', isPersonal: true })

  const historyRef      = useRef<ConvMessage[]>([])
  const recognitionRef  = useRef<SpeechRecognition | null>(null)
  const globeStateRef   = useRef<GlobeState>('idle')
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTextRef    = useRef('')
  const panelRef        = useRef<HTMLDivElement>(null)
  const ttsWarmedRef    = useRef(false)
  const activatingRef   = useRef(false)
  const processingRef   = useRef(false)
  const lastCommandRef  = useRef<{ text: string; at: number } | null>(null)

  useEffect(() => { globeStateRef.current = globeState }, [globeState])

  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = panelRef.current.scrollHeight
  }, [messages, interimText])

  useEffect(() => {
    if (!nexEnabled) return
    if (!localStorage.getItem(TOOLTIP_KEY))
      tooltipTimerRef.current = setTimeout(() => setShowTooltip(true), 3000)
    return () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current) }
  }, [nexEnabled])

  useEffect(() => {
    if (document.getElementById('nex-styles')) return
    const s = document.createElement('style')
    s.id = 'nex-styles'
    s.textContent = `
      @keyframes nexFade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      @keyframes nexBlink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes nexPulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
      @keyframes nexDot { 0%,80%,100%{transform:scale(0);opacity:0} 40%{transform:scale(1);opacity:1} }
    `
    document.head.appendChild(s)
  }, [])

  const loadContext = useCallback(async () => {
    if (!userId) return undefined
    let q = supabase.from('tasks').select('id,title,status,priority,due_date,description,feature_id')
    if (projectId) q = q.eq('project_id', projectId)
    else if (workspaceId) q = q.eq('workspace_id', workspaceId).is('project_id', null)
    else q = q.is('workspace_id', null).is('project_id', null).eq('user_id', userId)
    const [{ data: tasks }, { data: profile }] = await Promise.all([
      q, supabase.from('profiles').select('full_name').eq('id', userId).single(),
    ])
    let workspaceName = 'Personal'
    if (workspaceId) {
      const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
      workspaceName = ws?.name ?? 'Workspace'
    }
    let projectName: string | undefined
    if (projectId) {
      const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
      projectName = project?.name
    }
    const ctx: TaskContext = { tasks: tasks ?? [], workspaceName, projectName, userName: profile?.full_name?.split(' ')[0] ?? '', isPersonal: !workspaceId && !projectId }
    setTaskCtx(ctx)
    return ctx
  }, [workspaceId, projectId, userId])

  useEffect(() => { void loadContext() }, [loadContext])

  const addMessage = useCallback((role: 'user' | 'nex', text: string) => {
    setMessages(prev => [...prev.slice(-12), { id: Date.now().toString(), role, text }])
  }, [])

  const warmupTTS = useCallback(() => {
    if (!nexVoiceEnabled || !('speechSynthesis' in window)) return
    if (ttsWarmedRef.current) return
    ttsWarmedRef.current = true
    const dummy = new SpeechSynthesisUtterance('')
    dummy.volume = 0
    window.speechSynthesis.speak(dummy)
  }, [nexVoiceEnabled])

  const shouldIgnoreTranscript = useCallback((text: string) => {
    const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!clean) return true
    const words = clean.split(' ').filter(Boolean)
    if (clean.length < 4) return true
    const conversationalSingles = ['nex', 'next', 'stop', 'pause', 'yes', 'no', 'sorry', 'thanks', 'thankyou', 'hello', 'hey', 'ok', 'okay']
    if (words.length === 1 && !conversationalSingles.includes(clean)) return true
    const noise = new Set(['um', 'uh', 'hmm', 'mm'])
    return words.length <= 2 && words.every(w => noise.has(w))
  }, [])

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!nexVoiceEnabled || !('speechSynthesis' in window)) {
      setGlobeState('idle')
      window.setTimeout(() => onDone?.(), 90)
      return
    }
    warmupTTS()
    window.speechSynthesis.cancel()
    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text)
      const trySpeak = () => {
        const voices = window.speechSynthesis.getVoices()
        const preferred =
          voices.find(v => v.name === 'Microsoft Jenny Online (Natural) - English (United States)') ??
          voices.find(v => v.name === 'Microsoft Aria Online (Natural) - English (United States)') ??
          voices.find(v => v.name === 'Microsoft Sonia Online (Natural) - English (United Kingdom)') ??
          voices.find(v => v.name === 'Google UK English Female') ??
          voices.find(v => v.name === 'Google US English') ??
          voices.find(v => v.name.toLowerCase().includes('natural') && v.lang.startsWith('en')) ??
          voices.find(v => v.name === 'Samantha') ??
          voices.find(v => v.name === 'Karen') ??
          voices.find(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('compact')) ??
          voices.find(v => v.lang.startsWith('en'))
        if (preferred) utter.voice = preferred
        utter.rate = 1.03; utter.pitch = 1.02; utter.volume = 1
        utter.onstart = () => setGlobeState('speaking')
        utter.onend   = () => { setGlobeState('idle'); onDone?.() }
        utter.onerror = () => { setGlobeState('idle'); onDone?.() }
        window.speechSynthesis.speak(utter)
      }
      if (window.speechSynthesis.getVoices().length > 0) trySpeak()
      else window.speechSynthesis.onvoiceschanged = trySpeak
    }, 80)
  }, [nexVoiceEnabled, warmupTTS])

  const handleAction = useCallback((action: NexActionResult) => {
    void loadContext()
    if (action.type === 'create_task' || action.type === 'delete_task' || action.type === 'update_task_status' || action.type === 'update_task' || action.type === 'add_subtasks_to_task') {
      onTaskCreated?.()
    }
    if (action.type === 'open_project_wizard') {
      onOpenProjectWizard?.()
    }
    if (action.type === 'open_workspace_panel') {
      onOpenWorkspacePanel?.()
    }
    if (action.type === 'start_focus_session') {
      const duration = typeof action.data.duration === 'number' ? action.data.duration : undefined
      onOpenPomodoro?.(duration)
    }
  }, [loadContext, onTaskCreated, onOpenProjectWizard, onOpenWorkspacePanel, onOpenPomodoro])

  const fireNex = useCallback(async (transcript: string) => {
    if (!transcript.trim() || !userId) return
    const cleanTranscript = transcript.trim()
    const now = Date.now()
    if (processingRef.current) return
    if (lastCommandRef.current?.text === cleanTranscript.toLowerCase() && now - lastCommandRef.current.at < 2500) return
    processingRef.current = true
    lastCommandRef.current = { text: cleanTranscript.toLowerCase(), at: now }
    setGlobeState('thinking')
    setInterimText('')
    addMessage('user', cleanTranscript)
    finalTextRef.current = ''

    try {
      const { speech, action, newHistory } = await askNex(
        cleanTranscript, taskCtx, workspaceId, userId,
        projectId,
        historyRef.current.slice(-MAX_HISTORY)
      )
      historyRef.current = newHistory.slice(-MAX_HISTORY)
      if (action) handleAction(action)
      addMessage('nex', speech)
      const fallbackDelay = Math.min(Math.max(speech.length * 65, 1600), 7000)
      const fallbackTimer = setTimeout(() => {
        if (globeStateRef.current === 'idle') startListeningCycle()
      }, fallbackDelay)
      speak(speech, () => {
        clearTimeout(fallbackTimer)
        setTimeout(startListeningCycle, 450)
      })
    } catch (err) {
      console.error('[Nex]', err)
      const errMsg = 'Systems encountered an error.'
      addMessage('nex', errMsg)
      speak(errMsg)
      setGlobeState('idle')
    } finally {
      processingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskCtx, workspaceId, projectId, userId, speak, handleAction, addMessage])

  const startListeningCycle = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) { speak('Voice recognition unavailable. Please use Chrome.'); return }
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch (e) { void e } }

    const recognition = new SR()
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''; let final = ''; let bestConfidence = 1
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const alt = result[0]
        if (result.isFinal) {
          final += alt.transcript
          bestConfidence = Math.min(bestConfidence, alt.confidence || 1)
        } else {
          interim += alt.transcript
        }
      }
      setInterimText(interim)
      if (final) { finalTextRef.current += ' ' + final.trim(); setInterimText('') }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        const full = (finalTextRef.current + ' ' + interim).trim()
        if (bestConfidence < MIN_CONFIDENCE || shouldIgnoreTranscript(full)) {
          recognition.stop()
          setInterimText('')
          return
        }
        recognition.stop(); void fireNex(full)
      }, SILENCE_MS)
    }

    recognition.onerror = (e: Event) => {
      const err = (e as Event & { error?: string }).error
      if (err !== 'no-speech' && err !== 'aborted') { console.error('[Nex]', err); setGlobeState('idle') }
    }
    recognition.onend = () => { if (globeStateRef.current === 'listening') setGlobeState('idle') }

    recognitionRef.current = recognition
    recognition.start()
    setGlobeState('listening')
    finalTextRef.current = ''; setInterimText('')
  }, [speak, fireNex, shouldIgnoreTranscript])

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    try { recognitionRef.current?.abort() } catch (e) { void e }
    window.speechSynthesis.cancel()
    setGlobeState('idle'); setInterimText('')
  }, [])

  useEffect(() => {
    if (!coveredByModal) return
    stopListening()
    setExpanded(false)
    setShowTooltip(false)
  }, [coveredByModal, stopListening])

  const handleActivate = useCallback(() => {
    if (activatingRef.current) return
    activatingRef.current = true
    setTimeout(() => { activatingRef.current = false }, 650)
    if (showTooltip) { setShowTooltip(false); localStorage.setItem(TOOLTIP_KEY, '1') }
    if (!isPro) { speak('Nex is available on the Pro plan.'); return }
    if (!userId) return

    const cur = globeStateRef.current
    if (cur === 'listening') { stopListening(); return }
    if (cur === 'speaking')  { window.speechSynthesis.cancel(); setGlobeState('idle'); return }
    if (cur === 'thinking')  return

    setExpanded(true)
    if (nexVoiceEnabled) warmupTTS()

    if (expanded && messages.length > 0) {
      startListeningCycle()
      return
    }

    void loadContext().then(ctx => {
      const greeting = ctx ? buildGreeting(ctx) : 'What can I help you with?'
      addMessage('nex', greeting)
      const fallbackTimer = setTimeout(() => {
        if (globeStateRef.current === 'idle') startListeningCycle()
      }, 2800)
      speak(greeting, () => {
        clearTimeout(fallbackTimer)
        setTimeout(startListeningCycle, 350)
      })
    })
  }, [showTooltip, isPro, userId, speak, stopListening, startListeningCycle, loadContext, addMessage, warmupTTS, nexVoiceEnabled, expanded, messages.length])

  useEffect(() => {
    if (!nexEnabled) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); handleActivate() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nexEnabled, handleActivate])

  if (!nexEnabled || coveredByModal) return null

  const isListening = globeState === 'listening'
  const isThinking  = globeState === 'thinking'
  const isSpeaking  = globeState === 'speaking'
  const isIdle      = globeState === 'idle'

  const accentColor = isListening ? '#38bdf8' : isThinking ? '#f472b6' : isSpeaking ? '#34d399' : '#a78bfa'
  const stateLabel  = isListening ? 'LISTENING' : isThinking ? 'THINKING' : isSpeaking ? 'SPEAKING' : 'IDLE'

  return (
    // Plain div with CSS transition — no Framer Motion physics, no bounce
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: panelOpen ? 'min(680px, calc(100vw - 360px))' : '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px',
        pointerEvents: 'none',
        userSelect: 'none',
        transition: 'right 0.34s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >

      {/* Conversation panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            style={{ pointerEvents: 'all', width: '300px', background: 'rgba(8,4,18,0.97)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}
          >
            {/* Header */}
            <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(139,92,246,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flex: 1 }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor, boxShadow: `0 0 10px ${accentColor}`, animation: isIdle ? 'nexPulse 3s ease-in-out infinite' : 'nexPulse 0.8s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', letterSpacing: '0.22em', color: accentColor, fontWeight: 600 }}>NEX</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)' }}>· {stateLabel}</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {!isIdle && (
                  <button onClick={stopListening} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '3px 8px', color: '#f87171', cursor: 'pointer', fontSize: '10px', fontFamily: 'Space Mono' }}>STOP</button>
                )}
                <button onClick={() => { stopListening(); setExpanded(false); setMessages([]); historyRef.current = [] }}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', width: '24px', height: '24px', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={panelRef} style={{ padding: '12px', maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', scrollBehavior: 'smooth' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: 0 }}>Starting up…</p>
                </div>
              )}
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: msg.role === 'user' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)', border: msg.role === 'user' ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ color: msg.role === 'user' ? '#ddd6fe' : 'rgba(255,255,255,0.82)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1.55 }}>{msg.text}</p>
                  </div>
                </motion.div>
              ))}
              {interimText && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: '14px 14px 4px 14px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)' }}>
                    <p style={{ color: '#7dd3fc', fontSize: '12px', fontFamily: 'Space Grotesk', margin: 0, lineHeight: 1.55, opacity: 0.8 }}>
                      {interimText}<span style={{ animation: 'nexBlink 0.8s step-end infinite', marginLeft: '2px' }}>|</span>
                    </p>
                  </div>
                </div>
              )}
              {isThinking && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[0, 1, 2].map(i => <div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f472b6', animation: `nexDot 1.4s ease-in-out ${i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
            </div>

            {/* Quick commands */}
            {isIdle && messages.length > 0 && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {[
                  { label: 'Standup',      cmd: 'Give me a standup briefing' },
                  { label: "What's next?", cmd: 'What should I work on next?' },
                  { label: 'Add a task',   cmd: null },
                  { label: 'Mark done',    cmd: null },
                ].map(({ label, cmd }) => (
                  <button key={label}
                    onClick={() => { if (cmd) { void fireNex(cmd) } else { speak('Go ahead.', () => setTimeout(startListeningCycle, 200)) } }}
                    style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)', borderRadius: '20px', padding: '4px 10px', color: 'rgba(167,139,250,0.65)', fontSize: '11px', fontFamily: 'Space Grotesk', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.16)'; e.currentTarget.style.color = '#c084fc' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.color = 'rgba(167,139,250,0.65)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orb pill */}
      <div style={{ pointerEvents: 'all', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <AnimatePresence>
          {showTooltip && (
            <motion.div initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              style={{ background: 'rgba(8,4,18,0.97)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: '12px', padding: '12px 16px', marginBottom: '10px', maxWidth: '220px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontFamily: 'Space Grotesk', margin: '0 0 4px', fontWeight: 600 }}>Meet Nex</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: '0 0 10px', lineHeight: 1.5 }}>Your AI assistant. Click to start talking.</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
                  Press <kbd style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '4px', padding: '1px 6px', color: '#c084fc', fontFamily: 'Space Mono', fontSize: '10px' }}>Space</kbd>
                </span>
                <button onClick={() => { setShowTooltip(false); localStorage.setItem(TOOLTIP_KEY, '1') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '11px', cursor: 'pointer', fontFamily: 'Space Grotesk', padding: 0 }}>got it</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          onClick={handleActivate}
          style={{ background: 'rgba(8,4,18,0.95)', border: `1px solid ${isIdle ? 'rgba(139,92,246,0.3)' : accentColor + '60'}`, borderRadius: '32px', padding: '6px 14px 6px 6px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: isIdle ? '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)' : `0 4px 20px rgba(0,0,0,0.5), 0 0 20px ${accentColor}30`, backdropFilter: 'blur(20px)', transition: 'all 0.3s ease', cursor: 'pointer' }}
        >
          <NexGlobe state={globeState} size={ORB_SIZE} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '12px', letterSpacing: '0.22em', fontWeight: 700, color: isIdle ? 'rgba(167,139,250,0.9)' : accentColor, transition: 'color 0.3s ease' }}>NEX</span>
              {!isIdle && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: accentColor, flexShrink: 0, animation: 'nexPulse 0.8s ease-in-out infinite' }} />}
            </div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '8px', letterSpacing: '0.15em', margin: 0, color: isIdle ? 'rgba(255,255,255,0.2)' : accentColor + 'aa', transition: 'color 0.3s ease' }}>
              {isListening ? 'LISTENING…' : isThinking ? 'THINKING…' : isSpeaking ? 'SPEAKING…' : 'CLICK TO TALK'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
