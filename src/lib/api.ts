import Tesseract from 'tesseract.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-20250514'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Free OCR via Tesseract.js ─────────────────────────────────────────────

export async function runOCR(
  imageData: string,
  mimeType: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.('Running OCR on label...')
  const dataUrl = `data:${mimeType};base64,${imageData}`

  const result = await Tesseract.recognize(dataUrl, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress ?? 0) * 100)
        onProgress?.(`Reading label... ${pct}%`)
      }
    },
  })

  return result.data.text.trim()
}

// ─── Label extraction (OCR → Claude text only, much cheaper) ──────────────

export async function extractLabel(
  base64: string,
  mimeType: string = 'image/jpeg',
  onProgress?: (msg: string) => void
): Promise<any> {
  // Step 1 — free OCR
  onProgress?.('Scanning label text...')
  const ocrText = await runOCR(base64, mimeType, onProgress)

  if (!ocrText || ocrText.length < 5) {
    throw new Error('Could not read text from label. Try a clearer photo.')
  }

  // Step 2 — send text only to Claude (much cheaper than image)
  onProgress?.('Identifying wine...')
  const data = await callClaude([{
    role: 'user',
    content: `Here is raw OCR text extracted from a wine bottle label:

"${ocrText}"

Based on this text, identify and structure the wine details. Return ONLY valid JSON (no markdown, no backticks):
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
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '{}'
  return parseJSON(text)
}

// ─── UPC barcode lookup (completely free) ─────────────────────────────────

export async function lookupUPC(upc: string): Promise<any> {
  // Try Open Food Facts first (free, no key needed)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${upc}.json`)
    const data = await res.json()
    if (data.status === 1 && data.product) {
      const p = data.product
      const name = p.product_name || p.product_name_en || ''
      if (name) {
        return await enrichWineFromName(name)
      }
    }
  } catch { /* fall through */ }

  // Try UPC Item DB (free tier)
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`)
    const data = await res.json()
    if (data.items?.[0]) {
      const item = data.items[0]
      const name = item.title || item.brand || ''
      if (name) {
        return await enrichWineFromName(name)
      }
    }
  } catch { /* fall through */ }

  throw new Error('Could not find this wine by barcode. Try scanning the label instead.')
}

// ─── Enrich wine name → full structured data via Claude ───────────────────

async function enrichWineFromName(rawName: string): Promise<any> {
  const data = await callClaude([{
    role: 'user',
    content: `Based on this wine product name: "${rawName}"

Identify and structure the wine details. Return ONLY valid JSON (no markdown, no backticks):
{
  "name": "wine name",
  "winery": "producer name",
  "vintage": "year as string or empty",
  "varietal": "grape variety",
  "region": "region or appellation",
  "country": "country",
  "type": "one of: red, white, rose, sparkling, dessert",
  "body": "one of: light, medium, full",
  "sweetness": "one of: dry, off-dry, sweet",
  "flavorProfile": ["note1", "note2", "note3", "note4"],
  "description": "1-2 sentence tasting description"
}`
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '{}'
  return parseJSON(text)
}

// ─── Reviews ──────────────────────────────────────────────────────────────

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

// ─── Sommelier recommendations ────────────────────────────────────────────

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
