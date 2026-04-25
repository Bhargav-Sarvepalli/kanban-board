import { useEffect } from 'react'
import type { CSSProperties } from 'react'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexGlobeProps {
  state: GlobeState
  onClick: () => void
  onDismiss?: () => void
  showDismiss?: boolean
}

export default function NexGlobe({ state, onClick, onDismiss, showDismiss }: NexGlobeProps) {
  useEffect(() => {
    if (document.getElementById('nex-globe-styles')) return
    const s = document.createElement('style')
    s.id = 'nex-globe-styles'
    s.textContent = `
      @keyframes nexCorePulse {
        0%,100% { transform: scale(1); }
        50%      { transform: scale(1.07); }
      }
      @keyframes nexCoreThink {
        0%,100% { transform: scale(1); opacity: 1; }
        50%      { transform: scale(1.14); opacity: 0.85; }
      }
      @keyframes nexCoreListen {
        0%,100% { transform: scale(1); }
        25%      { transform: scale(1.1); }
        75%      { transform: scale(0.96); }
      }
      @keyframes nexCoreSpeak {
        0%,100% { transform: scale(1); }
        20%      { transform: scale(1.13); }
        40%      { transform: scale(0.97); }
        60%      { transform: scale(1.09); }
        80%      { transform: scale(1.01); }
      }
      @keyframes nexFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `
    document.head.appendChild(s)
  }, [])

  const isListening = state === 'listening'
  const isThinking  = state === 'thinking'
  const isSpeaking  = state === 'speaking'
  const isActive    = state !== 'idle'

  const coreAnim = isThinking  ? `nexCoreThink  ${0.7}s ease-in-out infinite`
    : isListening ? `nexCoreListen ${0.5}s ease-in-out infinite`
    : isSpeaking  ? `nexCoreSpeak  ${0.6}s ease-in-out infinite`
    : `nexCorePulse 2.8s ease-in-out infinite`
  const coreGradient = isThinking
    ? `radial-gradient(circle at 32% 28%,
        rgba(255,255,255,0.92) 0%, transparent 16%),
       radial-gradient(circle at 65% 68%, rgba(244,114,182,0.55) 0%, transparent 35%),
       radial-gradient(circle at 35% 35%, #fda4af 0%, #ec4899 22%, #9d174d 52%, #1a0015 80%, #000 100%)`
    : isListening
    ? `radial-gradient(circle at 32% 28%,
        rgba(255,255,255,0.95) 0%, transparent 17%),
       radial-gradient(circle at 65% 68%, rgba(103,232,249,0.4) 0%, transparent 35%),
       radial-gradient(circle at 35% 35%, #e0f2fe 0%, #67e8f9 18%, #7c3aed 45%, #1e1b4b 75%, #000 100%)`
    : `radial-gradient(circle at 32% 28%,
        rgba(255,255,255,0.92) 0%, transparent 17%),
       radial-gradient(circle at 65% 68%, rgba(236,72,153,0.45) 0%, transparent 35%),
       radial-gradient(circle at 35% 35%, #ede9fe 0%, #c084fc 20%, #7c3aed 48%, #1e1b4b 78%, #000 100%)`

  // Core glow per state
  const coreGlow = isThinking
    ? '0 0 18px rgba(236,72,153,0.9), 0 0 40px rgba(236,72,153,0.4), 0 0 70px rgba(236,72,153,0.15)'
    : isListening
    ? '0 0 18px rgba(103,232,249,0.8), 0 0 40px rgba(139,92,246,0.5), 0 0 70px rgba(139,92,246,0.2)'
    : isSpeaking
    ? '0 0 18px rgba(192,132,252,0.9), 0 0 40px rgba(139,92,246,0.45), 0 0 70px rgba(139,92,246,0.18)'
    : '0 0 14px rgba(168,85,247,0.7), 0 0 30px rgba(139,92,246,0.35), 0 0 55px rgba(139,92,246,0.12)'

  const coreAnim = isThinking  ? `nexCoreThink  ${0.7}s ease-in-out infinite`
    : isListening ? `nexCoreListen ${0.5}s ease-in-out infinite`
    : isSpeaking  ? `nexCoreSpeak  ${0.6}s ease-in-out infinite`
    : `nexCorePulse 2.8s ease-in-out infinite`

  const wrap: CSSProperties = {
    position: 'relative',
    width: '68px', height: '68px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    background: 'none', border: 'none', padding: 0, outline: 'none',
    WebkitTapHighlightColor: 'transparent',
  }

  return (
    <button onClick={onClick} title="Talk to Nex" style={wrap}>

      {/* Soft ambient glow — minimal, no rings */}
      <span style={{
        position: 'absolute',
        inset: '-8px',
        borderRadius: '50%',
        background: isThinking
          ? 'radial-gradient(circle, rgba(236,72,153,0.14) 0%, transparent 70%)'
          : isListening
          ? 'radial-gradient(circle, rgba(103,232,249,0.12) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        transition: 'background 0.6s ease',
        pointerEvents: 'none',
      }} />

      {/* ── PLASMA CORE ONLY ── */}
      <span style={{
        position: 'relative',
        zIndex: 2,
        width: '52px', height: '52px',
        borderRadius: '50%',
        background: coreGradient,
        boxShadow: coreGlow,
        animation: coreAnim,
        transition: 'background 0.5s ease, box-shadow 0.5s ease',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Mic icon — idle only */}
        {!isActive && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5 }}>
            <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
            <path d="M5 10a7 7 0 0 0 14 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="9" y1="21" x2="15" y2="21" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        )}
      </span>

      {/* Dismiss × button */}
      {showDismiss && onDismiss && (
        <button
          onClick={e => { e.stopPropagation(); onDismiss() }}
          title="Hide Nex"
          style={{
            position: 'absolute',
            top: '-2px', right: '-2px',
            width: '18px', height: '18px',
            borderRadius: '50%',
            background: 'rgba(30,10,60,0.9)',
            border: '1px solid rgba(139,92,246,0.4)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '10px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
            lineHeight: 1,
            animation: 'nexFadeIn 0.15s ease',
          }}
        >
          ×
        </button>
      )}
    </button>
  )
}