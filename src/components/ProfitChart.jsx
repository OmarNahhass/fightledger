import { useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { calcProfitUnits } from '../lib/calc'
import { useTheme } from '../lib/ThemeContext'

// 'props' is what the bet form saves; the others are kept for older bets
const isProp = (betType) => ['props', 'round_prop', 'method_prop', 'over_under'].includes(betType)

// Only animate the lines the first time the chart appears in a session, so
// coming back to the dashboard doesn't replay the draw-in animation every time
let hasAnimated = false

export default function ProfitChart({ bets }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const chartData = useMemo(() => {
    const settled = bets.filter(b => b.result !== 'pending').sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    const totals = { straight: 0, parlay: 0, props: 0, overall: 0 }
    return settled.map((b, i) => {
      const profit = calcProfitUnits(b.stake_units, b.odds, b.result)
      totals.overall += profit
      if (b.bet_type === 'moneyline') totals.straight += profit
      else if (b.bet_type === 'parlay') totals.parlay += profit
      else if (isProp(b.bet_type)) totals.props += profit
      return {
        index: i + 1,
        date: b.event_date ? new Date(b.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Bet ${i + 1}`,
        straight: Number(totals.straight.toFixed(2)),
        parlay: Number(totals.parlay.toFixed(2)),
        props: Number(totals.props.toFixed(2)),
        overall: Number(totals.overall.toFixed(2)),
      }
    })
  }, [bets])

  const hasChart = chartData.length > 0
  const animate = !hasAnimated
  useEffect(() => { if (hasChart) hasAnimated = true }, [hasChart])

  if (!hasChart) return null

  const gridColor = isDark ? '#1f1f1f' : '#f0f0f0'
  const axisColor = isDark ? '#333' : '#ddd'
  const tickColor = isDark ? '#444' : '#bbb'
  const tooltipBg = isDark ? '#111' : '#fff'
  const tooltipBorder = isDark ? '#1f1f1f' : '#ebebeb'
  const lineProps = { type: 'monotone', strokeWidth: 2, dot: false, isAnimationActive: animate, animationDuration: 600 }

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
          <Line {...lineProps} dataKey="straight" name="Straight" stroke="#3b82f6" />
          <Line {...lineProps} dataKey="parlay" name="Parlays" stroke="#f59e0b" />
          <Line {...lineProps} dataKey="props" name="Props" stroke="#8b5cf6" />
          <Line {...lineProps} dataKey="overall" name="Overall" stroke={isDark ? '#c8c8c8' : '#1a1a1a'} strokeWidth={2.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
