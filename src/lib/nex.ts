import { supabase } from '../supabase'

export type NexTool =
  | 'get_task_summary'
  | 'create_task'
  | 'update_task'
  | 'update_task_status'
  | 'delete_task'
  | 'start_focus_session'
  | 'get_daily_briefing'
  | 'get_standup_briefing'
  | 'suggest_next_task'
  | 'open_project_wizard'
  | 'open_workspace_panel'
  | 'add_subtasks_to_task'

export interface TaskContext {
  tasks: {
    id: string
    title: string
    status: string
    priority: string | null
    due_date: string | null
    description: string | null
    feature_id?: string | null
  }[]
  workspaceName: string
  projectName?: string
  userName: string
  isPersonal: boolean
}

export interface NexActionResult {
  type: NexTool
  data: Record<string, unknown>
}

// Conversation history message type for multi-turn
export interface ConvMessage {
  role: 'user' | 'assistant'
  content: string | { type: string; [key: string]: unknown }[]
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function resolveDate(raw: string): string {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const lower = raw.toLowerCase().trim()
  if (lower === 'today')     return fmt(today)
  if (lower === 'tomorrow')  { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d) }
  if (lower === 'yesterday') { const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d) }
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const dayIdx = days.findIndex(d => lower.includes(d))
  if (dayIdx !== -1) {
    const cur = today.getDay(); const isNext = lower.includes('next')
    let diff = dayIdx - cur
    if (diff <= 0 || isNext) diff += 7
    const d = new Date(today); d.setDate(d.getDate() + diff); return fmt(d)
  }
  if (lower.includes('next week'))  { const d = new Date(today); d.setDate(d.getDate() + 7); return fmt(d) }
  if (lower.includes('end of week') || lower.includes('this week')) {
    const d = new Date(today); const toFri = 5 - today.getDay()
    d.setDate(d.getDate() + (toFri <= 0 ? toFri + 7 : toFri)); return fmt(d)
  }
  const parsed = new Date(raw)
  if (!isNaN(parsed.getTime())) return fmt(parsed)
  return raw
}

