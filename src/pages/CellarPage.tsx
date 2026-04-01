import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWines } from '../hooks/useWines'
import { useAuth } from '../hooks/useAuth'
import { WINE_TYPE_COLORS } from '../types'
import type { Wine } from '../types'
import ImportModal from '../components/ImportModal'

function WineCard({ wine, onClick }: { wine: Wine; onClick: () => void }) {
  const tc = WINE_TYPE_COLORS[wine.type] ?? WINE_TYPE_COLORS.red
  const topScore = wine.reviews?.[0]?.score
  const hasMissing = !wine.body || !wine.sweetness || !wine.varietal

  return (
    <div onClick={onClick} style={{
      background: 'var(--navy-light)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden', cursor: 'pointer',
      transition: 'transform 0.15s, border-color 0.2s',
    }}
      onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-2px)'; d.style.borderColor = 'rgba(201,168,76,0.45)' }}
      onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.borderColor = 'var(--border)' }}
    >
      <div style={{ height: 150, background: 'var(--navy-surf)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {wine.image_base64
          ? <img src={'data:image/jpeg;base64,' + wine.image_base64} alt={wine.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 36, opacity: 0.3 }}>🍷</span>}
        <div style={{ position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: '50%', background: tc.dot, boxShadow: '0 0 6px ' + tc.dot + '88' }} />
        {hasMissing && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(201,168,76,0.85)', borderRadius: 'var(--r-full)', padding: '2px 7px' }}>
            <span style={{ fontSize: 9, color: 'var(--navy)', fontWeight: 700 }}>EDIT</span>
          </div>
        )}
      </div>
      <div style={{ padding: '10px 11px' }}>
        <div className="serif" style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.3, marginBottom: 4 }}>{wine.name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>{[wine.winery, wine.vintage].filter(Boolean).join(' · ') || 'Unknown'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {topScore
            ? <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--gold-dim)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 'var(--r-full)', border: '1px solid rgba(201,168,76,0.3)' }}>{topScore} pts</span>
            : <span />}
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{wine.qty} btl</span>
        </div>
      </div>
    </div>
  )
}

export default function CellarPage() {
  const { wines, loading } = useWines()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showImport, setShowImport] = useState(false)

  const totalBottles = wines.reduce((s, w) => s + w.qty, 0)
  const ninetyPlus = wines.filter(w => (w.reviews?.[0]?.score ?? 0) >= 90).length
  const missingFields = wines.filter(w => !w.body || !w.sweetness || !w.varietal).length
  const initials = user?.user_metadata?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    ?? user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ padding: 'max(env(safe-area-inset-top), 16px) 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 className="serif" style={{ fontSize: 26, color: 'var(--gold)', fontStyle: 'italic', fontWeight: 300 }}>Cellar</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowImport(true)} style={{ fontSize: 12 }}>
            ⬆ Import
          </button>
          {user
            ? <div onClick={signOut} title="Sign out" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--navy)', cursor: 'pointer' }}>{initials}</div>
            : <button className="btn btn-outline btn-sm" onClick={() => navigate('/auth')}>Sign In</button>}
        </div>
      </div>

      <div className="screen" style={{ padding: '0 0 100px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : wines.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 30px', textAlign: 'center', gap: 16 }}>
            <div style={{ fontSize: 56, opacity: 0.4 }}>🍷</div>
            <h2 className="serif" style={{ fontSize: 24, color: 'var(--text)' }}>Your cellar awaits</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              Scan a label to add your first wine, or import from CellarTracker, InVintory, or Vivino.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigate('/add')}>Add Wine</button>
              <button className="btn btn-outline" onClick={() => setShowImport(true)}>Import Collection</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 20px 12px' }}>
              <h2 className="serif" style={{ fontSize: 20, color: 'var(--text)' }}>My Cellar</h2>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{wines.length} wines · {totalBottles} bottles</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 20px 16px' }}>
              {[['Wines', wines.length], ['Bottles', totalBottles], ['90+ pts', ninetyPlus]].map(([label, val]) => (
                <div key={label as string} style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 0', textAlign: 'center' }}>
                  <div className="serif" style={{ fontSize: 22, color: 'var(--gold)' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Missing fields nudge */}
            {missingFields > 0 && (
              <div style={{ margin: '0 20px 16px', background: 'rgba(201,168,76,0.07)', borderRadius: 'var(--r-md)', padding: '10px 14px', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--gold)', lineHeight: 1.5 }}>
                  ✦ {missingFields} wine{missingFields > 1 ? 's' : ''} missing details — tap to edit for better recommendations
                </p>
              </div>
            )}

            {/* Wine grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 14px' }}>
              {wines.map(w => (
                <WineCard key={w.id} wine={w} onClick={() => navigate('/wine/' + w.id)} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); window.location.reload() }}
        />
      )}
    </div>
  )
}
