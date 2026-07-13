import { useEffect, useMemo, useState } from 'react'
import { getBets, getFollowing, followUser, unfollowUser } from '../lib/db'
import { calcProfitUnits } from '../lib/calc'
import { useAuth } from '../lib/AuthContext'

const resultBadge = (result) => {
  const base = { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }
  if (result === 'win') return { ...base, color: '#16a34a', background: '#f0fdf4' }
  if (result === 'loss') return { ...base, color: '#dc2626', background: '#fef2f2' }
  if (result === 'push') return { ...base, color: '#d97706', background: '#fffbeb' }
  return { ...base, color: '#888', background: '#f5f5f5' }
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [bets, setBets] = useState([])
  const [followingIds, setFollowingIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
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
      if (!byUser[key]) byUser[key] = { userId: key, name: b.display_name || 'Anonymous', bets: [], settledCount: 0, pending: 0, unitsStaked: 0, unitsProfit: 0 }
      const u = byUser[key]
      u.bets.push(b)
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

  if (loading) return <div style={{ color: '#aaa', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.4px', marginBottom: '4px' }}>Leaderboard</h1>
          <p style={{ fontSize: '13px', color: '#aaa' }}>Ranked by units profit · click to see bets</p>
        </div>
        <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: '10px', padding: '3px', gap: '2px' }}>
          {[['all', 'Everyone'], ['following', 'Following']].map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} style={{
              padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer',
              background: view === key ? '#fff' : 'transparent',
              color: view === key ? '#1a1a1a' : '#aaa',
              boxShadow: view === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>{view === 'following' ? "You're not following anyone yet" : 'No bets logged yet'}</div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>{view === 'following' ? 'Switch to "Everyone" and follow some bettors' : 'Be the first to place a bet'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((u, i) => {
            const isMe = u.userId === user?.id
            const isFollowing = followingIds.includes(u.userId)
            const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : '#ddd'
            return (
              <div key={u.userId} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === u.userId ? null : u.userId)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: rankColor, width: '20px', textAlign: 'center' }}>{i + 1}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{u.name}</span>
                        {isMe && <span style={{ fontSize: '11px', color: '#aaa', background: '#f5f5f5', padding: '1px 7px', borderRadius: '4px' }}>You</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: '#aaa' }}>
                        {u.settledCount} settled · {u.unitsStaked.toFixed(1)}u staked
                        {u.pending > 0 && ` · ${u.pending} pending`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: u.unitsProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                        {u.unitsProfit >= 0 ? '+' : ''}{u.unitsProfit.toFixed(2)}u
                      </div>
                      <div style={{ fontSize: '11px', color: '#aaa' }}>ROI {u.roi >= 0 ? '+' : ''}{u.roi}%</div>
                    </div>
                    {!isMe && (
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleFollow(u.userId) }}
                        disabled={followBusy === u.userId}
                        style={{
                          padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none',
                          background: isFollowing ? '#f5f5f5' : '#1a1a1a',
                          color: isFollowing ? '#888' : '#fff',
                          opacity: followBusy === u.userId ? 0.5 : 1,
                        }}
                      >
                        {followBusy === u.userId ? '...' : isFollowing ? 'Following' : '+ Follow'}
                      </button>
                    )}
                  </div>
                </div>

                {expanded === u.userId && (
                  <div style={{ borderTop: '1px solid #f5f5f5', padding: '12px 20px' }}>
                    {u.bets.slice().sort((a, b) => new Date(b.event_date) - new Date(a.event_date)).map(bet => (
                      <div key={bet.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f9f9' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{bet.pick}</span>
                            <span style={resultBadge(bet.result)}>{bet.result}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#aaa' }}>
                            {bet.event_name && `${bet.event_name} · `}
                            {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u
                          </div>
                        </div>
                      </div>
                    ))}
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