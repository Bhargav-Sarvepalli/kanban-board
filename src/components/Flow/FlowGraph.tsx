import { useMemo, useRef, useState, useEffect } from 'react'
import { useFlowData } from '../../hooks/useFlowData'
import type { FlowBranch, FlowTask } from '../../hooks/useFlowData'
import StandupMode from './StandupMode'

interface FlowGraphProps {
  workspaceId: string | null
  userId: string | null
  onBranchClick: (branch: FlowBranch) => void
  projectId?: string | null
}

const NODE_R        = 20
const TRUNK_NODE_R  = 24
const BRANCH_OFFSET = 180
const NODE_SPACING  = 160
const BRANCH_GAP    = 400
const FORK_OFFSET   = 80

function statusFill(s: string) {
  return s === 'done' ? '#22c55e' : s === 'in_progress' ? '#3b82f6' : s === 'review' ? '#f59e0b' : 'transparent'
}
function statusBorder(s: string) {
  return s === 'done' ? '#22c55e' : s === 'in_progress' ? '#60a5fa' : s === 'review' ? '#fbbf24' : 'rgba(255,255,255,0.3)'
}
function statusIcon(s: string) {
  return s === 'done' ? '✓' : s === 'in_progress' ? '⚡' : s === 'review' ? '👁' : '○'
}
function isOverdue(t: FlowTask) {
  return !!t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date()
}

// Health label per branch — useful for managers and leads
function branchHealth(branch: FlowBranch): { label: string; color: string } {
  const hasOverdue = branch.tasks.some(t => isOverdue(t))
  const hasBlocked = branch.tasks.some(t => t.priority === 'high' && t.status === 'todo')
  if (hasOverdue || hasBlocked) return { label: 'BLOCKED', color: '#ef4444' }
  if (branch.progress < 30 && branch.tasks.length > 2) return { label: 'AT RISK', color: '#f59e0b' }
  if (branch.progress >= 70) return { label: 'ON TRACK', color: '#22c55e' }
  return { label: 'IN PROGRESS', color: '#60a5fa' }
}

interface NodeLayout { task: FlowTask; x: number; y: number }
interface BranchLayout {
  branch: FlowBranch; above: boolean
  originX: number; branchY: number
  nodes: NodeLayout[]; endX: number
}

function overallHealth(branches: FlowBranch[]) {
  if (!branches.length) return { label: 'NO DATA', color: '#6b7280' }
  const avg = branches.reduce((s, b) => s + b.progress, 0) / branches.length
  return avg >= 70 ? { label: 'ON TRACK', color: '#22c55e' }
       : avg >= 40 ? { label: 'AT RISK',  color: '#f59e0b' }
       :             { label: 'BEHIND',   color: '#ef4444' }
}

