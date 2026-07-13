import { useEffect, useState } from 'react'
import { getBetStats, getUnitSize } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import ProfitChart from '../components/ProfitChart'

const StatCard = ({ label, value, sub, color = '#1a1a1a' }) => (
  <div style={{
    background: '#fff',
    border: '1px solid #ebebeb',
    borderRadius: '12px',
    padding: '20px 22px',
  }}>
    <div style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', fontWeight: '600' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: '700', color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '12px', color: '#bbb', marginTop: '6px' }}>{sub}</div>}
  </div>
)

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [unitSize, setUnitSize] = useState(10)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([getBetStats(user.id), getUnitSize()])
      .then(([s, u]) => { setStats(s); setUnitSize(u) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <div style={{ color: '#bbb', fontSize: '13px' }}>Loading...</div>

  const profit = Number(stats?.totalUnitsProfit ?? 0)
  const roi = Number(stats?.roi ?? 0)
  const profitColor = profit > 0 ? '#16a34a' : profit < 0 ? '#dc2626' : '#1a1a1a'
  const roiColor = roi > 0 ? '#16a34a' : roi < 0 ? '#dc2626' : '#1a1a1a'

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.4px', marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: '#aaa' }}>1 unit = ${unitSize.toFixed(2)}</p>
      </div>

      {!stats || stats.totalBets === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>No bets yet</div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>Add an event and start tracking your bets</div>
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
        </>
      )}
    </div>
  )
}