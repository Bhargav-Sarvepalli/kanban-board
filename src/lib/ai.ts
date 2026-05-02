import { supabase } from '../supabase'

async function generateText(prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('nex-generate', {
    body: { prompt },
  })

  if (error) throw error

  const text =
    data?.content?.[0]?.text ??
    data?.text ??
    data?.result ??
    ''

  if (!text) throw new Error('AI response was empty')
  return String(text).trim()
}

export async function generateTaskDescription(title: string): Promise<string> {
  return generateText(`Write a brief, practical task description for: "${title}".
Keep it 1-2 sentences, actionable and specific.
Do NOT include the task title in the description.
Do NOT use markdown formatting like # or **.
Do NOT repeat the title.
Just plain text sentences only.`)
}

export async function suggestPriority(title: string): Promise<'low' | 'normal' | 'high'> {
  const result = (await generateText(`Based on this task title: "${title}", suggest a priority level.
Reply with ONLY one word: low, normal, or high. Nothing else.`)).toLowerCase()

  if (result.includes('low')) return 'low'
  if (result.includes('high')) return 'high'
  return 'normal'
}

export async function breakIntoSubtasks(title: string, description: string): Promise<string[]> {
  const raw = await generateText(`Break this task into 3-5 subtasks:
Title: "${title}"
Description: "${description}"

Reply with ONLY a JSON array of strings like: ["subtask 1", "subtask 2", "subtask 3"]
No other text. No markdown. No code blocks. Just the raw JSON array.`)

  const text = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    console.error('Failed to parse subtasks:', text)
    return []
  }
}
