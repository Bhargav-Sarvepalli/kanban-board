import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { MeshDistortMaterial, Sphere, Stars } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring } from 'framer-motion'
import * as THREE from 'three'
import Lenis from 'lenis'
import DemoBoard from '../components/DemoBoard'

// ─── 3D ───────────────────────────────────────────────────────
function GlowOrb({ position, color, speed = 1, distort = 0.5, scale = 1 }: {
  position: [number, number, number]; color: string; speed?: number; distort?: number; scale?: number
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
  const count = 500; const arr = new Float32Array(count * 3); let seed = 99991
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 28 }
  for (let i = 0; i < count * 3; i++) arr[i] = rand()
  return arr
})()

function Particles() {
  const ref = useRef<THREE.Points>(null)
  useFrame(s => { if (ref.current) ref.current.rotation.y = s.clock.elapsedTime * 0.012 })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[PARTICLE_POSITIONS, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color="#8b5cf6" transparent opacity={0.4} />
    </points>
  )
}

function HeroScene({ mx, my }: { mx: number; my: number }) {
  const grp = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!grp.current) return
    grp.current.rotation.y += (mx * 0.1 - grp.current.rotation.y) * 0.025
    grp.current.rotation.x += (-my * 0.06 - grp.current.rotation.x) * 0.025
  })
  return (
    <group ref={grp}>
      <ambientLight intensity={0.25} />
      <pointLight position={[10, 8, 6]} intensity={5} color="#7c3aed" />
      <pointLight position={[-8, -6, -4]} intensity={2.5} color="#db2777" />
      <Stars radius={90} depth={60} count={1800} factor={4} saturation={0} fade speed={0.1} />
      <Particles />
      <GlowOrb position={[-3.2, 1.0, -2.5]} color="#7c3aed" speed={0.55} distort={0.65} scale={1.1} />
      <GlowOrb position={[3.2, -1.0, -3.5]} color="#db2777" speed={0.8}  distort={0.45} scale={0.85} />
      <GlowOrb position={[0.6,  2.2, -5.5]} color="#06b6d4" speed={0.35} distort={0.75} scale={0.55} />
      <mesh>
        <torusGeometry args={[4.2, 0.011, 16, 120]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={1.1} transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[0.55, 0, 0.3]}>
        <torusGeometry args={[6.2, 0.009, 16, 120]} />
        <meshStandardMaterial color="#db2777" emissive="#db2777" emissiveIntensity={1.1} transparent opacity={0.28} />
      </mesh>
    </group>
  )
}

// ─── CURSOR ───────────────────────────────────────────────────
function Cursor() {
  const x = useMotionValue(-200); const y = useMotionValue(-200)
  const sx = useSpring(x, { stiffness: 900, damping: 38 }); const sy = useSpring(y, { stiffness: 900, damping: 38 })
  const bx = useSpring(x, { stiffness: 75,  damping: 14  }); const by = useSpring(y, { stiffness: 75,  damping: 14  })
  const [hov, setHov] = useState(false)
  const [vel, setVel] = useState({ x: 0, y: 0 }); const last = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setVel({ x: e.clientX - last.current.x, y: e.clientY - last.current.y })
      last.current = { x: e.clientX, y: e.clientY }
      x.set(e.clientX); y.set(e.clientY)
    }
    const onOver = (e: MouseEvent) => setHov(!!(e.target as HTMLElement).closest('button,a'))
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseover', onOver) }
  }, [x, y])
  const spd = Math.hypot(vel.x, vel.y)
  const str = Math.min(spd * 0.035, 0.45)
  const ang = Math.atan2(vel.y, vel.x) * (180 / Math.PI)
  const sz  = hov ? 52 : 16
  return (
    <>
      <motion.div style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9999, x: useTransform(bx, v => v - sz / 2), y: useTransform(by, v => v - sz / 2) }}>
        <motion.div animate={{ width: sz + spd * 0.5, height: sz, rotate: ang, borderRadius: hov ? '7px' : '50%', background: hov ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.4)', border: hov ? '1px solid rgba(124,58,237,0.45)' : 'none', scaleX: 1 + str, scaleY: 1 - str * 0.45, boxShadow: `0 0 ${hov ? 16 : 7}px rgba(124,58,237,0.3)` }} transition={{ duration: 0.1, ease: 'easeOut' }} style={{ borderRadius: '50%' }} />
      </motion.div>
      <motion.div style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9999, x: useTransform(sx, v => v - 2), y: useTransform(sy, v => v - 2), width: 4, height: 4, borderRadius: '50%', background: 'white', mixBlendMode: 'difference' }} />
    </>
  )
}

