export interface Project {
  id: string
  name: string
  description: string | null
  start_date: string | null
  target_date: string | null
  owner_id: string
  workspace_id: string | null
  created_at: string
}

export interface ProjectMilestone {
  id: string
  project_id: string
  name: string
  position: number
  target_date: string | null
}

export interface ProjectFeature {
  id: string
  project_id: string
  milestone_id: string | null
  name: string
  color: string
  start_date: string | null
  end_date: string | null
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: 'owner' | 'manager' | 'member' | 'viewer'
}