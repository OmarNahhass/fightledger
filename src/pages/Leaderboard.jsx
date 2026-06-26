import { useEffect, useMemo, useState } from 'react'
import { getBets } from '../lib/db'
import { calcProfitUnits } from '../lib/calc'

const resultColor = (result) => {
  if (result === 'win') return 'text-green-400 bg-green-400/10'
  if (result === 'loss') return 'text-red-400 bg-red-400/10'
  if (result === 'push') return 'text-yellow-400 bg-yellow-400/10'
  return 'text-gray-400 bg-gray-400/10'
}

export default function Leaderboard() {
  const [bets, setBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    getBets()
      .then(setBets)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const leaderboard = useMemo(() => {
    const byUser = {}
    for (const b of bets) {
      const key = b.user_id
      if (!byUser[key]) {
        byUser[key] = {
          userId: key,
          name: b.display_name || 'Anonymous bettor',
          bets: [],
          wins: 0,
          losses: 0,
          pushes: 0,
          pending: 0,
          unitsStaked: 0,
          unitsProfit: 0,
        }
      }
      const u = byUser[key]
      u.bets.push(b)
      u.unitsStaked += Number(b.stake_units || 0)
      if (b.result === 'pending') {
        u.pending++
      } else {
        u.unitsProfit += calcProfitUnits(b.stake_units, b.odds, b.result)
        if (b.result === 'win') u.wins++
        else if (b.result === 'loss') u.losses++
        else if (b.result === 'push') u.pushes++
      }
    }

    return Object.values(byUser)
      .map(u => {
        const settled = u.wins + u.losses
        return {
          ...u,
          winRate: settled ? (u.wins / settled * 100).toFixed(1) : 0,
          roi: u.unitsStaked ? (u.unitsProfit / u.unitsStaked * 100).toFixed(1) : 0,
        }
      })
      .sort((a, b) => b.unitsProfit - a.unitsProfit)
  }, [bets])

  if (loading) return <p className="text-gray-400">Loading...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Leaderboard</h1>
      <p className="text-gray-500 text-sm mb-8">Ranked by units profit · click anyone to see their bets</p>

      {leaderboard.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-3">🏆</p>
          <p className="text-white font-medium mb-1">No bets logged yet</p>
          <p className="text-gray-500 text-sm">Be the first to place a bet and top the board</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leaderboard.map((u, i) => (
            <div key={u.userId} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setExpanded(expanded === u.userId ? null : u.userId)}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-lg font-bold w-6 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-gray-500 text-sm">
                      {u.wins}W - {u.losses}L{u.pushes ? ` - ${u.pushes}P` : ''} · {u.winRate}% win rate
                      {u.pending > 0 && ` · ${u.pending} pending`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${u.unitsProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {u.unitsProfit >= 0 ? '+' : ''}{u.unitsProfit.toFixed(2)}u
                  </p>
                  <p className={`text-xs ${u.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ROI {u.roi >= 0 ? '+' : ''}{u.roi}%
                  </p>
                </div>
              </div>

              {expanded === u.userId && (
                <div className="border-t border-gray-800 px-6 py-4 flex flex-col gap-2">
                  {u.bets
                    .slice()
                    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
                    .map(bet => (
                      <div key={bet.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">{bet.pick}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resultColor(bet.result)}`}>
                              {bet.result}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {bet.event_name && `${bet.event_name} · `}
                            {Number(bet.odds) > 0 ? '+' : ''}{bet.odds} · {bet.stake_units}u
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}