import { supabase } from '../../supabase'
import type { Profile, Task } from '../../types'
import type {
  BlockStatus,
  DailyPlan,
  DailyPriority,
  DailyScheduleBlock,
  DailyWarning,
  EnergyLevel,
  FocusType,
  MorningSetupInput,
  SleepQuality,
  WarningSeverity,
  WarningType,
} from '../../types/daily'
import { generateText } from '../../lib/ai'

type DailyPlanContent = Pick<DailyPlan, 'summary' | 'briefingText' | 'priorities' | 'scheduleBlocks' | 'warnings'>

interface DailyPlanRow {
  id: string
  user_id: string
  date: string
  wake_up_time: string | null
  sleep_quality: SleepQuality
  energy_level: EnergyLevel
  available_hours: number
  main_focus: string | null
  hard_commitments: string | null
  extra_context: string | null
  summary: string
  briefing_text: string
  priorities: DailyPriority[]
  schedule_blocks: DailyScheduleBlock[]
  warnings: DailyWarning[]
  created_at: string
  updated_at: string
}

export interface DailyGenerationContext {
  userId: string
  profile: Profile | null
  tasks: Task[]
  workspaceName: string
  projectName?: string
  isPersonal: boolean
  input: MorningSetupInput
}

export interface DailyRegenerationContext {
  profile: Profile | null
  tasks: Task[]
  workspaceName: string
  projectName?: string
  isPersonal: boolean
}

const focusTypes: FocusType[] = ['deep_work', 'admin', 'break', 'meeting', 'personal', 'review']
const warningTypes: WarningType[] = ['blocked', 'overdue', 'dependency', 'energy', 'deadline']
const warningSeverities: WarningSeverity[] = ['low', 'medium', 'high']

