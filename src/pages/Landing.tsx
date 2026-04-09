import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sphere, Stars } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import Lenis from 'lenis'
import DemoBoard from '../components/DemoBoard'

// --- 3D ---
function Orb({ position, color, speed = 1, distort = 0.4 }: {
  position: [number, number, number]; color: string; speed?: number; distort?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!mesh.current) return
    mesh.current.rotation.x = state.clock.elapsedTime * speed * 0.3
    mesh.current.rotation.y = state.clock.elapsedTime * speed * 0.2
  })
  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={1.5}>
      <Sphere ref={mesh} args={[1, 64, 64]} position={position}>
        <MeshDistortMaterial color={color} distort={distort} speed={2} roughness={0.1} metalness={0.8} transparent opacity={0.9} />
      </Sphere>
    </Float>
  )
}

function Particles() {
  const points = useRef<THREE.Points>(null)
  const count = 400
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 25
  useFrame((state) => { if (points.current) points.current.rotation.y = state.clock.elapsedTime * 0.02 })
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#8b5cf6" transparent opacity={0.4} />
    </points>
  )
}

function Ring({ radius, color, speed, tilt = 0 }: { radius: number; color: string; speed: number; tilt?: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!mesh.current) return
    mesh.current.rotation.z = state.clock.elapsedTime * speed
    mesh.current.rotation.x = tilt
  })
  return (
    <mesh ref={mesh}>
      <torusGeometry args={[radius, 0.015, 16, 100]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} transparent opacity={0.4} />
    </mesh>
  )
}

function HeroScene({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!group.current) return
    group.current.rotation.y += (mouseX * 0.2 - group.current.rotation.y) * 0.04
    group.current.rotation.x += (-mouseY * 0.1 - group.current.rotation.x) * 0.04
  })
  return (
    <group ref={group}>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#8b5cf6" />
      <pointLight position={[-10, -10, -5]} intensity={1} color="#ec4899" />
      <Stars radius={80} depth={50} count={1500} factor={3} saturation={0} fade speed={0.3} />
      <Particles />
      <Orb position={[-4, 1, -3]} color="#8b5cf6" speed={0.6} distort={0.5} />
      <Orb position={[4, -1, -4]} color="#ec4899" speed={0.9} distort={0.4} />
      <Ring radius={5} color="#8b5cf6" speed={0.15} tilt={0.4} />
      <Ring radius={8} color="#ec4899" speed={0.1} tilt={-0.3} />
    </group>
  )
}

// --- Cursor ---
function Cursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 })
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY })
    const over = (e: MouseEvent) => setHovered(!!(e.target as HTMLElement).closest('button, a'))
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseover', over)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseover', over) }
  }, [])
  return (
    <>
      <motion.div
        animate={{ x: pos.x - 24, y: pos.y - 24, scale: hovered ? 1.8 : 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 400, mass: 0.3 }}
        style={{
          position: 'fixed', width: '48px', height: '48px',
          borderRadius: '50%',
          border: `1px solid rgba(139,92,246,${hovered ? 0.8 : 0.4})`,
          pointerEvents: 'none', zIndex: 9999,
          background: hovered ? 'rgba(139,92,246,0.05)' : 'transparent',
        }}
      />
      <motion.div
        animate={{ x: pos.x - 3, y: pos.y - 3 }}
        transition={{ type: 'spring', damping: 50, stiffness: 1000 }}
        style={{
          position: 'fixed', width: '6px', height: '6px',
          borderRadius: '50%', background: '#8b5cf6',
          pointerEvents: 'none', zIndex: 9999,
        }}
      />
    </>
  )
}

