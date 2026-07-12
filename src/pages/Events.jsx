import { useEffect, useState } from 'react'
import { getEvents, createEvent, deleteEvent, getFightsByEvent, createFight } from '../lib/db'
import { getFightsByDate } from '../lib/mmaApi'

const UPCOMING_UFC_EVENTS = [
  { name: 'UFC Fight Night: Fiziev vs Torres', promotion: 'UFC', event_date: '2026-06-27', location: 'Baku, Azerbaijan', status: 'upcoming' },
  { name: 'UFC 329: McGregor vs Holloway 2', promotion: 'UFC', event_date: '2026-07-11', location: 'Las Vegas, NV', status: 'upcoming' },
  { name: 'UFC Fight Night: Du Plessis vs Usman', promotion: 'UFC', event_date: '2026-07-18', location: 'TBD', status: 'upcoming' },
  { name: 'UFC Fight Night: Ankalaev vs Rountree Jr', promotion: 'UFC', event_date: '2026-07-25', location: 'Abu Dhabi, UAE', status: 'upcoming' },
  { name: 'UFC Fight Night: Serbia', promotion: 'UFC', event_date: '2026-08-01', location: 'Serbia', status: 'upcoming' },
  { name: 'UFC Fight Night: Gamrot vs Salkilld', promotion: 'UFC', event_date: '2026-08-08', location: 'TBD', status: 'upcoming' },
  { name: 'UFC 330: Makhachev vs Machado Garry', promotion: 'UFC', event_date: '2026-08-15', location: 'Philadelphia, PA', status: 'upcoming' },
  { name: 'UFC Fight Night: TBD', promotion: 'UFC', event_date: '2026-09-05', location: 'TBD', status: 'upcoming' },
]

const WEIGHT_CLASSES = ['Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight']

const emptyFight = { fighter_a: '', fighter_b: '', weight_class: '', rounds: 3, fight_order: '' }

const inputStyle = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid #1a1a1a',
  borderRadius: '6px',
  padding: '9px 12px',
  fontSize: '13px',
  color: '#c8c8c8',
  outline: 'none',
}

const selectStyle = { ...inputStyle, cursor: 'pointer' }