export function todayIsoDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function newId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function rowToPlan(row: DailyPlanRow): DailyPlan {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    wakeUpTime: row.wake_up_time ?? '',
    sleepQuality: row.sleep_quality,
    energyLevel: row.energy_level,
    availableHours: Number(row.available_hours),
    mainFocus: row.main_focus ?? '',
    hardCommitments: row.hard_commitments ?? '',
    extraContext: row.extra_context ?? '',
    summary: row.summary,
    briefingText: row.briefing_text,
    priorities: Array.isArray(row.priorities) ? row.priorities : [],
    scheduleBlocks: Array.isArray(row.schedule_blocks) ? row.schedule_blocks : [],
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function inputFromPlan(plan: DailyPlan): MorningSetupInput {
  return {
    wakeUpTime: plan.wakeUpTime,
    sleepQuality: plan.sleepQuality,
    energyLevel: plan.energyLevel,
    availableHours: plan.availableHours,
    mainFocus: plan.mainFocus ?? '',
    hardCommitments: plan.hardCommitments ?? '',
    extraContext: plan.extraContext ?? '',
  }
}

export async function fetchTodayDailyPlan(userId: string) {
  const { data, error } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('date', todayIsoDate())
    .maybeSingle()

  if (error) throw error
  return data ? rowToPlan(data as DailyPlanRow) : null
}

async function saveDailyPlan(ctx: DailyGenerationContext, content: DailyPlanContent) {
  const payload = {
    user_id: ctx.userId,
    date: todayIsoDate(),
    wake_up_time: ctx.input.wakeUpTime,
    sleep_quality: ctx.input.sleepQuality,
    energy_level: ctx.input.energyLevel,
    available_hours: ctx.input.availableHours,
    main_focus: ctx.input.mainFocus.trim() || null,
    hard_commitments: ctx.input.hardCommitments.trim() || null,
    extra_context: ctx.input.extraContext.trim() || null,
    summary: content.summary,
    briefing_text: content.briefingText,
    priorities: content.priorities,
    schedule_blocks: content.scheduleBlocks,
    warnings: content.warnings,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('daily_plans')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) throw error
  return rowToPlan(data as DailyPlanRow)
}

function parseTimeToMinutes(raw: string) {
  const value = raw.trim().toLowerCase()
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return 9 * 60
  let hour = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  const meridiem = match[3]
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  if (hour > 23 || minutes > 59) return 9 * 60
  return hour * 60 + minutes
}

function formatMinutes(totalMinutes: number) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(wrapped / 60)
  const minutes = wrapped % 60
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function parseDate(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function wordLimit(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length <= maxWords ? text.trim() : `${words.slice(0, maxWords).join(' ')}.`
}

function userFirstName(profile: Profile | null) {
  return profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there'
}

function taskScore(task: Task) {
  const today = new Date(new Date().setHours(0, 0, 0, 0))
  const due = parseDate(task.due_date)
  const overdue = due && due < today && task.status !== 'done'
  const dueToday = due && due.getTime() === today.getTime() && task.status !== 'done'
  const priority = task.priority === 'high' ? 0 : task.priority === 'normal' ? 2 : 4
  const status = task.status === 'in_progress' ? -1 : task.status === 'in_review' ? 1 : 2
  return (overdue ? -10 : 0) + (dueToday ? -5 : 0) + priority + status
}

function relevantTasks(tasks: Task[]) {
  return [...tasks]
    .filter(task => task.status !== 'done')
    .sort((a, b) => taskScore(a) - taskScore(b))
}

function buildWarnings(ctx: DailyGenerationContext): DailyWarning[] {
  const today = new Date(new Date().setHours(0, 0, 0, 0))
  const openTasks = ctx.tasks.filter(task => task.status !== 'done')
  const overdue = openTasks.filter(task => {
    const due = parseDate(task.due_date)
    return due ? due < today : false
  })
  const dueToday = openTasks.filter(task => {
    const due = parseDate(task.due_date)
    return due ? due.getTime() === today.getTime() : false
  })
  const warnings: DailyWarning[] = []

  if (overdue.length > 0) {
    warnings.push({
      id: newId('warn'),
      type: 'overdue',
      severity: overdue.length > 2 ? 'high' : 'medium',
      message: `${overdue.length} overdue ${overdue.length === 1 ? 'task needs' : 'tasks need'} attention.`,
    })
  }

  if (dueToday.length > 0) {
    warnings.push({
      id: newId('warn'),
      type: 'deadline',
      severity: dueToday.some(task => task.priority === 'high') ? 'high' : 'medium',
      message: `${dueToday.length} item${dueToday.length === 1 ? '' : 's'} due today.`,
    })
  }

  if (ctx.input.energyLevel === 'low' || ctx.input.sleepQuality === 'poor') {
    warnings.push({
      id: newId('warn'),
      type: 'energy',
      severity: ctx.input.energyLevel === 'low' && ctx.input.sleepQuality === 'poor' ? 'high' : 'medium',
      message: 'Energy may be limited. Use shorter work blocks and protect breaks.',
    })
  }

  if (ctx.input.hardCommitments.trim()) {
    warnings.push({
      id: newId('warn'),
      type: 'dependency',
      severity: 'low',
      message: 'Hard commitments are included. Keep flexible work around them.',
    })
  }

  return warnings.slice(0, 5)
}

function buildPriorities(ctx: DailyGenerationContext): DailyPriority[] {
  const tasks = relevantTasks(ctx.tasks)
  const priorities: DailyPriority[] = []
  const mainFocus = ctx.input.mainFocus.trim()

  if (mainFocus) {
    const linked = tasks.find(task => mainFocus.toLowerCase().includes(task.title.toLowerCase()) || task.title.toLowerCase().includes(mainFocus.toLowerCase()))
    priorities.push({
      id: newId('priority'),
      title: mainFocus,
      reason: 'This is the stated focus for the day.',
      linkedTaskId: linked?.id,
      linkedFlowNodeId: linked?.feature_id ?? undefined,
    })
  }

  tasks.slice(0, 4).forEach(task => {
    if (priorities.some(priority => priority.linkedTaskId === task.id || priority.title.toLowerCase() === task.title.toLowerCase())) return
    priorities.push({
      id: newId('priority'),
      title: task.title,
      reason: task.due_date ? 'It has date pressure or is already active.' : 'It is a useful next open task.',
      linkedTaskId: task.id,
      linkedFlowNodeId: task.feature_id ?? undefined,
    })
  })

  if (priorities.length === 0) {
    priorities.push({
      id: newId('priority'),
      title: 'Plan the next useful task',
      reason: 'There are no open tasks in this view yet.',
    })
  }

  return priorities.slice(0, 3)
}

function buildLocalSchedule(ctx: DailyGenerationContext, priorities: DailyPriority[]): DailyScheduleBlock[] {
  const input = ctx.input
  const availableMinutes = Math.min(12 * 60, Math.max(45, Math.round(Number(input.availableHours || 0) * 60)))
  const energy = input.energyLevel
  const start = parseTimeToMinutes(input.wakeUpTime) + (energy === 'low' ? 60 : 30)
  const blocks: DailyScheduleBlock[] = []
  let cursor = start
  let remaining = availableMinutes

  const addBlock = (duration: number, focusType: FocusType, title: string, description: string, reason: string, linkedTaskId?: string, linkedFlowNodeId?: string) => {
    if (remaining < 15 || blocks.length >= 9) return
    const safeDuration = Math.min(duration, remaining)
    if (safeDuration < 15) return
    const block: DailyScheduleBlock = {
      id: newId('block'),
      startTime: formatMinutes(cursor),
      endTime: formatMinutes(cursor + safeDuration),
      focusType,
      title,
      description,
      reason,
      status: 'pending',
      linkedTaskId,
      linkedFlowNodeId,
    }
    blocks.push(block)
    cursor += safeDuration
    remaining -= safeDuration
  }

  addBlock(
    energy === 'low' ? 20 : 25,
    'review',
    'Review the day',
    'Scan urgent tasks, messages, and commitments before starting execution.',
    'A short review prevents the plan from fighting reality.',
  )

  const firstPriority = priorities[0]
  addBlock(
    energy === 'high' ? 100 : energy === 'medium' ? 85 : 55,
    'deep_work',
    firstPriority?.title ?? 'Main focus work',
    'Work on the highest-value item without switching context.',
    firstPriority?.reason ?? 'Start with the work that moves the day forward.',
    firstPriority?.linkedTaskId,
    firstPriority?.linkedFlowNodeId,
  )

  if (availableMinutes > 180) {
    addBlock(15, 'break', 'Reset break', 'Step away and reset before the next block.', 'Work time is over three hours, so a break is required.')
  }

  if (input.hardCommitments.trim()) {
    addBlock(45, 'meeting', 'Hard commitments', input.hardCommitments.trim(), 'These are fixed points, so the rest of the day should bend around them.')
  }

  const secondPriority = priorities[1]
  addBlock(
    energy === 'low' ? 45 : 70,
    secondPriority?.linkedTaskId ? 'deep_work' : 'admin',
    secondPriority?.title ?? 'Admin and cleanup',
    secondPriority ? 'Move the next priority forward with a clear stopping point.' : 'Clear small admin work and update the board.',
    secondPriority?.reason ?? 'This keeps the system accurate without stealing the best focus block.',
    secondPriority?.linkedTaskId,
    secondPriority?.linkedFlowNodeId,
  )

  const thirdPriority = priorities[2]
  addBlock(
    energy === 'high' ? 60 : 45,
    'review',
    thirdPriority?.title ?? 'Review and test',
    thirdPriority ? 'Review progress, unblock details, and prepare a next step.' : 'Check what changed and capture the next clear action.',
    thirdPriority?.reason ?? 'Ending with review makes tomorrow easier.',
    thirdPriority?.linkedTaskId,
    thirdPriority?.linkedFlowNodeId,
  )

  if (input.extraContext.toLowerCase().includes('gym') || input.extraContext.toLowerCase().includes('workout')) {
    addBlock(45, 'personal', 'Light workout', 'Keep the session lighter if energy is low.', 'You mentioned gym, so it belongs in the day without crowding work.')
  }

  addBlock(20, 'admin', 'Close the loop', 'Update task status, write notes, and choose tomorrow\'s first move.', 'A clean shutdown protects momentum.')

  return blocks
}

function buildLocalBriefing(ctx: DailyGenerationContext, priorities: DailyPriority[], warnings: DailyWarning[]) {
  const name = userFirstName(ctx.profile)
  const focus = priorities[0]?.title ?? 'the most important open work'
  const energyLine = ctx.input.energyLevel === 'low' || ctx.input.sleepQuality === 'poor'
    ? 'I kept the plan lighter because your energy may be limited.'
    : 'I put the hardest work early enough to use your best attention.'
  const warningLine = warnings.length
    ? `Watch ${warnings[0].message.toLowerCase()}`
    : 'There is no major blocker in this view right now.'
  const projectLine = ctx.projectName
    ? `For ${ctx.projectName}, keep the day centered on ${focus}.`
    : `Keep the day centered on ${focus}.`

  return wordLimit(`Good morning ${name}. ${energyLine} ${projectLine} ${warningLine} Do not try to touch everything. Finish the work that creates the cleanest next step, then update the board so NexTask stays honest.`, 180)
}

function buildLocalPlan(ctx: DailyGenerationContext): DailyPlanContent {
  const priorities = buildPriorities(ctx)
  const warnings = buildWarnings(ctx)
  const scheduleBlocks = buildLocalSchedule(ctx, priorities)
  const summary = priorities[0]?.title ? `Today is built around ${priorities[0].title}.` : 'Today is built around a light planning loop.'
  return {
    summary,
    briefingText: buildLocalBriefing(ctx, priorities, warnings),
    priorities,
    scheduleBlocks,
    warnings,
  }
}

function cleanJsonText(raw: string) {
  const trimmed = raw.replace(/```json/g, '').replace(/```/g, '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('AI did not return a JSON object')
  return trimmed.slice(start, end + 1)
}

function ensureString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function ensureFocusType(value: unknown): FocusType {
  return typeof value === 'string' && focusTypes.includes(value as FocusType) ? value as FocusType : 'admin'
}

function ensureWarningType(value: unknown): WarningType {
  return typeof value === 'string' && warningTypes.includes(value as WarningType) ? value as WarningType : 'blocked'
}

function ensureWarningSeverity(value: unknown): WarningSeverity {
  return typeof value === 'string' && warningSeverities.includes(value as WarningSeverity) ? value as WarningSeverity : 'medium'
}

function normalizeAiPlan(raw: unknown, fallback: DailyPlanContent): DailyPlanContent {
  if (!raw || typeof raw !== 'object') throw new Error('AI JSON is not an object')
  const obj = raw as Record<string, unknown>
  const prioritiesRaw = Array.isArray(obj.priorities) ? obj.priorities : []
  const blocksRaw = Array.isArray(obj.scheduleBlocks) ? obj.scheduleBlocks : []
  const warningsRaw = Array.isArray(obj.warnings) ? obj.warnings : []

  const priorities = prioritiesRaw.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      id: ensureString(record.id, newId('priority')),
      title: ensureString(record.title, fallback.priorities[index]?.title ?? 'Priority'),
      reason: ensureString(record.reason, fallback.priorities[index]?.reason ?? 'Important for today.'),
      linkedTaskId: typeof record.linkedTaskId === 'string' ? record.linkedTaskId : undefined,
      linkedFlowNodeId: typeof record.linkedFlowNodeId === 'string' ? record.linkedFlowNodeId : undefined,
    }
  }).filter(priority => priority.title).slice(0, 3)

  const scheduleBlocks = blocksRaw.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      id: ensureString(record.id, newId('block')),
      startTime: ensureString(record.startTime, fallback.scheduleBlocks[index]?.startTime ?? '9:00 AM'),
      endTime: ensureString(record.endTime, fallback.scheduleBlocks[index]?.endTime ?? '9:30 AM'),
      focusType: ensureFocusType(record.focusType),
      title: ensureString(record.title, fallback.scheduleBlocks[index]?.title ?? 'Work block'),
      description: ensureString(record.description, fallback.scheduleBlocks[index]?.description ?? 'Execute the next clear step.'),
      reason: ensureString(record.reason, fallback.scheduleBlocks[index]?.reason ?? 'This keeps the day moving.'),
      status: 'pending' as BlockStatus,
      linkedTaskId: typeof record.linkedTaskId === 'string' ? record.linkedTaskId : undefined,
      linkedFlowNodeId: typeof record.linkedFlowNodeId === 'string' ? record.linkedFlowNodeId : undefined,
    }
  }).filter(block => block.title).slice(0, 9)

  if (scheduleBlocks.length === 0) throw new Error('AI schedule is empty')

  const warnings = warningsRaw.map(item => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    return {
      id: ensureString(record.id, newId('warn')),
      type: ensureWarningType(record.type),
      message: ensureString(record.message, 'Review this before committing to the plan.'),
      severity: ensureWarningSeverity(record.severity),
    }
  }).slice(0, 5)

  const briefingText = wordLimit(ensureString(obj.briefingText, fallback.briefingText), 180)
  return {
    summary: ensureString(obj.summary, fallback.summary),
    briefingText,
    priorities: priorities.length ? priorities : fallback.priorities,
    scheduleBlocks,
    warnings: warnings.length ? warnings : fallback.warnings,
  }
}

