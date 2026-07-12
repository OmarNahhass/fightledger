import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Bets from './pages/Bets'
import Bankroll from './pages/Bankroll'
import Leaderboard from './pages/Leaderboard'
import Settings from './pages/Settings'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/events', label: 'Events' },
  { to: '/bets', label: 'Bets' },
  { to: '/bankroll', label: 'Bankroll' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/settings', label: 'Settings' },
]

function Sidebar() {
  const { user, signOut } = useAuth()
  return (
    <aside style={{
      width: '200px',
      background: '#0d0d0d',
      borderRight: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 12px',
      flexShrink: 0,
      minHeight: '100vh',
    }}>
      <div style={{ padding: '0 12px', marginBottom: '36px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#c8c8c8', letterSpacing: '-0.3px' }}>MMA Bets</div>
        <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>tracker</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'block',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              textDecoration: 'none',
              color: isActive ? '#c8c8c8' : '#666',
              background: isActive ? '#161616' : 'transparent',
              borderLeft: isActive ? '2px solid #c53030' : '2px solid transparent',
              transition: 'all 0.15s',
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '16px', marginTop: '16px' }}>
        <div style={{ fontSize: '11px', color: '#555', padding: '0 12px', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button
          onClick={signOut}
          style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', color: '#666', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#c8c8c8'; e.currentTarget.style.background = '#161616' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}

function AppShell() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', color: '#555' }}>Loading...</div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '48px 56px', overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<Events />} />
            <Route path="/bets" element={<Bets />} />
            <Route path="/bankroll" element={<Bankroll />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
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