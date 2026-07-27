import { useEffect, useState } from 'react'
import { getUnitSize, setUnitSize, getProfile, updateProfile, uploadAvatar } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import emailjs from '@emailjs/browser'

const EMAILJS_SERVICE_ID = 'service_ech9ex9'
const EMAILJS_TEMPLATE_ID = 'template_iqdnrmd'
const EMAILJS_PUBLIC_KEY = 'L4s6izzbLRxd9T3hC'

const inputStyle = {
  background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px',
  padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', width: '100%',
}
const btnPrimary = {
  background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: '8px',
  padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
}

export default function Settings() {
  const { user } = useAuth()
  const [unitSize, setUnit] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingUnit, setSavingUnit] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savedUnit, setSavedUnit] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)

  // Contact form state
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getUnitSize(), getProfile(user.id)])
      .then(([u, profile]) => {
        setUnit(String(u))
        setDisplayName(profile?.display_name || user.email.split('@')[0])
        setBio(profile?.bio || '')
        setAvatarUrl(profile?.avatar_url || '')
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
    if (!displayName.trim()) return
    setSavingProfile(true)
    try {
      await updateProfile(user.id, { display_name: displayName.trim(), bio: bio.trim() })
      setSavedProfile(true)
      setTimeout(() => setSavedProfile(false), 2000)
    } catch (err) { console.error(err) }
    finally { setSavingProfile(false) }
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const url = await uploadAvatar(user.id, file)
      setAvatarUrl(url)
      await updateProfile(user.id, { avatar_url: url })
    } catch (err) { console.error(err) }
    finally { setUploadingAvatar(false) }
  }

  const handleSendMessage = async () => {
    if (!subject.trim() || !message.trim()) return
    setSending(true)
    setSendError(null)
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          subject: subject.trim(),
          message: message.trim(),
          name: displayName || user?.email,
          time: new Date().toLocaleString(),
        },
        EMAILJS_PUBLIC_KEY
      )
      setSent(true)
      setSubject('')
      setMessage('')
      setTimeout(() => setSent(false), 4000)
    } catch (err) {
      console.error(err)
      setSendError('Failed to send. Please try again.')
    }
    finally { setSending(false) }
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Settings</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Configure your account</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '520px' }}>

        {/* Profile */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>Profile</div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-hover)', border: '1px solid var(--border)', flexShrink: 0 }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', color: 'var(--text-muted)' }}>{displayName?.[0]?.toUpperCase()}</div>
              }
            </div>
            <div>
              <label style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                {uploadingAvatar ? 'Uploading...' : 'Upload photo'}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
              </label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>JPG, PNG up to 2MB</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Display name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={30} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bio</label>
              <input value={bio} onChange={e => setBio(e.target.value)} maxLength={100} placeholder="Optional short bio" style={inputStyle} />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email}</div>
            <button onClick={handleSaveProfile} disabled={savingProfile} style={{ ...btnPrimary, opacity: savingProfile ? 0.6 : 1, alignSelf: 'flex-start' }}>
              {savingProfile ? 'Saving...' : savedProfile ? 'Saved!' : 'Save profile'}
            </button>
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

        {/* Contact form */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>Report an issue</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Found a bug or something looks wrong? Send a message directly to the developer.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subject</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Auto-settle not working" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the issue..." rows={4}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
            </div>
            {sendError && <div style={{ fontSize: '12px', color: '#dc2626' }}>{sendError}</div>}
            <button onClick={handleSendMessage} disabled={sending || !subject.trim() || !message.trim()}
              style={{ ...btnPrimary, opacity: (sending || !subject.trim() || !message.trim()) ? 0.6 : 1, alignSelf: 'flex-start' }}>
              {sending ? 'Sending...' : sent ? '✓ Sent!' : 'Send message'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}