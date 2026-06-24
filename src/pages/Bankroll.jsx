import { useEffect, useState } from 'react'
import { getBankrollHistory, addBankrollSnapshot } from '../lib/db'

export default function Bankroll() {
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [balance, setBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getBankrollHistory()
      .then(setSnapshots)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!balance) return
    setSaving(true)
    try {
      const snap = await addBankrollSnapshot(Number(balance), notes)
      setSnapshots(prev => [...prev, snap])
      setBalance('')
      setNotes('')
      setShowForm(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const latest = snapshots[snapshots.length - 1]
  const first = snapshots[0]
  const totalChange = latest && first
    ? Number(latest.balance) - Number(first.balance)
    : 0

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Bankroll</h1>
          <p className="text-gray-500 text-sm">Track your balance over time</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Log balance
        </button>
      </div>

      {/* Summary cards */}
      {latest && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Current balance</p>
            <p className="text-3xl font-bold text-white">${Number(latest.balance).toFixed(2)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Starting balance</p>
            <p className="text-3xl font-bold text-white">${Number(first.balance).toFixed(2)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-sm mb-1">Total change</p>
            <p className={`text-3xl font-bold ${totalChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Log balance form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Log balance</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Current balance ($) *</label>
              <input
                type="number"
                value={balance}
                onChange={e => setBalance(e.target.value)}
                placeholder="e.g. 500"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional — e.g. after UFC 328"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setShowForm(false); setBalance(''); setNotes('') }}
              className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* History list */}
      {snapshots.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">📈</p>
          <p className="text-white font-medium mb-1">No balance logs yet</p>
          <p className="text-gray-500 text-sm">Log your starting bankroll to begin tracking</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {[...snapshots].reverse().map((snap, i) => {
            const prev = snapshots[snapshots.length - 2 - i]
            const change = prev ? Number(snap.balance) - Number(prev.balance) : null
            return (
              <div key={snap.id} className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">${Number(snap.balance).toFixed(2)}</p>
                  <p className="text-gray-500 text-sm">
                    {new Date(snap.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {snap.notes && ` · ${snap.notes}`}
                  </p>
                </div>
                {change !== null && (
                  <p className={`text-sm font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}${change.toFixed(2)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}