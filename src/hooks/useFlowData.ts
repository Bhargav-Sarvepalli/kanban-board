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
  id: string              // feature_id (project mode) or assignee_id (workspace mode) or 'unassigned'
  name: string            // feature name or assignee full_name or 'Unassigned'
  avatar_url: string | null
  color: string
  tasks: FlowTask[]
  total: number
  done: number
  progress: number        // 0–100
}

export interface FlowData {
  branches: FlowBranch[]
  totalTasks: number
  totalDone: number
  overallProgress: number
  loading: boolean
  error: string | null
  refetch: () => void
}

// Deterministic color per branch so colors stay stable across refetches
const BRANCH_COLORS = [
  '#8b5cf6', // violet
  '#38bdf8', // sky
  '#34d399', // emerald
  '#f472b6', // pink
  '#fb923c', // orange
  '#a78bfa', // purple
  '#22d3ee', // cyan
  '#f87171', // red
]

function colorForIndex(i: number): string {
  return BRANCH_COLORS[i % BRANCH_COLORS.length]
}

function buildBranches(
  groups: Map<string, { name: string; avatar_url: string | null; tasks: FlowTask[] }>,
  unassignedKey = 'unassigned',
  unassignedColor = '#6b7280',
): FlowBranch[] {
  let colorIndex = 0
  const result: FlowBranch[] = []

  for (const [id, data] of groups.entries()) {
    if (id === unassignedKey) continue
    const done = data.tasks.filter(t => t.status === 'done').length
    result.push({
      id,
      name: data.name,
      avatar_url: data.avatar_url,
      color: colorForIndex(colorIndex++),
      tasks: data.tasks,
      total: data.tasks.length,
      done,
      progress: data.tasks.length > 0 ? Math.round((done / data.tasks.length) * 100) : 0,
    })
  }

  if (groups.has(unassignedKey)) {
    const data = groups.get(unassignedKey)!
    const done = data.tasks.filter(t => t.status === 'done').length
    result.push({
      id: unassignedKey,
      name: 'Unassigned',
      avatar_url: null,
      color: unassignedColor,
      tasks: data.tasks,
      total: data.tasks.length,
      done,
      progress: data.tasks.length > 0 ? Math.round((done / data.tasks.length) * 100) : 0,
    })
  }

  return result
}

export function useFlowData(
  workspaceId: string | null,
  projectId?: string | null,
): FlowData {
  const [branches, setBranches] = useState<FlowBranch[]>([])
  const [totalTasks, setTotalTasks] = useState(0)
  const [totalDone, setTotalDone] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFlow = useCallback(async () => {
    // Need at least one scope
    if (!workspaceId && !projectId) {
      setBranches([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // ── PROJECT MODE: filter by project_id, group by feature_id ─────────────
      if (projectId) {
        // Fetch tasks scoped to this project that have show_on_flow = true
        const { data: tasks, error: tasksErr } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            status,
            priority,
            due_date,
            pending_approval,
            assignee_id,
            feature_id,
            show_on_flow
          `)
          .eq('project_id', projectId)
          .eq('show_on_flow', true)
          .order('created_at', { ascending: true })

        if (tasksErr) throw tasksErr

        if (!tasks || tasks.length === 0) {
          setBranches([])
          setTotalTasks(0)
          setTotalDone(0)
          setLoading(false)
          return
        }

        // Fetch feature names for this project
        const { data: features } = await supabase
          .from('project_features')
          .select('id, name')
          .eq('project_id', projectId)

        const featureNameMap: Record<string, string> = {}
        features?.forEach(f => { featureNameMap[f.id] = f.name })

        // Group tasks by feature_id
        const featureMap = new Map<string, { name: string; avatar_url: string | null; tasks: FlowTask[] }>()

        for (const task of tasks) {
          const key = task.feature_id ?? 'unassigned'
          const name = task.feature_id ? (featureNameMap[task.feature_id] ?? 'Unknown Feature') : 'No Feature'

          if (!featureMap.has(key)) {
            featureMap.set(key, { name, avatar_url: null, tasks: [] })
          }

          featureMap.get(key)!.tasks.push({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            pending_approval: task.pending_approval ?? false,
            assignee_id: task.assignee_id,
          })
        }

        const result = buildBranches(featureMap, 'unassigned', '#6b7280')
        const allDone = tasks.filter(t => t.status === 'done').length

        setBranches(result)
        setTotalTasks(tasks.length)
        setTotalDone(allDone)
        setLoading(false)
        return
      }

      // ── WORKSPACE MODE: filter by workspace_id, group by assignee_id ────────
      const { data: tasks, error: tasksErr } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          priority,
          due_date,
          pending_approval,
          assignee_id,
          profiles:assignee_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: true })

      if (tasksErr) throw tasksErr

      if (!tasks || tasks.length === 0) {
        setBranches([])
        setTotalTasks(0)
        setTotalDone(0)
        setLoading(false)
        return
      }

      const assigneeMap = new Map<string, { name: string; avatar_url: string | null; tasks: FlowTask[] }>()

      for (const task of tasks) {
        const key = task.assignee_id ?? 'unassigned'
        const profile = Array.isArray(task.profiles) ? task.profiles[0] : task.profiles
        const name = profile?.full_name ?? 'Unassigned'
        const avatar_url = profile?.avatar_url ?? null

        if (!assigneeMap.has(key)) {
          assigneeMap.set(key, { name, avatar_url, tasks: [] })
        }

        assigneeMap.get(key)!.tasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          pending_approval: task.pending_approval ?? false,
          assignee_id: task.assignee_id,
        })
      }

      const result = buildBranches(assigneeMap)
      const allDone = tasks.filter(t => t.status === 'done').length

      setBranches(result)
      setTotalTasks(tasks.length)
      setTotalDone(allDone)
      setLoading(false)
    } catch (err) {
      console.error('[useFlowData]', err)
      setError('Failed to load flow data.')
      setLoading(false)
    }
  }, [workspaceId, projectId])

  useEffect(() => {
    void fetchFlow()
  }, [fetchFlow])

  return {
    branches,
    totalTasks,
    totalDone,
    overallProgress: totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0,
    loading,
    error,
    refetch: fetchFlow,
  }
}