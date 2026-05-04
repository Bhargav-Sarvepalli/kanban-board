import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useFlowData } from '../../hooks/useFlowData'
import { supabase } from '../../supabase'
import type { FlowBranch, FlowTask } from '../../hooks/useFlowData'

interface FlowGraphProps {
  workspaceId: string | null
  userId: string | null
  onBranchClick: (branch: FlowBranch) => void
  projectId?: string | null
  onOpenStandup?: () => void
}

const NODE_R        = 20
const TRUNK_NODE_R  = 24
const NODE_SPACING  = 160
const PHASE_START_X = 100
const PHASE_SPACING = 720
const BRANCH_CARD_W = 280
const TRUNK_COLOR = '#2dd4bf'

function statusFill(s: string) {
  return s === 'done' ? '#22c55e' : s === 'in_progress' ? '#3b82f6' : s === 'in_review' ? '#f59e0b' : 'transparent'
}
function statusBorder(s: string) {
  return s === 'done' ? '#22c55e' : s === 'in_progress' ? '#60a5fa' : s === 'in_review' ? '#fbbf24' : 'rgba(255,255,255,0.3)'
}
function statusIcon(s: string) {
  return s === 'done' ? '✓' : s === 'in_progress' ? '⚡' : s === 'in_review' ? '👁' : '○'
}
function isOverdue(t: FlowTask) {
  if (!t.due_date || t.status === 'done') return false
  const [y, m, d] = t.due_date.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const today = new Date(new Date().setHours(0, 0, 0, 0))
  return due < today
}

// Health label per branch — useful for managers and leads
function branchHealth(branch: FlowBranch): { label: string; color: string } {
  if (branch.total > 0 && branch.done === branch.total) return { label: 'MERGED', color: '#22c55e' }
  const hasOverdue = branch.tasks.some(t => isOverdue(t))
  const hasBlocked = branch.tasks.some(t => t.priority === 'high' && t.status === 'todo')
  if (hasOverdue || hasBlocked) return { label: 'BLOCKED', color: '#ef4444' }
  if (branch.progress < 30 && branch.tasks.length > 2) return { label: 'AT RISK', color: '#f59e0b' }
  if (branch.progress >= 70) return { label: 'ON TRACK', color: '#22c55e' }
  return { label: 'IN PROGRESS', color: '#60a5fa' }
}

function branchLastEdited(branch: FlowBranch): Date | null {
  const latest = branch.tasks
    .map(t => t.last_edited_at ? new Date(t.last_edited_at).getTime() : 0)
    .filter(Boolean)
    .sort((a, b) => b - a)[0]
  return latest ? new Date(latest) : null
}

function hoursSince(date: Date | null): number | null {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 36e5)
}

function branchSignals(branch: FlowBranch) {
  const overdue = branch.tasks.filter(t => isOverdue(t)).length
  const blocked = branch.tasks.filter(t => t.pending_approval || (t.priority === 'high' && t.status === 'todo')).length
  const active = branch.tasks.filter(t => t.status === 'in_progress').length
  const review = branch.tasks.filter(t => t.status === 'in_review').length
  const open = branch.tasks.filter(t => t.status !== 'done').length
  const lastEdited = branchLastEdited(branch)
  const quietHours = hoursSince(lastEdited)
  const stale = branch.total > 0 && (quietHours === null || quietHours >= 48) && open > 0
  const empty = branch.total === 0
  const atRisk = overdue > 0 || blocked > 0 || stale || (branch.progress < 30 && branch.total > 2)
  return { overdue, blocked, active, review, open, lastEdited, quietHours, stale, empty, atRisk }
}

function relativeUpdate(hours: number | null): string {
  if (hours === null) return 'No update'
  if (hours < 1) return 'Updated now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function loadMergedBranchIds(projectId?: string | null): Set<string> {
  if (!projectId || typeof window === 'undefined') return new Set()
  try {
    const stored = window.localStorage.getItem(`flow-merged:${projectId}`)
    return new Set(stored ? JSON.parse(stored) as string[] : [])
  } catch {
    return new Set()
  }
}

interface NodeLayout { task: FlowTask; x: number; y: number }
interface MilestoneLayout { id: string; label: string; x: number }
interface BranchLayout {
  branch: FlowBranch; above: boolean
  originX: number; branchY: number; cardX: number; mergeX: number
  nodes: NodeLayout[]; endX: number
}

