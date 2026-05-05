import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sphere, Stars } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import * as THREE from 'three'
import Lenis from 'lenis'
import DemoBoard from '../components/DemoBoard'

// ─── 3D ───────────────────────────────────────────────────────
function GlowOrb({ position, color, speed = 1, distort = 0.5, scale = 1 }: {
  position: [number, number, number]
  color: string
  speed?: number
  distort?: number
  scale?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (!mesh.current) return
    mesh.current.rotation.x = s.clock.elapsedTime * speed * 0.25
    mesh.current.rotation.y = s.clock.elapsedTime * speed * 0.18
  })
  return (
    <Sphere ref={mesh} args={[scale, 64, 64]} position={position}>
      <MeshDistortMaterial color={color} distort={distort} speed={1.5}
        roughness={0} metalness={0.9} transparent opacity={1} />
    </Sphere>
  )
}

const PARTICLE_POSITIONS = (() => {
  const count = 400
  const arr = new Float32Array(count * 3)
  let seed = 12345
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647
    return (seed / 2147483647 - 0.5) * 30
  }
  for (let i = 0; i < count * 3; i++) arr[i] = rand()
  return arr
})()

function FloatParticles() {
  const pts = useRef<THREE.Points>(null)
  useFrame((s) => {
    if (pts.current) pts.current.rotation.y = s.clock.elapsedTime * 0.015
  })
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[PARTICLE_POSITIONS, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#8b5cf6" transparent opacity={0.7} />
    </points>
  )
}

function HeroCanvas({ mx, my }: { mx: number; my: number }) {
  const grp = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!grp.current) return
    grp.current.rotation.y += (mx * 0.15 - grp.current.rotation.y) * 0.03
    grp.current.rotation.x += (-my * 0.08 - grp.current.rotation.x) * 0.03
  })
  return (
    <group ref={grp}>
      <ambientLight intensity={0.4} />
      <pointLight position={[8, 8, 8]} intensity={6} color="#8b5cf6" />
      <pointLight position={[-8, -8, -4]} intensity={3} color="#ec4899" />
      <Stars radius={80} depth={50} count={2000} factor={5} saturation={0} fade speed={0.2} />
      <FloatParticles />
      <GlowOrb position={[-3.5, 0.8, -2]} color="#8b5cf6" speed={0.6} distort={0.6} scale={1.2} />
      <GlowOrb position={[3.5, -0.8, -3]} color="#ec4899" speed={0.9} distort={0.4} scale={0.9} />
      <GlowOrb position={[0.5, 2, -5]} color="#06b6d4" speed={0.4} distort={0.7} scale={0.7} />
      <mesh>
        <torusGeometry args={[4, 0.015, 16, 100]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={1.2} transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[0.5, 0, 0.3]}>
        <torusGeometry args={[6, 0.012, 16, 100]} />
        <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={1.2} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

// ─── LIQUID CURSOR ────────────────────────────────────────────
function MagneticCursor() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 800, damping: 35 })
  const sy = useSpring(y, { stiffness: 800, damping: 35 })
  const bx = useSpring(x, { stiffness: 80, damping: 15 })
  const by = useSpring(y, { stiffness: 80, damping: 15 })
  const [hovered, setHovered] = useState(false)
  const [vel, setVel] = useState({ x: 0, y: 0 })
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const vx = e.clientX - lastPos.current.x
      const vy = e.clientY - lastPos.current.y
      setVel({ x: vx, y: vy })
      lastPos.current = { x: e.clientX, y: e.clientY }
      x.set(e.clientX)
      y.set(e.clientY)
    }
    const over = (e: MouseEvent) => {
      setHovered(!!(e.target as HTMLElement).closest('button, a'))
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseover', over)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
    }
  }, [x, y])

  const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2)
  const stretch = Math.min(speed * 0.04, 0.5)
  const angle = Math.atan2(vel.y, vel.x) * (180 / Math.PI)
  const blobSize = hovered ? 64 : 20

  return (
    <>
      <motion.div style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9999, x: useTransform(bx, v => v - blobSize / 2), y: useTransform(by, v => v - blobSize / 2) }}>
        <motion.div
          animate={{
            width: blobSize + speed * 0.8, height: blobSize,
            rotate: angle,
            borderRadius: hovered ? '8px' : '50%',
            background: hovered ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.5)',
            border: hovered ? '1px solid rgba(139,92,246,0.6)' : '1px solid transparent',
            scaleX: 1 + stretch, scaleY: 1 - stretch * 0.5,
            boxShadow: `0 0 ${hovered ? 20 : 10}px rgba(139,92,246,0.4)`,
          }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{ borderRadius: '50%' }}
        />
      </motion.div>
      <motion.div style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 9999,
        x: useTransform(sx, v => v - 2), y: useTransform(sy, v => v - 2),
        width: 4, height: 4, borderRadius: '50%',
        background: 'white', mixBlendMode: 'difference',
      }} />
    </>
  )
}

function NoiseOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2, opacity: 0.025,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  )
}

function Reveal({ text, delay = 0, style }: { text: string; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <div ref={ref} style={style}>
      {text.split(' ').map((word, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', marginRight: '0.22em', verticalAlign: 'bottom' }}>
          <motion.span
            initial={{ y: '115%', opacity: 0 }}
            animate={inView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: delay + i * 0.08 }}
            style={{ display: 'inline-block' }}
          >{word}</motion.span>
        </span>
      ))}
    </div>
  )
}

function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    let v = 0
    const step = (end / 1800) * 16
    const t = setInterval(() => {
      v += step
      if (v >= end) { setN(end); clearInterval(t) }
      else setN(Math.floor(v))
    }, 16)
    return () => clearInterval(t)
  }, [inView, end])
  return <span ref={ref}>{n}{suffix}</span>
}

// ─── FEATURES ─────────────────────────────────────────────────
const FEATURES = [
  {
    n: '01',
    icon: '⚡',
    title: 'Flow — Execution Timeline',
    desc: 'See every feature branch off the project trunk in real time. Done tasks merge back in. Your team\'s progress is a living map, not a spreadsheet.',
    color: '#8b5cf6',
  },
  {
    n: '02',
    icon: '🎯',
    title: 'Daily Standup Mode',
    desc: 'One click. Fullscreen slides for each team member — active tasks, blockers, what\'s next. Run your standup in 3 minutes, not 30.',
    color: '#06b6d4',
  },
  {
    n: '03',
    icon: '🤖',
    title: 'Nex AI Assistant',
    desc: 'Voice or text. Ask Nex to create tasks, summarize blockers, prioritize your sprint, or generate a project brief. It knows your workspace.',
    color: '#ec4899',
  },
  {
    n: '04',
    icon: '📋',
    title: 'Kanban Board',
    desc: 'Physics-based drag and drop. TO DO → IN PROGRESS → IN REVIEW → DONE. Real-time sync so your whole team sees every move instantly.',
    color: '#10b981',
  },
  {
    n: '05',
    icon: '⏱️',
    title: 'Focus Timer',
    desc: 'Deep work, short break, long break. A circular focus ring tracks your session. Beats mode plays ambient sound. Ship more in less time.',
    color: '#f59e0b',
  },
  {
    n: '06',
    icon: '🗓️',
    title: 'Calendar + Manual Events',
    desc: 'Task due dates, meetings, client calls, team standups — all in one view. Month summary shows exactly what\'s overdue and what\'s shipping.',
    color: '#a78bfa',
  },
  {
    n: '07',
    icon: '📊',
    title: 'Project Dashboard',
    desc: 'Health, progress, team activity, phase timeline, and links in one view. Drag to reorder phases. One click to mark a phase complete.',
    color: '#34d399',
  },
  {
    n: '08',
    icon: '👥',
    title: 'Team Workspaces',
    desc: 'Invite teammates by email. Assign roles. Each workspace is fully isolated with row-level security. Your data stays yours — mathematically.',
    color: '#ef4444',
  },
]

// ─── TECH LOGOS ───────────────────────────────────────────────
const TECH = [
  { name: 'Supabase', color: '#3ecf8e', desc: 'Database & Auth' },
  { name: 'Anthropic', color: '#d4a574', desc: 'AI Engine' },
  { name: 'Vercel', color: '#ffffff', desc: 'Deployment' },
  { name: 'React', color: '#61dafb', desc: 'Frontend' },
  { name: 'Three.js', color: '#8b5cf6', desc: '3D Graphics' },
  { name: 'Framer', color: '#ec4899', desc: 'Motion' },
]

