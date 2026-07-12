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
    getBets(userId).then(setBets).catch(console.error).finally(() => setLoading(false))
  }, [userId])

  const chartData = useMemo(() => {
    const settled = bets.filter(b => b.result !== 'pending').sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
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

  if (loading) return null
  if (chartData.length === 0) return null

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '24px' }}>
      <div style={{ fontSize: '11px', color: '#333', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '20px' }}>
        Profit over time
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#161616" />
          <XAxis dataKey="date" stroke="#222" fontSize={11} tick={{ fill: '#333' }} />
          <YAxis stroke="#222" fontSize={11} tick={{ fill: '#333' }} tickFormatter={v => `${v}u`} />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: '6px', fontSize: '12px' }}
            labelStyle={{ color: '#666' }}
            itemStyle={{ color: '#888' }}
            formatter={(value, name) => [`${value}u`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#333', paddingTop: '16px' }} />
          <Line type="monotone" dataKey="straight" name="Straight" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="parlay" name="Parlays" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="props" name="Props" stroke="#818cf8" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="overall" name="Overall" stroke="#e0e0e0" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}