function compactTaskContext(tasks: Task[]) {
  return tasks.slice(0, 8).map(task => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.due_date,
    description: task.description?.slice(0, 60) ?? null,
    flowNodeId: task.feature_id ?? null,
    showOnFlow: task.show_on_flow ?? false,
  }))
}

function dailyPrompt(ctx: DailyGenerationContext) {
  return `You are Nex, a calm, practical personal execution assistant inside NextAsk.

Create today's plan for this user. Return JSON only. No markdown.

Rules:
- The schedule table answers what to do and when.
- The briefing answers why this plan works and how to execute it.
- The briefing must be under 180 words.
- Do not make medical claims or fake certainty.
- Use 5 to 7 schedule blocks unless the available hours make that impossible.
- Include at least one break if available work time is more than 3 hours.
- Every schedule block status must be "pending".
- Do not read or repeat the full schedule in the briefing.
- Keep every title, description, reason, and warning short.

User:
${JSON.stringify({
    name: userFirstName(ctx.profile),
    workspaceName: ctx.workspaceName,
    projectName: ctx.projectName ?? null,
    isPersonal: ctx.isPersonal,
    input: ctx.input,
  }, null, 2)}

Tasks:
${JSON.stringify(compactTaskContext(ctx.tasks), null, 2)}

Return JSON using exactly this schema:
{
  "summary": "string",
  "briefingText": "string",
  "priorities": [
    { "id": "string", "title": "string", "reason": "string", "linkedTaskId": "string optional", "linkedFlowNodeId": "string optional" }
  ],
  "scheduleBlocks": [
    { "id": "string", "startTime": "string", "endTime": "string", "focusType": "deep_work | admin | break | meeting | personal | review", "title": "string", "description": "string", "reason": "string", "status": "pending", "linkedTaskId": "string optional", "linkedFlowNodeId": "string optional" }
  ],
  "warnings": [
    { "id": "string", "type": "blocked | overdue | dependency | energy | deadline", "message": "string", "severity": "low | medium | high" }
  ]
}`
}