export default function FlowGraph({ workspaceId, userId, onBranchClick, projectId }: FlowGraphProps) {
  const { branches, milestones, totalTasks, totalDone, overallProgress, loading, error } = useFlowData(workspaceId, projectId)

  const [hovBranch,   setHovBranch]   = useState<string | null>(null)
  const [hovNode,     setHovNode]     = useState<string | null>(null)
  const [tooltip,     setTooltip]     = useState<{ x: number; y: number; task: FlowTask; branch: FlowBranch } | null>(null)
  // myTasksOnly: highlights only branches/nodes that belong to the current user
  // Useful for individuals to see their own workload on the flow map
  const [myTasksOnly,  setMyTasksOnly]  = useState(false)
  const [standupOpen,  setStandupOpen]  = useState(false)
  const [dragging,    setDragging]    = useState(false)
  const [drag0,       setDrag0]       = useState({ x: 0, scroll: 0 })
  const [svgH,        setSvgH]        = useState(500)
  const wrapRef   = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const m = () => setSvgH(el.clientHeight || 500)
    m(); const ro = new ResizeObserver(m); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const TRUNK_Y = Math.round(svgH * 0.46)

  const layout = useMemo<{ branches: BranchLayout[]; svgWidth: number; nowX: number } | null>(() => {
    if (!branches.length) return null
    const totalBranchWidth = branches.reduce((sum, b) =>
      sum + Math.max(b.tasks.length * NODE_SPACING + 200, BRANCH_GAP), 0)
    const minSvgWidth = Math.max(totalBranchWidth + 500, 1200)
    const svgWidth = minSvgWidth
    const nowX = svgWidth * 0.35
    const BRANCH_ZONE_START = nowX + 120
    let x = BRANCH_ZONE_START

    const result: BranchLayout[] = []
    branches.forEach((branch, idx) => {
      const above   = idx % 2 === 0
      const branchY = above ? TRUNK_Y - BRANCH_OFFSET : TRUNK_Y + BRANCH_OFFSET
      const originX = x
      const lineX   = originX + FORK_OFFSET
      const nodes: NodeLayout[] = branch.tasks.map((task, i) => ({
        task, x: lineX + i * NODE_SPACING, y: branchY,
      }))
      const endX = nodes.length > 0 ? nodes[nodes.length - 1].x : lineX + 80
      result.push({ branch, above, originX, branchY, nodes, endX })
      x += Math.max(branch.tasks.length * NODE_SPACING + 200, BRANCH_GAP)
    })
    return { branches: result, svgWidth, nowX }
  }, [branches, TRUNK_Y])

  useEffect(() => {
    if (!layout || !scrollRef.current) return
    scrollRef.current.scrollLeft = Math.max(0, layout.nowX - scrollRef.current.clientWidth / 2)
  }, [layout])

  const h  = overallHealth(branches)

  // Count stats useful to each role
  const activeTasks  = branches.reduce((s, b) => s + b.tasks.filter(t => t.status === 'in_progress').length, 0)
  const overdueTasks = branches.reduce((s, b) => s + b.tasks.filter(t => isOverdue(t)).length, 0)
  const blockedCount = branches.filter(b => branchHealth(b).label === 'BLOCKED').length

  // My tasks: branches where at least one task belongs to the current user
  const myBranchIds = userId
    ? new Set(branches.filter(b => b.tasks.some(t => t.assignee_id === userId)).map(b => b.id))
    : new Set<string>()

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
      <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Space Grotesk', fontSize: '13px', textAlign: 'center', maxWidth: '360px' }}>
        {projectId
          ? 'Toggle "Show on Flow" on tasks and assign them to features to see the execution map.'
          : 'Assign tasks to members to see the execution map.'}
      </p>
    </div>
  )

  const trunkEnd = layout.svgWidth - 60
  const nowX     = layout.nowX
  const pastX    = nowX * 0.44

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0, flexWrap: 'wrap', gap: '10px',
      }}>
        {/* Left: overall health + progress + key stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

          {/* Progress ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '44px', height: '44px' }}>
              <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
                <defs>
                  <linearGradient id="fg-circle-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="url(#fg-circle-grad)" strokeWidth="3"
                  strokeDasharray={`${(overallProgress / 100) * 113.1} 113.1`} strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease' }} />
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: `${h.color}20`, border: `1px solid ${h.color}60`,
            borderRadius: '8px', padding: '5px 14px',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: h.color, boxShadow: `0 0 10px ${h.color}` }} />
            <span style={{ color: h.color, fontSize: '12px', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.1em' }}>{h.label}</span>
          </div>

          {/* Stats — meaningful to managers (blocked), leads (active), all (overdue) */}
          <div style={{ display: 'flex', gap: '20px' }}>
            {[
              { label: projectId ? 'FEATURES' : 'BRANCHES', value: branches.length,  color: '#c4b5fd' },
              { label: 'BLOCKED',  value: blockedCount,  color: '#ef4444' },
              { label: 'ACTIVE',   value: activeTasks,   color: '#60a5fa' },
              { label: 'OVERDUE',  value: overdueTasks,  color: '#f87171' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <p style={{ color: s.color, fontSize: '18px', fontFamily: 'Space Mono', fontWeight: 700, margin: 0 }}>{s.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '8px', fontFamily: 'Space Mono', letterSpacing: '0.12em', margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: MY TASKS + STANDUP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {myBranchIds.size > 0 && (
            <button onClick={() => setMyTasksOnly(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: myTasksOnly ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${myTasksOnly ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '8px', color: myTasksOnly ? '#a78bfa' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 600, transition: 'all 0.2s' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: myTasksOnly ? '#8b5cf6' : 'rgba(255,255,255,0.4)' }} />
              MY TASKS
            </button>
          )}
          {branches.length > 0 && (
            <button onClick={() => setStandupOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 600, transition: 'all 0.2s' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
              STANDUP
            </button>
          )}
        </div>
      </div>

      {standupOpen && (
        <StandupMode
          branches={branches}
          onClose={() => setStandupOpen(false)}
          onBranchClick={(branch) => { setStandupOpen(false); onBranchClick(branch) }}
        />
      )}

      {/* ── BRANCH / FEATURE PILLS ── */}
      <div style={{
        display: 'flex', gap: '8px', padding: '8px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto', flexShrink: 0, alignItems: 'center',
      }}>
        {branches.map(b => {
          const bh = branchHealth(b)
          const isMyBranch = myBranchIds.has(b.id)
          const dimmed = myTasksOnly && !isMyBranch
          return (
            <div key={b.id}
              onClick={() => onBranchClick(b)}
              onMouseEnter={() => setHovBranch(b.id)}
              onMouseLeave={() => setHovBranch(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '4px 10px 4px 5px',
                background: hovBranch === b.id ? `${b.color}25` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${hovBranch === b.id ? b.color + '80' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '20px', cursor: 'pointer',
                transition: 'all 0.2s', flexShrink: 0,
                opacity: dimmed ? 0.35 : 1,
              }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${b.color}88`, overflow: 'hidden', flexShrink: 0 }}>
                {b.avatar_url
                  ? <img src={b.avatar_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${b.color}, ${b.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white' }}>
                      {b.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                }
              </div>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                {b.name.length > 16 ? b.name.slice(0, 15) + '…' : b.name}
              </span>
              {/* Health dot — key signal for leads/managers scanning the pill bar */}
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: bh.color, flexShrink: 0 }} title={bh.label} />
              <div style={{ width: '36px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                <div style={{ width: `${b.progress}%`, height: '100%', background: b.color, borderRadius: '2px' }} />
              </div>
              <span style={{ color: b.color, fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700 }}>{b.progress}%</span>
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { l: 'Done',    c: '#4ade80' },
            { l: 'Active',  c: '#60a5fa' },
            { l: 'Review',  c: '#fbbf24' },
            { l: 'Overdue', c: '#f87171' },
            { l: 'Planned', c: 'rgba(255,255,255,0.35)' },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.c }} />
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: 'Space Mono' }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SVG CANVAS ── */}
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <div ref={scrollRef}
          onMouseDown={e => { setDragging(true); setDrag0({ x: e.clientX, scroll: scrollRef.current?.scrollLeft ?? 0 }) }}
          onMouseMove={e => { if (!dragging) return; e.preventDefault(); if (scrollRef.current) scrollRef.current.scrollLeft = drag0.scroll - (e.clientX - drag0.x) }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => { setDragging(false); setTooltip(null) }}
          style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <svg width={layout.svgWidth} height={svgH} style={{ display: 'block' }}>
            <defs>
              {layout.branches.map(({ branch }) => (
                <linearGradient key={branch.id} id={`fg-bg-${branch.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%"   stopColor={branch.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={branch.color} stopOpacity="0.1" />
                </linearGradient>
              ))}
              <filter id="fg-ms" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              {layout.branches.map(({ branch }) => (
                <filter key={branch.id} id={`fg-gf-${branch.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              ))}
            </defs>

            {/* Zone tints */}
            <rect x={0}     y={0} width={pastX}                  height={svgH} fill="rgba(34,197,94,0.03)" />
            <rect x={pastX} y={0} width={nowX - pastX}           height={svgH} fill="rgba(139,92,246,0.04)" />
            <rect x={nowX}  y={0} width={layout.svgWidth - nowX} height={svgH} fill="rgba(255,255,255,0.01)" />

            {/* Zone dividers */}
            <line x1={pastX} y1={0} x2={pastX} y2={svgH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="6 5" />
            <line x1={nowX}  y1={0} x2={nowX}  y2={svgH} stroke="rgba(167,139,250,0.4)"  strokeWidth={1} strokeDasharray="6 5" />

            {/* Zone labels */}
            <text x={pastX - 60} y={22} fill="rgba(255,255,255,0.5)"   fontSize={10} fontFamily="Space Mono" fontWeight="bold" letterSpacing="2" textAnchor="middle">PAST</text>
            <text x={(pastX + nowX) / 2} y={22} fill="rgba(167,139,250,0.8)" fontSize={10} fontFamily="Space Mono" fontWeight="bold" letterSpacing="2" textAnchor="middle">NOW</text>
            <text x={nowX + 80} y={22} fill="rgba(167,139,250,0.4)"    fontSize={10} fontFamily="Space Mono" letterSpacing="2">UPCOMING →</text>

            {/* ── TRUNK ── */}
            <line x1={60}    y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y} stroke="#7c3aed" strokeWidth={32} strokeLinecap="round" opacity={0.08} />
            <line x1={60}    y1={TRUNK_Y} x2={pastX}    y2={TRUNK_Y} stroke="#4ade80" strokeWidth={4} strokeLinecap="round" />
            <line x1={pastX} y1={TRUNK_Y} x2={nowX}     y2={TRUNK_Y} stroke="#a78bfa" strokeWidth={4} strokeLinecap="round" />
            <line x1={nowX}  y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y} stroke="rgba(255,255,255,0.18)" strokeWidth={4} strokeLinecap="round" />
            <polygon points={`${trunkEnd + 16},${TRUNK_Y} ${trunkEnd},${TRUNK_Y - 9} ${trunkEnd},${TRUNK_Y + 9}`} fill="rgba(255,255,255,0.4)" />
            <circle cx={60}  cy={TRUNK_Y} r={6} fill="#4ade80" />

            {/* ── MILESTONES ── */}
            {(() => {
              const nodes = milestones.length > 0
                ? milestones.map((m, i) => {
                    const totalSpan = layout.svgWidth - 200
                    const spacing = Math.max(160, Math.floor(totalSpan / Math.max(milestones.length - 1, 1)))
                    return { label: m.name, x: 80 + i * spacing }
                  })
                : [
                    { label: 'Start', x: 80 },
                    { label: 'End',   x: layout.svgWidth - 120 },
                  ]

              return nodes.map(({ label, x }) => {
                const isPast  = x <= pastX
                const isNow   = x > pastX && x <= nowX
                const col     = isPast ? '#4ade80' : isNow ? '#a78bfa' : 'rgba(255,255,255,0.2)'
                const textCol = isPast ? '#4ade80' : isNow ? '#c4b5fd' : 'rgba(255,255,255,0.45)'
                return (
                  <g key={label + x}>
                    <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R + 8} fill="none" stroke={col} strokeWidth={1} strokeOpacity={0.15} />
                    <circle cx={x} cy={TRUNK_Y} r={TRUNK_NODE_R}
                      fill={isPast || isNow ? col : 'rgba(10,6,20,0.95)'}
                      stroke={col} strokeWidth={2.5}
                      filter={isPast || isNow ? 'url(#fg-ms)' : undefined}
                    />
                    <text x={x} y={TRUNK_Y + 5.5} textAnchor="middle"
                      fill={isPast ? 'rgba(0,0,0,0.9)' : isNow ? 'white' : 'rgba(255,255,255,0.4)'}
                      fontSize={14} fontFamily="Space Mono" fontWeight="bold">
                      {isPast ? '✓' : isNow ? '⚡' : '○'}
                    </text>
                    <text x={x} y={TRUNK_Y + TRUNK_NODE_R + 20}
                      textAnchor="middle" fill={textCol}
                      fontSize={11} fontFamily="Space Grotesk" fontWeight={700}>{label}</text>
                  </g>
                )
              })
            })()}

            {/* ── BRANCHES ── */}
            {layout.branches.map(({ branch, above, originX, branchY, nodes, endX }) => {
              const isHov      = hovBranch === branch.id
              const isMyBranch = myBranchIds.has(branch.id)
              // In myTasksOnly mode, dim branches that don't belong to current user
              const dimmed     = myTasksOnly && !isMyBranch
              const lineX      = originX + FORK_OFFSET
              // Chip sits ABOVE the branch line if branch is above, BELOW if branch is below
              // Anchored at lineX (fork start) so it's clearly connected to its branch
              const chipY      = above ? branchY - 52 : branchY + 14
              const titleY     = (y: number) => above ? y - NODE_R - 12 : y + NODE_R + 16
              const dateY      = (y: number) => above ? y - NODE_R - 25 : y + NODE_R + 29
              const bh         = branchHealth(branch)

              return (
                <g key={branch.id}
                  opacity={dimmed ? 0.1 : 1}
                  style={{ transition: 'opacity 0.3s', cursor: dragging ? 'grabbing' : 'pointer' }}
                  onMouseEnter={() => !dragging && setHovBranch(branch.id)}
                  onMouseLeave={() => setHovBranch(null)}
                  onClick={() => !dragging && onBranchClick(branch)}
                >
                  {/* Stem from trunk to branch line */}
                  <path
                    d={`M ${originX} ${TRUNK_Y} C ${originX} ${(TRUNK_Y * 2 + branchY) / 3}, ${lineX} ${(TRUNK_Y + branchY * 2) / 3}, ${lineX} ${branchY}`}
                    fill="none" stroke={`url(#fg-bg-${branch.id})`}
                    strokeWidth={isHov ? 3 : 2} style={{ transition: 'stroke-width 0.2s' }}
                  />
                  {/* Fork dot on trunk */}
                  <circle cx={originX} cy={TRUNK_Y} r={isHov ? 9 : 7}
                    fill={branch.color} opacity={isHov ? 1 : 0.8}
                    filter={isHov ? `url(#fg-gf-${branch.id})` : undefined}
                    style={{ transition: 'all 0.2s' }}
                  />
                  {/* Branch line */}
                  <line x1={lineX} y1={branchY} x2={endX} y2={branchY}
                    stroke={branch.color} strokeWidth={isHov ? 2.5 : 2}
                    strokeOpacity={isHov ? 0.85 : 0.5}
                    style={{ transition: 'all 0.2s' }}
                  />
                  {/* Progress overlay on branch line */}
                  <line
                    x1={lineX} y1={above ? branchY - 6 : branchY + 6}
                    x2={lineX + (endX - lineX) * (branch.progress / 100)}
                    y2={above ? branchY - 6 : branchY + 6}
                    stroke={branch.color} strokeWidth={3} strokeOpacity={0.65} strokeLinecap="round"
                  />

                  {/* ── Branch chip — anchored at fork, never floating ── */}
                  <foreignObject x={lineX - 4} y={chipY} width={230} height={44} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '7px',
                      background: `${branch.color}1a`,
                      border: `1.5px solid ${branch.color}${isHov ? 'cc' : '55'}`,
                      borderRadius: '20px', padding: '5px 12px 5px 6px',
                      backdropFilter: 'blur(12px)',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                    }}>
                      {/* Avatar / initials */}
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        border: `2px solid ${branch.color}`,
                        overflow: 'hidden', flexShrink: 0,
                        background: `linear-gradient(135deg, ${branch.color}, ${branch.color}88)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {branch.avatar_url
                          ? <img src={branch.avatar_url} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '9px', fontWeight: 800, color: 'white', fontFamily: 'Space Grotesk' }}>
                              {branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                        }
                      </div>
                      {/* Name */}
                      <span style={{ color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                        {branch.name.length > 14 ? branch.name.slice(0, 13) + '…' : branch.name}
                      </span>
                      {/* Health dot — color-coded so managers can scan instantly */}
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: bh.color, flexShrink: 0 }} />
                      {/* Progress */}
                      <span style={{ color: branch.color, fontSize: '10px', fontFamily: 'Space Mono', fontWeight: 700 }}>
                        {branch.progress}%
                      </span>
                    </div>
                  </foreignObject>

                  {/* Task nodes */}
                  {nodes.map(({ task, x, y }, ni) => {
                    const od   = isOverdue(task)
                    const done = task.status === 'done'
                    const act  = task.status === 'in_progress'
                    const rev  = task.status === 'review'
                    const nh   = hovNode === task.id
                    // In myTasksOnly mode, highlight nodes belonging to current user
                    const isMyNode = userId && task.assignee_id === userId
                    const fill  = od ? '#ef4444' : statusFill(task.status)
                    const bdr   = od ? '#f87171' : statusBorder(task.status)
                    const icon  = od ? '!' : statusIcon(task.status)
                    return (
                      <g key={task.id}
                        onMouseEnter={e => { if (dragging) return; setHovNode(task.id); setTooltip({ x: e.clientX, y: e.clientY, task, branch }) }}
                        onMouseLeave={() => { setHovNode(null); setTooltip(null) }}
                        onClick={e => { e.stopPropagation(); if (!dragging) onBranchClick(branch) }}
                        style={{ cursor: dragging ? 'grabbing' : 'pointer' }}
                      >
                        {ni > 0 && (
                          <line x1={nodes[ni-1].x + NODE_R} y1={y} x2={x - NODE_R} y2={y}
                            stroke={branch.color} strokeWidth={1.5} strokeOpacity={0.35} />
                        )}
                        {/* Pulse ring for attention-needing tasks */}
                        {(od || rev || act) && (
                          <circle cx={x} cy={y} r={NODE_R + 9} fill="none" stroke={bdr} strokeWidth={2}
                            style={{ animation: 'fgRing 3s ease-in-out infinite' }} />
                        )}
                        {/* Extra ring for MY tasks in myTasksOnly mode */}
                        {myTasksOnly && isMyNode && (
                          <circle cx={x} cy={y} r={NODE_R + 16} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeOpacity={0.6}
                            strokeDasharray="4 3" />
                        )}
                        {nh && (
                          <circle cx={x} cy={y} r={NODE_R + 14} fill="none" stroke={bdr} strokeWidth={1.5} strokeOpacity={0.25} />
                        )}
                        <circle cx={x} cy={y} r={NODE_R}
                          fill={done ? fill : 'rgba(10,6,20,0.95)'}
                          stroke={bdr} strokeWidth={nh ? 3 : 2.5}
                          strokeDasharray={task.status === 'todo' ? '4 3' : 'none'}
                          filter={act || od ? `url(#fg-gf-${branch.id})` : undefined}
                          style={{ transition: 'all 0.15s' }}
                        />
                        <text x={x} y={y + 5.5} textAnchor="middle"
                          fill={done ? 'rgba(0,0,0,0.9)' : bdr}
                          fontSize={13} fontFamily="Space Mono" fontWeight="bold">
                          {icon}
                        </text>
                        <text x={x} y={titleY(y)} textAnchor="middle"
                          fill="rgba(255,255,255,0.9)" fontSize={10} fontFamily="Space Grotesk" fontWeight={600}
                          style={{ pointerEvents: 'none' }}>
                          {task.title.length > 15 ? task.title.slice(0, 14) + '…' : task.title}
                        </text>
                        {task.due_date && (
                          <text x={x} y={dateY(y)} textAnchor="middle"
                            fill={od ? '#f87171' : 'rgba(255,255,255,0.45)'}
                            fontSize={9} fontFamily="Space Mono" fontWeight={od ? 700 : 400}>
                            {od ? '⚠ OVERDUE' : task.due_date.slice(5)}
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
          <div style={{
            position: 'fixed', left: tooltip.x + 16, top: tooltip.y - 70,
            background: 'rgba(8,4,20,0.98)',
            border: `1.5px solid ${tooltip.branch.color}60`,
            borderRadius: '14px', padding: '12px 16px',
            pointerEvents: 'none', zIndex: 9999, width: '240px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.9)', backdropFilter: 'blur(24px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: isOverdue(tooltip.task) ? '#f87171' : statusBorder(tooltip.task.status), flexShrink: 0 }} />
              <p style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 700, margin: 0 }}>{tooltip.task.title}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                {tooltip.task.status.replace('_', ' ').toUpperCase()}
              </span>
              {tooltip.task.due_date && (
                <span style={{ color: isOverdue(tooltip.task) ? '#f87171' : 'rgba(255,255,255,0.45)', fontSize: '10px', fontFamily: 'Space Mono', fontWeight: isOverdue(tooltip.task) ? 700 : 400 }}>
                  · {isOverdue(tooltip.task) ? '⚠ OVERDUE' : tooltip.task.due_date}
                </span>
              )}
              {tooltip.task.priority === 'high' && (
                <span style={{ color: '#fbbf24', fontSize: '10px', fontFamily: 'Space Mono' }}>· HIGH PRIORITY</span>
              )}
            </div>
            {/* Feature/person branch info at bottom of tooltip */}
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

      {/* ── FOOTER ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px',
        padding: '7px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.1em' }}>← DRAG TO EXPLORE →</span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {[{ l: 'PAST', c: '#4ade80' }, { l: 'NOW', c: '#a78bfa' }, { l: 'UPCOMING', c: 'rgba(255,255,255,0.3)' }].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '18px', height: '2px', background: s.c, borderRadius: '1px' }} />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontFamily: 'Space Mono' }}>{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fgSpin { to { transform: rotate(360deg); } }
        @keyframes fgRing { 0%,100% { stroke-opacity: 0.04; } 50% { stroke-opacity: 0.5; } }
      `}</style>
    </div>
  )
}