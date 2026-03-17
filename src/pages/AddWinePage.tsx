import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWines } from '../hooks/useWines'
import { useAuth } from '../hooks/useAuth'
import { extractLabel, fetchReviews } from '../lib/api'
import toast from 'react-hot-toast'

type Step = 'upload' | 'preview' | 'extracted' | 'reviewed'
const STEPS = [
  { key: 'upload', label: 'Photo' },
  { key: 'preview', label: 'Analyze' },
  { key: 'extracted', label: 'Details' },
  { key: 'reviewed', label: 'Save' },
]

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  )
}

export default function AddWinePage() {
  const navigate = useNavigate()
  const { addWine } = useWines()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg')
  const [extracted, setExtracted] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [fetchingReviews, setFetchingReviews] = useState(false)

  const stepIdx = STEPS.findIndex(s => s.key === step)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      const b64 = result.split(',')[1]
      const mime = result.split(';')[0].split(':')[1]
      setImageBase64(b64)
      setImageMimeType(mime)
      setStep('preview')
    }
    reader.readAsDataURL(file)
  }

  const analyzeLabel = async () => {
    if (!imageBase64) return
    setLoading(true)
    setLoadingMsg('Reading label with AI...')
    try {
      const data = await extractLabel(imageBase64, imageMimeType)
      setExtracted(data)
      setStep('extracted')
    } catch (e: any) {
      toast.error(e.message || 'Could not read label. Try a clearer photo.')
    }
    setLoading(false)
  }

  const handleFetchReviews = async () => {
    if (!extracted) return
    setFetchingReviews(true)
    try {
      const r = await fetchReviews(extracted)
      setReviews(r)
      setStep('reviewed')
    } catch {
      setReviews([])
      setStep('reviewed')
    }
    setFetchingReviews(false)
  }

  const saveWine = async (withReviews = false) => {
    if (!extracted) return
    setLoading(true)
    setLoadingMsg('Saving to your cellar...')
    try {
      await addWine({
        id: crypto.randomUUID(),
        user_id: user?.id ?? 'guest',
        name: extracted.name ?? 'Unknown Wine',
        winery: extracted.winery ?? null,
        vintage: extracted.vintage ?? null,
        varietal: extracted.varietal ?? null,
        region: extracted.region ?? null,
        country: extracted.country ?? null,
        type: extracted.type ?? 'red',
        body: extracted.body ?? null,
        sweetness: extracted.sweetness ?? null,
        flavor_profile: extracted.flavorProfile ?? null,
        description: extracted.description ?? null,
        reviews: withReviews ? reviews : [],
        qty: 1,
        image_url: null,
        image_base64: imageBase64,
        date_added: new Date().toISOString(),
      } as any)
      navigate('/')
    } catch (e: any) {
      toast.error(e.message || 'Failed to save wine.')
    }
    setLoading(false)
  }

  const reset = () => {
    setStep('upload')
    setImageBase64(null)
    setExtracted(null)
    setReviews([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{ padding: '6px 0', fontSize: 24, lineHeight: 1 }}>‹</button>
        <h1 className="serif" style={{ fontSize: 20, color: 'var(--text)', fontWeight: 400 }}>Add a Wine</h1>
      </div>

      {/* Step indicator */}
      <div className="steps" style={{ flexShrink: 0 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div className={`step-dot ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`}>
                {i < stepIdx ? '✓' : i + 1}
              </div>
              <span className={`step-label ${i <= stepIdx ? 'active' : ''}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`step-line ${i < stepIdx ? 'done' : ''}`} style={{ flex: 1, margin: '0 6px', marginBottom: 18 }} />
            )}
          </div>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, padding: '20px 20px 120px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* UPLOAD */}
        {step === 'upload' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ background: 'var(--navy-light)', border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)', padding: '50px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--gold)'; d.style.background = 'rgba(201,168,76,0.04)' }}
              onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--border)'; d.style.background = 'var(--navy-light)' }}
            >
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.6 }}>📷</div>
              <p className="serif" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Photograph a Label</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>Tap to take a photo or upload from your library</p>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        {step === 'preview' && imageBase64 && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <img
              src={`data:${imageMimeType};base64,${imageBase64}`}
              alt="Label preview"
              style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--navy-surf)' }}
            />
            <button className="btn btn-primary btn-full" onClick={analyzeLabel} disabled={loading}>
              {loading ? <><span className="spinner" />&nbsp;{loadingMsg}</> : '✦ Analyze Label with AI'}
            </button>
            <button className="btn btn-outline btn-full" onClick={reset}>Retake Photo</button>
          </div>
        )}

        {/* EXTRACTED — details + two options */}
        {step === 'extracted' && extracted && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {imageBase64 && (
              <img
                src={`data:${imageMimeType};base64,${imageBase64}`}
                alt="Label"
                style={{ width: '100%', height: 160, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--navy-surf)' }}
              />
            )}

            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>✦ LABEL READ</div>
              <FieldRow label="Wine" value={extracted.name} />
              <FieldRow label="Winery" value={extracted.winery} />
              <FieldRow label="Vintage" value={extracted.vintage} />
              <FieldRow label="Varietal" value={extracted.varietal} />
              <FieldRow label="Region" value={[extracted.region, extracted.country].filter(Boolean).join(', ')} />
              <FieldRow label="Type" value={extracted.type} />
              <FieldRow label="Body" value={extracted.body} />
              <FieldRow label="Sweetness" value={extracted.sweetness} />
              {extracted.flavorProfile?.length > 0 && (
                <FieldRow label="Flavors" value={extracted.flavorProfile.join(' · ')} />
              )}
            </div>

            <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 16, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, textAlign: 'center' }}>
                What would you like to do?
              </p>
              <button
                className="btn btn-primary btn-full"
                onClick={() => saveWine(false)}
                disabled={loading}
                style={{ marginBottom: 10 }}
              >
                {loading ? <><span className="spinner" />&nbsp;{loadingMsg}</> : '🍷 Add to Cellar Now'}
              </button>
              <button
                className="btn btn-outline btn-full"
                onClick={handleFetchReviews}
                disabled={fetchingReviews}
              >
                {fetchingReviews ? <><span className="spinner" />&nbsp;Searching reviews...</> : '🔍 Find Reviews First'}
              </button>
            </div>
          </div>
        )}

        {/* REVIEWED — reviews + save */}
        {step === 'reviewed' && extracted && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {imageBase64 && (
              <img
                src={`data:${imageMimeType};base64,${imageBase64}`}
                alt="Label"
                style={{ width: '100%', height: 160, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--navy-surf)' }}
              />
            )}

            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>✦ LABEL READ</div>
              <FieldRow label="Wine" value={extracted.name} />
              <FieldRow label="Winery" value={extracted.winery} />
              <FieldRow label="Vintage" value={extracted.vintage} />
              <FieldRow label="Varietal" value={extracted.varietal} />
              <FieldRow label="Type" value={extracted.type} />
            </div>

            {reviews.length > 0 && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 2 }}>✦ CRITICAL REVIEWS</div>
                {reviews.map((r, i) => (
                  <div key={i} style={{ background: 'var(--navy-surf)', borderRadius: 'var(--r-sm)', padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.6 }}>{r.source}</span>
                      {r.score && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                          <span className="serif" style={{ fontSize: 22, color: 'var(--text)' }}>{r.score}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>/100</span>
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, fontStyle: 'italic' }}>"{r.quote}"</p>
                  </div>
                ))}
              </div>
            )}

            {reviews.length === 0 && (
              <p style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-dim)', fontSize: 13 }}>
                No reviews found for this wine.
              </p>
            )}

            <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 16, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, textAlign: 'center' }}>
                Ready to add <strong style={{ color: 'var(--text)' }}>{extracted.name}</strong> to your cellar?
              </p>
              <button
                className="btn btn-primary btn-full"
                onClick={() => saveWine(true)}
                disabled={loading}
              >
                {loading ? <><span className="spinner" />&nbsp;{loadingMsg}</> : '🍷 Add to Cellar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
