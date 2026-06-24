import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
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

function AppShell() {
  const { session, user, signOut, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">Loading...</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-950 text-white">
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

          <div className="mt-auto pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500 px-2 mb-2 truncate">{user?.email}</p>
            <button
              onClick={signOut}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <span>🚪</span>
              Sign out
            </button>
          </div>
        </aside>

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

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}