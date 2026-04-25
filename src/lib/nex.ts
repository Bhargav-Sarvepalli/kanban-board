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

const NEX_SYSTEM_PROMPT = (ctx: TaskContext) => `
You are Nex, an AI assistant built into NexTask — a personal Kanban productivity system.

Personality: Calm, precise, and quietly intelligent. Like Jarvis from Iron Man. You serve the user with efficiency and occasional dry wit. You are never verbose. You never use filler phrases.

Rules:
- Plain text only. No asterisks, no bullet points, no markdown of any kind. Your output is read aloud.
- Never open with: Sure, Of course, Certainly, Great, Absolutely, Happy to.
- Every response must be under 2 sentences unless it is a full briefing.
- Speak in complete, natural English sentences. Not robotic fragments.
- Dry wit is acceptable. Flattery is not.
- Never say the user's name. Address them directly without using a name.

Context:
Board: ${ctx.isPersonal ? 'Personal' : ctx.workspaceName}
Time: ${new Date().toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}

Tasks:
${ctx.tasks.length === 0
    ? 'Board is empty.'
    : ctx.tasks.map(t =>
      `[${t.status}] ${t.title} — ${t.priority ?? 'no priority'} — due ${t.due_date ?? 'none'}`
    ).join('\n')}
`.trim()

const NEX_TOOLS = [
  {
    name: 'get_task_summary',
    description: 'Summarise tasks grouped by status',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'create_task',
    description: 'Create a new task from natural language',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        description: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Move a task to a different status column',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        new_status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'] },
        task_title_hint: { type: 'string' },
      },
      required: ['new_status'],
    },
  },
  {
    name: 'start_focus_session',
    description: 'Start a Pomodoro focus session',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        duration_minutes: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_daily_briefing',
    description: 'Full briefing — overdue, due today, in progress',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'suggest_next_task',
    description: 'Recommend what to work on next based on urgency and priority',
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

  const timeGreeting =
    hour < 5  ? 'Working late, I see.' :
    hour < 12 ? 'Good morning.' :
    hour < 17 ? 'Good afternoon.' :
    hour < 21 ? 'Good evening.' :
                'Still at it.'

  const today = new Date().toISOString().split('T')[0]
  const overdue = ctx.tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done')
  const dueToday = ctx.tasks.filter(t => t.due_date === today && t.status !== 'done')
  const inProgress = ctx.tasks.filter(t => t.status === 'in_progress')

  if (ctx.tasks.length === 0) {
    return `${timeGreeting} Your board is clear. What are we building today?`
  }
  if (overdue.length > 0) {
    const p = overdue.length === 1 ? 'task is' : 'tasks are'
    return `${timeGreeting} ${overdue.length} ${p} overdue. I'd address that first.`
  }
  if (dueToday.length > 0) {
    const p = dueToday.length === 1 ? 'task' : 'tasks'
    return `${timeGreeting} ${dueToday.length} ${p} due today. Shall I walk you through them?`
  }
  if (inProgress.length > 0) {
    return `${timeGreeting} You have ${inProgress.length} in progress. Ready to continue?`
  }
  return `${timeGreeting} ${ctx.tasks.length} tasks on the board. What do you need?`
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
      const today = new Date().toISOString().split('T')[0]
      const overdue = ctx.tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done')
      const dueToday = ctx.tasks.filter(t => t.due_date === today && t.status !== 'done')
      const inProgress = ctx.tasks.filter(t => t.status === 'in_progress')
      const parts: string[] = []
      if (overdue.length) parts.push(`${overdue.length} overdue, starting with ${overdue[0].title}`)
      if (dueToday.length) parts.push(`${dueToday.length} due today`)
      if (inProgress.length) parts.push(`${inProgress.length} in progress`)
      return {
        result: parts.length
          ? parts.join('. ') + '.'
          : 'No urgent items. The board looks healthy.'
      }
    }

    case 'suggest_next_task': {
      const candidates = ctx.tasks.filter(t => t.status !== 'done')
      const today = new Date().toISOString().split('T')[0]
      const priorityScore = (p: string | null) => p === 'high' ? 0 : p === 'medium' ? 1 : 2
      const sorted = [...candidates].sort((a, b) => {
        const aOver = a.due_date && a.due_date < today ? -1 : 0
        const bOver = b.due_date && b.due_date < today ? -1 : 0
        if (aOver !== bOver) return aOver - bOver
        if (priorityScore(a.priority) !== priorityScore(b.priority))
          return priorityScore(a.priority) - priorityScore(b.priority)
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
        return 0
      })
      const top = sorted[0]
      return {
        result: top
          ? `I'd start with ${top.title}. It's ${top.priority ?? 'unrated'} priority${top.due_date ? `, due ${top.due_date}` : ''}.`
          : 'Everything is done. Well played.',
      }
    }

    case 'create_task': {
      const { data: session } = await supabase.auth.getSession()
      if (!session.session) return { result: 'Authentication required.' }
      const { data, error } = await supabase.from('tasks').insert({
        title: input.title as string,
        priority: (input.priority as string) ?? 'medium',
        due_date: (input.due_date as string) ?? null,
        description: (input.description as string) ?? null,
        status: 'todo',
        workspace_id: workspaceId ?? null,
        user_id: userId,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      }).select().single()
      if (error) return { result: `Couldn't create that. ${error.message}` }
      return {
        result: `Added: ${data.title}.`,
        action: { type: 'create_task', data: { task: data } },
      }
    }

    case 'update_task_status': {
      const newStatus = input.new_status as string
      let taskId = input.task_id as string | undefined
      if (!taskId && input.task_title_hint) {
        const hint = (input.task_title_hint as string).toLowerCase()
        const match = ctx.tasks.find(t => t.title.toLowerCase().includes(hint))
        if (match) taskId = match.id
      }
      if (!taskId) return { result: "I couldn't identify that task. Try being more specific." }
      const { error } = await supabase.from('tasks').update({
        status: newStatus,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
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
      const taskId = input.task_id as string | undefined
      const task = ctx.tasks.find(t => t.id === taskId)
      return {
        result: `${duration} minutes, starting now${task ? ` on ${task.title}` : ''}. Distractions are your responsibility.`,
        action: { type: 'start_focus_session', data: { duration, taskId } },
      }
    }

    default:
      return { result: 'Unknown command.' }
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
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: NEX_SYSTEM_PROMPT(ctx),
      tools: NEX_TOOLS,
      messages: [{ role: 'user', content: transcript }],
    }),
  })

  if (!res.ok) {
    console.error('Nex API error:', await res.text())
    return { speech: 'Systems are unresponsive. Try again.' }
  }

  const data = await res.json()
  const toolUseBlock = data.content?.find((b: { type: string }) => b.type === 'tool_use')

  if (toolUseBlock) {
    const toolResult = await executeNexTool(
      toolUseBlock.name as NexTool,
      toolUseBlock.input,
      ctx,
      workspaceId,
      userId
    )

    const followRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: NEX_SYSTEM_PROMPT(ctx),
        tools: NEX_TOOLS,
        messages: [
          { role: 'user', content: transcript },
          { role: 'assistant', content: data.content },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult.result }],
          },
        ],
      }),
    })

    const followData = await followRes.json()
    const textBlock = followData.content?.find((b: { type: string }) => b.type === 'text')
    return {
      speech: stripMarkdown(textBlock?.text ?? toolResult.result),
      action: toolResult.action,
    }
  }

  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return { speech: stripMarkdown(textBlock?.text ?? 'No response.') }
}