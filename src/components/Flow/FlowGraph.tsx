import { useMemo, useRef, useState, useEffect } from 'react'
import { useFlowData } from '../../hooks/useFlowData'
import type { FlowBranch, FlowTask } from '../../hooks/useFlowData'

interface FlowGraphProps {
  workspaceId: string | null
  userId: string | null
  onBranchClick: (branch: FlowBranch) => void
}

const NODE_R         = 18
const TRUNK_NODE_R   = 22
const BRANCH_OFFSET  = 130
const NODE_SPACING   = 140
const BRANCH_START_X = 200
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
    case 'in_progress': return '#60a5fa'
    case 'review':      return '#fbbf24'
    default:            return 'rgba(255,255,255,0.35)'
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
  const [svgH, setSvgH]                   = useState(400)
  const svgWrapRef = useRef<HTMLDivElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = svgWrapRef.current
    if (!el) return
    const measure = () => setSvgH(el.clientHeight || 400)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const TRUNK_Y = Math.round(svgH * 0.5)

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

  useEffect(() => {
    if (!layout || !scrollRef.current) return
    const scrollTo = layout.nowX - scrollRef.current.clientWidth / 2
    scrollRef.current.scrollLeft = Math.max(0, scrollTo)
  }, [layout])

  const health = deadlineHealth(branches)
  const nR     = standupMode ? NODE_R + 8 : NODE_R

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', margin: '0 auto 12px', border: '2px solid rgba(139,92,246,0.2)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'fgSpin 0.8s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', fontSize: '10px', letterSpacing: '0.2em' }}>LOADING FLOW…</p>
      </div>
      <style>{`@keyframes fgSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <p style={{ color: '#f87171', fontFamily: 'Space Grotesk' }}>{error}</p>
    </div>
  )

  if (!layout) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px' }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', fontSize: '11px', letterSpacing: '0.2em' }}>NO BRANCHES YET</p>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Space Grotesk', fontSize: '13px' }}>Assign tasks to members to see the execution map.</p>
    </div>
  )

  const trunkEnd = layout.svgWidth - 60
  const nowX     = layout.nowX
  const pastX    = nowX * 0.45

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

          {/* Circular progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '44px', height: '44px' }}>
              <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="cpg" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="url(#cpg)" strokeWidth="3"
                  strokeDasharray={`${(overallProgress / 100) * 113.1} 113.1`}
                  strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: '9px', fontFamily: 'Space Mono', fontWeight: 700 }}>{overallProgress}%</span>
              </div>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.18em', margin: '0 0 2px' }}>OVERALL</p>
              <p style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0 }}>{totalDone}/{totalTasks} tasks</p>
            </div>
          </div>

          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)' }} />

          {/* Health badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: `${health.color}20`, border: `1px solid ${health.color}60`, borderRadius: '8px', padding: '5px 14px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: health.color, boxShadow: `0 0 10px ${health.color}` }} />
            <span style={{ color: health.color, fontSize: '12px', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.1em' }}>{health.label}</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '20px' }}>
            {[
              { label: 'BRANCHES', value: branches.length, color: '#c4b5fd' },
              { label: 'DONE',     value: totalDone,       color: '#4ade80' },
              { label: 'ACTIVE',   value: branches.reduce((s, b) => s + b.tasks.filter(t => t.status === 'in_progress').length, 0), color: '#60a5fa' },
              { label: 'OVERDUE',  value: branches.reduce((s, b) => s + b.tasks.filter(t => isOverdue(t)).length, 0), color: '#f87171' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ color: s.color, fontSize: '18px', fontFamily: 'Space Mono', fontWeight: 700, margin: 0 }}>{s.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '3px' }}>
            {(['person', 'feature'] as const).map(v => (
              <button key={v} onClick={() => setViewBy(v)}
                style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: viewBy === v ? 'rgba(139,92,246,0.4)' : 'transparent', color: viewBy === v ? '#e9d5ff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: viewBy === v ? 700 : 400, letterSpacing: '0.08em', transition: 'all 0.15s', textTransform: 'uppercase' as const }}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => setStandupMode(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: standupMode ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${standupMode ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '8px', color: standupMode ? '#fca5a5' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 600, letterSpacing: '0.08em', transition: 'all 0.2s' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: standupMode ? '#ef4444' : 'rgba(255,255,255,0.4)' }} />
            {standupMode ? 'STANDUP LIVE' : 'STANDUP'}
          </button>
        </div>
      </div>

      {/* ── BRANCH PILLS ── */}
      <div style={{ display: 'flex', gap: '8px', padding: '8px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', overflowX: 'auto', flexShrink: 0, alignItems: 'center' }}>
        {branches.map(b => (
          <div key={b.id} onClick={() => onBranchClick(b)}
            onMouseEnter={() => setHoveredBranch(b.id)}
            onMouseLeave={() => setHoveredBranch(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 12px 5px 6px', background: hoveredBranch === b.id ? `${b.color}25` : 'rgba(255,255,255,0.05)', border: `1px solid ${hoveredBranch === b.id ? b.color + '80' : 'rgba(255,255,255,0.12)'}`, borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${b.color}88`, overflow: 'hidden', flexShrink: 0 }}>
              {b.avatar_url
                ? <img src={b.avatar_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${b.color}, ${b.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white' }}>
                    {b.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
              }
            </div>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{b.name.split(' ')[0]}</span>
            <div style={{ width: '36px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
              <div style={{ width: `${b.progress}%`, height: '100%', background: b.color, borderRadius: '2px' }} />
            </div>
            <span style={{ color: b.color, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700 }}>{b.progress}%</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { label: 'Done',    color: '#4ade80' },
            { label: 'Active',  color: '#60a5fa' },
            { label: 'Review',  color: '#fbbf24' },
            { label: 'Overdue', color: '#f87171' },
            { label: 'Planned', color: 'rgba(255,255,255,0.35)' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'Space Mono' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SVG AREA ── */}
      <div ref={svgWrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <div
          ref={scrollRef}
          onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX, scroll: scrollRef.current?.scrollLeft ?? 0 }) }}
          onMouseMove={(e) => { if (!isDragging) return; e.preventDefault(); if (scrollRef.current) scrollRef.current.scrollLeft = dragStart.scroll - (e.clientX - dragStart.x) }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => { setIsDragging(false); setTooltip(null) }}
          style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <svg width={layout.svgWidth} height={svgH} style={{ display: 'block' }}>
            <defs>
              <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.7" />
                <stop offset={`${(pastX / layout.svgWidth) * 100}%`} stopColor="#22c55e" stopOpacity="0.5" />
                <stop offset={`${(nowX  / layout.svgWidth) * 100}%`} stopColor="#8b5cf6" stopOpacity="1" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
              </linearGradient>
              {layout.branches.map(({ branch }) => (
                <linearGradient key={branch.id} id={`bg-${branch.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%"   stopColor={branch.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={branch.color} stopOpacity="0.2" />
                </linearGradient>
              ))}
              <filter id="tg" x="-10%" y="-200%" width="120%" height="500%">
                <feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {layout.branches.map(({ branch }) => (
                <filter key={branch.id} id={`gf-${branch.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              ))}
            </defs>

            {/* Zone tints */}
            <rect x={0}     y={0} width={pastX}                  height={svgH} fill="rgba(34,197,94,0.03)" />
            <rect x={pastX} y={0} width={nowX - pastX}           height={svgH} fill="rgba(139,92,246,0.04)" />
            <rect x={nowX}  y={0} width={layout.svgWidth - nowX} height={svgH} fill="rgba(255,255,255,0.01)" />

            {/* Zone dividers */}
            <line x1={pastX} y1={20} x2={pastX} y2={svgH - 20} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="5 4" />
            <text x={pastX + 10} y={40} fill="rgba(255,255,255,0.6)" fontSize={10} fontFamily="Space Mono" fontWeight="bold" letterSpacing="2">PAST</text>
            <line x1={nowX}  y1={20} x2={nowX}  y2={svgH - 20} stroke="rgba(139,92,246,0.5)"   strokeWidth={1} strokeDasharray="5 4" />
            <text x={nowX  + 10} y={40} fill="rgba(167,139,250,0.9)" fontSize={10} fontFamily="Space Mono" fontWeight="bold" letterSpacing="2">NOW</text>
            <text x={nowX  + 10} y={svgH - 28} fill="rgba(167,139,250,0.5)" fontSize={9} fontFamily="Space Mono" letterSpacing="2">UPCOMING →</text>

            {/* Trunk glow + line */}
            <line x1={60} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y} stroke="rgba(139,92,246,0.25)" strokeWidth={16} strokeLinecap="round" filter="url(#tg)" />
            <line x1={60} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y} stroke="url(#trunkGrad)" strokeWidth={3} strokeLinecap="round" />
            <polygon points={`${trunkEnd + 16},${TRUNK_Y} ${trunkEnd},${TRUNK_Y - 8} ${trunkEnd},${TRUNK_Y + 8}`} fill="rgba(255,255,255,0.3)" />

            {/* Milestones */}
            {[
              { label: ['Project', 'start'], x: 80 },
              { label: ['MVP', 'shipped'],   x: pastX },
              { label: ['Beta', 'live'],     x: nowX },
              { label: ['Public', 'launch'], x: layout.svgWidth - 120 },
            ].map(({ label, x }) => {
              const isPast = x < pastX
              const isNow  = x >= pastX && x < nowX
              const col    = isPast ? '#22c55e' : isNow ? '#8b5cf6' : 'rgba(255,255,255,0.25)'
              const textCol = isPast ? '#4ade80' : isNow ? '#c4b5fd' : 'rgba(255,255,255,0.6)'
              return (
                <g key={label[0]}>
                  <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R + 6} fill="none" stroke={col} strokeWidth={1.5} strokeOpacity={0.3} />
                  <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R}
                    fill={isPast || isNow ? col : 'rgba(12,8,24,0.95)'}
                    stroke={col} strokeWidth={2.5}
                    filter={isPast || isNow ? 'url(#tg)' : undefined}
                  />
                  <text x={x} y={TRUNK_Y + 5} textAnchor="middle"
                    fill={isPast ? 'rgba(0,0,0,0.9)' : isNow ? 'white' : 'rgba(255,255,255,0.5)'}
                    fontSize={13} fontFamily="Space Mono" fontWeight="bold">
                    {isPast ? '✓' : isNow ? '⚡' : '○'}
                  </text>
                  {label.map((line, li) => (
                    <text key={li} x={x} y={TRUNK_Y + TRUNK_NODE_R + 18 + li * 14}
                      textAnchor="middle" fill={textCol}
                      fontSize={11} fontFamily="Space Grotesk" fontWeight={700}>{line}</text>
                  ))}
                </g>
              )
            })}

            {/* ── BRANCHES ── */}
            {layout.branches.map(({ branch, above, originX, branchY, nodes, endX }) => {
              const isHov    = hoveredBranch === branch.id
              const isDimmed = standupMode && hoveredBranch !== null && hoveredBranch !== branch.id
              return (
                <g key={branch.id} opacity={isDimmed ? 0.08 : 1}
                  style={{ transition: 'opacity 0.3s', cursor: isDragging ? 'grabbing' : 'pointer' }}
                  onMouseEnter={() => !isDragging && setHoveredBranch(branch.id)}
                  onMouseLeave={() => setHoveredBranch(null)}
                  onClick={() => !isDragging && onBranchClick(branch)}
                >
                  {/* Diagonal fork */}
                  <path d={`M ${originX} ${TRUNK_Y} Q ${originX} ${(TRUNK_Y + branchY) / 2} ${originX + 50} ${branchY}`}
                    fill="none" stroke={`url(#bg-${branch.id})`}
                    strokeWidth={isHov ? 3 : 2}
                    style={{ transition: 'stroke-width 0.2s' }}
                  />

                  {/* Junction dot */}
                  <circle cx={originX} cy={TRUNK_Y} r={isHov ? 8 : 6}
                    fill={branch.color} opacity={isHov ? 1 : 0.7}
                    filter={isHov ? `url(#gf-${branch.id})` : undefined}
                    style={{ transition: 'all 0.2s' }}
                  />

                  {/* Horizontal branch line */}
                  <line x1={originX + 50} y1={branchY} x2={endX} y2={branchY}
                    stroke={branch.color} strokeWidth={isHov ? 2.5 : 2}
                    strokeOpacity={isHov ? 0.8 : 0.5}
                    style={{ transition: 'all 0.2s' }}
                  />

                  {/* Progress bar */}
                  <line
                    x1={originX + 50} y1={above ? branchY - 6 : branchY + 6}
                    x2={originX + 50 + (endX - originX - 50) * (branch.progress / 100)}
                    y2={above ? branchY - 6 : branchY + 6}
                    stroke={branch.color} strokeWidth={3} strokeOpacity={0.6} strokeLinecap="round"
                  />

                  {/* Branch label chip */}
                  <foreignObject
                    x={originX + 46}
                    y={above ? branchY - 54 : branchY + 16}
                    width={180} height={36}
                    style={{ overflow: 'visible', pointerEvents: 'none' }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: `${branch.color}28`, border: `1.5px solid ${branch.color}80`, borderRadius: '18px', padding: '5px 12px 5px 6px', backdropFilter: 'blur(12px)' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${branch.color}`, overflow: 'hidden', flexShrink: 0 }}>
                        {branch.avatar_url
                          ? <img src={branch.avatar_url} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${branch.color}, ${branch.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, color: 'white' }}>
                              {branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                        }
                      </div>
                      <span style={{ color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {branch.name.length > 14 ? branch.name.slice(0, 13) + '…' : branch.name}
                      </span>
                      <span style={{ color: branch.color, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700 }}>{branch.progress}%</span>
                    </div>
                  </foreignObject>

                  {/* ── TASK NODES ── */}
                  {nodes.map(({ task, x, y }, ni) => {
                    const overdue  = isOverdue(task)
                    const isDone   = task.status === 'done'
                    const isActive = task.status === 'in_progress'
                    const isReview = task.status === 'review'
                    const isNH     = hoveredNode === task.id
                    const fill     = overdue ? '#ef4444' : statusFill(task.status)
                    const border   = overdue ? '#f87171' : statusBorder(task.status)
                    const icon     = overdue ? '!' : statusIcon(task.status)

                    return (
                      <g key={task.id}
                        onMouseEnter={(e) => { if (isDragging) return; setHoveredNode(task.id); setTooltip({ x: e.clientX, y: e.clientY, task, branch }) }}
                        onMouseLeave={() => { setHoveredNode(null); setTooltip(null) }}
                        onClick={(e) => { e.stopPropagation(); if (!isDragging) onBranchClick(branch) }}
                        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
                      >
                        {/* Inter-node connector */}
                        {ni > 0 && (
                          <line x1={nodes[ni - 1].x + nR} y1={y} x2={x - nR} y2={y}
                            stroke={branch.color} strokeWidth={1.5} strokeOpacity={0.35} />
                        )}

                        {/* Soft pulse ring */}
                        {(overdue || isReview || isActive) && (
                          <circle cx={x} cy={y} r={nR + 8} fill="none" stroke={border} strokeWidth={2}
                            style={{ animation: 'fgRing 3s ease-in-out infinite' }} />
                        )}

                        {/* Hover ring */}
                        {isNH && <circle cx={x} cy={y} r={nR + 13} fill="none" stroke={border} strokeWidth={1.5} strokeOpacity={0.25} />}

                        {/* Node */}
                        <circle cx={x} cy={y} r={nR}
                          fill={isDone ? fill : 'rgba(10,6,20,0.95)'}
                          stroke={border}
                          strokeWidth={isNH ? 3 : 2.5}
                          strokeDasharray={task.status === 'todo' ? '4 3' : 'none'}
                          filter={isActive || overdue ? `url(#gf-${branch.id})` : undefined}
                          style={{ transition: 'all 0.15s' }}
                        />

                        {/* Status icon */}
                        <text x={x} y={y + 5} textAnchor="middle"
                          fill={isDone ? 'rgba(0,0,0,0.9)' : border}
                          fontSize={standupMode ? 14 : 12} fontFamily="Space Mono" fontWeight="bold">
                          {icon}
                        </text>

                        {/* Task title */}
                        <text x={x} y={above ? y - nR - 12 : y + nR + 17}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.9)"
                          fontSize={10} fontFamily="Space Grotesk" fontWeight={600}
                          style={{ pointerEvents: 'none' }}>
                          {task.title.length > 14 ? task.title.slice(0, 13) + '…' : task.title}
                        </text>

                        {/* Due date */}
                        {task.due_date && (
                          <text x={x} y={above ? y - nR - 25 : y + nR + 30}
                            textAnchor="middle"
                            fill={overdue ? '#f87171' : 'rgba(255,255,255,0.5)'}
                            fontSize={9} fontFamily="Space Mono" fontWeight={overdue ? 700 : 400}>
                            {overdue ? 'OVERDUE' : task.due_date.slice(5)}
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

        {/* ── TOOLTIP ── */}
        {tooltip && (
          <div style={{
            position: 'fixed', left: tooltip.x + 16, top: tooltip.y - 70,
            background: 'rgba(8,4,20,0.98)',
            border: `1.5px solid ${tooltip.branch.color}60`,
            borderRadius: '14px', padding: '12px 16px',
            pointerEvents: 'none', zIndex: 9999, width: '240px',
            boxShadow: `0 20px 60px rgba(0,0,0,0.9), 0 0 0 1px ${tooltip.branch.color}20`,
            backdropFilter: 'blur(24px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: isOverdue(tooltip.task) ? '#f87171' : statusBorder(tooltip.task.status), flexShrink: 0 }} />
              <p style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0 }}>{tooltip.task.title}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                {tooltip.task.status.replace('_', ' ').toUpperCase()}
              </span>
              {tooltip.task.due_date && (
                <span style={{ color: isOverdue(tooltip.task) ? '#f87171' : 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: 'Space Mono', fontWeight: isOverdue(tooltip.task) ? 700 : 400 }}>
                  · {isOverdue(tooltip.task) ? '⚠ OVERDUE' : tooltip.task.due_date}
                </span>
              )}
              {tooltip.task.priority === 'high' && (
                <span style={{ color: '#fbbf24', fontSize: '10px', fontFamily: 'Space Mono' }}>· HIGH PRIORITY</span>
              )}
            </div>
            <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: `linear-gradient(135deg, ${tooltip.branch.color}, ${tooltip.branch.color}66)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {tooltip.branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <span style={{ color: tooltip.branch.color, fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>{tooltip.branch.name}</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.35)', fontSize: '9px', fontFamily: 'Space Mono' }}>click to open →</span>
            </div>
          </div>
        )}
      </div>

      {/* ── SCROLL HINT ── */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', padding: '7px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>← DRAG TO EXPLORE →</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {[{ label: 'PAST', color: '#4ade80' }, { label: 'NOW', color: '#a78bfa' }, { label: 'UPCOMING', color: 'rgba(255,255,255,0.3)' }].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '18px', height: '2px', background: s.color, borderRadius: '1px' }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '9px', fontFamily: 'Space Mono' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fgSpin { to { transform: rotate(360deg); } }
        @keyframes fgRing { 0%,100% { stroke-opacity: 0.05; } 50% { stroke-opacity: 0.5; } }
      `}</style>
    </div>
  )
}