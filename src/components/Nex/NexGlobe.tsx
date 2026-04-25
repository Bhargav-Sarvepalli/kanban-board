import { useRef, useEffect } from 'react'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexGlobeProps {
  state: GlobeState
  onClick: () => void
}

// Smooth noise function for organic blob deformation
function smoothNoise(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 2.1 + t * 0.8) * 0.5 +
    Math.sin(y * 1.7 + t * 1.1) * 0.3 +
    Math.sin((x + y) * 1.3 + t * 0.6) * 0.2
  )
}

export default function NexGlobe({ state, onClick }: NexGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GlobeState>(state)
  const animRef = useRef<number>(0)

  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const SIZE = 88
    canvas.width = SIZE
    canvas.height = SIZE
    const cx = SIZE / 2
    const cy = SIZE / 2
    const baseR = 30

    let t = 0

    const stateConfig = {
      idle: {
        speed: 0.012,
        deform: 0.12,
        colors: ['#7c3aed', '#8b5cf6', '#a855f7', '#6d28d9'],
        glowColor: 'rgba(139,92,246,0.35)',
        glowR: 38,
        pulseAmp: 0.008,
        pulseFreq: 1.2,
      },
      listening: {
        speed: 0.022,
        deform: 0.22,
        colors: ['#a855f7', '#c084fc', '#d8b4fe', '#8b5cf6'],
        glowColor: 'rgba(192,132,252,0.5)',
        glowR: 44,
        pulseAmp: 0.03,
        pulseFreq: 5,
      },
      thinking: {
        speed: 0.038,
        deform: 0.18,
        colors: ['#ec4899', '#f472b6', '#a855f7', '#c084fc'],
        glowColor: 'rgba(236,72,153,0.45)',
        glowR: 42,
        pulseAmp: 0.04,
        pulseFreq: 8,
      },
      speaking: {
        speed: 0.028,
        deform: 0.28,
        colors: ['#8b5cf6', '#a855f7', '#c084fc', '#ec4899'],
        glowColor: 'rgba(168,85,247,0.48)',
        glowR: 46,
        pulseAmp: 0.05,
        pulseFreq: 6,
      },
    }

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      ctx.clearRect(0, 0, SIZE, SIZE)

      const s = stateRef.current
      const cfg = stateConfig[s]
      t += cfg.speed

      // Organic blob radius at each angle
      const STEPS = 180
      const points: [number, number][] = []

      for (let i = 0; i < STEPS; i++) {
        const angle = (i / STEPS) * Math.PI * 2
        const nx = Math.cos(angle)
        const ny = Math.sin(angle)

        // Layered noise for organic feel
        const n1 = smoothNoise(nx, ny, t)
        const n2 = smoothNoise(nx * 2, ny * 2, t * 1.3 + 1)
        const pulse = Math.sin(t * cfg.pulseFreq) * cfg.pulseAmp

        const r = baseR * (1 + n1 * cfg.deform * 0.6 + n2 * cfg.deform * 0.4 + pulse)
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
      }

      // Draw outer glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, cfg.glowR)
      grd.addColorStop(0, cfg.glowColor.replace(')', ', 0.0)').replace('rgba', 'rgba'))
      // simpler glow via shadow
      ctx.save()
      ctx.shadowColor = cfg.colors[0]
      ctx.shadowBlur = 18

      // Draw blob path
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < STEPS; i++) {
        const prev = points[(i - 1 + STEPS) % STEPS]
        const curr = points[i]
        const next = points[(i + 1) % STEPS]
        // Smooth catmull-rom style
        const cpx = curr[0] + (next[0] - prev[0]) * 0.15
        const cpy = curr[1] + (next[1] - prev[1]) * 0.15
        ctx.quadraticCurveTo(curr[0], curr[1], cpx, cpy)
      }
      ctx.closePath()

      // Main gradient fill — deep purple core to lighter edge
      const fillGrad = ctx.createRadialGradient(
        cx - 6, cy - 6, 2,
        cx, cy, baseR * 1.25
      )
      fillGrad.addColorStop(0, cfg.colors[2])    // lighter highlight
      fillGrad.addColorStop(0.35, cfg.colors[0]) // main color
      fillGrad.addColorStop(0.7, cfg.colors[3])  // dark edge
      fillGrad.addColorStop(1, 'rgba(30,10,60,0.95)')

      ctx.fillStyle = fillGrad
      ctx.fill()
      ctx.restore()

      // Inner highlight — small bright spot for 3D depth
      const hiX = cx - 8
      const hiY = cy - 8
      const hiGrad = ctx.createRadialGradient(hiX, hiY, 0, hiX, hiY, 14)
      hiGrad.addColorStop(0, 'rgba(255,255,255,0.22)')
      hiGrad.addColorStop(0.5, 'rgba(255,255,255,0.06)')
      hiGrad.addColorStop(1, 'rgba(255,255,255,0)')

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < STEPS; i++) {
        const prev = points[(i - 1 + STEPS) % STEPS]
        const curr = points[i]
        const next = points[(i + 1) % STEPS]
        const cpx = curr[0] + (next[0] - prev[0]) * 0.15
        const cpy = curr[1] + (next[1] - prev[1]) * 0.15
        ctx.quadraticCurveTo(curr[0], curr[1], cpx, cpy)
      }
      ctx.closePath()
      ctx.clip()
      ctx.fillStyle = hiGrad
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.restore()

      // Thin outer ring when active
      if (s !== 'idle') {
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, baseR + 6 + Math.sin(t * 3) * 1.5, 0, Math.PI * 2)
        ctx.strokeStyle = s === 'thinking'
          ? 'rgba(236,72,153,0.25)'
          : 'rgba(192,132,252,0.2)'
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.restore()
      }
    }

    draw()

    return () => { cancelAnimationFrame(animRef.current) }
  }, [])

  // CSS pulse rings outside canvas
  const isActive = state !== 'idle'
  const pulseColor = state === 'thinking'
    ? 'rgba(236,72,153,0.35)'
    : 'rgba(139,92,246,0.3)'

  return (
    <button
      onClick={onClick}
      title="Talk to Nex"
      style={{
        position: 'relative',
        width: '88px', height: '88px',
        background: 'none', border: 'none',
        cursor: 'pointer', padding: 0, outline: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '50%',
      }}
    >
      {/* Soft ambient glow behind orb */}
      <span style={{
        position: 'absolute',
        inset: '-12px',
        borderRadius: '50%',
        background: state === 'thinking'
          ? 'radial-gradient(circle, rgba(236,72,153,0.18) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)',
        transition: 'background 0.6s ease',
        pointerEvents: 'none',
      }} />

      {/* Pulse rings when active */}
      {isActive && (
        <>
          <span style={{
            position: 'absolute',
            width: '110px', height: '110px',
            borderRadius: '50%',
            border: `1px solid ${pulseColor}`,
            animation: 'nexPulse 1.8s ease-out infinite',
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute',
            width: '130px', height: '130px',
            borderRadius: '50%',
            border: `1px solid ${pulseColor.replace('0.35', '0.15').replace('0.3', '0.12')}`,
            animation: 'nexPulse 1.8s ease-out 0.6s infinite',
            pointerEvents: 'none',
          }} />
        </>
      )}

      <canvas
        ref={canvasRef}
        style={{ borderRadius: '50%', display: 'block' }}
      />
    </button>
  )
}