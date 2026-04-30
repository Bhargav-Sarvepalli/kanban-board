import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

export interface FlowTask {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  pending_approval: boolean
  assignee_id: string | null
}

export interface FlowBranch {
  id: string
  name: string
  avatar_url: string | null
  color: string
  tasks: FlowTask[]
  total: number
  done: number
  progress: number
}

export interface FlowMilestone {
  id: string
  name: string
  position: number
  target_date: string | null
}

export interface FlowData {
  branches: FlowBranch[]
  milestones: FlowMilestone[]   // populated in project mode, empty in workspace mode
  totalTasks: number
  totalDone: number
  overallProgress: number
  loading: boolean
  error: string | null
  refetch: () => void
}

const BRANCH_COLORS = [
  '#8b5cf6', '#38bdf8', '#34d399', '#f472b6',
  '#fb923c', '#a78bfa', '#22d3ee', '#f87171',
]

function colorForIndex(i: number): string {
  return BRANCH_COLORS[i % BRANCH_COLORS.length]
}

function buildBranches(
  groups: Map<string, { name: string; avatar_url: string | null; tasks: FlowTask[] }>,
  unassignedKey = 'unassigned',
  includeUnassigned = true,
  unassignedColor = '#6b7280',
): FlowBranch[] {
  let colorIndex = 0
  const result: FlowBranch[] = []

  for (const [id, data] of groups.entries()) {
    if (id === unassignedKey) continue
    const done = data.tasks.filter(t => t.status === 'done').length
    result.push({
      id, name: data.name, avatar_url: data.avatar_url,
      color: colorForIndex(colorIndex++),
      tasks: data.tasks, total: data.tasks.length, done,
      progress: data.tasks.length > 0 ? Math.round((done / data.tasks.length) * 100) : 0,
    })
  }

  if (includeUnassigned && groups.has(unassignedKey)) {
    const data = groups.get(unassignedKey)!
    const done = data.tasks.filter(t => t.status === 'done').length
    result.push({
      id: unassignedKey, name: 'Unassigned', avatar_url: null, color: unassignedColor,
      tasks: data.tasks, total: data.tasks.length, done,
      progress: data.tasks.length > 0 ? Math.round((done / data.tasks.length) * 100) : 0,
    })
  }

  return result
}

export function useFlowData(
  workspaceId: string | null,
  projectId?: string | null,
): FlowData {
  const [branches,   setBranches]   = useState<FlowBranch[]>([])
  const [milestones, setMilestones] = useState<FlowMilestone[]>([])
  const [totalTasks, setTotalTasks] = useState(0)
  const [totalDone,  setTotalDone]  = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const fetchFlow = useCallback(async () => {
    if (!workspaceId && !projectId) {
      setBranches([]); setMilestones([]); setLoading(false); return
    }
    setLoading(true); setError(null)

    try {
      // ── PROJECT MODE ────────────────────────────────────────────────────────
      if (projectId) {
        const [msRes, taskRes, featRes] = await Promise.all([
          supabase
            .from('project_milestones')
            .select('id, name, position, target_date')
            .eq('project_id', projectId)
            .order('position', { ascending: true }),
          supabase
            .from('tasks')
            .select('id, title, status, priority, due_date, pending_approval, assignee_id, feature_id')
            .eq('project_id', projectId)
            .eq('show_on_flow', true)
            .order('created_at', { ascending: true }),
          supabase
            .from('project_features')
            .select('id, name')
            .eq('project_id', projectId),
        ])

        if (msRes.error) console.warn('[useFlowData] milestones:', msRes.error)
        if (taskRes.error) throw taskRes.error

        setMilestones(msRes.data ?? [])

        const tasks = taskRes.data ?? []
        if (tasks.length === 0) {
          setBranches([]); setTotalTasks(0); setTotalDone(0); setLoading(false); return
        }

        const featureNameMap: Record<string, string> = {}
        featRes.data?.forEach(f => { featureNameMap[f.id] = f.name })

        // Group by feature_id only — tasks without a feature are skipped in project mode
        // so no "Unassigned" branch clutters the graph
        const featureMap = new Map<string, { name: string; avatar_url: string | null; tasks: FlowTask[] }>()
        for (const task of tasks) {
          if (!task.feature_id) continue
          const name = featureNameMap[task.feature_id] ?? 'Unknown Feature'
          if (!featureMap.has(task.feature_id)) {
            featureMap.set(task.feature_id, { name, avatar_url: null, tasks: [] })
          }
          featureMap.get(task.feature_id)!.tasks.push({
            id: task.id, title: task.title, status: task.status,
            priority: task.priority, due_date: task.due_date,
            pending_approval: task.pending_approval ?? false,
            assignee_id: task.assignee_id,
          })
        }

        const result  = buildBranches(featureMap, 'unassigned', false)
        const allDone = tasks.filter(t => t.status === 'done').length
        setBranches(result); setTotalTasks(tasks.length); setTotalDone(allDone)
        setLoading(false); return
      }

      // ── WORKSPACE MODE ───────────────────────────────────────────────────────
      setMilestones([])

      const { data: tasks, error: tasksErr } = await supabase
        .from('tasks')
        .select(`
          id, title, status, priority, due_date, pending_approval, assignee_id,
          profiles:assignee_id ( id, full_name, avatar_url )
        `)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: true })

      if (tasksErr) throw tasksErr

      if (!tasks || tasks.length === 0) {
        setBranches([]); setTotalTasks(0); setTotalDone(0); setLoading(false); return
      }

      const assigneeMap = new Map<string, { name: string; avatar_url: string | null; tasks: FlowTask[] }>()
      for (const task of tasks) {
        const key        = task.assignee_id ?? 'unassigned'
        const profile    = Array.isArray(task.profiles) ? task.profiles[0] : task.profiles
        const name       = profile?.full_name ?? 'Unassigned'
        const avatar_url = profile?.avatar_url ?? null
        if (!assigneeMap.has(key)) assigneeMap.set(key, { name, avatar_url, tasks: [] })
        assigneeMap.get(key)!.tasks.push({
          id: task.id, title: task.title, status: task.status,
          priority: task.priority, due_date: task.due_date,
          pending_approval: task.pending_approval ?? false,
          assignee_id: task.assignee_id,
        })
      }

      const result  = buildBranches(assigneeMap, 'unassigned', true)
      const allDone = tasks.filter(t => t.status === 'done').length
      setBranches(result); setTotalTasks(tasks.length); setTotalDone(allDone)
      setLoading(false)

    } catch (err) {
      console.error('[useFlowData]', err)
      setError('Failed to load flow data.')
      setLoading(false)
    }
  }, [workspaceId, projectId])

  useEffect(() => { void fetchFlow() }, [fetchFlow])

  return {
    branches, milestones, totalTasks, totalDone,
    overallProgress: totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0,
    loading, error, refetch: fetchFlow,
  }
}