import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWines } from '../hooks/useWines'
import { getRecommendations } from '../lib/api'
import { PREF_GROUPS, WINE_TYPE_COLORS } from '../types'
import type { EventPreferences, Recommendation } from '../types'
import toast from 'react-hot-toast'

const STORAGE_KEY = 'cellar_sommelier_prefs'
const RECS_KEY = 'cellar_sommelier_recs'

export default function SommelierPage() {
  const { wines } = useWines()
  const navigate = useNavigate()

  const [prefs, setPrefs] = useState<EventPreferences>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })

  const [recs, setRecs] = useState<Recommendation[] | null>(() => {
    try {
      const saved = sessionStorage.getItem(RECS_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    if (recs) sessionStorage.setItem(RECS_KEY, JSON.stringify(recs))
    else sessionStorage.removeItem(RECS_KEY)
  }, [recs])

  const toggle = (key: string, val: string) => {
    setRecs(null)
    setPrefs(prev => {
      const arr = (prev as any)[key] ?? []
      const idx = arr.indexOf(val)
      return { ...prev, [key]: idx >= 0 ? arr.filter((v: string) => v !== val) : [...arr, val] }
    })
  }

  const clearAll = () => {
    setPrefs({})
    setRecs(null)
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(RECS_KEY)
  }

  const getRecs = async () => {
    if (!wines.length) return
    setLoading(true)
    try {
      const result = await getRecommendations(prefs as any, wines)
      setRecs(result)
    } catch (e: any) {
      toast.error(e.message || 'Could not get recommendations')
    }
    setLoading(false)
  }

  const hasPrefs = Object.values(prefs).some(arr => arr && (arr as string[]).length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ padding: '6px 0', fontSize: 24, lineHeight: 1 }}>
            ‹
          </button>
          <div>
            <h1 className="serif" style={{ fontSize: 20, color: 'var(--text)', fontWeight: 400 }}>Event Sommelier</h1>
            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tell me about your gathering</p>
          </div>
        </div>
        {hasPrefs && (
          <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, padding: '20px 20px 120px' }}>

        {wines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>🥂</div>
            <h2 className="serif" style={{ fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>No wines yet</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 20 }}>
              Add wines to your cellar first and I will recommend the perfect bottles.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/add')}>Add Wines</button>
          </div>
        ) : (
          <div>
            {PREF_GROUPS.map(group => (
              <div key={group.key} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
                  {group.label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {group.opts.map(opt => {
                    const selected = ((prefs as any)[group.key] ?? []).includes(opt)
                    return (
                      <button
                        key={opt}
                        className={'chip' + (selected ? ' active' : '')}
                        onClick={() => toggle(group.key, opt)}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="divider" />

            <button
              className="btn btn-primary btn-full"
              onClick={getRecs}
              disabled={loading || !hasPrefs}
              style={{ marginBottom: 8 }}
            >
              {loading
                ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" />
                    Consulting your cellar...
                  </span>
                )
                : '✦ Get Wine Pairings'}
            </button>

            {!hasPrefs && (
              <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', marginBottom: 16 }}>
                Select at least one preference above
              </p>
            )}

            {recs !== null && recs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 20px', background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', marginTop: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🚫</div>
                <h3 className="serif" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>No wines available for this event</h3>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
                  None of your current wines match these preferences. Try adjusting the food, body, or sweetness — or add more wines to your cellar.
                </p>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/add')}>Add More Wines</button>
              </div>
            )}

            {recs !== null && recs.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <h2 className="serif" style={{ fontSize: 22, color: 'var(--text)', marginBottom: 4 }}>Your Pairings</h2>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>Curated from your cellar</p>

                {recs.map((rec: any, i: number) => {
                  const wine = wines.find(w => w.id === rec.id)
                  if (!wine) return null
                  const tc = WINE_TYPE_COLORS[wine.type] ?? WINE_TYPE_COLORS.red

                  return (
                    <div
                      key={rec.id}
                      style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 16, position: 'relative', cursor: 'pointer', transition: 'border-color 0.2s' }}
                      onClick={() => navigate('/wine/' + wine.id, { state: { from: '/sommelier' } })}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(201,168,76,0.45)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
                    >
                      <div style={{ position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderRadius: '50%', background: 'var(--gold)', color: 'var(--navy)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                        {i + 1}
                      </div>

                      <div style={{ height: 170, background: 'var(--navy-surf)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {wine.image_base64
                          ? (
                            <img
                              src={'data:image/jpeg;base64,' + wine.image_base64}
                              alt={wine.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          )
                          : <span style={{ fontSize: 52, opacity: 0.2 }}>🍷</span>
                        }
                      </div>

                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 'var(--r-full)', background: tc.bg, border: '1px solid ' + tc.text + '55' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: tc.text, textTransform: 'uppercase', letterSpacing: 0.8 }}>{wine.type}</span>
                          </div>
                          {rec.matchScore && (
                            <span style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, background: 'rgba(201,168,76,0.1)', padding: '3px 10px', borderRadius: 'var(--r-full)', border: '1px solid rgba(201,168,76,0.3)' }}>
                              {rec.matchScore}% match
                            </span>
                          )}
                        </div>

                        <h3 className="serif" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>{wine.name}</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                          {[wine.winery, wine.vintage].filter(Boolean).join(' · ')}
                        </p>

                        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--r-sm)', padding: 10, marginBottom: 8 }}>
                          <p style={{ fontSize: 12, color: 'var(--cream-dim)', lineHeight: 1.6 }}>{rec.reason}</p>
                        </div>

                        {rec.whyNotOthers && (
                          <p style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 6 }}>
                            vs others: {rec.whyNotOthers}
                          </p>
                        )}

                        {rec.reviewHighlight && (
                          <p style={{ fontSize: 11, color: 'var(--gold)', fontStyle: 'italic' }}>
                            {'"' + rec.reviewHighlight + '"'}
                          </p>
                        )}

                        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>Tap to view full details →</p>
                      </div>
                    </div>
                  )
                })}

                <button className="btn btn-outline btn-full" onClick={clearAll} style={{ marginTop: 8 }}>
                  Start Over
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