async function generateWithAi(ctx: DailyGenerationContext) {
  const fallback = buildLocalPlan(ctx)
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await generateText(dailyPrompt(ctx), 1400)
      const parsed = JSON.parse(cleanJsonText(raw))
      return normalizeAiPlan(parsed, fallback)
    } catch (error) {
      lastError = error
      console.warn(`[Daily] AI generation attempt ${attempt + 1} failed`, error)
    }
  }

  console.warn('[Daily] AI plan was unavailable; using deterministic local planner instead.', lastError)
  return fallback
}

export async function generateAndSaveDailyPlan(ctx: DailyGenerationContext) {
  const content = await generateWithAi(ctx)
  return saveDailyPlan(ctx, content)
}

export async function updateDailyBlockStatus(plan: DailyPlan, blockId: string, status: BlockStatus) {
  const scheduleBlocks = plan.scheduleBlocks.map(block =>
    block.id === blockId ? { ...block, status } : block,
  )

  const { data, error } = await supabase
    .from('daily_plans')
    .update({ schedule_blocks: scheduleBlocks, updated_at: new Date().toISOString() })
    .eq('id', plan.id)
    .eq('user_id', plan.userId)
    .select()
    .single()

  if (error) throw error
  return rowToPlan(data as DailyPlanRow)
}

