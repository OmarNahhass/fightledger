import { useEffect, useRef, useState } from 'react'
import { getUnitSize, setUnitSize, getProfile, updateProfile, uploadAvatar } from '../lib/db'
import { useAuth } from '../lib/AuthContext'

export default function Settings() {
  const { user } = useAuth()
  const [unitSize, setUnit] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingUnit, setSavingUnit] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedUnit, setSavedUnit] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!user) return
    Promise.all([getUnitSize(), getProfile(user.id)])
      .then(([u, profile]) => {
        setUnit(String(u))
        setDisplayName(profile?.display_name || user.email.split('@')[0])
        setBio(profile?.bio || '')
        setAvatarUrl(profile?.avatar_url || null)
      })
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

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await updateProfile(user.id, { display_name: displayName.trim(), bio: bio.trim(), avatar_url: avatarUrl })
      setSavedProfile(true)
      setTimeout(() => setSavedProfile(false), 2000)
    }
    catch (err) { console.error(err) }
    finally { setSavingProfile(false) }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const url = await uploadAvatar(user.id, file)
      setAvatarUrl(url)
      await updateProfile(user.id, { display_name: displayName, bio, avatar_url: url })
    }
    catch (err) { console.error(err) }
    finally { setUploadingAvatar(false) }
  }

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
  }

  const btnPrimary = {
    background: 'var(--text-primary)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 18px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Configure your account</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '520px' }}>

        {/* Profile section */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '20px' }}>Profile</div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'var(--bg-hover)',
                border: '2px solid var(--border)',
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-muted)' }}>
                  {displayName?.[0]?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                style={{ ...btnPrimary, fontSize: '12px', padding: '7px 14px', opacity: uploadingAvatar ? 0.6 : 1 }}
              >
                {uploadingAvatar ? 'Uploading...' : 'Upload photo'}
              </button>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>JPG, PNG or GIF · Max 2MB</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
          </div>

          {/* Display name */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Display name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30} style={{ ...inputStyle, width: '100%' }} />
          </div>

          {/* Bio */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Tell other bettors about yourself..."
              style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: '1.5' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>{bio.length}/160</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ ...btnPrimary, opacity: savingProfile ? 0.6 : 1 }}>
              {savingProfile ? 'Saving...' : savedProfile ? 'Saved!' : 'Save profile'}
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>

        {/* Unit size */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>Unit size</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>The dollar value of 1 unit. All bets are tracked in units based on this.</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '13px' }}>$</span>
              <input type="number" value={unitSize} onChange={e => setUnit(e.target.value)} style={{ ...inputStyle, paddingLeft: '24px', width: '120px' }} />
            </div>
            <button onClick={handleSaveUnit} disabled={savingUnit} style={{ ...btnPrimary, opacity: savingUnit ? 0.6 : 1 }}>
              {savingUnit ? 'Saving...' : savedUnit ? 'Saved!' : 'Save'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Current: 1u = ${Number(unitSize).toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}