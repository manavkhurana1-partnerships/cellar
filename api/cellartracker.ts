export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  const password = searchParams.get('password')

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  const url = 'https://www.cellartracker.com/xlquery.asp' +
    '?User=' + encodeURIComponent(username) +
    '&Password=' + encodeURIComponent(password) +
    '&Format=csv&Table=List&Location=1'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/plain, text/csv, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })

    clearTimeout(timeout)

    const text = await res.text()

    // CellarTracker returns HTML on bad credentials
    if (text.trim().startsWith('<') || text.toLowerCase().includes('invalid') || text.toLowerCase().includes('error')) {
      return new Response(JSON.stringify({ error: 'Invalid username or password. Please check your CellarTracker credentials.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Check it looks like CSV
    if (!text.includes(',') || text.split('\n').length < 2) {
      return new Response(JSON.stringify({ error: 'No wine data found. Your CellarTracker cellar may be empty.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      }
    })
  } catch (e: any) {
    const isTimeout = e.name === 'AbortError'
    return new Response(JSON.stringify({
      error: isTimeout
        ? 'CellarTracker took too long to respond. Try again in a moment.'
        : 'Could not reach CellarTracker: ' + (e.message ?? 'unknown error')
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
}
