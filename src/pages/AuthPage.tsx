import { useState } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (tab === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        })
        if (error) throw error
        toast.success('Account created! Check your email to confirm.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('Welcome back!')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  const handleMagicLink = async () => {
    if (!email) { toast.error('Enter your email first'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) toast.error(error.message)
    else setMagicSent(true)
    setLoading(false)
  }

  if (magicSent) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 360, width: '100%', textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
        <h2 className="serif" style={{ fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>
          Check your inbox
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Magic link sent to{' '}
          <strong style={{ color: 'var(--gold)' }}>{email}</strong>.
          Click it to sign in.
        </p>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setMagicSent(false)}
          style={{ marginTop: 20 }}
        >
          Try again
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🍷</div>
          <h1
            className="serif"
            style={{ fontSize: 36, color: 'var(--gold)', fontStyle: 'italic', fontWeight: 300 }}
          >
            Cellar
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
            Your AI-powered wine collection
          </p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div style={{
            display: 'flex', background: 'var(--navy)',
            borderRadius: 'var(--r-md)', padding: 3, marginBottom: 24, gap: 3
          }}>
            {(['signin', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 'var(--r-sm)',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit', transition: 'all 0.2s',
                  background: tab === t ? 'var(--gold)' : 'transparent',
                  color: tab === t ? 'var(--navy)' : 'var(--text-dim)',
                }}
              >
                {t === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'signup' && (
              <input
                className="input"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            )}
            <input
              className="input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading
                ? <span className="spinner" />
                : tab === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>or</span>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
          </div>

          <button
            className="btn btn-outline btn-full"
            onClick={handleMagicLink}
            disabled={loading}
          >
            ✉️ &nbsp;Send Magic Link
          </button>
        </div>

      </div>
    </div>
  )
}