const NEX_SYSTEM_PROMPT = (ctx: TaskContext) => {
  const now = new Date()
  const today = fmt(now)
  const tomorrow = fmt(new Date(now.getTime() + 86400000))
  return `You are Nex, a voice companion built into NexTask, a Kanban productivity system.

Personality: Warm, calm, grounded, and direct. Talk like a smart friend sitting beside the user while they work. You are not a customer support bot.

Rules:
- Plain text only. No markdown formatting. Output may be read aloud via TTS.
- Never open with: Sure, Of course, Certainly, Great, Absolutely, Happy to.
- Every response under 2 sentences unless a full briefing or a task breakdown.
- Be conversational, not just transactional. Acknowledge what the user is feeling or trying to do, then help.
- Use natural short phrases: "I get you", "That makes sense", "Let's slow it down", "Stay with me", "We can handle that".
- If the user sounds frustrated, calm things down before giving steps.
- Do not over-explain. Do not sound like a manual.
- Ask one short follow-up when the user intent is ambiguous. Act directly when the intent is clear.
- If the user is quiet or says wait, pause mentally and say you are here when they are ready. Do not invent work.
- You have FULL conversation memory. You remember everything said in this session.
- When user refers to "that task", "the one I just mentioned", "the overdue one", use context from earlier in the conversation.
- Never say you don't remember something that was said in this conversation.
- Today: ${today} | Tomorrow: ${tomorrow}
- Time: ${now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}

NexTask product map:
- Personal is private work. Workspace is shared team work.
- Daily Assistant turns the user's tasks, energy, commitments, and focus into a saved day plan. The schedule answers what to do and when; Nex's briefing answers why the plan makes sense and how to execute it.
- Project Dashboard shows project health, links, features, and activity.
- Board moves tasks through todo, in_progress, in_review, done. The same task list can be viewed as Project/All, My work, This week, Backlog, or Done so managers and members do not maintain duplicate boards.
- Flow is the manager map: phases are the trunk, features are branches, and a branch is merge-ready when its tasks are done.
- In Flow, clicking a branch opens the Branch Detail drawer with task health, blocked/overdue signals, recent history, Open board, and Merge preview.
- Merge preview shows done/open/risk counts, blocks normal merge until all branch tasks are done, allows force merge with a note, and records Flow history.
- Flow history is the project log for branch merges and major branch decisions.
- Calendar combines task dates and manual meeting entries.
- Timer is a fullscreen focus clock with manual durations, auto-flow breaks, Pulse/Tick focus beats, and optional Nex five-minute alerts.
- If the user asks to plan today, organize their day, or get a daily plan, guide them to the Daily tab. Keep advice practical, under control, and do not read or recite a whole schedule unless they ask.
- Standup mode should clarify risk, current progress, stale work, and decisions.
- Project Creation Wizard is the guided setup for Personal and workspace projects. It opens from the plus button beside Projects in the sidebar.
- Project Creation Wizard steps: project basics, collaborators, Flow phases, and feature branches. In Personal, the project stays private unless the user invites someone.
- If the user says create a project, set up a project, plan a new launch, or asks for a project wizard, use open_project_wizard. If they are in Personal, open the personal project setup.

Manager and standup behavior:
- Speak like a chief of staff. Start with health, then risks, then decisions.
- Do not list everything. Surface what needs attention.
- High-priority or overdue unfinished tasks are risk items.
- If asked for standup, briefing, project health, or what to tell the team, use get_standup_briefing.
- If asked how to merge a Flow branch, explain: open Flow, click the branch, review blockers in Branch Detail, open Merge preview, add a merge note, then merge when all tasks are done.
- If asked to create, modify, move, or delete work, use tools when intent is clear.
- If asked to break down a task, give 4-6 concrete execution steps. If the user asks to add/save those subtasks, use add_subtasks_to_task.
- Good subtasks are small, verifiable, and ordered. Avoid vague steps like "work on it" or "finish task".

When disambiguating tasks with the same name:
- "the overdue one" = task with due_date < today
- "the one due today" = task with due_date = today  
- "the one without a date" = task with due_date = null
- Always confirm which specific task you're acting on before deleting

Creating tasks: extract title (remove filler words), priority (urgent->high, default->normal), due_date (resolve relative dates).

Modifying tasks: use update_task for title, priority, due date, or description. Use update_task_status for column movement.

Board: ${ctx.projectName ? `${ctx.workspaceName} / ${ctx.projectName}` : ctx.isPersonal ? 'Personal' : ctx.workspaceName}
Tasks (include IDs for precise operations):
${ctx.tasks.length === 0
    ? 'Board is empty.'
    : ctx.tasks.map(t => {
        const today2 = fmt(new Date())
        const isOverdue = t.due_date && t.due_date < today2 && t.status !== 'done'
        const isDueToday = t.due_date === today2
        const flag = isOverdue ? ' [OVERDUE]' : isDueToday ? ' [DUE TODAY]' : ''
        const desc = t.description ? ` - note: ${t.description.slice(0, 140)}` : ''
        return `[ID:${t.id}] [${t.status}] ${t.title} - ${t.priority ?? 'normal'}${t.due_date ? ` - due ${t.due_date}${flag}` : ' - no date'}${desc}`
      }).join('\n')}`.trim()
}

