import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bets from './pages/Bets'
import Leaderboard from './pages/Leaderboard'
import Settings from './pages/Settings'

const navSections = [
  {
    label: 'MENU',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/bets', label: 'Bets' },
    ]
  },
  {
    label: 'SOCIAL',
    items: [
      { to: '/leaderboard', label: 'Leaderboard' },
    ]
  },
  {
    label: 'ACCOUNT',
    items: [
      { to: '/settings', label: 'Settings' },
    ]
  },
]

function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside style={{
      width: '220px',
      background: '#fff',
      borderRight: '1px solid #ebebeb',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 16px',
      flexShrink: 0,
      minHeight: '100vh',
    }}>
      <div style={{ padding: '0 8px', marginBottom: '32px' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.3px' }}>MMA Bets</div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {navSections.map(({ label, items }) => (
          <div key={label}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#aaa', letterSpacing: '0.8px', padding: '0 8px', marginBottom: '6px' }}>
              {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {items.map(({ to, label: itemLabel }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    textDecoration: 'none',
                    color: isActive ? '#1a1a1a' : '#888',
                    background: isActive ? '#f0f0f0' : 'transparent',
                    fontWeight: isActive ? '600' : '400',
                    transition: 'all 0.15s',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: isActive ? '#1a1a1a' : '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        color: isActive ? '#fff' : '#888',
                        flexShrink: 0,
                        fontWeight: '700',
                      }}>
                        {itemLabel[0]}
                      </div>
                      {itemLabel}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid #ebebeb', paddingTop: '16px', marginTop: '16px' }}>
        <div style={{ fontSize: '11px', color: '#bbb', padding: '0 8px', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button
          onClick={signOut}
          style={{ width: '100%', textAlign: 'left', padding: '8px', borderRadius: '8px', fontSize: '13px', color: '#aaa', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#1a1a1a' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' }}
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
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', color: '#aaa' }}>Loading...</div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '48px 56px', overflowY: 'auto', maxWidth: '960px' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/bets" element={<Bets />} />
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