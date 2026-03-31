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
    description: w.description,
    varietal: w.varietal,
    region: w.region,
  }))

  const data = await callClaude([{
    role: 'user',
    content: `You are a master sommelier with decades of experience pairing wines for events. Be STRICT and PRECISE.

EVENT PREFERENCES:
${Object.entries(prefs)
  .filter(([, vals]) => vals && (vals as string[]).length > 0)
  .map(([key, vals]) => `- ${key}: ${(vals as string[]).join(', ')}`)
  .join('\n')}

WINE INVENTORY:
${JSON.stringify(summary, null, 2)}

YOUR TASK:
Carefully analyze EVERY wine against ALL the event preferences above. Consider:

1. TIME OF DAY — Light, crisp whites and sparkling suit daytime. Bold reds suit evening/late night.
2. SETTING — Formal events call for structured, classic wines. Casual means easy-drinking styles.
3. FOOD PAIRING — This is critical. Specific rules:
   - Red meat → full-bodied reds like Cabernet, Malbec, Syrah
   - Seafood → crisp whites like Sauvignon Blanc, Pinot Grigio, Chablis. NEVER recommend full red with seafood.
   - Charcuterie & Cheese → versatile: Champagne, Pinot Noir, Chardonnay
   - Spicy food → off-dry or sweet wines like Riesling, Gewürztraminer. AVOID high tannin reds.
   - Pasta & Grains → medium reds like Sangiovese, Barbera, or medium whites
   - Desserts → sweet wines only. NEVER recommend dry wines with desserts.
   - No food → any style works, prioritize by occasion and time
4. OCCASION — Romantic Evening: elegant, complex wines. Celebration: sparkling preferred. Business/Networking: crowd-pleasing, not too bold. Casual Hangout: easy-drinking, approachable.
5. BODY PREFERENCE — If user says Light, DO NOT recommend Full-bodied wines. Respect this strictly.
6. SWEETNESS PREFERENCE — If user says Dry, DO NOT recommend sweet wines. Be strict.

STRICT RULES:
- Only recommend wines that genuinely match the event. 
- If a wine conflicts with ANY critical factor (especially food pairing or sweetness), exclude it completely.
- If NO wines in the inventory are appropriate, return an empty array [].
- Do NOT force recommendations just to have something to suggest.
- Maximum 3 recommendations, minimum 1 (or 0 if nothing fits).
- Rank by best overall fit across ALL factors, not just one.

Return ONLY a JSON array (no markdown, no explanation):
[{
  "id": "exact_wine_id",
  "matchScore": 95,
  "reason": "3-4 sentences explaining specifically why this wine fits THIS event — mention the food, occasion, time, and body/sweetness match explicitly",
  "whyNotOthers": "1 sentence on why this ranks above the other options",
  "reviewHighlight": "1 sentence about the wine's quality or critical reception"
}]

If nothing fits, return exactly: []`
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '[]'
  try { return parseJSON(text) } catch { return [] }
}

export async function getExternalRecommendations(
  prefs: Record<string, string[]>,
  inventory: any[]
) {
  const inventoryNames = inventory.map(w => w.name).join(', ')

  const data = await callClaude(
    [{
      role: 'user',
      content: `You are a master sommelier. A user is hosting an event with these preferences:

${Object.entries(prefs)
  .filter(([, vals]) => vals && (vals as string[]).length > 0)
  .map(([key, vals]) => `- ${key}: ${(vals as string[]).join(', ')}`)
  .join('\n')}

They already own these wines: ${inventoryNames || 'none'}

Recommend 3 wines they could BUY for this event that they do not already own. These should be excellent matches for ALL the event factors above.

For each wine, search for current purchase links at Total Wine & More (totalwine.com), BevMo (bevmo.com), or Wine.com as first preferences. If not found there, use any major reputable retailer.

Return ONLY a valid JSON array (no markdown):
[{
  "name": "full wine name",
  "winery": "producer",
  "vintage": "year or NV",
  "type": "red/white/rose/sparkling/dessert",
  "varietal": "grape variety",
  "region": "region, country",
  "price": "$XX",
  "rating": "XX pts (Source) or null",
  "reason": "3-4 sentences explaining exactly why this wine is perfect for THIS specific event — mention food pairing, occasion, time of day, body and sweetness match explicitly",
  "purchaseUrl": "https://www.totalwine.com/... or https://www.bevmo.com/... or https://www.wine.com/...",
  "retailer": "Total Wine & More"
}]`
    }],
    [{ type: 'web_search_20250305', name: 'web_search' }]
  )

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '[]'
  try { return parseJSON(text) } catch { return [] }
}

