import { useState, useRef } from 'react'
import { useWines } from '../hooks/useWines'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

interface ImportModalProps {
  onClose: () => void
  onDone: () => void
}

interface ParsedWine {
  name: string
  winery: string | null
  vintage: string | null
  varietal: string | null
  region: string | null
  country: string | null
  type: string
  body: string | null
  sweetness: string | null
  flavor_profile: string[] | null
  description: string | null
  reviews: any[]
  qty: number
  image_base64: null
  image_url: null
  date_added: string
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuotes = !inQuotes
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else current += line[i]
    }
    result.push(current.trim())
    return result
  }
  const headers = parseRow(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim() })
    return row
  })
  return { headers, rows }
}

function guessWineType(color: string, varietal = ''): string {
  const c = (color + ' ' + varietal).toLowerCase()
  if (c.includes('sparkling') || c.includes('champagne') || c.includes('prosecco') || c.includes('cava') || c.includes('crémant')) return 'sparkling'
  if (c.includes('rose') || c.includes('rosé') || c.includes('rosato') || c.includes('rosado')) return 'rose'
  if (c.includes('white') || c.includes('blanc') || c.includes('bianco') || c.includes('blanco') || c.includes('grigio') || c.includes('gris')) return 'white'
  if (c.includes('dessert') || c.includes('port') || c.includes('sherry') || c.includes('sauternes')) return 'dessert'
  return 'red'
}

function parseCellarTracker(rows: Record<string, string>[]): ParsedWine[] {
  return rows.filter(r => r['Wine'] || r['WineID']).map(r => ({
    name: r['Wine'] || 'Unknown Wine',
    winery: r['Producer'] || r['Vineyard'] || null,
    vintage: r['Vintage'] && r['Vintage'] !== '0' ? r['Vintage'] : null,
    varietal: r['Varietal'] || r['MasterVarietal'] || null,
    region: r['Region'] || r['SubRegion'] || r['Appellation'] || null,
    country: r['Country'] || null,
    type: guessWineType(r['Color'] ?? r['Type'] ?? '', r['Varietal'] ?? ''),
    body: null, sweetness: null, flavor_profile: null,
    description: r['MyNotes'] || r['Notes'] || null,
    reviews: r['MyScore'] && r['MyScore'] !== '0'
      ? [{ source: 'My Score', score: parseInt(r['MyScore']), quote: '' }]
      : r['CTScore'] && r['CTScore'] !== '0'
        ? [{ source: 'CellarTracker', score: parseInt(r['CTScore']), quote: '' }]
        : [],
    qty: parseInt(r['Quantity'] || r['Qty'] || '1') || 1,
    image_base64: null, image_url: null,
    date_added: new Date().toISOString(),
  }))
}

function parseInVintory(rows: Record<string, string>[]): ParsedWine[] {
  return rows.filter(r => r['Name'] || r['Wine']).map(r => ({
    name: r['Name'] || r['Wine'] || 'Unknown Wine',
    winery: r['Producer'] || r['Winery'] || null,
    vintage: r['Vintage'] && r['Vintage'] !== '0' ? r['Vintage'] : null,
    varietal: r['Varietal'] || r['Grape Variety'] || null,
    region: r['Region'] || r['Appellation'] || null,
    country: r['Country'] || null,
    type: guessWineType(r['Type'] ?? r['Color'] ?? '', r['Varietal'] ?? ''),
    body: null, sweetness: null, flavor_profile: null,
    description: r['Notes'] || r['Tasting Notes'] || null,
    reviews: r['Rating'] ? [{ source: 'My Rating', score: parseInt(r['Rating']), quote: '' }] : [],
    qty: parseInt(r['Quantity'] || r['Bottles'] || '1') || 1,
    image_base64: null, image_url: null,
    date_added: new Date().toISOString(),
  }))
}

function parseVivino(rows: Record<string, string>[]): ParsedWine[] {
  return rows.filter(r => r['Wine Name'] || r['wine_name']).map(r => ({
    name: r['Wine Name'] || r['wine_name'] || 'Unknown Wine',
    winery: r['Winery'] || r['winery'] || null,
    vintage: r['Vintage'] || r['vintage'] || null,
    varietal: null,
    region: r['Region'] || r['region'] || null,
    country: r['Country'] || r['country'] || null,
    type: guessWineType(r['Type'] ?? ''),
    body: null, sweetness: null, flavor_profile: null,
    description: r['Notes'] || r['notes'] || null,
    reviews: r['Rating'] ? [{ source: 'Vivino', score: Math.round(parseFloat(r['Rating']) * 20), quote: '' }] : [],
    qty: parseInt(r['Quantity'] || r['quantity'] || '1') || 1,
    image_base64: null, image_url: null,
    date_added: new Date().toISOString(),
  }))
}

