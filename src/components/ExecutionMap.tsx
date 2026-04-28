import { useMemo } from 'react'
import type { FlowBranch, FlowTask } from '../hooks/useFlowData'
import { useFlowData } from '../hooks/useFlowData'

interface ExecutionMapProps {
  workspaceId: string | null
  onTaskClick?: (task: FlowTask, branch: FlowBranch) => void
}

// Layout constants
const TRUNK_Y         = 80        // y position of the trunk line
const TRUNK_X_START   = 60        // trunk starts here
const TRUNK_X_END_PAD = 60        // padding after last branch
const BRANCH_X_GAP    = 160       // horizontal space between branch origins
const NODE_X_GAP      = 52        // horizontal space between task nodes on a branch
const BRANCH_DROP     = 180       // how far down branches hang from trunk
const NODE_R          = 10        // task node circle radius
const BRANCH_X_OFFSET = 80        // first branch starts this far from trunk start

function statusColor(status: string, branchColor: string): string {
  switch (status) {
    case 'done':        return '#34d399'
    case 'in_progress': return '#38bdf8'
    case 'review':      return '#f472b6'
    default:            return branchColor
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'done':        return '✓'
    case 'in_progress': return '▶'
    case 'review':      return '⋯'
    default:            return '·'
  }
}

export default function ExecutionMap({ workspaceId, onTaskClick }: ExecutionMapProps) {
  const { branches, totalTasks, totalDone, overallProgress, loading, error } = useFlowData(workspaceId)

  // Compute SVG layout
  const layout = useMemo(() => {
    if (branches.length === 0) return null

    // Each branch needs: its origin x on trunk, and space for all its nodes
    let trunkX = TRUNK_X_START + BRANCH_X_OFFSET
    const branchLayouts = branches.map(branch => {
      const originX = trunkX
      const nodeCount = branch.tasks.length

      // Nodes spread horizontally from origin
      const nodes = branch.tasks.map((task, i) => ({
        task,
        x: originX + i * NODE_X_GAP,
        y: TRUNK_Y + BRANCH_DROP,
      }))

      const branchWidth = Math.max(NODE_X_GAP * nodeCount, NODE_X_GAP)
      trunkX += Math.max(branchWidth, BRANCH_X_GAP)

      return { branch, originX, nodes }
    })

    const svgWidth  = trunkX + TRUNK_X_END_PAD
    const svgHeight = TRUNK_Y + BRANCH_DROP + NODE_R * 2 + 60 // label space

    return { branchLayouts, svgWidth, svgHeight }
  }, [branches])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '2px solid rgba(139,92,246,0.3)', borderTop: '2px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Mono', fontSize: '11px', letterSpacing: '0.1em' }}>LOADING FLOW…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
        <p style={{ color: '#f87171', fontFamily: 'Space Grotesk', fontSize: '13px' }}>{error}</p>
      </div>
    )
  }

  if (!layout || branches.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', flexDirection: 'column', gap: '12px' }}>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Grotesk', fontSize: '14px' }}>No tasks in this workspace yet.</p>
        <p style={{ color: 'rgba(255,255,255,0.1)', fontFamily: 'Space Mono', fontSize: '11px' }}>Assign tasks to members to see branches.</p>
      </div>
    )
  }

  const { branchLayouts, svgWidth, svgHeight } = layout
  const trunkEnd = svgWidth - TRUNK_X_END_PAD

  return (
    <div style={{ width: '100%', fontFamily: 'Space Grotesk' }}>

      {/* Header stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px', padding: '0 0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '24px' }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', margin: '0 0 4px' }}>OVERALL PROGRESS</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '120px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
              <div style={{ width: `${overallProgress}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #34d399)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
            </div>
            <span style={{ color: '#a78bfa', fontFamily: 'Space Mono', fontSize: '13px', fontWeight: 700 }}>{overallProgress}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', margin: '0 0 2px' }}>TOTAL</p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '18px', fontWeight: 700, margin: 0 }}>{totalTasks}</p>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', margin: '0 0 2px' }}>DONE</p>
            <p style={{ color: '#34d399', fontSize: '18px', fontWeight: 700, margin: 0 }}>{totalDone}</p>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Space Mono', letterSpacing: '0.15em', margin: '0 0 2px' }}>BRANCHES</p>
            <p style={{ color: '#38bdf8', fontSize: '18px', fontWeight: 700, margin: 0 }}>{branches.length}</p>
          </div>
        </div>
      </div>

      {/* Branch legend */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {branches.map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '5px 12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.color, flexShrink: 0 }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{b.name}</span>
            <span style={{ color: b.color, fontSize: '11px', fontFamily: 'Space Mono' }}>{b.progress}%</span>
          </div>
        ))}
      </div>

      {/* SVG Graph */}
      <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', minWidth: '100%' }}
        >
          <defs>
            {/* Glow filter per branch color */}
            {branchLayouts.map(({ branch }) => (
              <filter key={branch.id} id={`glow-${branch.id}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* ── TRUNK LINE ── */}
          <line
            x1={TRUNK_X_START}
            y1={TRUNK_Y}
            x2={trunkEnd}
            y2={TRUNK_Y}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={2}
            strokeLinecap="round"
          />

          {/* Trunk start dot */}
          <circle cx={TRUNK_X_START} cy={TRUNK_Y} r={5} fill="rgba(255,255,255,0.2)" />

          {/* Trunk arrow head */}
          <polygon
            points={`${trunkEnd},${TRUNK_Y} ${trunkEnd - 10},${TRUNK_Y - 5} ${trunkEnd - 10},${TRUNK_Y + 5}`}
            fill="rgba(255,255,255,0.2)"
          />

          {/* TRUNK label */}
          <text
            x={TRUNK_X_START}
            y={TRUNK_Y - 14}
            fill="rgba(255,255,255,0.2)"
            fontSize={9}
            fontFamily="Space Mono"
            letterSpacing="0.15em"
          >
            TRUNK
          </text>

          {/* ── BRANCHES ── */}
          {branchLayouts.map(({ branch, originX, nodes }) => {
            const branchY = TRUNK_Y + BRANCH_DROP
            const lastNodeX = nodes.length > 0 ? nodes[nodes.length - 1].x : originX

            return (
              <g key={branch.id}>
                {/* Vertical drop from trunk to branch line */}
                <line
                  x1={originX}
                  y1={TRUNK_Y}
                  x2={originX}
                  y2={branchY}
                  stroke={branch.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                  strokeDasharray="4 3"
                />

                {/* Trunk junction dot */}
                <circle
                  cx={originX}
                  cy={TRUNK_Y}
                  r={4}
                  fill={branch.color}
                  opacity={0.7}
                />

                {/* Horizontal branch line */}
                <line
                  x1={originX}
                  y1={branchY}
                  x2={lastNodeX}
                  y2={branchY}
                  stroke={branch.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                />

                {/* Branch label */}
                <text
                  x={originX}
                  y={branchY + NODE_R + 20}
                  fill={branch.color}
                  fontSize={10}
                  fontFamily="Space Mono"
                  letterSpacing="0.08em"
                  opacity={0.8}
                >
                  {branch.name.length > 12 ? branch.name.slice(0, 12) + '…' : branch.name}
                </text>

                {/* Progress under label */}
                <text
                  x={originX}
                  y={branchY + NODE_R + 34}
                  fill={branch.color}
                  fontSize={9}
                  fontFamily="Space Mono"
                  opacity={0.5}
                >
                  {branch.done}/{branch.total} done
                </text>

                {/* ── TASK NODES ── */}
                {nodes.map(({ task, x, y }) => {
                  const nodeColor = statusColor(task.status, branch.color)
                  const isDone = task.status === 'done'
                  const isPending = task.pending_approval

                  return (
                    <g
                      key={task.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onTaskClick?.(task, branch)}
                    >
                      {/* Connector line from branch to node */}
                      {x !== originX && (
                        <line
                          x1={x - NODE_X_GAP}
                          y1={y}
                          x2={x}
                          y2={y}
                          stroke={branch.color}
                          strokeWidth={1}
                          strokeOpacity={0.2}
                        />
                      )}

                      {/* Pending approval ring */}
                      {isPending && (
                        <circle
                          cx={x}
                          cy={y}
                          r={NODE_R + 4}
                          fill="none"
                          stroke="#f472b6"
                          strokeWidth={1.5}
                          strokeDasharray="3 2"
                          opacity={0.7}
                        />
                      )}

                      {/* Node circle */}
                      <circle
                        cx={x}
                        cy={y}
                        r={NODE_R}
                        fill={isDone ? nodeColor : 'rgba(8,4,18,0.9)'}
                        stroke={nodeColor}
                        strokeWidth={isDone ? 0 : 2}
                        filter={`url(#glow-${branch.id})`}
                      />

                      {/* Status symbol */}
                      <text
                        x={x}
                        y={y + 4}
                        textAnchor="middle"
                        fill={isDone ? 'rgba(0,0,0,0.8)' : nodeColor}
                        fontSize={9}
                        fontFamily="Space Mono"
                      >
                        {statusLabel(task.status)}
                      </text>

                      {/* Task title tooltip on hover — using SVG title */}
                      <title>{task.title} · {task.status}</title>
                    </g>
                  )
                })}
              </g>
            )
          })}

          {/* Status legend */}
          {[
            { label: 'Todo',        color: '#6b7280', symbol: '·' },
            { label: 'In Progress', color: '#38bdf8', symbol: '▶' },
            { label: 'Review',      color: '#f472b6', symbol: '⋯' },
            { label: 'Done',        color: '#34d399', symbol: '✓' },
          ].map(({ label, color }, i) => (
            <g key={label} transform={`translate(${TRUNK_X_START + i * 90}, ${svgHeight - 18})`}>
              <circle cx={6} cy={0} r={5} fill={color} opacity={0.7} />
              <text x={14} y={4} fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="Space Mono">{label}</text>
            </g>
          ))}
        </svg>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}