const statusBadge = (status) => {
  if (status === 'upcoming') return { color: '#60a5fa', background: 'rgba(96,165,250,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }
  if (status === 'live') return { color: '#4ade80', background: 'rgba(74,222,128,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }
  return { color: '#555', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }
}

const btnPrimary = { background: '#c8c8c8', color: '#0a0a0a', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }
const btnGhost = { background: 'transparent', color: '#666', border: '1px solid #1a1a1a', borderRadius: '6px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer' }
const btnText = { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', padding: '0' }

export default function Events() {
  const [myEvents, setMyEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedEvent, setExpandedEvent] = useState(null)
  const [fights, setFights] = useState({})
  const [showFightForm, setShowFightForm] = useState(null)
  const [fightForm, setFightForm] = useState(emptyFight)
  const [savingFight, setSavingFight] = useState(false)
  const [fetchingFights, setFetchingFights] = useState(null)
  const [addingEvent, setAddingEvent] = useState(null)
  const [tab, setTab] = useState('upcoming')

  useEffect(() => {
    getEvents().then(setMyEvents).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleAddEvent = async (event) => {
    setAddingEvent(event.event_date)
    try {
      const newEvent = await createEvent(event)
      setMyEvents(prev => [newEvent, ...prev])
      setTab('my')
    } catch (err) { console.error(err) }
    finally { setAddingEvent(null) }
  }

  const handleDeleteEvent = async (event) => {
    if (!window.confirm(`Delete "${event.name}"?`)) return
    try {
      await deleteEvent(event.id)
      setMyEvents(prev => prev.filter(e => e.id !== event.id))
      if (expandedEvent === event.id) setExpandedEvent(null)
    } catch (err) { console.error(err) }
  }

  const handleExpandEvent = async (eventId) => {
    if (expandedEvent === eventId) return setExpandedEvent(null)
    setExpandedEvent(eventId)
    if (!fights[eventId]) {
      const f = await getFightsByEvent(eventId)
      setFights(prev => ({ ...prev, [eventId]: f }))
    }
  }

  const handleCreateFight = async (eventId) => {
    if (!fightForm.fighter_a || !fightForm.fighter_b) return
    setSavingFight(true)
    try {
      const fight = {
        ...fightForm,
        event_id: eventId,
        rounds: Number(fightForm.rounds),
        fight_order: fightForm.fight_order ? Number(fightForm.fight_order) : null,
      }
      const newFight = await createFight(fight)
      setFights(prev => ({ ...prev, [eventId]: [...(prev[eventId] || []), newFight] }))
      setFightForm(emptyFight)
      setShowFightForm(null)
    } catch (err) { console.error(err) }
    finally { setSavingFight(false) }
  }

  const handleFetchFights = async (event) => {
    setFetchingFights(event.id)
    try {
      const apiFights = await getFightsByDate(event.event_date)
      if (!apiFights.length) {
        alert('No fights found from the API for this date yet. Try closer to the event date.')
        return
      }
      let created = 0
      for (const [i, f] of apiFights.entries()) {
        const fighterA = f.fighters?.first?.name
        const fighterB = f.fighters?.second?.name
        if (!fighterA || !fighterB) continue
        const winner = f.fighters?.first?.winner ? fighterA : f.fighters?.second?.winner ? fighterB : null
        await createFight({
          event_id: event.id,
          fighter_a: fighterA,
          fighter_b: fighterB,
          weight_class: f.category || '',
          rounds: 3,
          fight_order: i + 1,
          winner,
        })
        created++
      }
      const updated = await getFightsByEvent(event.id)
      setFights(prev => ({ ...prev, [event.id]: updated }))
      alert(`Imported ${created} fights!`)
    } catch (err) { console.error(err); alert('Something went wrong.') }
    finally { setFetchingFights(null) }
  }

  const myEventDates = new Set(myEvents.map(e => e.event_date))
  const futureEvents = UPCOMING_UFC_EVENTS.filter(e => new Date(e.event_date) >= new Date())

  if (loading) return <div style={{ color: '#555', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '500', color: '#c8c8c8', letterSpacing: '-0.4px', marginBottom: '4px' }}>Events</h1>
        <p style={{ fontSize: '12px', color: '#444' }}>Select upcoming UFC events or manage your tracked events</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1px', background: '#1a1a1a', borderRadius: '8px', padding: '3px', marginBottom: '24px', width: 'fit-content' }}>
        {[['upcoming', 'Upcoming UFC events'], ['my', `My events (${myEvents.length})`]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              background: tab === key ? '#2a2a2a' : 'transparent',
              color: tab === key ? '#c8c8c8' : '#555',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Upcoming UFC Events tab */}
      {tab === 'upcoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {futureEvents.map(event => {
            const alreadyAdded = myEventDates.has(event.event_date)
            return (
              <div key={event.event_date} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#c8c8c8', marginBottom: '4px' }}>{event.name}</div>
                  <div style={{ fontSize: '11px', color: '#444' }}>
                    {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {event.location !== 'TBD' && ` · ${event.location}`}
                  </div>
                </div>
                <button
                  onClick={() => !alreadyAdded && handleAddEvent(event)}
                  disabled={alreadyAdded || addingEvent === event.event_date}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '500',
                    border: alreadyAdded ? '1px solid #2a2a2a' : 'none',
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    background: alreadyAdded ? '#1a1a1a' : '#c8c8c8',
                    color: alreadyAdded ? '#444' : '#0a0a0a',
                  }}
                >
                  {alreadyAdded ? 'Added' : addingEvent === event.event_date ? 'Adding...' : '+ Track'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* My Events tab */}
      {tab === 'my' && (
        <div>
          {myEvents.length === 0 ? (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '48px', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#444', marginBottom: '6px' }}>No events tracked yet</div>
              <button onClick={() => setTab('upcoming')} style={{ ...btnText, color: '#777', textDecoration: 'underline', fontSize: '12px' }}>
                Browse upcoming UFC events
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {myEvents.map(event => (
                <div key={event.id} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => handleExpandEvent(event.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#c8c8c8' }}>{event.name}</span>
                        <span style={statusBadge(event.status)}>{event.status}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#444' }}>
                        {event.promotion} · {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        {event.location && event.location !== 'TBD' && ` · ${event.location}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteEvent(event) }}
                        style={{ ...btnText, color: '#333' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = '#333'}
                      >
                        Remove
                      </button>
                      <span style={{ color: '#333', fontSize: '11px' }}>{expandedEvent === event.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {expandedEvent === event.id && (
                    <div style={{ borderTop: '1px solid #161616', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <span style={{ fontSize: '11px', color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fight card</span>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <button
                            onClick={() => handleFetchFights(event)}
                            disabled={fetchingFights === event.id}
                            style={{ ...btnText }}
                            onMouseEnter={e => e.currentTarget.style.color = '#888'}
                            onMouseLeave={e => e.currentTarget.style.color = '#555'}
                          >
                            {fetchingFights === event.id ? 'Fetching...' : 'Fetch fights'}
                          </button>
                          <button
                            onClick={() => setShowFightForm(event.id)}
                            style={{ ...btnText }}
                            onMouseEnter={e => e.currentTarget.style.color = '#888'}
                            onMouseLeave={e => e.currentTarget.style.color = '#555'}
                          >
                            + Add fight
                          </button>
                        </div>
                      </div>

                      {showFightForm === event.id && (
                        <div style={{ background: '#0d0d0d', borderRadius: '8px', padding: '16px', marginBottom: '14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                            <div>
                              <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fighter A *</label>
                              <input value={fightForm.fighter_a} onChange={e => setFightForm(f => ({ ...f, fighter_a: e.target.value }))} placeholder="Islam Makhachev" style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fighter B *</label>
                              <input value={fightForm.fighter_b} onChange={e => setFightForm(f => ({ ...f, fighter_b: e.target.value }))} placeholder="Charles Oliveira" style={inputStyle} />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weight class</label>
                              <select value={fightForm.weight_class} onChange={e => setFightForm(f => ({ ...f, weight_class: e.target.value }))} style={selectStyle}>
                                <option style={{ background: '#111' }} value="">Select</option>
                                {WEIGHT_CLASSES.map(w => <option key={w} style={{ background: '#111' }}>{w}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: '#444', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rounds</label>
                              <select value={fightForm.rounds} onChange={e => setFightForm(f => ({ ...f, rounds: e.target.value }))} style={selectStyle}>
                                <option style={{ background: '#111' }} value={3}>3</option>
                                <option style={{ background: '#111' }} value={5}>5</option>
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button style={{ ...btnPrimary, padding: '7px 14px', fontSize: '12px' }} onClick={() => handleCreateFight(event.id)} disabled={savingFight}>
                              {savingFight ? 'Saving...' : 'Save fight'}
                            </button>
                            <button style={{ ...btnGhost, padding: '7px 14px', fontSize: '12px' }} onClick={() => { setShowFightForm(null); setFightForm(emptyFight) }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {!fights[event.id] ? (
                        <div style={{ fontSize: '12px', color: '#333' }}>Loading...</div>
                      ) : fights[event.id].length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#333' }}>No fights added yet. Click "Fetch fights" closer to the event date or add manually.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {fights[event.id].map((fight, i) => (
                            <div key={fight.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < fights[event.id].length - 1 ? '1px solid #161616' : 'none' }}>
                              <div>
                                <div style={{ fontSize: '13px', color: '#c8c8c8' }}>
                                  {fight.fighter_a} <span style={{ color: '#333' }}>vs</span> {fight.fighter_b}
                                </div>
                                <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                                  {fight.weight_class && `${fight.weight_class} · `}{fight.rounds}R
                                  {fight.winner && ` · ${fight.winner} wins`}
                                </div>
                              </div>
                              {fight.winner && (
                                <span style={{ fontSize: '11px', color: '#555', background: '#161616', padding: '2px 8px', borderRadius: '4px' }}>
                                  {fight.method || 'Win'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}