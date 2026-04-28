import { useMemo, useRef, useEffect, useState } from 'react'
import { useFlowData } from '../../hooks/useFlowData'
import type { FlowBranch, FlowTask } from '../../hooks/useFlowData'

interface FlowGraphProps {
  workspaceId: string | null
  userId: string | null
  onBranchClick: (branch: FlowBranch) => void
}

// ── Layout constants ──────────────────────────────────────────────
const TRUNK_Y         = 480   // vertical center of the SVG
const NODE_R          = 18    // task node radius
const TRUNK_NODE_R    = 22    // milestone node radius
const BRANCH_OFFSET   = 200   // how far above/below trunk branches run
const NODE_SPACING    = 120   // horizontal space between task nodes
const BRANCH_START_X  = 220   // where first branch origin starts
const BRANCH_GAP      = 360   // horizontal gap between branches
const SVG_HEIGHT      = 900

function statusFill(status: string): string {
  switch (status) {
    case 'done':        return '#22c55e'
    case 'in_progress': return '#3b82f6'
    case 'review':      return '#f59e0b'
    default:            return 'transparent'
  }
}
function statusBorder(status: string): string {
  switch (status) {
    case 'done':        return '#22c55e'
    case 'in_progress': return '#3b82f6'
    case 'review':      return '#f59e0b'
    default:            return 'rgba(255,255,255,0.2)'
  }
}
function statusIcon(status: string): string {
  switch (status) {
    case 'done':        return '✓'
    case 'in_progress': return '⚡'
    case 'review':      return '👁'
    default:            return '○'
  }
}
function isOverdue(task: FlowTask): boolean {
  if (!task.due_date || task.status === 'done') return false
  return new Date(task.due_date) < new Date()
}

interface NodeLayout { task: FlowTask; x: number; y: number }
interface BranchLayout {
  branch: FlowBranch
  above: boolean          // true = above trunk, false = below
  originX: number         // where branch forks from trunk
  branchY: number         // y of the horizontal branch line
  nodes: NodeLayout[]
  endX: number
  progress: number
}

function deadlineHealth(branches: FlowBranch[]): { label: string; color: string } {
  if (!branches.length) return { label: 'NO DATA', color: '#6b7280' }
  const avg = branches.reduce((s, b) => s + b.progress, 0) / branches.length
  if (avg >= 70) return { label: 'ON TRACK', color: '#22c55e' }
  if (avg >= 40) return { label: 'AT RISK', color: '#f59e0b' }
  return { label: 'BEHIND', color: '#ef4444' }
}

