import { supabase } from '../supabase'

export type NexTool =
  | 'get_task_summary'
  | 'create_task'
  | 'update_task_status'
  | 'delete_task'
  | 'start_focus_session'
  | 'get_daily_briefing'
  | 'suggest_next_task'

export interface TaskContext {
  tasks: {
    id: string
    title: string
    status: string
    priority: string | null
    due_date: string | null
    description: string | null
  }[]
  workspaceName: string
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
  return `You are Nex, an AI assistant built into NexTask — a Kanban productivity system.

Personality: Calm, precise, quietly intelligent. Like Jarvis — efficient, occasionally dry wit. Never verbose. No filler phrases.

Rules:
- Plain text only. No asterisks, bullets, markdown. Output read aloud via TTS.
- Never open with: Sure, Of course, Certainly, Great, Absolutely, Happy to.
- Every response under 2 sentences unless a full briefing.
- You have FULL conversation memory — you remember everything said in this session.
- When user refers to "that task", "the one I just mentioned", "the overdue one" — use context from earlier in the conversation.
- Never say you don't remember something that was said in this conversation.
- Today: ${today} | Tomorrow: ${tomorrow}
- Time: ${now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}

When disambiguating tasks with the same name:
- "the overdue one" = task with due_date < today
- "the one due today" = task with due_date = today  
- "the one without a date" = task with due_date = null
- Always confirm which specific task you're acting on before deleting

Creating tasks: extract title (remove filler words), priority (urgent→high, default→normal), due_date (resolve relative dates).

Board: ${ctx.isPersonal ? 'Personal' : ctx.workspaceName}
Tasks (include IDs for precise operations):
${ctx.tasks.length === 0
    ? 'Board is empty.'
    : ctx.tasks.map(t => {
        const today2 = fmt(new Date())
        const isOverdue = t.due_date && t.due_date < today2 && t.status !== 'done'
        const isDueToday = t.due_date === today2
        const flag = isOverdue ? ' [OVERDUE]' : isDueToday ? ' [DUE TODAY]' : ''
        return `[ID:${t.id}] [${t.status}] ${t.title} — ${t.priority ?? 'normal'}${t.due_date ? ` — due ${t.due_date}${flag}` : ' — no date'}`
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
    description: 'Full status briefing — overdue, due today, in progress.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'suggest_next_task',
    description: 'Recommend the single most important task to work on next.',
    input_schema: { type: 'object', properties: {}, required: [] },
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

export async function executeNexTool(
  tool: NexTool,
  input: Record<string, unknown>,
  ctx: TaskContext,
  workspaceId: string | null,
  userId: string
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
      if (overdue.length)    parts.push(`${overdue.length} overdue — first: ${overdue[0].title}`)
      if (dueToday.length)   parts.push(`${dueToday.length} due today`)
      if (inProgress.length) parts.push(`${inProgress.length} in progress`)
      return { result: parts.length ? parts.join('. ') + '.' : 'No urgent items. Board looks healthy.' }
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

    case 'create_task': {
      const rawDate      = input.due_date as string | undefined
      const resolvedDate = rawDate ? resolveDate(rawDate) : null
      const rawPriority  = (input.priority as string | undefined) ?? 'normal'
      const priority     = rawPriority === 'medium' ? 'normal' : rawPriority
      const { data, error } = await supabase.from('tasks').insert({
        title: input.title as string, priority,
        due_date: resolvedDate, description: (input.description as string) ?? null,
        status: 'todo', workspace_id: workspaceId ?? null,
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
      return { result: `${duration} minutes, starting now${task ? ` on ${task.title}` : ''}. Distractions are your responsibility.`, action: { type: 'start_focus_session', data: { duration, taskId } } }
    }

    default: return { result: 'Unknown command.' }
  }
}

// Multi-turn conversation — history passed in, new messages appended
export async function askNex(
  transcript: string,
  ctx: TaskContext,
  workspaceId: string | null,
  userId: string,
  history: ConvMessage[] = []
): Promise<{ speech: string; action?: NexActionResult; newHistory: ConvMessage[] }> {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY as string,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }

  // Build message array: history + current user turn
  const messages: ConvMessage[] = [
    ...history,
    { role: 'user', content: transcript },
  ]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      system: NEX_SYSTEM_PROMPT(ctx), tools: NEX_TOOLS,
      messages,
    }),
  })

  if (!res.ok) {
    console.error('Nex API error:', await res.text())
    return { speech: 'Systems are unresponsive. Try again.', newHistory: history }
  }

  const data = await res.json()
  const toolBlock = data.content?.find((b: { type: string }) => b.type === 'tool_use')

  if (toolBlock) {
    const toolResult = await executeNexTool(toolBlock.name as NexTool, toolBlock.input, ctx, workspaceId, userId)

    // Add assistant tool_use + tool_result to history
    const withTool: ConvMessage[] = [
      ...messages,
      { role: 'assistant', content: data.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: toolResult.result }] },
    ]

    const followRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 200,
        system: NEX_SYSTEM_PROMPT(ctx), tools: NEX_TOOLS,
        messages: withTool,
      }),
    })

    const followData = await followRes.json()
    const textBlock  = followData.content?.find((b: { type: string }) => b.type === 'text')
    const speech     = stripMarkdown(textBlock?.text ?? toolResult.result)

    // Return updated history including this full exchange
    const newHistory: ConvMessage[] = [
      ...messages,
      { role: 'assistant', content: data.content },
      { role: 'user',      content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: toolResult.result }] },
      { role: 'assistant', content: followData.content ?? [{ type: 'text', text: speech }] },
    ]

    return { speech, action: toolResult.action, newHistory }
  }

  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  const speech    = stripMarkdown(textBlock?.text ?? 'No response.')

  // Return updated history
  const newHistory: ConvMessage[] = [
    ...messages,
    { role: 'assistant', content: data.content ?? [{ type: 'text', text: speech }] },
  ]

  return { speech, newHistory }
}