function briefingOnlyPrompt(plan: DailyPlan, ctx: DailyRegenerationContext) {
  return `You are Nex, a calm, practical personal execution assistant inside NextAsk.

Regenerate only the assistant briefing for today's plan. Do not change the schedule.
Return JSON only: { "briefingText": "string" }

Rules:
- Under 180 words.
- Do not read or list the full schedule table.
- Explain why this plan works and how to execute it.
- Be calm, intelligent, practical, and slightly warm.
- Do not make medical claims or fake certainty.

Context:
${JSON.stringify({
    user: userFirstName(ctx.profile),
    workspaceName: ctx.workspaceName,
    projectName: ctx.projectName ?? null,
    isPersonal: ctx.isPersonal,
    plan: {
      summary: plan.summary,
      wakeUpTime: plan.wakeUpTime,
      sleepQuality: plan.sleepQuality,
      energyLevel: plan.energyLevel,
      availableHours: plan.availableHours,
      mainFocus: plan.mainFocus,
      hardCommitments: plan.hardCommitments,
      extraContext: plan.extraContext,
      priorities: plan.priorities,
      warnings: plan.warnings,
      scheduleBlocks: plan.scheduleBlocks.map(block => ({
        startTime: block.startTime,
        endTime: block.endTime,
        focusType: block.focusType,
        title: block.title,
      })),
    },
    tasks: compactTaskContext(ctx.tasks),
  }, null, 2)}`
}

