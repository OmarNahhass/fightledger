import { useState, useMemo } from 'react'
import { getBets, getEvents, createEvent, getFightsByEvent, getFightsForEvents, createFight, createBet, updateBetResult, deleteBet, getUnitSize, setUnitSize as saveUnitSize } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import { useCachedQuery } from '../lib/queryCache'
import { getFightsByDate, getUpcomingEvents } from '../lib/mmaApi'
import { exportBetsToCSV } from '../lib/exportCSV'

const NO_ROWS = []

const BET_TYPES =['moneyline', 'parlay', 'props']
const SPORTSBOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers', 'ESPN Bet', 'Bet365', 'Kalshi', 'Polymarket', 'Other']
const empty = { fight_id: '', bet_type: 'moneyline', pick: '', odds: '', stake_units: '', notes: '', sportsbook: '', confidence: 0, prop_tier: 'fight', prop_fighter: '' }
const emptyLeg = { fight_id: '', pick: '', odds: '' }

const FIGHT_PROPS = [
  'Goes to Decision', 'Does Not Go to Decision', 'Fight Goes the Distance', 'Fight Does Not Go the Distance',
  'Ends in Round 1', 'Ends in Round 2', 'Ends in Round 3', 'Ends in Round 4', 'Ends in Round 5',
  'Ends in Rounds 1-2', 'Ends in Rounds 1-3',
  'Over 0.5 Rounds', 'Under 0.5 Rounds', 'Over 1.5 Rounds', 'Under 1.5 Rounds',
  'Over 2.5 Rounds', 'Under 2.5 Rounds', 'Over 3.5 Rounds', 'Under 3.5 Rounds', 'Over 4.5 Rounds', 'Under 4.5 Rounds',
  'At Least One Knockdown', 'No Knockdowns', 'At Least One Takedown', 'No Takedowns',
  'Most Significant Strikes Landed — Fighter A', 'Most Significant Strikes Landed — Fighter B',
  'Most Takedowns Landed — Fighter A', 'Most Takedowns Landed — Fighter B',
  'Fight Stopped by Doctor', 'Point Deduction (Any Round)', 'Point Deduction Round 1', 'Point Deduction Round 2', 'Point Deduction Round 3',
  'No Contest', 'Technical Draw',
]

const FIGHTER_PROPS = [
  'by KO/TKO', 'by Submission', 'by Decision', 'by Unanimous Decision', 'by Split Decision',
  'by TKO (Strikes)', 'by TKO (Doctor Stoppage)', 'to Finish Fight',
  'to Win Round 1', 'to Win Round 2', 'to Win Round 3',
  'to Finish in Round 1', 'to Finish in Round 2', 'to Finish in Round 3',
  'to Land First Significant Strike', 'to Score First Takedown',
  'to be Knocked Down', 'to Record a Takedown', 'to Attempt a Submission',
  'to Land More Significant Strikes', 'to Land More Takedowns',
]

const calcPayoutUnits = (units, odds) => {
  const u = Number(units), o = Number(odds)
  if (!u || !o) return 0
  return o > 0 ? u * o / 100 : u * 100 / Math.abs(o)
}

const toDecimal = (american) => {
  const o = Number(american)
  if (!o) return 1
  return o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1
}

const toAmerican = (decimal) => {
  if (decimal >= 2) return Math.round((decimal - 1) * 100)
  return Math.round(-100 / (decimal - 1))
}

const calcParlayOdds = (legs) => {
  const validLegs = legs.filter(l => l.odds && l.pick)
  if (validLegs.length < 2) return null
  const combined = validLegs.reduce((acc, leg) => acc * toDecimal(leg.odds), 1)
  return toAmerican(combined)
}

const SPORTSBOOK_DOMAINS = {
  'DraftKings': 'draftkings.com',
  'FanDuel': 'fanduel.com',
  'BetMGM': 'betmgm.com',
  'Caesars': 'caesars.com',
  'BetRivers': 'betrivers.com',
  'ESPN Bet': 'espnbet.com',
  'Bet365': 'bet365.com',
  'Unibet': 'unibet.com',
  'Betway': 'betway.com',
  'BetOnline': 'betonline.ag',
  'MyBookie': 'mybookie.ag',
  'Bovada': 'bovada.lv',
  'BetUS': 'betus.com',
  'Heritage Sports': 'heritagesports.eu',
  'Pinnacle': 'pinnacle.com',
  'SportsBetting.ag': 'sportsbetting.ag',
  'PointsBet': 'pointsbet.com',
  'Circa Sports': 'circasports.com',
  'SuperBook': 'superbook.com',
  'WynnBET': 'wynnbet.com',
  'Fanatics': 'fanatics.com',
  'Kalshi': 'kalshi.com',
  'Polymarket': 'polymarket.com',
}

const GREEN = '#16a34a'
const RED = '#dc2626'
const RESULT_COLORS = { win: GREEN, loss: RED, push: '#d97706', void: '#7c3aed', pending: '#2563eb' }

