import { useEffect, useState } from 'react'
import {
  getOpenParlays, createOpenParlay, addOpenParlayLeg,
  settleOpenParlayLeg, updateOpenParlayValue, deleteOpenParlay,
  getEvents, getFightsByEvent
} from '../lib/db'
import { useAuth } from '../lib/AuthContext'

const OPEN_PARLAY_BOOKS = [
  'BetOnline', 'MyBookie', 'Bovada', 'BetUS', 'SportsBetting.ag',
]

const calcPayout = (stake, odds) => {
  const s = Number(stake), o = Number(odds)
  if (!s || !o) return 0
  const profit = o > 0 ? s * o / 100 : s * 100 / Math.abs(o)
  return s + profit
}

const inputStyle = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }
const selectStyle = { ...inputStyle, cursor: 'pointer' }
const btnPrimary = { background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-input)', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }

const statusBadge = (status) => {
  const base = { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }
  if (status === 'won') return { ...base, color: '#16a34a', background: '#f0fdf4' }
  if (status === 'lost') return { ...base, color: '#dc2626', background: '#fef2f2' }
  return { ...base, color: '#d97706', background: '#fffbeb' }
}

const resultBadge = (result) => {
  const base = { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }
  if (result === 'win') return { ...base, color: '#16a34a', background: '#f0fdf4' }
  if (result === 'loss') return { ...base, color: '#dc2626', background: '#fef2f2' }
  return { ...base, color: 'var(--text-secondary)', background: 'var(--bg-hover)' }
}

