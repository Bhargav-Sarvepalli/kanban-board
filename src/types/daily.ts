export type SleepQuality = 'poor' | 'okay' | 'good'
export type EnergyLevel = 'low' | 'medium' | 'high'

export type FocusType =
  | 'deep_work'
  | 'admin'
  | 'break'
  | 'meeting'
  | 'personal'
  | 'review'

export type BlockStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'skipped'

export type WarningType =
  | 'blocked'
  | 'overdue'
  | 'dependency'
  | 'energy'
  | 'deadline'

export type WarningSeverity = 'low' | 'medium' | 'high'

export interface MorningSetupInput {
  wakeUpTime: string
  sleepQuality: SleepQuality
  energyLevel: EnergyLevel
  availableHours: number
  mainFocus: string
  hardCommitments: string
  extraContext: string
}

export interface DailyPriority {
  id: string
  title: string
  reason: string
  linkedTaskId?: string
  linkedFlowNodeId?: string
}

export interface DailyScheduleBlock {
  id: string
  startTime: string
  endTime: string
  focusType: FocusType
  title: string
  description: string
  reason: string
  status: BlockStatus
  linkedTaskId?: string
  linkedFlowNodeId?: string
}

export interface DailyWarning {
  id: string
  type: WarningType
  message: string
  severity: WarningSeverity
}

export interface DailyPlan {
  id: string
  userId: string
  date: string
  wakeUpTime: string
  sleepQuality: SleepQuality
  energyLevel: EnergyLevel
  availableHours: number
  mainFocus?: string
  hardCommitments?: string
  extraContext?: string
  summary: string
  briefingText: string
  priorities: DailyPriority[]
  scheduleBlocks: DailyScheduleBlock[]
  warnings: DailyWarning[]
  createdAt: string
  updatedAt: string
}

export const focusTypeLabels: Record<FocusType, string> = {
  deep_work: 'Deep work',
  admin: 'Admin',
  break: 'Break',
  meeting: 'Meeting',
  personal: 'Personal',
  review: 'Review',
}

export const blockStatusLabels: Record<BlockStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Complete',
  skipped: 'Skipped',
}

export const warningSeverityRank: Record<WarningSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

