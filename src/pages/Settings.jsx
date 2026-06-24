import { useEffect, useState } from 'react'
import { getUnitSize, setUnitSize } from '../lib/db'

export default function Settings() {
  const [unitSize, setUnit] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getUnitSize()
      .then(val => setUnit(String(val)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!unitSize || isNaN(unitSize)) return
    setSaving(true)
    try {
      await setUnitSize(Number(unitSize))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Configure your tracker</p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md">
        <h2 className="font-semibold mb-1">Unit size</h2>
        <p className="text-gray-500 text-sm mb-4">The dollar value of 1 unit. All bets are tracked in units based on this.</p>
        <div className="flex gap-3 items-center">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={unitSize}
              onChange={e => setUnit(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 w-32"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-3">Current: 1u = ${Number(unitSize).toFixed(2)}</p>
      </div>
    </div>
  )
}