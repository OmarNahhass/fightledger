import { useEffect, useState, useMemo } from 'react'
import { getBets, getEvents, createEvent, getFightsByEvent, createFight, createBet, updateBetResult, getUnitSize } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import { getFightsByDate } from '../lib/mmaApi'
import { exportBetsToCSV } from '../lib/exportCSV'

const UPCOMING_UFC_EVENTS = [
  { name: 'UFC Fight Night: Du Plessis vs Usman', promotion: 'UFC', event_date: '2026-07-18', location: 'TBD', status: 'upcoming' },
  { name: 'UFC Fight Night: Ankalaev vs Rountree Jr', promotion: 'UFC', event_date: '2026-07-25', location: 'Abu Dhabi, UAE', status: 'upcoming' },
  { name: 'UFC Fight Night: Serbia', promotion: 'UFC', event_date: '2026-08-01', location: 'Serbia', status: 'upcoming' },
  { name: 'UFC Fight Night: Gamrot vs Salkilld', promotion: 'UFC', event_date: '2026-08-08', location: 'TBD', status: 'upcoming' },
  { name: 'UFC 330: Makhachev vs Machado Garry', promotion: 'UFC', event_date: '2026-08-15', location: 'Philadelphia, PA', status: 'upcoming' },
  { name: 'UFC Fight Night: TBD', promotion: 'UFC', event_date: '2026-09-05', location: 'TBD', status: 'upcoming' },
]

const BET_TYPES = ['moneyline', 'parlay', 'round_prop', 'method_prop', 'over_under', 'other']
const SPORTSBOOKS = ['DraftKings', 'FanDuel', 'BetMGM', 'Caesars', 'PointsBet', 'BetRivers', 'ESPN Bet', 'Other']
const empty = { fight_id: '', bet_type: 'moneyline', pick: '', odds: '', stake_units: '', notes: '', sportsbook: '', confidence: 0 }

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
  return { ...base, color: 'var(--text-secondary)', background: 'var(--bg-hover)' }
}

const getPropOptions = (betType, fighterA, fighterB) => {
  const f1 = fighterA || 'Fighter A'
  const f2 = fighterB || 'Fighter B'

  if (betType === 'moneyline') return [f1, f2]

  if (betType === 'method_prop') return [
    `${f1} by KO/TKO`,
    `${f1} by Submission`,
    `${f1} by Decision`,
    `${f1} by Unanimous Decision`,
    `${f1} by Split Decision`,
    `${f2} by KO/TKO`,
    `${f2} by Submission`,
    `${f2} by Decision`,
    `${f2} by Unanimous Decision`,
    `${f2} by Split Decision`,
    'Goes to Decision',
    'Does not go to Decision',
    'Fight ends by KO/TKO',
    'Fight ends by Submission',
    'No Contest',
  ]

  if (betType === 'round_prop') return [
    'Ends in Round 1',
    'Ends in Round 2',
    'Ends in Round 3',
    'Ends in Round 4',
    'Ends in Round 5',
    'Ends in Rounds 1-2',
    'Ends in Rounds 3-4',
    'Ends in Rounds 1/2 (within first 2)',
    'Ends in Rounds 3/4 (within second 2)',
    'Fight to start Round 2',
    'Fight to start Round 3',
    'Fight to start Round 4',
    'Fight to start Round 5',
    'Fight does not start Round 2',
    'Fight does not start Round 3',
    `${f1} to finish in Round 1`,
    `${f1} to finish in Round 2`,
    `${f1} to finish in Round 3`,
    `${f2} to finish in Round 1`,
    `${f2} to finish in Round 2`,
    `${f2} to finish in Round 3`,
  ]

  if (betType === 'over_under') return [
    'Over 0.5 rounds',
    'Under 0.5 rounds',
    'Over 1.5 rounds',
    'Under 1.5 rounds',
    'Over 2.5 rounds',
    'Under 2.5 rounds',
    'Over 3.5 rounds',
    'Under 3.5 rounds',
    'Over 4.5 rounds',
    'Under 4.5 rounds',
  ]

  if (betType === 'other') return [
    'Fight goes the distance',
    'Fight does not go the distance',
    `${f1} to win by finish`,
    `${f2} to win by finish`,
    `${f1} wins Round 1`,
    `${f2} wins Round 1`,
    `${f1} knocked down`,
    `${f2} knocked down`,
    'At least one knockdown',
    'Fight stopped by doctor',
    'Technical draw',
    'No Contest',
  ]

  return []
}

const inputStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }
const selectStyle = { ...inputStyle, cursor: 'pointer' }
const btnPrimary = { background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }

export default function Bets() {
  const { user } = useAuth()
  const [bets, setBets] = useState([])
  const [myEvents, setMyEvents] = useState([])
  const [fights, setFights] = useState([])
  const [unitSize, setUnitSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [addingEvent, setAddingEvent] = useState(null)
  const [fetchingFights, setFetchingFights] = useState(false)
  const [form, setForm] = useState(empty)
  const [customPick, setCustomPick] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settling, setSettling] = useState(null)

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
      setFetchingFights(true)
      let eventFights = await getFightsByEvent(event.id)
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
        sportsbook: form.sportsbook || null,
        confidence: form.confidence || null,
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

  const groupedBets = useMemo(() => {
    const groups = {}
    for (const bet of bets) {
      const key = bet.event_name || 'No event'
      if (!groups[key]) groups[key] = { eventName: key, eventDate: bet.event_date, bets: [] }
      groups[key].bets.push(bet)
    }
    return Object.values(groups).sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
  }, [bets])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Bets</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>1 unit = ${unitSize.toFixed(2)}</p>
        </div>
        {!step && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {bets.length > 0 && (
              <button onClick={() => exportBetsToCSV(bets)} style={{ ...btnGhost, fontSize: '12px', padding: '7px 14px' }}>
                Export CSV
              </button>
            )}
            <button style={btnPrimary} onClick={() => setStep('pick-event')}>+ Add bet</button>
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

          {myEvents.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Your tracked events</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {myEvents.map(event => (
                  <div key={event.id} onClick={() => handleSelectEvent({ ...event })}
                    style={{ padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{event.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {futureEvents.filter(e => !myEventDates.has(e.event_date)).length > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Upcoming UFC events</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {futureEvents.filter(e => !myEventDates.has(e.event_date)).map(event => (
                  <div key={event.event_date} onClick={() => !addingEvent && handleSelectEvent(event)}
                    style={{ padding: '12px 16px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', cursor: addingEvent ? 'wait' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: addingEvent === event.event_date ? 0.5 : 1 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{event.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {event.location !== 'TBD' && ` · ${event.location}`}
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{addingEvent === event.event_date ? '...' : '→'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Fill bet form */}
      {step === 'fill-form' && selectedEvent && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{selectedEvent.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {new Date(selectedEvent.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep('pick-event')} style={{ ...btnGhost, fontSize: '12px', padding: '6px 12px' }}>← Change event</button>
              <button onClick={resetAll} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
            </div>
          </div>

          {fetchingFights && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Loading fights...</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fight</label>
              <select value={form.fight_id} onChange={e => { setForm(f => ({ ...f, fight_id: e.target.value, pick: '' })); setCustomPick(false) }} style={{ ...selectStyle, opacity: fights.length ? 1 : 0.5 }}>
                <option value="">Select fight (optional)</option>
                {fights.map(f => <option key={f.id} value={f.id}>{f.fighter_a} vs {f.fighter_b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bet type</label>
              <select value={form.bet_type} onChange={e => { setForm(f => ({ ...f, bet_type: e.target.value, pick: '' })); setCustomPick(false) }} style={selectStyle}>
                {BET_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pick *</label>
              {(() => {
                const propOptions = getPropOptions(form.bet_type, selectedFight?.fighter_a, selectedFight?.fighter_b)
                const isPropType = propOptions.length > 0

                if (isPropType && !customPick) {
                  return (
                    <div>
                      <select value={form.pick} onChange={e => {
                        if (e.target.value === '__custom') { setCustomPick(true); setForm(f => ({ ...f, pick: '' })) }
                        else setForm(f => ({ ...f, pick: e.target.value }))
                      }} style={selectStyle}>
                        <option value="">Select pick</option>
                        {propOptions.map(o => <option key={o}>{o}</option>)}
                        <option value="__custom">Other (type manually)</option>
                      </select>
                      <button type="button" onClick={() => setCustomPick(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>
                        Type manually instead →
                      </button>
                    </div>
                  )
                }

                if (selectedFight && !customPick && !isPropType) {
                  return (
                    <select value={form.pick} onChange={handlePickSelect} style={selectStyle}>
                      <option value="">Select fighter</option>
                      <option value={selectedFight.fighter_a}>{selectedFight.fighter_a}</option>
                      <option value={selectedFight.fighter_b}>{selectedFight.fighter_b}</option>
                      <option value="__custom">Other (type manually)</option>
                    </select>
                  )
                }

                return (
                  <div>
                    <input value={form.pick} onChange={e => setForm(f => ({ ...f, pick: e.target.value }))} placeholder="e.g. Islam Makhachev by KO" style={inputStyle} />
                    {(selectedFight || getPropOptions(form.bet_type, null, null).length > 0) && (
                      <button type="button" onClick={() => setCustomPick(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', marginTop: '4px' }}>
                        ← Choose from list instead
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Odds (American) *</label>
              <input value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} placeholder="-150 or +200" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stake (units) *</label>
              <input value={form.stake_units} onChange={e => setForm(f => ({ ...f, stake_units: e.target.value }))} placeholder={`e.g. 2 = $${(2 * unitSize).toFixed(0)}`} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sportsbook</label>
              <select value={form.sportsbook} onChange={e => setForm(f => ({ ...f, sportsbook: e.target.value }))} style={selectStyle}>
                <option value="">Select sportsbook (optional)</option>
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
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confidence</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, confidence: f.confidence === n ? 0 : n }))}
                    style={{
                      width: '40px', height: '40px', borderRadius: '8px',
                      border: '1px solid var(--border-input)',
                      background: form.confidence >= n ? 'var(--text-primary)' : 'var(--bg-input)',
                      color: form.confidence >= n ? 'var(--bg)' : 'var(--text-muted)',
                      fontSize: '14px', cursor: 'pointer', fontWeight: '600',
                      transition: 'all 0.15s',
                    }}
                  >
                    {n}
                  </button>
                ))}
                {form.confidence > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                    {form.confidence === 1 ? 'Very low' : form.confidence === 2 ? 'Low' : form.confidence === 3 ? 'Medium' : form.confidence === 4 ? 'High' : 'Very high'}
                  </span>
                )}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional — parlay legs, reasoning..." style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSubmit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save bet'}</button>
            <button onClick={resetAll} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Bets grouped by event */}
      {!step && (
        <div>
          {bets.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No bets yet</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click "+ Add bet" to get started</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {groupedBets.map(group => (
                <div key={group.eventName} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{group.eventName}</div>
                      {group.eventDate && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {new Date(group.eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>{group.bets.filter(b => b.result === 'win').length}W</span>
                      <span>{group.bets.filter(b => b.result === 'loss').length}L</span>
                      <span>{group.bets.filter(b => b.result === 'pending').length} pending</span>
                      {(() => {
                        const p = group.bets.reduce((sum, b) => {
                          if (b.result === 'win') return sum + calcPayoutUnits(b.stake_units, b.odds)
                          if (b.result === 'loss') return sum - Number(b.stake_units)
                          return sum
                        }, 0)
                        return <span style={{ color: p > 0 ? '#16a34a' : p < 0 ? '#dc2626' : 'var(--text-secondary)', fontWeight: '600' }}>{p >= 0 ? '+' : ''}{p.toFixed(2)}u</span>
                      })()}
                    </div>
                  </div>

                  {group.bets.map((bet, i) => {
                    const profitUnits = bet.result === 'win' ? calcPayoutUnits(bet.stake_units, bet.odds) : bet.result === 'loss' ? -Number(bet.stake_units) : 0
                    const isLast = i === group.bets.length - 1
                    return (
                      <div key={bet.id} style={{ padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{bet.pick}</span>
                            <span style={resultBadge(bet.result)}>{bet.result}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px' }}>{bet.bet_type}</span>
                            {bet.sportsbook && <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px' }}>{bet.sportsbook}</span>}
                            {bet.confidence && <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px' }}>{'★'.repeat(bet.confidence)}</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u (${Number(bet.stake).toFixed(2)})
                            {bet.fighter_a && bet.fighter_b && ` · ${bet.fighter_a} vs ${bet.fighter_b}`}
                          </div>
                        </div>

                        {bet.result === 'pending' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>+{calcPayoutUnits(bet.stake_units, bet.odds).toFixed(2)}u</span>
                            <button onClick={() => handleSettle(bet.id, 'win', bet)} disabled={settling === bet.id}
                              style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Win</button>
                            <button onClick={() => handleSettle(bet.id, 'loss', bet)} disabled={settling === bet.id}
                              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Loss</button>
                            <button onClick={() => handleSettle(bet.id, 'push', bet)} disabled={settling === bet.id}
                              style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Push</button>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: profitUnits >= 0 ? '#16a34a' : '#dc2626' }}>
                              {profitUnits >= 0 ? '+' : ''}{profitUnits.toFixed(2)}u
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              ${(profitUnits * unitSize).toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}