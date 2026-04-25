import type { CSSProperties } from 'react'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexGlobeProps {
  state: GlobeState
  onClick: () => void
}

export default function NexGlobe({ state, onClick }: NexGlobeProps) {
  const isActive = state !== 'idle'
  const isThinking = state === 'thinking'
  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'

  // Core color per state
  const coreColor = isThinking
    ? '#ec4899'
    : isListening
    ? '#c084fc'
    : '#8b5cf6'

  const glowColor = isThinking
    ? 'rgba(236,72,153,0.45)'
    : isListening
    ? 'rgba(192,132,252,0.45)'
    : 'rgba(139,92,246,0.3)'

  const animSpeed = isThinking
    ? '1.2s'
    : isListening
    ? '1.6s'
    : isSpeaking
    ? '1.4s'
    : '3s'

  // Injected once
  if (typeof document !== 'undefined' && !document.getElementById('nex-globe-styles')) {
    const s = document.createElement('style')
    s.id = 'nex-globe-styles'
    s.textContent = `
      @keyframes nexOrb {
        0%,100% { transform: scale(1); }
        50%      { transform: scale(1.06); }
      }
      @keyframes nexOrbFast {
        0%,100% { transform: scale(1); }
        50%      { transform: scale(1.12); }
      }
      @keyframes nexSpin1 {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes nexSpin2 {
        from { transform: rotate(0deg); }
        to   { transform: rotate(-360deg); }
      }
      @keyframes nexSpin3 {
        from { transform: rotate(45deg); }
        to   { transform: rotate(405deg); }
      }
      @keyframes nexPulse {
        0%   { transform: scale(1);   opacity: 0.6; }
        100% { transform: scale(1.9); opacity: 0;   }
      }
      @keyframes nexFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0);   }
      }
      @keyframes nexGlow {
        0%,100% { opacity: 0.7; }
        50%      { opacity: 1;   }
      }
    `
    document.head.appendChild(s)
  }

  const wrap: CSSProperties = {
    position: 'relative',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    outline: 'none',
    borderRadius: '50%',
  }

  // The orb itself — layered CSS radial gradients for depth
  const orbSize = '64px'

  const orbStyle: CSSProperties = {
    width: orbSize,
    height: orbSize,
    borderRadius: '50%',
    background: isThinking
      ? `radial-gradient(circle at 35% 35%, #f9a8d4 0%, #ec4899 35%, #9d174d 70%, #1a0010 100%)`
      : isListening
      ? `radial-gradient(circle at 35% 35%, #e9d5ff 0%, #c084fc 35%, #6d28d9 70%, #0d0020 100%)`
      : `radial-gradient(circle at 35% 35%, #ddd6fe 0%, #8b5cf6 35%, #4c1d95 70%, #0d0020 100%)`,
    boxShadow: `
      0 0 24px ${glowColor},
      0 0 48px ${glowColor.replace('0.45', '0.2').replace('0.3', '0.15')},
      inset 0 0 16px rgba(0,0,0,0.4)
    `,
    animation: `${isThinking || isListening ? 'nexOrbFast' : 'nexOrb'} ${animSpeed} ease-in-out infinite`,
    position: 'relative',
    transition: 'background 0.5s ease, box-shadow 0.5s ease',
    flexShrink: 0,
  }

  // Orbiting ring — thin arc, rotates continuously
  const ringBase: CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    border: '1px solid transparent',
    pointerEvents: 'none',
  }

  const ring1: CSSProperties = {
    ...ringBase,
    width: '72px', height: '72px',
    borderTop: `1px solid ${coreColor}88`,
    borderRight: `1px solid ${coreColor}33`,
    animation: `nexSpin1 ${isActive ? '2s' : '5s'} linear infinite`,
  }

  const ring2: CSSProperties = {
    ...ringBase,
    width: '78px', height: '78px',
    borderBottom: `1px solid ${coreColor}66`,
    borderLeft: `1px solid ${coreColor}22`,
    animation: `nexSpin2 ${isActive ? '2.8s' : '7s'} linear infinite`,
  }

  const ring3: CSSProperties = {
    ...ringBase,
    width: '68px', height: '68px',
    borderTop: `1px solid ${isThinking ? '#f472b6' : '#a855f7'}44`,
    animation: `nexSpin3 ${isActive ? '3.5s' : '9s'} linear infinite`,
    opacity: isActive ? 1 : 0.4,
    transition: 'opacity 0.4s ease',
  }

  return (
    <button onClick={onClick} title="Talk to Nex" style={wrap}>

      {/* Ambient glow behind everything */}
      <span style={{
        position: 'absolute',
        inset: '-10px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        animation: 'nexGlow 2s ease-in-out infinite',
        pointerEvents: 'none',
        transition: 'background 0.5s ease',
      }} />

      {/* Pulse rings — active states only */}
      {isActive && (<>
        <span style={{
          position: 'absolute',
          width: '96px', height: '96px',
          borderRadius: '50%',
          border: `1px solid ${glowColor}`,
          animation: 'nexPulse 1.8s ease-out infinite',
          pointerEvents: 'none',
        }} />
        <span style={{
          position: 'absolute',
          width: '112px', height: '112px',
          borderRadius: '50%',
          border: `1px solid ${glowColor.replace('0.45', '0.2').replace('0.3', '0.12')}`,
          animation: 'nexPulse 1.8s ease-out 0.65s infinite',
          pointerEvents: 'none',
        }} />
      </>)}

      {/* Orbiting rings */}
      <span style={ring1} />
      <span style={ring2} />
      <span style={ring3} />

      {/* The orb */}
      <span style={orbStyle} />
    </button>
  )
}