const NEX_TOOLS = [
  {
    name: 'get_task_summary',
    description: 'Summarise tasks grouped by status',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_task',
    description: 'Create a new task from natural language. Extract title, priority, due_date.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string',  description: 'Clean task title. Remove "add", "create", "remind me to". Capitalize.' },
        priority:    { type: 'string',  enum: ['low', 'normal', 'high'], description: 'Default normal.' },
        due_date:    { type: 'string',  description: 'Relative or absolute date. Omit if not mentioned.' },
        description: { type: 'string',  description: 'Only if user provides extra details.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Move a task to a different column. Use exact task_id when possible.',
    input_schema: {
      type: 'object',
      properties: {
        task_id:         { type: 'string', description: 'Exact task ID from context. Prefer this over title hint.' },
        new_status:      { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'] },
        task_title_hint: { type: 'string', description: 'Partial title for fuzzy matching only if ID unknown.' },
      },
      required: ['new_status'],
    },
  },
  {
    name: 'update_task',
    description: 'Modify a task title, priority, due date, or description. Use exact task_id when possible.',
    input_schema: {
      type: 'object',
      properties: {
        task_id:         { type: 'string', description: 'Exact task ID from context. Prefer this over title hint.' },
        task_title_hint: { type: 'string', description: 'Partial title for fuzzy matching only if ID unknown.' },
        title:           { type: 'string', description: 'New title if requested.' },
        priority:        { type: 'string', enum: ['low', 'normal', 'high'], description: 'New priority if requested.' },
        due_date:        { type: 'string', description: 'New relative or absolute date. Empty string clears date only if explicitly requested.' },
        description:     { type: 'string', description: 'New description/details if requested.' },
      },
      required: [],
    },
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task. Use exact task_id. When multiple tasks have the same name, use the ID of the specific one based on user description (overdue, due today, no date).',
    input_schema: {
      type: 'object',
      properties: {
        task_id:         { type: 'string', description: 'PREFERRED: Exact task ID from context.' },
        task_title_hint: { type: 'string', description: 'Fallback: partial title if ID unknown.' },
      },
      required: [],
    },
  },
  {
    name: 'start_focus_session',
    description: 'Start a Pomodoro focus timer.',
    input_schema: {
      type: 'object',
      properties: {
        task_id:          { type: 'string' },
        duration_minutes: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_daily_briefing',
    description: 'Full status briefing: overdue, due today, in progress.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_standup_briefing',
    description: 'Manager standup briefing with health, risks, active work, completed work, and decisions needed.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'suggest_next_task',
    description: 'Recommend the single most important task to work on next.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'open_project_wizard',
    description: 'Open the guided Project Creation Wizard for Personal or workspace project setup, including project details, collaborators, Flow phases, and feature branches.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'add_subtasks_to_task',
    description: 'Append a clear execution checklist to an existing task description. Use when the user asks Nex to add, save, or attach subtasks/steps to a task.',
    input_schema: {
      type: 'object',
      properties: {
        task_id:         { type: 'string', description: 'Exact task ID from context. Prefer this over title hint.' },
        task_title_hint: { type: 'string', description: 'Partial title for fuzzy matching only if ID unknown.' },
        subtasks:        { type: 'array', items: { type: 'string' }, description: '4-6 concise execution steps.' },
      },
      required: ['subtasks'],
    },
  },
]

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1').replace(/#{1,6}\s/g, '')
    .replace(/^\s*[-*+]\s/gm, '').replace(/^\s*\d+\.\s/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim()
}

export function buildGreeting(ctx: TaskContext): string {
  const hour = new Date().getHours()
  const greeting =
    hour < 5  ? 'Working late.' :
    hour < 12 ? 'Good morning.' :
    hour < 17 ? 'Good afternoon.' :
    hour < 21 ? 'Good evening.' : 'Still at it.'
  const today = fmt(new Date())
  const overdue    = ctx.tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done')
  const dueToday   = ctx.tasks.filter(t => t.due_date === today && t.status !== 'done')
  const inProgress = ctx.tasks.filter(t => t.status === 'in_progress')
  if (ctx.tasks.length === 0) return `${greeting} Board is clear. What are we building today?`
  if (overdue.length > 0)     return `${greeting} ${overdue.length} ${overdue.length === 1 ? 'task' : 'tasks'} overdue. What do you need?`
  if (dueToday.length > 0)    return `${greeting} ${dueToday.length} due today. What can I help with?`
  if (inProgress.length > 0)  return `${greeting} ${inProgress.length} in progress. What do you need?`
  return `${greeting} What can I help you with?`
}

async function callNexChat(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('nex-chat', { body })
  if (error) throw error
  if (data?.error) throw new Error(String(data.error))
  return data
}

function localNexFallback(
  transcript: string,
  ctx: TaskContext,
  workspaceId: string | null,
): { speech: string; action?: NexActionResult } | null {
  const lower = transcript.toLowerCase()
  const wantsTaskCreation = /\b(create|add|make|new)\b/.test(lower) && /\b(task|todo|to do)\b/.test(lower)
  const wantsProjectSetup =
    /\b(create|start|setup|set up|new|plan|build)\b/.test(lower) &&
    /\b(project|launch|workspace project|project wizard|setup wizard)\b/.test(lower)

  if (wantsTaskCreation && !wantsProjectSetup) {
    return { speech: "Tell me the task title and I'll add it." }
  }

  if (wantsProjectSetup) {
    return {
      speech: workspaceId ? 'Opening workspace project setup.' : 'Opening personal project setup.',
      action: { type: 'open_project_wizard', data: workspaceId ? { workspaceId } : {} },
    }
  }

  if (/\b(flow|branch|feature)\b/.test(lower) && /\b(merge|merged|complete|finish)\b/.test(lower)) {
    return {
      speech: "Open Flow, click the branch, then use Merge preview. If tasks are still open, I'll help you break them down before you merge.",
    }
  }

  if (/\b(sorry|my bad|apologies)\b/.test(lower)) {
    return { speech: "You're good. No need to apologize." }
  }

  if (/\b(thanks|thank you|appreciate it)\b/.test(lower)) {
    return { speech: "Anytime. I'm here." }
  }

  if (/\b(wait|hold on|stay calm|pause|one sec|give me a second)\b/.test(lower)) {
    return { speech: "No rush. I'm here when you're ready." }
  }

  if (/\b(subtask|subtasks|break down|breakdown|steps|checklist|execute)\b/.test(lower)) {
    const hinted = ctx.tasks.find(t => lower.includes(t.title.toLowerCase())) ??
      ctx.tasks.find(t => t.status !== 'done') ??
      null
    if (!hinted) return { speech: "Tell me which task, and I'll break it into clean next steps." }
    const steps = buildSubtaskList(hinted.title, hinted.description ?? '')
    return { speech: `${hinted.title}: ${steps.map((s, i) => `${i + 1}. ${s}`).join(' ')}` }
  }

  if (/\b(standup|briefing|status|project health)\b/.test(lower)) {
    const today = fmt(new Date())
    const open = ctx.tasks.filter(t => t.status !== 'done')
    const done = ctx.tasks.filter(t => t.status === 'done')
    const overdue = open.filter(t => t.due_date && t.due_date < today)
    const active = ctx.tasks.filter(t => t.status === 'in_progress')
    const risk = overdue[0]?.title
    return {
      speech: `Health: ${overdue.length ? 'at risk' : active.length ? 'moving' : 'quiet'}. ${done.length}/${ctx.tasks.length} done.${risk ? ` Attention: ${risk}.` : ' No immediate risk flagged.'}`,
    }
  }

  if (/\b(next|work on|priority|focus)\b/.test(lower)) {
    const today = fmt(new Date())
    const candidates = ctx.tasks.filter(t => t.status !== 'done')
    const score = (p: string | null) => p === 'high' ? 0 : p === 'normal' ? 1 : 2
    const top = [...candidates].sort((a, b) => {
      const aO = a.due_date && a.due_date < today ? -1 : 0
      const bO = b.due_date && b.due_date < today ? -1 : 0
      if (aO !== bO) return aO - bO
      if (score(a.priority) !== score(b.priority)) return score(a.priority) - score(b.priority)
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      return 0
    })[0]
    return { speech: top ? `I'd start with ${top.title}. Smallest useful next move first.` : 'Nothing urgent is pulling at you right now.' }
  }

  return null
}

function buildSubtaskList(title: string, description: string): string[] {
  const source = `${title} ${description}`.toLowerCase()
  if (source.includes('bug') || source.includes('fix')) {
    return [
      'Reproduce the issue and note the exact screen or action that triggers it',
      'Find the component or data path responsible for the broken behavior',
      'Patch the smallest safe area of code',
      'Test the original failure case and one nearby edge case',
      'Update the task with what changed and any remaining risk',
    ]
  }
  if (source.includes('design') || source.includes('ui') || source.includes('responsive')) {
    return [
      'Define the user goal and the primary action for the screen',
      'Check spacing, contrast, text hierarchy, and mobile behavior',
      'Implement the layout in the existing visual system',
      'Test desktop and mobile states for overflow or low visibility',
      'Polish interaction states and empty/loading states',
    ]
  }
  if (source.includes('nex') || source.includes('ai') || source.includes('assistant')) {
    return [
      'Write the exact user phrases Nex should understand',
      'Map each phrase to either a response, a tool action, or a follow-up question',
      'Add safeguards for ambiguous or risky actions',
      'Test voice input, typed prompts, and failure fallback',
      'Tune the response tone so it sounds concise and natural',
    ]
  }
  return [
    'Clarify the expected outcome and acceptance criteria',
    'Break the work into the smallest independent implementation pieces',
    'Complete the first working version with the current app patterns',
    'Test the main path and the most likely edge case',
    'Document the result and decide the next follow-up',
  ]
}

export async function executeNexTool(
  tool: NexTool,
  input: Record<string, unknown>,
  ctx: TaskContext,
  workspaceId: string | null,
  userId: string,
  projectId: string | null = null
): Promise<{ result: string; action?: NexActionResult }> {
  switch (tool) {
    case 'get_task_summary': {
      const grouped: Record<string, number> = {}
      ctx.tasks.forEach(t => { grouped[t.status] = (grouped[t.status] ?? 0) + 1 })
      const lines = Object.entries(grouped).map(([s, n]) => `${s.replace(/_/g, ' ')}: ${n}`)
      return { result: lines.join(', ') || 'Board is empty.' }
    }

    case 'get_daily_briefing': {
      const today = fmt(new Date())
      const overdue    = ctx.tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done')
      const dueToday   = ctx.tasks.filter(t => t.due_date === today && t.status !== 'done')
      const inProgress = ctx.tasks.filter(t => t.status === 'in_progress')
      const parts: string[] = []
      if (overdue.length)    parts.push(`${overdue.length} overdue. First: ${overdue[0].title}`)
      if (dueToday.length)   parts.push(`${dueToday.length} due today`)
      if (inProgress.length) parts.push(`${inProgress.length} in progress`)
      return { result: parts.length ? parts.join('. ') + '.' : 'No urgent items. Board looks healthy.' }
    }

    case 'get_standup_briefing': {
      const today = fmt(new Date())
      const open = ctx.tasks.filter(t => t.status !== 'done')
      const done = ctx.tasks.filter(t => t.status === 'done')
      const overdue = open.filter(t => t.due_date && t.due_date < today)
      const high = open.filter(t => t.priority === 'high')
      const active = ctx.tasks.filter(t => t.status === 'in_progress')
      const review = ctx.tasks.filter(t => t.status === 'in_review')
      const health = overdue.length > 0 ? 'at risk' : review.length > 0 ? 'needs review' : active.length > 0 ? 'moving' : 'quiet'
      const risks = overdue[0]?.title ?? high[0]?.title ?? null
      const parts = [
        `Health: ${health}`,
        `${done.length}/${ctx.tasks.length} done`,
        active.length ? `${active.length} active` : 'no active tasks',
        review.length ? `${review.length} in review` : 'nothing waiting for review',
      ]
      if (risks) parts.push(`Attention: ${risks}`)
      else parts.push('No immediate risk flagged')
      return { result: parts.join('. ') + '.' }
    }

    case 'suggest_next_task': {
      const candidates = ctx.tasks.filter(t => t.status !== 'done')
      const today = fmt(new Date())
      const score  = (p: string | null) => p === 'high' ? 0 : p === 'normal' ? 1 : 2
      const sorted = [...candidates].sort((a, b) => {
        const aO = a.due_date && a.due_date < today ? -1 : 0
        const bO = b.due_date && b.due_date < today ? -1 : 0
        if (aO !== bO) return aO - bO
        if (score(a.priority) !== score(b.priority)) return score(a.priority) - score(b.priority)
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
        return 0
      })
      const top = sorted[0]
      return { result: top ? `I'd start with ${top.title}${top.due_date ? `, due ${top.due_date}` : ''}.` : 'Everything is done. Well played.' }
    }

    case 'open_project_wizard': {
      return {
        result: workspaceId
          ? 'Opening workspace project setup. I will help shape the project, phases, team, and feature branches.'
          : 'Opening personal project setup. I will help shape the project, phases, and feature branches.',
        action: { type: 'open_project_wizard', data: workspaceId ? { workspaceId } : {} },
      }
    }

    case 'add_subtasks_to_task': {
      let taskId = input.task_id as string | undefined
      if (!taskId && input.task_title_hint) {
        const hint = (input.task_title_hint as string).toLowerCase()
        const match = ctx.tasks.find(t => t.title.toLowerCase().includes(hint))
        if (match) taskId = match.id
      }
      if (!taskId) return { result: "I need the task name before I can add subtasks." }

      const task = ctx.tasks.find(t => t.id === taskId)
      if (!task) return { result: "I couldn't find that task on this board." }

      const rawSubtasks = Array.isArray(input.subtasks) ? input.subtasks : []
      const subtasks = rawSubtasks
        .map(item => String(item).trim())
        .filter(Boolean)
        .slice(0, 6)
      const finalSubtasks = subtasks.length > 0 ? subtasks : buildSubtaskList(task.title, task.description ?? '')
      const checklist = finalSubtasks.map((s, i) => `${i + 1}. ${s}`).join('\n')
      const existingDescription = task.description?.trim() ?? ''
      const marker = 'Execution checklist:'
      const description = existingDescription.includes(marker)
        ? existingDescription.replace(new RegExp(`${marker}[\\s\\S]*$`), `${marker}\n${checklist}`)
        : `${existingDescription ? `${existingDescription}\n\n` : ''}${marker}\n${checklist}`

      const { error } = await supabase.from('tasks').update({
        description,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      }).eq('id', taskId)
      if (error) return { result: `I couldn't add the subtasks. ${error.message}` }
      return {
        result: `Added an execution checklist to ${task.title}.`,
        action: { type: 'add_subtasks_to_task', data: { taskId, subtasks: finalSubtasks } },
      }
    }

    case 'create_task': {
      const rawDate      = input.due_date as string | undefined
      const resolvedDate = rawDate ? resolveDate(rawDate) : null
      const rawPriority  = (input.priority as string | undefined) ?? 'normal'
      const priority     = rawPriority === 'medium' ? 'normal' : rawPriority
      const { data, error } = await supabase.from('tasks').insert({
        title: input.title as string, priority,
        due_date: resolvedDate, description: (input.description as string) ?? null,
        status: 'todo', workspace_id: workspaceId ?? null,
        project_id: projectId,
        user_id: userId, last_edited_by: userId, last_edited_at: new Date().toISOString(),
      }).select().single()
      if (error) { console.error('[Nex create_task]', error); return { result: `Couldn't create that. ${error.message}` } }
      return {
        result: `Added: ${data.title}${resolvedDate ? `, due ${resolvedDate}` : ''}.`,
        action: { type: 'create_task', data: { task: data } },
      }
    }

    case 'update_task_status': {
      const newStatus = input.new_status as string
      let taskId = input.task_id as string | undefined
      if (!taskId && input.task_title_hint) {
        const hint  = (input.task_title_hint as string).toLowerCase()
        const match = ctx.tasks.find(t => t.title.toLowerCase().includes(hint))
        if (match) taskId = match.id
      }
      if (!taskId) return { result: "Couldn't identify that task. Be more specific." }
      const { error } = await supabase.from('tasks').update({
        status: newStatus, last_edited_by: userId, last_edited_at: new Date().toISOString(),
      }).eq('id', taskId)
      if (error) return { result: `Update failed. ${error.message}` }
      const task = ctx.tasks.find(t => t.id === taskId)
      return { result: `Done. ${task?.title ?? 'Task'} is now ${newStatus.replace(/_/g, ' ')}.`, action: { type: 'update_task_status', data: { taskId, newStatus } } }
    }

    case 'update_task': {
      let taskId = input.task_id as string | undefined
      if (!taskId && input.task_title_hint) {
        const hint = (input.task_title_hint as string).toLowerCase()
        const match = ctx.tasks.find(t => t.title.toLowerCase().includes(hint))
        if (match) taskId = match.id
      }
      if (!taskId) return { result: "Couldn't identify that task. Be more specific." }

      const patch: Record<string, unknown> = {
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      }
      if (typeof input.title === 'string' && input.title.trim()) patch.title = input.title.trim()
      if (typeof input.priority === 'string') patch.priority = input.priority === 'medium' ? 'normal' : input.priority
      if (typeof input.due_date === 'string') patch.due_date = input.due_date.trim() ? resolveDate(input.due_date) : null
      if (typeof input.description === 'string') patch.description = input.description.trim() || null

      if (Object.keys(patch).length <= 2) return { result: 'No change detected.' }
      const { error } = await supabase.from('tasks').update(patch).eq('id', taskId)
      if (error) return { result: `Update failed. ${error.message}` }
      const task = ctx.tasks.find(t => t.id === taskId)
      return { result: `Updated ${task?.title ?? 'task'}.`, action: { type: 'update_task', data: { taskId, patch } } }
    }

    case 'delete_task': {
      let taskId = input.task_id as string | undefined
      if (!taskId && input.task_title_hint) {
        const hint  = (input.task_title_hint as string).toLowerCase()
        const match = ctx.tasks.find(t => t.title.toLowerCase().includes(hint))
        if (match) taskId = match.id
      }
      if (!taskId) return { result: "Couldn't identify that task. Be more specific." }
      const task = ctx.tasks.find(t => t.id === taskId)
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) { console.error('[Nex delete_task]', error); return { result: `Delete failed. ${error.message}` } }
      return { result: `Deleted: ${task?.title ?? 'task'}${task?.due_date ? ` (due ${task.due_date})` : ' (no date)'}.`, action: { type: 'delete_task', data: { taskId } } }
    }

    case 'start_focus_session': {
      const duration = (input.duration_minutes as number) ?? 25
      const taskId   = input.task_id as string | undefined
      const task     = ctx.tasks.find(t => t.id === taskId)
      return { result: `${duration} minutes, ready${task ? ` for ${task.title}` : ''}. I opened the focus timer for you.`, action: { type: 'start_focus_session', data: { duration, taskId } } }
    }

    default: return { result: 'Unknown command.' }
  }
}

// Multi-turn conversation: history passed in, new messages appended
export async function askNex(
  transcript: string,
  ctx: TaskContext,
  workspaceId: string | null,
  userId: string,
  projectId: string | null = null,
  history: ConvMessage[] = []
): Promise<{ speech: string; action?: NexActionResult; newHistory: ConvMessage[] }> {
  // Build message array: history + current user turn
  const messages: ConvMessage[] = [
    ...history,
    { role: 'user', content: transcript },
  ]

  const immediateFallback = localNexFallback(transcript, ctx, workspaceId)
  const isProjectSetupRequest = /\b(create|start|setup|set up|new|plan|build)\b/i.test(transcript) &&
    /\b(project|launch|workspace project|project wizard|setup wizard)\b/i.test(transcript)
  if (immediateFallback && (immediateFallback.action?.type === 'open_project_wizard' || isProjectSetupRequest)) {
    return { speech: immediateFallback.speech, action: immediateFallback.action, newHistory: messages }
  }

  let data: { content?: { type: string; [key: string]: unknown }[] }
  try {
    data = await callNexChat({
      max_tokens: 400,
      system: NEX_SYSTEM_PROMPT(ctx),
      tools: NEX_TOOLS,
      messages,
    })
  } catch (err) {
    console.error('Nex API error:', err)
    const fallback = immediateFallback ?? localNexFallback(transcript, ctx, workspaceId)
    if (fallback) return { ...fallback, newHistory: messages }
    return { speech: 'Nex is having trouble reaching the AI service. Core commands still work; try project setup, standup, or what to work on next.', newHistory: messages }
  }

  const toolBlock = data.content?.find((b: { type: string }) => b.type === 'tool_use')

  if (toolBlock) {
    const toolResult = await executeNexTool(toolBlock.name as NexTool, toolBlock.input as Record<string, unknown>, ctx, workspaceId, userId, projectId)

    const withTool: ConvMessage[] = [
      ...messages,
      { role: 'assistant', content: data.content ?? [] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: toolResult.result }] },
    ]

    let speech = stripMarkdown(toolResult.result)
    let followData: { content?: { type: string; [key: string]: unknown }[] } = { content: [{ type: 'text', text: speech }] }
    try {
      followData = await callNexChat({
        max_tokens: 200,
        system: NEX_SYSTEM_PROMPT(ctx),
        tools: NEX_TOOLS,
        messages: withTool,
      })
      const textBlock = followData.content?.find((b: { type: string }) => b.type === 'text')
      speech = stripMarkdown(typeof textBlock?.text === 'string' ? textBlock.text : toolResult.result)
    } catch (err) {
      console.error('Nex follow-up error:', err)
    }

    const newHistory: ConvMessage[] = [
      ...messages,
      { role: 'assistant', content: data.content ?? [] },
      { role: 'user',      content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: toolResult.result }] },
      { role: 'assistant', content: followData.content ?? [{ type: 'text', text: speech }] },
    ]

    return { speech, action: toolResult.action, newHistory }
  }

  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  const speech    = stripMarkdown(typeof textBlock?.text === 'string' ? textBlock.text : 'No response.')

  // Return updated history
  const newHistory: ConvMessage[] = [
    ...messages,
    { role: 'assistant', content: data.content ?? [{ type: 'text', text: speech }] },
  ]

  return { speech, newHistory }
}
