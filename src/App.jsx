import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { useTheme } from './lib/ThemeContext'
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
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <aside style={{
      width: '220px',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 16px',
      flexShrink: 0,
      minHeight: '100vh',
      transition: 'background 0.2s',
    }}>
      <div style={{ padding: '0 8px', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>MMA Bets</div>
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}
        >
          {isDark ? '☀' : '☾'}
        </button>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {navSections.map(({ label, items }) => (
          <div key={label}>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.8px', padding: '0 8px', marginBottom: '6px' }}>
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
                    color: isActive ? 'var(--text-primary)' : 'var(--nav-inactive)',
                    background: isActive ? 'var(--nav-active-bg)' : 'transparent',
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
                        background: isActive ? 'var(--nav-active-icon)' : 'var(--bg-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        color: isActive ? 'var(--nav-active-icon-text)' : 'var(--text-secondary)',
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

      <div style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: '16px', marginTop: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 8px', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button
          onClick={signOut}
          style={{ width: '100%', textAlign: 'left', padding: '8px', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
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
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
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