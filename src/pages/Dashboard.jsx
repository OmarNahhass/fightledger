import { useEffect, useState } from 'react'
import { getBetStats, getUnitSize } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import ProfitChart from '../components/ProfitChart'

const StatCard = ({ label, value, sub, color = 'text-white' }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
    <p className="text-gray-400 text-sm mb-1">{label}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
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

  if (loading || !stats) return <p className="text-gray-400">Loading...</p>

  const profit = Number(stats.totalUnitsProfit ?? 0)
  const profitColor = profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-white'
  const roi = Number(stats.roi ?? 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">1 unit = ${unitSize.toFixed(2)}</p>

      {stats.totalBets === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">🥊</p>
          <p className="text-white font-medium mb-1">No bets yet</p>
          <p className="text-gray-500 text-sm">Add an event and start tracking your bets</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Units profit"
              value={`${profit >= 0 ? '+' : ''}${profit.toFixed(2)}u`}
              sub={`$${(profit * unitSize).toFixed(2)}`}
              color={profitColor}
            />
            <StatCard
              label="ROI"
              value={`${roi >= 0 ? '+' : ''}${roi}%`}
              sub={`${stats.totalUnitsStaked}u staked`}
              color={roi >= 0 ? 'text-green-400' : 'text-red-400'}
            />
            <StatCard
              label="Total bets"
              value={stats.totalBets}
              sub={`${stats.pendingBets} pending`}
            />
            <StatCard
              label="Avg stake"
              value={`${stats.totalBets > 0 ? (Number(stats.totalUnitsStaked) / stats.totalBets).toFixed(2) : '0.00'}u`}
              sub="per bet"
            />
          </div>

          <ProfitChart userId={user.id} />
        </>
      )}
    </div>
  )
}