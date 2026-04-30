import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import type { Project } from '../components/Project/projectTypes'

export function useProjects(userId: string | null, workspaceId?: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)

  const refetch = useCallback(async () => {
    if (!userId) { setProjects([]); setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (workspaceId) query = query.eq('workspace_id', workspaceId)
    else query = query.is('workspace_id', null)
    const { data } = await query
    setProjects(data ?? [])
    setLoading(false)
  }, [userId, workspaceId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!userId) { setProjects([]); setLoading(false); return }
      setLoading(true)
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (workspaceId) query = query.eq('workspace_id', workspaceId)
      else query = query.is('workspace_id', null)
      const { data } = await query
      if (!cancelled) { setProjects(data ?? []); setLoading(false) }
    }
    void run()
    return () => { cancelled = true }
  }, [userId, workspaceId])

  return { projects, loading, refetch }
}