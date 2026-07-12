import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Account created! Signing you in...')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: '#0d0d0d',
    border: '1px solid #1a1a1a',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#e0e0e0',
    outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '340px' }}>
        <div style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#e0e0e0', letterSpacing: '-0.3px', marginBottom: '4px' }}>MMA Bets</div>
          <div style={{ fontSize: '12px', color: '#2e2e2e' }}>{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#333', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#333', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
          </div>

          {error && <div style={{ fontSize: '12px', color: '#f87171' }}>{error}</div>}
          {message && <div style={{ fontSize: '12px', color: '#4ade80' }}>{message}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#e0e0e0', color: '#0a0a0a', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '13px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, marginTop: '4px' }}
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#2a2a2a' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}