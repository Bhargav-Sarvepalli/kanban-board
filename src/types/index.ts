export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  status: Status
  priority: 'low' | 'normal' | 'high'
  due_date?: string
  recurring?: 'weekly' | 'monthly' | null
  user_id: string
  workspace_id?: string
  last_edited_by?: string
  last_edited_at?: string
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'member'
  email: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
}

export const COLUMNS: { id: Status; label: string }[] = [
  { id: 'todo', label: 'TO DO' },
  { id: 'in_progress', label: 'IN PROGRESS' },
  { id: 'in_review', label: 'IN REVIEW' },
  { id: 'done', label: 'DONE' },
]