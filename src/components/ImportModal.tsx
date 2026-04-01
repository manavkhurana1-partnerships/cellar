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

// ─── CSV parsers for each app ──────────────────────────────────

function detectFormat(headers: string[]): 'cellartracker' | 'invintory' | 'vivino' | 'unknown' {
  const h = headers.map(s => s.toLowerCase().trim())
  if (h.includes('iwine') || h.includes('producer') && h.includes('color')) return 'cellartracker'
  if (h.includes('producer') && h.includes('type')) return 'invintory'
  if (h.includes('winery') && h.includes('wine name')) return 'vivino'
  // Try to detect by common columns
  if (h.some(c => c.includes('producer')) && h.some(c => c.includes('vintage'))) return 'cellartracker'
  if (h.some(c => c.includes('winery'))) return 'vivino'
  return 'unknown'
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  
  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes }
      else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = '' }
      else { current += line[i] }
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

function guessWineType(color: string, type: string): string {
  const c = (color + ' ' + type).toLowerCase()
  if (c.includes('sparkling') || c.includes('champagne') || c.includes('prosecco') || c.includes('cava')) return 'sparkling'
  if (c.includes('rose') || c.includes('rosé') || c.includes('rosato')) return 'rose'
  if (c.includes('white') || c.includes('blanc') || c.includes('bianco') || c.includes('blanco')) return 'white'
  if (c.includes('dessert') || c.includes('port') || c.includes('sherry') || c.includes('sweet')) return 'dessert'
  return 'red'
}

function parseCellarTracker(rows: Record<string, string>[]): ParsedWine[] {
  return rows.filter(r => r['Wine'] || r['iWine']).map(r => ({
    name: r['Wine'] || r['Vintage Wine'] || 'Unknown Wine',
    winery: r['Producer'] || r['Vineyard'] || null,
    vintage: r['Vintage'] && r['Vintage'] !== '0' ? r['Vintage'] : null,
    varietal: r['Varietal'] || r['Grape'] || null,
    region: r['Region'] || r['Appellation'] || null,
    country: r['Country'] || null,
    type: guessWineType(r['Color'] ?? '', r['Varietal'] ?? ''),
    body: null,
    sweetness: null,
    flavor_profile: null,
    description: r['Notes'] || r['MY NOTES'] || null,
    reviews: r['My Score'] ? [{ source: 'My Score', score: parseInt(r['My Score']), quote: '' }] : [],
    qty: parseInt(r['Quantity'] || r['Qty'] || '1') || 1,
    image_base64: null,
    image_url: null,
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
    body: null,
    sweetness: null,
    flavor_profile: null,
    description: r['Notes'] || r['Tasting Notes'] || null,
    reviews: r['Rating'] ? [{ source: 'My Rating', score: parseInt(r['Rating']), quote: '' }] : [],
    qty: parseInt(r['Quantity'] || r['Bottles'] || '1') || 1,
    image_base64: null,
    image_url: null,
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
    type: guessWineType(r['Type'] ?? '', ''),
    body: null,
    sweetness: null,
    flavor_profile: null,
    description: r['Notes'] || r['notes'] || null,
    reviews: r['Rating'] ? [{ source: 'Vivino', score: Math.round(parseFloat(r['Rating']) * 20), quote: '' }] : [],
    qty: parseInt(r['Quantity'] || r['quantity'] || '1') || 1,
    image_base64: null,
    image_url: null,
    date_added: new Date().toISOString(),
  }))
}

