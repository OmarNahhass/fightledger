import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getBets } from '../lib/db'
import { calcProfitUnits } from '../lib/calc'

const isProp = (betType) => ['round_prop', 'method_prop', 'over_under'].includes(betType)

export default function ProfitChart({ userId }) {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getBets(userId)
      .then(setBets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  const chartData = useMemo(() => {
    const settled = bets
      .filter(b => b.result !== 'pending')
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

    let straight = 0, parlay = 0, props = 0, overall = 0

    return settled.map((b, i) => {
      const profit = calcProfitUnits(b.stake_units, b.odds, b.result)
      overall += profit

      if (b.bet_type === 'moneyline') straight += profit
      else if (b.bet_type === 'parlay') parlay += profit
      else if (isProp(b.bet_type)) props += profit

      return {
        index: i + 1,
        date: b.event_date ? new Date(b.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Bet ${i + 1}`,
        straight: Number(straight.toFixed(2)),
        parlay: Number(parlay.toFixed(2)),
        props: Number(props.toFixed(2)),
        overall: Number(overall.toFixed(2)),
      }
    })
  }, [bets])

  if (loading) return <p className="text-gray-400">Loading chart...</p>

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="font-semibold mb-4">Profit over time</h2>

      {chartData.length === 0 ? (
        <p className="text-gray-500 text-sm py-10 text-center">No settled bets yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={11} tickFormatter={v => `${v}u`} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value, name) => [`${value}u`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="straight" name="Straight picks" stroke="#60a5fa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="parlay" name="Parlays" stroke="#fbbf24" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="props" name="Props" stroke="#4ade80" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="overall" name="Overall profit" stroke="#fb923c" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}