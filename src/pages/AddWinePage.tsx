import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWines } from '../hooks/useWines'
import { useAuth } from '../hooks/useAuth'
import { extractLabel, fetchReviews, lookupUPC } from '../lib/api'
import toast from 'react-hot-toast'

type Step = 'upload' | 'preview' | 'extracted' | 'reviewed'
type ScanMode = 'label' | 'barcode'

const STEPS = [
  { key: 'upload', label: 'Scan' },
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [scanMode, setScanMode] = useState<ScanMode>('label')
  const [step, setStep] = useState<Step>('upload')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg')
  const [upcInput, setUpcInput] = useState('')
  const [extracted, setExtracted] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [fetchingReviews, setFetchingReviews] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scanning, setScanning] = useState(false)

  // Clean up camera on unmount
  useEffect(() => {
    return () => { stopCamera() }
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setScanning(false)
  }

 const startBarcodeCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
    setCameraActive(true)
    setScanning(true)
  } catch (e) {
    toast.error('Camera access denied. Please type the barcode number manually.')
  }
}

const captureAndDecodeBarcode = async () => {
  if (!videoRef.current) return
  const canvas = document.createElement('canvas')
  canvas.width = videoRef.current.videoWidth
  canvas.height = videoRef.current.videoHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(videoRef.current, 0, 0)

  // Load ZXing
  if (!(window as any).ZXing) {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.19.1/umd/index.min.js'
    await new Promise<void>(r => { script.onload = () => r(); document.head.appendChild(script) })
  }

  try {
    const ZXing = (window as any).ZXing
    const reader = new ZXing.BrowserMultiFormatReader()
    const result = await reader.decodeFromCanvas(canvas)
    if (result?.text) {
      stopCamera()
      setUpcInput(result.text)
      handleUPCLookup(result.text)
    } else {
      toast.error('No barcode detected. Try holding still and tapping Scan again.')
    }
  } catch {
    toast.error('No barcode found. Move closer and tap Scan again.')
  }
}

    const Quagga = (window as any).Quagga
    if (!Quagga || !videoRef.current) return

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: videoRef.current,
        constraints: { facingMode: 'environment' }
      },
      decoder: {
        readers: ['ean_reader', 'upc_reader', 'upc_e_reader', 'ean_8_reader']
      },
      locate: true,
    }, (err: any) => {
      if (err) {
        toast.error('Barcode scanner failed. Please type the number manually.')
        stopCamera()
        return
      }
      Quagga.start()
    })

    Quagga.onDetected((result: any) => {
      const code = result?.codeResult?.code
      if (code && code.length >= 8) {
        Quagga.stop()
        stopCamera()
        setUpcInput(code)
        handleUPCLookup(code)
      }
    })
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      setImageBase64(result.split(',')[1])
      setImageMimeType(result.split(';')[0].split(':')[1])
      setStep('preview')
    }
    reader.readAsDataURL(file)
  }

  const analyzeLabel = async () => {
    if (!imageBase64) return
    setLoading(true)
    try {
      const data = await extractLabel(imageBase64, imageMimeType, msg => setLoadingMsg(msg))
      setExtracted(data)
      setStep('extracted')
    } catch (e: any) {
      toast.error(e.message || 'Could not read label. Try a clearer photo.')
    }
    setLoading(false)
    setLoadingMsg('')
  }

  const handleUPCLookup = async (code?: string) => {
    const upc = (code ?? upcInput).trim()
    if (!upc) { toast.error('Enter a barcode number'); return }
    setLoading(true)
    setLoadingMsg('Looking up wine...')
    try {
      const data = await lookupUPC(upc)
      setExtracted(data)
      setStep('extracted')
    } catch (e: any) {
      toast.error(e.message || 'Could not find wine. Try scanning the label instead.')
    }
    setLoading(false)
    setLoadingMsg('')
  }

  const handleFetchReviews = async () => {
    if (!extracted) return
    setFetchingReviews(true)
    try {
      setReviews(await fetchReviews(extracted))
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
    stopCamera()
    setStep('upload')
    setImageBase64(null)
    setExtracted(null)
    setReviews([])
    setUpcInput('')
    setScanMode('label')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { reset(); navigate('/') }} style={{ padding: '6px 0', fontSize: 24, lineHeight: 1 }}>‹</button>
        <h1 className="serif" style={{ fontSize: 20, color: 'var(--text)', fontWeight: 400 }}>Add a Wine</h1>
      </div>

      {/* Step indicator */}
      <div className="steps" style={{ flexShrink: 0 }}>
        {STEPS.map((s, i) => {
          const stepIdx = STEPS.findIndex(st => st.key === step)
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div className={'step-dot' + (i < stepIdx ? ' done' : i === stepIdx ? ' active' : '')}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span className={'step-label' + (i <= stepIdx ? ' active' : '')}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={'step-line' + (i < stepIdx ? ' done' : '')} style={{ flex: 1, margin: '0 6px', marginBottom: 18 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any, padding: '20px 20px 120px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* UPLOAD */}
        {step === 'upload' && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Mode toggle */}
            <div style={{ display: 'flex', background: 'var(--navy-light)', borderRadius: 'var(--r-md)', padding: 3, gap: 3 }}>
              {(['label', 'barcode'] as ScanMode[]).map(mode => (
                <button key={mode} onClick={() => { setScanMode(mode); stopCamera() }} style={{
                  flex: 1, padding: '9px 0', borderRadius: 'var(--r-sm)', border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  background: scanMode === mode ? 'var(--gold)' : 'transparent',
                  color: scanMode === mode ? 'var(--navy)' : 'var(--text-dim)',
                }}>
                  {mode === 'label' ? '📷 Scan Label' : '📦 Scan Barcode'}
                </button>
              ))}
            </div>

            {/* Label scan */}
            {scanMode === 'label' && (
              <div
                onClick={() => fileRef.current?.click()}
                style={{ background: 'var(--navy-light)', border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)', padding: '44px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--gold)'; d.style.background = 'rgba(201,168,76,0.04)' }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--border)'; d.style.background = 'var(--navy-light)' }}
              >
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.6 }}>📷</div>
                <p className="serif" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Photograph a Label</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  Free OCR reads the label text, then AI structures the wine data
                </p>
              </div>
            )}

            {/* Barcode scan */}
            {scanMode === 'barcode' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Live camera viewfinder */}
                {!cameraActive && (
                  <div
                    onClick={startBarcodeCamera}
                    style={{ background: 'var(--navy-light)', border: '2px dashed var(--border)', borderRadius: 'var(--r-lg)', padding: '44px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--gold)'; d.style.background = 'rgba(201,168,76,0.04)' }}
                    onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'var(--border)'; d.style.background = 'var(--navy-light)' }}
                  >
                    <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.6 }}>📦</div>
                    <p className="serif" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Scan Barcode</p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                      Tap to open camera and point at the UPC barcode on the bottle
                    </p>
                  </div>
                )}

                {/* Camera viewfinder */}
                {cameraActive && (
                  <div style={{ position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', background: '#000' }}>
                    <video
                      ref={videoRef}
                      style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
                      playsInline
                      muted
                    />
                    {/* Barcode aim guide */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ width: '70%', height: 80, border: '2px solid var(--gold)', borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 16px', background: 'rgba(0,0,0,0.6)', textAlign: 'center' }}>
                    <button
  onClick={captureAndDecodeBarcode}
  style={{ background: 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 'var(--r-full)', padding: '8px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
>
  📸 Scan Barcode
</button>
                    </div>
                    <button
                      onClick={stopCamera}
                      style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border)', borderRadius: 'var(--r-full)', color: 'var(--text)', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="divider" style={{ flex: 1, margin: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>or type it manually</span>
                  <div className="divider" style={{ flex: 1, margin: 0 }} />
                </div>

                {/* Manual UPC input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Enter UPC barcode number..."
                    value={upcInput}
                    onChange={e => setUpcInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUPCLookup()}
                    style={{ flex: 1 }}
                    inputMode="numeric"
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => handleUPCLookup()}
                    disabled={loading || !upcInput.trim()}
                  >
                    {loading ? <span className="spinner" /> : 'Look up'}
                  </button>
                </div>

                {loading && loadingMsg && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--gold)', fontStyle: 'italic' }}>{loadingMsg}</p>
                )}

                <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-md)', padding: 12, border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    💡 The UPC barcode is the black-and-white striped barcode on the back or bottom of the bottle. Most wine barcodes start with 0 and are 12 digits long.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PREVIEW */}
        {step === 'preview' && imageBase64 && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <img
              src={'data:' + imageMimeType + ';base64,' + imageBase64}
              alt="Label preview"
              style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--navy-surf)' }}
            />
            {loading ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: 12, color: 'var(--gold)', fontStyle: 'italic' }}>{loadingMsg}</p>
              </div>
            ) : (
              <>
                <button className="btn btn-primary btn-full" onClick={analyzeLabel}>
                  ✦ Analyze Label
                </button>
                <button className="btn btn-outline btn-full" onClick={reset}>Retake Photo</button>
              </>
            )}
          </div>
        )}

        {/* EXTRACTED */}
        {step === 'extracted' && extracted && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {imageBase64 && (
              <img
                src={'data:' + imageMimeType + ';base64,' + imageBase64}
                alt="Label"
                style={{ width: '100%', height: 160, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--navy-surf)' }}
              />
            )}
            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>✦ WINE IDENTIFIED</div>
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
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, textAlign: 'center' }}>What would you like to do?</p>
              <button className="btn btn-primary btn-full" onClick={() => saveWine(false)} disabled={loading} style={{ marginBottom: 10 }}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><span className="spinner" />{loadingMsg}</span> : '🍷 Add to Cellar Now'}
              </button>
              <button className="btn btn-outline btn-full" onClick={handleFetchReviews} disabled={fetchingReviews}>
                {fetchingReviews ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><span className="spinner" />Searching reviews...</span> : '🔍 Find Reviews First'}
              </button>
            </div>
          </div>
        )}

        {/* REVIEWED */}
        {step === 'reviewed' && extracted && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {imageBase64 && (
              <img
                src={'data:' + imageMimeType + ';base64,' + imageBase64}
                alt="Label"
                style={{ width: '100%', height: 160, objectFit: 'contain', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--navy-surf)' }}
              />
            )}
            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: 0.8, marginBottom: 10 }}>✦ WINE IDENTIFIED</div>
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
              <p style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-dim)', fontSize: 13 }}>No reviews found for this wine.</p>
            )}
            <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--r-lg)', padding: 16, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, textAlign: 'center' }}>
                Ready to add <strong style={{ color: 'var(--text)' }}>{extracted.name}</strong> to your cellar?
              </p>
              <button className="btn btn-primary btn-full" onClick={() => saveWine(true)} disabled={loading}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}><span className="spinner" />{loadingMsg}</span> : '🍷 Add to Cellar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