function parseUnknown(rows: Record<string, string>[], headers: string[]): ParsedWine[] {
  // Best-effort mapping for unknown formats
  const h = headers.map(s => s.toLowerCase())
  const find = (keys: string[]) => headers[h.findIndex(hh => keys.some(k => hh.includes(k)))] ?? ''

  const nameCol = find(['wine', 'name', 'title'])
  const wineryCol = find(['winery', 'producer', 'producer', 'vineyard'])
  const vintageCol = find(['vintage', 'year'])
  const varietalCol = find(['varietal', 'grape', 'variety'])
  const regionCol = find(['region', 'appellation', 'area'])
  const countryCol = find(['country'])
  const typeCol = find(['type', 'color', 'style'])
  const qtyCol = find(['qty', 'quantity', 'bottles', 'count'])
  const notesCol = find(['notes', 'comment', 'description'])
  const ratingCol = find(['rating', 'score', 'points'])

  return rows.filter(r => r[nameCol]).map(r => ({
    name: r[nameCol] || 'Unknown Wine',
    winery: r[wineryCol] || null,
    vintage: r[vintageCol] && r[vintageCol] !== '0' ? r[vintageCol] : null,
    varietal: r[varietalCol] || null,
    region: r[regionCol] || null,
    country: r[countryCol] || null,
    type: guessWineType(r[typeCol] ?? '', r[varietalCol] ?? ''),
    body: null,
    sweetness: null,
    flavor_profile: null,
    description: r[notesCol] || null,
    reviews: r[ratingCol] ? [{ source: 'My Rating', score: parseInt(r[ratingCol]), quote: '' }] : [],
    qty: parseInt(r[qtyCol] || '1') || 1,
    image_base64: null,
    image_url: null,
    date_added: new Date().toISOString(),
  }))
}

