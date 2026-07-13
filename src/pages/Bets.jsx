import { useEffect, useState, useMemo } from 'react'
import { getBets, getEvents, createEvent, getFightsByEvent, createFight, createBet, updateBetResult, getUnitSize } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import { getFightsByDate } from '../lib/mmaApi'

const UPCOMING_UFC_EVENTS = [
  { name: 'UFC Fight Night: Du Plessis vs Usman', promotion: 'UFC', event_date: '2026-07-18', location: 'TBD', status: 'upcoming' },
  { name: 'UFC Fight Night: Ankalaev vs Rountree Jr', promotion: 'UFC', event_date: '2026-07-25', location: 'Abu Dhabi, UAE', status: 'upcoming' },
  { name: 'UFC Fight Night: Serbia', promotion: 'UFC', event_date: '2026-08-01', location: 'Serbia', status: 'upcoming' },
  { name: 'UFC Fight Night: Gamrot vs Salkilld', promotion: 'UFC', event_date: '2026-08-08', location: 'TBD', status: 'upcoming' },
  { name: 'UFC 330: Makhachev vs Machado Garry', promotion: 'UFC', event_date: '2026-08-15', location: 'Philadelphia, PA', status: 'upcoming' },
  { name: 'UFC Fight Night: TBD', promotion: 'UFC', event_date: '2026-09-05', location: 'TBD', status: 'upcoming' },
]

const BET_TYPES = ['moneyline', 'parlay', 'round_prop', 'method_prop', 'over_under', 'other']
const empty = { fight_id: '', bet_type: 'moneyline', pick: '', odds: '', stake_units: '', notes: '' }

const calcPayoutUnits = (units, odds) => {
  const u = Number(units), o = Number(odds)
  if (!u || !o) return 0
  return o > 0 ? u * o / 100 : u * 100 / Math.abs(o)
}

const resultBadge = (result) => {
  const base = { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }
  if (result === 'win') return { ...base, color: '#16a34a', background: '#f0fdf4' }
  if (result === 'loss') return { ...base, color: '#dc2626', background: '#fef2f2' }
  if (result === 'push') return { ...base, color: '#d97706', background: '#fffbeb' }
  return { ...base, color: '#888', background: '#f5f5f5' }
}

