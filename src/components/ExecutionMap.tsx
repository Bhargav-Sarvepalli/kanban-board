import { useMemo, useRef, useState } from 'react'
import { useFlowData } from '../hooks/useFlowData'
import type { FlowBranch, FlowTask } from '../hooks/useFlowData'

interface ExecutionMapProps {
  workspaceId: string | null
  onBranchClick?: (branch: FlowBranch) => void
  onTaskClick?: (task: FlowTask, branch: FlowBranch) => void
}

const TRUNK_Y       = 160
const TRUNK_X_START = 120
const BRANCH_X_GAP  = 280
const NODE_GAP      = 72
const BRANCH_LENGTH = 260
const NODE_R        = 14
const SVG_HEIGHT    = 580

function statusColor(status: string): string {
  switch (status) {
    case 'done':        return '#34d399'
    case 'in_progress': return '#38bdf8'
    case 'review':      return '#f472b6'
    default:            return 'rgba(255,255,255,0.25)'
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case 'done':        return '✓'
    case 'in_progress': return '▶'
    case 'review':      return '◎'
    default:            return '○'
  }
}

interface NodeLayout { task: FlowTask; x: number; y: number }
interface BranchLayout { branch: FlowBranch; originX: number; nodes: NodeLayout[]; endX: number }

