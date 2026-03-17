const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

async function callClaude(messages: any[], tools?: any[]) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing VITE_ANTHROPIC_API_KEY')

  const body: any = { model: MODEL, max_tokens: 1024, messages }
  if (tools) body.tools = tools

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }
  return res.json()
}

function parseJSON(text: string) {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    const match = text.match(/[\[{][\s\S]*[\]}]/)
    if (match) return JSON.parse(match[0])
    throw new Error('Could not parse response')
  }
}

export async function extractLabel(base64: string, mimeType: string = 'image/jpeg') {
    const data = await callClaude([{
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: mimeType as any, data: base64 }
            },
      {
        type: 'text',
        text: `Analyze this wine bottle label carefully. Return ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "name": "wine name",
  "winery": "producer name",
  "vintage": "year as string",
  "varietal": "grape variety",
  "region": "region or appellation",
  "country": "country",
  "type": "one of: red, white, rose, sparkling, dessert",
  "body": "one of: light, medium, full",
  "sweetness": "one of: dry, off-dry, sweet",
  "flavorProfile": ["note1", "note2", "note3", "note4"],
  "description": "1-2 sentence tasting description"
}`
      }
    ]
  }])
  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '{}'
  return parseJSON(text)
}

export async function fetchReviews(wine: { name: string; vintage?: string; winery?: string }) {
  const data = await callClaude(
    [{
      role: 'user',
      content: `Find reviews for "${wine.name}" ${wine.vintage ?? ''} by ${wine.winery ?? ''}. Return ONLY a JSON array (no markdown):
[{"source": "Wine Spectator", "score": 92, "quote": "one sentence"},
 {"source": "Wine Enthusiast", "score": 90, "quote": "one sentence"},
 {"source": "Vivino", "score": 91, "quote": "one sentence"},
 {"source": "Decanter", "score": 89, "quote": "one sentence"}]`
    }],
    [{ type: 'web_search_20250305', name: 'web_search' }]
  )
  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '[]'
  try { return parseJSON(text) } catch { return [] }
}

export async function getRecommendations(
  prefs: Record<string, string[]>,
  inventory: any[]
) {
  const summary = inventory.map(w => ({
    id: w.id,
    name: w.name,
    winery: w.winery,
    vintage: w.vintage,
    type: w.type,
    body: w.body,
    sweetness: w.sweetness,
    topScore: w.reviews?.[0]?.score ?? null,
    flavorProfile: w.flavor_profile,
  }))

  const data = await callClaude([{
    role: 'user',
    content: `You are a master sommelier.
Event preferences: ${JSON.stringify(prefs)}
Wine inventory: ${JSON.stringify(summary)}
Recommend 2-3 wines from the inventory. Return ONLY a JSON array (no markdown):
[{"id": "wine_id", "reason": "2-3 sentences why it fits", "reviewHighlight": "1 sentence about quality"}]
Rank best first. Only use wines from the inventory.`
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '[]'
  try { return parseJSON(text) } catch { return [] }
}