const inputStyle = { width: '100%', background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', outline: 'none' }
const selectStyle = { ...inputStyle, cursor: 'pointer' }
const btnPrimary = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#888', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }

export default function Bets() {
  const { user } = useAuth()
  const [bets, setBets] = useState([])
  const [myEvents, setMyEvents] = useState([])
  const [fights, setFights] = useState([])
  const [unitSize, setUnitSize] = useState(10)
  const [loading, setLoading] = useState(true)

  // Step: null | 'pick-event' | 'fill-form'
  const [step, setStep] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [addingEvent, setAddingEvent] = useState(null)
  const [fetchingFights, setFetchingFights] = useState(false)

  const [form, setForm] = useState(empty)
  const [customPick, setCustomPick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settling, setSettling] = useState(null)

  const [filterEvent, setFilterEvent] = useState('all')
  const [filterResult, setFilterResult] = useState('all')
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    if (!user) return
    getBets(user.id).then(setBets).catch(console.error)
    getEvents().then(setMyEvents).catch(console.error)
    getUnitSize().then(setUnitSize).catch(console.error).finally(() => setLoading(false))
  }, [user])

  const myEventDates = new Set(myEvents.map(e => e.event_date))
  const futureEvents = UPCOMING_UFC_EVENTS.filter(e => new Date(e.event_date) >= new Date())

  const handleSelectEvent = async (ufc) => {
    setAddingEvent(ufc.event_date)
    try {
      let event = myEvents.find(e => e.event_date === ufc.event_date)
      if (!event) {
        event = await createEvent(ufc)
        setMyEvents(prev => [event, ...prev])
      }
      setSelectedEvent(event)

      // Load fights for this event
      setFetchingFights(true)
      let eventFights = await getFightsByEvent(event.id)

      // If no fights yet, try fetching from API
      if (!eventFights.length) {
        try {
          const apiFights = await getFightsByDate(event.event_date)
          for (const [i, f] of apiFights.entries()) {
            const fighterA = f.fighters?.first?.name
            const fighterB = f.fighters?.second?.name
            if (!fighterA || !fighterB) continue
            const winner = f.fighters?.first?.winner ? fighterA : f.fighters?.second?.winner ? fighterB : null
            await createFight({ event_id: event.id, fighter_a: fighterA, fighter_b: fighterB, weight_class: f.category || '', rounds: 3, fight_order: i + 1, winner })
          }
          eventFights = await getFightsByEvent(event.id)
        } catch (err) {
          console.error('Could not auto-fetch fights:', err)
        }
      }

      setFights(eventFights)
      setStep('fill-form')
    } catch (err) {
      console.error(err)
    } finally {
      setAddingEvent(null)
      setFetchingFights(false)
    }
  }

  const selectedFight = fights.find(f => f.id === form.fight_id)

  const handlePickSelect = (e) => {
    const val = e.target.value
    if (val === '__custom') { setCustomPick(true); setForm(f => ({ ...f, pick: '' })) }
    else { setCustomPick(false); setForm(f => ({ ...f, pick: val })) }
  }

  const resetAll = () => {
    setStep(null)
    setSelectedEvent(null)
    setFights([])
    setForm(empty)
    setCustomPick(false)
  }

  const handleSubmit = async () => {
    if (!form.pick || !form.odds || !form.stake_units) return
    setSaving(true)
    try {
      const units = Number(form.stake_units)
      const odds = Number(form.odds)
      const potentialUnits = calcPayoutUnits(units, odds)
      const bet = {
        fight_id: form.fight_id || null,
        bet_type: form.bet_type,
        pick: form.pick,
        odds,
        stake: units * unitSize,
        stake_units: units,
        potential_payout: potentialUnits * unitSize + units * unitSize,
        notes: form.notes,
      }
      const newBet = await createBet(bet)
      setBets(prev => [newBet, ...prev])
      resetAll()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const handleSettle = async (betId, result, bet) => {
    setSettling(betId)
    try {
      const units = Number(bet.stake_units || 0)
      const odds = Number(bet.odds)
      let actual_payout = 0
      if (result === 'win') actual_payout = (calcPayoutUnits(units, odds) + units) * unitSize
      else if (result === 'push') actual_payout = units * unitSize
      await updateBetResult(betId, { result, actual_payout })
      setBets(prev => prev.map(b => b.id === betId ? { ...b, result, actual_payout } : b))
    } catch (err) { console.error(err) }
    finally { setSettling(null) }
  }

  const potentialUnits = calcPayoutUnits(form.stake_units, form.odds)
  const eventOptions = useMemo(() => Array.from(new Set(bets.map(b => b.event_name).filter(Boolean))), [bets])

  const filteredBets = useMemo(() => bets.filter(b => {
    if (filterEvent !== 'all' && b.event_name !== filterEvent) return false
    if (filterResult !== 'all' && b.result !== filterResult) return false
    if (filterType !== 'all' && b.bet_type !== filterType) return false
    return true
  }), [bets, filterEvent, filterResult, filterType])

  const pendingBets = filteredBets.filter(b => b.result === 'pending')
  const settledBets = filteredBets.filter(b => b.result !== 'pending')
  const activeFilterCount = [filterEvent, filterResult, filterType].filter(f => f !== 'all').length

  const filterSelectStyle = { background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', color: '#1a1a1a', cursor: 'pointer', outline: 'none' }

  if (loading) return <div style={{ color: '#aaa', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.4px', marginBottom: '4px' }}>Bets</h1>
          <p style={{ fontSize: '13px', color: '#aaa' }}>1 unit = ${unitSize.toFixed(2)}</p>
        </div>
        {!step && <button style={btnPrimary} onClick={() => setStep('pick-event')}>+ Add bet</button>}
      </div>

      {/* Step 1: Pick event */}
      {step === 'pick-event' && (
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>Select an event</div>
            <button onClick={resetAll} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
          </div>

          {/* Also show past tracked events in case they want to bet on a recent card */}
          {myEvents.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Your tracked events</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {myEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={() => handleSelectEvent({ ...event, event_date: event.event_date })}
                    style={{ padding: '12px 16px', background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{event.name}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                        {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {futureEvents.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Upcoming UFC events</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {futureEvents.filter(e => !myEventDates.has(e.event_date)).map(event => (
                  <div
                    key={event.event_date}
                    onClick={() => !addingEvent && handleSelectEvent(event)}
                    style={{ padding: '12px 16px', background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '8px', cursor: addingEvent ? 'wait' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: addingEvent === event.event_date ? 0.5 : 1 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{event.name}</div>
                      <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                        {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {event.location !== 'TBD' && ` · ${event.location}`}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: '#aaa' }}>{addingEvent === event.event_date ? '...' : '→'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Fill bet form */}
      {step === 'fill-form' && selectedEvent && (
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{selectedEvent.name}</div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
                {new Date(selectedEvent.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep('pick-event')} style={{ ...btnGhost, fontSize: '12px', padding: '6px 12px' }}>← Change event</button>
              <button onClick={resetAll} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </div>

          {fetchingFights && <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '16px' }}>Loading fights...</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fight</label>
              <select value={form.fight_id} onChange={e => { setForm(f => ({ ...f, fight_id: e.target.value, pick: '' })); setCustomPick(false) }} style={{ ...selectStyle, opacity: fights.length ? 1 : 0.5 }}>
                <option value="">Select fight (optional)</option>
                {fights.map(f => <option key={f.id} value={f.id}>{f.fighter_a} vs {f.fighter_b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bet type</label>
              <select name="bet_type" value={form.bet_type} onChange={e => setForm(f => ({ ...f, bet_type: e.target.value }))} style={selectStyle}>
                {BET_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pick *</label>
              {selectedFight && !customPick ? (
                <select value={form.pick} onChange={handlePickSelect} style={selectStyle}>
                  <option value="">Select fighter</option>
                  <option value={selectedFight.fighter_a}>{selectedFight.fighter_a}</option>
                  <option value={selectedFight.fighter_b}>{selectedFight.fighter_b}</option>
                  <option value="__custom">Other (type manually)</option>
                </select>
              ) : (
                <div>
                  <input name="pick" value={form.pick} onChange={e => setForm(f => ({ ...f, pick: e.target.value }))} placeholder="e.g. Islam Makhachev" style={inputStyle} />
                  {selectedFight && <button type="button" onClick={() => setCustomPick(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>← Choose fighter instead</button>}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Odds (American) *</label>
              <input name="odds" value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} placeholder="-150 or +200" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stake (units) *</label>
              <input name="stake_units" value={form.stake_units} onChange={e => setForm(f => ({ ...f, stake_units: e.target.value }))} placeholder={`e.g. 2 = $${(2 * unitSize).toFixed(0)}`} style={inputStyle} />
            </div>
            {form.stake_units && form.odds && (
              <div style={{ gridColumn: '1 / -1', background: '#f9fafb', border: '1px solid #e5e5e5', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span><span style={{ color: '#aaa' }}>Stake: </span><span style={{ color: '#1a1a1a', fontWeight: '600' }}>{form.stake_units}u = ${(Number(form.stake_units) * unitSize).toFixed(2)}</span></span>
                <span><span style={{ color: '#aaa' }}>To win: </span><span style={{ color: '#16a34a', fontWeight: '600' }}>+{potentialUnits.toFixed(2)}u (${(potentialUnits * unitSize).toFixed(2)})</span></span>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', color: '#aaa', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
              <input name="notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional — parlay legs, reasoning..." style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save bet'}</button>
            <button onClick={resetAll} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      {!step && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={filterSelectStyle}>
            <option value="all">All events</option>
            {eventOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={filterResult} onChange={e => setFilterResult(e.target.value)} style={filterSelectStyle}>
            <option value="all">All results</option>
            <option value="pending">Pending</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="push">Push</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterSelectStyle}>
            <option value="all">All bet types</option>
            {BET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {activeFilterCount > 0 && (
            <button onClick={() => { setFilterEvent('all'); setFilterResult('all'); setFilterType('all') }}
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}>
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      )}

      {/* Pending bets */}
      {!step && pendingBets.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Pending ({pendingBets.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingBets.map(bet => (
              <div key={bet.id} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{bet.pick}</span>
                    <span style={{ fontSize: '11px', color: '#aaa', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>{bet.bet_type}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa' }}>
                    {bet.event_name && `${bet.event_name} · `}
                    {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u (${Number(bet.stake).toFixed(2)})
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#aaa', marginRight: '4px' }}>To win: +{calcPayoutUnits(bet.stake_units, bet.odds).toFixed(2)}u</span>
                  <button onClick={() => handleSettle(bet.id, 'win', bet)} disabled={settling === bet.id}
                    style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Win</button>
                  <button onClick={() => handleSettle(bet.id, 'loss', bet)} disabled={settling === bet.id}
                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Loss</button>
                  <button onClick={() => handleSettle(bet.id, 'push', bet)} disabled={settling === bet.id}
                    style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Push</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settled bets */}
      {!step && settledBets.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#aaa', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Settled ({settledBets.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {settledBets.map(bet => {
              const profitUnits = bet.result === 'win' ? calcPayoutUnits(bet.stake_units, bet.odds) : bet.result === 'loss' ? -Number(bet.stake_units) : 0
              return (
                <div key={bet.id} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>{bet.pick}</span>
                      <span style={resultBadge(bet.result)}>{bet.result}</span>
                      <span style={{ fontSize: '11px', color: '#aaa', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>{bet.bet_type}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#aaa' }}>
                      {bet.event_name && `${bet.event_name} · `}
                      {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u (${Number(bet.stake).toFixed(2)})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: profitUnits >= 0 ? '#16a34a' : '#dc2626' }}>
                      {profitUnits >= 0 ? '+' : ''}{profitUnits.toFixed(2)}u
                    </div>
                    <div style={{ fontSize: '12px', color: profitUnits >= 0 ? '#86efac' : '#fca5a5' }}>
                      ${(profitUnits * unitSize).toFixed(2)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!step && filteredBets.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#aaa', marginBottom: '4px' }}>{bets.length === 0 ? 'No bets yet' : 'No bets match these filters'}</div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>{bets.length === 0 ? 'Click "+ Add bet" to get started' : 'Try adjusting the filters above'}</div>
        </div>
      )}
    </div>
  )
}