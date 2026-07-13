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
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '14px',
    color: '#1a1a1a',
    outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: '#fff', border: '1px solid #ebebeb', borderRadius: '16px', padding: '40px' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px', letterSpacing: '-0.3px' }}>MMA Bets</div>
          <div style={{ fontSize: '13px', color: '#aaa' }}>{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#1a1a1a'}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px', fontWeight: '500' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#1a1a1a'}
              onBlur={e => e.target.style.borderColor = '#e5e5e5'} />
          </div>

          {error && <div style={{ fontSize: '12px', color: '#e53e3e', background: '#fff5f5', padding: '8px 12px', borderRadius: '6px' }}>{error}</div>}
          {message && <div style={{ fontSize: '12px', color: '#38a169', background: '#f0fff4', padding: '8px 12px', borderRadius: '6px' }}>{message}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: '4px' }}
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#aaa' }}>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}
            style={{ background: 'none', border: 'none', color: '#1a1a1a', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}