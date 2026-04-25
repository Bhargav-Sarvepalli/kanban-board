import { useRef, useEffect } from 'react'
import * as THREE from 'three'

type GlobeState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface NexGlobeProps {
  state: GlobeState
  onClick: () => void
}

export default function NexGlobe({ state, onClick }: NexGlobeProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GlobeState>(state)

  // Keep stateRef in sync — animation loop reads this instead of closure-captured state
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!mountRef.current) return
    const el = mountRef.current

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(96, 96)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.z = 2.8

    const geoOuter = new THREE.IcosahedronGeometry(1, 3)
    const matOuter = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, wireframe: true, transparent: true, opacity: 0.18 })
    const globe = new THREE.Mesh(geoOuter, matOuter)
    scene.add(globe)

    const geoInner = new THREE.SphereGeometry(0.62, 32, 32)
    const matInner = new THREE.MeshBasicMaterial({ color: 0x0d47a1, transparent: true, opacity: 0.85 })
    const innerGlobe = new THREE.Mesh(geoInner, matInner)
    scene.add(innerGlobe)

    const particleCount = 180
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 1.05 + Math.random() * 0.35
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const particleMat = new THREE.PointsMaterial({ color: 0x4fc3f7, size: 0.025, transparent: true, opacity: 0.7 })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    const rings: THREE.Mesh[] = []
    ;[0, Math.PI / 3, -Math.PI / 3].forEach(angle => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.35 })
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.005, 8, 64), mat)
      ring.rotation.x = angle
      scene.add(ring)
      rings.push(ring)
    })

    const clock = new THREE.Clock()
    let animId: number

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const s = stateRef.current

      if (s === 'idle') {
        globe.rotation.y = t * 0.18
        globe.rotation.x = Math.sin(t * 0.1) * 0.08
        matOuter.opacity = 0.18
        matInner.color.setHex(0x0d47a1)
        particleMat.opacity = 0.55
        globe.scale.setScalar(1 + Math.sin(t * 0.8) * 0.012)
        innerGlobe.scale.setScalar(1)
      } else if (s === 'listening') {
        globe.rotation.y = t * 0.55
        matOuter.opacity = 0.4
        matInner.color.setHex(0x1565c0)
        particleMat.opacity = 0.9
        globe.scale.setScalar(1 + Math.sin(t * 6) * 0.06)
        innerGlobe.scale.setScalar(1 + Math.sin(t * 4) * 0.04)
      } else if (s === 'thinking') {
        globe.rotation.y = t * 1.1
        globe.rotation.z = t * 0.3
        matOuter.opacity = 0.5
        matInner.color.setHex(0x0277bd)
        particleMat.opacity = 1
        globe.scale.setScalar(1 + Math.sin(t * 12) * 0.025)
        innerGlobe.scale.setScalar(1)
      } else {
        // speaking
        globe.rotation.y = t * 0.7
        matOuter.opacity = 0.55
        matInner.color.setHex(0x1976d2)
        particleMat.opacity = 0.85
        globe.scale.setScalar(1 + Math.sin(t * 8) * 0.045 + Math.sin(t * 5) * 0.02)
        innerGlobe.scale.setScalar(1 + Math.sin(t * 6) * 0.03)
      }

      rings.forEach((ring, i) => {
        ring.rotation.z = t * (0.2 + i * 0.08)
        ring.rotation.y = t * (0.1 + i * 0.05)
      })
      particles.rotation.y = -t * 0.06
      particles.rotation.x = Math.sin(t * 0.12) * 0.04

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  const glowColor = {
    idle: 'rgba(79,195,247,0.22)',
    listening: 'rgba(79,195,247,0.55)',
    thinking: 'rgba(41,182,246,0.6)',
    speaking: 'rgba(25,118,210,0.5)',
  }[state]

  const ringSize = { idle: '96px', listening: '110px', thinking: '114px', speaking: '106px' }[state]

  return (
    <button
      onClick={onClick}
      title="Talk to Nex"
      style={{
        position: 'relative', width: '96px', height: '96px',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 0, outline: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{
        position: 'absolute', width: ringSize, height: ringSize, borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        transition: 'all 0.4s ease', pointerEvents: 'none',
      }} />
      {(state === 'listening' || state === 'speaking') && (
        <span style={{
          position: 'absolute', width: '124px', height: '124px', borderRadius: '50%',
          border: '1.5px solid rgba(79,195,247,0.4)',
          animation: 'nexPulse 1.2s ease-out infinite', pointerEvents: 'none',
        }} />
      )}
      <div ref={mountRef} style={{ width: 96, height: 96, borderRadius: '50%' }} />
    </button>
  )
}