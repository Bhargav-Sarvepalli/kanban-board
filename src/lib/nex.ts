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
}

export interface NexActionResult {
  type: NexTool
  data: Record<string, unknown>
}

const NEX_SYSTEM_PROMPT = (ctx: TaskContext) => `
You are Nex, an AI assistant embedded in NexTask — a Kanban productivity app.
You are calm, dry, and professional. Like Jarvis from Iron Man.
Speak in short, confident sentences. Never say "Sure!" or "Great question!" or "Of course!".
Address the user directly. Keep responses under 3 sentences unless asked for more.
When uncertain, say so in one sentence. Never apologise.

Current user: ${ctx.userName}
Current workspace: ${ctx.workspaceName}
Current time: ${new Date().toLocaleString()}

Task snapshot:
${ctx.tasks.length === 0 ? 'No tasks in this workspace.' : ctx.tasks.map(t =>
  `- [${t.status}] ${t.title} | priority: ${t.priority ?? 'none'} | due: ${t.due_date ?? 'none'}`
).join('\n')}

When calling a tool, do so immediately without preamble.
When answering questions, keep it under 40 words.
`.trim()

const NEX_TOOLS = [
  {
    name: 'get_task_summary',
    description: 'Get a summary of current tasks grouped by status',
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
        due_date: { type: 'string', description: 'YYYY-MM-DD format' },
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
        task_title_hint: { type: 'string', description: 'Partial title if task_id unknown' },
      },
      required: ['new_status'],
    },
  },
  {
    name: 'start_focus_session',
    description: 'Start a Pomodoro focus session, optionally on a specific task',
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
    description: 'Morning briefing: overdue, due today, in progress counts',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'suggest_next_task',
    description: 'Suggest what to work on next based on priority and due dates',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

export async function executeNexTool(
  tool: NexTool,
  input: Record<string, unknown>,
  ctx: TaskContext,
  workspaceId: string,
  userId: string
): Promise<{ result: string; action?: NexActionResult }> {
  switch (tool) {
    case 'get_task_summary': {
      const grouped: Record<string, number> = {}
      ctx.tasks.forEach(t => { grouped[t.status] = (grouped[t.status] ?? 0) + 1 })
      const lines = Object.entries(grouped).map(([s, n]) => `${s}: ${n}`)
      return { result: lines.join(', ') || 'No tasks found.' }
    }

    case 'get_daily_briefing': {
      const today = new Date().toISOString().split('T')[0]
      const overdue = ctx.tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done')
      const dueToday = ctx.tasks.filter(t => t.due_date === today && t.status !== 'done')
      const inProgress = ctx.tasks.filter(t => t.status === 'in_progress')
      const urgentNote = overdue.length > 0 ? ` Most urgent: ${overdue[0].title}.` : ''
      return {
        result: `Overdue: ${overdue.length}. Due today: ${dueToday.length}. In progress: ${inProgress.length}.${urgentNote}`,
      }
    }

    case 'suggest_next_task': {
      const candidates = ctx.tasks.filter(t => t.status !== 'done')
      const priorityScore = (p: string | null) => p === 'high' ? 0 : p === 'medium' ? 1 : 2
      const sorted = [...candidates].sort((a, b) => {
        if (priorityScore(a.priority) !== priorityScore(b.priority))
          return priorityScore(a.priority) - priorityScore(b.priority)
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
        if (a.due_date) return -1
        if (b.due_date) return 1
        return 0
      })
      const top = sorted[0]
      return {
        result: top
          ? `Focus on: "${top.title}". Priority: ${top.priority ?? 'none'}. Due: ${top.due_date ?? 'no date'}.`
          : 'All tasks complete.',
      }
    }

    case 'create_task': {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return { result: 'Not authenticated.' }
      const { data, error } = await supabase.from('tasks').insert({
        title: input.title as string,
        priority: (input.priority as string) ?? 'medium',
        due_date: (input.due_date as string) ?? null,
        description: (input.description as string) ?? null,
        status: 'todo',
        workspace_id: workspaceId,
        user_id: userId,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      }).select().single()
      if (error) return { result: `Failed to create task: ${error.message}` }
      return {
        result: `Task "${data.title}" created.`,
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
      if (!taskId) return { result: 'Could not identify which task to update.' }
      const { error } = await supabase.from('tasks').update({
        status: newStatus,
        last_edited_by: userId,
        last_edited_at: new Date().toISOString(),
      }).eq('id', taskId)
      if (error) return { result: `Update failed: ${error.message}` }
      const task = ctx.tasks.find(t => t.id === taskId)
      return {
        result: `"${task?.title ?? 'Task'}" moved to ${newStatus.replace('_', ' ')}.`,
        action: { type: 'update_task_status', data: { taskId, newStatus } },
      }
    }

    case 'start_focus_session': {
      const duration = (input.duration_minutes as number) ?? 25
      const taskId = input.task_id as string | undefined
      const task = ctx.tasks.find(t => t.id === taskId)
      return {
        result: `Focus session started. ${duration} minutes.${task ? ` Task: "${task.title}".` : ''}`,
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
  workspaceId: string,
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
      max_tokens: 256,
      system: NEX_SYSTEM_PROMPT(ctx),
      tools: NEX_TOOLS,
      messages: [{ role: 'user', content: transcript }],
    }),
  })

  if (!res.ok) {
    console.error('Nex API error:', await res.text())
    return { speech: 'Something went wrong. Try again.' }
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
        max_tokens: 128,
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
    return { speech: textBlock?.text ?? toolResult.result, action: toolResult.action }
  }

  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return { speech: textBlock?.text ?? 'No response.' }
}