// ─── Component ─────────────────────────────────────────────────
export default function ImportModal({ onClose, onDone }: ImportModalProps) {
  const { addWine } = useWines()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'pick' | 'preview' | 'importing' | 'done'>('pick')
  const [format, setFormat] = useState<string>('')
  const [parsed, setParsed] = useState<ParsedWine[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      if (!headers.length) { toast.error('Could not read CSV file. Make sure it is a valid export.'); return }

      const detected = detectFormat(headers)
      setFormat(detected)

      let wines: ParsedWine[] = []
      if (detected === 'cellartracker') wines = parseCellarTracker(rows)
      else if (detected === 'invintory') wines = parseInVintory(rows)
      else if (detected === 'vivino') wines = parseVivino(rows)
      else wines = parseUnknown(rows, headers)

      wines = wines.filter(w => w.name && w.name !== 'Unknown Wine')
      if (!wines.length) { toast.error('No wines found in this file.'); return }

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
    const errs: string[] = []

    for (let i = 0; i < toImport.length; i++) {
      try {
        await addWine({
          ...toImport[i],
          id: crypto.randomUUID(),
          user_id: user?.id ?? 'guest',
        } as any)
        setProgress(Math.round(((i + 1) / toImport.length) * 100))
      } catch (e: any) {
        errs.push(toImport[i].name + ': ' + (e.message ?? 'failed'))
      }
      // Small delay to avoid overwhelming storage
      await new Promise(r => setTimeout(r, 50))
    }

    setErrors(errs)
    setStage('done')
  }

  const formatLabel: Record<string, string> = {
    cellartracker: 'CellarTracker',
    invintory: 'InVintory',
    vivino: 'Vivino',
    unknown: 'Unknown format — best effort',
  }

  const missingCount = parsed.filter((_, i) => selected.has(i) && (!_.body || !_.sweetness || !_.type)).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 200, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--navy-mid)', borderTop: '1px solid var(--border)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Modal header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 className="serif" style={{ fontSize: 20, color: 'var(--text)', fontWeight: 400 }}>Import Wines</h2>
            {stage === 'preview' && format && (
              <p style={{ fontSize: 11, color: 'var(--gold)', marginTop: 2 }}>
                Detected: {formatLabel[format] ?? format}
              </p>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* PICK */}
          {stage === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                Import your wine collection from another app. Export a CSV file from the app, then upload it here.
              </p>

              {[
                { name: 'CellarTracker', icon: '🍷', steps: 'cellartracker.com → My Cellar → Export → Download CSV' },
                { name: 'InVintory', icon: '📦', steps: 'InVintory app → Settings → Export Data → CSV' },
                { name: 'Vivino', icon: '🍇', steps: 'vivino.com → Profile → Privacy → Download your data → CSV' },
              ].map(app => (
                <div key={app.name} style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 14, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 22 }}>{app.icon}</span>
                    <span style={{ fontSize: 15, color: 'var(--text)', fontWeight: 600 }}>{app.name}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    {app.steps}
                  </p>
                </div>
              ))}

              <div className="divider" />

              <div
                onClick={() => fileRef.current?.click()}
                style={{ background: 'var(--navy-light)', border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)', padding: '32px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--gold)' }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--border)' }}
              >
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
                <p className="serif" style={{ fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Upload CSV File</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Tap to select your exported file</p>
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {stage === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, color: 'var(--text)' }}>
                  <strong style={{ color: 'var(--gold)' }}>{parsed.length}</strong> wines found
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set(parsed.map((_, i) => i)))} style={{ fontSize: 11 }}>
                    All
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ fontSize: 11 }}>
                    None
                  </button>
                </div>
              </div>

              {missingCount > 0 && (
                <div style={{ background: 'rgba(201,168,76,0.08)', borderRadius: 'var(--r-md)', padding: '10px 14px', border: '1px solid rgba(201,168,76,0.2)' }}>
                  <p style={{ fontSize: 12, color: 'var(--gold)', lineHeight: 1.5 }}>
                    ✦ {missingCount} wine{missingCount > 1 ? 's' : ''} have missing fields (body, sweetness, type). You can fill these in after importing by tapping any wine → Edit.
                  </p>
                </div>
              )}

              {parsed.map((wine, i) => {
                const isSelected = selected.has(i)
                const hasMissing = !wine.body || !wine.sweetness
                return (
                  <div
                    key={i}
                    onClick={() => {
                      const next = new Set(selected)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      setSelected(next)
                    }}
                    style={{
                      background: isSelected ? 'var(--navy-light)' : 'var(--navy)',
                      borderRadius: 'var(--r-md)', padding: '12px 14px',
                      border: '1px solid', borderColor: isSelected ? (hasMissing ? 'rgba(201,168,76,0.4)' : 'rgba(201,168,76,0.3)') : 'var(--border)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 4, border: '1.5px solid',
                      borderColor: isSelected ? 'var(--gold)' : 'var(--border)',
                      background: isSelected ? 'var(--gold)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginTop: 2,
                    }}>
                      {isSelected && <span style={{ fontSize: 10, color: 'var(--navy)', fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wine.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {[wine.winery, wine.vintage].filter(Boolean).join(' · ')}
                        {wine.qty > 1 ? ' · ' + wine.qty + ' btl' : ''}
                      </p>
                      {hasMissing && isSelected && (
                        <p style={{ fontSize: 10, color: 'var(--gold)', marginTop: 3 }}>⚠ Missing some fields — edit after import</p>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 'var(--r-full)',
                        background: wine.type === 'red' ? 'rgba(123,29,46,0.3)' : wine.type === 'white' ? 'rgba(212,192,106,0.2)' : wine.type === 'sparkling' ? 'rgba(168,197,218,0.2)' : 'rgba(196,97,122,0.2)',
                        color: wine.type === 'red' ? '#F5A0AE' : wine.type === 'white' ? '#E8D87A' : wine.type === 'sparkling' ? '#B8DCF0' : '#F0A0B8',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        {wine.type}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* IMPORTING */}
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

          {/* DONE */}
          {stage === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🍷</div>
              <h3 className="serif" style={{ fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>
                {selected.size - errors.length} wines imported!
              </h3>
              {errors.length > 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                  {errors.length} failed to import.
                </p>
              )}
              {missingCount > 0 && (
                <div style={{ background: 'rgba(201,168,76,0.08)', borderRadius: 'var(--r-md)', padding: '12px 16px', border: '1px solid rgba(201,168,76,0.2)', marginTop: 16, marginBottom: 16, textAlign: 'left' }}>
                  <p style={{ fontSize: 12, color: 'var(--gold)', lineHeight: 1.6 }}>
                    ✦ Some wines are missing body, sweetness, or type. Tap any wine in your cellar → <strong>Edit</strong> to fill in the missing details and get better sommelier recommendations.
                  </p>
                </div>
              )}
              <button className="btn btn-primary btn-full" onClick={onDone} style={{ marginTop: 8 }}>
                View My Cellar
              </button>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        {stage === 'preview' && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setStage('pick')} style={{ flex: 1 }}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={selected.size === 0}
              style={{ flex: 2 }}
            >
              Import {selected.size} Wine{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
