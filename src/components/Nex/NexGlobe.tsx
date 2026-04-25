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

  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    if (!mountRef.current) return
    const el = mountRef.current
    const SIZE = 160

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(SIZE, SIZE)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.z = 3.8

    // ── CORE — bright glowing sphere ──────────────────────────────
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.95 })
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 32), coreMat)
    scene.add(core)

    // ── INNER ENERGY SPHERE ───────────────────────────────────────
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x0077b6, transparent: true, opacity: 0.6 })
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 32), innerMat)
    scene.add(inner)

    // ── OUTER SHELL — icosahedron wireframe ───────────────────────
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x00b4d8, wireframe: true, transparent: true, opacity: 0.12,
    })
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88, 2), shellMat)
    scene.add(shell)

    // ── ORBITING RINGS — 5 rings on different axes ─────────────────
    const ringDefs = [
      { rx: Math.PI / 2, ry: 0,            rz: 0,            r: 1.05, tube: 0.008, speed: 0.38,  color: 0x00e5ff, opacity: 0.9 },
      { rx: Math.PI / 4, ry: 0,            rz: 0,            r: 1.05, tube: 0.006, speed: -0.26, color: 0x0096c7, opacity: 0.7 },
      { rx: 0,           ry: Math.PI / 3,  rz: Math.PI / 6,  r: 1.12, tube: 0.005, speed: 0.19,  color: 0x48cae4, opacity: 0.55 },
      { rx: Math.PI / 3, ry: Math.PI / 4,  rz: 0,            r: 1.18, tube: 0.004, speed: -0.14, color: 0x90e0ef, opacity: 0.35 },
      { rx: Math.PI / 6, ry: -Math.PI / 3, rz: Math.PI / 4,  r: 1.25, tube: 0.003, speed: 0.10,  color: 0xade8f4, opacity: 0.25 },
    ]

    type RingObj = { mesh: THREE.Mesh; speed: number; mat: THREE.MeshBasicMaterial }
    const rings: RingObj[] = ringDefs.map(def => {
      const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: def.opacity })
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(def.r, def.tube, 8, 128), mat)
      mesh.rotation.set(def.rx, def.ry, def.rz)
      scene.add(mesh)
      return { mesh, speed: def.speed, mat }
    })

    // ── ENERGY ARC PARTICLES — dots orbiting the equator ──────────
    const arcCount = 60
    const arcPositions = new Float32Array(arcCount * 3)
    const arcSpeeds = new Float32Array(arcCount)
    for (let i = 0; i < arcCount; i++) {
      const angle = (i / arcCount) * Math.PI * 2
      const r = 0.95 + Math.random() * 0.15
      arcPositions[i * 3]     = r * Math.cos(angle)
      arcPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.3
      arcPositions[i * 3 + 2] = r * Math.sin(angle)
      arcSpeeds[i] = 0.4 + Math.random() * 0.8
    }
    const arcGeo = new THREE.BufferGeometry()
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3))
    const arcMat = new THREE.PointsMaterial({ color: 0x00e5ff, size: 0.04, transparent: true, opacity: 0.9 })
    const arcParticles = new THREE.Points(arcGeo, arcMat)
    scene.add(arcParticles)

    // ── OUTER PARTICLE CLOUD ───────────────────────────────────────
    const cloudCount = 220
    const cloudPos = new Float32Array(cloudCount * 3)
    for (let i = 0; i < cloudCount; i++) {
      const phi = Math.acos(2 * Math.random() - 1)
      const theta = Math.random() * Math.PI * 2
      const r = 1.32 + Math.random() * 0.28
      cloudPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      cloudPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      cloudPos[i * 3 + 2] = r * Math.cos(phi)
    }
    const cloudGeo = new THREE.BufferGeometry()
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3))
    const cloudMat = new THREE.PointsMaterial({ color: 0x48cae4, size: 0.018, transparent: true, opacity: 0.4 })
    const cloud = new THREE.Points(cloudGeo, cloudMat)
    scene.add(cloud)

    const clock = new THREE.Clock()
    let animId: number

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const s = stateRef.current

      // ── Animate arc particles orbiting ──────────────────────────
      const arcPos = arcGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < arcCount; i++) {
        const baseAngle = (i / arcCount) * Math.PI * 2
        const speed = arcSpeeds[i]
        const angle = baseAngle + t * speed * (s === 'thinking' ? 3 : s === 'listening' ? 1.8 : 1)
        const r = 0.95 + Math.sin(t * 2 + i) * 0.06
        arcPos.setXYZ(
          i,
          r * Math.cos(angle),
          Math.sin(t * 1.5 + i * 0.5) * 0.18,
          r * Math.sin(angle)
        )
      }
      arcPos.needsUpdate = true

      // ── State-driven animation ──────────────────────────────────
      if (s === 'idle') {
        shell.rotation.y = t * 0.12
        shell.rotation.x = Math.sin(t * 0.07) * 0.06
        shellMat.opacity = 0.12
        coreMat.opacity = 0.85 + Math.sin(t * 1.2) * 0.12
        coreMat.color.setHex(0x00e5ff)
        innerMat.opacity = 0.5 + Math.sin(t * 0.9) * 0.08
        arcMat.opacity = 0.6
        cloudMat.opacity = 0.25
        const breathe = 1 + Math.sin(t * 0.9) * 0.015
        shell.scale.setScalar(breathe)
        inner.scale.setScalar(1 + Math.sin(t * 1.1) * 0.02)
        core.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06)

        rings.forEach((r2, i) => {
          r2.mesh.rotation.z += r2.speed * 0.008
          r2.mat.opacity = ringDefs[i].opacity * 0.7
        })

      } else if (s === 'listening') {
        shell.rotation.y = t * 0.35
        shell.rotation.z = t * 0.08
        shellMat.opacity = 0.28
        coreMat.color.setHex(0x00ffea)
        coreMat.opacity = 0.95
        innerMat.opacity = 0.75
        arcMat.opacity = 1.0
        arcMat.color.setHex(0x00ffea)
        cloudMat.opacity = 0.55
        const pulse = 1 + Math.sin(t * 7) * 0.055
        shell.scale.setScalar(pulse)
        inner.scale.setScalar(1 + Math.sin(t * 5) * 0.04)
        core.scale.setScalar(1 + Math.sin(t * 9) * 0.12)

        rings.forEach((r2, i) => {
          r2.mesh.rotation.z += r2.speed * 0.022
          r2.mat.opacity = ringDefs[i].opacity * 1.4
        })

      } else if (s === 'thinking') {
        shell.rotation.y = t * 1.4
        shell.rotation.z = t * 0.45
        shell.rotation.x = t * 0.2
        shellMat.opacity = 0.4
        coreMat.color.setHex(0x7b2fff)
        coreMat.opacity = 1.0
        innerMat.color.setHex(0x3a0ca3)
        innerMat.opacity = 0.85
        arcMat.color.setHex(0xb5a4ff)
        arcMat.opacity = 1.0
        cloudMat.opacity = 0.7
        const spin = 1 + Math.sin(t * 14) * 0.03
        shell.scale.setScalar(spin)
        core.scale.setScalar(1 + Math.sin(t * 18) * 0.15)
        inner.scale.setScalar(1 + Math.sin(t * 11) * 0.06)

        rings.forEach((r2, i) => {
          r2.mesh.rotation.z += r2.speed * 0.045
          r2.mesh.rotation.x += r2.speed * 0.02
          r2.mat.opacity = ringDefs[i].opacity * 1.8
          r2.mat.color.setHex(0x9d4edd)
        })

      } else {
        // speaking
        shell.rotation.y = t * 0.55
        shell.rotation.x = Math.sin(t * 0.3) * 0.12
        shellMat.opacity = 0.32
        coreMat.color.setHex(0x00e5ff)
        coreMat.opacity = 0.9 + Math.sin(t * 12) * 0.1
        innerMat.color.setHex(0x0077b6)
        innerMat.opacity = 0.65 + Math.sin(t * 8) * 0.12
        arcMat.color.setHex(0x00e5ff)
        arcMat.opacity = 0.85 + Math.sin(t * 10) * 0.15
        cloudMat.opacity = 0.45
        const wave = 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 5.5) * 0.025
        shell.scale.setScalar(wave)
        core.scale.setScalar(1 + Math.sin(t * 13) * 0.18)
        inner.scale.setScalar(1 + Math.sin(t * 7) * 0.05)

        rings.forEach((r2, i) => {
          r2.mesh.rotation.z += r2.speed * 0.028
          r2.mat.opacity = ringDefs[i].opacity * (1.2 + Math.sin(t * 6 + i) * 0.4)
          r2.mat.color.setHex(0x00e5ff)
        })
      }

      // Reset inner color when not thinking
      if (s !== 'thinking') innerMat.color.setHex(0x0077b6)

      cloud.rotation.y = t * 0.04
      cloud.rotation.x = Math.sin(t * 0.08) * 0.03

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // CSS glow — colour shifts per state
  const glowDef = {
    idle:      { color: 'rgba(0,229,255,0.18)',  size: '160px', pulse: false },
    listening: { color: 'rgba(0,255,234,0.45)',  size: '180px', pulse: true  },
    thinking:  { color: 'rgba(123,47,255,0.5)',  size: '188px', pulse: true  },
    speaking:  { color: 'rgba(0,229,255,0.38)',  size: '172px', pulse: true  },
  }[state]

  return (
    <button
      onClick={onClick}
      title="Talk to Nex"
      style={{
        position: 'relative',
        width: '160px', height: '160px',
        background: 'none', border: 'none',
        cursor: 'pointer', padding: 0, outline: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Ambient radial glow */}
      <span style={{
        position: 'absolute',
        width: glowDef.size, height: glowDef.size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${glowDef.color} 0%, transparent 68%)`,
        transition: 'all 0.5s ease',
        pointerEvents: 'none',
      }} />

      {/* Outer pulse ring */}
      {glowDef.pulse && (
        <span style={{
          position: 'absolute',
          width: '190px', height: '190px',
          borderRadius: '50%',
          border: state === 'thinking'
            ? '1px solid rgba(123,47,255,0.5)'
            : '1px solid rgba(0,229,255,0.35)',
          animation: 'nexPulse 1.4s ease-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Second slower pulse ring */}
      {glowDef.pulse && (
        <span style={{
          position: 'absolute',
          width: '210px', height: '210px',
          borderRadius: '50%',
          border: state === 'thinking'
            ? '1px solid rgba(123,47,255,0.25)'
            : '1px solid rgba(0,229,255,0.15)',
          animation: 'nexPulse 1.4s ease-out 0.5s infinite',
          pointerEvents: 'none',
        }} />
      )}

      <div ref={mountRef} style={{ width: 160, height: 160 }} />
    </button>
  )
}