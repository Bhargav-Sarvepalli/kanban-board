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
  last_edited_at?: string | null
  feature_id?: string | null
}

export interface FlowBranch {
  id: string
  name: string
  avatar_url: string | null
  color: string
  milestone_id?: string | null
  description?: string | null
  owner_id?: string | null
  deadline?: string | null
  priority?: 'low' | 'normal' | 'high' | null
  status?: string | null
  merged_at?: string | null
  merged_by?: string | null
  merge_note?: string | null
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
  milestones: FlowMilestone[]
  totalTasks: number
  totalDone: number
  overallProgress: number
  loading: boolean
  error: string | null
  refetch: () => void
}

const BRANCH_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#db2777', '#0891b2', '#65a30d',
  '#8b5cf6', '#38bdf8', '#34d399', '#f472b6',
]

function colorForIndex(i: number): string {
  return BRANCH_COLORS[i % BRANCH_COLORS.length]
}

function buildBranches(
  groups: Map<string, {
    name: string
    avatar_url: string | null
    tasks: FlowTask[]
    color?: string
    milestone_id?: string | null
    description?: string | null
    owner_id?: string | null
    deadline?: string | null
    priority?: 'low' | 'normal' | 'high' | null
    status?: string | null
    merged_at?: string | null
    merged_by?: string | null
    merge_note?: string | null
  }>,
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
      color: data.color ?? colorForIndex(colorIndex++),
      milestone_id: data.milestone_id ?? null,
      description: data.description ?? null,
      owner_id: data.owner_id ?? null,
      deadline: data.deadline ?? null,
      priority: data.priority ?? null,
      status: data.status ?? null,
      merged_at: data.merged_at ?? null,
      merged_by: data.merged_by ?? null,
      merge_note: data.merge_note ?? null,
      tasks: data.tasks, total: data.tasks.length, done,
      progress: data.tasks.length > 0 ? Math.round((done / data.tasks.length) * 100) : 0,
    })
  }

  if (includeUnassigned && groups.has(unassignedKey)) {
    const data = groups.get(unassignedKey)!
    const done = data.tasks.filter(t => t.status === 'done').length
    result.push({
      id: unassignedKey, name: 'Unassigned', avatar_url: null, color: unassignedColor,
      description: null,
      owner_id: null,
      deadline: null,
      priority: null,
      status: null,
      merged_at: null,
      merged_by: null,
      merge_note: null,
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
      // ── PROJECT MODE ─────────────────────────────────────────────────────────
      if (projectId) {
        const [msRes, taskRes, featRes, featMetaRes] = await Promise.all([
          supabase
            .from('project_milestones')
            .select('id, name, position, target_date')
            .eq('project_id', projectId)
            .order('position', { ascending: true }),
          supabase
            .from('tasks')
            .select('id, title, status, priority, due_date, pending_approval, assignee_id, feature_id, last_edited_at')
            .eq('project_id', projectId)
            .eq('show_on_flow', true)
            .order('created_at', { ascending: true }),
          supabase
            .from('project_features')
            .select('id, name, color, milestone_id')
            .eq('project_id', projectId),
          supabase
            .from('project_features')
            .select('id, description, owner_id, deadline, priority, status, merged_at, merged_by, merge_note')
            .eq('project_id', projectId),
        ])

        if (msRes.error) console.warn('[useFlowData] milestones:', msRes.error)
        if (taskRes.error) throw taskRes.error

        setMilestones(msRes.data ?? [])

        const tasks = taskRes.data ?? []
        const featureMeta = new Map<string, {
          description?: string | null
          owner_id?: string | null
          deadline?: string | null
          priority?: 'low' | 'normal' | 'high' | null
          status?: string | null
          merged_at?: string | null
          merged_by?: string | null
          merge_note?: string | null
        }>()

        if (featMetaRes.error) {
          console.warn('[useFlowData] feature metadata unavailable:', featMetaRes.error.message)
        } else {
          ;(featMetaRes.data ?? []).forEach(f => {
            featureMeta.set(f.id, {
              description: f.description ?? null,
              owner_id: f.owner_id ?? null,
              deadline: f.deadline ?? null,
              priority: f.priority ?? null,
              status: f.status ?? null,
              merged_at: f.merged_at ?? null,
              merged_by: f.merged_by ?? null,
              merge_note: f.merge_note ?? null,
            })
          })
        }

        const features = featRes.data ?? []

        // Always render feature branches — even if no tasks have show_on_flow = true.
        // Empty branches show the feature exists and prompt the user to opt tasks in.
        if (features.length === 0) {
          setBranches([]); setTotalTasks(0); setTotalDone(0); setLoading(false); return
        }

        // Phase color palette — matches Dashboard exactly
        const PHASE_PALETTE = [
          '#4ade80', // position 0 — Kickoff
          '#7c3aed', // position 1 — Designing
          '#2563eb', // position 2 — Phase 1
          '#d97706', // position 3 — Review
          '#dc2626', // position 4 — Delivery
          '#0891b2', '#db2777', '#65a30d',
        ]

        // Build milestone position map for color lookup
        const msPosMap: Record<string, number> = {}
        msRes.data?.forEach(m => { msPosMap[m.id] = m.position })

        // Build a map seeded with every feature (empty task list by default)
        const featureMap = new Map<string, {
          name: string; avatar_url: string | null; tasks: FlowTask[]; color?: string; milestone_id?: string | null
          description?: string | null; owner_id?: string | null; deadline?: string | null
          priority?: 'low' | 'normal' | 'high' | null; status?: string | null
          merged_at?: string | null; merged_by?: string | null; merge_note?: string | null
        }>()

        features.forEach((f, idx) => {
          // Color = phase palette color based on milestone position, fallback to stored color
          const msPos  = f.milestone_id ? (msPosMap[f.milestone_id] ?? idx) : idx
          const color  = PHASE_PALETTE[msPos % PHASE_PALETTE.length]
          featureMap.set(f.id, {
            name:       f.name,
            avatar_url: null,
            tasks:      [],
            color,
            milestone_id: f.milestone_id ?? null,
            ...(featureMeta.get(f.id) ?? {}),
          })
        })

        // Fill in tasks that are opted in via show_on_flow
        for (const task of tasks) {
          if (!task.feature_id) continue
          if (!featureMap.has(task.feature_id)) continue
          featureMap.get(task.feature_id)!.tasks.push({
            id:               task.id,
            title:            task.title,
            status:           task.status,
            priority:         task.priority,
            due_date:         task.due_date,
            pending_approval: task.pending_approval ?? false,
            assignee_id:      task.assignee_id,
            last_edited_at:   task.last_edited_at,
            feature_id:       task.feature_id,
          })
        }

        const result   = buildBranches(featureMap, 'unassigned', false)
        const flowDone = tasks.filter(t => t.status === 'done').length
        setBranches(result)
        setTotalTasks(tasks.length)
        setTotalDone(flowDone)
        setLoading(false)
        return
      }

      // ── WORKSPACE MODE ───────────────────────────────────────────────────────
      setMilestones([])

      const { data: tasks, error: tasksErr } = await supabase
        .from('tasks')
        .select(`
          id, title, status, priority, due_date, pending_approval, assignee_id, last_edited_at,
          profiles:assignee_id ( id, full_name, avatar_url )
        `)
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: true })

      if (tasksErr) throw tasksErr

      if (!tasks || tasks.length === 0) {
        setBranches([]); setTotalTasks(0); setTotalDone(0); setLoading(false); return
      }

      const assigneeMap = new Map<string, {
        name: string; avatar_url: string | null; tasks: FlowTask[]
      }>()

      for (const task of tasks) {
        const key        = task.assignee_id ?? 'unassigned'
        const profile    = Array.isArray(task.profiles) ? task.profiles[0] : task.profiles
        const name       = profile?.full_name ?? 'Unassigned'
        const avatar_url = profile?.avatar_url ?? null
        if (!assigneeMap.has(key)) assigneeMap.set(key, { name, avatar_url, tasks: [] })
        assigneeMap.get(key)!.tasks.push({
          id:               task.id,
          title:            task.title,
          status:           task.status,
          priority:         task.priority,
          due_date:         task.due_date,
          pending_approval: task.pending_approval ?? false,
          assignee_id:      task.assignee_id,
          last_edited_at:   task.last_edited_at,
        })
      }

      const result   = buildBranches(assigneeMap, 'unassigned', true)
      const allDone  = tasks.filter(t => t.status === 'done').length
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
