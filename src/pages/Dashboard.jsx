import { useEffect, useState, useMemo } from 'react'
import { getBetStats, getUnitSize, getBets } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import ProfitChart from '../components/ProfitChart'

const calcPayoutUnits = (units, odds) => {
  const u = Number(units), o = Number(odds)
  if (!u || !o) return 0
  return o > 0 ? u * o / 100 : u * 100 / Math.abs(o)
}

const calcProfitUnits = (units, odds, result) => {
  if (result === 'win') return calcPayoutUnits(units, odds)
  if (result === 'loss') return -Number(units)
  return 0
}

const StatCard = ({ label, value, sub, color = 'var(--text-primary)' }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 22px' }}>
    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', fontWeight: '600' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: '700', color, letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{sub}</div>}
  </div>
)

const ROICard = ({ label, profit, staked, wins, losses, avgOdds }) => {
  const roi = staked ? ((profit / staked) * 100).toFixed(1) : '0.0'
  const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : '0'
  const profitColor = profit > 0 ? '#16a34a' : profit < 0 ? '#dc2626' : 'var(--text-secondary)'
  const roiColor = Number(roi) > 0 ? '#16a34a' : Number(roi) < 0 ? '#dc2626' : 'var(--text-secondary)'
  const total = wins + losses

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '14px', fontWeight: '600' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Units profit</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: profitColor, letterSpacing: '-0.3px' }}>
            {profit >= 0 ? '+' : ''}{profit.toFixed(2)}u
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>ROI</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: roiColor, letterSpacing: '-0.3px' }}>
            {Number(roi) >= 0 ? '+' : ''}{roi}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Win rate</div>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {winRate}% <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>({wins}W / {losses}L)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Avg odds</div>
          <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {avgOdds > 0 ? '+' : ''}{Math.round(avgOdds)}
          </div>
        </div>
      </div>
      {total > 0 && (
        <div style={{ marginTop: '12px', height: '4px', borderRadius: '2px', background: 'var(--bg-hover)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${winRate}%`, background: '#16a34a', borderRadius: '2px', transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [unitSize, setUnitSize] = useState(10)
  const [allBets, setAllBets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([getBetStats(user.id), getUnitSize(), getBets(user.id)])
      .then(([s, u, b]) => { setStats(s); setUnitSize(u); setAllBets(b) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const pendingBets = useMemo(() => allBets.filter(b => b.result === 'pending'), [allBets])
  const settledBets = useMemo(() => allBets.filter(b => b.result !== 'pending'), [allBets])

  const roiByType = useMemo(() => {
    const types = { moneyline: { profit: 0, staked: 0, wins: 0, losses: 0, oddsSum: 0, count: 0 }, parlay: { profit: 0, staked: 0, wins: 0, losses: 0, oddsSum: 0, count: 0 }, props: { profit: 0, staked: 0, wins: 0, losses: 0, oddsSum: 0, count: 0 } }
    for (const b of settledBets) {
      const type = b.bet_type === 'moneyline' ? 'moneyline' : b.bet_type === 'parlay' ? 'parlay' : 'props'
      const profit = calcProfitUnits(b.stake_units, b.odds, b.result)
      types[type].profit += profit
      types[type].staked += Number(b.stake_units || 0)
      types[type].oddsSum += Number(b.odds || 0)
      types[type].count++
      if (b.result === 'win') types[type].wins++
      if (b.result === 'loss') types[type].losses++
    }
    return types
  }, [settledBets])

  const overallStats = useMemo(() => {
    const wins = settledBets.filter(b => b.result === 'win').length
    const losses = settledBets.filter(b => b.result === 'loss').length
    const total = wins + losses
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : '0'
    return { wins, losses, total, winRate }
  }, [settledBets])

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
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <StatCard label="Units profit" value={`${profit >= 0 ? '+' : ''}${profit.toFixed(2)}u`} sub={`$${(profit * unitSize).toFixed(2)}`} color={profitColor} />
            <StatCard label="ROI" value={`${roi >= 0 ? '+' : ''}${roi}%`} sub={`${stats.totalUnitsStaked}u staked`} color={roiColor} />
            <StatCard label="Win rate" value={`${overallStats.winRate}%`} sub={`${overallStats.wins}W / ${overallStats.losses}L`} color={overallStats.winRate >= 50 ? '#16a34a' : 'var(--text-primary)'} />
            <StatCard label="Total bets" value={stats.totalBets} sub={`${stats.pendingBets} pending`} />
          </div>

          {/* Profit chart */}
          <ProfitChart userId={user?.id} />

          {/* ROI by bet type */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px', fontWeight: '600' }}>ROI by bet type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <ROICard
                label="Moneyline"
                profit={roiByType.moneyline.profit}
                staked={roiByType.moneyline.staked}
                wins={roiByType.moneyline.wins}
                losses={roiByType.moneyline.losses}
                avgOdds={roiByType.moneyline.count ? roiByType.moneyline.oddsSum / roiByType.moneyline.count : 0}
              />
              <ROICard
                label="Parlays"
                profit={roiByType.parlay.profit}
                staked={roiByType.parlay.staked}
                wins={roiByType.parlay.wins}
                losses={roiByType.parlay.losses}
                avgOdds={roiByType.parlay.count ? roiByType.parlay.oddsSum / roiByType.parlay.count : 0}
              />
              <ROICard
                label="Props"
                profit={roiByType.props.profit}
                staked={roiByType.props.staked}
                wins={roiByType.props.wins}
                losses={roiByType.props.losses}
                avgOdds={roiByType.props.count ? roiByType.props.oddsSum / roiByType.props.count : 0}
              />
            </div>
          </div>

          {/* Pending bets summary */}
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
        </>
      )}
    </div>
  )
}