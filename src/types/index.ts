export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'

export interface Task {
  id: string
  title: string
  description?: string
  status: Status
  priority: 'low' | 'normal' | 'high'
  due_date?: string | null
  recurring?: 'weekly' | 'monthly' | null
  user_id: string
  workspace_id?: string | null
  assignee_id?: string | null
  last_edited_by?: string | null
  last_edited_at?: string | null
  created_at: string
  show_on_flow?: boolean
  project_id?: string | null
  feature_id?: string | null
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
  color?: string | null
  icon?: string | null
  description?: string | null
  logo_url?: string | null   // uploaded logo or null — falls back to initials
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'member' | 'viewer'
  email: string
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  onboarding_completed?: boolean
}

export const COLUMNS: { id: Status; label: string }[] = [
  { id: 'todo',        label: 'TO DO' },
  { id: 'in_progress', label: 'IN PROGRESS' },
  { id: 'in_review',   label: 'IN REVIEW' },
  { id: 'done',        label: 'DONE' },
]