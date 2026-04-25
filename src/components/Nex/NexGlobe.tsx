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
    const SIZE = 80

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(SIZE, SIZE)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.z = 3.2

    // Core — bright center
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.95 })
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 32), coreMat)
    scene.add(core)

    // Inner sphere
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.55 })
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.46, 32, 32), innerMat)
    scene.add(inner)

    // Outer icosahedron wireframe shell
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.14,
    })
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 2), shellMat)
    scene.add(shell)

    // Orbiting rings — purple to pink gradient feel via separate colors
    const ringDefs = [
      { rx: Math.PI / 2, ry: 0,           rz: 0,           r: 0.98, tube: 0.007, speed: 0.42,  color: 0xc084fc, opacity: 0.95 },
      { rx: Math.PI / 4, ry: 0,           rz: 0,           r: 0.98, tube: 0.005, speed: -0.28, color: 0xa855f7, opacity: 0.7  },
      { rx: 0,           ry: Math.PI / 3, rz: Math.PI / 6, r: 1.06, tube: 0.004, speed: 0.18,  color: 0xec4899, opacity: 0.5  },
      { rx: Math.PI / 3, ry: Math.PI / 4, rz: 0,           r: 1.12, tube: 0.003, speed: -0.13, color: 0xf472b6, opacity: 0.3  },
    ]

    type RingObj = { mesh: THREE.Mesh; speed: number; mat: THREE.MeshBasicMaterial; baseOpacity: number }
    const rings: RingObj[] = ringDefs.map(def => {
      const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: def.opacity })
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(def.r, def.tube, 8, 96), mat)
      mesh.rotation.set(def.rx, def.ry, def.rz)
      scene.add(mesh)
      return { mesh, speed: def.speed, mat, baseOpacity: def.opacity }
    })

    // Arc particles orbiting equator
    const arcCount = 48
    const arcPositions = new Float32Array(arcCount * 3)
    const arcSpeeds = new Float32Array(arcCount)
    for (let i = 0; i < arcCount; i++) {
      const angle = (i / arcCount) * Math.PI * 2
      const r = 0.88 + Math.random() * 0.12
      arcPositions[i * 3]     = r * Math.cos(angle)
      arcPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.22
      arcPositions[i * 3 + 2] = r * Math.sin(angle)
      arcSpeeds[i] = 0.5 + Math.random() * 0.9
    }
    const arcGeo = new THREE.BufferGeometry()
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3))
    const arcMat = new THREE.PointsMaterial({ color: 0xc084fc, size: 0.035, transparent: true, opacity: 0.85 })
    const arcParticles = new THREE.Points(arcGeo, arcMat)
    scene.add(arcParticles)

    const clock = new THREE.Clock()
    let animId: number

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      const s = stateRef.current

      // Animate arc particles
      const arcPos = arcGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < arcCount; i++) {
        const base = (i / arcCount) * Math.PI * 2
        const spd = arcSpeeds[i] * (s === 'thinking' ? 3.5 : s === 'listening' ? 2 : 1)
        const angle = base + t * spd
        const r = 0.88 + Math.sin(t * 1.5 + i) * 0.05
        arcPos.setXYZ(i,
          r * Math.cos(angle),
          Math.sin(t + i * 0.4) * 0.12,
          r * Math.sin(angle)
        )
      }
      arcPos.needsUpdate = true

      if (s === 'idle') {
        shell.rotation.y = t * 0.14
        shell.rotation.x = Math.sin(t * 0.08) * 0.05
        shellMat.opacity = 0.14
        coreMat.color.setHex(0xc084fc)
        coreMat.opacity = 0.88 + Math.sin(t * 1.1) * 0.1
        innerMat.opacity = 0.45 + Math.sin(t * 0.85) * 0.07
        arcMat.color.setHex(0xc084fc)
        arcMat.opacity = 0.55
        shell.scale.setScalar(1 + Math.sin(t * 0.85) * 0.014)
        inner.scale.setScalar(1 + Math.sin(t * 1.0) * 0.02)
        core.scale.setScalar(1 + Math.sin(t * 1.3) * 0.06)
        rings.forEach((r2) => {
          r2.mesh.rotation.z += r2.speed * 0.009
          r2.mat.opacity = r2.baseOpacity * 0.65
        })

      } else if (s === 'listening') {
        shell.rotation.y = t * 0.38
        shell.rotation.z = t * 0.07
        shellMat.opacity = 0.26
        coreMat.color.setHex(0xe879f9)
        coreMat.opacity = 1.0
        innerMat.opacity = 0.72
        arcMat.color.setHex(0xf0abfc)
        arcMat.opacity = 1.0
        const pulse = 1 + Math.sin(t * 7) * 0.05
        shell.scale.setScalar(pulse)
        inner.scale.setScalar(1 + Math.sin(t * 5) * 0.04)
        core.scale.setScalar(1 + Math.sin(t * 9) * 0.13)
        rings.forEach((r2) => {
          r2.mesh.rotation.z += r2.speed * 0.024
          r2.mat.opacity = r2.baseOpacity * 1.35
        })

      } else if (s === 'thinking') {
        shell.rotation.y = t * 1.5
        shell.rotation.z = t * 0.5
        shell.rotation.x = t * 0.22
        shellMat.opacity = 0.38
        coreMat.color.setHex(0xf472b6)
        coreMat.opacity = 1.0
        innerMat.opacity = 0.82
        arcMat.color.setHex(0xfda4af)
        arcMat.opacity = 1.0
        shell.scale.setScalar(1 + Math.sin(t * 14) * 0.028)
        core.scale.setScalar(1 + Math.sin(t * 18) * 0.16)
        inner.scale.setScalar(1 + Math.sin(t * 10) * 0.06)
        rings.forEach((r2) => {
          r2.mesh.rotation.z += r2.speed * 0.048
          r2.mesh.rotation.x += r2.speed * 0.018
          r2.mat.opacity = r2.baseOpacity * 1.9
        })

      } else {
        // speaking
        shell.rotation.y = t * 0.52
        shell.rotation.x = Math.sin(t * 0.28) * 0.1
        shellMat.opacity = 0.3
        coreMat.color.setHex(0xc084fc)
        coreMat.opacity = 0.92 + Math.sin(t * 11) * 0.08
        innerMat.opacity = 0.62 + Math.sin(t * 7.5) * 0.1
        arcMat.color.setHex(0xd8b4fe)
        arcMat.opacity = 0.9 + Math.sin(t * 9) * 0.1
        const wave = 1 + Math.sin(t * 9) * 0.055 + Math.sin(t * 5.5) * 0.022
        shell.scale.setScalar(wave)
        core.scale.setScalar(1 + Math.sin(t * 13) * 0.17)
        inner.scale.setScalar(1 + Math.sin(t * 6.5) * 0.05)
        rings.forEach((r2, i) => {
          r2.mesh.rotation.z += r2.speed * 0.03
          r2.mat.opacity = r2.baseOpacity * (1.15 + Math.sin(t * 5 + i) * 0.35)
        })
      }

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
    idle:      'rgba(139,92,246,0.2)',
    listening: 'rgba(192,132,252,0.45)',
    thinking:  'rgba(236,72,153,0.45)',
    speaking:  'rgba(139,92,246,0.35)',
  }[state]

  const glowSize = {
    idle: '80px', listening: '96px', thinking: '100px', speaking: '90px',
  }[state]

  return (
    <button
      onClick={onClick}
      title="Talk to Nex"
      style={{
        position: 'relative',
        width: '80px', height: '80px',
        background: 'none', border: 'none',
        cursor: 'pointer', padding: 0, outline: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Glow */}
      <span style={{
        position: 'absolute',
        width: glowSize, height: glowSize,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        transition: 'all 0.45s ease',
        pointerEvents: 'none',
      }} />

      {/* Pulse rings — only when active */}
      {state !== 'idle' && (
        <>
          <span style={{
            position: 'absolute', width: '104px', height: '104px', borderRadius: '50%',
            border: state === 'thinking'
              ? '1px solid rgba(236,72,153,0.4)'
              : '1px solid rgba(139,92,246,0.4)',
            animation: 'nexPulse 1.5s ease-out infinite',
            pointerEvents: 'none',
          }} />
          <span style={{
            position: 'absolute', width: '120px', height: '120px', borderRadius: '50%',
            border: state === 'thinking'
              ? '1px solid rgba(236,72,153,0.2)'
              : '1px solid rgba(139,92,246,0.2)',
            animation: 'nexPulse 1.5s ease-out 0.55s infinite',
            pointerEvents: 'none',
          }} />
        </>
      )}

      <div ref={mountRef} style={{ width: 80, height: 80 }} />
    </button>
  )
}