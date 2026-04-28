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
  id: string              // assignee_id or 'unassigned'
  name: string            // assignee full_name or 'Unassigned'
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

export function useFlowData(workspaceId: string | null): FlowData {
  const [branches, setBranches] = useState<FlowBranch[]>([])
  const [totalTasks, setTotalTasks] = useState(0)
  const [totalDone, setTotalDone] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFlow = useCallback(async () => {
    if (!workspaceId) {
      setBranches([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch all tasks with assignee profile in one query
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
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })

      if (tasksErr) throw tasksErr

      if (!tasks || tasks.length === 0) {
        setBranches([])
        setTotalTasks(0)
        setTotalDone(0)
        setLoading(false)
        return
      }

      // Group tasks by assignee
      const assigneeMap = new Map<string, {
        name: string
        avatar_url: string | null
        tasks: FlowTask[]
      }>()

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

      // Build branches array — unassigned always last
      let colorIndex = 0
      const result: FlowBranch[] = []

      for (const [id, data] of assigneeMap.entries()) {
        if (id === 'unassigned') continue // add at end
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

      // Unassigned branch — add last if it exists
      if (assigneeMap.has('unassigned')) {
        const data = assigneeMap.get('unassigned')!
        const done = data.tasks.filter(t => t.status === 'done').length
        result.push({
          id: 'unassigned',
          name: 'Unassigned',
          avatar_url: null,
          color: '#6b7280', // gray for unassigned
          tasks: data.tasks,
          total: data.tasks.length,
          done,
          progress: data.tasks.length > 0 ? Math.round((done / data.tasks.length) * 100) : 0,
        })
      }

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
  }, [workspaceId])

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