function detectAndParse(text: string): ParsedWine[] {
  const { headers, rows } = parseCSV(text)
  if (!headers.length) return []
  const h = headers.map(s => s.toLowerCase().trim())
  if (h.includes('color') && h.includes('producer')) return parseCellarTracker(rows)
  if (h.some(c => c.includes('wine name')) && h.some(c => c.includes('winery'))) return parseVivino(rows)
  if (h.includes('producer') && h.includes('type')) return parseInVintory(rows)
  return parseCellarTracker(rows)
}

type ImportTab = 'cellartracker' | 'csv'

export default function ImportModal({ onClose, onDone }: ImportModalProps) {
  const { addWine } = useWines()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<ImportTab>('cellartracker')
  const [stage, setStage] = useState<'pick' | 'preview' | 'importing' | 'done'>('pick')
  const [ctUsername, setCtUsername] = useState('')
  const [ctPassword, setCtPassword] = useState('')
  const [ctLoading, setCtLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedWine[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)

const handleCTImport = async () => {
  if (!ctUsername.trim() || !ctPassword.trim()) {
    toast.error('Enter your CellarTracker username and password')
    return
  }
  setCtLoading(true)
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const res = await fetch(
      '/api/cellartracker?username=' + encodeURIComponent(ctUsername) +
      '&password=' + encodeURIComponent(ctPassword),
      { signal: controller.signal }
    )

    clearTimeout(timeout)

    const text = await res.text()

    if (!res.ok) {
      try {
        const err = JSON.parse(text)
        throw new Error(err.error || 'Failed to connect to CellarTracker')
      } catch {
        throw new Error('CellarTracker returned an error. Check your username and password.')
      }
    }

    const wines = detectAndParse(text)
    if (!wines.length) throw new Error('No wines found. Your CellarTracker cellar may be empty.')
    setParsed(wines)
    setSelected(new Set(wines.map((_, i) => i)))
    setStage('preview')
  } catch (e: any) {
    if (e.name === 'AbortError') {
      toast.error('Request timed out. CellarTracker may be slow — try again.')
    } else {
      toast.error(e.message || 'Could not connect to CellarTracker')
    }
  }
  setCtLoading(false)
}

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const wines = detectAndParse(text)
      if (!wines.length) { toast.error('No wines found. Make sure this is a valid export file.'); return }
      setParsed(wines)
      setSelected(new Set(wines.map((_, i) => i)))
      setStage('preview')
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    const toImport = parsed.filter((_, i) => selected.has(i))
    setStage('importing')
    setProgress(0)
    let count = 0
    for (let i = 0; i < toImport.length; i++) {
      try {
        await addWine({
          ...toImport[i],
          id: crypto.randomUUID(),
          user_id: user?.id ?? 'guest',
        } as any)
        count++
      } catch { /* skip failed */ }
      setProgress(Math.round(((i + 1) / toImport.length) * 100))
      await new Promise(r => setTimeout(r, 40))
    }
    setImportedCount(count)
    setStage('done')
  }

  const missingCount = parsed.filter((_, i) => selected.has(i) && (!_.body || !_.sweetness)).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 200, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--navy-mid)', borderTop: '1px solid var(--border)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 className="serif" style={{ fontSize: 20, color: 'var(--text)', fontWeight: 400 }}>Import Wines</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {stage === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ display: 'flex', background: 'var(--navy-light)', borderRadius: 'var(--r-md)', padding: 3, gap: 3 }}>
                {(['cellartracker', 'csv'] as ImportTab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    flex: 1, padding: '9px 0', borderRadius: 'var(--r-sm)', border: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    background: tab === t ? 'var(--gold)' : 'transparent',
                    color: tab === t ? 'var(--navy)' : 'var(--text-dim)',
                  }}>
                    {t === 'cellartracker' ? '🍷 CellarTracker' : '📄 CSV Upload'}
                  </button>
                ))}
              </div>

              {tab === 'cellartracker' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 16, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 12 }}>✦ DIRECT IMPORT</div>
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
                      Enter your CellarTracker credentials to import your entire cellar automatically.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input
                        className="input"
                        placeholder="CellarTracker username"
                        value={ctUsername}
                        onChange={e => setCtUsername(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                      <input
                        className="input"
                        type="password"
                        placeholder="CellarTracker password"
                        value={ctPassword}
                        onChange={e => setCtPassword(e.target.value)}
                      />
                      <button
                        className="btn btn-primary btn-full"
                        onClick={handleCTImport}
                        disabled={ctLoading || !ctUsername.trim() || !ctPassword.trim()}
                      >
                        {ctLoading
                          ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <span className="spinner" />Connecting to CellarTracker...
                            </span>
                          : '🍷 Import from CellarTracker'}
                      </button>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(201,168,76,0.06)', borderRadius: 'var(--r-md)', padding: '10px 14px', border: '1px solid rgba(201,168,76,0.15)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      🔒 Your credentials are sent directly to CellarTracker and are never stored by Cellar.
                    </p>
                  </div>
                </div>
              )}

              {tab === 'csv' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { name: 'CellarTracker', icon: '🍷', steps: 'cellartracker.com → My Cellar → Export button (top right) → CSV' },
                    { name: 'InVintory', icon: '📦', steps: 'InVintory app → Settings → Export Data → CSV' },
                    { name: 'Vivino', icon: '🍇', steps: 'vivino.com → Profile → Privacy → Download your data → wines CSV' },
                  ].map(app => (
                    <div key={app.name} style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-md)', padding: 12, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span>{app.icon}</span>
                        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{app.name}</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>{app.steps}</p>
                    </div>
                  ))}

                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{ background: 'var(--navy-light)', border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)', padding: '32px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--gold)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
                  >
                    <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    <p className="serif" style={{ fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Upload CSV File</p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Tap to select your exported file</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {stage === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, color: 'var(--text)' }}>
                  <strong style={{ color: 'var(--gold)' }}>{parsed.length}</strong> wines found
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set(parsed.map((_, i) => i)))} style={{ fontSize: 11 }}>All</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ fontSize: 11 }}>None</button>
                </div>
              </div>

              {missingCount > 0 && (
                <div style={{ background: 'rgba(201,168,76,0.08)', borderRadius: 'var(--r-md)', padding: '10px 14px', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <p style={{ fontSize: 12, color: 'var(--gold)', lineHeight: 1.5 }}>
                    ✦ {missingCount} wines missing body/sweetness — tap any wine after importing to fill in details.
                  </p>
                </div>
              )}

              {parsed.map((wine, i) => {
                const isSelected = selected.has(i)
                return (
                  <div
                    key={i}
                    onClick={() => {
                      const next = new Set(selected)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      setSelected(next)
                    }}
                    style={{
                      background: isSelected ? 'var(--navy-light)' : 'var(--navy)',
                      borderRadius: 'var(--r-md)', padding: '12px 14px',
                      border: '1px solid', borderColor: isSelected ? 'rgba(201,168,76,0.35)' : 'var(--border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 4, border: '1.5px solid',
                      borderColor: isSelected ? 'var(--gold)' : 'var(--border)',
                      background: isSelected ? 'var(--gold)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {isSelected && <span style={{ fontSize: 10, color: 'var(--navy)', fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wine.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {[wine.winery, wine.vintage].filter(Boolean).join(' · ')}{wine.qty > 1 ? ' · ' + wine.qty + ' btl' : ''}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
                      background: wine.type === 'red' ? 'rgba(123,29,46,0.3)' : wine.type === 'white' ? 'rgba(212,192,106,0.2)' : wine.type === 'sparkling' ? 'rgba(168,197,218,0.2)' : 'rgba(196,97,122,0.2)',
                      color: wine.type === 'red' ? '#F5A0AE' : wine.type === 'white' ? '#E8D87A' : wine.type === 'sparkling' ? '#B8DCF0' : '#F0A0B8',
                    }}>
                      {wine.type}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {stage === 'importing' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div className="spinner spinner-lg" style={{ margin: '0 auto 20px' }} />
              <p className="serif" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>Importing your cellar...</p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>{progress}% complete</p>
              <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-full)', height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--gold)', width: progress + '%', transition: 'width 0.3s', borderRadius: 'var(--r-full)' }} />
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🍷</div>
              <h3 className="serif" style={{ fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>
                {importedCount} wine{importedCount !== 1 ? 's' : ''} imported!
              </h3>
              {missingCount > 0 && (
                <div style={{ background: 'rgba(201,168,76,0.08)', borderRadius: 'var(--r-md)', padding: '12px 16px', border: '1px solid rgba(201,168,76,0.2)', marginTop: 16, marginBottom: 16, textAlign: 'left' }}>
                  <p style={{ fontSize: 12, color: 'var(--gold)', lineHeight: 1.6 }}>
                    ✦ Tap any wine then Edit to fill in missing details for better sommelier recommendations.
                  </p>
                </div>
              )}
              <button className="btn btn-primary btn-full" onClick={onDone}>View My Cellar</button>
            </div>
          )}

        </div>

        {stage === 'preview' && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setStage('pick')} style={{ flex: 1 }}>← Back</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={selected.size === 0} style={{ flex: 2 }}>
              Import {selected.size} Wine{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
