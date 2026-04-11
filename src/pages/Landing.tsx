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
        roughness={0} metalness={0.9} transparent opacity={0.92} />
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
      <pointsMaterial size={0.022} color="#8b5cf6" transparent opacity={0.4} />
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
      <ambientLight intensity={0.15} />
      <pointLight position={[8, 8, 8]} intensity={3} color="#8b5cf6" />
      <pointLight position={[-8, -8, -4]} intensity={1.5} color="#ec4899" />
      <Stars radius={80} depth={50} count={1500} factor={3} saturation={0} fade speed={0.2} />
      <FloatParticles />
      <GlowOrb position={[-3.5, 0.8, -2]} color="#8b5cf6" speed={0.6} distort={0.6} scale={1.2} />
      <GlowOrb position={[3.5, -0.8, -3]} color="#ec4899" speed={0.9} distort={0.4} scale={0.9} />
      <GlowOrb position={[0.5, 2, -5]} color="#06b6d4" speed={0.4} distort={0.7} scale={0.7} />
      <mesh>
        <torusGeometry args={[4, 0.015, 16, 100]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.6} transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[0.5, 0, 0.3]}>
        <torusGeometry args={[6, 0.012, 16, 100]} />
        <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.6} transparent opacity={0.25} />
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
      <motion.div
        style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 9999,
          x: useTransform(bx, v => v - blobSize / 2),
          y: useTransform(by, v => v - blobSize / 2),
        }}
      >
        <motion.div
          animate={{
            width: blobSize + speed * 0.8,
            height: blobSize,
            rotate: angle,
            borderRadius: hovered ? '8px' : '50%',
            background: hovered ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.5)',
            border: hovered ? '1px solid rgba(139,92,246,0.6)' : '1px solid transparent',
            scaleX: 1 + stretch,
            scaleY: 1 - stretch * 0.5,
            boxShadow: `0 0 ${hovered ? 20 : 10}px rgba(139,92,246,0.4)`,
          }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{ borderRadius: '50%' }}
        />
      </motion.div>
      <motion.div
        style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 9999,
          x: useTransform(sx, v => v - 2),
          y: useTransform(sy, v => v - 2),
          width: 4, height: 4, borderRadius: '50%',
          background: 'white', mixBlendMode: 'difference',
        }}
      />
    </>
  )
}

// ─── NOISE ────────────────────────────────────────────────────
function NoiseOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2, opacity: 0.025,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    }} />
  )
}

