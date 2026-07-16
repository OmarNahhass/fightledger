import { useEffect, useMemo, useState } from 'react'
import { getBets } from '../lib/db'
import { calcProfitUnits } from '../lib/calc'

const calcStats = (bets) => {
  const settled = bets.filter(b => b.result !== 'pending')
  const unitsStaked = bets.reduce((sum, b) => sum + Number(b.stake_units || 0), 0)
  const unitsProfit = settled.reduce((sum, b) => sum + calcProfitUnits(b.stake_units, b.odds, b.result), 0)
  const roi = unitsStaked > 0 ? (unitsProfit / unitsStaked * 100) : 0
  return {
    bets: settled.length,
    pending: bets.filter(b => b.result === 'pending').length,
    unitsProfit: Number(unitsProfit.toFixed(2)),
    roi: Number(roi.toFixed(1)),
  }
}

const BreakdownTable = ({ title, rows }) => {
  if (!rows.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{title}</div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', gap: '8px', padding: '8px 20px', borderBottom: '1px solid var(--border)' }}>
        {['Category', 'Bets', 'Profit', 'ROI'].map(h => (
          <div key={h} style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: h === 'Category' ? 'left' : 'right' }}>{h}</div>
        ))}
      </div>

      {rows.map((row, i) => (
        <div key={row.label} style={{
          display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px', gap: '8px',
          padding: '11px 20px',
          borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
          alignItems: 'center',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{row.label}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'right' }}>{row.bets}</div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: row.unitsProfit >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
            {row.unitsProfit >= 0 ? '+' : ''}{row.unitsProfit}u
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: row.roi >= 0 ? '#16a34a' : '#dc2626', textAlign: 'right' }}>
            {row.roi >= 0 ? '+' : ''}{row.roi}%
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ROIBreakdown({ userId }) {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    getBets(userId).then(setBets).catch(console.error).finally(() => setLoading(false))
  }, [userId])

  const { byType, bySportsbook, byWeightClass } = useMemo(() => {
    // By bet type
    const typeMap = {}
    for (const b of bets) {
      const key = b.bet_type || 'other'
      if (!typeMap[key]) typeMap[key] = []
      typeMap[key].push(b)
    }
    const byType = Object.entries(typeMap)
      .map(([label, bets]) => ({ label, ...calcStats(bets) }))
      .sort((a, b) => b.unitsProfit - a.unitsProfit)

    // By sportsbook
    const bookMap = {}
    for (const b of bets) {
      if (!b.sportsbook) continue
      if (!bookMap[b.sportsbook]) bookMap[b.sportsbook] = []
      bookMap[b.sportsbook].push(b)
    }
    const bySportsbook = Object.entries(bookMap)
      .map(([label, bets]) => ({ label, ...calcStats(bets) }))
      .sort((a, b) => b.unitsProfit - a.unitsProfit)

    // By weight class
    const classMap = {}
    for (const b of bets) {
      const key = b.weight_class || null
      if (!key) continue
      if (!classMap[key]) classMap[key] = []
      classMap[key].push(b)
    }
    const byWeightClass = Object.entries(classMap)
      .map(([label, bets]) => ({ label, ...calcStats(bets) }))
      .sort((a, b) => b.unitsProfit - a.unitsProfit)

    return { byType, bySportsbook, byWeightClass }
  }, [bets])

  if (loading) return null
  if (!bets.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
      <BreakdownTable title="ROI by bet type" rows={byType} />
      {bySportsbook.length > 0 && <BreakdownTable title="ROI by sportsbook" rows={bySportsbook} />}
      {byWeightClass.length > 0 && <BreakdownTable title="ROI by weight class" rows={byWeightClass} />}
    </div>
  )
}