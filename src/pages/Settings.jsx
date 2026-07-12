import { useEffect, useState } from 'react'
import { getUnitSize, setUnitSize, getDisplayName, updateDisplayName } from '../lib/db'
import { useAuth } from '../lib/AuthContext'

export default function Settings() {
  const { user } = useAuth()
  const [unitSize, setUnit] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingUnit, setSavingUnit] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [savedUnit, setSavedUnit] = useState(false)
  const [savedName, setSavedName] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([getUnitSize(), getDisplayName(user.id)])
      .then(([u, name]) => {
        setUnit(String(u))
        setDisplayName(name || user.email.split('@')[0])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const handleSaveUnit = async () => {
    if (!unitSize || isNaN(unitSize)) return
    setSavingUnit(true)
    try {
      await setUnitSize(Number(unitSize))
      setSavedUnit(true)
      setTimeout(() => setSavedUnit(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingUnit(false)
    }
  }

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    try {
      await updateDisplayName(user.id, displayName.trim())
      setSavedName(true)
      setTimeout(() => setSavedName(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingName(false)
    }
  }

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Configure your account</p>

      <div className="flex flex-col gap-4 max-w-md">

        {/* Display name */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold mb-1">Display name</h2>
          <p className="text-gray-500 text-sm mb-4">This is how you appear on the leaderboard.</p>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={30}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 flex-1"
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {savingName ? 'Saving...' : savedName ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-2">{user?.email}</p>
        </div>

        {/* Unit size */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
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
              onClick={handleSaveUnit}
              disabled={savingUnit}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {savingUnit ? 'Saving...' : savedUnit ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-3">Current: 1u = ${Number(unitSize).toFixed(2)}</p>
        </div>

      </div>
    </div>
  )
}