export default function FlowGraph({ workspaceId, onBranchClick }: FlowGraphProps) {
  const { branches, totalTasks, totalDone, overallProgress, loading, error } = useFlowData(workspaceId)
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode]     = useState<string | null>(null)
  const [tooltip, setTooltip]             = useState<{ x: number; y: number; task: FlowTask; branch: FlowBranch } | null>(null)
  const [standupMode, setStandupMode]     = useState(false)
  const [viewBy, setViewBy]               = useState<'person' | 'feature'>('person')
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── Build layout ──────────────────────────────────────────────
  const layout = useMemo<{ branches: BranchLayout[]; svgWidth: number; nowX: number } | null>(() => {
    if (!branches.length) return null

    let x = BRANCH_START_X
    const result: BranchLayout[] = []

    branches.forEach((branch, idx) => {
      const above = idx % 2 === 0  // alternate above/below
      const branchY = above ? TRUNK_Y - BRANCH_OFFSET : TRUNK_Y + BRANCH_OFFSET
      const originX = x + 60

      const nodes: NodeLayout[] = branch.tasks.map((task, i) => ({
        task,
        x: originX + i * NODE_SPACING,
        y: branchY,
      }))

      const endX = nodes.length > 0 ? nodes[nodes.length - 1].x : originX

      result.push({ branch, above, originX, branchY, nodes, endX, progress: branch.progress })
      x += Math.max(branch.tasks.length * NODE_SPACING + 120, BRANCH_GAP)
    })

    const svgWidth = x + 200
    // "now" = center of svg for initial scroll
    const nowX = svgWidth * 0.45

    return { branches: result, svgWidth, nowX }
  }, [branches])

  // Auto-scroll to NOW on mount
  useEffect(() => {
    if (!layout || !scrollRef.current) return
    const el = scrollRef.current
    const scrollTo = layout.nowX - el.clientWidth / 2
    el.scrollLeft = Math.max(0, scrollTo)
  }, [layout])

  const health = deadlineHealth(branches)
  const nR = standupMode ? NODE_R + 12 : NODE_R

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '500px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '44px', height: '44px', margin: '0 auto 14px', border: '2px solid rgba(139,92,246,0.15)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'fgSpin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono', fontSize: '10px', letterSpacing: '0.2em' }}>LOADING FLOW…</p>
      </div>
      <style>{`@keyframes fgSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '500px' }}>
      <p style={{ color: '#f87171', fontFamily: 'Space Grotesk' }}>{error}</p>
    </div>
  )

  if (!layout) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '500px', gap: '12px' }}>
      <p style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono', fontSize: '11px', letterSpacing: '0.2em' }}>NO BRANCHES YET</p>
      <p style={{ color: 'rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk', fontSize: '13px' }}>Assign tasks to members to see the execution map.</p>
    </div>
  )

  const trunkEnd = layout.svgWidth - 60
  const nowX     = layout.nowX
  const pastX    = nowX * 0.45

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap', gap: '12px' }}>

        {/* Left: stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          {/* Circular progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', width: '44px', height: '44px' }}>
              <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="cpg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="url(#cpg)" strokeWidth="3"
                  strokeDasharray={`${(overallProgress / 100) * 113.1} 113.1`}
                  strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: '9px', fontFamily: 'Space Mono', fontWeight: 700 }}>{overallProgress}%</span>
              </div>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.18em', margin: '0 0 2px' }}>OVERALL</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>{totalDone}/{totalTasks} tasks</p>
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.07)' }} />

          {/* Deadline health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${health.color}14`, border: `1px solid ${health.color}40`, borderRadius: '8px', padding: '6px 14px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: health.color, boxShadow: `0 0 8px ${health.color}` }} />
            <span style={{ color: health.color, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.12em' }}>{health.label}</span>
          </div>

          {/* Branch count */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { label: 'BRANCHES', value: branches.length, color: '#a78bfa' },
              { label: 'DONE', value: totalDone, color: '#22c55e' },
              { label: 'ACTIVE', value: branches.reduce((s, b) => s + b.tasks.filter(t => t.status === 'in_progress').length, 0), color: '#3b82f6' },
              { label: 'BLOCKED', value: branches.reduce((s, b) => s + b.tasks.filter(t => isOverdue(t)).length, 0), color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ color: s.color, fontSize: '16px', fontFamily: 'Space Mono', fontWeight: 700, margin: 0 }}>{s.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '8px', fontFamily: 'Space Mono', letterSpacing: '0.15em', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View By toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '3px' }}>
            {(['person', 'feature'] as const).map(v => (
              <button key={v} onClick={() => setViewBy(v)}
                style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: viewBy === v ? 'rgba(139,92,246,0.3)' : 'transparent', color: viewBy === v ? '#a78bfa' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.08em', transition: 'all 0.15s', textTransform: 'uppercase' }}>
                {v}
              </button>
            ))}
          </div>

          {/* Standup mode */}
          <button onClick={() => setStandupMode(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: standupMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${standupMode ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: standupMode ? '#f87171' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', letterSpacing: '0.08em', transition: 'all 0.2s' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: standupMode ? '#ef4444' : 'rgba(255,255,255,0.3)', animation: standupMode ? 'fgPulse 1s ease-in-out infinite' : 'none' }} />
            {standupMode ? 'STANDUP LIVE' : 'STANDUP'}
          </button>
        </div>
      </div>

      {/* ── BRANCH LEGEND PILLS ── */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto', flexShrink: 0 }}>
        {branches.map(b => (
          <div key={b.id} onClick={() => onBranchClick(b)}
            onMouseEnter={() => setHoveredBranch(b.id)}
            onMouseLeave={() => setHoveredBranch(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px 5px 6px', background: hoveredBranch === b.id ? `${b.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${hoveredBranch === b.id ? b.color + '55' : 'rgba(255,255,255,0.07)'}`, borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
            {/* Avatar */}
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${b.color}66`, overflow: 'hidden', flexShrink: 0 }}>
              {b.avatar_url ? (
                <img src={b.avatar_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${b.color}cc, ${b.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, fontFamily: 'Space Grotesk', color: 'white' }}>
                  {b.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontFamily: 'Space Grotesk' }}>{b.name.split(' ')[0]}</span>
            <div style={{ width: '36px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
              <div style={{ width: `${b.progress}%`, height: '100%', background: b.color, borderRadius: '2px' }} />
            </div>
            <span style={{ color: b.color, fontSize: '10px', fontFamily: 'Space Mono' }}>{b.progress}%</span>
          </div>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { label: 'Done',     color: '#22c55e' },
            { label: 'Active',   color: '#3b82f6' },
            { label: 'Review',   color: '#f59e0b' },
            { label: 'Overdue',  color: '#ef4444' },
            { label: 'Planned',  color: 'rgba(255,255,255,0.2)' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SVG GRAPH ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative', cursor: 'grab' }}>
        <svg width={layout.svgWidth} height={SVG_HEIGHT} style={{ display: 'block' }}>
          <defs>
            {/* Trunk gradient: green → purple → grey */}
            <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.6" />
              <stop offset={`${(pastX / layout.svgWidth) * 100}%`} stopColor="#22c55e" stopOpacity="0.4" />
              <stop offset={`${(nowX / layout.svgWidth) * 100}%`}  stopColor="#8b5cf6" stopOpacity="0.9" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.1)" stopOpacity="0.15" />
            </linearGradient>

            {/* Branch gradients */}
            {layout.branches.map(({ branch }) => (
              <linearGradient key={branch.id} id={`bgrad-${branch.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={branch.color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={branch.color} stopOpacity="0.2" />
              </linearGradient>
            ))}

            {/* Glow filters */}
            <filter id="trunkGlow" x="-10%" y="-200%" width="120%" height="500%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {layout.branches.map(({ branch }) => (
              <filter key={branch.id} id={`glow-${branch.id}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}

            {/* Pulse animation filter */}
            <filter id="pulseGlow">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── ZONE DIVIDERS ── */}
          {/* PAST | NOW divider */}
          <line x1={pastX} y1={60} x2={pastX} y2={SVG_HEIGHT - 40}
            stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />
          <circle cx={pastX} cy={TRUNK_Y} r={5} fill="rgba(255,255,255,0.15)" />
          <text x={pastX + 8} y={76} fill="rgba(255,255,255,0.15)" fontSize={9} fontFamily="Space Mono" letterSpacing="2">PAST</text>
          <text x={pastX + 8} y={SVG_HEIGHT - 50} fill="rgba(255,255,255,0.1)" fontSize={9} fontFamily="Space Mono" letterSpacing="2">NOW →</text>

          {/* NOW | UPCOMING divider */}
          <line x1={nowX} y1={60} x2={nowX} y2={SVG_HEIGHT - 40}
            stroke="rgba(139,92,246,0.2)" strokeWidth={1} strokeDasharray="4 4" />
          <circle cx={nowX} cy={TRUNK_Y} r={5} fill="rgba(139,92,246,0.4)" />
          <text x={nowX + 8} y={76} fill="rgba(139,92,246,0.4)" fontSize={9} fontFamily="Space Mono" letterSpacing="2">NOW</text>
          <text x={nowX + 8} y={SVG_HEIGHT - 50} fill="rgba(139,92,246,0.25)" fontSize={9} fontFamily="Space Mono" letterSpacing="2">UPCOMING →</text>

          {/* Zone background tints */}
          <rect x={0} y={0} width={pastX} height={SVG_HEIGHT} fill="rgba(34,197,94,0.015)" />
          <rect x={pastX} y={0} width={nowX - pastX} height={SVG_HEIGHT} fill="rgba(139,92,246,0.02)" />
          <rect x={nowX} y={0} width={layout.svgWidth - nowX} height={SVG_HEIGHT} fill="rgba(255,255,255,0.008)" />

          {/* ── TRUNK LINE ── */}
          {/* Glow layer */}
          <line x1={60} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y}
            stroke="rgba(139,92,246,0.15)" strokeWidth={12} strokeLinecap="round" filter="url(#trunkGlow)" />
          {/* Main trunk */}
          <line x1={60} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y}
            stroke="url(#trunkGrad)" strokeWidth={2.5} strokeLinecap="round" />
          {/* Arrow */}
          <polygon points={`${trunkEnd + 16},${TRUNK_Y} ${trunkEnd},${TRUNK_Y - 7} ${trunkEnd},${TRUNK_Y + 7}`}
            fill="rgba(255,255,255,0.12)" />

          {/* Milestone nodes on trunk */}
          {[
            { label: 'Project\nstart', x: 80 },
            { label: 'MVP\nshipped', x: pastX },
            { label: 'Beta\nlive', x: nowX },
            { label: 'Public\nlaunch', x: layout.svgWidth - 120 },
          ].map(({ label, x }) => {
            const isPast = x < pastX
            const isNow  = x >= pastX && x < nowX
            const fill   = isPast ? '#22c55e' : isNow ? '#8b5cf6' : 'transparent'
            const stroke = isPast ? '#22c55e' : isNow ? '#8b5cf6' : 'rgba(255,255,255,0.15)'
            return (
              <g key={label}>
                {/* Outer ring */}
                <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R + 6} fill="none" stroke={stroke} strokeWidth={1} strokeOpacity={0.2} />
                {/* Node */}
                <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R}
                  fill={isPast || isNow ? fill : 'rgba(8,4,18,0.9)'}
                  stroke={stroke} strokeWidth={2}
                  filter={isPast || isNow ? `url(#trunkGlow)` : undefined}
                />
                {/* Icon */}
                <text x={x} y={TRUNK_Y + 5} textAnchor="middle"
                  fill={isPast ? 'rgba(0,0,0,0.8)' : isNow ? 'white' : 'rgba(255,255,255,0.25)'}
                  fontSize={14} fontFamily="Space Mono">
                  {isPast ? '✓' : isNow ? '⚡' : '○'}
                </text>
                {/* Label — above for even milestones, below for odd */}
                {label.split('\n').map((line, li) => (
                  <text key={li} x={x} y={TRUNK_Y + TRUNK_NODE_R + 18 + li * 14}
                    textAnchor="middle"
                    fill={isPast ? '#22c55e' : isNow ? '#a78bfa' : 'rgba(255,255,255,0.25)'}
                    fontSize={10} fontFamily="Space Grotesk" fontWeight={600}>
                    {line}
                  </text>
                ))}
              </g>
            )
          })}

          {/* ── BRANCHES ── */}
          {layout.branches.map(({ branch, above, originX, branchY, nodes, endX }) => {
            const isHov = hoveredBranch === branch.id
            const isDimmed = standupMode && hoveredBranch !== null && hoveredBranch !== branch.id

            return (
              <g key={branch.id}
                opacity={isDimmed ? 0.15 : 1}
                style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredBranch(branch.id)}
                onMouseLeave={() => setHoveredBranch(null)}
                onClick={() => onBranchClick(branch)}
              >
                {/* Fork line from trunk — diagonal */}
                <path
                  d={`M ${originX} ${TRUNK_Y} Q ${originX} ${(TRUNK_Y + branchY) / 2} ${originX + 60} ${branchY}`}
                  fill="none"
                  stroke={`url(#bgrad-${branch.id})`}
                  strokeWidth={isHov ? 2.5 : 1.5}
                  style={{ transition: 'stroke-width 0.2s' }}
                />

                {/* Junction dot on trunk */}
                <circle cx={originX} cy={TRUNK_Y} r={isHov ? 7 : 5}
                  fill={branch.color} opacity={isHov ? 0.9 : 0.5}
                  filter={isHov ? `url(#glow-${branch.id})` : undefined}
                  style={{ transition: 'all 0.2s' }}
                />

                {/* Horizontal branch line */}
                <line
                  x1={originX + 60} y1={branchY}
                  x2={endX} y2={branchY}
                  stroke={branch.color}
                  strokeWidth={isHov ? 2 : 1.5}
                  strokeOpacity={isHov ? 0.6 : 0.3}
                  style={{ transition: 'all 0.2s' }}
                />

                {/* Branch label chip */}
                <foreignObject
                  x={originX + 55}
                  y={above ? branchY - 52 : branchY + 16}
                  width={160} height={34}
                  style={{ overflow: 'visible', pointerEvents: 'none' }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `${branch.color}18`, border: `1px solid ${branch.color}55`, borderRadius: '16px', padding: '4px 10px 4px 5px', backdropFilter: 'blur(8px)' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `1.5px solid ${branch.color}88`, overflow: 'hidden', flexShrink: 0 }}>
                      {branch.avatar_url ? (
                        <img src={branch.avatar_url} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${branch.color}cc, ${branch.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, fontFamily: 'Space Grotesk', color: 'white' }}>
                          {branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      )}
                    </div>
                    <span style={{ color: branch.color, fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {branch.name.length > 14 ? branch.name.slice(0, 13) + '…' : branch.name}
                    </span>
                    <span style={{ color: branch.color, fontSize: '10px', fontFamily: 'Space Mono', opacity: 0.7 }}>{branch.progress}%</span>
                  </div>
                </foreignObject>

                {/* Progress bar under/above branch line */}
                <line
                  x1={originX + 60} y1={above ? branchY - 6 : branchY + 6}
                  x2={originX + 60 + (endX - originX - 60) * (branch.progress / 100)} y2={above ? branchY - 6 : branchY + 6}
                  stroke={branch.color} strokeWidth={3} strokeOpacity={0.4} strokeLinecap="round"
                />

                {/* ── TASK NODES ── */}
                {nodes.map(({ task, x, y }, ni) => {
                  const overdue  = isOverdue(task)
                  const isDone   = task.status === 'done'
                  const isActive = task.status === 'in_progress'
                  const isReview = task.status === 'review'
                  const isNH     = hoveredNode === task.id
                  const fill     = overdue ? '#ef4444' : statusFill(task.status)
                  const border   = overdue ? '#ef4444' : statusBorder(task.status)
                  const icon     = overdue ? '!' : statusIcon(task.status)
                  const nr       = standupMode ? nR : NODE_R

                  return (
                    <g key={task.id}
                      onMouseEnter={(e) => {
                        setHoveredNode(task.id)
                        const rect = scrollRef.current?.getBoundingClientRect()
                        if (rect) setTooltip({ x: e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0), y: e.clientY - rect.top, task, branch })
                      }}
                      onMouseLeave={() => { setHoveredNode(null); setTooltip(null) }}
                      onClick={(e) => { e.stopPropagation(); onBranchClick(branch) }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Connector */}
                      {ni > 0 && (
                        <line x1={nodes[ni - 1].x + NODE_R} y1={y} x2={x - NODE_R} y2={y}
                          stroke={branch.color} strokeWidth={1} strokeOpacity={0.2} />
                      )}

                      {/* Pulse ring — overdue or review */}
                      {(overdue || isReview || isActive) && (
                        <circle cx={x} cy={y} r={nr + 8}
                          fill="none" stroke={border} strokeWidth={1.5} strokeOpacity={0.3}
                          style={{ animation: `fgPulse ${overdue ? '0.8' : '2'}s ease-in-out infinite` }}
                        />
                      )}

                      {/* Outer hover ring */}
                      {isNH && (
                        <circle cx={x} cy={y} r={nr + 12} fill="none" stroke={border} strokeWidth={1} strokeOpacity={0.2} />
                      )}

                      {/* Node circle */}
                      <circle cx={x} cy={y} r={nr}
                        fill={isDone ? fill : `rgba(8,4,18,0.92)`}
                        stroke={border}
                        strokeWidth={overdue ? 2.5 : isNH ? 2.5 : 2}
                        strokeDasharray={task.status === 'todo' ? '4 3' : 'none'}
                        filter={isActive || overdue ? `url(#glow-${branch.id})` : undefined}
                        style={{ transition: 'all 0.15s' }}
                      />

                      {/* Status icon */}
                      <text x={x} y={y + 5} textAnchor="middle"
                        fill={isDone ? 'rgba(0,0,0,0.85)' : border}
                        fontSize={standupMode ? 14 : 12} fontFamily="Space Mono">
                        {icon}
                      </text>

                      {/* Task label */}
                      <text x={x} y={above ? y - nr - 10 : y + nr + 16}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.55)"
                        fontSize={standupMode ? 11 : 9}
                        fontFamily="Space Grotesk"
                        style={{ pointerEvents: 'none' }}>
                        {task.title.length > 14 ? task.title.slice(0, 13) + '…' : task.title}
                      </text>

                      {/* Due date label */}
                      {task.due_date && (
                        <text x={x} y={above ? y - nr - 22 : y + nr + 28}
                          textAnchor="middle"
                          fill={overdue ? '#ef444466' : 'rgba(255,255,255,0.2)'}
                          fontSize={8} fontFamily="Space Mono">
                          {task.due_date.slice(5)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>

        {/* ── TOOLTIP ── */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: Math.min(tooltip.x + 16, 800 - 240),
            top: tooltip.y - 60,
            background: 'rgba(6,3,15,0.98)',
            border: `1px solid ${tooltip.branch.color}40`,
            borderRadius: '12px', padding: '10px 14px',
            pointerEvents: 'none', zIndex: 200, width: '220px',
            boxShadow: `0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px ${tooltip.branch.color}20`,
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOverdue(tooltip.task) ? '#ef4444' : statusBorder(tooltip.task.status), flexShrink: 0 }} />
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>{tooltip.task.title}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                {tooltip.task.status.replace('_', ' ').toUpperCase()}
              </span>
              {tooltip.task.due_date && (
                <span style={{ color: isOverdue(tooltip.task) ? '#f87171' : 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                  · {isOverdue(tooltip.task) ? 'OVERDUE' : tooltip.task.due_date}
                </span>
              )}
              {tooltip.task.priority === 'high' && (
                <span style={{ color: '#f59e0b', fontSize: '10px', fontFamily: 'Space Mono' }}>· HIGH PRIORITY</span>
              )}
            </div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: `linear-gradient(135deg, ${tooltip.branch.color}cc, ${tooltip.branch.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, fontFamily: 'Space Grotesk', color: 'white' }}>
                {tooltip.branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span style={{ color: tooltip.branch.color, fontSize: '10px', fontFamily: 'Space Grotesk' }}>{tooltip.branch.name}</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Space Mono' }}>Click to open board →</span>
            </div>
          </div>
        )}
      </div>

      {/* ── SCROLL HINT ── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>← SCROLL TO EXPLORE →</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '24px', height: '3px', background: 'linear-gradient(90deg, #22c55e, #22c55e)', borderRadius: '2px' }} />
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: 'Space Mono' }}>PAST</span>
            <div style={{ width: '24px', height: '3px', background: 'linear-gradient(90deg, #8b5cf6, #8b5cf6)', borderRadius: '2px' }} />
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: 'Space Mono' }}>NOW</span>
            <div style={{ width: '24px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }} />
            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '9px', fontFamily: 'Space Mono' }}>UPCOMING</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fgSpin { to { transform: rotate(360deg); } }
        @keyframes fgPulse { 0%,100% { opacity:0.3; transform:scale(1); } 50% { opacity:0.8; transform:scale(1.15); } }
      `}</style>
    </div>
  )
}