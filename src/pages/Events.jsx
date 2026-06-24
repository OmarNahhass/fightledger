import { useEffect, useState } from 'react'
import { getEvents, createEvent, getFightsByEvent, createFight } from '../lib/db'
import { searchEvent, getEventDetails } from '../lib/mmaApi'

const PROMOTIONS = ['UFC', 'Bellator', 'PFL', 'ONE FC', 'BKFC', 'Other']
const WEIGHT_CLASSES = ['Strawweight', 'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight', 'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight']

const emptyEvent = { name: '', promotion: 'UFC', event_date: '', location: '', status: 'upcoming' }
const emptyFight = { fighter_a: '', fighter_b: '', weight_class: '', rounds: 3, fight_order: '' }

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState(emptyEvent)
  const [savingEvent, setSavingEvent] = useState(false)
  const [expandedEvent, setExpandedEvent] = useState(null)
  const [fights, setFights] = useState({})
  const [showFightForm, setShowFightForm] = useState(null)
  const [fightForm, setFightForm] = useState(emptyFight)
  const [savingFight, setSavingFight] = useState(false)
  const [fetchingFights, setFetchingFights] = useState(null)

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleEventChange = (e) => setEventForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const handleFightChange = (e) => setFightForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleCreateEvent = async () => {
    if (!eventForm.name || !eventForm.event_date) return
    setSavingEvent(true)
    try {
      const newEvent = await createEvent(eventForm)
      setEvents(prev => [newEvent, ...prev])
      setEventForm(emptyEvent)
      setShowEventForm(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingEvent(false)
    }
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
    } catch (err) {
      console.error(err)
    } finally {
      setSavingFight(false)
    }
  }

  const handleFetchFights = async (event) => {
    setFetchingFights(event.id)
    try {
      const searchData = await searchEvent(event.name)
      console.log('Search data:', searchData)

      const events = searchData?.events || searchData?.response || []
      if (!events.length) {
        alert('Event not found. Make sure the name matches exactly e.g. "UFC 315"')
        return
      }

      const apiEvent = events[0]
      const eventData = await getEventDetails(apiEvent.id || apiEvent.eventId)
      console.log('Event data:', eventData)

      const apiFights = eventData?.fights || eventData?.cards?.flatMap(c => c.fights) || []
      if (!apiFights.length) {
        alert('No fights found for this event yet.')
        return
      }

      let created = 0
      for (const f of apiFights) {
        const fighterA = f.fighters?.[0]?.name || f.fighter1?.name || f.home?.name
        const fighterB = f.fighters?.[1]?.name || f.fighter2?.name || f.away?.name
        if (!fighterA || !fighterB) continue
        await createFight({
          event_id: event.id,
          fighter_a: fighterA,
          fighter_b: fighterB,
          weight_class: f.weightClass || f.weight_class || '',
          rounds: f.rounds || 3,
          fight_order: f.order || f.position || null,
        })
        created++
      }

      const updated = await getFightsByEvent(event.id)
      setFights(prev => ({ ...prev, [event.id]: updated }))
      alert(`✅ Imported ${created} fights!`)
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Check the console.')
    } finally {
      setFetchingFights(null)
    }
  }

  const statusColor = (status) => {
    if (status === 'upcoming') return 'text-blue-400 bg-blue-400/10'
    if (status === 'live') return 'text-green-400 bg-green-400/10'
    return 'text-gray-400 bg-gray-400/10'
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Events</h1>
          <p className="text-gray-500 text-sm">Track fight cards and results</p>
        </div>
        <button
          onClick={() => setShowEventForm(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add event
        </button>
      </div>

      {showEventForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">New event</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Event name *</label>
              <input name="name" value={eventForm.name} onChange={handleEventChange}
                placeholder="e.g. UFC 315"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Promotion</label>
              <select name="promotion" value={eventForm.promotion} onChange={handleEventChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                {PROMOTIONS.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Date *</label>
              <input name="event_date" type="date" value={eventForm.event_date} onChange={handleEventChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Location</label>
              <input name="location" value={eventForm.location} onChange={handleEventChange}
                placeholder="e.g. Las Vegas, NV"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select name="status" value={eventForm.status} onChange={handleEventChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreateEvent} disabled={savingEvent}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {savingEvent ? 'Saving...' : 'Save event'}
            </button>
            <button onClick={() => { setShowEventForm(false); setEventForm(emptyEvent) }}
              className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-white font-medium mb-1">No events yet</p>
          <p className="text-gray-500 text-sm">Add your first event to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(event => (
            <div key={event.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

              <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => handleExpandEvent(event.id)}
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold">{event.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(event.status)}`}>
                      {event.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {event.promotion} · {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {event.location && ` · ${event.location}`}
                  </p>
                </div>
                <span className="text-gray-500 text-sm">{expandedEvent === event.id ? '▲' : '▼'}</span>
              </div>

              {expandedEvent === event.id && (
                <div className="border-t border-gray-800 px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-400">Fight card</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleFetchFights(event)}
                        disabled={fetchingFights === event.id}
                        className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                      >
                        {fetchingFights === event.id ? 'Fetching...' : '⬇ Fetch fights'}
                      </button>
                      <button
                        onClick={() => setShowFightForm(event.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        + Add fight
                      </button>
                    </div>
                  </div>

                  {showFightForm === event.id && (
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Fighter A *</label>
                          <input name="fighter_a" value={fightForm.fighter_a} onChange={handleFightChange}
                            placeholder="e.g. Islam Makhachev"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Fighter B *</label>
                          <input name="fighter_b" value={fightForm.fighter_b} onChange={handleFightChange}
                            placeholder="e.g. Charles Oliveira"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Weight class</label>
                          <select name="weight_class" value={fightForm.weight_class} onChange={handleFightChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                            <option value="">Select</option>
                            {WEIGHT_CLASSES.map(w => <option key={w}>{w}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Rounds</label>
                          <select name="rounds" value={fightForm.rounds} onChange={handleFightChange}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500">
                            <option value={3}>3</option>
                            <option value={5}>5</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Card position</label>
                          <input name="fight_order" value={fightForm.fight_order} onChange={handleFightChange}
                            placeholder="e.g. 1 = first fight"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleCreateFight(event.id)} disabled={savingFight}
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                          {savingFight ? 'Saving...' : 'Save fight'}
                        </button>
                        <button onClick={() => { setShowFightForm(null); setFightForm(emptyFight) }}
                          className="text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {!fights[event.id] ? (
                    <p className="text-gray-500 text-sm">Loading...</p>
                  ) : fights[event.id].length === 0 ? (
                    <p className="text-gray-500 text-sm">No fights added yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {fights[event.id].map(fight => (
                        <div key={fight.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                          <div>
                            <p className="text-sm font-medium">
                              {fight.fighter_a} <span className="text-gray-500">vs</span> {fight.fighter_b}
                            </p>
                            <p className="text-xs text-gray-500">
                              {fight.weight_class && `${fight.weight_class} · `}{fight.rounds}R
                              {fight.winner && ` · Winner: ${fight.winner}`}
                            </p>
                          </div>
                          {fight.winner && (
                            <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{fight.method}</span>
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
  )
}