import { useEffect, useMemo, useState } from 'react'
import { getBets, getFollowing, followUser, unfollowUser } from '../lib/db'
import { calcProfitUnits } from '../lib/calc'
import { useAuth } from '../lib/AuthContext'

export default function Leaderboard() {
  const { user } = useAuth()
  const [bets, setBets] = useState([])
  const [followingIds, setFollowingIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('all')
  const [followBusy, setFollowBusy] = useState(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getBets(), getFollowing(user.id)])
      .then(([b, f]) => { setBets(b); setFollowingIds(f) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const handleToggleFollow = async (targetId) => {
    setFollowBusy(targetId)
    try {
      if (followingIds.includes(targetId)) {
        await unfollowUser(user.id, targetId)
        setFollowingIds(prev => prev.filter(id => id !== targetId))
      } else {
        await followUser(user.id, targetId)
        setFollowingIds(prev => [...prev, targetId])
      }
    } catch (err) { console.error(err) }
    finally { setFollowBusy(null) }
  }

  const leaderboard = useMemo(() => {
    const byUser = {}
    for (const b of bets) {
      const key = b.user_id
      if (!byUser[key]) byUser[key] = {
        userId: key,
        name: b.display_name || 'Anonymous',
        settledCount: 0,
        pending: 0,
        unitsStaked: 0,
        unitsProfit: 0,
      }
      const u = byUser[key]
      u.unitsStaked += Number(b.stake_units || 0)
      if (b.result === 'pending') { u.pending++ }
      else { u.unitsProfit += calcProfitUnits(b.stake_units, b.odds, b.result); u.settledCount++ }
    }
    return Object.values(byUser)
      .map(u => ({ ...u, roi: u.unitsStaked ? (u.unitsProfit / u.unitsStaked * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.unitsProfit - a.unitsProfit)
  }, [bets])

  const filtered = useMemo(() => {
    if (view === 'all') return leaderboard
    return leaderboard.filter(u => u.userId === user?.id || followingIds.includes(u.userId))
  }, [leaderboard, view, followingIds, user])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Leaderboard</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ranked by units profit</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-hover)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
          {[['all', 'Everyone'], ['following', 'Following']].map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} style={{
              padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
              border: 'none', cursor: 'pointer',
              background: view === key ? 'var(--bg-card)' : 'transparent',
              color: view === key ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: view === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {view === 'following' ? "You're not following anyone yet" : 'No bets logged yet'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {view === 'following' ? 'Switch to "Everyone" and follow some bettors' : 'Be the first to place a bet'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 80px 80px 100px', gap: '12px', padding: '0 20px', marginBottom: '4px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bettor</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Bets</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>ROI</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Profit</div>
            <div></div>
          </div>

          {filtered.map((u, i) => {
            const isMe = u.userId === user?.id
            const isFollowing = followingIds.includes(u.userId)
            const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : 'var(--text-muted)'

            return (
              <div key={u.userId} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 80px 80px 80px 100px',
                gap: '12px',
                alignItems: 'center',
              }}>
                {/* Rank */}
                <div style={{ fontSize: '15px', fontWeight: '700', color: rankColor }}>{i + 1}</div>

                {/* Name */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{u.name}</span>
                    {isMe && <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>YOU</span>}
                  </div>
                  {u.pending > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{u.pending} pending</div>
                  )}
                </div>

                {/* Bets */}
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>{u.settledCount}</div>

                {/* ROI */}
                <div style={{ fontSize: '13px', fontWeight: '600', color: Number(u.roi) >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
                  {Number(u.roi) >= 0 ? '+' : ''}{u.roi}%
                </div>

                {/* Profit */}
                <div style={{ fontSize: '14px', fontWeight: '700', color: u.unitsProfit >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
                  {u.unitsProfit >= 0 ? '+' : ''}{u.unitsProfit.toFixed(2)}u
                </div>

                {/* Follow button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {!isMe && (
                    <button
                      onClick={() => handleToggleFollow(u.userId)}
                      disabled={followBusy === u.userId}
                      style={{
                        padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                        fontWeight: '600', cursor: 'pointer', border: 'none',
                        background: isFollowing ? 'var(--bg-hover)' : 'var(--text-primary)',
                        color: isFollowing ? 'var(--text-secondary)' : 'var(--bg)',
                        opacity: followBusy === u.userId ? 0.5 : 1,
                      }}
                    >
                      {followBusy === u.userId ? '...' : isFollowing ? 'Following' : '+ Follow'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}