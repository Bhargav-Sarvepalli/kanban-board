import { supabase } from '../supabase'

export type NexTool =
  | 'get_task_summary'
  | 'create_task'
  | 'update_task_status'
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
    const cur = today.getDay()
    const isNext = lower.includes('next')
    let diff = dayIdx - cur
    if (diff <= 0 || isNext) diff += 7
    const d = new Date(today); d.setDate(d.getDate() + diff); return fmt(d)
  }
  if (lower.includes('next week'))  { const d = new Date(today); d.setDate(d.getDate() + 7); return fmt(d) }
  if (lower.includes('end of week') || lower.includes('this week')) {
    const d = new Date(today)
    const toFri = 5 - today.getDay()
    d.setDate(d.getDate() + (toFri <= 0 ? toFri + 7 : toFri))
    return fmt(d)
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
- Plain text only. No asterisks, bullets, or markdown. Output is read aloud via TTS.
- Never open with: Sure, Of course, Certainly, Great, Absolutely, Happy to.
- Every response under 2 sentences unless a full briefing.
- Complete natural sentences. Not robotic fragments.
- Never say the user's name.
- Today: ${today} (${now.toLocaleDateString('en-US', { weekday: 'long' })})
- Tomorrow: ${tomorrow}
- Current time: ${now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}

Creating tasks — extract these from natural language:
- title: clean task name, remove words like "add", "create", "remind me to", capitalize properly
- priority: "urgent"/"ASAP"/"important"/"high priority" → high | "low priority"/"whenever" → low | everything else → normal
- due_date: resolve relative dates. "Friday" = this coming Friday, "tomorrow" = ${tomorrow}, "next week" = 7 days out. Return as YYYY-MM-DD. Omit if not mentioned.

Board: ${ctx.isPersonal ? 'Personal' : ctx.workspaceName}
Tasks:
${ctx.tasks.length === 0
    ? 'Board is empty.'
    : ctx.tasks.map(t => `[${t.id}] [${t.status}] ${t.title} — ${t.priority ?? 'normal'} — due ${t.due_date ?? 'none'}`).join('\n')}`.trim()
}

const NEX_TOOLS = [
  {
    name: 'get_task_summary',
    description: 'Summarise tasks grouped by status',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_task',
    description: 'Create a new task from natural language. Triggered by: "add", "create", "remind me to", "I need to", "schedule", or any imperative that implies a task. Extract title, priority, and due_date.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string',  description: 'Clean task title. Remove filler words. Capitalize properly.' },
        priority:    { type: 'string',  enum: ['low', 'normal', 'high'], description: 'Default to normal if unclear.' },
        due_date:    { type: 'string',  description: 'Relative or absolute date string. E.g. "tomorrow", "Friday", "April 30". Omit if not mentioned.' },
        description: { type: 'string',  description: 'Only if user provides extra details.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Move a task to a different column. Triggered by: "mark done", "move to", "finish", "complete", "start working on".',
    input_schema: {
      type: 'object',
      properties: {
        task_id:         { type: 'string', description: 'Exact task ID from context.' },
        new_status:      { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'] },
        task_title_hint: { type: 'string', description: 'Partial title for fuzzy matching if ID unknown.' },
      },
      required: ['new_status'],
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
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim()
}

export function buildGreeting(ctx: TaskContext): string {
  const hour = new Date().getHours()
  const greeting =
    hour < 5  ? 'Working late, I see.' :
    hour < 12 ? 'Good morning.' :
    hour < 17 ? 'Good afternoon.' :
    hour < 21 ? 'Good evening.' : 'Still at it.'

  const today = fmt(new Date())
  const overdue    = ctx.tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done')
  const dueToday   = ctx.tasks.filter(t => t.due_date === today && t.status !== 'done')
  const inProgress = ctx.tasks.filter(t => t.status === 'in_progress')

  if (ctx.tasks.length === 0) return `${greeting} Board is clear. What are we building today?`
  if (overdue.length > 0)     return `${greeting} ${overdue.length} ${overdue.length === 1 ? 'task is' : 'tasks are'} overdue. I'd address that first.`
  if (dueToday.length > 0)    return `${greeting} ${dueToday.length} ${dueToday.length === 1 ? 'task' : 'tasks'} due today.`
  if (inProgress.length > 0)  return `${greeting} ${inProgress.length} in progress. Ready to continue?`
  return `${greeting} ${ctx.tasks.length} tasks on the board. What do you need?`
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
      if (overdue.length)    parts.push(`${overdue.length} overdue — first up: ${overdue[0].title}`)
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
      return {
        result: top
          ? `I'd start with ${top.title}${top.due_date ? `, due ${top.due_date}` : ''}.`
          : 'Everything is done. Well played.',
      }
    }

    case 'create_task': {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) return { result: 'Authentication required.' }

      const rawDate   = input.due_date as string | undefined
      const resolvedDate = rawDate ? resolveDate(rawDate) : null
      const rawPriority  = (input.priority as string | undefined) ?? 'normal'
      const priority     = rawPriority === 'medium' ? 'normal' : rawPriority

      const { data, error } = await supabase.from('tasks').insert({
        title:          input.title as string,
        priority,
        due_date:       resolvedDate,
        description:    (input.description as string) ?? null,
        status:         'todo',
        workspace_id:   workspaceId ?? null,
        user_id:        userId,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      }).select().single()

      if (error) return { result: `Couldn't create that. ${error.message}` }
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
      return {
        result: `Done. ${task?.title ?? 'Task'} is now ${newStatus.replace(/_/g, ' ')}.`,
        action: { type: 'update_task_status', data: { taskId, newStatus } },
      }
    }

    case 'start_focus_session': {
      const duration = (input.duration_minutes as number) ?? 25
      const taskId   = input.task_id as string | undefined
      const task     = ctx.tasks.find(t => t.id === taskId)
      return {
        result: `${duration} minutes, starting now${task ? ` on ${task.title}` : ''}. Distractions are your responsibility.`,
        action: { type: 'start_focus_session', data: { duration, taskId } },
      }
    }

    default: return { result: 'Unknown command.' }
  }
}

export async function askNex(
  transcript: string,
  ctx: TaskContext,
  workspaceId: string | null,
  userId: string
): Promise<{ speech: string; action?: NexActionResult }> {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY as string,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      system: NEX_SYSTEM_PROMPT(ctx), tools: NEX_TOOLS,
      messages: [{ role: 'user', content: transcript }],
    }),
  })

  if (!res.ok) {
    console.error('Nex API error:', await res.text())
    return { speech: 'Systems are unresponsive. Try again.' }
  }

  const data = await res.json()
  const toolBlock = data.content?.find((b: { type: string }) => b.type === 'tool_use')

  if (toolBlock) {
    const toolResult = await executeNexTool(toolBlock.name as NexTool, toolBlock.input, ctx, workspaceId, userId)

    const followRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 150,
        system: NEX_SYSTEM_PROMPT(ctx), tools: NEX_TOOLS,
        messages: [
          { role: 'user',      content: transcript },
          { role: 'assistant', content: data.content },
          { role: 'user',      content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: toolResult.result }] },
        ],
      }),
    })

    const followData = await followRes.json()
    const textBlock  = followData.content?.find((b: { type: string }) => b.type === 'text')
    return { speech: stripMarkdown(textBlock?.text ?? toolResult.result), action: toolResult.action }
  }

  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return { speech: stripMarkdown(textBlock?.text ?? 'No response.') }
}