export default function ExecutionMap({ workspaceId, onBranchClick, onTaskClick }: ExecutionMapProps) {
  const { branches, totalTasks, totalDone, overallProgress, loading, error } = useFlowData(workspaceId)
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode]     = useState<string | null>(null)
  const [tooltip, setTooltip]             = useState<{ x: number; y: number; task: FlowTask } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const layout = useMemo<{ branches: BranchLayout[]; svgWidth: number } | null>(() => {
    if (!branches.length) return null
    let x = TRUNK_X_START + 180
    const result: BranchLayout[] = []
    for (const branch of branches) {
      const originX = x
      const nodes: NodeLayout[] = branch.tasks.map((task, i) => ({
        task, x: originX + i * NODE_GAP, y: TRUNK_Y + BRANCH_LENGTH,
      }))
      const endX = nodes.length > 0 ? nodes[nodes.length - 1].x : originX
      result.push({ branch, originX, nodes, endX })
      x += Math.max(branch.tasks.length * NODE_GAP + 60, BRANCH_X_GAP)
    }
    return { branches: result, svgWidth: x + 120 }
  }, [branches])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '44px', height: '44px', margin: '0 auto 14px', border: '2px solid rgba(139,92,246,0.2)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'fSpin 0.9s linear infinite' }} />
        <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Space Mono', fontSize: '10px', letterSpacing: '0.2em' }}>LOADING FLOW…</p>
      </div>
      <style>{`@keyframes fSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
      <p style={{ color: '#f87171', fontFamily: 'Space Grotesk' }}>{error}</p>
    </div>
  )

  if (!layout) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '10px' }}>
      <p style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono', fontSize: '11px', letterSpacing: '0.18em' }}>NO BRANCHES YET</p>
      <p style={{ color: 'rgba(255,255,255,0.1)', fontFamily: 'Space Grotesk', fontSize: '13px' }}>Assign tasks to workspace members to see branches appear.</p>
    </div>
  )

  const trunkEnd = layout.svgWidth - 80

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── STATS BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px', padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap' }}>

        {/* Circular progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '52px', height: '52px' }}>
            <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
              <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle cx="26" cy="26" r="22" fill="none" stroke="url(#pg)" strokeWidth="3"
                strokeDasharray={`${(overallProgress / 100) * 138.2} 138.2`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: '10px', fontFamily: 'Space Mono', fontWeight: 700 }}>{overallProgress}%</span>
            </div>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.2em', margin: '0 0 3px' }}>EXECUTION PROGRESS</p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: 0 }}>{totalDone} of {totalTasks} tasks complete</p>
          </div>
        </div>

        <div style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.07)' }} />

        {/* Branch pills — click to filter board */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {branches.map(b => (
            <div key={b.id} onClick={() => onBranchClick?.(b)}
              onMouseEnter={() => setHoveredBranch(b.id)}
              onMouseLeave={() => setHoveredBranch(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px 6px 6px',
                background: hoveredBranch === b.id ? `${b.color}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hoveredBranch === b.id ? b.color + '55' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '24px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {/* Avatar bubble */}
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${b.color}66`, overflow: 'hidden', flexShrink: 0 }}>
                {b.avatar_url ? (
                  <img src={b.avatar_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${b.color}cc, ${b.color}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, fontFamily: 'Space Grotesk', color: 'white' }}>
                    {b.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
              </div>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', fontFamily: 'Space Grotesk' }}>{b.name.split(' ')[0]}</span>
              <span style={{ background: `${b.color}22`, color: b.color, fontSize: '10px', fontFamily: 'Space Mono', padding: '1px 7px', borderRadius: '10px' }}>{b.progress}%</span>
            </div>
          ))}
        </div>

        {/* Status legend */}
        <div style={{ display: 'flex', gap: '14px', flexShrink: 0 }}>
          {[
            { label: 'Todo',     color: 'rgba(255,255,255,0.2)' },
            { label: 'Progress', color: '#38bdf8' },
            { label: 'Review',   color: '#f472b6' },
            { label: 'Done',     color: '#34d399' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color }} />
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', fontFamily: 'Space Mono' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SVG GRAPH ── */}
      <div ref={containerRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
        <svg width={layout.svgWidth} height={SVG_HEIGHT} style={{ display: 'block', minWidth: '100%' }}>
          <defs>
            <linearGradient id="trunkG" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
            </linearGradient>
            {layout.branches.map(({ branch }) => ([
              <linearGradient key={`bg-${branch.id}`} id={`bg-${branch.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={branch.color} stopOpacity="0.7" />
                <stop offset="100%" stopColor={branch.color} stopOpacity="0.1" />
              </linearGradient>,
              <filter key={`gf-${branch.id}`} id={`gf-${branch.id}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>,
            ]))}
            <filter id="tg" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* TRUNK glow */}
          <line x1={TRUNK_X_START} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y}
            stroke="rgba(255,255,255,0.05)" strokeWidth={10} strokeLinecap="round" filter="url(#tg)" />
          {/* TRUNK line */}
          <line x1={TRUNK_X_START} y1={TRUNK_Y} x2={trunkEnd} y2={TRUNK_Y}
            stroke="url(#trunkG)" strokeWidth={2} strokeLinecap="round" />
          {/* Start dot */}
          <circle cx={TRUNK_X_START} cy={TRUNK_Y} r={5} fill="rgba(255,255,255,0.12)" />
          {/* Arrow */}
          <polygon points={`${trunkEnd + 14},${TRUNK_Y} ${trunkEnd + 1},${TRUNK_Y - 6} ${trunkEnd + 1},${TRUNK_Y + 6}`} fill="rgba(255,255,255,0.12)" />
          <text x={TRUNK_X_START} y={TRUNK_Y - 22} fill="rgba(255,255,255,0.12)" fontSize={9} fontFamily="Space Mono" letterSpacing="3">TRUNK</text>

          {/* BRANCHES */}
          {layout.branches.map(({ branch, originX, nodes, endX }) => {
            const isHov = hoveredBranch === branch.id
            const branchY = TRUNK_Y + BRANCH_LENGTH
            const avatarY = branchY + NODE_R + 28

            return (
              <g key={branch.id}
                onMouseEnter={() => setHoveredBranch(branch.id)}
                onMouseLeave={() => setHoveredBranch(null)}
                onClick={() => onBranchClick?.(branch)}
                style={{ cursor: 'pointer' }}
              >
                {/* Junction glow */}
                <circle cx={originX} cy={TRUNK_Y} r={isHov ? 10 : 6}
                  fill={branch.color} opacity={isHov ? 0.4 : 0.15}
                  filter={`url(#gf-${branch.id})`}
                  style={{ transition: 'all 0.25s' }}
                />
                <circle cx={originX} cy={TRUNK_Y} r={isHov ? 5 : 3.5}
                  fill={branch.color} opacity={isHov ? 1 : 0.65}
                  style={{ transition: 'all 0.25s' }}
                />

                {/* Drop line */}
                <line x1={originX} y1={TRUNK_Y + 8} x2={originX} y2={branchY - NODE_R - 16}
                  stroke={`url(#bg-${branch.id})`}
                  strokeWidth={isHov ? 2 : 1.5}
                  strokeDasharray={isHov ? 'none' : '6 4'}
                  style={{ transition: 'stroke-width 0.2s' }}
                />

                {/* Horizontal line between nodes */}
                {nodes.length > 1 && (
                  <line x1={originX} y1={branchY} x2={endX} y2={branchY}
                    stroke={branch.color} strokeWidth={isHov ? 2 : 1.5}
                    strokeOpacity={isHov ? 0.45 : 0.2}
                    style={{ transition: 'all 0.2s' }}
                  />
                )}

                {/* Branch name */}
                <text x={originX} y={branchY - NODE_R - 20}
                  fill={branch.color} fontSize={10} fontFamily="Space Mono" letterSpacing="1"
                  opacity={isHov ? 1 : 0.55} style={{ transition: 'opacity 0.2s' }}>
                  {branch.name.length > 14 ? branch.name.slice(0, 13) + '…' : branch.name}
                </text>
                <text x={originX} y={branchY - NODE_R - 7}
                  fill={branch.color} fontSize={9} fontFamily="Space Mono"
                  opacity={0.35}>
                  {branch.done}/{branch.total} done
                </text>

                {/* TASK NODES */}
                {nodes.map(({ task, x, y }, ni) => {
                  const col = statusColor(task.status)
                  const isDone = task.status === 'done'
                  const isNH = hoveredNode === task.id
                  return (
                    <g key={task.id}
                      onMouseEnter={(e) => {
                        setHoveredNode(task.id)
                        const rect = containerRef.current?.getBoundingClientRect()
                        if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, task })
                      }}
                      onMouseLeave={() => { setHoveredNode(null); setTooltip(null) }}
                      onClick={(e) => { e.stopPropagation(); onTaskClick?.(task, branch) }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Inter-node connector */}
                      {ni > 0 && (
                        <line x1={nodes[ni - 1].x + NODE_R} y1={y} x2={x - NODE_R} y2={y}
                          stroke={branch.color} strokeWidth={1} strokeOpacity={0.18} />
                      )}
                      {/* Outer glow ring */}
                      {(isDone || isNH) && (
                        <circle cx={x} cy={y} r={NODE_R + 7}
                          fill="none" stroke={col} strokeWidth={1} strokeOpacity={0.25}
                          filter={`url(#gf-${branch.id})`} />
                      )}
                      {/* Node */}
                      <circle cx={x} cy={y} r={NODE_R}
                        fill={isDone ? col : 'rgba(8,4,18,0.95)'}
                        stroke={col} strokeWidth={isNH ? 2.5 : 1.5}
                        filter={isNH ? `url(#gf-${branch.id})` : undefined}
                        style={{ transition: 'all 0.15s' }}
                      />
                      {/* Icon */}
                      <text x={x} y={y + 4.5} textAnchor="middle"
                        fill={isDone ? 'rgba(0,0,0,0.8)' : col}
                        fontSize={10} fontFamily="Space Mono">
                        {statusIcon(task.status)}
                      </text>
                    </g>
                  )
                })}

                {/* AVATAR below nodes */}
                <foreignObject x={originX - 20} y={avatarY} width={40} height={40} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    border: `2px solid ${isHov ? branch.color : 'rgba(255,255,255,0.1)'}`,
                    overflow: 'hidden', flexShrink: 0,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: isHov ? `0 0 16px ${branch.color}55` : 'none',
                  }}>
                    {branch.avatar_url ? (
                      <img src={branch.avatar_url} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, ${branch.color}cc, ${branch.color}44)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 700, fontFamily: 'Space Grotesk', color: 'white',
                      }}>
                        {branch.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                    )}
                  </div>
                </foreignObject>

                {/* Avatar name */}
                <text x={originX} y={avatarY + 54} textAnchor="middle"
                  fill={branch.color} fontSize={9} fontFamily="Space Mono"
                  opacity={isHov ? 0.8 : 0.35} style={{ transition: 'opacity 0.2s' }}>
                  {branch.name.split(' ')[0].slice(0, 10).toUpperCase()}
                </text>
              </g>
            )
          })}
        </svg>

        {/* TOOLTIP */}
        {tooltip && (
          <div style={{
            position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 48,
            background: 'rgba(6,3,15,0.97)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '9px 13px', pointerEvents: 'none',
            zIndex: 200, maxWidth: '220px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 600, margin: '0 0 5px', lineHeight: 1.35 }}>
              {tooltip.task.title}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor(tooltip.task.status), flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                {tooltip.task.status.replace('_', ' ').toUpperCase()}
              </span>
              {tooltip.task.due_date && (
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                  · {tooltip.task.due_date}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes fSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}