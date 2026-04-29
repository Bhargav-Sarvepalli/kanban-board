import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import type { Project } from '../components/Project/projectTypes'

export function useProjects(userId: string | null) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)

  const refetch = useCallback(async () => {
    if (!userId) { setProjects([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    setProjects(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!userId) { setProjects([]); setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (!cancelled) { setProjects(data ?? []); setLoading(false) }
    }
    void run()
    return () => { cancelled = true }
  }, [userId])

  return { projects, loading, refetch }
}