// ─── REVEAL TEXT ──────────────────────────────────────────────
function Reveal({ text, delay = 0, style }: {
  text: string; delay?: number; style?: React.CSSProperties
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const words = text.split(' ')
  return (
    <div ref={ref} style={style}>
      {words.map((word, i) => (
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

// ─── COUNT UP ─────────────────────────────────────────────────
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
    icon: '🤖',
    title: 'AI Task Intelligence',
    desc: 'Generate task descriptions, get smart priority suggestions, and break complex tasks into actionable subtasks — all powered by AI.',
    color: '#8b5cf6',
  },
  {
    n: '02',
    icon: '⚡',
    title: 'Instant Drag & Drop',
    desc: 'Physics-based card motion with spring animations. Move tasks between columns with satisfying, zero-lag interactions.',
    color: '#06b6d4',
  },
  {
    n: '03',
    icon: '👥',
    title: 'Team Collaboration',
    desc: 'Create shared workspaces, invite teammates by email, and see task updates appear in real-time across all connected clients.',
    color: '#10b981',
  },
  {
    n: '04',
    icon: '🗓️',
    title: 'Calendar Intelligence',
    desc: 'Visualize your entire workload across time. Overdue tasks glow red, upcoming deadlines pulse orange — at a glance.',
    color: '#f59e0b',
  },
  {
    n: '05',
    icon: '🔄',
    title: 'Recurring Workflows',
    desc: 'Set tasks to repeat weekly or monthly. Complete one and the next appears automatically. Zero friction, zero forgetting.',
    color: '#ec4899',
  },
  {
    n: '06',
    icon: '💬',
    title: 'Task Comments',
    desc: 'Every task has a live conversation thread. Add context, track decisions, and build a history of your work.',
    color: '#a78bfa',
  },
  {
    n: '07',
    icon: '🔐',
    title: 'Google OAuth & Email Auth',
    desc: 'Sign in with Google in one click or use email and password. Sessions persist securely across devices.',
    color: '#34d399',
  },
  {
    n: '08',
    icon: '🔒',
    title: 'Zero-Trust Security',
    desc: 'Row Level Security baked into the database layer. Your data is mathematically isolated — not just hidden by application logic.',
    color: '#ef4444',
  },
]

// ─── MAIN ─────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate()
  const [mx, setMx] = useState(0)
  const [my, setMy] = useState(0)
  const [activeF, setActiveF] = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const productRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress: pScroll } = useScroll({
    target: productRef,
    offset: ['start end', 'center center'],
  })
  const pRx = useTransform(pScroll, [0, 1], [isMobile ? 8 : 18, 0])
  const pRy = useTransform(pScroll, [0, 1], [isMobile ? -3 : -6, 0])
  const pScale = useTransform(pScroll, [0, 1], [0.88, 1])
  const pY = useTransform(pScroll, [0, 1], [60, 0])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })
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
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 800, color: 'white',
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: isMobile ? '14px' : '15px', fontFamily: 'Space Grotesk', letterSpacing: '-0.02em' }}>
            NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isMobile && (
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/auth')}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', padding: '8px 20px',
                color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600,
              }}
            >Sign In</motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/auth')}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none', borderRadius: '8px',
              padding: isMobile ? '8px 16px' : '8px 20px',
              color: 'white', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700,
              boxShadow: '0 0 16px rgba(139,92,246,0.3)',
            }}
          >Get Started →</motion.button>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas camera={{ position: [0, 0, 9], fov: 52 }}>
            <HeroCanvas mx={mx} my={my} />
          </Canvas>
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.97) 100%)',
        }} />

        <div style={{
          position: 'relative', zIndex: 10,
          textAlign: 'center', padding: isMobile ? '0 20px' : '0 24px',
          maxWidth: '900px', width: '100%',
        }}>
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: '999px', padding: '5px 14px',
              marginBottom: isMobile ? '28px' : '44px',
              background: 'rgba(139,92,246,0.07)',
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', display: 'block', boxShadow: '0 0 8px #8b5cf6' }}
            />
            <span style={{ color: '#a78bfa', fontSize: isMobile ? '9px' : '11px', fontFamily: 'Space Mono', letterSpacing: '0.12em' }}>
              {isMobile ? 'AI-POWERED KANBAN' : 'AI-POWERED · KANBAN · FUTURISTIC'}
            </span>
          </motion.div>

          {/* Headlines */}
          {['MANAGE', 'SMARTER.', 'FASTER.'].map((word, idx) => (
            <div key={word} style={{ overflow: 'hidden', marginBottom: idx === 2 ? (isMobile ? '28px' : '44px') : '4px' }}>
              <motion.h1
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.55 + idx * 0.15 }}
                style={{
                  fontSize: isMobile ? 'clamp(52px, 16vw, 72px)' : 'clamp(60px, 10vw, 128px)',
                  fontWeight: 900, fontFamily: 'Space Grotesk',
                  letterSpacing: '-0.055em', lineHeight: 0.9, margin: 0,
                  color: idx === 0 ? 'white' : idx === 2 ? 'rgba(255,255,255,0.1)' : 'transparent',
                  background: idx === 1 ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'none',
                  WebkitBackgroundClip: idx === 1 ? 'text' : 'unset',
                  WebkitTextFillColor: idx === 1 ? 'transparent' : 'unset',
                }}
              >{word}</motion.h1>
            </div>
          ))}

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8 }}
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: isMobile ? '14px' : 'clamp(14px, 1.6vw, 17px)',
              fontFamily: 'Space Grotesk', lineHeight: 1.75,
              maxWidth: '480px', margin: '0 auto',
              marginBottom: isMobile ? '32px' : '48px',
            }}
          >
            A next-generation Kanban board powered by AI.<br></br> Built for teams that move fast and think bigger.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.25 }}
            style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => navigate('/auth')}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                border: 'none', borderRadius: '12px',
                padding: isMobile ? '13px 28px' : '15px 40px',
                color: 'white', cursor: 'pointer',
                fontSize: isMobile ? '14px' : '15px',
                fontFamily: 'Space Grotesk', fontWeight: 700,
                boxShadow: '0 0 32px rgba(139,92,246,0.4)',
              }}
            >Launch App →</motion.button>
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => productRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: isMobile ? '13px 28px' : '15px 40px',
                color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                fontSize: isMobile ? '14px' : '15px',
                fontFamily: 'Space Grotesk', fontWeight: 600,
              }}
            >See the product ↓</motion.button>
          </motion.div>
        </div>

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '220px',
          background: 'linear-gradient(to bottom, transparent, #000)', zIndex: 5,
        }} />
      </section>

      {/* ── MARQUEE ── */}
      <div style={{
        overflow: 'hidden', padding: '14px 0',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <motion.div
          animate={{ x: [0, -2800] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', gap: '56px', whiteSpace: 'nowrap', width: 'max-content' }}
        >
          {Array(5).fill(['AI POWERED', '✦', 'DRAG & DROP', '✦', 'TEAM COLLABORATION', '✦', 'CALENDAR VIEW', '✦', 'RECURRING TASKS', '✦', 'GOOGLE AUTH', '✦', 'REAL-TIME SYNC', '✦', 'ZERO LATENCY', '✦',]).flat().map((t, i) => (
            <span key={i} style={{
              color: i % 2 === 1 ? '#8b5cf6' : 'rgba(255,255,255,0.1)',
              fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.22em',
            }}>{t}</span>
          ))}
        </motion.div>
      </div>

      {/* ── PRODUCT DEMO ── */}
      <section ref={productRef} style={{ padding: isMobile ? '80px 0 100px' : '140px 0 200px', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: pad }}>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>
              01 — PRODUCT
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </motion.div>

          <Reveal
            text="The board that thinks with you."
            style={{
              fontSize: isMobile ? 'clamp(28px, 8vw, 40px)' : 'clamp(32px, 5vw, 64px)',
              fontWeight: 800, fontFamily: 'Space Grotesk',
              letterSpacing: '-0.04em', lineHeight: 1.05,
              color: 'white', marginBottom: '14px',
            }}
          />

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{
              color: 'rgba(255,255,255,0.28)', fontSize: isMobile ? '14px' : '16px',
              fontFamily: 'Space Grotesk', maxWidth: '480px',
              marginBottom: isMobile ? '40px' : '72px', lineHeight: 1.75,
            }}
          >
            NexTask combines the simplicity of Kanban with the power of AI — so your team spends less time organizing and more time shipping.
          </motion.p>

          {/* Browser mockup */}
          <motion.div style={{
            rotateX: pRx, rotateY: pRy, scale: pScale, y: pY,
            transformPerspective: 1400, transformStyle: 'preserve-3d',
          }}>
            <div style={{
              position: 'absolute', inset: '-1px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(236,72,153,0.3), rgba(6,182,212,0.2))',
              filter: 'blur(0.5px)', zIndex: -1,
            }} />
            <div style={{
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 60px rgba(139,92,246,0.1)',
            }}>
              {/* Browser chrome */}
              <div style={{
                background: '#111', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                    <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.85 }} />
                  ))}
                </div>
                {!isMobile && (
                  <div style={{
                    flex: 1, maxWidth: '280px', margin: '0 auto',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '5px', padding: '3px 10px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <span style={{ fontSize: '9px', color: '#10b981' }}>🔒</span>
                    <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                      nextask.app/board
                    </span>
                  </div>
                )}
              </div>
              <div style={{ height: isMobile ? '320px' : '520px' }}>
                <DemoBoard />
              </div>
            </div>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{ display: 'flex', gap: '8px', marginTop: '32px', flexWrap: 'wrap', justifyContent: 'center' }}
          >
            {[
                { label: 'AI-powered', color: '#8b5cf6' },
                { label: 'Team workspaces', color: '#10b981' },
                { label: 'Real-time sync', color: '#06b6d4' },
                { label: 'Calendar view', color: '#f59e0b' },
                { label: 'Recurring tasks', color: '#ec4899' },
                { label: 'Google OAuth', color: '#34d399' },
                { label: 'Secure by default', color: '#ef4444' },
              ].map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: `${p.color}0d`, border: `1px solid ${p.color}22`,
                  borderRadius: '999px', padding: '5px 12px',
                }}
              >
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: p.color }} />
                <span style={{ color: p.color, fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{p.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: isMobile ? '80px 0' : '120px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: pad }}>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ marginBottom: isMobile ? '40px' : '80px', display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>
              02 — CAPABILITIES
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </motion.div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '32px' : '80px',
            alignItems: 'start',
          }}>
            {/* Left list */}
            <div>
              <Reveal
                text="Everything your team needs."
                style={{
                  fontSize: isMobile ? 'clamp(24px, 6vw, 36px)' : 'clamp(28px, 3.5vw, 48px)',
                  fontWeight: 800, fontFamily: 'Space Grotesk',
                  letterSpacing: '-0.03em', lineHeight: 1.1,
                  color: 'white', marginBottom: isMobile ? '24px' : '48px',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.n}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    onMouseEnter={() => !isMobile && setActiveF(i)}
                    onClick={() => setActiveF(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                      background: activeF === i ? `${f.color}0a` : 'transparent',
                      border: `1px solid ${activeF === i ? f.color + '22' : 'transparent'}`,
                      transition: 'all 0.22s',
                    }}
                  >
                    <span style={{ color: activeF === i ? f.color : 'rgba(255,255,255,0.1)', fontSize: '10px', fontFamily: 'Space Mono', flexShrink: 0 }}>{f.n}</span>
                    <span style={{ fontSize: '16px', flexShrink: 0, filter: activeF === i ? 'none' : 'grayscale(1) opacity(0.25)' }}>{f.icon}</span>
                    <span style={{ color: activeF === i ? 'white' : 'rgba(255,255,255,0.28)', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{f.title}</span>
                    {activeF === i && (
                      <motion.span layoutId="arr" style={{ marginLeft: 'auto', color: f.color, fontSize: '14px' }}>→</motion.span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right detail — hidden on mobile, shown inline */}
            {!isMobile && (
              <div style={{ position: 'sticky', top: '120px' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeF}
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.97 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      background: `${FEATURES[activeF].color}07`,
                      border: `1px solid ${FEATURES[activeF].color}1a`,
                      borderRadius: '24px', padding: '44px',
                      minHeight: '360px', position: 'relative', overflow: 'hidden',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${FEATURES[activeF].color}70, transparent)` }} />
                    <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px', borderRadius: '50%', background: `radial-gradient(circle, ${FEATURES[activeF].color}18 0%, transparent 70%)` }} />
                    <div>
                      <div style={{ fontSize: '44px', marginBottom: '18px' }}>{FEATURES[activeF].icon}</div>
                      <div style={{ color: FEATURES[activeF].color, fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.2em', marginBottom: '10px' }}>FEATURE {FEATURES[activeF].n}</div>
                      <h3 style={{ color: 'white', fontSize: '26px', fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '-0.02em', marginBottom: '12px', lineHeight: 1.2 }}>{FEATURES[activeF].title}</h3>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontFamily: 'Space Grotesk', lineHeight: 1.8 }}>{FEATURES[activeF].desc}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', marginTop: '24px' }}>
                      {FEATURES.map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{
                            width: i === activeF ? 26 : 5,
                            background: i === activeF ? FEATURES[activeF].color : 'rgba(255,255,255,0.08)',
                          }}
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

      {/* ── STATS ── */}
      <section style={{
        padding: isMobile ? '80px 20px' : '120px 48px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: isMobile ? '40px' : '80px' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>
              03 — BY THE NUMBERS
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </motion.div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: isMobile ? '32px 20px' : '40px',
          }}>
            {[
              { end: 100, suffix: '%', label: 'Free to start', color: '#8b5cf6' },
              { end: 3, suffix: 'x', label: 'Faster planning', color: '#06b6d4' },
              { end: 6, suffix: '+', label: 'AI features', color: '#ec4899' },
              { end: 0, suffix: 'ms', label: 'Setup time', color: '#10b981' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{
                  fontSize: isMobile ? '44px' : 'clamp(44px,5vw,72px)',
                  fontWeight: 800, fontFamily: 'Space Mono', color: s.color,
                  letterSpacing: '-0.04em',
                  textShadow: `0 0 40px ${s.color}45`,
                  lineHeight: 1, marginBottom: '8px',
                }}>
                  <CountUp end={s.end} suffix={s.suffix} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  {s.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        minHeight: isMobile ? '80vh' : '100vh',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative', overflow: 'hidden',
      }}>
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
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.93) 65%)',
        }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: isMobile ? '60px 20px' : '0 24px', maxWidth: '800px' }}>
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            style={{ color: 'rgba(255,255,255,0.15)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.3em', display: 'block', marginBottom: '24px' }}
          >04 — GET STARTED</motion.span>

          <Reveal
            text="Ready to work from the future?"
            style={{
              fontSize: isMobile ? 'clamp(28px, 8vw, 44px)' : 'clamp(36px,6vw,80px)',
              fontWeight: 900, fontFamily: 'Space Grotesk',
              letterSpacing: '-0.04em', lineHeight: 1.05,
              color: 'white', marginBottom: '16px',
            }}
          />

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{
              color: 'rgba(255,255,255,0.25)', fontSize: isMobile ? '14px' : '16px',
              fontFamily: 'Space Grotesk', maxWidth: '400px',
              margin: '0 auto 40px', lineHeight: 1.75,
            }}
          >
            Join teams using NexTask to plan smarter, ship faster, and never miss a deadline.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/auth')}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none', borderRadius: '14px',
              padding: isMobile ? '16px 36px' : '18px 52px',
              color: 'white', cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontFamily: 'Space Grotesk', fontWeight: 700,
              boxShadow: '0 0 48px rgba(139,92,246,0.4)',
            }}
          >Launch NexTask Free →</motion.button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: isMobile ? '20px' : '28px 48px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px', height: '20px', borderRadius: '5px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 800, color: 'white',
          }}>N</div>
          <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>
            NexTask · Built with ⚡
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: '11px', fontFamily: 'Space Mono' }}>
          © 2026 NEXTASK
        </span>
      </footer>
    </div>
  )
}