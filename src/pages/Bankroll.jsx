import { useEffect, useState } from 'react'
import { getBankrollHistory, addBankrollSnapshot } from '../lib/db'

export default function Bankroll() {
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [balance, setBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBankrollHistory().then(setSnapshots).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!balance) return
    setSaving(true)
    try {
      const snap = await addBankrollSnapshot(Number(balance), notes)
      setSnapshots(prev => [...prev, snap])
      setBalance('')
      setNotes('')
      setShowForm(false)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const latest = snapshots[snapshots.length - 1]
  const first = snapshots[0]
  const totalChange = latest && first ? Number(latest.balance) - Number(first.balance) : 0

  const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', outline: 'none' }
  const btnPrimary = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }
  const btnGhost = { background: 'transparent', color: '#888', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }

  if (loading) return <div style={{ color: '#aaa', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.4px', marginBottom: '4px' }}>Bankroll</h1>
          <p style={{ fontSize: '13px', color: '#aaa' }}>Track your balance over time</p>
        </div>
        <button style={btnPrimary} onClick={() => setShowForm(true)}>+ Log balance</button>
      </div>

      {latest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Current balance', value: `$${Number(latest.balance).toFixed(2)}`, color: '#1a1a1a' },
            { label: 'Starting balance', value: `$${Number(first.balance).toFixed(2)}`, color: '#1a1a1a' },
            { label: 'Total change', value: `${totalChange >= 0 ? '+' : ''}$${totalChange.toFixed(2)}`, color: totalChange >= 0 ? '#16a34a' : '#dc2626' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '20px 22px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', fontWeight: '600' }}>{label}</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color, letterSpacing: '-0.5px' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '20px' }}>Log balance</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance ($) *</label>
              <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="e.g. 500" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. after UFC 329" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => { setShowForm(false); setBalance(''); setNotes('') }} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {snapshots.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>No balance logs yet</div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>Log your starting bankroll to begin tracking</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...snapshots].reverse().map((snap, i) => {
            const prev = snapshots[snapshots.length - 2 - i]
            const change = prev ? Number(snap.balance) - Number(prev.balance) : null
            return (
              <div key={snap.id} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '2px' }}>${Number(snap.balance).toFixed(2)}</div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    {new Date(snap.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {snap.notes && ` · ${snap.notes}`}
                  </div>
                </div>
                {change !== null && (
                  <div style={{ fontSize: '14px', fontWeight: '700', color: change >= 0 ? '#16a34a' : '#dc2626' }}>
                    {change >= 0 ? '+' : ''}${change.toFixed(2)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}