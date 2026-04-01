export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  const password = searchParams.get('password')

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const url = `https://www.cellartracker.com/xlquery.asp?User=${encodeURIComponent(username)}&Password=${encodeURIComponent(password)}&Format=csv&Table=List&Location=1`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/csv,text/plain,*/*',
      }
    })

    if (!res.ok) {
      return new Response(JSON.stringify({ error: 'CellarTracker returned error ' + res.status }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const text = await res.text()

    // CellarTracker returns an HTML error page if credentials are wrong
    if (text.includes('<html') || text.includes('Invalid') || text.includes('incorrect')) {
      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