// --- Reveal text ---
function RevealText({ text, style, delay = 0 }: { text: string; style?: React.CSSProperties; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <div ref={ref} style={{ overflow: 'hidden', ...style }}>
      {text.split(' ').map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: '110%', opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: delay + i * 0.07 }}
          style={{ display: 'inline-block', marginRight: '0.25em' }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}

// --- Count up ---
function CountUp({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  useEffect(() => {
    if (!isInView) return
    let start = 0
    const step = (end / 2000) * 16
    const timer = setInterval(() => {
      start += step
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [isInView, end])
  return <span ref={ref}>{count}{suffix}</span>
}

const features = [
  { num: '01', title: 'AI Task Intelligence', desc: 'Claude AI writes descriptions, suggests priorities, and breaks tasks into subtasks instantly.', color: '#8b5cf6', icon: '🤖' },
  { num: '02', title: 'Cinematic Drag & Drop', desc: 'Physics-based card movement with spring animations. Feels satisfying every time.', color: '#06b6d4', icon: '⚡' },
  { num: '03', title: 'Calendar Intelligence', desc: 'See your workload across time. Overdue tasks glow red. Deadlines pulse orange.', color: '#10b981', icon: '🗓️' },
  { num: '04', title: 'Recurring Workflows', desc: 'Tasks repeat weekly or monthly. Complete one and the next appears automatically.', color: '#f59e0b', icon: '🔄' },
  { num: '05', title: 'Live Comments', desc: 'Every task has a conversation thread. Add context, see timestamps, build clarity.', color: '#ec4899', icon: '💬' },
  { num: '06', title: 'Zero-Trust Security', desc: 'Row Level Security baked into the database. Your data is mathematically isolated.', color: '#ef4444', icon: '🔒' },
]

export default function Landing() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const productRef = useRef<HTMLDivElement>(null)
  const [mouseX, setMouseX] = useState(0)
  const [mouseY, setMouseY] = useState(0)
  const [activeFeature, setActiveFeature] = useState(0)

  const { scrollYProgress } = useScroll({ target: containerRef })
  const { scrollYProgress: productScroll } = useScroll({
    target: productRef,
    offset: ['start end', 'end start'],
  })

  // Product frame animation
  const productRotateX = useTransform(productScroll, [0, 0.4, 0.7], [20, 0, 0])
  const productRotateY = useTransform(productScroll, [0, 0.4, 0.7], [-8, 0, 0])
  const productScale = useTransform(productScroll, [0, 0.4], [0.85, 1])
  const productY = useTransform(productScroll, [0, 0.4], [80, 0])

  // Hero parallax
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0])

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.4, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf) }
    requestAnimationFrame(raf)
    return () => lenis.destroy()
  }, [])

  useEffect(() => {
    const move = (e: MouseEvent) => {
      setMouseX((e.clientX / window.innerWidth - 0.5) * 2)
      setMouseY((e.clientY / window.innerHeight - 0.5) * 2)
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setActiveFeature(p => (p + 1) % features.length), 3500)
    return () => clearInterval(timer)
  }, [])

  return (
    <div ref={containerRef} style={{ background: '#000', color: 'white', overflowX: 'hidden', cursor: 'none' }}>
      <Cursor />

      {/* ── NAV ── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
          padding: '20px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 800, color: 'white',
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: '16px', fontFamily: 'Space Grotesk', letterSpacing: '-0.02em' }}>
            NEX<span style={{ color: '#8b5cf6' }}>TASK</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/app')}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '8px 20px', color: 'rgba(255,255,255,0.6)',
              cursor: 'none', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600,
            }}
          >Sign In</motion.button>
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 30px rgba(139,92,246,0.6)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/app')}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none',
              borderRadius: '8px', padding: '8px 20px', color: 'white',
              cursor: 'none', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700,
              boxShadow: '0 0 20px rgba(139,92,246,0.35)',
            }}
          >Get Started →</motion.button>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        {/* 3D bg */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <Canvas camera={{ position: [0, 0, 9], fov: 55 }}>
            <HeroScene mouseX={mouseX} mouseY={mouseY} />
          </Canvas>
        </div>

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 60% 40%, transparent 20%, rgba(0,0,0,0.85) 80%)',
        }} />

        <motion.div
          style={{
            position: 'relative', zIndex: 10, height: '100%',
            display: 'flex', alignItems: 'center',
            padding: '0 8vw', y: heroY, opacity: heroOpacity,
          }}
        >
          <div style={{ maxWidth: '700px' }}>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                border: '1px solid rgba(139,92,246,0.35)',
                borderRadius: '999px', padding: '5px 14px', marginBottom: '40px',
                background: 'rgba(139,92,246,0.07)',
              }}
            >
              <motion.span
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#8b5cf6', display: 'block' }}
              />
              <span style={{ color: '#a78bfa', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.12em' }}>
                AI-POWERED TASK MANAGEMENT
              </span>
            </motion.div>

            {/* Headline */}
            <div style={{ overflow: 'hidden', marginBottom: '8px' }}>
              <motion.h1
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                style={{
                  fontSize: 'clamp(52px, 8vw, 110px)',
                  fontWeight: 800, fontFamily: 'Space Grotesk',
                  letterSpacing: '-0.05em', lineHeight: 0.92,
                  margin: 0, color: 'white',
                }}
              >MANAGE</motion.h1>
            </div>
            <div style={{ overflow: 'hidden', marginBottom: '8px' }}>
              <motion.h1
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.65 }}
                style={{
                  fontSize: 'clamp(52px, 8vw, 110px)',
                  fontWeight: 800, fontFamily: 'Space Grotesk',
                  letterSpacing: '-0.05em', lineHeight: 0.92,
                  margin: 0,
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}
              >SMARTER.</motion.h1>
            </div>
            <div style={{ overflow: 'hidden', marginBottom: '40px' }}>
              <motion.h1
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.8 }}
                style={{
                  fontSize: 'clamp(52px, 8vw, 110px)',
                  fontWeight: 800, fontFamily: 'Space Grotesk',
                  letterSpacing: '-0.05em', lineHeight: 0.92,
                  margin: 0, color: 'rgba(255,255,255,0.15)',
                }}
              >FASTER.</motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
              style={{
                color: 'rgba(255,255,255,0.35)', fontSize: '16px',
                fontFamily: 'Space Grotesk', lineHeight: 1.7,
                maxWidth: '420px', marginBottom: '44px',
              }}
            >
              A next-generation Kanban board with AI superpowers. Built for teams that move fast and think bigger.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
            >
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(139,92,246,0.7)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/app')}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                  border: 'none', borderRadius: '12px', padding: '14px 36px',
                  color: 'white', cursor: 'none', fontSize: '14px',
                  fontFamily: 'Space Grotesk', fontWeight: 700,
                  boxShadow: '0 0 35px rgba(139,92,246,0.45)',
                }}
              >Launch App →</motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => productRef.current?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', padding: '14px 36px',
                  color: 'rgba(255,255,255,0.5)', cursor: 'none',
                  fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 600,
                }}
              >See the product ↓</motion.button>
            </motion.div>
          </div>
        </motion.div>

        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '250px',
          background: 'linear-gradient(to bottom, transparent, #000)',
          zIndex: 5,
        }} />

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          style={{
            position: 'absolute', bottom: '40px', right: '48px', zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{
              width: '1px', height: '60px',
              background: 'linear-gradient(to bottom, rgba(139,92,246,0.8), transparent)',
            }}
          />
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.2em', writingMode: 'vertical-rl' }}>
            SCROLL
          </span>
        </motion.div>
      </section>

      {/* ── MARQUEE ── */}
      <div style={{
        overflow: 'hidden',
        padding: '18px 0',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        <motion.div
          animate={{ x: [0, -2400] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', gap: '48px', whiteSpace: 'nowrap', width: 'max-content' }}
        >
          {Array(4).fill(['AI POWERED', '✦', 'DRAG & DROP', '✦', 'CALENDAR VIEW', '✦', 'RECURRING TASKS', '✦', 'ZERO LATENCY', '✦', 'BUILT WITH CLAUDE', '✦']).flat().map((t, i) => (
            <span key={i} style={{
              color: i % 2 === 1 ? '#8b5cf6' : 'rgba(255,255,255,0.12)',
              fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.2em',
            }}>{t}</span>
          ))}
        </motion.div>
      </div>

      {/* ── PRODUCT DEMO ── */}
      <section ref={productRef} style={{ padding: '120px 0 200px', position: 'relative' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 48px' }}>

          {/* Label */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>
              01 — PRODUCT
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <RevealText
            text="The board that thinks with you."
            style={{
              fontSize: 'clamp(32px, 5vw, 64px)',
              fontWeight: 800, fontFamily: 'Space Grotesk',
              letterSpacing: '-0.04em', lineHeight: 1.05,
              color: 'white', marginBottom: '16px',
            }}
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{
              color: 'rgba(255,255,255,0.3)', fontSize: '16px',
              fontFamily: 'Space Grotesk', maxWidth: '500px',
              marginBottom: '72px', lineHeight: 1.7,
            }}
          >
            NexTask combines the simplicity of a Kanban board with the power of AI — so your team spends less time managing and more time shipping.
          </motion.p>

          {/* Browser frame */}
          <motion.div
            style={{
              rotateX: productRotateX,
              rotateY: productRotateY,
              scale: productScale,
              y: productY,
              transformPerspective: 1200,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Outer glow */}
            <div style={{
              position: 'absolute', inset: '-2px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(236,72,153,0.2), rgba(6,182,212,0.2))',
              filter: 'blur(1px)',
              zIndex: -1,
            }} />

            {/* Browser chrome */}
            <div style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 80px 160px rgba(0,0,0,0.8), 0 0 80px rgba(139,92,246,0.15)',
            }}>
              {/* Browser bar */}
              <div style={{
                background: '#111',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: '12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {/* Traffic lights */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                    <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, opacity: 0.8 }} />
                  ))}
                </div>

                {/* URL bar */}
                <div style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px', padding: '5px 12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  maxWidth: '320px', margin: '0 auto',
                }}>
                  <span style={{ color: '#10b981', fontSize: '9px' }}>🔒</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontFamily: 'Space Mono' }}>
                    nextask.app/board
                  </span>
                </div>
              </div>

              {/* App content */}
              <div style={{ height: '520px' }}>
                <DemoBoard />
              </div>
            </div>
          </motion.div>

          {/* Feature pills below product */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{
              display: 'flex', gap: '12px', marginTop: '48px',
              flexWrap: 'wrap', justifyContent: 'center',
            }}
          >
            {[
              { label: 'AI-powered', color: '#8b5cf6' },
              { label: 'Drag & drop', color: '#06b6d4' },
              { label: 'Calendar view', color: '#10b981' },
              { label: 'Recurring tasks', color: '#f59e0b' },
              { label: 'Comments', color: '#ec4899' },
              { label: 'Secure by default', color: '#ef4444' },
            ].map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: `${p.color}10`,
                  border: `1px solid ${p.color}25`,
                  borderRadius: '999px', padding: '6px 14px',
                }}
              >
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                <span style={{ color: p.color, fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                  {p.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '120px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 48px' }}>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ marginBottom: '80px', display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>
              02 — CAPABILITIES
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'start' }}>
            {/* Left */}
            <div>
              <RevealText
                text="Everything your team needs."
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 48px)',
                  fontWeight: 800, fontFamily: 'Space Grotesk',
                  letterSpacing: '-0.03em', lineHeight: 1.1,
                  color: 'white', marginBottom: '48px',
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {features.map((f, i) => (
                  <motion.div
                    key={f.num}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    onMouseEnter={() => setActiveFeature(i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '14px 16px', borderRadius: '10px', cursor: 'none',
                      background: activeFeature === i ? `${f.color}08` : 'transparent',
                      border: `1px solid ${activeFeature === i ? f.color + '25' : 'transparent'}`,
                      transition: 'all 0.25s',
                    }}
                  >
                    <span style={{
                      color: activeFeature === i ? f.color : 'rgba(255,255,255,0.1)',
                      fontSize: '10px', fontFamily: 'Space Mono', flexShrink: 0,
                      transition: 'color 0.25s',
                    }}>{f.num}</span>
                    <span style={{
                      fontSize: '18px', flexShrink: 0,
                      filter: activeFeature === i ? 'none' : 'grayscale(1) opacity(0.3)',
                      transition: 'filter 0.25s',
                    }}>{f.icon}</span>
                    <span style={{
                      color: activeFeature === i ? 'white' : 'rgba(255,255,255,0.3)',
                      fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 600,
                      transition: 'color 0.25s',
                    }}>{f.title}</span>
                    {activeFeature === i && (
                      <motion.span layoutId="featArrow" style={{ marginLeft: 'auto', color: f.color }}>→</motion.span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right — sticky detail */}
            <div style={{ position: 'sticky', top: '120px' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature}
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -24, scale: 0.97 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    background: `${features[activeFeature].color}07`,
                    border: `1px solid ${features[activeFeature].color}20`,
                    borderRadius: '24px', padding: '44px',
                    minHeight: '380px', position: 'relative', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                    background: `linear-gradient(90deg, transparent, ${features[activeFeature].color}80, transparent)`,
                  }} />
                  <div style={{
                    position: 'absolute', top: '-80px', right: '-80px',
                    width: '200px', height: '200px', borderRadius: '50%',
                    background: `radial-gradient(circle, ${features[activeFeature].color}20 0%, transparent 70%)`,
                  }} />

                  <div>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>{features[activeFeature].icon}</div>
                    <div style={{
                      color: features[activeFeature].color, fontSize: '10px',
                      fontFamily: 'Space Mono', letterSpacing: '0.2em', marginBottom: '10px',
                    }}>
                      FEATURE {features[activeFeature].num}
                    </div>
                    <h3 style={{
                      color: 'white', fontSize: '26px', fontWeight: 800,
                      fontFamily: 'Space Grotesk', letterSpacing: '-0.02em',
                      marginBottom: '14px', lineHeight: 1.2,
                    }}>{features[activeFeature].title}</h3>
                    <p style={{
                      color: 'rgba(255,255,255,0.45)', fontSize: '14px',
                      fontFamily: 'Space Grotesk', lineHeight: 1.8,
                    }}>{features[activeFeature].desc}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', marginTop: '28px' }}>
                    {features.map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          width: i === activeFeature ? 28 : 5,
                          background: i === activeFeature ? features[activeFeature].color : 'rgba(255,255,255,0.08)',
                        }}
                        style={{ height: '3px', borderRadius: '999px', cursor: 'none' }}
                        onClick={() => setActiveFeature(i)}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{
        padding: '120px 48px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)',
        }} />
        <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '80px' }}
          >
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.3em' }}>
              03 — BY THE NUMBERS
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '40px' }}>
            {[
              { end: 100, suffix: '%', label: 'Free to start', color: '#8b5cf6' },
              { end: 3, suffix: 'x', label: 'Faster planning', color: '#06b6d4' },
              { end: 6, suffix: '+', label: 'AI features', color: '#ec4899' },
              { end: 0, suffix: 'ms', label: 'Setup time', color: '#10b981' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{ textAlign: 'center' }}
              >
                <div style={{
                  fontSize: 'clamp(48px, 5vw, 72px)',
                  fontWeight: 800, fontFamily: 'Space Mono',
                  color: s.color, letterSpacing: '-0.04em',
                  textShadow: `0 0 40px ${s.color}50`,
                  lineHeight: 1, marginBottom: '10px',
                }}>
                  <CountUp end={s.end} suffix={s.suffix} />
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.2)', fontSize: '11px',
                  fontFamily: 'Space Mono', letterSpacing: '0.15em', textTransform: 'uppercase',
                }}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
          <Canvas camera={{ position: [0, 0, 7], fov: 60 }}>
            <ambientLight intensity={0.3} />
            <pointLight position={[5, 5, 5]} color="#8b5cf6" intensity={3} />
            <Orb position={[0, 0, 0]} color="#8b5cf6" speed={0.4} distort={0.9} />
            <Ring radius={3} color="#8b5cf6" speed={0.25} />
            <Ring radius={5} color="#ec4899" speed={0.15} />
            <Ring radius={7} color="#06b6d4" speed={0.1} />
          </Canvas>
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.92) 65%)',
        }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px', maxWidth: '800px' }}>
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            style={{
              color: 'rgba(255,255,255,0.15)', fontSize: '11px',
              fontFamily: 'Space Mono', letterSpacing: '0.3em',
              display: 'block', marginBottom: '32px',
            }}
          >04 — GET STARTED</motion.span>

          <RevealText
            text="Ready to work from the future?"
            style={{
              fontSize: 'clamp(36px, 6vw, 80px)',
              fontWeight: 800, fontFamily: 'Space Grotesk',
              letterSpacing: '-0.04em', lineHeight: 1.05,
              color: 'white', marginBottom: '20px',
            }}
          />

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{
              color: 'rgba(255,255,255,0.25)', fontSize: '16px',
              fontFamily: 'Space Grotesk', maxWidth: '420px',
              margin: '0 auto 52px', lineHeight: 1.7,
            }}
          >
            Join teams using NexTask to plan smarter, ship faster, and never miss a deadline.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.06, boxShadow: '0 0 70px rgba(139,92,246,0.8)' }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/app')}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              border: 'none', borderRadius: '14px', padding: '18px 52px',
              color: 'white', cursor: 'none', fontSize: '16px',
              fontFamily: 'Space Grotesk', fontWeight: 700,
              boxShadow: '0 0 50px rgba(139,92,246,0.5)',
            }}
          >Launch NexTask Free →</motion.button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: '28px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '20px', height: '20px', borderRadius: '5px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 800,
          }}>N</div>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>
            NexTask · Built with ⚡ and Claude AI
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '11px', fontFamily: 'Space Mono' }}>
          © 2026 NEXTASK
        </span>
      </footer>
    </div>
  )
}