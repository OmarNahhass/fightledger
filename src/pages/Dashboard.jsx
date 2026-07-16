import { useEffect, useState } from 'react'
import { getBetStats, getUnitSize, getBets } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import ProfitChart from '../components/ProfitChart'
import ROIBreakdown from '../components/ROIBreakdown'

const calcPayoutUnits = (units, odds) => {
  const u = Number(units), o = Number(odds)
  if (!u || !o) return 0
  return o > 0 ? u * o / 100 : u * 100 / Math.abs(o)
}

const StatCard = ({ label, value, sub, color = 'var(--text-primary)' }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 22px' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', fontWeight: '600' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: '700', color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{sub}</div>}
  </div>
)

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [unitSize, setUnitSize] = useState(10)
  const [pendingBets, setPendingBets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([getBetStats(user.id), getUnitSize(), getBets(user.id)])
      .then(([s, u, b]) => {
        setStats(s)
        setUnitSize(u)
        setPendingBets(b.filter(bet => bet.result === 'pending'))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  const profit = Number(stats?.totalUnitsProfit ?? 0)
  const roi = Number(stats?.roi ?? 0)
  const profitColor = profit > 0 ? '#16a34a' : profit < 0 ? '#dc2626' : 'var(--text-primary)'
  const roiColor = roi > 0 ? '#16a34a' : roi < 0 ? '#dc2626' : 'var(--text-primary)'

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>1 unit = ${unitSize.toFixed(2)}</p>
      </div>

      {!stats || stats.totalBets === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No bets yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Go to Bets and add your first bet to get started</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <StatCard label="Units profit" value={`${profit >= 0 ? '+' : ''}${profit.toFixed(2)}u`} sub={`$${(profit * unitSize).toFixed(2)}`} color={profitColor} />
            <StatCard label="ROI" value={`${roi >= 0 ? '+' : ''}${roi}%`} sub={`${stats.totalUnitsStaked}u staked`} color={roiColor} />
            <StatCard label="Total bets" value={stats.totalBets} sub={`${stats.pendingBets} pending`} />
            <StatCard label="Avg stake" value={`${stats.totalBets > 0 ? (Number(stats.totalUnitsStaked) / stats.totalBets).toFixed(2) : '0.00'}u`} sub="per bet" />
          </div>

          <ProfitChart userId={user?.id} />

          {pendingBets.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Pending bets ({pendingBets.length})
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {pendingBets.reduce((sum, b) => sum + Number(b.stake_units || 0), 0).toFixed(2)}u at risk
                  </div>
                </div>
                {pendingBets
                  .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
                  .map((bet, i) => {
                    const isLast = i === pendingBets.length - 1
                    const toWin = calcPayoutUnits(bet.stake_units, bet.odds)
                    return (
                      <div key={bet.id} style={{ padding: '12px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{bet.pick}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px' }}>{bet.bet_type}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {bet.event_name && `${bet.event_name} · `}
                            {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u
                            {bet.event_date && ` · ${new Date(bet.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a' }}>+{toWin.toFixed(2)}u</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to win</div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          <ROIBreakdown userId={user?.id} />
        </>
      )}
    </div>
  )
}