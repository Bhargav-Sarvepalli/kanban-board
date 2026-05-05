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
  const x  = useMotionValue(-100); const y  = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 800, damping: 35 })
  const sy = useSpring(y, { stiffness: 800, damping: 35 })
  const bx = useSpring(x, { stiffness: 80,  damping: 15 })
  const by = useSpring(y, { stiffness: 80,  damping: 15 })

  const [hov, setHov] = useState(false)
  const [vel, setVel] = useState({ x: 0, y: 0 })
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const vx = e.clientX - last.current.x
      const vy = e.clientY - last.current.y
      setVel({ x: vx, y: vy })
      last.current = { x: e.clientX, y: e.clientY }
      x.set(e.clientX); y.set(e.clientY)
    }
    const over = (e: MouseEvent) => {
      setHov(!!(e.target as HTMLElement).closest('button, a'))
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseover', over)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
    }
  }, [x, y])

  const speed  = Math.sqrt(vel.x ** 2 + vel.y ** 2)
  const stretch = Math.min(speed * 0.04, 0.5)
  const angle  = Math.atan2(vel.y, vel.x) * (180 / Math.PI)
  const blobSize = hov ? 64 : 20

  // useTransform called at top level — not inside JSX
  const blobX = useTransform(bx, v => v - blobSize / 2)
  const blobY = useTransform(by, v => v - blobSize / 2)
  const dotX  = useTransform(sx, v => v - 2)
  const dotY  = useTransform(sy, v => v - 2)

  return (
    <>
      <motion.div style={{ position: 'fixed', pointerEvents: 'none', zIndex: 9999, x: blobX, y: blobY }}>
        <motion.div
          animate={{
            width:        blobSize + speed * 0.8,
            height:       blobSize,
            rotate:       angle,
            borderRadius: hov ? '8px' : '50%',
            background:   hov ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.5)',
            border:       hov ? '1px solid rgba(139,92,246,0.6)' : '1px solid transparent',
            scaleX:       1 + stretch,
            scaleY:       1 - stretch * 0.5,
            boxShadow:    `0 0 ${hov ? 20 : 10}px rgba(139,92,246,0.4)`,
          }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{ borderRadius: '50%' }}
        />
      </motion.div>
      <motion.div style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 9999,
        x: dotX, y: dotY,
        width: 4, height: 4, borderRadius: '50%',
        background: 'white', mixBlendMode: 'difference',
      }} />
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
// Layout: milestones at fixed X positions, branches occupy dedicated horizontal zones
// Zone 1 (x 80–320):  Kickoff branches — Auth & Login, Kanban Board (both MERGED)
// Zone 2 (x 330–580): Designing branches — Flow Engine (65%), Dashboard (42%)
// Zone 3 (x 590–680): Phase 1 branch — Calendar (Planned, 0%)
// Trunk Y = 145 (centre). Branch offset = ±88px

