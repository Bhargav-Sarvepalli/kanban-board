import { useMemo, useRef, useState, useEffect } from 'react'
import { useFlowData } from '../../hooks/useFlowData'
import type { FlowBranch, FlowTask } from '../../hooks/useFlowData'

interface FlowGraphProps {
  workspaceId: string | null
  userId: string | null
  onBranchClick: (branch: FlowBranch) => void
}

const NODE_R         = 16
const TRUNK_NODE_R   = 22
const BRANCH_OFFSET  = 160
const NODE_SPACING   = 130
const BRANCH_START_X = 220
const BRANCH_GAP     = 340

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
  above: boolean
  originX: number
  branchY: number
  nodes: NodeLayout[]
  endX: number
}

function deadlineHealth(branches: FlowBranch[]): { label: string; color: string } {
  if (!branches.length) return { label: 'NO DATA', color: '#6b7280' }
  const avg = branches.reduce((s, b) => s + b.progress, 0) / branches.length
  if (avg >= 70) return { label: 'ON TRACK', color: '#22c55e' }
  if (avg >= 40) return { label: 'AT RISK',  color: '#f59e0b' }
  return { label: 'BEHIND', color: '#ef4444' }
}

export default function FlowGraph({ workspaceId, onBranchClick }: FlowGraphProps) {
  const { branches, totalTasks, totalDone, overallProgress, loading, error } = useFlowData(workspaceId)
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode]     = useState<string | null>(null)
  const [tooltip, setTooltip]             = useState<{ x: number; y: number; task: FlowTask; branch: FlowBranch } | null>(null)
  const [standupMode, setStandupMode]     = useState(false)
  const [viewBy, setViewBy]               = useState<'person' | 'feature'>('person')
  const [isDragging, setIsDragging]       = useState(false)
  const [dragStart, setDragStart]         = useState({ x: 0, scroll: 0 })
  const [containerH, setContainerH]       = useState(500)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Measure actual container height so trunk is always centered
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerH(e.contentRect.height)
    })
    ro.observe(el)
    setContainerH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // TRUNK_Y = center of the measured container, with a slight upward bias
  const TRUNK_Y  = Math.max(180, containerH * 0.45)
  const SVG_H    = containerH

  const layout = useMemo<{ branches: BranchLayout[]; svgWidth: number; nowX: number } | null>(() => {
    if (!branches.length) return null
    let x = BRANCH_START_X
    const result: BranchLayout[] = []
    branches.forEach((branch, idx) => {
      const above   = idx % 2 === 0
      const branchY = above ? TRUNK_Y - BRANCH_OFFSET : TRUNK_Y + BRANCH_OFFSET
      const originX = x + 60
      const nodes: NodeLayout[] = branch.tasks.map((task, i) => ({
        task, x: originX + i * NODE_SPACING, y: branchY,
      }))
      const endX = nodes.length > 0 ? nodes[nodes.length - 1].x : originX
      result.push({ branch, above, originX, branchY, nodes, endX })
      x += Math.max(branch.tasks.length * NODE_SPACING + 120, BRANCH_GAP)
    })
    const svgWidth = x + 200
    const nowX     = svgWidth * 0.45
    return { branches: result, svgWidth, nowX }
  }, [branches, TRUNK_Y])

  // Auto-scroll to NOW
  useEffect(() => {
    if (!layout || !scrollRef.current) return
    const el  = scrollRef.current
    const scrollTo = layout.nowX - el.clientWidth / 2
    el.scrollLeft = Math.max(0, scrollTo)
  }, [layout])

  const health = deadlineHealth(branches)
  const nR     = standupMode ? NODE_R + 8 : NODE_R

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', margin: '0 auto 12px', border: '2px solid rgba(139,92,246,0.15)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'fgSpin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono', fontSize: '10px', letterSpacing: '0.2em' }}>LOADING FLOW…</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <p style={{ color: '#f87171', fontFamily: 'Space Grotesk' }}>{error}</p>
    </div>
  )

  if (!layout) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px' }}>
      <p style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono', fontSize: '11px', letterSpacing: '0.2em' }}>NO BRANCHES YET</p>
      <p style={{ color: 'rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk', fontSize: '13px' }}>Assign tasks to members to see the execution map.</p>
    </div>
  )

  const trunkEnd = layout.svgWidth - 60
  const nowX     = layout.nowX
  const pastX    = nowX * 0.45

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Circular progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

          <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.07)' }} />

          {/* Health */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${health.color}14`, border: `1px solid ${health.color}40`, borderRadius: '8px', padding: '5px 12px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: health.color, boxShadow: `0 0 8px ${health.color}` }} />
            <span style={{ color: health.color, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.1em' }}>{health.label}</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { label: 'BRANCHES', value: branches.length, color: '#a78bfa' },
              { label: 'DONE',     value: totalDone,       color: '#22c55e' },
              { label: 'ACTIVE',   value: branches.reduce((s, b) => s + b.tasks.filter(t => t.status === 'in_progress').length, 0), color: '#3b82f6' },
              { label: 'OVERDUE',  value: branches.reduce((s, b) => s + b.tasks.filter(t => isOverdue(t)).length, 0), color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ color: s.color, fontSize: '15px', fontFamily: 'Space Mono', fontWeight: 700, margin: 0 }}>{s.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '8px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '3px' }}>
            {(['person', 'feature'] as const).map(v => (
              <button key={v} onClick={() => setViewBy(v)}
                style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: viewBy === v ? 'rgba(139,92,246,0.3)' : 'transparent', color: viewBy === v ? '#a78bfa' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.08em', transition: 'all 0.15s', textTransform: 'uppercase' as const }}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setStandupMode(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: standupMode ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${standupMode ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: standupMode ? '#f87171' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.08em', transition: 'all 0.2s' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: standupMode ? '#ef4444' : 'rgba(255,255,255,0.3)', animation: standupMode ? 'fgRing 1s ease-in-out infinite' : 'none' }} />
            {standupMode ? 'STANDUP LIVE' : 'STANDUP'}
          </button>
        </div>
      </div>

      {/* ── BRANCH PILLS ── */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto', flexShrink: 0, alignItems: 'center' }}>
        {branches.map(b => (
          <div key={b.id} onClick={() => onBranchClick(b)}
            onMouseEnter={() => setHoveredBranch(b.id)}
            onMouseLeave={() => setHoveredBranch(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 10px 4px 5px', background: hoveredBranch === b.id ? `${b.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${hoveredBranch === b.id ? b.color + '55' : 'rgba(255,255,255,0.07)'}`, borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `1.5px solid ${b.color}66`, overflow: 'hidden', flexShrink: 0 }}>
              {b.avatar_url
                ? <img src={b.avatar_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${b.color}cc, ${b.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: 'white' }}>
                    {b.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
              }
            </div>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontFamily: 'Space Grotesk' }}>{b.name.split(' ')[0]}</span>
            <div style={{ width: '30px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px' }}>
              <div style={{ width: `${b.progress}%`, height: '100%', background: b.color, borderRadius: '1px' }} />
            </div>
            <span style={{ color: b.color, fontSize: '10px', fontFamily: 'Space Mono' }}>{b.progress}%</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
          {[{ label: 'Done', color: '#22c55e' }, { label: 'Active', color: '#3b82f6' }, { label: 'Review', color: '#f59e0b' }, { label: 'Overdue', color: '#ef4444' }, { label: 'Planned', color: 'rgba(255,255,255,0.2)' }].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.color }} />
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SVG CANVAS ── */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX, scroll: scrollRef.current?.scrollLeft ?? 0 }) }}
          onMouseMove={(e) => { if (!isDragging) return; e.preventDefault(); if (scrollRef.current) scrollRef.current.scrollLeft = dragStart.scroll - (e.clientX - dragStart.x) }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => { setIsDragging(false); setTooltip(null) }}
          style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <svg width={layout.svgWidth} height={SVG_H} style={{ display: 'block' }}>
            <defs>
              <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.5" />
                <stop offset={`${(pastX / layout.svgWidth) * 100}%`} stopColor="#22c55e" stopOpacity="0.35" />
                <stop offset={`${(nowX  / layout.svgWidth) * 100}%`} stopColor="#8b5cf6" stopOpacity="0.9" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
              </linearGradient>
              {layout.branches.map(({ branch }) => (
                <linearGradient key={branch.id} id={`bg-${branch.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%"   stopColor={branch.color} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={branch.color} stopOpacity="0.1" />
                </linearGradient>
              ))}
              <filter id="tg" x="-10%" y="-200%" width="120%" height="500%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {layout.branches.map(({ branch }) => (
                <filter key={branch.id} id={`gf-${branch.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              ))}
            </defs>

            {/* Zone tints */}
            <rect x={0}     y={0} width={pastX}              height={SVG_H} fill="rgba(34,197,94,0.012)" />
            <rect x={pastX} y={0} width={nowX - pastX}       height={SVG_H} fill="rgba(139,92,246,0.018)" />
            <rect x={nowX}  y={0} width={layout.svgWidth - nowX} height={SVG_H} fill="rgba(255,255,255,0.005)" />

            {/* Zone dividers */}
            <line x1={pastX} y1={30} x2={pastX} y2={SVG_H - 30} stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={pastX + 8} y={48} fill="rgba(255,255,255,0.15)" fontSize={9} fontFamily="Space Mono" letterSpacing="2">PAST</text>
            <line x1={nowX}  y1={30} x2={nowX}  y2={SVG_H - 30} stroke="rgba(139,92,246,0.25)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={nowX  + 8} y={48} fill="rgba(139,92,246,0.5)"  fontSize={9} fontFamily="Space Mono" letterSpacing="2">NOW</text>

            {/* Trunk glow + line */}
            <line x1={60} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y} stroke="rgba(139,92,246,0.1)" strokeWidth={14} strokeLinecap="round" filter="url(#tg)" />
            <line x1={60} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y} stroke="url(#trunkGrad)" strokeWidth={2.5} strokeLinecap="round" />
            <polygon points={`${trunkEnd + 14},${TRUNK_Y} ${trunkEnd},${TRUNK_Y - 7} ${trunkEnd},${TRUNK_Y + 7}`} fill="rgba(255,255,255,0.12)" />

            {/* Milestones */}
            {[
              { label: ['Project', 'start'], x: 80 },
              { label: ['MVP', 'shipped'],   x: pastX },
              { label: ['Beta', 'live'],     x: nowX },
              { label: ['Public', 'launch'], x: layout.svgWidth - 120 },
            ].map(({ label, x }) => {
              const isPast = x < pastX
              const isNow  = x >= pastX && x < nowX
              const fill   = isPast ? '#22c55e' : isNow ? '#8b5cf6' : 'transparent'
              const stroke = isPast ? '#22c55e' : isNow ? '#8b5cf6' : 'rgba(255,255,255,0.15)'
              return (
                <g key={label[0]}>
                  <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R + 5} fill="none" stroke={stroke} strokeWidth={1} strokeOpacity={0.2} />
                  <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R} fill={isPast || isNow ? fill : 'rgba(8,4,18,0.9)'} stroke={stroke} strokeWidth={2} filter={isPast || isNow ? 'url(#tg)' : undefined} />
                  <text x={x} y={TRUNK_Y + 5} textAnchor="middle" fill={isPast ? 'rgba(0,0,0,0.85)' : isNow ? 'white' : 'rgba(255,255,255,0.2)'} fontSize={12} fontFamily="Space Mono">
                    {isPast ? '✓' : isNow ? '⚡' : '○'}
                  </text>
                  {label.map((line, li) => (
                    <text key={li} x={x} y={TRUNK_Y + TRUNK_NODE_R + 16 + li * 13} textAnchor="middle"
                      fill={isPast ? '#22c55e' : isNow ? '#a78bfa' : 'rgba(255,255,255,0.2)'}
                      fontSize={10} fontFamily="Space Grotesk" fontWeight={600}>{line}</text>
                  ))}
                </g>
              )
            })}

            {/* Branches */}
            {layout.branches.map(({ branch, above, originX, branchY, nodes, endX }) => {
              const isHov    = hoveredBranch === branch.id
              const isDimmed = standupMode && hoveredBranch !== null && hoveredBranch !== branch.id
              return (
                <g key={branch.id} opacity={isDimmed ? 0.1 : 1} style={{ transition: 'opacity 0.3s', cursor: isDragging ? 'grabbing' : 'pointer' }}
                  onMouseEnter={() => !isDragging && setHoveredBranch(branch.id)}
                  onMouseLeave={() => setHoveredBranch(null)}
                  onClick={() => !isDragging && onBranchClick(branch)}
                >
                  {/* Diagonal fork */}
                  <path d={`M ${originX} ${TRUNK_Y} Q ${originX} ${(TRUNK_Y + branchY) / 2} ${originX + 50} ${branchY}`}
                    fill="none" stroke={`url(#bg-${branch.id})`} strokeWidth={isHov ? 2.5 : 1.5} style={{ transition: 'stroke-width 0.2s' }} />

                  {/* Junction dot */}
                  <circle cx={originX} cy={TRUNK_Y} r={isHov ? 7 : 5} fill={branch.color} opacity={isHov ? 0.9 : 0.5}
                    filter={isHov ? `url(#gf-${branch.id})` : undefined} style={{ transition: 'all 0.2s' }} />

                  {/* Horizontal branch line */}
                  <line x1={originX + 50} y1={branchY} x2={endX} y2={branchY}
                    stroke={branch.color} strokeWidth={isHov ? 2 : 1.5} strokeOpacity={isHov ? 0.6 : 0.3} style={{ transition: 'all 0.2s' }} />

                  {/* Progress bar */}
                  <line x1={originX + 50} y1={above ? branchY - 5 : branchY + 5}
                    x2={originX + 50 + (endX - originX - 50) * (branch.progress / 100)} y2={above ? branchY - 5 : branchY + 5}
                    stroke={branch.color} strokeWidth={2.5} strokeOpacity={0.4} strokeLinecap="round" />

                  {/* Branch label chip */}
                  <foreignObject x={originX + 46} y={above ? branchY - 50 : branchY + 14} width={170} height={34} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: `${branch.color}18`, border: `1px solid ${branch.color}55`, borderRadius: '16px', padding: '4px 10px 4px 5px', backdropFilter: 'blur(8px)' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `1.5px solid ${branch.color}88`, overflow: 'hidden', flexShrink: 0 }}>
                        {branch.avatar_url
                          ? <img src={branch.avatar_url} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${branch.color}cc, ${branch.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white' }}>
                              {branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                        }
                      </div>
                      <span style={{ color: branch.color, fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {branch.name.length > 14 ? branch.name.slice(0, 13) + '…' : branch.name}
                      </span>
                      <span style={{ color: branch.color, fontSize: '10px', fontFamily: 'Space Mono', opacity: 0.7 }}>{branch.progress}%</span>
                    </div>
                  </foreignObject>

                  {/* Task nodes */}
                  {nodes.map(({ task, x, y }, ni) => {
                    const overdue  = isOverdue(task)
                    const isDone   = task.status === 'done'
                    const isActive = task.status === 'in_progress'
                    const isReview = task.status === 'review'
                    const isNH     = hoveredNode === task.id
                    const fill     = overdue ? '#ef4444' : statusFill(task.status)
                    const border   = overdue ? '#ef4444' : statusBorder(task.status)
                    const icon     = overdue ? '!' : statusIcon(task.status)
                    return (
                      <g key={task.id}
                        onMouseEnter={(e) => { if (isDragging) return; setHoveredNode(task.id); setTooltip({ x: e.clientX, y: e.clientY, task, branch }) }}
                        onMouseLeave={() => { setHoveredNode(null); setTooltip(null) }}
                        onClick={(e) => { e.stopPropagation(); if (!isDragging) onBranchClick(branch) }}
                        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
                      >
                        {ni > 0 && <line x1={nodes[ni - 1].x + nR} y1={y} x2={x - nR} y2={y} stroke={branch.color} strokeWidth={1} strokeOpacity={0.2} />}

                        {/* Pulse ring — opacity only, no transform */}
                        {(overdue || isReview || isActive) && (
                          <circle cx={x} cy={y} r={nR + 7} fill="none" stroke={border} strokeWidth={1.5}
                            style={{ animation: 'fgRing 2.5s ease-in-out infinite' }} />
                        )}

                        {isNH && <circle cx={x} cy={y} r={nR + 11} fill="none" stroke={border} strokeWidth={1} strokeOpacity={0.15} />}

                        <circle cx={x} cy={y} r={nR}
                          fill={isDone ? fill : 'rgba(8,4,18,0.92)'}
                          stroke={border} strokeWidth={isNH ? 2.5 : 2}
                          strokeDasharray={task.status === 'todo' ? '4 3' : 'none'}
                          filter={isActive || overdue ? `url(#gf-${branch.id})` : undefined}
                          style={{ transition: 'all 0.15s' }}
                        />
                        <text x={x} y={y + 4.5} textAnchor="middle" fill={isDone ? 'rgba(0,0,0,0.85)' : border} fontSize={standupMode ? 13 : 11} fontFamily="Space Mono">{icon}</text>
                        <text x={x} y={above ? y - nR - 10 : y + nR + 15} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={9} fontFamily="Space Grotesk" style={{ pointerEvents: 'none' }}>
                          {task.title.length > 13 ? task.title.slice(0, 12) + '…' : task.title}
                        </text>
                        {task.due_date && (
                          <text x={x} y={above ? y - nR - 22 : y + nR + 27} textAnchor="middle"
                            fill={overdue ? '#ef444466' : 'rgba(255,255,255,0.18)'} fontSize={8} fontFamily="Space Mono">
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
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{ position: 'fixed', left: tooltip.x + 16, top: tooltip.y - 60, background: 'rgba(6,3,15,0.98)', border: `1px solid ${tooltip.branch.color}40`, borderRadius: '12px', padding: '10px 14px', pointerEvents: 'none', zIndex: 9999, width: '220px', boxShadow: `0 16px 48px rgba(0,0,0,0.8)`, backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isOverdue(tooltip.task) ? '#ef4444' : statusBorder(tooltip.task.status), flexShrink: 0 }} />
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>{tooltip.task.title}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono' }}>{tooltip.task.status.replace('_', ' ').toUpperCase()}</span>
              {tooltip.task.due_date && <span style={{ color: isOverdue(tooltip.task) ? '#f87171' : 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono' }}>· {isOverdue(tooltip.task) ? 'OVERDUE' : tooltip.task.due_date}</span>}
              {tooltip.task.priority === 'high' && <span style={{ color: '#f59e0b', fontSize: '10px', fontFamily: 'Space Mono' }}>· HIGH PRIORITY</span>}
            </div>
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: `linear-gradient(135deg, ${tooltip.branch.color}cc, ${tooltip.branch.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: 'white' }}>
                {tooltip.branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span style={{ color: tooltip.branch.color, fontSize: '10px', fontFamily: 'Space Grotesk' }}>{tooltip.branch.name}</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: '9px', fontFamily: 'Space Mono' }}>click to open →</span>
            </div>
          </div>
        )}
      </div>

      {/* Scroll hint */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', padding: '7px', borderTop: '1px solid rgba(255,255,255,0.04)', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>← DRAG TO EXPLORE →</span>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {[{ label: 'PAST', color: '#22c55e' }, { label: 'NOW', color: '#8b5cf6' }, { label: 'UPCOMING', color: 'rgba(255,255,255,0.15)' }].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '16px', height: '2px', background: s.color, borderRadius: '1px' }} />
              <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '8px', fontFamily: 'Space Mono' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fgSpin { to { transform: rotate(360deg); } }
        @keyframes fgRing { 0%,100% { stroke-opacity: 0.08; } 50% { stroke-opacity: 0.45; } }
      `}</style>
    </div>
  )
}