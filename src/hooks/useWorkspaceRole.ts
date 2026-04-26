import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export type WorkspaceRole = 'admin' | 'member' | 'viewer' | null

// null = personal board or not a member
// 'admin' = owner or promoted admin
// 'member' = can create + edit own tasks
// 'viewer' = read + comment only

export function useWorkspaceRole(workspaceId: string | null | undefined, userId: string | null): WorkspaceRole {
  const [role, setRole] = useState<WorkspaceRole>(null)

  useEffect(() => {
    const fetch = async () => {
      if (!workspaceId || !userId) { setRole(null); return }

      const { data: ws } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single()

      if (ws?.owner_id === userId) { setRole('admin'); return }

      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single()

      setRole((member?.role as WorkspaceRole) ?? null)
    }

    void fetch()
  }, [workspaceId, userId])

  return role
}

// Helper — can this role create tasks?
export function canCreateTask(role: WorkspaceRole, isPersonal: boolean): boolean {
  if (isPersonal) return true
  return role === 'admin' || role === 'member'
}

// Helper — can this role edit a specific task?
export function canEditTask(role: WorkspaceRole, taskOwnerId: string, assigneeId: string | null | undefined, userId: string | null): boolean {
  if (role === 'admin') return true
  if (role === 'member') return taskOwnerId === userId || assigneeId === userId
  return false
}

// Helper — can this role delete tasks?
export function canDeleteTask(role: WorkspaceRole): boolean {
  return role === 'admin'
}

// Helper — can this role manage members?
export function canManageMembers(role: WorkspaceRole): boolean {
  return role === 'admin'
}