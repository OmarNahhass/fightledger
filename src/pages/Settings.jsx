import { useEffect, useState } from 'react'
import { getUnitSize, setUnitSize, getDisplayName, updateDisplayName } from '../lib/db'
import { useAuth } from '../lib/AuthContext'

export default function Settings() {
  const { user } = useAuth()
  const [unitSize, setUnit] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingUnit, setSavingUnit] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savedUnit, setSavedUnit] = useState(false)
  const [savedName, setSavedName] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([getUnitSize(), getDisplayName(user.id)])
      .then(([u, name]) => { setUnit(String(u)); setDisplayName(name || user.email.split('@')[0]) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const handleSaveUnit = async () => {
    if (!unitSize || isNaN(unitSize)) return
    setSavingUnit(true)
    try { await setUnitSize(Number(unitSize)); setSavedUnit(true); setTimeout(() => setSavedUnit(false), 2000) }
    catch (err) { console.error(err) }
    finally { setSavingUnit(false) }
  }

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    try { await updateDisplayName(user.id, displayName.trim()); setSavedName(true); setTimeout(() => setSavedName(false), 2000) }
    catch (err) { console.error(err) }
    finally { setSavingName(false) }
  }

  const inputStyle = { background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', outline: 'none' }
  const btnPrimary = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }

  if (loading) return <div style={{ color: '#aaa', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.4px', marginBottom: '4px' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: '#aaa' }}>Configure your account</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}>
        {/* Display name */}
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>Display name</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '16px' }}>This is how you appear on the leaderboard.</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleSaveName} disabled={savingName} style={{ ...btnPrimary, opacity: savingName ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {savingName ? 'Saving...' : savedName ? 'Saved!' : 'Save'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#ccc', marginTop: '8px' }}>{user?.email}</div>
        </div>

        {/* Unit size */}
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' }}>Unit size</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '16px' }}>The dollar value of 1 unit. All bets are tracked in units based on this.</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '13px' }}>$</span>
              <input type="number" value={unitSize} onChange={e => setUnit(e.target.value)} style={{ ...inputStyle, paddingLeft: '24px', width: '120px' }} />
            </div>
            <button onClick={handleSaveUnit} disabled={savingUnit} style={{ ...btnPrimary, opacity: savingUnit ? 0.6 : 1 }}>
              {savingUnit ? 'Saving...' : savedUnit ? 'Saved!' : 'Save'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#ccc', marginTop: '8px' }}>Current: 1u = ${Number(unitSize).toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}