export async function regenerateDailyBriefing(plan: DailyPlan, ctx: DailyRegenerationContext) {
  let briefingText = ''
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await generateText(briefingOnlyPrompt(plan, ctx), 700)
      const parsed = JSON.parse(cleanJsonText(raw)) as { briefingText?: unknown }
      briefingText = wordLimit(ensureString(parsed.briefingText, ''), 180)
      if (briefingText) break
    } catch (error) {
      lastError = error
      console.warn(`[Daily] briefing attempt ${attempt + 1} failed`, error)
    }
  }

  if (!briefingText) {
    throw new Error(lastError instanceof Error
      ? `Nex could not return a valid briefing: ${lastError.message}`
      : 'Nex could not return a valid briefing. Try again with fewer details.')
  }

  const { data, error } = await supabase
    .from('daily_plans')
    .update({ briefing_text: briefingText, updated_at: new Date().toISOString() })
    .eq('id', plan.id)
    .eq('user_id', plan.userId)
    .select()
    .single()

  if (error) throw error
  return rowToPlan(data as DailyPlanRow)
}

export async function regenerateFullDailyPlan(plan: DailyPlan, ctx: DailyRegenerationContext) {
  return generateAndSaveDailyPlan({
    ...ctx,
    userId: plan.userId,
    input: inputFromPlan(plan),
  })
}
