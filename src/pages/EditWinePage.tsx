import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWines } from '../hooks/useWines'
import toast from 'react-hot-toast'

const WINE_TYPES = ['red', 'white', 'rose', 'sparkling', 'dessert']
const BODY_OPTIONS = ['light', 'medium', 'full']
const SWEETNESS_OPTIONS = ['dry', 'off-dry', 'sweet']
const FLAVOR_SUGGESTIONS = [
  'cherry', 'blackberry', 'raspberry', 'plum', 'currant',
  'vanilla', 'oak', 'cedar', 'tobacco', 'leather',
  'citrus', 'apple', 'pear', 'peach', 'apricot',
  'floral', 'honey', 'mineral', 'earthy', 'spice',
  'chocolate', 'coffee', 'pepper', 'herb', 'toast'
]

function SelectRow({ label, value, options, onChange, missing }: {
  label: string
  value: string | null
  options: string[]
  onChange: (v: string) => void
  missing?: boolean
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
        {missing && <span style={{ fontSize: 9, background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', padding: '2px 7px', borderRadius: 'var(--r-full)', border: '1px solid rgba(201,168,76,0.4)' }}>MISSING</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '7px 14px', borderRadius: 'var(--r-full)', border: '1px solid',
              borderColor: value === opt ? 'var(--gold)' : 'var(--border)',
              background: value === opt ? 'rgba(201,168,76,0.15)' : 'var(--navy-light)',
              color: value === opt ? 'var(--gold)' : 'var(--text-dim)',
              fontSize: 12, fontWeight: value === opt ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function InputRow({ label, value, onChange, placeholder, missing }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  missing?: boolean
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
        {missing && <span style={{ fontSize: 9, background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', padding: '2px 7px', borderRadius: 'var(--r-full)', border: '1px solid rgba(201,168,76,0.4)' }}>MISSING</span>}
      </div>
      <input
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Enter ' + label.toLowerCase()}
      />
    </div>
  )
}

export default function EditWinePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { wines, updateWine } = useWines()
  const wine = wines.find(w => w.id === id)

  const [form, setForm] = useState({
    name: wine?.name ?? '',
    winery: wine?.winery ?? '',
    vintage: wine?.vintage ?? '',
    varietal: wine?.varietal ?? '',
    region: wine?.region ?? '',
    country: wine?.country ?? '',
    type: wine?.type ?? '',
    body: wine?.body ?? '',
    sweetness: wine?.sweetness ?? '',
    description: wine?.description ?? '',
    flavor_profile: wine?.flavor_profile ?? [],
  })
  const [saving, setSaving] = useState(false)

  if (!wine) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
      <p>Wine not found.</p>
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/')} style={{ marginTop: 16 }}>← Back</button>
    </div>
  )

  const set = (key: string) => (val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const toggleFlavor = (flavor: string) => {
    setForm(prev => ({
      ...prev,
      flavor_profile: prev.flavor_profile.includes(flavor)
        ? prev.flavor_profile.filter(f => f !== flavor)
        : [...prev.flavor_profile, flavor]
    }))
  }

  const missingFields = [
    !form.type && 'type',
    !form.body && 'body',
    !form.sweetness && 'sweetness',
    !form.varietal && 'varietal',
    !form.region && 'region',
    !form.vintage && 'vintage',
  ].filter(Boolean)

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Wine name is required'); return }
    setSaving(true)
    try {
      await updateWine(wine.id, {
        name: form.name.trim(),
        winery: form.winery.trim() || null,
        vintage: form.vintage.trim() || null,
        varietal: form.varietal.trim() || null,
        region: form.region.trim() || null,
        country: form.country.trim() || null,
        type: form.type as any || 'red',
        body: form.body as any || null,
        sweetness: form.sweetness as any || null,
        description: form.description.trim() || null,
        flavor_profile: form.flavor_profile.length > 0 ? form.flavor_profile : null,
      })
      toast.success('Wine updated!')
      navigate('/wine/' + wine.id)
    } catch (e: any) {
      toast.error(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: 'max(env(safe-area-inset-top), 14px) 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/wine/' + wine.id)} style={{ padding: '6px 0', fontSize: 24, lineHeight: 1 }}>‹</button>
          <div>
            <h1 className="serif" style={{ fontSize: 18, color: 'var(--text)', fontWeight: 400 }}>Edit Wine</h1>
            {missingFields.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--gold)' }}>{missingFields.length} field{missingFields.length > 1 ? 's' : ''} missing</p>
            )}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" /> : 'Save'}
        </button>
      </div>

      {/* Missing fields banner */}
      {missingFields.length > 0 && (
        <div style={{ background: 'rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.2)', padding: '10px 20px', flexShrink: 0 }}>
          <p style={{ fontSize: 12, color: 'var(--gold)' }}>
            ✦ Fill in missing fields to get better sommelier recommendations
          </p>
        </div>
      )}

      {/* Scrollable form */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, padding: '20px 20px 100px' }}>

        {/* Wine image preview */}
        {wine.image_base64 && (
          <img
            src={'data:image/jpeg;base64,' + wine.image_base64}
            alt={wine.name}
            style={{ width: '100%', height: 160, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--navy-surf)', marginBottom: 20 }}
          />
        )}

        <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 14 }}>✦ BASIC INFO</div>
          <InputRow label="Wine Name" value={form.name} onChange={set('name')} missing={!form.name} />
          <InputRow label="Winery / Producer" value={form.winery} onChange={set('winery')} missing={!form.winery} />
          <InputRow label="Vintage" value={form.vintage} onChange={set('vintage')} placeholder="e.g. 2021" missing={!form.vintage} />
          <InputRow label="Varietal" value={form.varietal} onChange={set('varietal')} placeholder="e.g. Cabernet Sauvignon" missing={!form.varietal} />
          <InputRow label="Region" value={form.region} onChange={set('region')} placeholder="e.g. Napa Valley" missing={!form.region} />
          <InputRow label="Country" value={form.country} onChange={set('country')} placeholder="e.g. United States" missing={!form.country} />
        </div>

        <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 14 }}>✦ WINE STYLE</div>
          <SelectRow label="Type" value={form.type} options={WINE_TYPES} onChange={set('type')} missing={!form.type} />
          <SelectRow label="Body" value={form.body} options={BODY_OPTIONS} onChange={set('body')} missing={!form.body} />
          <SelectRow label="Sweetness" value={form.sweetness} options={SWEETNESS_OPTIONS} onChange={set('sweetness')} missing={!form.sweetness} />
        </div>

        <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 16, border: '1px solid var(--border)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 14 }}>✦ TASTING NOTES</div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
              Flavor Profile
              {form.flavor_profile.length === 0 && (
                <span style={{ fontSize: 9, background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', padding: '2px 7px', borderRadius: 'var(--r-full)', border: '1px solid rgba(201,168,76,0.4)', marginLeft: 8 }}>MISSING</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {FLAVOR_SUGGESTIONS.map(f => (
                <button
                  key={f}
                  onClick={() => toggleFlavor(f)}
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--r-full)', border: '1px solid',
                    borderColor: form.flavor_profile.includes(f) ? 'var(--gold)' : 'var(--border)',
                    background: form.flavor_profile.includes(f) ? 'rgba(201,168,76,0.15)' : 'transparent',
                    color: form.flavor_profile.includes(f) ? 'var(--gold)' : 'var(--text-dim)',
                    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {form.flavor_profile.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--gold)', marginTop: 10 }}>
                Selected: {form.flavor_profile.join(', ')}
              </p>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Tasting Notes</div>
            <textarea
              className="input"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the wine's taste, aroma, and finish..."
              rows={3}
              style={{ resize: 'none', lineHeight: 1.5 }}
            />
          </div>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
          {saving ? <><span className="spinner" />&nbsp;Saving...</> : '💾 Save Changes'}
        </button>
      </div>
    </div>
  )
}
