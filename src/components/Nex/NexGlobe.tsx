import { useEffect, useRef } from 'react'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface Props {
  state: GlobeState
  size?: number
}

export default function NexGlobe({ state, size = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const frameRef  = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const c2d: CanvasRenderingContext2D = ctx

    const dpr = window.devicePixelRatio || 1
    canvas.width  = size * dpr
    canvas.height = size * dpr
    c2d.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const r  = size / 2 - 4

    const stateColors: Record<GlobeState, { core: string; mid: string; outer: string; glow: string }> = {
      idle:      { core: '#e9d5ff', mid: '#8b5cf6', outer: '#4c1d95', glow: 'rgba(139,92,246,0.5)' },
      listening: { core: '#e0f2fe', mid: '#38bdf8', outer: '#0c4a6e', glow: 'rgba(56,189,248,0.7)' },
      thinking:  { core: '#fce7f3', mid: '#f472b6', outer: '#831843', glow: 'rgba(244,114,182,0.7)' },
      speaking:  { core: '#d1fae5', mid: '#34d399', outer: '#064e3b', glow: 'rgba(52,211,153,0.7)' },
    }

    function draw() {
      frameRef.current++
      const f = frameRef.current
      const c = stateColors[state]
      c2d.clearRect(0, 0, size, size)

      // Outer glow ring
      const glowR = state === 'idle' ? r + 2 + Math.sin(f * 0.03) * 1.5
                  : state === 'listening' ? r + 3 + Math.sin(f * 0.08) * 3
                  : state === 'thinking'  ? r + 2 + Math.sin(f * 0.12) * 2
                  : r + 3 + Math.sin(f * 0.06) * 2.5

      const glowGrad = c2d.createRadialGradient(cx, cy, r - 2, cx, cy, glowR + 8)
      // Extract rgb values from glow color and build proper rgba strings
      const glowBase = c.glow.replace(/rgba?\(([^)]+)\).*/, '$1').split(',').slice(0, 3).join(',')
      glowGrad.addColorStop(0,   `rgba(${glowBase},0.3)`)
      glowGrad.addColorStop(0.5, `rgba(${glowBase},0.12)`)
      glowGrad.addColorStop(1,   'rgba(0,0,0,0)')
      c2d.beginPath()
      c2d.arc(cx, cy, glowR + 8, 0, Math.PI * 2)
      c2d.fillStyle = glowGrad
      c2d.fill()

      // Main sphere gradient
      const sphereGrad = c2d.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r)
      sphereGrad.addColorStop(0,   c.core)
      sphereGrad.addColorStop(0.4, c.mid)
      sphereGrad.addColorStop(1,   c.outer)
      c2d.beginPath()
      c2d.arc(cx, cy, r, 0, Math.PI * 2)
      c2d.fillStyle = sphereGrad
      c2d.fill()

      // Animated plasma wisps
      const numWisps = state === 'idle' ? 2 : state === 'listening' ? 4 : 3
      for (let i = 0; i < numWisps; i++) {
        const speed = state === 'idle' ? 0.008 : state === 'listening' ? 0.025 : 0.015
        const angle = (f * speed) + (i * Math.PI * 2 / numWisps)
        const wR    = r * (0.45 + 0.2 * Math.sin(f * 0.02 + i))
        const wx    = cx + Math.cos(angle) * wR * 0.6
        const wy    = cy + Math.sin(angle) * wR * 0.5
        const wSize = r * (0.18 + 0.08 * Math.sin(f * 0.04 + i * 1.3))
        const wGrad = c2d.createRadialGradient(wx, wy, 0, wx, wy, wSize)
        wGrad.addColorStop(0, c.mid + 'aa')
        wGrad.addColorStop(1, 'rgba(0,0,0,0)')
        c2d.beginPath()
        c2d.arc(wx, wy, wSize, 0, Math.PI * 2)
        c2d.fillStyle = wGrad
        c2d.fill()
      }

      // Specular highlight
      const hlGrad = c2d.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx - r * 0.2, cy - r * 0.2, r * 0.55)
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.45)')
      hlGrad.addColorStop(1, 'rgba(255,255,255,0)')
      c2d.beginPath()
      c2d.arc(cx, cy, r, 0, Math.PI * 2)
      c2d.fillStyle = hlGrad
      c2d.fill()

      // Listening equalizer bars
      if (state === 'listening') {
        c2d.save()
        c2d.globalAlpha = 0.7
        const bars = 5
        const bw   = r * 0.12
        const gap  = bw * 0.6
        const totalW = bars * bw + (bars - 1) * gap
        const startX = cx - totalW / 2
        for (let i = 0; i < bars; i++) {
          const bh = r * (0.3 + 0.5 * Math.abs(Math.sin(f * 0.15 + i * 0.8)))
          const bx = startX + i * (bw + gap)
          const by = cy - bh / 2
          c2d.fillStyle = '#e0f2fe'
          c2d.fillRect(bx, by, bw, bh)
        }
        c2d.restore()
      }

      // Thinking spinner
      if (state === 'thinking') {
        c2d.save()
        c2d.globalAlpha = 0.8
        const arcR = r * 0.55
        c2d.strokeStyle = '#fce7f3'
        c2d.lineWidth   = 2.5
        c2d.lineCap     = 'round'
        c2d.beginPath()
        const start = (f * 0.08) % (Math.PI * 2)
        c2d.arc(cx, cy, arcR, start, start + Math.PI * 1.2)
        c2d.stroke()
        c2d.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [state, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: `${size}px`, height: `${size}px`,
        display: 'block',
        borderRadius: '50%',
      }}
    />
  )
}