// ─── FLOW DEMO SVG ────────────────────────────────────────────
function FlowDemo() {
  const features = [
    { name: 'Design UI', color: '#7c3aed', progress: 100, merged: true, y: -90 },
    { name: 'Auth & Users', color: '#2563eb', progress: 100, merged: true, y: 90 },
    { name: 'Flow Engine', color: '#059669', progress: 60, merged: false, y: -90 },
    { name: 'Dashboard', color: '#d97706', progress: 35, merged: false, y: 90 },
  ]
  const trunk = { start: 40, current: 260, end: 620 }
  const phases = [
    { x: 100, label: 'Kickoff', done: true },
    { x: 260, label: 'Designing', current: true },
    { x: 450, label: 'Phase 1', done: false },
    { x: 600, label: 'Review', done: false },
  ]

  return (
    <svg viewBox="0 0 660 280" style={{ width: '100%', maxWidth: '660px', margin: '0 auto', display: 'block' }}>
      <defs>
        {features.map(f => (
          <linearGradient key={f.name} id={`fl-${f.name.replace(/\s/g,'-')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={f.color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={f.color} stopOpacity="0.4" />
          </linearGradient>
        ))}
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Trunk glow */}
      <line x1={trunk.start} y1={140} x2={trunk.end} y2={140} stroke="#7c3aed" strokeWidth={28} strokeOpacity={0.07} strokeLinecap="round" />
      {/* Trunk done */}
      <line x1={trunk.start} y1={140} x2={trunk.current} y2={140} stroke="#4ade80" strokeWidth={3} strokeLinecap="round" />
      {/* Trunk future */}
      <line x1={trunk.current} y1={140} x2={trunk.end} y2={140} stroke="rgba(255,255,255,0.15)" strokeWidth={3} strokeLinecap="round" strokeDasharray="6 4" />
      {/* Arrow */}
      <polygon points={`${trunk.end+12},${140} ${trunk.end},${133} ${trunk.end},${147}`} fill="rgba(255,255,255,0.35)" />

      {/* Phase nodes */}
      {phases.map(p => (
        <g key={p.label}>
          <circle cx={p.x} cy={140} r={p.current ? 18 : 13}
            fill={p.done ? '#16a34a' : p.current ? '#7c3aed' : 'rgba(20,10,40,0.95)'}
            stroke={p.done ? '#16a34a' : p.current ? '#a78bfa' : 'rgba(255,255,255,0.15)'}
            strokeWidth={2} filter={p.current ? 'url(#glow)' : undefined} />
          <text x={p.x} y={145} textAnchor="middle" fill={p.done || p.current ? 'white' : 'rgba(255,255,255,0.3)'}
            fontSize={p.done ? 11 : p.current ? 13 : 9} fontWeight="bold">
            {p.done ? '✓' : p.current ? '⚡' : '○'}
          </text>
          <text x={p.x} y={p.current ? 170 : 163} textAnchor="middle"
            fill={p.current ? '#a78bfa' : p.done ? '#4ade80' : 'rgba(255,255,255,0.35)'}
            fontSize={10} fontWeight={p.current ? 700 : 400} fontFamily="Inter, sans-serif">
            {p.label}
          </text>
        </g>
      ))}

      {/* Feature branches */}
      {features.map((f, i) => {
        const forkX  = i < 2 ? 180 : 310
        const endX   = f.merged ? forkX + 110 : 580
        const midX   = forkX + (endX - forkX) * 0.5
        const branchY = 140 + f.y
        const chipW  = 130

        return (
          <g key={f.name}>
            {/* Branch curve out */}
            <path
              d={`M ${forkX} 140 C ${forkX + 40} 140, ${forkX + 50} ${branchY}, ${forkX + 70} ${branchY}`}
              fill="none" stroke={f.color} strokeWidth={1.5} strokeOpacity={0.6}
            />
            {/* Branch line */}
            {!f.merged ? (
              <line x1={forkX + 70} y1={branchY} x2={endX - 20} y2={branchY}
                stroke={`url(#fl-${f.name.replace(/\s/g,'-')})`} strokeWidth={1.5} />
            ) : (
              <>
                <line x1={forkX + 70} y1={branchY} x2={endX - 40} y2={branchY}
                  stroke={f.color} strokeWidth={1.5} strokeOpacity={0.6} />
                {/* Merge curve back */}
                <path
                  d={`M ${endX - 40} ${branchY} C ${endX} ${branchY}, ${endX} 140, ${endX + 20} 140`}
                  fill="none" stroke={f.color} strokeWidth={1.5} strokeOpacity={0.6}
                />
              </>
            )}

            {/* Feature chip */}
            <rect x={midX - chipW/2} y={branchY - 22} width={chipW} height={38} rx={8}
              fill={f.merged ? `${f.color}22` : `${f.color}14`}
              stroke={f.color} strokeWidth={1} strokeOpacity={f.merged ? 0.7 : 0.4} />
            {/* Feature name */}
            <text x={midX - chipW/2 + 8} y={branchY - 5} fill="white" fontSize={9.5} fontWeight={600} fontFamily="Inter, sans-serif">{f.name}</text>
            {/* Progress bar bg */}
            <rect x={midX - chipW/2 + 8} y={branchY + 4} width={chipW - 52} height={3} rx={1.5} fill="rgba(255,255,255,0.1)" />
            {/* Progress bar fill */}
            <rect x={midX - chipW/2 + 8} y={branchY + 4} width={(chipW - 52) * f.progress / 100} height={3} rx={1.5} fill={f.color} />
            {/* % label */}
            <text x={midX + chipW/2 - 26} y={branchY + 8} fill={f.color} fontSize={9} fontWeight={700} fontFamily="Inter, sans-serif">
              {f.progress}%
            </text>
            {/* MERGED badge */}
            {f.merged && (
              <>
                <rect x={midX + chipW/2 - 54} y={branchY - 20} width={44} height={14} rx={4} fill={`${f.color}33`} />
                <text x={midX + chipW/2 - 32} y={branchY - 9} textAnchor="middle" fill={f.color} fontSize={7.5} fontWeight={700} fontFamily="Inter, sans-serif">MERGED</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()
  const [mx, setMx] = useState(0)
  const [my, setMy] = useState(0)
  const [activeF, setActiveF] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const productRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress: pScroll } = useScroll({ target: productRef, offset: ['start end', 'center center'] })
  const pRx    = useTransform(pScroll, [0, 1], [isMobile ? 8 : 18, 0])
  const pRy    = useTransform(pScroll, [0, 1], [isMobile ? -3 : -6, 0])
  const pScale = useTransform(pScroll, [0, 1], [0.88, 1])
  const pY     = useTransform(pScroll, [0, 1], [60, 0])

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.6, easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    const raf = (t: number) => { lenis.raf(t); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      setMx((e.clientX / window.innerWidth - 0.5) * 2)
      setMy((e.clientY / window.innerHeight - 0.5) * 2)
    }
    window.addEventListener('mousemove', fn)
    return () => window.removeEventListener('mousemove', fn)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setActiveF(p => (p + 1) % FEATURES.length), 3500)
    return () => clearInterval(t)
  }, [])

  const pad = isMobile ? '0 20px' : '0 48px'

  return (
    <div style={{ background: '#000', color: '#fff', overflowX: 'hidden', cursor: isMobile ? 'auto' : 'none' }}>
      {!isMobile && <MagneticCursor />}
      <NoiseOverlay />

      {/* ── NAV ── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.7 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: isMobile ? '14px 20px' : '20px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: 'white' }}>N</div>
          <span style={{ fontWeight: 700, fontSize: isMobile ? '14px' : '15px', fontFamily: 'Space Grotesk', letterSpacing: '-0.02em' }}>
            NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isMobile && (
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/auth')}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 20px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
              Sign in
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/auth')}
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '8px', padding: isMobile ? '8px 16px' : '8px 22px', color: 'white', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, boxShadow: '0 0 16px rgba(139,92,246,0.3)' }}>
            Start free →
          </motion.button>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section style={{ position: 'relative', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas camera={{ position: [0, 0, 9], fov: 52 }}>
            <HeroCanvas mx={mx} my={my} />
          </Canvas>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.97) 100%)' }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: isMobile ? '0 20px' : '0 24px', maxWidth: '960px', width: '100%' }}>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '999px', padding: '5px 14px', marginBottom: '28px' }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf6' }} />
            <span style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600, letterSpacing: '0.04em' }}>
              Project management reimagined
            </span>
          </motion.div>

          {/* Main headline */}
          {['See your team\'s', 'work move.'].map((line, idx) => (
            <div key={idx} style={{ overflow: 'hidden', marginBottom: idx === 0 ? '4px' : isMobile ? '24px' : '36px' }}>
              <motion.h1
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.5 + idx * 0.15 }}
                style={{
                  fontSize: isMobile ? 'clamp(48px, 14vw, 68px)' : 'clamp(64px, 9vw, 120px)',
                  fontWeight: 900, fontFamily: 'Space Grotesk',
                  letterSpacing: '-0.055em', lineHeight: 0.92, margin: 0,
                  background: idx === 1 ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'none',
                  color: idx === 0 ? 'white' : 'transparent',
                  WebkitBackgroundClip: idx === 1 ? 'text' : 'unset',
                  WebkitTextFillColor: idx === 1 ? 'transparent' : 'unset',
                }}
              >{line}</motion.h1>
            </div>
          ))}

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.8 }}
            style={{ color: 'rgba(255,255,255,0.55)', fontSize: isMobile ? '14px' : 'clamp(14px, 1.5vw, 17px)', fontFamily: 'Space Grotesk', lineHeight: 1.75, maxWidth: '500px', margin: '0 auto', marginBottom: isMobile ? '32px' : '44px' }}
          >
            NexTask turns your Kanban board into a live execution map. Watch features branch, tasks progress, and work merge — in real time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '20px' }}
          >
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => navigate('/auth')}
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '12px', padding: isMobile ? '13px 28px' : '15px 40px', color: 'white', cursor: 'pointer', fontSize: isMobile ? '14px' : '15px', fontFamily: 'Space Grotesk', fontWeight: 700, boxShadow: '0 0 32px rgba(139,92,246,0.4)' }}>
              Start free — no card needed →
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => flowRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: isMobile ? '13px 28px' : '15px 40px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: isMobile ? '14px' : '15px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
              See how Flow works ↓
            </motion.button>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
            Free forever · No credit card · Works in your browser
          </motion.p>
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '220px', background: 'linear-gradient(to bottom, transparent, #000)', zIndex: 5 }} />
      </section>

      {/* ── BUILT WITH ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.012)', padding: isMobile ? '16px 20px' : '20px 48px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: isMobile ? '20px' : '48px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.2em', flexShrink: 0 }}>BUILT WITH</span>
          {TECH.map((t, i) => (
            <motion.div key={t.name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: t.color, opacity: 0.7 }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{t.name}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── MARQUEE ── */}
      <div style={{ overflow: 'hidden', padding: '12px 0', background: 'rgba(255,255,255,0.008)' }}>
        <motion.div
          animate={{ x: [0, -3200] }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', gap: '56px', whiteSpace: 'nowrap', width: 'max-content' }}
        >
          {Array(6).fill([
            'FLOW TIMELINE', '✦', 'STANDUP MODE', '✦', 'NEX AI ASSISTANT', '✦',
            'KANBAN BOARD', '✦', 'FOCUS TIMER', '✦', 'CALENDAR EVENTS', '✦',
            'PROJECT DASHBOARD', '✦', 'REAL-TIME SYNC', '✦', 'TEAM WORKSPACES', '✦',
          ]).flat().map((t, i) => (
            <span key={i} style={{ color: i % 2 === 1 ? '#8b5cf6' : 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em' }}>{t}</span>
          ))}
        </motion.div>
      </div>

      {/* ── FLOW SECTION ── */}
      <section ref={flowRef} style={{ padding: isMobile ? '80px 0 60px' : '140px 0 100px', position: 'relative', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: pad }}>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>01 — FLOW</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '48px' : '80px', alignItems: 'center' }}>
            <div>
              <Reveal text="Your project. Live. As a timeline." style={{ fontSize: isMobile ? 'clamp(28px, 7vw, 40px)' : 'clamp(32px, 4vw, 56px)', fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '-0.04em', lineHeight: 1.05, color: 'white', marginBottom: '20px' }} />
              <motion.p initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
                style={{ color: 'rgba(255,255,255,0.55)', fontSize: isMobile ? '14px' : '16px', fontFamily: 'Space Grotesk', lineHeight: 1.8, marginBottom: '24px' }}>
                Every feature branches off the project trunk. Tasks become nodes. When a feature ships, it merges back in — like Git, but for your whole team's execution.
              </motion.p>
              {[
                { icon: '⚡', text: 'See which features are ahead, on track, or at risk — at a glance' },
                { icon: '🔀', text: 'Completed features merge back into the trunk automatically' },
                { icon: '🎯', text: 'One-click Standup Mode — run daily standups in under 5 minutes' },
              ].map((b, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + i * 0.08 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{b.icon}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontFamily: 'Space Grotesk', lineHeight: 1.6 }}>{b.text}</span>
                </motion.div>
              ))}
              <motion.button
                initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => navigate('/auth')}
                style={{ marginTop: '20px', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: '10px', padding: '11px 24px', color: '#a78bfa', cursor: 'pointer', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                See Flow in action →
              </motion.button>
            </div>

            {/* Flow SVG Demo */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: isMobile ? '20px 12px' : '32px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 8px #7c3aed' }} />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em' }}>NEXTASK / LAUNCH — LIVE</span>
              </div>
              <FlowDemo />
              <div style={{ display: 'flex', gap: '16px', marginTop: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { dot: '#4ade80', label: 'Done' },
                  { dot: '#a78bfa', label: 'Active' },
                  { dot: 'rgba(255,255,255,0.2)', label: 'Planned' },
                  { dot: '#7c3aed', label: 'Merged' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: l.dot }} />
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Grotesk' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── PRODUCT DEMO ── */}
      <section ref={productRef} style={{ padding: isMobile ? '60px 0 80px' : '100px 0 160px', position: 'relative', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: pad }}>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>02 — BOARD</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <Reveal text="The Kanban board that actually helps." style={{ fontSize: isMobile ? 'clamp(26px, 7vw, 38px)' : 'clamp(30px, 4vw, 56px)', fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '-0.04em', lineHeight: 1.05, color: 'white', marginBottom: '12px' }} />

          <motion.p initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? '14px' : '16px', fontFamily: 'Space Grotesk', maxWidth: '480px', marginBottom: isMobile ? '36px' : '60px', lineHeight: 1.75 }}>
            Drag tasks across columns. Updates sync instantly across every browser tab. AI writes descriptions. Nex answers questions about your work.
          </motion.p>

          {/* Browser mockup */}
          <motion.div style={{ rotateX: pRx, rotateY: pRy, scale: pScale, y: pY, transformPerspective: 1400, transformStyle: 'preserve-3d', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '-1px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(236,72,153,0.25), rgba(6,182,212,0.15))', filter: 'blur(0.5px)', zIndex: -1 }} />
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 60px rgba(139,92,246,0.08)' }}>
              <div style={{ background: '#111', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                    <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.85 }} />
                  ))}
                </div>
                {!isMobile && (
                  <div style={{ flex: 1, maxWidth: '280px', margin: '0 auto', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '5px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '9px', color: '#10b981' }}>🔒</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono' }}>nextask.live/app</span>
                  </div>
                )}
              </div>
              <div style={{ height: isMobile ? '320px' : '520px' }}>
                <DemoBoard />
              </div>
            </div>
          </motion.div>

          {/* Capability pills */}
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            style={{ display: 'flex', gap: '8px', marginTop: '28px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: 'Flow timeline', color: '#8b5cf6' },
              { label: 'Standup mode', color: '#06b6d4' },
              { label: 'Nex AI', color: '#ec4899' },
              { label: 'Focus timer', color: '#f59e0b' },
              { label: 'Calendar events', color: '#a78bfa' },
              { label: 'Real-time sync', color: '#10b981' },
              { label: 'Google auth', color: '#34d399' },
              { label: 'Row-level security', color: '#ef4444' },
            ].map((p, i) => (
              <motion.div key={p.label} initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: `${p.color}0d`, border: `1px solid ${p.color}30`, borderRadius: '999px', padding: '5px 12px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: p.color }} />
                <span style={{ color: p.color, fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{p.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section style={{ padding: isMobile ? '80px 0' : '120px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: pad }}>

          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ marginBottom: isMobile ? '40px' : '72px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>03 — EVERYTHING</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '32px' : '72px', alignItems: 'start' }}>
            <div>
              <Reveal text="Eight tools. One workspace." style={{ fontSize: isMobile ? 'clamp(24px, 6vw, 36px)' : 'clamp(28px, 3.5vw, 48px)', fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '-0.03em', lineHeight: 1.1, color: 'white', marginBottom: isMobile ? '24px' : '40px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {FEATURES.map((f, i) => (
                  <motion.div key={f.n} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                    onMouseEnter={() => !isMobile && setActiveF(i)}
                    onClick={() => setActiveF(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '11px 14px', borderRadius: '10px', cursor: 'pointer', background: activeF === i ? `${f.color}0a` : 'transparent', border: `1px solid ${activeF === i ? f.color + '22' : 'transparent'}`, transition: 'all 0.2s' }}>
                    <span style={{ color: activeF === i ? f.color : 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono', flexShrink: 0 }}>{f.n}</span>
                    <span style={{ fontSize: '15px', flexShrink: 0, filter: activeF === i ? 'none' : 'grayscale(1) opacity(0.4)' }}>{f.icon}</span>
                    <span style={{ color: activeF === i ? 'white' : 'rgba(255,255,255,0.45)', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{f.title}</span>
                    {activeF === i && <motion.span layoutId="arr" style={{ marginLeft: 'auto', color: f.color, fontSize: '14px' }}>→</motion.span>}
                  </motion.div>
                ))}
              </div>
            </div>

            {!isMobile && (
              <div style={{ position: 'sticky', top: '120px' }}>
                <AnimatePresence mode="wait">
                  <motion.div key={activeF}
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.97 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    style={{ background: `${FEATURES[activeF].color}07`, border: `1px solid ${FEATURES[activeF].color}18`, borderRadius: '24px', padding: '44px', minHeight: '360px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${FEATURES[activeF].color}60, transparent)` }} />
                    <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%', background: `radial-gradient(circle, ${FEATURES[activeF].color}15 0%, transparent 70%)` }} />
                    <div>
                      <div style={{ fontSize: '44px', marginBottom: '18px' }}>{FEATURES[activeF].icon}</div>
                      <div style={{ color: FEATURES[activeF].color, fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em', marginBottom: '10px' }}>FEATURE {FEATURES[activeF].n}</div>
                      <h3 style={{ color: 'white', fontSize: '24px', fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '-0.02em', marginBottom: '12px', lineHeight: 1.2 }}>{FEATURES[activeF].title}</h3>
                      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', fontFamily: 'Space Grotesk', lineHeight: 1.8 }}>{FEATURES[activeF].desc}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', marginTop: '24px' }}>
                      {FEATURES.map((_, i) => (
                        <motion.div key={i}
                          animate={{ width: i === activeF ? 26 : 5, background: i === activeF ? FEATURES[activeF].color : 'rgba(255,255,255,0.12)' }}
                          style={{ height: '3px', borderRadius: '999px', cursor: 'pointer' }}
                          onClick={() => setActiveF(i)}
                        />
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section style={{ padding: isMobile ? '80px 0' : '120px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: pad }}>
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ marginBottom: isMobile ? '40px' : '64px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>04 — WHO IT'S FOR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <Reveal text="Built for people who ship." style={{ fontSize: isMobile ? 'clamp(26px, 7vw, 38px)' : 'clamp(30px, 4vw, 52px)', fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '-0.04em', lineHeight: 1.05, color: 'white', marginBottom: isMobile ? '36px' : '56px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              {
                icon: '👨‍💻',
                title: 'Dev teams',
                color: '#8b5cf6',
                points: [
                  'Track features from todo to merged',
                  'Run standups in 3 minutes with Standup Mode',
                  'Nex AI knows your sprint context',
                  'Flow shows exactly what\'s blocking the release',
                ],
              },
              {
                icon: '🎓',
                title: 'Student teams',
                color: '#06b6d4',
                points: [
                  'Project deliverables mapped to phases',
                  'Assign tasks to teammates by email',
                  'Due date calendar keeps the group honest',
                  'Free forever — no credit card, ever',
                ],
              },
              {
                icon: '⚡',
                title: 'Solo builders',
                color: '#ec4899',
                points: [
                  'Personal board separate from team projects',
                  'Focus timer with ambient beats mode',
                  'Nex writes task descriptions for you',
                  'Today view shows exactly what\'s urgent',
                ],
              },
            ].map((card, i) => (
              <motion.div key={card.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ background: `${card.color}07`, border: `1px solid ${card.color}18`, borderRadius: '16px', padding: isMobile ? '24px' : '32px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${card.color}50, transparent)` }} />
                <div style={{ fontSize: '32px', marginBottom: '14px' }}>{card.icon}</div>
                <h3 style={{ color: 'white', fontSize: '18px', fontWeight: 700, fontFamily: 'Space Grotesk', marginBottom: '18px', letterSpacing: '-0.02em' }}>{card.title}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {card.points.map((p, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: card.color, marginTop: '7px', flexShrink: 0 }} />
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontFamily: 'Space Grotesk', lineHeight: 1.6 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ padding: isMobile ? '80px 20px' : '120px 48px', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '300px', background: 'radial-gradient(ellipse, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: isMobile ? '48px' : '80px' }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>05 — BY THE NUMBERS</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: isMobile ? '32px 20px' : '40px' }}>
            {[
              { end: 8, suffix: '+', label: 'Integrated features', sub: 'Flow, Board, Timer, AI…', color: '#8b5cf6' },
              { end: 100, suffix: '%', label: 'Free to start', sub: 'No card. No trial. No catch.', color: '#10b981' },
              { end: 5, suffix: 'min', label: 'Daily standup', sub: 'With Standup Mode', color: '#06b6d4' },
              { end: 0, suffix: 'ms', label: 'Setup time', sub: 'Sign in and start', color: '#ec4899' },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                style={{ textAlign: 'center' }}>
                <div style={{ fontSize: isMobile ? '44px' : 'clamp(44px,5vw,68px)', fontWeight: 800, fontFamily: 'Space Mono', color: s.color, letterSpacing: '-0.04em', textShadow: `0 0 40px ${s.color}40`, lineHeight: 1, marginBottom: '6px' }}>
                  <CountUp end={s.end} suffix={s.suffix} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600, marginBottom: '4px' }}>{s.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Space Grotesk' }}>{s.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ minHeight: isMobile ? '80vh' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
          <Canvas camera={{ position: [0, 0, 7], fov: 58 }}>
            <ambientLight intensity={0.2} />
            <pointLight position={[4, 4, 4]} color="#8b5cf6" intensity={3} />
            <pointLight position={[-4, -4, -4]} color="#ec4899" intensity={2} />
            <GlowOrb position={[0, 0, 0]} color="#8b5cf6" speed={0.4} distort={0.9} scale={1.5} />
            <mesh>
              <torusGeometry args={[3.5, 0.015, 16, 100]} />
              <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.8} transparent opacity={0.4} />
            </mesh>
            <mesh rotation={[0.5, 0, 0]}>
              <torusGeometry args={[5.5, 0.012, 16, 100]} />
              <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.8} transparent opacity={0.3} />
            </mesh>
          </Canvas>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.93) 65%)' }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: isMobile ? '60px 20px' : '0 24px', maxWidth: '800px' }}>
          <motion.span initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em', display: 'block', marginBottom: '24px' }}>
            06 — START NOW
          </motion.span>

          <Reveal text="Stop managing. Start shipping." style={{ fontSize: isMobile ? 'clamp(28px, 8vw, 44px)' : 'clamp(36px,6vw,80px)', fontWeight: 900, fontFamily: 'Space Grotesk', letterSpacing: '-0.04em', lineHeight: 1.05, color: 'white', marginBottom: '16px' }} />

          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: isMobile ? '14px' : '16px', fontFamily: 'Space Grotesk', maxWidth: '400px', margin: '0 auto 36px', lineHeight: 1.75 }}>
            Sign in with Google. Your board is ready in 10 seconds. No setup. No onboarding call. Just start.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => navigate('/auth')}
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '14px', padding: isMobile ? '16px 36px' : '18px 52px', color: 'white', cursor: 'pointer', fontSize: isMobile ? '15px' : '16px', fontFamily: 'Space Grotesk', fontWeight: 700, boxShadow: '0 0 48px rgba(139,92,246,0.4)' }}>
              Start free — takes 10 seconds →
            </motion.button>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
              No credit card · Free forever · Works on any device
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: isMobile ? '24px 20px' : '32px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: 'white' }}>N</div>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>NexTask</span>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '12px' }}>·</span>
          <a href="https://github.com/Bhargav-Sarvepalli/kanban-board" target="_blank" rel="noreferrer"
            style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', fontFamily: 'Space Grotesk', textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)' }}>
            GitHub
          </a>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '12px' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px', fontFamily: 'Space Grotesk' }}>Built by Bhargav Sarvepalli</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'Space Mono' }}>© 2026 NEXTASK</span>
        </div>
      </footer>
    </div>
  )
}