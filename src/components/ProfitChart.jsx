import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getBets } from '../lib/db'
import { calcProfitUnits } from '../lib/calc'
import { useTheme } from '../lib/ThemeContext'

const isProp = (betType) => ['round_prop', 'method_prop', 'over_under'].includes(betType)

export default function ProfitChart({ userId }) {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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

  if (loading || chartData.length === 0) return null

  const gridColor = isDark ? '#1f1f1f' : '#f0f0f0'
  const axisColor = isDark ? '#333' : '#ddd'
  const tickColor = isDark ? '#444' : '#bbb'
  const tooltipBg = isDark ? '#111' : '#fff'
  const tooltipBorder = isDark ? '#1f1f1f' : '#ebebeb'

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '20px', fontWeight: '600' }}>
        Profit over time
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" stroke={axisColor} fontSize={11} tick={{ fill: tickColor }} />
          <YAxis stroke={axisColor} fontSize={11} tick={{ fill: tickColor }} tickFormatter={v => `${v}u`} />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            labelStyle={{ color: tickColor }}
            formatter={(value, name) => [`${value}u`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '11px', color: tickColor, paddingTop: '16px' }} />
          <Line type="monotone" dataKey="straight" name="Straight" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="parlay" name="Parlays" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="props" name="Props" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="overall" name="Overall" stroke={isDark ? '#c8c8c8' : '#1a1a1a'} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}