// ─── UTILITIES ────────────────────────────────────────────────
function Noise() {
  return <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2, opacity: 0.018, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
}

function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-32px' })
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 18 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }} style={style}>
      {children}
    </motion.div>
  )
}

function Reveal({ children, delay = 0, style }: { children: string; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-32px' })
  return (
    <div ref={ref} style={style}>
      {children.split(' ').map((w, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', marginRight: '0.18em', verticalAlign: 'bottom' }}>
          <motion.span initial={{ y: '105%' }} animate={inView ? { y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: delay + i * 0.065 }}
            style={{ display: 'inline-block' }}>{w}</motion.span>
        </span>
      ))}
    </div>
  )
}

// ─── FLOW SVG ─────────────────────────────────────────────────
function FlowSVG() {
  const PHASE_COLORS = ['#4ade80', '#7c3aed', '#2563eb', '#d97706', '#dc2626']
  const phases = [
    { x: 70,  label: 'Kickoff',   done: true,  active: false },
    { x: 230, label: 'Designing', done: false,  active: true  },
    { x: 410, label: 'Phase 1',   done: false,  active: false },
    { x: 560, label: 'Review',    done: false,  active: false },
  ]
  const branches = [
    { name: 'Auth & Login',   color: PHASE_COLORS[0], pct: 100, merged: true,  above: true,  forkX: 160, endX: 300 },
    { name: 'Kanban Board',   color: PHASE_COLORS[0], pct: 100, merged: true,  above: false, forkX: 160, endX: 300 },
    { name: 'Flow Engine',    color: PHASE_COLORS[1], pct: 65,  merged: false, above: true,  forkX: 290, endX: 560 },
    { name: 'Dashboard',      color: PHASE_COLORS[1], pct: 42,  merged: false, above: false, forkX: 290, endX: 560 },
    { name: 'Calendar',       color: PHASE_COLORS[2], pct: 0,   merged: false, above: true,  forkX: 460, endX: 640 },
  ]
  const TY = 130

  return (
    <svg viewBox="0 0 680 270" style={{ width: '100%', display: 'block' }}>
      <defs>
        <filter id="glow2"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        {branches.map(b => (
          <linearGradient key={b.name} id={`g-${b.name.replace(/\s/g,'')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={b.color} stopOpacity={b.merged ? 0.8 : 0.6} />
            <stop offset="100%" stopColor={b.color} stopOpacity={b.merged ? 0.4 : 0.15} />
          </linearGradient>
        ))}
      </defs>

      {/* Trunk glow */}
      <line x1={32} y1={TY} x2={648} y2={TY} stroke="#7c3aed" strokeWidth={20} strokeOpacity={0.055} strokeLinecap="round" />
      {/* Done segment */}
      <line x1={32} y1={TY} x2={300} y2={TY} stroke="#4ade80" strokeWidth={2} strokeLinecap="round" />
      {/* Active segment */}
      <line x1={300} y1={TY} x2={460} y2={TY} stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" />
      {/* Planned */}
      <line x1={460} y1={TY} x2={636} y2={TY} stroke="rgba(255,255,255,0.1)" strokeWidth={2} strokeDasharray="4 4" strokeLinecap="round" />
      {/* Arrow */}
      <polygon points="650,130 637,123 637,137" fill="rgba(255,255,255,0.25)" />

      {/* Phase nodes */}
      {phases.map((p, i) => (
        <g key={p.label}>
          <circle cx={p.x} cy={TY} r={p.active ? 15 : 10}
            fill={p.done ? '#16a34a' : p.active ? '#7c3aed' : 'rgba(12,8,24,0.95)'}
            stroke={p.done ? '#4ade80' : p.active ? '#a78bfa' : 'rgba(255,255,255,0.1)'}
            strokeWidth={1.5} filter={p.active ? 'url(#glow2)' : undefined} />
          <text x={p.x} y={TY + 4.5} textAnchor="middle"
            fill={p.done || p.active ? 'white' : 'rgba(255,255,255,0.2)'}
            fontSize={p.active ? 11 : 8} fontWeight="bold">
            {p.done ? '✓' : p.active ? '⚡' : '○'}
          </text>
          <text x={p.x} y={p.active ? 156 : 150} textAnchor="middle"
            fill={p.active ? '#c4b5fd' : p.done ? '#86efac' : 'rgba(255,255,255,0.25)'}
            fontSize={9} fontWeight={p.active ? 600 : 400} fontFamily="Inter,sans-serif">
            {p.label}
          </text>
          {/* Phase color indicator */}
          <rect x={p.x - 8} y={p.active ? 161 : 155} width={16} height={2} rx={1} fill={PHASE_COLORS[i] + '60'} />
        </g>
      ))}

      {/* Branches */}
      {branches.map(b => {
        const bY    = TY + (b.above ? -82 : 82)
        const lineS = b.forkX + 58
        const lineE = b.merged ? b.endX - 32 : b.endX
        const cx    = (lineS + lineE) / 2
        const cw    = 118

        return (
          <g key={b.name}>
            {/* Fork */}
            <path d={`M ${b.forkX} ${TY} C ${b.forkX + 34} ${TY}, ${b.forkX + 44} ${bY}, ${lineS} ${bY}`}
              fill="none" stroke={b.color} strokeWidth={1.4} strokeOpacity={b.merged ? 0.65 : 0.45} />
            {/* Line */}
            <line x1={lineS} y1={bY} x2={lineE} y2={bY}
              stroke={`url(#g-${b.name.replace(/\s/g,'')})`} strokeWidth={1.4} />
            {/* Merge back */}
            {b.merged && (
              <path d={`M ${lineE} ${bY} C ${b.endX + 4} ${bY}, ${b.endX + 10} ${TY}, ${b.endX + 28} ${TY}`}
                fill="none" stroke={b.color} strokeWidth={1.4} strokeOpacity={0.5} />
            )}

            {/* Task nodes on branch */}
            {b.pct > 0 && [0.28, 0.55, 0.78].map((t, ni) => {
              const nx = lineS + (lineE - lineS) * t
              const done = (ni + 1) / 3 <= b.pct / 100
              return (
                <circle key={ni} cx={nx} cy={bY} r={4}
                  fill={done ? b.color : 'rgba(12,8,24,0.9)'}
                  stroke={b.color} strokeWidth={1.2} strokeOpacity={done ? 0 : 0.5} />
              )
            })}

            {/* Chip */}
            <rect x={cx - cw/2} y={bY - 18} width={cw} height={34} rx={7}
              fill={b.merged ? b.color + '1e' : b.color + '0f'}
              stroke={b.color} strokeWidth={b.merged ? 0.9 : 0.6}
              strokeOpacity={b.merged ? 0.65 : 0.35} />
            {/* Name */}
            <text x={cx - cw/2 + 9} y={bY - 3} fill="rgba(255,255,255,0.8)"
              fontSize={9} fontFamily="Inter,sans-serif" fontWeight={500}>{b.name}</text>
            {/* Progress track */}
            <rect x={cx - cw/2 + 9} y={bY + 7} width={cw - 48} height={2.5} rx={1.25} fill="rgba(255,255,255,0.07)" />
            <rect x={cx - cw/2 + 9} y={bY + 7} width={(cw - 48) * b.pct / 100} height={2.5} rx={1.25} fill={b.color} />
            <text x={cx + cw/2 - 8} y={bY + 10} textAnchor="end" fill={b.color}
              fontSize={8.5} fontFamily="Inter,sans-serif" fontWeight={700}>{b.pct}%</text>

            {/* MERGED */}
            {b.merged && (
              <>
                <rect x={cx - 22} y={bY - 31} width={44} height={12} rx={3.5} fill={b.color + '25'} />
                <text x={cx} y={bY - 22} textAnchor="middle" fill={b.color}
                  fontSize={7} fontFamily="Inter,sans-serif" fontWeight={700} letterSpacing="0.06em">MERGED</text>
              </>
            )}

            {/* Planned indicator */}
            {b.pct === 0 && (
              <text x={cx} y={bY + 4} textAnchor="middle" fill="rgba(255,255,255,0.3)"
                fontSize={8} fontFamily="Inter,sans-serif">Planned</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── LANDING ──────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()
  const [mx, setMx] = useState(0)
  const [my, setMy] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const boardRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({ target: boardRef, offset: ['start end', 'center center'] })
  const bRx    = useTransform(scrollYProgress, [0, 1], [isMobile ? 5 : 14, 0])
  const bScale = useTransform(scrollYProgress, [0, 1], [0.91, 1])
  const bY     = useTransform(scrollYProgress, [0, 1], [40, 0])

  useEffect(() => {
    const r = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', r); return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const l = new Lenis({ duration: 1.6, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    const f = (t: number) => { l.raf(t); requestAnimationFrame(f) }
    requestAnimationFrame(f); return () => l.destroy()
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      setMx((e.clientX / window.innerWidth - 0.5) * 2)
      setMy((e.clientY / window.innerHeight - 0.5) * 2)
    }
    window.addEventListener('mousemove', fn); return () => window.removeEventListener('mousemove', fn)
  }, [])

  const H  = (_s: string, opts?: { size?: string; weight?: number; color?: string; mb?: string; mt?: string }) => ({
    fontSize: opts?.size ?? (isMobile ? 'clamp(32px,10vw,48px)' : 'clamp(40px,5vw,72px)'),
    fontWeight: opts?.weight ?? 800,
    letterSpacing: '-0.045em',
    lineHeight: 1.0,
    color: opts?.color ?? '#f0f0f5',
    margin: 0,
    marginBottom: opts?.mb ?? '0',
    marginTop: opts?.mt ?? '0',
    fontFamily: 'Inter, system-ui, sans-serif',
  })

  const Body = (size = '16px', color = 'rgba(255,255,255,0.45)'): React.CSSProperties => ({
    fontSize: isMobile ? '14px' : size,
    color,
    lineHeight: 1.75,
    fontFamily: 'Inter, system-ui, sans-serif',
    margin: 0,
  })

  const p = isMobile ? '0 22px' : '0 60px'
  const sectionPad = isMobile ? '80px 0' : '130px 0'
  const divider = '1px solid rgba(255,255,255,0.05)'

  return (
    <div style={{ background: '#05050a', color: '#fff', overflowX: 'hidden', cursor: isMobile ? 'auto' : 'none' }}>
      {!isMobile && <Cursor />}
      <Noise />

      {/* ── NAV ── */}
      <motion.nav
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.7 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: isMobile ? '16px 22px' : '20px 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,5,10,0.82)', backdropFilter: 'blur(24px)', borderBottom: divider }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(140deg,#7c3aed,#db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>N</div>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: '#e8e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>NexTask</span>
        </div>
        {/* Nav actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!isMobile && (
            <button onClick={() => navigate('/auth')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.42)', cursor: 'pointer', fontSize: '14px', padding: '8px 18px', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500, borderRadius: '8px', transition: 'color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)' }}>
              Sign in
            </button>
          )}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/auth')}
            style={{ background: '#7c3aed', border: 'none', borderRadius: '9px', padding: isMobile ? '9px 18px' : '9px 22px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.01em' }}>
            Get started
          </motion.button>
        </div>
      </motion.nav>

      {/* ══ HERO ══════════════════════════════════════════════ */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas camera={{ position: [0, 0, 9], fov: 50 }}>
            <HeroScene mx={mx} my={my} />
          </Canvas>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(5,5,10,0) 0%, rgba(5,5,10,0.6) 50%, rgba(5,5,10,0.98) 100%)' }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '900px', width: '100%', padding: isMobile ? '100px 24px 80px' : '0 32px' }}>

          {/* Headline — two lines, product truth */}
          <div style={{ overflow: 'hidden', marginBottom: '2px' }}>
            <motion.h1
              initial={{ y: '100%' }} animate={{ y: 0 }}
              transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              style={{ ...H('white', { size: isMobile ? 'clamp(44px,13vw,64px)' : 'clamp(64px,8.5vw,108px)' }), color: '#f0f0f8' }}>
              Project tracking,
            </motion.h1>
          </div>
          <div style={{ overflow: 'hidden', marginBottom: isMobile ? '28px' : '40px' }}>
            <motion.h1
              initial={{ y: '100%' }} animate={{ y: 0 }}
              transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 0.46 }}
              style={{ ...H('white', { size: isMobile ? 'clamp(44px,13vw,64px)' : 'clamp(64px,8.5vw,108px)' }), background: 'linear-gradient(128deg, #a78bfa 20%, #f472b6 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              finally clear.
            </motion.h1>
          </div>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.75 }}
            style={{ ...Body(isMobile ? '15px' : '19px'), maxWidth: '520px', margin: '0 auto', marginBottom: isMobile ? '36px' : '52px', color: 'rgba(255,255,255,0.48)', fontWeight: 400 }}>
            See every feature, every phase, every blocker — on a single live timeline. Built for teams that need clarity, not more tools.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
            style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <motion.button whileHover={{ scale: 1.03, boxShadow: '0 0 36px rgba(124,58,237,0.45)' }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/auth')}
              style={{ background: '#7c3aed', border: 'none', borderRadius: '11px', padding: isMobile ? '14px 32px' : '16px 44px', color: 'white', cursor: 'pointer', fontSize: isMobile ? '15px' : '16px', fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.01em', boxShadow: '0 0 28px rgba(124,58,237,0.3)' }}>
              Start for free
            </motion.button>
            <motion.button whileHover={{ scale: 1.03, borderColor: 'rgba(255,255,255,0.22)' }} whileTap={{ scale: 0.97 }}
              onClick={() => document.getElementById('flow-section')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '11px', padding: isMobile ? '14px 28px' : '16px 36px', color: 'rgba(255,255,255,0.58)', cursor: 'pointer', fontSize: isMobile ? '15px' : '16px', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 500 }}>
              See it in action
            </motion.button>
          </motion.div>
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', background: 'linear-gradient(to bottom, transparent, #05050a)', zIndex: 5 }} />
      </section>

      {/* ══ FLOW SECTION ════════════════════════════════════ */}
      <section id="flow-section" style={{ padding: sectionPad, borderTop: divider }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', padding: p }}>

          <FadeUp style={{ marginBottom: isMobile ? '48px' : '72px', maxWidth: '560px' }}>
            <p style={{ ...Body('12px', 'rgba(255,255,255,0.22)'), letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '18px' }}>Flow</p>
            <Reveal style={{ ...H('white', { size: isMobile ? 'clamp(28px,8vw,42px)' : 'clamp(36px,4vw,58px)', mb: '18px' }) }}>
              Your whole project. One view.
            </Reveal>
            <p style={{ ...Body('17px', 'rgba(255,255,255,0.42)'), maxWidth: '460px' }}>
              Features branch off the project timeline and merge back when done. Phases tell you where you are. Task nodes show who's working on what.
            </p>
          </FadeUp>

          {/* Flow diagram */}
          <FadeUp delay={0.1} style={{ background: 'rgba(255,255,255,0.02)', border: divider, borderRadius: '16px', padding: isMobile ? '20px 10px 24px' : '32px 28px 36px', position: 'relative', overflow: 'hidden', marginBottom: isMobile ? '48px' : '72px' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.35), transparent)' }} />
            {/* Window chrome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '20px' }}>
              {['#ff5f57','#febc2e','#28c840'].map((c, i) => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.7 }} />)}
              <span style={{ marginLeft: '8px', ...Body('10px', 'rgba(255,255,255,0.2)'), letterSpacing: '0.1em', textTransform: 'uppercase' }}>NexTask — Flow</span>
            </div>
            <FlowSVG />
            {/* Legend */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '18px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[['#4ade80','Done'],['#a78bfa','Active'],['rgba(255,255,255,0.2)','Planned'],['#7c3aed','Merged']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
                  <span style={{ ...Body('11px', 'rgba(255,255,255,0.3)') }}>{l}</span>
                </div>
              ))}
            </div>
          </FadeUp>

          {/* Three truths below the diagram */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? '28px' : '40px' }}>
            {[
              { title: 'Know what\'s blocked', body: 'At-risk and blocked features are visible the moment they fall behind. No check-in needed.' },
              { title: 'Standup in minutes', body: 'One click opens fullscreen slides — one per person. Active tasks, blockers, what\'s next.' },
              { title: 'Phases, not columns', body: 'Features are grouped by milestone. You always know where the project stands against the plan.' },
            ].map((c, i) => (
              <FadeUp key={c.title} delay={i * 0.08}>
                <p style={{ ...Body('15px', 'rgba(255,255,255,0.7)'), fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '8px' }}>{c.title}</p>
                <p style={{ ...Body('14px', 'rgba(255,255,255,0.36)'), lineHeight: 1.7 }}>{c.body}</p>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ BOARD ════════════════════════════════════════════ */}
      <section ref={boardRef} style={{ padding: sectionPad, borderTop: divider }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: p }}>

          <FadeUp style={{ marginBottom: isMobile ? '36px' : '56px', maxWidth: '520px' }}>
            <p style={{ ...Body('12px', 'rgba(255,255,255,0.22)'), letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '18px' }}>Board</p>
            <Reveal style={{ ...H('white', { size: isMobile ? 'clamp(28px,8vw,42px)' : 'clamp(36px,4vw,58px)', mb: '18px' }) }}>
              The board moves with your team.
            </Reveal>
            <p style={{ ...Body('17px', 'rgba(255,255,255,0.42)') }}>
              Drag a card across a column. Every connected browser updates in under a second. Assign tasks, set priorities, and track due dates — all in the same place.
            </p>
          </FadeUp>

          {/* 3D tilted browser */}
          <motion.div style={{ rotateX: bRx, scale: bScale, y: bY, transformPerspective: 1100, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: '-1px', borderRadius: '16px', background: 'linear-gradient(140deg, rgba(124,58,237,0.28), rgba(219,39,119,0.18), rgba(6,182,212,0.1))', zIndex: -1 }} />
            <div style={{ background: '#09090f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 36px 90px rgba(0,0,0,0.85)' }}>
              <div style={{ background: '#0d0d16', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '9px', borderBottom: divider }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {['#ff5f57','#febc2e','#28c840'].map((c, i) => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.75 }} />)}
                </div>
                {!isMobile && (
                  <div style={{ maxWidth: '220px', margin: '0 auto', flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '5px', padding: '3px 10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', color: '#10b981' }}>🔒</span>
                    <span style={{ ...Body('10px', 'rgba(255,255,255,0.3)'), letterSpacing: '0.05em' }}>nextask.live/app</span>
                  </div>
                )}
              </div>
              <div style={{ height: isMobile ? '290px' : '460px' }}><DemoBoard /></div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ FEATURES GRID ════════════════════════════════════ */}
      <section style={{ padding: sectionPad, borderTop: divider }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', padding: p }}>

          <FadeUp style={{ marginBottom: isMobile ? '40px' : '64px', maxWidth: '480px' }}>
            <p style={{ ...Body('12px', 'rgba(255,255,255,0.22)'), letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '18px' }}>Features</p>
            <Reveal style={{ ...H('white', { size: isMobile ? 'clamp(28px,8vw,40px)' : 'clamp(32px,3.8vw,52px)' }) }}>
              Everything your team needs.
            </Reveal>
          </FadeUp>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '10px' }}>
            {[
              { icon: '⚡', name: 'Flow',             color: '#7c3aed', desc: 'Live execution map. Branches, merges, phases.' },
              { icon: '🎯', name: 'Standup mode',     color: '#2563eb', desc: 'Fullscreen slides. Run it in under 5 minutes.' },
              { icon: '🤖', name: 'Nex AI',           color: '#db2777', desc: 'Create tasks, summarize blockers, plan sprints.' },
              { icon: '📋', name: 'Kanban board',     color: '#059669', desc: 'Real-time drag and drop. All columns synced.' },
              { icon: '⏱️', name: 'Focus timer',      color: '#d97706', desc: 'Pomodoro with ambient beats. Shipped more.' },
              { icon: '🗓️', name: 'Calendar',         color: '#7c3aed', desc: 'Tasks and manual events in one month view.' },
              { icon: '📊', name: 'Dashboard',        color: '#2563eb', desc: 'Health, team, phases, links — one screen.' },
              { icon: '👥', name: 'Workspaces',       color: '#db2777', desc: 'Invite by email. Assign roles. Fully isolated.' },
            ].map((f, i) => (
              <FadeUp key={f.name} delay={i * 0.04}>
                <div
                  style={{ padding: '20px 18px', background: 'rgba(255,255,255,0.02)', border: divider, borderRadius: '11px', transition: 'border-color 0.2s, background 0.2s', height: '100%', boxSizing: 'border-box' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = f.color + '40'; e.currentTarget.style.background = f.color + '08' }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '20px', marginBottom: '12px' }}>{f.icon}</div>
                  <p style={{ ...Body('13px', 'rgba(255,255,255,0.72)'), fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '5px' }}>{f.name}</p>
                  <p style={{ ...Body('12px', 'rgba(255,255,255,0.3)'), lineHeight: 1.55 }}>{f.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════ */}
      <section style={{ padding: isMobile ? '100px 0 120px' : '160px 0 180px', borderTop: divider, position: 'relative', overflow: 'hidden' }}>
        {/* Subtle background glow */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '340px', background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: p, textAlign: 'center', position: 'relative' }}>
          <Reveal style={{ ...H('white', { size: isMobile ? 'clamp(32px,10vw,48px)' : 'clamp(44px,5.5vw,72px)', mb: '20px' }) }} delay={0.05}>
            Start tracking. Right now.
          </Reveal>
          <FadeUp delay={0.15} style={{ marginBottom: '36px' }}>
            <p style={{ ...Body(isMobile ? '15px' : '17px', 'rgba(255,255,255,0.38)') }}>
              Sign in with Google. Your board is ready immediately. No setup, no configuration — just your work, organized.
            </p>
          </FadeUp>
          <FadeUp delay={0.22}>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 0 44px rgba(124,58,237,0.45)' }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/auth')}
              style={{ background: '#7c3aed', border: 'none', borderRadius: '12px', padding: isMobile ? '15px 36px' : '18px 52px', color: 'white', cursor: 'pointer', fontSize: isMobile ? '15px' : '17px', fontWeight: 700, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.01em', boxShadow: '0 0 32px rgba(124,58,237,0.28)' }}>
              Open NexTask
            </motion.button>
          </FadeUp>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════ */}
      <footer style={{ borderTop: divider, padding: isMobile ? '22px 22px' : '26px 60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'linear-gradient(140deg,#7c3aed,#db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: 'white' }}>N</div>
          <span style={{ ...Body('13px', 'rgba(255,255,255,0.22)') }}>NexTask</span>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
          <a href="https://www.linkedin.com/in/bhargav-sarvepalli/" target="_blank" rel="noreferrer"
            style={{ ...Body('12px', 'rgba(255,255,255,0.22)'), textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.22)' }}>
            Bhargav Sarvepalli
          </a>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
          <a href="https://github.com/Bhargav-Sarvepalli/kanban-board" target="_blank" rel="noreferrer"
            style={{ ...Body('12px', 'rgba(255,255,255,0.22)'), textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.22)' }}>
            GitHub
          </a>
        </div>
        <span style={{ ...Body('11px', 'rgba(255,255,255,0.12)'), letterSpacing: '0.04em' }}>© 2026 NexTask</span>
      </footer>
    </div>
  )
}