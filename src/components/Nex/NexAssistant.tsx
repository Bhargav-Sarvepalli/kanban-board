import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [globeState, setGlobeState]   = useState<GlobeState>('idle')
  const [isActive, setIsActive]       = useState(false)
  const [speechText, setSpeechText]   = useState('')
  const [expanded, setExpanded]       = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [taskCtx, setTaskCtx]         = useState<TaskContext>({
    tasks: [], workspaceName: '', userName: '', isPersonal: true,
  })

  const recognitionRef  = useRef<SpeechRecognition | null>(null)
  const globeStateRef   = useRef<GlobeState>('idle')
  const clearRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { globeStateRef.current = globeState }, [globeState])

  // Show tooltip once on first load
  useEffect(() => {
    if (!nexEnabled) return
    const seen = localStorage.getItem(TOOLTIP_KEY)
    if (!seen) {
      tooltipTimerRef.current = setTimeout(() => setShowTooltip(true), 2500)
    }
    return () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current) }
  }, [nexEnabled])

  // Inject animations
  useEffect(() => {
    if (document.getElementById('nex-styles')) return
    const s = document.createElement('style')
    s.id = 'nex-styles'
    s.textContent = `
      @keyframes nexFade { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      @keyframes nexPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
    `
    document.head.appendChild(s)
  }, [])

  const loadContext = useCallback(async () => {
    if (!userId) return undefined
    let q = supabase.from('tasks').select('id,title,status,priority,due_date,description')
    if (workspaceId) q = q.eq('workspace_id', workspaceId)
    else q = q.is('workspace_id', null).eq('user_id', userId)
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadContext() }, [loadContext])

  const speak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel()
    if (clearRef.current) clearTimeout(clearRef.current)
    const utter = new SpeechSynthesisUtterance(text)
    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v => v.name === 'Google UK English Female') ??
        voices.find(v => v.name === 'Samantha') ??
        voices.find(v => v.name === 'Karen') ??
        voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ??
        voices.find(v => v.lang.startsWith('en'))
      if (preferred) utter.voice = preferred
      utter.rate = 1.1; utter.pitch = 0.82; utter.volume = 1
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
    if (!SR) { speak('Voice recognition unavailable. Please use Chrome.'); return }
    const recognition = new SR()
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US'
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      setGlobeState('thinking'); setSpeechText(text)
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
    setGlobeState('listening'); setSpeechText('')
  }, [taskCtx, workspaceId, userId, speak, handleAction])

  const handleActivate = useCallback(() => {
    if (showTooltip) { setShowTooltip(false); localStorage.setItem(TOOLTIP_KEY, '1') }
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

    setExpanded(true)
    if (!isActive) {
      setIsActive(true)
      void loadContext().then(ctx => {
        if (!ctx) { startListening(); return }
        speak(buildGreeting(ctx), () => setTimeout(startListening, 300))
      })
      return
    }
    startListening()
  }, [showTooltip, isPro, userId, isActive, speak, startListening, loadContext])

  // Space shortcut
  useEffect(() => {
    if (!nexEnabled) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); handleActivate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nexEnabled, handleActivate])

  if (!nexEnabled) return null

  const isListening = globeState === 'listening'
  const isThinking  = globeState === 'thinking'
  const isSpeaking  = globeState === 'speaking'
  const isIdle      = globeState === 'idle'

  const accentColor =
    isThinking  ? '#f472b6' :
    isListening ? '#67e8f9' : '#c084fc'

  const stateLabel =
    isListening ? 'LISTENING' :
    isThinking  ? 'THINKING' :
    isSpeaking  ? 'SPEAKING' : 'NEX'

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      alignItems: 'flex-end', gap: '10px',
      pointerEvents: 'none', userSelect: 'none',
    }}>

      {/* ── EXPANDED PANEL ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            style={{
              pointerEvents: 'all',
              background: 'rgba(10,5,20,0.96)',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: '16px',
              padding: '16px',
              width: '280px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: accentColor,
                  boxShadow: `0 0 8px ${accentColor}`,
                  animation: isIdle ? 'none' : 'nexPulse 1.2s ease-in-out infinite',
                }} />
                <span style={{
                  fontFamily: 'Space Mono, monospace', fontSize: '10px',
                  letterSpacing: '0.2em', color: accentColor, fontWeight: 500,
                }}>
                  {stateLabel}
                </span>
              </div>
              <button
                onClick={() => { setExpanded(false); window.speechSynthesis.cancel(); recognitionRef.current?.stop(); setGlobeState('idle'); setSpeechText('') }}
                style={{
                  background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)',
                  cursor: 'pointer', fontSize: '13px', padding: '2px 4px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Speech transcript / status */}
            <div style={{
              minHeight: '52px', display: 'flex', alignItems: 'center',
              padding: '10px 12px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: '12px',
            }}>
              {speechText ? (
                <p style={{
                  color: isSpeaking ? 'rgba(255,255,255,0.75)' : accentColor,
                  fontSize: '13px', fontFamily: 'Space Grotesk',
                  margin: 0, lineHeight: 1.5,
                  animation: 'nexFade 0.2s ease',
                }}>
                  {speechText}
                </p>
              ) : (
                <p style={{
                  color: 'rgba(255,255,255,0.18)', fontSize: '12px',
                  fontFamily: 'Space Grotesk', margin: 0, fontStyle: 'italic',
                }}>
                  {isIdle && !isActive ? 'Click the orb to start talking…' :
                   isIdle ? 'Click to speak again…' : ''}
                </p>
              )}
            </div>

            {/* Quick commands */}
            {isIdle && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {[
                  'Briefing',
                  'What\'s next?',
                  'Add a task',
                  'Mark done',
                ].map(cmd => (
                  <button
                    key={cmd}
                    onClick={handleActivate}
                    style={{
                      background: 'rgba(139,92,246,0.08)',
                      border: '1px solid rgba(139,92,246,0.2)',
                      borderRadius: '20px', padding: '4px 10px',
                      color: 'rgba(192,132,252,0.7)', fontSize: '11px',
                      fontFamily: 'Space Grotesk', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.15)'; e.currentTarget.style.color = '#c084fc' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; e.currentTarget.style.color = 'rgba(192,132,252,0.7)' }}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ORB + PILL ── */}
      <div style={{ pointerEvents: 'all', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>

        {/* First-visit tooltip */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              style={{
                background: 'rgba(15,5,35,0.95)',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: '10px', padding: '10px 14px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              }}
            >
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: 'Space Grotesk', margin: '0 0 4px', lineHeight: 1.5 }}>
                I'm Nex — your AI assistant.
              </p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Grotesk', margin: 0 }}>
                Click or press <kbd style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '4px', padding: '1px 6px', color: '#c084fc', fontFamily: 'Space Mono', fontSize: '10px' }}>Space</kbd>
              </p>
              <button
                onClick={() => { setShowTooltip(false); localStorage.setItem(TOOLTIP_KEY, '1') }}
                style={{ marginTop: '8px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: '11px', cursor: 'pointer', fontFamily: 'Space Grotesk', padding: 0 }}
              >
                got it
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The orb */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleActivate}
          style={{
            cursor: 'pointer',
            filter: globeState !== 'idle' ? `drop-shadow(0 0 12px ${accentColor})` : 'none',
            transition: 'filter 0.3s ease',
          }}
        >
          <NexGlobe
            state={globeState}
            onClick={handleActivate}
            onDismiss={() => { setExpanded(false); window.speechSynthesis.cancel() }}
            showDismiss={false}
          />
        </motion.div>

        {/* State label below orb */}
        <div style={{
          fontFamily: 'Space Mono, monospace', fontSize: '8px',
          letterSpacing: '0.22em', textAlign: 'center',
          color: isIdle ? 'rgba(139,92,246,0.3)' : accentColor,
          transition: 'color 0.3s ease',
          animation: isIdle ? 'none' : 'nexPulse 1.2s ease-in-out infinite',
          paddingRight: '2px',
        }}>
          {isIdle ? 'NEX' : stateLabel}
        </div>
      </div>
    </div>
  )
}