function overallHealth(branches: FlowBranch[]) {
  if (!branches.length) return { label: 'NO DATA', color: '#6b7280' }
  const avg = branches.reduce((s, b) => s + b.progress, 0) / branches.length
  return avg >= 70 ? { label: 'ON TRACK', color: '#22c55e' }
       : avg >= 40 ? { label: 'AT RISK',  color: '#f59e0b' }
       :             { label: 'BEHIND',   color: '#ef4444' }
}

export default function FlowGraph({ workspaceId, userId, onBranchClick, projectId, onOpenStandup }: FlowGraphProps) {
  const { branches, milestones, totalTasks, totalDone, overallProgress, loading, error, refetch } = useFlowData(workspaceId, projectId)

  const [hovBranch,  setHovBranch]  = useState<string | null>(null)
  const [hovNode,    setHovNode]    = useState<string | null>(null)
  const [tooltip,    setTooltip]    = useState<{ x: number; y: number; task: FlowTask; branch: FlowBranch } | null>(null)
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [showTaskPaths, setShowTaskPaths] = useState(false)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [focusBranchId, setFocusBranchId] = useState<string | null>(null)
  const [mergedBranchIds, setMergedBranchIds] = useState<Set<string>>(() => loadMergedBranchIds(projectId))
  const [dragging,   setDragging]   = useState(false)
  const [drag0,      setDrag0]      = useState({ x: 0, scroll: 0 })
  const [svgH,       setSvgH]       = useState(500)
  const [mergingId,  setMergingId]  = useState<string | null>(null)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [showBriefDetails, setShowBriefDetails] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showRiskInfo, setShowRiskInfo] = useState(false)
  const rootRef   = useRef<HTMLDivElement>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const m = () => setSvgH(el.clientHeight || 500)
    m(); const ro = new ResizeObserver(m); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await rootRef.current?.requestFullscreen()
    } catch {
      setIsFullscreen(v => !v)
    }
  }

  const persistMergedBranch = useCallback((branchId: string) => {
    if (!projectId) return
    setMergedBranchIds(prev => {
      const next = new Set(prev)
      next.add(branchId)
      window.localStorage.setItem(`flow-merged:${projectId}`, JSON.stringify([...next]))
      return next
    })
  }, [projectId])

  const canvasH = Math.max(svgH, 1040)
  const TRUNK_Y = Math.round(canvasH * 0.52)

  const layout = useMemo<{ branches: BranchLayout[]; svgWidth: number; nowX: number; milestoneNodes: MilestoneLayout[] } | null>(() => {
    if (!branches.length) return null
    const milestoneNodes = milestones.length > 0
      ? milestones.map((m, i) => ({ id: m.id, label: m.name, x: PHASE_START_X + i * PHASE_SPACING }))
      : [
          { id: 'start', label: 'Start', x: PHASE_START_X },
          { id: 'end',   label: 'End',   x: PHASE_START_X + PHASE_SPACING },
        ]
    const lastPhaseX = milestoneNodes[milestoneNodes.length - 1].x
    const maxTaskRun = showTaskPaths
      ? branches.reduce((max, b) => Math.max(max, Math.max(b.tasks.length - 1, 0) * NODE_SPACING + BRANCH_CARD_W), 0)
      : 0
    const svgWidth   = Math.max(lastPhaseX + maxTaskRun + 760, 3200)
    const nowX       = milestoneNodes[Math.min(1, milestoneNodes.length - 1)]?.x ?? 360

    const milestoneIndex = new Map(milestoneNodes.map((m, i) => [m.id, i]))
    const buckets = new Map<number, FlowBranch[]>()
    branches.forEach(branch => {
      const rawIndex = branch.milestone_id ? milestoneIndex.get(branch.milestone_id) : 0
      const phaseIndex = Math.max(0, Math.min(rawIndex ?? 0, milestoneNodes.length - 1))
      const current = buckets.get(phaseIndex) ?? []
      current.push(branch)
      buckets.set(phaseIndex, current)
    })

    const result: BranchLayout[] = []
    buckets.forEach((bucket, phaseIndex) => {
      const intervalStart = milestoneNodes[phaseIndex].x
      const intervalEnd = milestoneNodes[phaseIndex + 1]?.x ?? intervalStart + PHASE_SPACING
      const intervalWidth = intervalEnd - intervalStart
      bucket.forEach((branch, slot) => {
        const above = slot % 2 === 0
        const lane = Math.floor(slot / 2)
        const branchY = TRUNK_Y + (above ? -1 : 1) * (104 + lane * 88)
        const slotRatio = (slot + 1) / (bucket.length + 1)
        const originX = intervalStart + intervalWidth * (0.12 + slotRatio * 0.18)
        const cardX = intervalStart + 190
        const mergeX = intervalEnd - 115
        const taskStartX = cardX + BRANCH_CARD_W + 58
        const nodes: NodeLayout[] = branch.tasks.map((task, i) => ({
          task, x: taskStartX + i * NODE_SPACING, y: branchY + 20,
        }))
        const endX = nodes.length > 0 ? nodes[nodes.length - 1].x : cardX + BRANCH_CARD_W
        result.push({ branch, above, originX, branchY, cardX, mergeX, nodes, endX })
      })
    })
    return { branches: result, svgWidth, nowX, milestoneNodes }
  }, [branches, milestones, showTaskPaths, TRUNK_Y])

  useEffect(() => {
    if (!layout || !scrollRef.current) return
    scrollRef.current.scrollLeft = 0
  }, [layout])

  const h  = overallHealth(branches)

  // Count stats useful to each role
  const activeTasks  = branches.reduce((s, b) => s + b.tasks.filter(t => t.status === 'in_progress').length, 0)
  const overdueTasks = branches.reduce((s, b) => s + b.tasks.filter(t => isOverdue(t)).length, 0)
  const blockedCount = branches.filter(b => branchHealth(b).label === 'BLOCKED').length
  const mergedCount  = branches.filter(b => mergedBranchIds.has(b.id)).length
  const branchSignalMap = useMemo(() => new Map(branches.map(b => [b.id, branchSignals(b)])), [branches])
  const attentionBranches = useMemo(
    () => branches.filter(b => branchSignalMap.get(b.id)?.atRisk || branchSignalMap.get(b.id)?.empty),
    [branches, branchSignalMap],
  )
  const staleBranches = useMemo(
    () => branches.filter(b => branchSignalMap.get(b.id)?.stale),
    [branches, branchSignalMap],
  )
  const completedBranches = useMemo(
    () => branches.filter(b => b.total > 0 && b.done === b.total && !mergedBranchIds.has(b.id)),
    [branches, mergedBranchIds],
  )
  const focusBranch = branches.find(b => b.id === focusBranchId) ?? attentionBranches[0] ?? branches[0] ?? null
  const focusSignals = focusBranch ? branchSignalMap.get(focusBranch.id) : null
  const standupItems = useMemo(() => {
    const items: { label: string; value: string; color: string }[] = []
    if (attentionBranches.length) items.push({ label: 'Needs attention', value: `${attentionBranches.length} feature${attentionBranches.length === 1 ? '' : 's'}`, color: '#f87171' })
    if (staleBranches.length) items.push({ label: 'No recent update', value: staleBranches.slice(0, 2).map(b => b.name).join(', '), color: '#f59e0b' })
    if (completedBranches.length) items.push({ label: 'Ready to merge', value: completedBranches.slice(0, 2).map(b => b.name).join(', '), color: '#22c55e' })
    if (!items.length) items.push({ label: 'Standup focus', value: 'No urgent blockers in Flow', color: '#60a5fa' })
    return items.slice(0, 3)
  }, [attentionBranches, staleBranches, completedBranches])

  // My tasks: branches where at least one task belongs to the current user
  const myBranchIds = userId
    ? new Set(branches.filter(b => b.tasks.some(t => t.assignee_id === userId)).map(b => b.id))
    : new Set<string>()

  const mergeBranch = async (branch: FlowBranch) => {
    if (!projectId || branch.total === 0 || mergingId) return
    if (mergedBranchIds.has(branch.id)) return
    const unfinished = branch.tasks.filter(t => t.status !== 'done')
    if (unfinished.length > 0) {
      setMergeError(`${branch.name} still has ${unfinished.length} open task${unfinished.length === 1 ? '' : 's'}. Finish the branch before merging.`)
      return
    }

    setMergeError(null)
    setMergingId(branch.id)
    persistMergedBranch(branch.id)
    const { error: taskErr } = await supabase.from('tasks').update({
      show_on_flow: true,
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
    }).eq('project_id', projectId).eq('feature_id', branch.id)

    if (taskErr) {
      setMergeError(taskErr.message)
      setMergedBranchIds(prev => {
        const next = new Set(prev)
        next.delete(branch.id)
        window.localStorage.setItem(`flow-merged:${projectId}`, JSON.stringify([...next]))
        return next
      })
    }
    else await refetch()
    setMergingId(null)
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '16px', padding: '40px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>⚡</div>
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <p style={{ color: '#e2e2e8', fontSize: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 500, margin: '0 0 8px' }}>Nothing on the flow yet</p>
        <p style={{ color: '#3d3d52', fontSize: '13px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, margin: 0 }}>
          {projectId
            ? 'To see tasks here: open a task, assign it to a feature, then toggle "Show on Flow" on.'
            : 'Assign tasks to team members to see their work on the execution map.'}
        </p>
      </div>
      {projectId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '320px' }}>
          {[
            { n: '1', text: 'Go to Dashboard → add a feature if none exist' },
            { n: '2', text: 'Open a task → assign it to a feature' },
            { n: '3', text: 'Toggle "Show on Flow" in the task detail panel' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e2e', borderRadius: '7px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#a78bfa', fontFamily: 'Inter, sans-serif', fontWeight: 600, flexShrink: 0 }}>{s.n}</div>
              <span style={{ color: '#6b6b7b', fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const trunkEnd = layout.svgWidth - 60
  const nowX     = layout.nowX
  const pastX    = nowX * 0.44
  const trunkPath = `M 60 ${TRUNK_Y} L ${trunkEnd} ${TRUNK_Y}`

  return (
    <div ref={rootRef} style={{
      width: isFullscreen ? '100vw' : '100%',
      height: isFullscreen ? '100vh' : '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      background: '#0a0a0f',
    }}>

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
            position: 'relative',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: h.color, boxShadow: `0 0 10px ${h.color}` }} />
            <span style={{ color: h.color, fontSize: '12px', fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '0.1em' }}>{h.label}</span>
            {(h.label === 'AT RISK' || h.label === 'BEHIND') && (
              <button onClick={() => setShowRiskInfo(v => !v)} title="Why this status?" style={{ width: '14px', height: '14px', borderRadius: '50%', border: `1px solid ${h.color}80`, background: 'rgba(0,0,0,0.18)', color: h.color, cursor: 'pointer', fontSize: '9px', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 900, lineHeight: '12px', padding: 0 }}>
                i
              </button>
            )}
            {showRiskInfo && (
              <div style={{ position: 'absolute', top: '34px', left: 0, width: '300px', zIndex: 40, padding: '12px 14px', borderRadius: '10px', background: 'rgba(10,10,15,0.98)', border: `1px solid ${h.color}55`, boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}>
                <p style={{ margin: '0 0 7px', color: 'white', fontSize: '12px', fontFamily: 'Space Grotesk', fontWeight: 750 }}>Why Flow is {h.label.toLowerCase()}</p>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.66)', fontSize: '11px', fontFamily: 'Space Grotesk', lineHeight: 1.45 }}>
                  Risk increases when features are blocked, overdue, stale for 48h, or when overall completion stays below the healthy threshold. Use Attention to isolate the branches that need a standup decision.
                </p>
              </div>
            )}
          </div>

          {/* Stats — meaningful to managers (blocked), leads (active), all (overdue) */}
          <div style={{ display: 'flex', gap: '20px' }}>
            {[
              { label: projectId ? 'FEATURES' : 'BRANCHES', value: branches.length,  color: '#c4b5fd' },
              ...(projectId ? [{ label: 'MERGED', value: mergedCount, color: '#22c55e' }] : []),
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

        {/* Right: manager actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {projectId && (
            <button onClick={() => setAttentionOnly(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: attentionOnly ? 'rgba(248,113,113,0.16)' : 'rgba(255,255,255,0.09)', border: `1px solid ${attentionOnly ? 'rgba(248,113,113,0.5)' : 'rgba(255,255,255,0.2)'}`, borderRadius: '8px', color: attentionOnly ? '#fecaca' : 'rgba(255,255,255,0.78)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 700, transition: 'all 0.2s' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: attentionOnly ? '#f87171' : 'rgba(255,255,255,0.4)' }} />
              ATTENTION
            </button>
          )}
          {myBranchIds.size > 0 && (
            <button onClick={() => setMyTasksOnly(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: myTasksOnly ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${myTasksOnly ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '8px', color: myTasksOnly ? '#a78bfa' : 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 600, transition: 'all 0.2s' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: myTasksOnly ? '#8b5cf6' : 'rgba(255,255,255,0.4)' }} />
              MY TASKS
            </button>
          )}
          {branches.length > 0 && (
            <button onClick={() => onOpenStandup?.()}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', color: '#ddd6fe', cursor: 'pointer', fontSize: '11px', fontFamily: 'Space Mono', fontWeight: 750, transition: 'all 0.2s' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#a78bfa' }} />
              STANDUP
            </button>
          )}
        </div>
      </div>

      {/* ── BRANCH / FEATURE PILLS ── */}
      <div style={{
        display: 'flex', gap: '8px', padding: '8px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto', flexShrink: 0, alignItems: 'stretch',
      }}>
        {projectId && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', flexShrink: 0 }}>
            <div style={{ width: showBriefDetails ? '430px' : '330px', padding: '9px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.035)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '7px' }}>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.14em' }}>STANDUP BRIEF</p>
                <button onClick={() => setShowBriefDetails(v => !v)}
                  style={{ height: '18px', padding: '0 7px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.62)', fontSize: '8px', fontFamily: 'Space Mono', fontWeight: 700, cursor: 'pointer' }}>
                  {showBriefDetails ? 'LESS' : 'DETAILS'}
                </button>
              </div>
              {standupItems.map(item => (
                <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '6px 112px minmax(0, 1fr)', alignItems: 'start', gap: '7px', marginTop: '5px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontFamily: 'Space Mono' }}>{item.label}</span>
                  <span title={item.value} style={{ color: 'white', fontSize: '11px', fontFamily: 'Space Grotesk', fontWeight: 650, overflow: 'hidden', textOverflow: showBriefDetails ? undefined : 'ellipsis', whiteSpace: showBriefDetails ? 'normal' : 'nowrap', lineHeight: 1.35 }}>{item.value}</span>
                </div>
              ))}
            </div>

            {focusBranch && focusSignals && (
              <div style={{ width: showBriefDetails ? '430px' : '380px', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${focusSignals.atRisk ? 'rgba(248,113,113,0.24)' : 'rgba(255,255,255,0.1)'}`, background: focusSignals.atRisk ? 'rgba(248,113,113,0.055)' : 'rgba(255,255,255,0.035)' }}>
                <p style={{ margin: '0 0 7px', color: 'rgba(255,255,255,0.45)', fontSize: '9px', fontFamily: 'Space Mono', letterSpacing: '0.14em' }}>FOCUS FEATURE</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: focusSignals.atRisk ? '#f87171' : focusBranch.color, flexShrink: 0 }} />
                  <span title={focusBranch.name} style={{ color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 750, overflow: 'hidden', textOverflow: showBriefDetails ? undefined : 'ellipsis', whiteSpace: showBriefDetails ? 'normal' : 'nowrap', lineHeight: 1.25, minWidth: 0 }}>{focusBranch.name}</span>
                  <button onClick={() => onBranchClick(focusBranch)}
                    style={{ marginLeft: 'auto', height: '22px', padding: '0 8px', borderRadius: '7px', border: '1px solid rgba(139,92,246,0.35)', background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', fontSize: '9px', fontFamily: 'Space Mono', fontWeight: 700, cursor: 'pointer' }}>
                    OPEN
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontFamily: 'Space Mono' }}>
                  <span>{focusBranch.done}/{focusBranch.total} tasks</span>
                  <span>{focusSignals.blocked} blocked</span>
                  <span>{focusSignals.overdue} overdue</span>
                  <span>{relativeUpdate(focusSignals.quietHours)}</span>
                </div>
              </div>
            )}
          </div>
        )}
        {mergeError && (
          <div style={{ flexShrink: 0, padding: '5px 10px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '11px', fontFamily: 'Space Grotesk' }}>
            {mergeError}
          </div>
        )}
        {!projectId && branches.map(b => {
          const bh = branchHealth(b)
          const isMyBranch = myBranchIds.has(b.id)
          const dimmed = myTasksOnly && !isMyBranch
          const canMerge = projectId && b.total > 0 && b.done === b.total
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
              {projectId && (
                <button
                  onClick={e => { e.stopPropagation(); void mergeBranch(b) }}
                  disabled={!canMerge || mergingId === b.id}
                  title={canMerge ? 'Merge completed feature into main trunk' : 'Finish all feature tasks before merging'}
                  style={{
                    marginLeft: '2px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    border: `1px solid ${canMerge ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    background: canMerge ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                    color: canMerge ? '#4ade80' : 'rgba(255,255,255,0.28)',
                    cursor: canMerge ? 'pointer' : 'not-allowed',
                    fontSize: '9px',
                    fontFamily: 'Space Mono',
                    fontWeight: 700,
                  }}>
                  {mergingId === b.id ? '...' : 'MERGE'}
                </button>
              )}
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { l: 'Done',    c: '#4ade80' },
            { l: 'Active',  c: '#60a5fa' },
            { l: 'Review',  c: '#fbbf24' },
            ...(projectId ? [{ l: 'Merged', c: '#22c55e' }] : []),
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
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          style={{
            position: 'absolute',
            top: '14px',
            right: '18px',
            zIndex: 20,
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(12,12,18,0.72)',
            color: 'rgba(255,255,255,0.72)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            {isFullscreen ? (
              <>
                <path d="M6.6 2.8v3.8H2.8M11.4 15.2v-3.8h3.8M11.4 2.8v3.8h3.8M6.6 15.2v-3.8H2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <>
                <path d="M6.6 2.8H2.8v3.8M11.4 2.8h3.8v3.8M6.6 15.2H2.8v-3.8M11.4 15.2h3.8v-3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
          </svg>
        </button>
        {projectId && (
          <button
            onClick={() => setShowTaskPaths(v => !v)}
            title={showTaskPaths ? 'Hide task paths' : 'Show task paths'}
            style={{
              position: 'absolute',
              top: '58px',
              right: '18px',
              zIndex: 20,
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              border: `1px solid ${showTaskPaths ? 'rgba(96,165,250,0.42)' : 'rgba(255,255,255,0.16)'}`,
              background: showTaskPaths ? 'rgba(37,99,235,0.34)' : 'rgba(12,12,18,0.72)',
              color: showTaskPaths ? '#bfdbfe' : 'rgba(255,255,255,0.68)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
            }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 5.2h5.2c1.5 0 2.3.8 2.3 2.2v3.2c0 1.4.8 2.2 2.3 2.2H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M3 12.8h3.4c1.2 0 1.9-.7 1.9-1.9V7.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="3" cy="5.2" r="1.4" fill="currentColor" />
              <circle cx="3" cy="12.8" r="1.4" fill="currentColor" />
              <circle cx="15" cy="12.8" r="1.4" fill="currentColor" />
            </svg>
          </button>
        )}
        <div ref={scrollRef}
          onMouseDown={e => { setDragging(true); setDrag0({ x: e.clientX, scroll: scrollRef.current?.scrollLeft ?? 0 }) }}
          onMouseMove={e => { if (!dragging) return; e.preventDefault(); if (scrollRef.current) scrollRef.current.scrollLeft = drag0.scroll - (e.clientX - drag0.x) }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => { setDragging(false); setTooltip(null) }}
          style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'auto', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <svg width={layout.svgWidth} height={canvasH} style={{ display: 'block' }}>
            <defs>
              {layout.branches.map(({ branch }) => (
                <linearGradient key={branch.id} id={`fg-bg-${branch.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%"   stopColor={branch.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={branch.color} stopOpacity="0.1" />
                </linearGradient>
              ))}
              <filter id="fg-river-glow" x="-10%" y="-80%" width="120%" height="260%">
                <feGaussianBlur stdDeviation="7" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
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

            {layout.milestoneNodes.map((m, i) => {
              const nextX = layout.milestoneNodes[i + 1]?.x ?? m.x + PHASE_SPACING
              return (
                <g key={`lane-${m.id}`}>
                  <line x1={nextX} y1={54} x2={nextX} y2={canvasH - 78} stroke="rgba(167,139,250,0.12)" strokeWidth={1} strokeDasharray="5 8" />
                  <text x={m.x + 52} y={36} fill="rgba(255,255,255,0.25)" fontSize={9} fontFamily="Space Mono" fontWeight={700} letterSpacing="0.12em">
                    {m.label.toUpperCase()}
                  </text>
                </g>
              )
            })}

            {/* ── TRUNK ── */}
            <path d={trunkPath} stroke={TRUNK_COLOR} strokeWidth={38} strokeLinecap="round" opacity={0.13} fill="none" />
            <path d={trunkPath} stroke={TRUNK_COLOR} strokeWidth={10} strokeLinecap="round" strokeOpacity={0.92} fill="none" filter="url(#fg-river-glow)" />
            <polygon points={`${trunkEnd + 16},${TRUNK_Y} ${trunkEnd},${TRUNK_Y - 9} ${trunkEnd},${TRUNK_Y + 9}`} fill={TRUNK_COLOR} opacity={0.9} />
            <circle cx={60}  cy={TRUNK_Y} r={6} fill={TRUNK_COLOR} />

            {/* ── MILESTONES ── */}
            {layout.milestoneNodes.map(({ label, x }) => {
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
              })}

            {/* ── BRANCHES ── */}
            {layout.branches.map(({ branch, above, originX, branchY, cardX, mergeX, nodes, endX }) => {
              const isHov      = hovBranch === branch.id
              const isMyBranch = myBranchIds.has(branch.id)
              const signals    = branchSignalMap.get(branch.id) ?? branchSignals(branch)
              const dimmed     = (myTasksOnly && !isMyBranch) || (attentionOnly && !signals.atRisk && !signals.empty)
              const chipWidth  = BRANCH_CARD_W
              const chipStartX = Math.max(8, cardX)
              const chipY      = branchY
              const connectorY = branchY + 22
              const titleY     = (y: number) => above ? y - NODE_R - 18 : y + NODE_R + 26
              const dateY      = (y: number) => above ? y - NODE_R - 32 : y + NODE_R + 40
              const bh         = branchHealth(branch)
              const isMerged   = mergedBranchIds.has(branch.id)
              const canMerge   = projectId && branch.total > 0 && branch.done === branch.total && !isMerged
              const branchEndX = cardX + BRANCH_CARD_W
              const forkPull = above ? -42 : 42
              const cardPull = above ? 18 : -18
              const branchPath = `M ${originX} ${TRUNK_Y} C ${originX + 40} ${TRUNK_Y + forkPull}, ${cardX - 88} ${connectorY + cardPull}, ${cardX} ${connectorY}`
              const returnPath = `M ${branchEndX} ${connectorY} C ${branchEndX + 74} ${connectorY}, ${mergeX - 70} ${TRUNK_Y}, ${mergeX} ${TRUNK_Y}`
              const showMergePath = canMerge || isMerged || mergingId === branch.id

              return (
                <g key={branch.id}
                  opacity={dimmed ? 0.1 : 1}
                  style={{ transition: 'opacity 0.3s', cursor: dragging ? 'grabbing' : 'pointer' }}
                  onMouseEnter={() => { if (!dragging) { setHovBranch(branch.id); setFocusBranchId(branch.id) } }}
                  onMouseLeave={() => setHovBranch(null)}
                  onClick={() => !dragging && onBranchClick(branch)}
                >
                  <path
                    d={branchPath}
                    fill="none" stroke={isMerged ? '#22c55e' : signals.atRisk ? '#f87171' : branch.color}
                    strokeOpacity={isHov ? 0.88 : isMerged ? 0.58 : signals.atRisk ? 0.66 : 0.32}
                    strokeWidth={isHov ? 3 : isMerged ? 2.5 : signals.atRisk ? 2.4 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={signals.atRisk ? '12 12' : undefined}
                    className={signals.atRisk ? 'fg-attention-flow' : undefined}
                    style={{ transition: 'all 0.2s' }}
                  />
                  <circle cx={originX} cy={TRUNK_Y} r={isHov ? 6 : 4}
                    fill={isMerged ? '#22c55e' : signals.atRisk ? '#f87171' : branch.color} opacity={isHov ? 1 : 0.58}
                    filter={isHov ? `url(#fg-gf-${branch.id})` : undefined}
                    style={{ transition: 'all 0.2s' }}
                  />
                  {showMergePath && (
                    <path
                      d={returnPath}
                      fill="none" stroke="#22c55e"
                      strokeOpacity={mergingId === branch.id ? 0.92 : isMerged ? 0.58 : 0.42}
                      strokeWidth={mergingId === branch.id ? 3.2 : isMerged ? 2.5 : 2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={mergingId === branch.id ? '14 10' : isMerged ? undefined : '5 8'}
                      className={mergingId === branch.id ? 'fg-merge-flow' : undefined}
                    />
                  )}
                  {showTaskPaths && nodes.length > 0 && (
                    <line x1={branchEndX} y1={connectorY} x2={endX} y2={connectorY}
                      stroke={branch.color} strokeWidth={isHov ? 2.5 : 2}
                      strokeOpacity={isHov ? 0.62 : 0.2}
                      style={{ transition: 'all 0.2s' }}
                    />
                  )}

                  {/* ── Branch chip — anchored at fork, never floating ── */}
                  <foreignObject x={chipStartX} y={chipY} width={chipWidth} height={92} style={{ overflow: 'visible', pointerEvents: 'auto' }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto auto', alignItems: 'center', columnGap: '7px',
                      background: isMerged ? 'rgba(34,197,94,0.12)' : signals.atRisk ? 'rgba(248,113,113,0.11)' : `${branch.color}1a`,
                      border: `1.5px solid ${isMerged ? '#22c55e' : signals.atRisk ? '#f87171' : branch.color}${isHov ? 'cc' : '55'}`,
                      borderRadius: '10px', padding: '7px 10px 7px 7px',
                      backdropFilter: 'blur(12px)',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s',
                      maxWidth: `${chipWidth - 4}px`,
                      overflow: 'hidden',
                    }}>
                      {/* Avatar / initials */}
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        border: `2px solid ${isMerged ? '#22c55e' : signals.atRisk ? '#f87171' : branch.color}`,
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
                      <span style={{
                        color: 'white', fontSize: '13px', fontFamily: 'Space Grotesk', fontWeight: 800,
                        minWidth: 0, maxWidth: '145px', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {branch.name}
                      </span>
                      {/* Health dot — color-coded so managers can scan instantly */}
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isMerged ? '#22c55e' : signals.stale ? '#f59e0b' : bh.color, flexShrink: 0 }} title={isMerged ? 'Merged' : signals.stale ? 'No recent update' : bh.label} />
                      {/* Progress */}
                      <span style={{ color: branch.color, fontSize: '10px', fontFamily: 'Space Mono', fontWeight: 700 }}>
                        {branch.progress}%
                      </span>
                      <span style={{ gridColumn: '2 / -1', color: signals.stale ? '#fbbf24' : 'rgba(255,255,255,0.52)', fontSize: '8px', fontFamily: 'Space Mono', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isMerged ? 'Merged into trunk' : signals.empty ? 'No flow tasks' : `${signals.blocked} blocked · ${relativeUpdate(signals.quietHours)}`}
                      </span>
                      {projectId && (canMerge || isMerged || mergingId === branch.id) && (
                        <button
                          onClick={e => { e.stopPropagation(); void mergeBranch(branch) }}
                          disabled={!canMerge || isMerged || mergingId === branch.id}
                          title={isMerged ? 'Feature is merged' : canMerge ? 'Merge completed feature into main trunk' : 'Finish all feature tasks before merging'}
                          style={{
                            gridColumn: '1 / -1',
                            justifySelf: 'end',
                            marginTop: '5px',
                            height: '18px',
                            padding: '0 8px',
                            borderRadius: '9px',
                            border: `1px solid ${canMerge || isMerged ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.08)'}`,
                            background: canMerge || isMerged ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                            color: canMerge || isMerged ? '#4ade80' : 'rgba(255,255,255,0.28)',
                            cursor: canMerge && !isMerged ? 'pointer' : 'not-allowed',
                            fontSize: '8px',
                            fontFamily: 'Space Mono',
                            fontWeight: 700,
                          }}>
                          {mergingId === branch.id ? 'MERGING...' : isMerged ? 'MERGED' : 'MERGE'}
                        </button>
                      )}
                    </div>
                  </foreignObject>

                  {/* Task nodes */}
                  {showTaskPaths && nodes.map(({ task, x, y }, ni) => {
                    const od   = isOverdue(task)
                    const done = task.status === 'done'
                    const act  = task.status === 'in_progress'
                    const rev  = task.status === 'in_review'
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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em' }}>← drag to explore →</span>
      </div>

      <style>{`
        @keyframes fgSpin { to { transform: rotate(360deg); } }
        @keyframes fgRing { 0%,100% { stroke-opacity: 0.04; } 50% { stroke-opacity: 0.5; } }
        @keyframes fgAttentionFlow { to { stroke-dashoffset: -40; } }
        @keyframes fgMergeFlow { to { stroke-dashoffset: -96; } }
        .fg-attention-flow { animation: fgAttentionFlow 3.8s linear infinite; }
        .fg-merge-flow { animation: fgMergeFlow 0.75s linear infinite; }
      `}</style>
    </div>
  )
}
