const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MODELS = [
  'claude-3-haiku-20240307',
  'claude-3-5-haiku-20241022',
  'claude-sonnet-4-20250514',
]

async function callAnthropic(apiKey: string, prompt: string, maxTokens?: number) {
  let lastData: unknown = null
  let lastStatus = 500

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
        max_tokens: maxTokens ?? 300,
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
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')

    const { prompt, max_tokens } = await req.json()
    if (!prompt) throw new Error('prompt is required')

    const { data, status } = await callAnthropic(apiKey, prompt, max_tokens)
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