// Event dates are stored as "YYYY-MM-DD"; new Date() would read that as UTC midnight, which is the previous day in the Americas
const parseLocalDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00`) : new Date(d)
const fmtEventDate = (d) => parseLocalDate(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

// Order-independent key so "A vs B" and "B vs A" count as the same bout
const fightKey = (a, b) => [a, b].map(n => n.toLowerCase().trim()).sort().join('|')

const fmtOdds = (odds) => `${Number(odds) > 0 ? '+' : ''}${odds}`
const fmtUnits = (u) => `${u >= 0 ? '+' : ''}${u.toFixed(2)}u`
const fmtDollars = (d) => `${d < 0 ? '-' : ''}$${Math.abs(d).toFixed(2)}`
const profitColor = (u) => u > 0 ? GREEN : u < 0 ? RED : 'var(--text-secondary)'

const betProfitUnits = (bet) => {
  if (bet.result === 'win') return calcPayoutUnits(bet.stake_units, bet.odds)
  if (bet.result === 'loss') return -Number(bet.stake_units)
  return 0
}

const isParlayBet = (bet) => bet.bet_type ? bet.bet_type === 'parlay' : !!bet.pick?.includes(' + ')

// Parlay legs are stored in notes as "Leg 1: Pick (+odds) - A vs B | Leg 2: ..."
const parseParlayLegs = (bet) => {
  const fromNotes = (bet.notes || '').split(' | ').map(str => {
    const m = str.match(/^Leg \d+: (.+?) \(([-+]?\d+)\)(?: - (.+))?$/)
    return m ? { pick: m[1], odds: m[2], fight: m[3] } : null
  }).filter(Boolean)
  if (fromNotes.length) return fromNotes
  return (bet.pick || '').split(' + ').map(pick => ({ pick }))
}

// Settling opens the day after the event, once every fight on the card is over
const eventOver = (d) => parseLocalDate(d) < today

// A moneyline leg's pick is one of the two fighters in its "A vs B" fight
const isMoneylineLeg = (leg) => !!leg.fight && leg.fight.split(' vs ').includes(leg.pick)

const ALL_RESULTS = ['win', 'loss', 'push', 'void']

// Which manual results a pending bet may be given. Auto-settle grades moneyline
// winners itself, so those only get push/void (draws, cancelled fights).
const manualSettleOptions = (bet, eventDate) => {
  if (!eventDate) return ALL_RESULTS // legacy bet saved without a fight: cannot auto-settle
  if (!eventOver(eventDate)) return []
  const autoGradable = isParlayBet(bet)
    ? parseParlayLegs(bet).every(isMoneylineLeg)
    : bet.bet_type !== 'props'
  return autoGradable ? ['push', 'void'] : ALL_RESULTS
}

const SETTLE_BUTTONS = {
  win: { label: 'Win', background: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  loss: { label: 'Loss', background: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  push: { label: 'Push', background: '#fffbeb', color: '#d97706', border: '#fde68a' },
  void: { label: 'Void', background: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
}

const iconProps = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
const PencilIcon = () => <svg {...iconProps} width={12} height={12}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const ClockIcon = () => <svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
const ChevronIcon = ({ open }) => <svg {...iconProps} width={12} height={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><path d="m6 9 6 6 6-6" /></svg>

const ConfidenceMeter = ({ value }) => (
  <span title={`Confidence ${value}/5`} aria-label={`Confidence ${value} out of 5`} style={{ fontSize: '12px', letterSpacing: '1px', lineHeight: 1 }}>
    {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ color: n <= value ? '#f59e0b' : 'var(--text-faint)' }}>★</span>)}
  </span>
)

const SummaryStat = ({ label, value, sub, color }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', minWidth: 0 }}>
    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</div>
    <div className="num" style={{ fontSize: '20px', fontWeight: '700', color: color || 'var(--text-primary)', letterSpacing: '-0.3px' }}>{value}</div>
    {sub && <div className="num" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
  </div>
)

const BET_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'settled', label: 'Settled' },
]

const inputStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }
const selectStyle = { ...inputStyle, cursor: 'pointer' }
const btnPrimary = { background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }

const today = new Date(new Date().setHours(0, 0, 0, 0))

export default function Bets() {
  const { user } = useAuth()
  const betsQuery = useCachedQuery(['bets', user?.id], () => getBets(user.id), { enabled: !!user })
  const eventsQuery = useCachedQuery(['events', user?.id], getEvents, { enabled: !!user })
  const unitQuery = useCachedQuery(['unitSize', user?.id], getUnitSize, { enabled: !!user })
  const ufcQuery = useCachedQuery(['ufcCalendar'], getUpcomingEvents)
  const bets = betsQuery.data ?? NO_ROWS
  const myEvents = eventsQuery.data ?? NO_ROWS
  const unitSize = unitQuery.data ?? 10
  const { setData: setBets } = betsQuery
  const { setData: setMyEvents } = eventsQuery
  const { setData: setUnitSize } = unitQuery
  const loading = betsQuery.loading || unitQuery.loading
  const [fights, setFights] = useState([])
  const [step, setStep] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [addingEvent, setAddingEvent] = useState(null)
  const [fetchingFights, setFetchingFights] = useState(false)
  const [form, setForm] = useState(empty)
  const [customPick, setCustomPick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settling, setSettling] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [parlayLegs, setParlayLegs] = useState([{ ...emptyLeg }, { ...emptyLeg }])
  const [editingUnit, setEditingUnit] = useState(false)
  const [unitInput, setUnitInput] = useState('')
  const [savingUnit, setSavingUnit] = useState(false)
  const [filter, setFilter] = useState('all')
  const [expandedBets, setExpandedBets] = useState(() => new Set())

  const toggleExpanded = (betId) => setExpandedBets(prev => {
    const next = new Set(prev)
    if (next.has(betId)) next.delete(betId)
    else next.add(betId)
    return next
  })

  const myEventDates = new Set(myEvents.map(e => e.event_date))
  const futureTrackedEvents = myEvents.filter(e => new Date(e.event_date) >= today)
  const futureEvents = ufcQuery.data ?? NO_ROWS

  const allUpcomingEvents = [
    ...futureTrackedEvents,
    ...futureEvents.filter(e => !myEventDates.has(e.event_date))
  ].sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  const handleSelectEvent = async (ufc) => {
    setAddingEvent(ufc.event_date)
    try {
      let event = myEvents.find(e => e.event_date === ufc.event_date)
      if (!event) {
        event = await createEvent(ufc)
        setMyEvents(prev => [event, ...(prev ?? [])])
      }
      setSelectedEvent(event)
      setFetchingFights(true)
      let eventFights = await getFightsByEvent(event.id)
      // Cards fill in over the weeks before an event, so add any bouts announced since the last visit
      try {
        const apiFights = await getFightsByDate(event.event_date)
        const known = new Set(eventFights.map(f => fightKey(f.fighter_a, f.fighter_b)))
        let added = 0
        for (const [i, f] of apiFights.entries()) {
          const fighterA = f.fighters?.first?.name
          const fighterB = f.fighters?.second?.name
          if (!fighterA || !fighterB || known.has(fightKey(fighterA, fighterB))) continue
          const winner = f.fighters?.first?.winner ? fighterA : f.fighters?.second?.winner ? fighterB : null
          await createFight({ event_id: event.id, fighter_a: fighterA, fighter_b: fighterB, weight_class: f.category || '', rounds: 3, fight_order: i + 1, winner })
          added++
        }
        if (added) eventFights = await getFightsByEvent(event.id)
      } catch (err) { console.error('Could not auto-fetch fights:', err) }
      setFights(eventFights)
      setStep('fill-form')
    } catch (err) { console.error(err) }
    finally { setAddingEvent(null); setFetchingFights(false) }
  }

  const selectedFight = fights.find(f => f.id === form.fight_id)

  const resetAll = () => {
    setStep(null); setSelectedEvent(null); setFights([]); setForm(empty)
    setCustomPick(false); setParlayLegs([{ ...emptyLeg }, { ...emptyLeg }])
  }

  const updateLeg = (i, field, value) => {
    setParlayLegs(prev => prev.map((leg, idx) => idx === i ? { ...leg, [field]: value, ...(field === 'fight_id' ? { pick: '' } : {}) } : leg))
  }

  const addLeg = () => setParlayLegs(prev => [...prev, { ...emptyLeg }])
  const removeLeg = (i) => setParlayLegs(prev => prev.filter((_, idx) => idx !== i))

  const parlayOdds = calcParlayOdds(parlayLegs)
  const parlayPotentialUnits = parlayOdds ? calcPayoutUnits(form.stake_units, parlayOdds) : 0

  const buildPropPick = () => {
    if (form.prop_tier === 'fighter' && form.prop_fighter && form.pick) return `${form.prop_fighter} ${form.pick}`
    return form.pick
  }

  // Every bet must be tied to a fight on the card so auto-settle can grade it
  const validLegs = parlayLegs.filter(l => l.fight_id && l.pick && l.odds)
  const canSave = form.bet_type === 'parlay'
    ? validLegs.length >= 2 && validLegs.length === parlayLegs.length && !!form.stake_units
    : !!form.fight_id && !!(form.bet_type === 'props' ? buildPropPick() : form.pick) && !!form.odds && !!form.stake_units

  const handleSubmit = async () => {
    if (!canSave) return
    const isParlay = form.bet_type === 'parlay'
    if (isParlay) {
      setSaving(true)
      try {
        const units = Number(form.stake_units)
        const odds = parlayOdds
        const potentialUnits = calcPayoutUnits(units, odds)
        const legsSummary = validLegs.map((l, i) => {
          const fight = fights.find(f => f.id === l.fight_id)
          return `Leg ${i + 1}: ${l.pick} (${Number(l.odds) > 0 ? '+' : ''}${l.odds})${fight ? ` - ${fight.fighter_a} vs ${fight.fighter_b}` : ''}`
        }).join(' | ')
        const bet = {
          fight_id: null, bet_type: 'parlay',
          pick: validLegs.map(l => l.pick).join(' + '),
          odds, stake: units * unitSize, stake_units: units,
          potential_payout: potentialUnits * unitSize + units * unitSize,
          notes: legsSummary, sportsbook: form.sportsbook || null, confidence: form.confidence || null,
        }
        const newBet = await createBet(bet)
        setBets(prev => [newBet, ...prev])
        resetAll()
      } catch (err) { console.error(err) }
      finally { setSaving(false) }
      return
    }

    const finalPick = form.bet_type === 'props' ? buildPropPick() : form.pick
    setSaving(true)
    try {
      const units = Number(form.stake_units)
      const odds = Number(form.odds)
      const potentialUnits = calcPayoutUnits(units, odds)
      const bet = {
        fight_id: form.fight_id, bet_type: form.bet_type,
        pick: finalPick, odds, stake: units * unitSize, stake_units: units,
        potential_payout: potentialUnits * unitSize + units * unitSize,
        notes: form.notes, sportsbook: form.sportsbook || null, confidence: form.confidence || null,
      }
      const newBet = await createBet(bet)
      setBets(prev => [newBet, ...prev])
      resetAll()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleSettle = async (betId, result, bet) => {
    if (!settleOptionsFor(bet).includes(result)) return
    setSettling(betId)
    try {
      const units = Number(bet.stake_units || 0)
      const odds = Number(bet.odds)
      let actual_payout = 0
      if (result === 'win') actual_payout = (calcPayoutUnits(units, odds) + units) * unitSize
      else if (result === 'push' || result === 'void') actual_payout = units * unitSize
      await updateBetResult(betId, { result, actual_payout })
      setBets(prev => prev.map(b => b.id === betId ? { ...b, result, actual_payout } : b))
    } catch (err) { console.error(err) }
    finally { setSettling(null) }
  }

  const handleDelete = async (betId) => {
    if (!window.confirm('Delete this bet? This cannot be undone.')) return
    setDeleting(betId)
    try {
      await deleteBet(betId)
      setBets(prev => prev.filter(b => b.id !== betId))
    } catch (err) { console.error(err) }
    finally { setDeleting(null) }
  }

  const potentialUnits = calcPayoutUnits(form.stake_units, form.odds)

  // Parlays have no fight_id, so resolve their event date from the "A vs B" fights in their legs
  const hasPendingParlays = bets.some(b => b.result === 'pending' && isParlayBet(b))
  const myEventIds = myEvents.map(e => e.id)
  const legFightsQuery = useCachedQuery(['legFights', myEventIds], () => getFightsForEvents(myEventIds), { enabled: hasPendingParlays && myEventIds.length > 0 })
  const fightEventDates = useMemo(() => {
    const eventDates = new Map(myEvents.map(e => [e.id, e.event_date]))
    return new Map((legFightsQuery.data ?? NO_ROWS).map(f => [`${f.fighter_a} vs ${f.fighter_b}`, eventDates.get(f.event_id)]))
  }, [legFightsQuery.data, myEvents])

  const settleOptionsFor = (bet) => {
    if (!isParlayBet(bet)) return manualSettleOptions(bet, bet.event_date)
    if (legFightsQuery.loading) return []
    const dates = parseParlayLegs(bet).map(l => fightEventDates.get(l.fight)).filter(Boolean).sort()
    return manualSettleOptions(bet, dates[dates.length - 1])
  }

  const groupedBets = useMemo(() => {
    const groups = {}
    for (const bet of bets) {
      const key = bet.event_name || 'No event'
      if (!groups[key]) groups[key] = { eventName: key, eventDate: bet.event_date, bets: [] }
      groups[key].bets.push(bet)
    }
    return Object.values(groups).sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
  }, [bets])

  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groupedBets
    return groupedBets
      .map(g => ({ ...g, bets: g.bets.filter(b => filter === 'pending' ? b.result === 'pending' : b.result !== 'pending') }))
      .filter(g => g.bets.length)
  }, [groupedBets, filter])

  const summary = useMemo(() => {
    const t = { wins: 0, losses: 0, pushes: 0, pending: 0, profit: 0, settledStake: 0, pendingStake: 0, pendingToWin: 0 }
    for (const b of bets) {
      const units = Number(b.stake_units || 0)
      if (b.result === 'pending') {
        t.pending++
        t.pendingStake += units
        t.pendingToWin += calcPayoutUnits(units, b.odds)
        continue
      }
      if (b.result === 'win') t.wins++
      if (b.result === 'loss') t.losses++
      if (b.result === 'push') t.pushes++
      if (b.result !== 'void') t.settledStake += units
      t.profit += betProfitUnits(b)
    }
    t.roi = t.settledStake ? t.profit / t.settledStake * 100 : 0
    return t
  }, [bets])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  const isParlay = form.bet_type === 'parlay'
  const isProps = form.bet_type === 'props'
  const labelStyle = { fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const optionalTag = { textTransform: 'none', letterSpacing: 0, fontWeight: '400', color: 'var(--text-muted)' }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Bets</h1>
          {editingUnit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>1u = $</span>
              <input
                type="number"
                value={unitInput}
                onChange={e => setUnitInput(e.target.value)}
                style={{ width: '70px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
                autoFocus
              />
              <button
                onClick={async () => {
                  if (!unitInput || isNaN(unitInput)) return
                  setSavingUnit(true)
                  try { await saveUnitSize(Number(unitInput)); setUnitSize(Number(unitInput)); setEditingUnit(false) }
                  catch (err) { console.error(err) }
                  finally { setSavingUnit(false) }
                }}
                disabled={savingUnit}
                style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {savingUnit ? '...' : 'Save'}
              </button>
              <button onClick={() => setEditingUnit(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => { setEditingUnit(true); setUnitInput(String(unitSize)) }}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>1 unit = ${unitSize.toFixed(2)} <span style={{ color: 'var(--text-muted)', display: 'flex' }}><PencilIcon /></span></p>
            </button>
          )}
        </div>
        {!step && (
          <div className="page-header-actions">
            {bets.length > 0 && (
              <button onClick={() => exportBetsToCSV(bets)} style={{ ...btnGhost, fontSize: '12px', padding: '7px 14px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Export CSV</button>
            )}
            <button style={{ ...btnPrimary, background: 'var(--accent)', color: 'white', borderRadius: '8px', fontWeight: '600' }} onClick={() => setStep('pick-event')}>+ Add bet</button>
          </div>
        )}
      </div>

      {/* Step 1: Pick event */}
      {step === 'pick-event' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Select an event</div>
            <button onClick={resetAll} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allUpcomingEvents.map(event => (
              <div key={event.event_date || event.id}
                onClick={() => !addingEvent && handleSelectEvent(event)}
                style={{ padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', cursor: addingEvent ? 'wait' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: addingEvent === event.event_date ? 0.5 : 1 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{event.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {fmtEventDate(event.event_date)}
                    {event.location && event.location !== 'TBD' && ` · ${event.location}`}
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{addingEvent === event.event_date ? '...' : '→'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Fill bet form */}
      {step === 'fill-form' && selectedEvent && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{selectedEvent.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {fmtEventDate(selectedEvent.event_date)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep('pick-event')} style={{ ...btnGhost, fontSize: '12px', padding: '6px 12px' }}>← Change event</button>
              <button onClick={resetAll} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </div>

          {fetchingFights && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Loading fights...</div>}
          {!fetchingFights && !fights.length && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              No fights have been announced for this event yet. Check back once the card is posted.
            </div>
          )}

          {/* Bet type toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Bet type</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {BET_TYPES.map(t => (
                <button key={t} type="button"
                  onClick={() => { setForm(f => ({ ...f, bet_type: t, pick: '', prop_tier: 'fight', prop_fighter: '' })); setCustomPick(false) }}
                  style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: '1px solid var(--border-input)', cursor: 'pointer', background: form.bet_type === t ? 'var(--text-primary)' : 'var(--bg-input)', color: form.bet_type === t ? 'var(--bg)' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                  {t === 'moneyline' ? 'Moneyline' : t === 'parlay' ? 'Parlay' : 'Props'}
                </button>
              ))}
            </div>
          </div>

          {/* PARLAY BUILDER */}
          {isParlay ? (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Parlay legs ({parlayLegs.length})</div>
              {parlayLegs.map((leg, i) => {
                const legFight = fights.find(f => f.id === leg.fight_id)
                return (
                  <div key={i} style={{ background: 'var(--bg-hover)', borderRadius: '8px', padding: '14px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leg {i + 1}</span>
                      {parlayLegs.length > 2 && (
                        <button onClick={() => removeLeg(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fight *</label>
                        <select value={leg.fight_id} onChange={e => updateLeg(i, 'fight_id', e.target.value)} disabled={!fights.length} style={{ ...selectStyle, fontSize: '12px', padding: '7px 10px' }}>
                          <option value="">Select fight</option>
                          {fights.map(f => <option key={f.id} value={f.id}>{f.fighter_a} vs {f.fighter_b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pick *</label>
                        <select value={leg.pick} onChange={e => updateLeg(i, 'pick', e.target.value)} disabled={!legFight} style={{ ...selectStyle, fontSize: '12px', padding: '7px 10px', opacity: legFight ? 1 : 0.5 }}>
                          <option value="">{legFight ? 'Select' : 'Pick a fight first'}</option>
                          {legFight && <>
                            <option value={legFight.fighter_a}>{legFight.fighter_a}</option>
                            <option value={legFight.fighter_b}>{legFight.fighter_b}</option>
                            <optgroup label="Fighter A Props">
                              {FIGHTER_PROPS.map(o => <option key={`a-${o}`} value={`${legFight.fighter_a} ${o}`}>{legFight.fighter_a} {o}</option>)}
                            </optgroup>
                            <optgroup label="Fighter B Props">
                              {FIGHTER_PROPS.map(o => <option key={`b-${o}`} value={`${legFight.fighter_b} ${o}`}>{legFight.fighter_b} {o}</option>)}
                            </optgroup>
                            <optgroup label="Fight Props">
                              {FIGHT_PROPS.map(o => <option key={o} value={o}>{o}</option>)}
                            </optgroup>
                          </>}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Odds *</label>
                        <input value={leg.odds} onChange={e => updateLeg(i, 'odds', e.target.value)} style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <button onClick={addLeg} style={{ ...btnGhost, fontSize: '12px', padding: '7px 14px', marginBottom: '16px' }}>+ Add leg</button>
              {parlayOdds && (
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Combined odds</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{parlayOdds > 0 ? '+' : ''}{parlayOdds}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Legs</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{parlayLegs.filter(l => l.pick && l.odds).length} picks</span>
                  </div>
                  {form.stake_units && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>To win</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>+{parlayPotentialUnits.toFixed(2)}u (${(parlayPotentialUnits * unitSize).toFixed(2)})</span>
                    </div>
                  )}
                </div>
              )}
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Stake (units) *</label>
                  <input value={form.stake_units} onChange={e => setForm(f => ({ ...f, stake_units: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sportsbook <span style={optionalTag}>(optional)</span></label>
                  <select value={form.sportsbook} onChange={e => setForm(f => ({ ...f, sportsbook: e.target.value }))} style={selectStyle}>
                    <option value="">Select</option>
                    {SPORTSBOOKS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Confidence</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setForm(f => ({ ...f, confidence: f.confidence === n ? 0 : n }))}
                        style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--border-input)', background: form.confidence >= n ? 'var(--text-primary)' : 'var(--bg-input)', color: form.confidence >= n ? 'var(--bg)' : 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.15s' }}>
                        {n}
                      </button>
                    ))}
                    {form.confidence > 0 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>{['','Very low','Low','Medium','High','Very high'][form.confidence]}</span>}
                  </div>
                </div>
              </div>
            </div>

          ) : isProps ? (
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Fight *</label>
                <select value={form.fight_id} onChange={e => setForm(f => ({ ...f, fight_id: e.target.value, pick: '', prop_fighter: '' }))} disabled={!fights.length} style={{ ...selectStyle, opacity: fights.length ? 1 : 0.5 }}>
                  <option value="">Select fight</option>
                  {fights.map(f => <option key={f.id} value={f.id}>{f.fighter_a} vs {f.fighter_b}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Prop type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['fight','fighter'].map(tier => (
                    <button key={tier} type="button"
                      onClick={() => setForm(f => ({ ...f, prop_tier: tier, pick: '', prop_fighter: '' }))}
                      style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', border: '1px solid var(--border-input)', cursor: 'pointer', background: form.prop_tier === tier ? 'var(--text-primary)' : 'var(--bg-input)', color: form.prop_tier === tier ? 'var(--bg)' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                      {tier === 'fight' ? 'Fight Prop' : 'Fighter Prop'}
                    </button>
                  ))}
                </div>
              </div>
              {form.prop_tier === 'fighter' && (
                <div>
                  <label style={labelStyle}>Fighter *</label>
                  <select value={form.prop_fighter} onChange={e => setForm(f => ({ ...f, prop_fighter: e.target.value, pick: '' }))} disabled={!selectedFight} style={{ ...selectStyle, opacity: selectedFight ? 1 : 0.5 }}>
                    <option value="">{selectedFight ? 'Select fighter' : 'Pick a fight first'}</option>
                    {selectedFight && <>
                      <option value={selectedFight.fighter_a}>{selectedFight.fighter_a}</option>
                      <option value={selectedFight.fighter_b}>{selectedFight.fighter_b}</option>
                    </>}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: form.prop_tier === 'fighter' ? '2 / -1' : '1 / -1' }}>
                <label style={labelStyle}>{form.prop_tier === 'fighter' ? 'Fighter Prop *' : 'Fight Prop *'}</label>
                {!customPick ? (
                  <div>
                    <select value={form.pick} onChange={e => {
                      if (e.target.value === '__custom') { setCustomPick(true); setForm(f => ({ ...f, pick: '' })) }
                      else setForm(f => ({ ...f, pick: e.target.value }))
                    }} style={selectStyle}>
                      <option value="">Select prop</option>
                      {(form.prop_tier === 'fighter' ? FIGHTER_PROPS : FIGHT_PROPS).map(o => <option key={o} value={o}>{o}</option>)}
                      <option value="__custom">Other (type manually)</option>
                    </select>
                    <button type="button" onClick={() => setCustomPick(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>Type manually →</button>
                  </div>
                ) : (
                  <div>
                    <input value={form.pick} onChange={e => setForm(f => ({ ...f, pick: e.target.value }))} placeholder="Type your prop..." style={inputStyle} />
                    <button type="button" onClick={() => { setCustomPick(false); setForm(f => ({ ...f, pick: '' })) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>← Choose from list</button>
                  </div>
                )}
              </div>
              {(form.prop_tier === 'fight' ? form.pick : (form.prop_fighter && form.pick)) && (
                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Pick: </span>
                  <strong>{buildPropPick()}</strong>
                </div>
              )}
              <div>
                <label style={labelStyle}>Odds (American) *</label>
                <input value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Stake (units) *</label>
                <input value={form.stake_units} onChange={e => setForm(f => ({ ...f, stake_units: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sportsbook <span style={optionalTag}>(optional)</span></label>
                <select value={form.sportsbook} onChange={e => setForm(f => ({ ...f, sportsbook: e.target.value }))} style={selectStyle}>
                  <option value="">Select</option>
                  {SPORTSBOOKS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {form.stake_units && form.odds && (
                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span><span style={{ color: 'var(--text-secondary)' }}>Stake: </span><span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{form.stake_units}u = ${(Number(form.stake_units) * unitSize).toFixed(2)}</span></span>
                  <span><span style={{ color: 'var(--text-secondary)' }}>To win: </span><span style={{ color: '#16a34a', fontWeight: '600' }}>+{potentialUnits.toFixed(2)}u (${(potentialUnits * unitSize).toFixed(2)})</span></span>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Confidence</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, confidence: f.confidence === n ? 0 : n }))}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--border-input)', background: form.confidence >= n ? 'var(--text-primary)' : 'var(--bg-input)', color: form.confidence >= n ? 'var(--bg)' : 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.15s' }}>
                      {n}
                    </button>
                  ))}
                  {form.confidence > 0 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>{['','Very low','Low','Medium','High','Very high'][form.confidence]}</span>}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes <span style={optionalTag}>(optional)</span></label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
              </div>
            </div>

          ) : (
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Fight *</label>
                <select value={form.fight_id} onChange={e => setForm(f => ({ ...f, fight_id: e.target.value, pick: '' }))} disabled={!fights.length} style={{ ...selectStyle, opacity: fights.length ? 1 : 0.5 }}>
                  <option value="">Select fight</option>
                  {fights.map(f => <option key={f.id} value={f.id}>{f.fighter_a} vs {f.fighter_b}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Pick *</label>
                <select value={form.pick} onChange={e => setForm(f => ({ ...f, pick: e.target.value }))} disabled={!selectedFight} style={{ ...selectStyle, opacity: selectedFight ? 1 : 0.5 }}>
                  <option value="">{selectedFight ? 'Select fighter' : 'Pick a fight first'}</option>
                  {selectedFight && <>
                    <option value={selectedFight.fighter_a}>{selectedFight.fighter_a}</option>
                    <option value={selectedFight.fighter_b}>{selectedFight.fighter_b}</option>
                  </>}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Odds (American) *</label>
                <input value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Stake (units) *</label>
                <input value={form.stake_units} onChange={e => setForm(f => ({ ...f, stake_units: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sportsbook <span style={optionalTag}>(optional)</span></label>
                <select value={form.sportsbook} onChange={e => setForm(f => ({ ...f, sportsbook: e.target.value }))} style={selectStyle}>
                  <option value="">Select</option>
                  {SPORTSBOOKS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              {form.stake_units && form.odds && (
                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-hover)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span><span style={{ color: 'var(--text-secondary)' }}>Stake: </span><span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{form.stake_units}u = ${(Number(form.stake_units) * unitSize).toFixed(2)}</span></span>
                  <span><span style={{ color: 'var(--text-secondary)' }}>To win: </span><span style={{ color: '#16a34a', fontWeight: '600' }}>+{potentialUnits.toFixed(2)}u (${(potentialUnits * unitSize).toFixed(2)})</span></span>
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Confidence</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, confidence: f.confidence === n ? 0 : n }))}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--border-input)', background: form.confidence >= n ? 'var(--text-primary)' : 'var(--bg-input)', color: form.confidence >= n ? 'var(--bg)' : 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.15s' }}>
                      {n}
                    </button>
                  ))}
                  {form.confidence > 0 && <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>{['','Very low','Low','Medium','High','Very high'][form.confidence]}</span>}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notes <span style={optionalTag}>(optional)</span></label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSubmit} disabled={saving || !canSave} style={{ ...btnPrimary, opacity: saving || !canSave ? 0.5 : 1, cursor: saving || !canSave ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save bet'}</button>
            <button onClick={resetAll} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Summary + filters */}
      {!step && bets.length > 0 && (
        <>
          <div className="stat-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <SummaryStat label="Record" value={`${summary.wins}–${summary.losses}${summary.pushes ? `–${summary.pushes}` : ''}`} sub={summary.pushes ? 'W–L–P' : 'W–L'} />
            <SummaryStat label="Profit" value={fmtUnits(summary.profit)} sub={fmtDollars(summary.profit * unitSize)} color={profitColor(summary.profit)} />
            <SummaryStat label="ROI" value={`${summary.roi >= 0 ? '+' : ''}${summary.roi.toFixed(1)}%`} sub={`on ${Number(summary.settledStake.toFixed(2))}u settled`} color={profitColor(summary.roi)} />
            <SummaryStat label="Pending" value={`${Number(summary.pendingStake.toFixed(2))}u`} sub={summary.pending ? `${summary.pending} bet${summary.pending !== 1 ? 's' : ''} · to win ${summary.pendingToWin.toFixed(2)}u` : 'nothing open'} />
          </div>

          <div role="tablist" style={{ display: 'inline-flex', background: 'var(--bg-hover)', borderRadius: '10px', padding: '3px', gap: '2px', marginBottom: '16px' }}>
            {BET_FILTERS.map(({ key, label }) => {
              const count = key === 'all' ? bets.length : key === 'pending' ? summary.pending : bets.length - summary.pending
              const active = filter === key
              return (
                <button key={key} role="tab" aria-selected={active} onClick={() => setFilter(key)} style={{
                  padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
                  border: 'none', cursor: 'pointer',
                  background: active ? 'var(--bg-card)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {label} <span className="num" style={{ color: 'var(--text-muted)', fontWeight: '500' }}>{count}</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Bets grouped by event */}
      {!step && (
        <div>
          {bets.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No bets yet</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click "+ Add bet" to get started</div>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '40px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {filter === 'pending' ? 'No pending bets' : 'No settled bets yet'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {visibleGroups.map(group => {
                const wins = group.bets.filter(b => b.result === 'win').length
                const losses = group.bets.filter(b => b.result === 'loss').length
                const pending = group.bets.filter(b => b.result === 'pending').length
                const groupProfit = group.bets.reduce((sum, b) => sum + betProfitUnits(b), 0)
                const hasSettled = wins + losses > 0
                return (
                  <div key={group.eventName} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div className="bet-group-header" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{group.eventName}</div>
                        {group.eventDate && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {fmtEventDate(group.eventDate)}
                          </div>
                        )}
                      </div>
                      <div className="bet-group-stats" style={{ alignItems: 'center' }}>
                        {hasSettled && <span className="num" style={{ fontWeight: '600' }}>{wins}–{losses}</span>}
                        {pending > 0 && <span>{pending} pending</span>}
                        {hasSettled && (
                          <span className="num" style={{
                            fontWeight: '700', padding: '3px 8px', borderRadius: '999px', color: profitColor(groupProfit),
                            background: groupProfit > 0 ? 'rgba(22,163,74,0.12)' : groupProfit < 0 ? 'rgba(220,38,38,0.12)' : 'var(--bg-hover)',
                          }}>
                            {fmtUnits(groupProfit)}
                          </span>
                        )}
                      </div>
                    </div>
                    {group.bets.map((bet, i) => {
                      const profitUnits = betProfitUnits(bet)
                      const isLast = i === group.bets.length - 1
                      const parlay = isParlayBet(bet)
                      const legs = parlay ? parseParlayLegs(bet) : []
                      const expanded = expandedBets.has(bet.id)
                      return (
                        <div key={bet.id} className="bet-row" style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border)', borderLeft: `3px solid ${RESULT_COLORS[bet.result] || 'var(--text-faint)'}` }}>
                          <div className="bet-row-main">
                            <div className="bet-row-top">
                              <span className="bet-pick" style={{ fontSize: '14px', fontWeight: '600', color: bet.result === 'loss' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{bet.pick}</span>
                              {parlay && (
                                <button onClick={() => toggleExpanded(bet.id)} aria-expanded={expanded} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
                                  color: 'var(--text-secondary)', background: 'var(--bg-hover)', border: 'none', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer',
                                }}>
                                  PARLAY · {legs.length} LEGS <ChevronIcon open={expanded} />
                                </button>
                              )}
                              {bet.bet_type === 'props' && (
                                <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', borderRadius: '4px', padding: '3px 6px' }}>PROP</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px 12px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <span className="num" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                {bet.stake_units}u <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>@</span> {fmtOdds(bet.odds)}
                              </span>
                              {bet.sportsbook && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '600' }}>
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${SPORTSBOOK_DOMAINS[bet.sportsbook] || 'google.com'}&sz=32`}
                                    alt=""
                                    style={{ width: '14px', height: '14px', borderRadius: '3px' }}
                                    onError={e => e.target.style.display = 'none'}
                                  />
                                  {bet.sportsbook}
                                </span>
                              )}
                              {bet.confidence > 0 && <ConfidenceMeter value={bet.confidence} />}
                            </div>
                            {parlay && expanded && (
                              <ol style={{ listStyle: 'none', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '10px', borderLeft: '2px solid var(--border)' }}>
                                {legs.map((leg, li) => (
                                  <li key={li} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{leg.pick}</span>
                                    {leg.odds && <span className="num" style={{ marginLeft: '6px' }}>{fmtOdds(leg.odds)}</span>}
                                    {leg.fight && <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>· {leg.fight}</span>}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                          {bet.result === 'pending' ? (
                            <div className='bet-row-side bet-settle-btns' style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="num" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>
                                <ClockIcon /> to win {calcPayoutUnits(bet.stake_units, bet.odds).toFixed(2)}u
                              </span>
                              {settleOptionsFor(bet).map(result => {
                                const b = SETTLE_BUTTONS[result]
                                return <button key={result} onClick={() => handleSettle(bet.id, result, bet)} disabled={settling === bet.id} style={{ background: b.background, color: b.color, border: `1px solid ${b.border}`, borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{b.label}</button>
                              })}
                              <button onClick={() => handleDelete(bet.id)} disabled={deleting === bet.id} aria-label="Delete bet" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 4px' }}>×</button>
                            </div>
                          ) : (
                            <div className="bet-row-side" style={{ textAlign: 'right' }}>
                              <div className="num" style={{ fontSize: '15px', fontWeight: '700', color: bet.result === 'win' || bet.result === 'loss' ? profitColor(profitUnits) : RESULT_COLORS[bet.result] }}>
                                {bet.result === 'void' ? 'Void' : bet.result === 'push' ? 'Push' : fmtUnits(profitUnits)}
                              </div>
                              <div className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {bet.result === 'void' || bet.result === 'push' ? 'stake returned' : fmtDollars(profitUnits * unitSize)}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}