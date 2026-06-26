import { useEffect, useState, useMemo } from 'react'
import { getBets, getEvents, getFightsByEvent, createBet, updateBetResult, getUnitSize } from '../lib/db'
import { useAuth } from '../lib/AuthContext'

const BET_TYPES = ['moneyline', 'parlay', 'round_prop', 'method_prop', 'over_under', 'other']
const empty = { fight_id: '', bet_type: 'moneyline', pick: '', odds: '', stake_units: '', notes: '' }

const calcPayoutUnits = (units, odds) => {
  const u = Number(units), o = Number(odds)
  if (!u || !o) return 0
  return o > 0 ? u * o / 100 : u * 100 / Math.abs(o)
}

const resultColor = (result) => {
  if (result === 'win') return 'text-green-400 bg-green-400/10'
  if (result === 'loss') return 'text-red-400 bg-red-400/10'
  if (result === 'push') return 'text-yellow-400 bg-yellow-400/10'
  return 'text-gray-400 bg-gray-400/10'
}

export default function Bets() {
  const { user } = useAuth()
  const [bets, setBets] = useState([])
  const [events, setEvents] = useState([])
  const [fights, setFights] = useState([])
  const [unitSize, setUnitSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [selectedEvent, setSelectedEvent] = useState('')
  const [saving, setSaving] = useState(false)
  const [settling, setSettling] = useState(null)
  const [customPick, setCustomPick] = useState(false)

  // Filters
  const [filterEvent, setFilterEvent] = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    if (user) getBets(user.id).then(setBets).catch(console.error)
    getEvents().then(setEvents).catch(console.error)
    getUnitSize().then(setUnitSize).catch(console.error).finally(() => setLoading(false))
  }, [user])

  const selectedFight = fights.find(f => f.id === form.fight_id)

  const handleEventChange = async (eventId) => {
    setSelectedEvent(eventId)
    setForm(f => ({ ...f, fight_id: '', pick: '' }))
    setCustomPick(false)
    if (!eventId) return setFights([])
    const f = await getFightsByEvent(eventId)
    setFights(f)
  }

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleFightChange = (e) => {
    setForm(f => ({ ...f, fight_id: e.target.value, pick: '' }))
    setCustomPick(false)
  }

  const handlePickSelect = (e) => {
    const val = e.target.value
    if (val === '__custom') {
      setCustomPick(true)
      setForm(f => ({ ...f, pick: '' }))
    } else {
      setCustomPick(false)
      setForm(f => ({ ...f, pick: val }))
    }
  }

  const resetForm = () => {
    setForm(empty)
    setSelectedEvent('')
    setFights([])
    setCustomPick(false)
  }

  const handleSubmit = async () => {
    if (!form.pick || !form.odds || !form.stake_units) return
    setSaving(true)
    try {
      const units = Number(form.stake_units)
      const dollarStake = units * unitSize
      const odds = Number(form.odds)
      const potentialUnits = calcPayoutUnits(units, odds)
      const potentialPayout = potentialUnits * unitSize + dollarStake
      const bet = {
        fight_id: form.fight_id || null,
        bet_type: form.bet_type,
        pick: form.pick,
        odds,
        stake: dollarStake,
        stake_units: units,
        potential_payout: potentialPayout,
        notes: form.notes,
      }
      const newBet = await createBet(bet)
      setBets(prev => [newBet, ...prev])
      resetForm()
      setShowForm(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleSettle = async (betId, result, bet) => {
    setSettling(betId)
    try {
      const units = Number(bet.stake_units || 0)
      const odds = Number(bet.odds)
      let actual_payout = 0
      if (result === 'win') {
        const profitUnits = calcPayoutUnits(units, odds)
        actual_payout = (profitUnits + units) * unitSize
      } else if (result === 'push') {
        actual_payout = units * unitSize
      }
      await updateBetResult(betId, { result, actual_payout })
      setBets(prev => prev.map(b => b.id === betId ? { ...b, result, actual_payout } : b))
    } catch (err) {
      console.error(err)
    } finally {
      setSettling(null)
    }
  }

  const potentialUnits = calcPayoutUnits(form.stake_units, form.odds)

  const eventOptions = useMemo(() => {
    const names = new Set(bets.map(b => b.event_name).filter(Boolean))
    return Array.from(names)
  }, [bets])

  const filteredBets = useMemo(() => {
    return bets.filter(b => {
      if (filterEvent !== 'all' && b.event_name !== filterEvent) return false
      if (filterResult !== 'all' && b.result !== filterResult) return false
      if (filterType !== 'all' && b.bet_type !== filterType) return false
      return true
    })
  }, [bets, filterEvent, filterResult, filterType])

  const pendingBets = filteredBets.filter(b => b.result === 'pending')
  const settledBets = filteredBets.filter(b => b.result !== 'pending')

  const activeFilterCount = [filterEvent, filterResult, filterType].filter(f => f !== 'all').length

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Bets</h1>
          <p className="text-gray-500 text-sm">1 unit = ${unitSize.toFixed(2)}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add bet
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
        >
          <option value="all">All events</option>
          {eventOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>

        <select
          value={filterResult}
          onChange={e => setFilterResult(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
        >
          <option value="all">All results</option>
          <option value="pending">Pending</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="push">Push</option>
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
        >
          <option value="all">All bet types</option>
          {BET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {activeFilterCount > 0 && (
          <button
            onClick={() => { setFilterEvent('all'); setFilterResult('all'); setFilterType('all') }}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Clear filters ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Add bet form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">New bet</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Event</label>
              <select value={selectedEvent} onChange={e => handleEventChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                <option value="">Select event</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Fight</label>
              <select value={form.fight_id} onChange={handleFightChange} disabled={!fights.length}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 disabled:opacity-40">
                <option value="">Select fight (optional)</option>
                {fights.map(f => <option key={f.id} value={f.id}>{f.fighter_a} vs {f.fighter_b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Bet type</label>
              <select name="bet_type" value={form.bet_type} onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                {BET_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Pick *</label>
              {selectedFight && !customPick ? (
                <select value={form.pick} onChange={handlePickSelect}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                  <option value="">Select fighter</option>
                  <option value={selectedFight.fighter_a}>{selectedFight.fighter_a}</option>
                  <option value={selectedFight.fighter_b}>{selectedFight.fighter_b}</option>
                  <option value="__custom">Other (type manually)</option>
                </select>
              ) : (
                <>
                  <input name="pick" value={form.pick} onChange={handleChange}
                    placeholder="e.g. Islam Makhachev or Over 2.5 rounds"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
                  {selectedFight && (
                    <button type="button" onClick={() => setCustomPick(false)}
                      className="text-xs text-gray-500 hover:text-white mt-1 transition-colors">
                      ← Choose fighter instead
                    </button>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Odds (American) *</label>
              <input name="odds" value={form.odds} onChange={handleChange} placeholder="e.g. -150 or +200"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Stake (units) *</label>
              <input name="stake_units" value={form.stake_units} onChange={handleChange} placeholder="e.g. 2 = $20"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
            </div>
            {form.stake_units && form.odds && (
              <div className="col-span-2 bg-gray-800 rounded-lg px-4 py-3 text-sm flex justify-between">
                <span>
                  <span className="text-gray-400">Stake: </span>
                  <span className="text-white font-medium">{form.stake_units}u = ${(Number(form.stake_units) * unitSize).toFixed(2)}</span>
                </span>
                <span>
                  <span className="text-gray-400">To win: </span>
                  <span className="text-green-400 font-semibold">+{potentialUnits.toFixed(2)}u (${(potentialUnits * unitSize).toFixed(2)})</span>
                </span>
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <input name="notes" value={form.notes} onChange={handleChange} placeholder="Optional — parlay legs, reasoning, etc."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Saving...' : 'Save bet'}
            </button>
            <button onClick={() => { resetForm(); setShowForm(false) }}
              className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending bets */}
      {pendingBets.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Pending ({pendingBets.length})</h2>
          <div className="flex flex-col gap-3">
            {pendingBets.map(bet => (
              <div key={bet.id} className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold">{bet.pick}</span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{bet.bet_type}</span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {bet.event_name && `${bet.event_name} · `}
                    Odds: {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u (${Number(bet.stake).toFixed(2)})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 mr-2">
                    To win: +{calcPayoutUnits(bet.stake_units, bet.odds).toFixed(2)}u
                  </span>
                  <button onClick={() => handleSettle(bet.id, 'win', bet)} disabled={settling === bet.id}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                    Win
                  </button>
                  <button onClick={() => handleSettle(bet.id, 'loss', bet)} disabled={settling === bet.id}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                    Loss
                  </button>
                  <button onClick={() => handleSettle(bet.id, 'push', bet)} disabled={settling === bet.id}
                    className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                    Push
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settled bets */}
      {settledBets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Settled ({settledBets.length})</h2>
          <div className="flex flex-col gap-3">
            {settledBets.map(bet => {
              const profitUnits = bet.result === 'win'
                ? calcPayoutUnits(bet.stake_units, bet.odds)
                : bet.result === 'loss' ? -Number(bet.stake_units) : 0
              return (
                <div key={bet.id} className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold">{bet.pick}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resultColor(bet.result)}`}>
                        {bet.result}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{bet.bet_type}</span>
                    </div>
                    <p className="text-gray-500 text-sm">
                      {bet.event_name && `${bet.event_name} · `}
                      Odds: {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u (${Number(bet.stake).toFixed(2)})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${profitUnits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profitUnits >= 0 ? '+' : ''}{profitUnits.toFixed(2)}u
                    </p>
                    <p className={`text-xs ${profitUnits >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${(profitUnits * unitSize).toFixed(2)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {filteredBets.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-white font-medium mb-1">{bets.length === 0 ? 'No bets yet' : 'No bets match these filters'}</p>
          <p className="text-gray-500 text-sm">{bets.length === 0 ? 'Add your first bet to start tracking' : 'Try adjusting the filters above'}</p>
        </div>
      )}
    </div>
  )
}