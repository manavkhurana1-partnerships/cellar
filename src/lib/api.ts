import Tesseract from 'tesseract.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

// ─── Cache to avoid repeat API calls ──────────────────────────
const cache = new Map<string, any>()

function getCacheKey(type: string, input: string) {
  return type + ':' + input.slice(0, 100).toLowerCase().trim()
}

// ─── Claude caller ─────────────────────────────────────────────
async function callClaude(messages: any[], tools?: any[]) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing VITE_ANTHROPIC_API_KEY')

  const body: any = { model: MODEL, max_tokens: 800, messages }
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
    throw new Error('API error ' + res.status + ': ' + err)
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

// ─── Free OCR (no AI cost) ─────────────────────────────────────
export async function runOCR(
  imageData: string,
  mimeType: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  onProgress?.('Scanning label text (free)...')
  const dataUrl = 'data:' + mimeType + ';base64,' + imageData
  const result = await Tesseract.recognize(dataUrl, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress?.('Reading label... ' + Math.round((m.progress ?? 0) * 100) + '%')
      }
    },
  })
  return result.data.text.trim()
}

// ─── Label scan: free OCR → cheap text-only Claude ─────────────
export async function extractLabel(
  base64: string,
  mimeType: string = 'image/jpeg',
  onProgress?: (msg: string) => void
): Promise<any> {
  onProgress?.('Scanning label...')
  const ocrText = await runOCR(base64, mimeType, onProgress)

  if (!ocrText || ocrText.length < 5) {
    throw new Error('Could not read label text. Try a clearer, well-lit photo.')
  }

  // Check cache
  const key = getCacheKey('label', ocrText)
  if (cache.has(key)) {
    onProgress?.('Found in cache!')
    return cache.get(key)
  }

  onProgress?.('Identifying wine...')
  const data = await callClaude([{
    role: 'user',
    content: 'Raw OCR text from wine label: "' + ocrText + '"\n\nReturn ONLY valid JSON (no markdown):\n{"name":"wine name","winery":"producer","vintage":"year","varietal":"grape","region":"region","country":"country","type":"red|white|rose|sparkling|dessert","body":"light|medium|full","sweetness":"dry|off-dry|sweet","flavorProfile":["note1","note2","note3","note4"],"description":"1-2 sentence tasting note"}'
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '{}'
  const result = parseJSON(text)
  cache.set(key, result)
  return result
}

// ─── UPC lookup — free databases first, no AI cost ─────────────
export async function lookupUPC(upc: string): Promise<any> {
  const clean = upc.replace(/\D/g, '')

  // Check cache
  const key = getCacheKey('upc', clean)
  if (cache.has(key)) return cache.get(key)

  // Try UPC Item DB (free)
  try {
    const res = await fetch('https://api.upcitemdb.com/prod/trial/lookup?upc=' + clean)
    const data = await res.json()
    const item = data.items?.[0]
    if (item?.title) {
      const result = await enrichWineFromName(item.title + ' ' + (item.brand ?? ''))
      cache.set(key, result)
      return result
    }
  } catch { /* fall through */ }

  // Try Open Food Facts (free)
  try {
    const res = await fetch('https://world.openfoodfacts.org/api/v0/product/' + clean + '.json')
    const data = await res.json()
    if (data.status === 1 && data.product?.product_name) {
      const result = await enrichWineFromName(data.product.product_name)
      cache.set(key, result)
      return result
    }
  } catch { /* fall through */ }

  throw new Error('Wine not found in barcode database. Try scanning the label instead.')
}

// ─── Enrich name → structured wine data ───────────────────────
async function enrichWineFromName(rawName: string): Promise<any> {
  const key = getCacheKey('enrich', rawName)
  if (cache.has(key)) return cache.get(key)

  const data = await callClaude([{
    role: 'user',
    content: 'Wine product: "' + rawName + '"\n\nReturn ONLY valid JSON (no markdown):\n{"name":"wine name","winery":"producer","vintage":"year","varietal":"grape","region":"region","country":"country","type":"red|white|rose|sparkling|dessert","body":"light|medium|full","sweetness":"dry|off-dry|sweet","flavorProfile":["note1","note2","note3","note4"],"description":"1-2 sentence tasting note"}'
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '{}'
  const result = parseJSON(text)
  cache.set(key, result)
  return result
}

// ─── Reviews — cached ──────────────────────────────────────────
export async function fetchReviews(wine: { name: string; vintage?: string; winery?: string }) {
  const key = getCacheKey('reviews', (wine.name ?? '') + (wine.vintage ?? '') + (wine.winery ?? ''))
  if (cache.has(key)) return cache.get(key)

  const data = await callClaude(
    [{
      role: 'user',
      content: 'Find reviews for "' + wine.name + '" ' + (wine.vintage ?? '') + ' by ' + (wine.winery ?? '') + '. Return ONLY JSON array (no markdown): [{"source":"Wine Spectator","score":92,"quote":"one sentence"},{"source":"Wine Enthusiast","score":90,"quote":"one sentence"},{"source":"Vivino","score":91,"quote":"one sentence"},{"source":"Decanter","score":89,"quote":"one sentence"}]'
    }],
    [{ type: 'web_search_20250305', name: 'web_search' }]
  )
  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '[]'
  try {
    const result = parseJSON(text)
    cache.set(key, result)
    return result
  } catch { return [] }
}

// ─── Sommelier recommendations ─────────────────────────────────
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
    content: 'You are a master sommelier. Be STRICT.\n\nEVENT:\n' +
      Object.entries(prefs).filter(([, v]) => v?.length).map(([k, v]) => '- ' + k + ': ' + (v as string[]).join(', ')).join('\n') +
      '\n\nINVENTORY:\n' + JSON.stringify(summary) +
      '\n\nRules:\n- Only recommend wines that genuinely fit ALL factors\n- Red meat→full reds, Seafood→crisp whites NEVER red, Desserts→sweet only, Spicy→off-dry\n- Respect body and sweetness preferences strictly\n- Return [] if nothing fits\n\nReturn ONLY JSON array (no markdown):\n[{"id":"wine_id","matchScore":95,"reason":"3-4 sentences why it fits this specific event","whyNotOthers":"1 sentence","reviewHighlight":"1 sentence about quality"}]'
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '[]'
  try { return parseJSON(text) } catch { return [] }
}

// ─── External buy recommendations ─────────────────────────────
export async function getExternalRecommendations(
  prefs: Record<string, string[]>,
  inventory: any[]
) {
  const inventoryNames = inventory.map(w => w.name).join(', ')

  const data = await callClaude([{
    role: 'user',
    content: 'Master sommelier. Event:\n' +
      Object.entries(prefs).filter(([, v]) => v?.length).map(([k, v]) => '- ' + k + ': ' + (v as string[]).join(', ')).join('\n') +
      '\n\nUser owns: ' + (inventoryNames || 'none') +
      '\n\nRecommend 3 wines to BUY that match ALL event factors. Build Total Wine search URLs like: https://www.totalwine.com/search/all?text=Wine+Name+Here\n\nReturn ONLY JSON array (no markdown):\n[{"name":"wine name","winery":"producer","vintage":"year or NV","type":"red|white|rose|sparkling|dessert","varietal":"grape","region":"region, country","price":"$XX-XX","rating":"XX pts Source","reason":"3-4 sentences why perfect for this event","purchaseUrl":"https://www.totalwine.com/search/all?text=Wine+Name","retailer":"Total Wine & More"}]'
  }])

  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '[]'
  try { return parseJSON(text) } catch { return [] }
}
