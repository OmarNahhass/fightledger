import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Bets from './pages/Bets'
import Bankroll from './pages/Bankroll'
import Settings from './pages/Settings'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/events', label: 'Events', icon: '🥊' },
  { to: '/bets', label: 'Bets', icon: '💰' },
  { to: '/bankroll', label: 'Bankroll', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-950 text-white">

        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1">
          <div className="text-lg font-bold text-white mb-6 px-2">
            🥋 MMA Bets
          </div>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-red-600 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/bets" element={<Bets />} />
            <Route path="/bankroll" element={<Bankroll />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  )
}