const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MODELS = [
  'claude-3-haiku-20240307',
  'claude-3-5-haiku-20241022',
  'claude-sonnet-4-20250514',
]
const MAX_PROMPT_CHARS = 6_000
const MAX_TOKENS = 1800

async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!authorization.toLowerCase().startsWith('bearer ') || !supabaseUrl || !anonKey) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: anonKey },
  })
  if (!res.ok) {
    throw new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

async function callAnthropic(apiKey: string, prompt: string, maxTokens?: number) {
  let lastData: unknown = null
  let lastStatus = 500
  const safeMaxTokens = Math.min(Math.max(Number(maxTokens) || 300, 1), MAX_TOKENS)

  for (const model of DEFAULT_MODELS) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: safeMaxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    if (response.ok) return { data, status: response.status }

    lastData = data
    lastStatus = response.status
    const message = String((data as { error?: { message?: string } })?.error?.message ?? '')
    if (response.status !== 404 || !message.includes('model')) break
  }

  return { data: lastData, status: lastStatus }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await requireAuthenticatedUser(req)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

    const rawBody = await req.text()
    if (rawBody.length > MAX_PROMPT_CHARS + 500) {
      return new Response(JSON.stringify({ error: 'Request is too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { prompt, max_tokens } = JSON.parse(rawBody)
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('prompt is required')
    if (prompt.length > MAX_PROMPT_CHARS) {
      return new Response(JSON.stringify({ error: 'Prompt is too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, status } = await callAnthropic(apiKey, prompt, max_tokens)
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof Response) return err
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
