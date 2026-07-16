import { useEffect, useState } from 'react'
import { getFollowing, getActivityFeed } from '../lib/db'
import { useAuth } from '../lib/AuthContext'

const timeAgo = (dateStr) => {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const resultBadge = (result) => {
  const base = { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }
  if (result === 'win') return { ...base, color: '#16a34a', background: '#f0fdf4' }
  if (result === 'loss') return { ...base, color: '#dc2626', background: '#fef2f2' }
  if (result === 'push') return { ...base, color: '#d97706', background: '#fffbeb' }
  return { ...base, color: 'var(--text-secondary)', background: 'var(--bg-hover)' }
}

export default function Activity() {
  const { user } = useAuth()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [followingIds, setFollowingIds] = useState([])

  useEffect(() => {
    if (!user) return
    getFollowing(user.id)
      .then(async (ids) => {
        setFollowingIds(ids)
        const activity = await getActivityFeed(ids)
        setFeed(activity)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Activity</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Recent bets from people you follow</p>
      </div>

      {followingIds.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>You're not following anyone yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Go to the Leaderboard and follow some bettors to see their activity here</div>
        </div>
      ) : feed.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No recent activity</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>People you follow haven't placed any bets yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {feed.map(bet => (
            <div key={bet.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, overflow: 'hidden',
                }}>
                  {bet.avatar_url ? (
                    <img src={bet.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>
                      {(bet.display_name || '?')[0].toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Bet info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {bet.display_name || 'Anonymous'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>bet on</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{bet.pick}</span>
                    <span style={resultBadge(bet.result)}>{bet.result}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {bet.event_name && `${bet.event_name} · `}
                    {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u · {bet.bet_type}
                    {bet.sportsbook && ` · ${bet.sportsbook}`}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(bet.placed_at)}</div>
                {bet.confidence && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{'★'.repeat(bet.confidence)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}