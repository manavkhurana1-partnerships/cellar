import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useWines } from '../hooks/useWines'
import { WINE_TYPE_COLORS } from '../types'
import toast from 'react-hot-toast'

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  )
}

export default function DetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as any)?.from ?? '/'
  const { wines, updateWine, deleteWine } = useWines()
  const wine = wines.find(w => w.id === id)

  if (!wine) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
      <p>Wine not found.</p>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/')} style={{ marginTop: 16 }}>← Back</button>
    </div>
  )

  const tc = WINE_TYPE_COLORS[wine.type] ?? WINE_TYPE_COLORS.red
  const topScore = wine.reviews?.[0]?.score

  const handleDelete = () => {
    if (!confirm(`Remove "${wine.name}" from your cellar?`)) return
    deleteWine(wine.id).then(() => navigate('/'))
  }

  const adjustQty = async (delta: number) => {
    const newQty = Math.max(0, wine.qty + delta)
    if (newQty === 0) { handleDelete(); return }
    await updateWine(wine.id, { qty: newQty })
    toast.success(`Updated to ${newQty} bottles`)
  }

  return (
    <div style={{ minHeight: '100%' }}>
      {/* Hero */}
      <div style={{ position: 'relative', height: 260, background: 'var(--navy-surf)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {wine.image_base64
          ? <img src={`data:image/jpeg;base64,${wine.image_base64}`} alt={wine.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 72, opacity: 0.2 }}>🍷</span>}
          <button onClick={() => navigate(from)} style={{
            position: 'absolute', top: 16, left: 16, width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(13,27,42,0.8)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 22, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
        <button
  onClick={() => navigate('/wine/' + wine.id + '/edit')}
  style={{
    position: 'absolute', top: 16, right: 16, background: 'rgba(13,27,42,0.8)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-full)',
    color: 'var(--gold)', fontSize: 12, fontWeight: 600,
    padding: '7px 14px', cursor: 'pointer', backdropFilter: 'blur(8px)',
  }}
>
  Edit
</button>
        {topScore && (
          <div style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(13,27,42,0.88)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 14px', textAlign: 'center' }}>
            <div className="serif" style={{ fontSize: 26, color: 'var(--gold)', lineHeight: 1 }}>{topScore}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>pts</div>
          </div>
        )}
      </div>

      <div className="fade-up" style={{ padding: 20, paddingBottom: 100 }}>
        <div style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 'var(--r-full)', background: tc.bg, border: `1px solid ${tc.text}55`, marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: tc.text, textTransform: 'uppercase', letterSpacing: 0.8 }}>{wine.type}</span>
        </div>
        <h1 className="serif" style={{ fontSize: 28, color: 'var(--text)', lineHeight: 1.2, marginBottom: 6 }}>{wine.name}</h1>
        {wine.winery && <p style={{ fontSize: 15, color: 'var(--gold)', marginBottom: 4 }}>{wine.winery}</p>}
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>{[wine.region, wine.country, wine.vintage].filter(Boolean).join(' · ')}</p>

        {/* Qty */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, background: 'var(--navy-light)', borderRadius: 'var(--r-md)', padding: '12px 16px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Bottles in cellar</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {[['−', -1], ['+', 1]].map(([label, delta]) => (
              <button key={label as string} onClick={() => adjustQty(delta as number)} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {label}
              </button>
            )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key="num" className="serif" style={{ fontSize: 22, color: 'var(--text)', minWidth: 28, textAlign: 'center' }}>{wine.qty}</span>, el], [] as any[])}
          </div>
        </div>

        <div className="divider" />

        <div className="card" style={{ marginBottom: 16 }}>
          <FieldRow label="Varietal" value={wine.varietal} />
          <FieldRow label="Body" value={wine.body} />
          <FieldRow label="Sweetness" value={wine.sweetness} />
          <FieldRow label="Flavors" value={wine.flavor_profile?.join(' · ')} />
          <FieldRow label="Notes" value={wine.description} />
        </div>

        {wine.reviews && wine.reviews.length > 0 && (
          <>
            <h3 className="serif" style={{ fontSize: 16, color: 'var(--text)', marginBottom: 10 }}>Critical Reviews</h3>
            {wine.reviews.map((r, i) => (
              <div key={i} style={{ background: 'var(--navy-surf)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.7 }}>{r.source}</span>
                  {r.score && <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span className="serif" style={{ fontSize: 24, color: 'var(--text)' }}>{r.score}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>/100</span>
                  </div>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, fontStyle: 'italic' }}>"{r.quote}"</p>
              </div>
            ))}
          </>
        )}

        <button className="btn btn-danger btn-sm" onClick={handleDelete} style={{ marginTop: 24 }}>Remove from Cellar</button>
      </div>
    </div>
  )
}
