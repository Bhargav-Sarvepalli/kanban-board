const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export async function generateTaskDescription(title: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Write a brief, practical task description for: "${title}". 
          Keep it 1-2 sentences, actionable and specific. No fluff.`,
        },
      ],
    }),
  })
  const data = await response.json()
  return data.content[0].text
}

export async function suggestPriority(title: string): Promise<'low' | 'normal' | 'high'> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: `Based on this task title: "${title}", suggest a priority level.
          Reply with ONLY one word: low, normal, or high. Nothing else.`,
        },
      ],
    }),
  })
  const data = await response.json()
  const result = data.content[0].text.trim().toLowerCase()
  if (result === 'low' || result === 'high') return result
  return 'normal'
}

export async function breakIntoSubtasks(title: string, description: string): Promise<string[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Break this task into 3-5 subtasks:
          Title: "${title}"
          Description: "${description}"
          
          Reply with ONLY a JSON array of strings like: ["subtask 1", "subtask 2", "subtask 3"]
          No other text. No markdown. No code blocks. Just the raw JSON array.`,
        },
      ],
    }),
  })
  const data = await response.json()
  const raw = data.content[0].text.trim()
  // Strip markdown code blocks if present
  const text = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(text)
  } catch (e) {
    console.error('Failed to parse subtasks:', text)
    return []
  }
}