// ─── FLOW SVG — all values verified by calculation, no variables ──────────────
// TY=145. Kickoff@56. Fork@80. Line 132→204. Merge M204,bY C224,bY 284,145 300,145.
// Designing@400. Gap = 100px. Designing branches fork@430, line 482→590. Phase1@620.
function FlowSVG() {
  return (
    <svg viewBox="0 0 800 320" role="img" aria-label="NexTask Flow project map" style={{ width: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="flowTrunkLanding" x1="24" y1="160" x2="776" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="46%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="flowCardActiveLanding" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(124,58,237,0.24)" />
          <stop offset="100%" stopColor="rgba(6,182,212,0.08)" />
        </linearGradient>
        <filter id="landingNodeGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x={18} y={18} width={764} height={284} rx={18} fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.055)" />
      <path d="M 42 160 H 758" stroke="#111827" strokeWidth={22} strokeLinecap="round" opacity={0.74} />
      <path d="M 42 160 H 758" stroke="url(#flowTrunkLanding)" strokeWidth={5} strokeLinecap="round" />
      <path d="M 632 160 H 758" stroke="rgba(255,255,255,0.2)" strokeWidth={5} strokeLinecap="round" strokeDasharray="10 12" />

      <g fontFamily="Inter, system-ui, sans-serif">
        <text x={46} y={42} fill="rgba(255,255,255,0.32)" fontSize={10} fontWeight={800} letterSpacing="0.18em">FLOW MAP</text>
        <text x={46} y={60} fill="rgba(255,255,255,0.56)" fontSize={11}>Features branch from phases and merge when complete.</text>
      </g>

      <path d="M 104 160 C 126 160 124 72 160 72 H 292 C 326 72 314 160 348 160" fill="none" stroke="#22c55e" strokeWidth={2.4} strokeLinecap="round" opacity={0.62} />
      <path d="M 132 160 C 156 160 150 244 188 244 H 292 C 326 244 314 160 348 160" fill="none" stroke="#22c55e" strokeWidth={2.4} strokeLinecap="round" opacity={0.62} />
      {[104,132,348].map((x, i) => <circle key={`green-${i}`} cx={x} cy={160} r={5.2} fill="#22c55e" />)}

      <rect x={154} y={46} width={154} height={52} rx={11} fill="rgba(34,197,94,0.11)" stroke="rgba(34,197,94,0.42)" />
      <circle cx={176} cy={72} r={12} fill="#22c55e" filter="url(#landingNodeGlow)" />
      <text x={198} y={69} fill="rgba(255,255,255,0.9)" fontSize={12} fontFamily="Inter, system-ui, sans-serif" fontWeight={760}>Auth and login</text>
      <text x={198} y={85} fill="#86efac" fontSize={9} fontFamily="Inter, system-ui, sans-serif" fontWeight={800}>MERGED 100%</text>

      <rect x={154} y={218} width={154} height={52} rx={11} fill="rgba(34,197,94,0.11)" stroke="rgba(34,197,94,0.42)" />
      <circle cx={176} cy={244} r={12} fill="#22c55e" filter="url(#landingNodeGlow)" />
      <text x={198} y={241} fill="rgba(255,255,255,0.9)" fontSize={12} fontFamily="Inter, system-ui, sans-serif" fontWeight={760}>Kanban core</text>
      <text x={198} y={257} fill="#86efac" fontSize={9} fontFamily="Inter, system-ui, sans-serif" fontWeight={800}>MERGED 100%</text>

      <path d="M 430 160 C 456 160 448 82 486 82 H 632" fill="none" stroke="#8b5cf6" strokeWidth={2.2} strokeLinecap="round" opacity={0.58} />
      <path d="M 458 160 C 484 160 478 238 516 238 H 632" fill="none" stroke="#06b6d4" strokeWidth={2.2} strokeLinecap="round" opacity={0.52} />
      {[430,458,632].map((x, i) => <circle key={`active-${i}`} cx={x} cy={160} r={5.2} fill={i === 1 ? '#06b6d4' : '#8b5cf6'} />)}

      <rect x={486} y={56} width={156} height={52} rx={11} fill="url(#flowCardActiveLanding)" stroke="rgba(139,92,246,0.44)" />
      <circle cx={508} cy={82} r={12} fill="#8b5cf6" filter="url(#landingNodeGlow)" />
      <text x={530} y={79} fill="rgba(255,255,255,0.9)" fontSize={12} fontFamily="Inter, system-ui, sans-serif" fontWeight={760}>Flow engine</text>
      <rect x={530} y={91} width={72} height={3} rx={1.5} fill="rgba(255,255,255,0.11)" />
      <rect x={530} y={91} width={49} height={3} rx={1.5} fill="#8b5cf6" />
      <text x={630} y={96} textAnchor="end" fill="#c4b5fd" fontSize={9} fontFamily="Inter, system-ui, sans-serif" fontWeight={820}>68%</text>

      <rect x={516} y={212} width={156} height={52} rx={11} fill="rgba(6,182,212,0.08)" stroke="rgba(6,182,212,0.34)" />
      <circle cx={538} cy={238} r={12} fill="#06b6d4" filter="url(#landingNodeGlow)" />
      <text x={560} y={235} fill="rgba(255,255,255,0.9)" fontSize={12} fontFamily="Inter, system-ui, sans-serif" fontWeight={760}>Standup brief</text>
      <rect x={560} y={247} width={72} height={3} rx={1.5} fill="rgba(255,255,255,0.11)" />
      <rect x={560} y={247} width={31} height={3} rx={1.5} fill="#06b6d4" />
      <text x={660} y={252} textAnchor="end" fill="#67e8f9" fontSize={9} fontFamily="Inter, system-ui, sans-serif" fontWeight={820}>43%</text>

      <g fontFamily="Inter, system-ui, sans-serif">
        <circle cx={72} cy={160} r={17} fill="#0b1220" stroke="#22c55e" strokeWidth={2} />
        <circle cx={72} cy={160} r={7} fill="#22c55e" />
        <text x={72} y={194} textAnchor="middle" fill="#86efac" fontSize={10} fontWeight={800}>Kickoff</text>

        <circle cx={400} cy={160} r={24} fill="#1f123f" stroke="#a78bfa" strokeWidth={2.2} filter="url(#landingNodeGlow)" />
        <circle cx={400} cy={160} r={7} fill="#a78bfa" />
        <text x={400} y={198} textAnchor="middle" fill="#ddd6fe" fontSize={10} fontWeight={850}>Designing</text>

        <circle cx={632} cy={160} r={16} fill="#080a12" stroke="rgba(255,255,255,0.22)" strokeWidth={1.6} />
        <circle cx={632} cy={160} r={4} fill="rgba(255,255,255,0.28)" />
        <text x={632} y={194} textAnchor="middle" fill="rgba(255,255,255,0.34)" fontSize={10} fontWeight={760}>Build</text>

        <circle cx={736} cy={160} r={14} fill="#080a12" stroke="rgba(255,255,255,0.14)" strokeWidth={1.4} />
        <circle cx={736} cy={160} r={3} fill="rgba(255,255,255,0.18)" />
        <text x={736} y={191} textAnchor="middle" fill="rgba(255,255,255,0.24)" fontSize={9} fontWeight={760}>Launch</text>
      </g>
    </svg>
  )
}

// ─── LANDING ──────────────────────────────────────────────────
function HeroProductPreview({ isMobile }: { isMobile: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 34, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.05, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: 'min(980px, 100%)', margin: isMobile ? '34px auto 0' : '48px auto 0', position: 'relative' }}
    >
      <div style={{
        position: 'absolute',
        inset: '-1px',
        borderRadius: '22px',
        background: 'linear-gradient(135deg, rgba(236,72,153,0.42), rgba(124,58,237,0.3), rgba(6,182,212,0.22))',
        filter: 'blur(18px)',
        opacity: 0.45,
      }} />
      <div style={{
        position: 'relative',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'linear-gradient(180deg, rgba(15,16,28,0.88), rgba(6,7,13,0.94))',
        boxShadow: '0 34px 110px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: isMobile ? '12px 14px' : '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {['#ff5f57','#febc2e','#28c840'].map((c, i) => <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.75 }} />)}
            <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.36)', fontSize: '10px', letterSpacing: '0.12em', fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }}>NEXTASK FLOW</span>
          </div>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.38)', fontSize: '11px', fontFamily: 'Inter, system-ui, sans-serif' }}>
              <span style={{ color: '#22c55e', fontWeight: 800 }}>6 done</span>
              <span>0 blocked</span>
              <span style={{ color: '#a78bfa', fontWeight: 800 }}>live standup ready</span>
            </div>
          )}
        </div>
        <FlowSVG />
      </div>
    </motion.div>
  )
}

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
      <section style={{ position: 'relative', minHeight: isMobile ? 'auto' : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: isMobile ? '94px 0 42px' : '118px 0 76px' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas camera={{ position: [0, 0, 9], fov: 50 }}>
            <HeroScene mx={mx} my={my} />
          </Canvas>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, rgba(5,5,10,0) 0%, rgba(5,5,10,0.54) 48%, rgba(5,5,10,0.98) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,5,10,0.16), rgba(5,5,10,0.72) 62%, #05050a 100%)' }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '1120px', width: '100%', padding: isMobile ? '0 22px' : '0 42px' }}>

          {/* Headline — two lines, product truth */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.7 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: isMobile ? '18px' : '22px', padding: '8px 12px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.045)', boxShadow: '0 0 28px rgba(124,58,237,0.16)' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 16px rgba(34,197,94,0.7)' }} />
            <span style={{ color: 'rgba(255,255,255,0.66)', fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 760, letterSpacing: '0.01em' }}>Built for managers who run standups from the work itself</span>
          </motion.div>

          <div style={{ overflow: 'hidden', marginBottom: '2px' }}>
            <motion.h1
              initial={{ y: '100%' }} animate={{ y: 0 }}
              transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              style={{ ...H('white', { size: isMobile ? 'clamp(42px,12vw,62px)' : 'clamp(72px,8vw,118px)' }), color: '#f7f7fb' }}>
              Stop asking
            </motion.h1>
          </div>
          <div style={{ overflow: 'hidden', marginBottom: isMobile ? '28px' : '40px' }}>
            <motion.h1
              initial={{ y: '100%' }} animate={{ y: 0 }}
              transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1], delay: 0.46 }}
              style={{ ...H('white', { size: isMobile ? 'clamp(42px,12vw,62px)' : 'clamp(72px,8vw,118px)' }), background: 'linear-gradient(128deg, #f472b6 8%, #a78bfa 48%, #22d3ee 92%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              for updates.
            </motion.h1>
          </div>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.75 }}
            style={{ ...Body(isMobile ? '15px' : '20px'), maxWidth: '660px', margin: '0 auto', marginBottom: isMobile ? '26px' : '34px', color: 'rgba(255,255,255,0.58)', fontWeight: 430 }}>
            NexTask turns tasks, phases, blockers, meetings, and AI summaries into one calm command center. Open Flow before standup and know exactly what moved, what stalled, and what should merge next.
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
            style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <motion.button whileHover={{ scale: 1.03, boxShadow: '0 0 36px rgba(124,58,237,0.45)' }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/auth')}
              style={{ background: 'linear-gradient(135deg, #ec4899, #7c3aed 54%, #06b6d4)', border: 'none', borderRadius: '13px', padding: isMobile ? '14px 30px' : '16px 42px', color: 'white', cursor: 'pointer', fontSize: isMobile ? '15px' : '16px', fontWeight: 820, fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: '-0.01em', boxShadow: '0 20px 54px rgba(124,58,237,0.38)' }}>
              Try the live app
            </motion.button>
            <motion.button whileHover={{ scale: 1.03, borderColor: 'rgba(255,255,255,0.22)' }} whileTap={{ scale: 0.97 }}
              onClick={() => document.getElementById('flow-section')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '13px', padding: isMobile ? '14px 24px' : '16px 32px', color: 'rgba(255,255,255,0.72)', cursor: 'pointer', fontSize: isMobile ? '15px' : '16px', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 720 }}>
              See Flow
            </motion.button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.22, duration: 0.6 }}
            style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? '8px' : '14px', flexWrap: 'wrap', marginTop: isMobile ? '20px' : '24px' }}>
            {['Google sign-in', 'Personal + teams', 'AI standup brief', 'No setup required'].map(item => (
              <span key={item} style={{ padding: '7px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 720, fontFamily: 'Inter, system-ui, sans-serif' }}>{item}</span>
            ))}
          </motion.div>

          <HeroProductPreview isMobile={isMobile} />
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', background: 'linear-gradient(to bottom, transparent, #05050a)', zIndex: 5 }} />
      </section>

      {/* ══ FLOW SECTION ════════════════════════════════════ */}
      <section id="flow-section" style={{ padding: isMobile ? '82px 0' : '118px 0', borderTop: divider, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 8%, rgba(236,72,153,0.1), transparent 28%), radial-gradient(circle at 82% 12%, rgba(6,182,212,0.1), transparent 28%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: p, position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.88fr 1.12fr', gap: isMobile ? '34px' : '54px', alignItems: 'center' }}>
            <FadeUp style={{ maxWidth: '520px' }}>
              <p style={{ ...Body('12px', 'rgba(255,255,255,0.28)'), letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '18px', fontWeight: 800 }}>Flow</p>
              <Reveal style={{ ...H('white', { size: isMobile ? 'clamp(32px,9vw,46px)' : 'clamp(42px,4.8vw,68px)', mb: '18px' }) }}>
                Run standup from the project map.
              </Reveal>
              <p style={{ ...Body('17px', 'rgba(255,255,255,0.5)'), maxWidth: '480px', marginBottom: '26px' }}>
                Flow gives managers the same instant read developers get from a git graph: what branched out, what is active, what is blocked, and what is ready to merge.
              </p>

              <div style={{ display: 'grid', gap: '10px', marginBottom: '28px' }}>
                {[
                  { k: '01', t: 'See ownership fast', b: 'Every feature branch has progress, status, and the next action.' },
                  { k: '02', t: 'Click into the board', b: 'Open a feature and move task cards without losing project context.' },
                  { k: '03', t: 'Merge when complete', b: 'Done features become visible wins instead of buried task history.' },
                ].map(item => (
                  <div key={item.k} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: '12px', padding: '14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.035)' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(236,72,153,0.22), rgba(6,182,212,0.16))', color: '#e9d5ff', fontSize: '11px', fontWeight: 900, fontFamily: 'Inter, system-ui, sans-serif' }}>{item.k}</div>
                    <div>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.84)', fontSize: '14px', fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }}>{item.t}</p>
                      <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.42)', fontSize: '13px', lineHeight: 1.55, fontFamily: 'Inter, system-ui, sans-serif' }}>{item.b}</p>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button whileHover={{ scale: 1.02, boxShadow: '0 0 34px rgba(124,58,237,0.35)' }} whileTap={{ scale: 0.98 }} onClick={() => navigate('/auth')}
                style={{ background: 'rgba(124,58,237,0.22)', border: '1px solid rgba(167,139,250,0.34)', borderRadius: '12px', padding: '13px 18px', color: '#ede9fe', cursor: 'pointer', fontSize: '14px', fontWeight: 820, fontFamily: 'Inter, system-ui, sans-serif' }}>
                Try Flow in NexTask
              </motion.button>
            </FadeUp>

            <FadeUp delay={0.1} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: '-18px', borderRadius: '28px', background: 'linear-gradient(135deg, rgba(236,72,153,0.18), rgba(124,58,237,0.16), rgba(6,182,212,0.1))', filter: 'blur(24px)', opacity: 0.78 }} />
              <div style={{ position: 'relative', background: 'rgba(255,255,255,0.026)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: isMobile ? '16px 8px 20px' : '20px 18px 24px', overflow: 'hidden', boxShadow: '0 28px 90px rgba(0,0,0,0.54)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', padding: '0 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    {['#ff5f57','#febc2e','#28c840'].map((c, i) => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.72 }} />)}
                    <span style={{ marginLeft: '8px', ...Body('10px', 'rgba(255,255,255,0.24)'), letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 850 }}>Standup ready</span>
                  </div>
                  {!isMobile && <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 840, fontFamily: 'Inter, system-ui, sans-serif' }}>6/14 tasks done</span>}
                </div>
                <FlowSVG />
              </div>
            </FadeUp>
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
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="2" fill={c}/>
                    <path d="M3 10h4M13 10h4M10 3v4M10 13v4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M5.5 5.5 L8 8M12 12l2.5 2.5M14.5 5.5L12 8M8 12l-2.5 2.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5"/>
                  </svg>
                ),
                name: 'Flow', color: '#7c3aed', desc: 'Live execution map. Branches, merges, phases.',
              },
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="4" width="14" height="3" rx="1.5" fill={c} fillOpacity="0.9"/>
                    <rect x="3" y="9.5" width="10" height="2.5" rx="1.25" fill={c} fillOpacity="0.5"/>
                    <rect x="3" y="14" width="7" height="2.5" rx="1.25" fill={c} fillOpacity="0.3"/>
                  </svg>
                ),
                name: 'Standup mode', color: '#2563eb', desc: 'Fullscreen slides. Run it in under 5 minutes.',
              },
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.5" strokeOpacity="0.4"/>
                    <circle cx="10" cy="10" r="2.5" fill={c}/>
                    <path d="M10 3v2M10 15v2M3 10h2M15 10h2" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.6"/>
                  </svg>
                ),
                name: 'Nex AI', color: '#db2777', desc: 'Create tasks, summarize blockers, plan sprints.',
              },
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="5" width="16" height="12" rx="2" stroke={c} strokeWidth="1.4" strokeOpacity="0.5"/>
                    <path d="M7 5V3M13 5V3" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
                    <rect x="5" y="9" width="4" height="4" rx="1" fill={c} fillOpacity="0.7"/>
                    <rect x="11" y="9" width="4" height="2" rx="1" fill={c} fillOpacity="0.3"/>
                    <rect x="11" y="12.5" width="4" height="1.5" rx="0.75" fill={c} fillOpacity="0.2"/>
                  </svg>
                ),
                name: 'Kanban board', color: '#059669', desc: 'Real-time drag and drop. All columns synced.',
              },
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.4" strokeOpacity="0.45"/>
                    <path d="M10 6v4l2.5 2.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="10" cy="10" r="1" fill={c}/>
                  </svg>
                ),
                name: 'Focus timer', color: '#d97706', desc: 'Pomodoro with ambient beats. Shipped more.',
              },
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="4" width="16" height="13" rx="2" stroke={c} strokeWidth="1.4" strokeOpacity="0.45"/>
                    <path d="M6 4V2M14 4V2M2 8h16" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.6"/>
                    <circle cx="7" cy="12" r="1.5" fill={c} fillOpacity="0.7"/>
                    <circle cx="13" cy="12" r="1.5" fill={c} fillOpacity="0.35"/>
                  </svg>
                ),
                name: 'Calendar', color: '#7c3aed', desc: 'Tasks and manual events in one month view.',
              },
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="2" width="7" height="7" rx="1.5" fill={c} fillOpacity="0.7"/>
                    <rect x="11" y="2" width="7" height="4" rx="1.5" fill={c} fillOpacity="0.35"/>
                    <rect x="11" y="8" width="7" height="3" rx="1.5" fill={c} fillOpacity="0.2"/>
                    <rect x="2" y="11" width="16" height="7" rx="1.5" stroke={c} strokeWidth="1.2" strokeOpacity="0.35"/>
                    <path d="M5 14.5h10M5 16.5h6" stroke={c} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4"/>
                  </svg>
                ),
                name: 'Dashboard', color: '#2563eb', desc: 'Health, team, phases, links — one screen.',
              },
              {
                icon: (c: string) => (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="7.5" cy="7" r="3" stroke={c} strokeWidth="1.4" strokeOpacity="0.7"/>
                    <circle cx="13.5" cy="7" r="2.5" stroke={c} strokeWidth="1.2" strokeOpacity="0.4"/>
                    <path d="M2 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6"/>
                    <path d="M14 12c1.5 0.5 3 1.5 3.5 3.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.3"/>
                  </svg>
                ),
                name: 'Workspaces', color: '#db2777', desc: 'Invite by email. Assign roles. Fully isolated.',
              },
            ].map((f, i) => (
              <FadeUp key={f.name} delay={i * 0.04}>
                <div
                  style={{ padding: '20px 18px', background: 'rgba(255,255,255,0.02)', border: divider, borderRadius: '11px', transition: 'border-color 0.2s, background 0.2s', height: '100%', boxSizing: 'border-box' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = f.color + '40'; e.currentTarget.style.background = f.color + '08' }}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}>
                  <div style={{ marginBottom: '14px' }}>{f.icon(f.color)}</div>
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