export default function OpenParlays() {
  const { user } = useAuth()
  const [parlays, setParlays] = useState([])
  const [events, setEvents] = useState([])
  const [fights, setFights] = useState({})
  const [loading, setLoading] = useState(true)

  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStake, setNewStake] = useState('')
  const [newBook, setNewBook] = useState('')
  const [creating, setCreating] = useState(false)

  const [addingLegTo, setAddingLegTo] = useState(null)
  const [legEventId, setLegEventId] = useState('')
  const [legFightId, setLegFightId] = useState('')
  const [legPick, setLegPick] = useState('')
  const [legOdds, setLegOdds] = useState('')
  const [savingLeg, setSavingLeg] = useState(false)

  const [settling, setSettling] = useState(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getOpenParlays(user.id), getEvents()])
      .then(([p, e]) => { setParlays(p); setEvents(e) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const loadFights = async (eventId) => {
    if (fights[eventId]) return
    try {
      const f = await getFightsByEvent(eventId)
      setFights(prev => ({ ...prev, [eventId]: f }))
    } catch (err) { console.error(err) }
  }

  const handleCreateParlay = async () => {
    if (!newStake || isNaN(newStake)) return
    setCreating(true)
    try {
      const parlay = await createOpenParlay({
        user_id: user.id,
        name: newName.trim() || `Open Parlay ${parlays.length + 1}`,
        initial_stake: Number(newStake),
        sportsbook: newBook || null,
      })
      setParlays(prev => [{ ...parlay, open_parlay_legs: [] }, ...prev])
      setShowNewForm(false)
      setNewName('')
      setNewStake('')
      setNewBook('')
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  const handleAddLeg = async (parlay) => {
    if (!legPick || !legOdds) return
    setSavingLeg(true)
    try {
      const legs = parlay.open_parlay_legs || []
      const pendingLegs = legs.filter(l => l.result === 'pending')
      if (pendingLegs.length > 0) return

      const stakeIn = parlay.current_value
      const leg = await addOpenParlayLeg({
        parlay_id: parlay.id,
        leg_order: legs.length + 1,
        fight_id: legFightId || null,
        pick: legPick,
        odds: Number(legOdds),
        stake_in: stakeIn,
      })
      setParlays(prev => prev.map(p => p.id === parlay.id
        ? { ...p, open_parlay_legs: [...(p.open_parlay_legs || []), leg] }
        : p
      ))
      setAddingLegTo(null)
      setLegEventId('')
      setLegFightId('')
      setLegPick('')
      setLegOdds('')
    } catch (err) { console.error(err) }
    finally { setSavingLeg(false) }
  }

  const handleSettleLeg = async (parlay, leg, result) => {
    setSettling(leg.id)
    try {
      const stakeOut = result === 'win' ? calcPayout(leg.stake_in, leg.odds) : 0
      await settleOpenParlayLeg(leg.id, result, stakeOut)

      let newStatus = parlay.status
      let newValue = parlay.current_value

      if (result === 'win') {
        newValue = stakeOut
        const allLegs = [...(parlay.open_parlay_legs || []).filter(l => l.id !== leg.id), { ...leg, result: 'win', stake_out: stakeOut }]
        const anyPending = allLegs.some(l => l.result === 'pending')
        if (!anyPending) newStatus = 'won'
      } else {
        newStatus = 'lost'
        newValue = 0
      }

      await updateOpenParlayValue(parlay.id, newValue, newStatus)

      setParlays(prev => prev.map(p => p.id === parlay.id ? {
        ...p,
        current_value: newValue,
        status: newStatus,
        open_parlay_legs: (p.open_parlay_legs || []).map(l =>
          l.id === leg.id ? { ...l, result, stake_out: stakeOut, settled_at: new Date().toISOString() } : l
        )
      } : p))
    } catch (err) { console.error(err) }
    finally { setSettling(null) }
  }

  const handleDelete = async (parlayId) => {
    if (!window.confirm('Delete this open parlay?')) return
    try {
      await deleteOpenParlay(parlayId)
      setParlays(prev => prev.filter(p => p.id !== parlayId))
    } catch (err) { console.error(err) }
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.4px', marginBottom: '4px' }}>Open Parlays</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Compounding parlays — available on BetOnline, MyBookie, Bovada, BetUS, SportsBetting.ag</p>
        </div>
        {!showNewForm && (
          <button style={btnPrimary} onClick={() => setShowNewForm(true)}>+ New open parlay</button>
        )}
      </div>

      {showNewForm && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>Start a new open parlay</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name (optional)</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. UFC 330 Open Parlay" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Initial stake ($) *</label>
              <input type="number" value={newStake} onChange={e => setNewStake(e.target.value)} placeholder="e.g. 20" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sportsbook</label>
              <select value={newBook} onChange={e => setNewBook(e.target.value)} style={selectStyle}>
                <option value="">Select book</option>
                {OPEN_PARLAY_BOOKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCreateParlay} disabled={creating || !newStake} style={{ ...btnPrimary, opacity: creating || !newStake ? 0.6 : 1 }}>
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => { setShowNewForm(false); setNewName(''); setNewStake(''); setNewBook('') }} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {parlays.length === 0 && !showNewForm ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>No open parlays yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click "+ New open parlay" to start one</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {parlays.map(parlay => {
            const legs = [...(parlay.open_parlay_legs || [])].sort((a, b) => a.leg_order - b.leg_order)
            const pendingLeg = legs.find(l => l.result === 'pending')
            const canAddLeg = parlay.status === 'open' && !pendingLeg
            const profit = parlay.status === 'won' ? parlay.current_value - parlay.initial_stake
              : parlay.status === 'lost' ? -parlay.initial_stake : 0

            return (
              <div key={parlay.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{parlay.name || 'Open Parlay'}</span>
                      <span style={statusBadge(parlay.status)}>{parlay.status}</span>
                      {parlay.sportsbook && <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px' }}>{parlay.sportsbook}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Started at ${Number(parlay.initial_stake).toFixed(2)}
                      {parlay.status === 'open' && ` · Current value: $${Number(parlay.current_value).toFixed(2)}`}
                      {parlay.status === 'won' && ` · Won $${Number(parlay.current_value).toFixed(2)} (+$${profit.toFixed(2)})`}
                      {parlay.status === 'lost' && ` · Lost $${Number(parlay.initial_stake).toFixed(2)}`}
                      {` · ${legs.length} leg${legs.length !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(parlay.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
                </div>

                {legs.map((leg) => {
                  const payout = calcPayout(leg.stake_in, leg.odds)
                  return (
                    <div key={leg.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>Leg {leg.leg_order}</span>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{leg.pick}</span>
                          <span style={resultBadge(leg.result)}>{leg.result}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {Number(leg.odds) > 0 ? '+' : ''}{leg.odds} · In: ${Number(leg.stake_in).toFixed(2)}
                          {leg.result === 'win' && ` · Out: $${Number(leg.stake_out).toFixed(2)}`}
                        </div>
                      </div>
                      {leg.result === 'pending' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>→ ${payout.toFixed(2)}</span>
                          <button onClick={() => handleSettleLeg(parlay, leg, 'win')} disabled={settling === leg.id}
                            style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Win</button>
                          <button onClick={() => handleSettleLeg(parlay, leg, 'loss')} disabled={settling === leg.id}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Loss</button>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'right' }}>
                          {leg.result === 'win'
                            ? <div style={{ fontSize: '13px', fontWeight: '700', color: '#16a34a' }}>${Number(leg.stake_out).toFixed(2)}</div>
                            : <div style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626' }}>Lost</div>
                          }
                        </div>
                      )}
                    </div>
                  )
                })}

                {addingLegTo === parlay.id ? (
                  <div style={{ padding: '16px 20px', background: 'var(--bg-hover)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Add Leg {legs.length + 1} — Stake in: ${Number(parlay.current_value).toFixed(2)}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event</label>
                        <select value={legEventId} onChange={e => { setLegEventId(e.target.value); setLegFightId(''); loadFights(e.target.value) }} style={{ ...selectStyle, fontSize: '12px', padding: '7px 10px' }}>
                          <option value="">Select event (optional)</option>
                          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fight</label>
                        <select value={legFightId} onChange={e => setLegFightId(e.target.value)} style={{ ...selectStyle, fontSize: '12px', padding: '7px 10px' }} disabled={!legEventId}>
                          <option value="">Select fight (optional)</option>
                          {(fights[legEventId] || []).map(f => <option key={f.id} value={f.id}>{f.fighter_a} vs {f.fighter_b}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pick *</label>
                        <input value={legPick} onChange={e => setLegPick(e.target.value)} placeholder="e.g. Islam Makhachev" style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Odds *</label>
                        <input value={legOdds} onChange={e => setLegOdds(e.target.value)} placeholder="-150 or +200" style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }} />
                      </div>
                    </div>
                    {legPick && legOdds && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        Win → <strong style={{ color: '#16a34a' }}>${calcPayout(parlay.current_value, legOdds).toFixed(2)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleAddLeg(parlay)} disabled={savingLeg || !legPick || !legOdds}
                        style={{ ...btnPrimary, fontSize: '12px', padding: '7px 14px', opacity: savingLeg || !legPick || !legOdds ? 0.6 : 1 }}>
                        {savingLeg ? 'Adding...' : 'Add leg'}
                      </button>
                      <button onClick={() => { setAddingLegTo(null); setLegEventId(''); setLegFightId(''); setLegPick(''); setLegOdds('') }}
                        style={{ ...btnGhost, fontSize: '12px', padding: '7px 14px' }}>Cancel</button>
                    </div>
                  </div>
                ) : canAddLeg && (
                  <div style={{ padding: '12px 20px' }}>
                    <button onClick={() => setAddingLegTo(parlay.id)}
                      style={{ ...btnGhost, fontSize: '12px', padding: '7px 14px' }}>+ Add next leg</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}