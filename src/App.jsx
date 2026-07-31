import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { useTheme } from './lib/ThemeContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Bets from './pages/Bets'
import Leaderboard from './pages/Leaderboard'
import Activity from './pages/Activity'
import Settings from './pages/Settings'
import OpenParlays from './pages/OpenParlays'
import Landing from './pages/Landing'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊', public: false },
  { to: '/bets', label: 'My Bets', icon: '🥊', public: false },
  { to: '/open-parlays', label: 'Parlays', icon: '🎰', public: false },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆', public: true },
  { to: '/activity', label: 'Activity', icon: '📡', public: false },
]

const navSections = [
  {
    label: 'MENU',
    items: [
      { to: '/dashboard', label: 'Dashboard', public: false },
      { to: '/bets', label: 'My Bets', public: false },
      { to: '/open-parlays', label: 'Open Parlays', public: false },
      { to: '/leaderboard', label: 'Leaderboard', public: true },
      { to: '/activity', label: 'Activity', public: false },
    ]
  },
  {
    label: 'ACCOUNT',
    items: [
      { to: '/settings', label: 'Settings', public: false },
    ]
  },
]

function BottomNav() {
  const { isLoggedIn } = useAuth()
  const location = useLocation()

  const visibleItems = isLoggedIn ? navItems : navItems.filter(i => i.public)

  return (
    <nav className="bottom-nav">
      {visibleItems.map(({ to, label, icon }) => {
        const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
            style={{ color: isActive ? 'var(--text-primary)' : 'var(--nav-inactive)' }}
          >
            <span className="bottom-nav-icon">{icon}</span>
            <span className="bottom-nav-label" style={{ color: isActive ? 'var(--text-primary)' : 'var(--nav-inactive)' }}>{label}</span>
          </NavLink>
        )
      })}
      {isLoggedIn && (
        <NavLink
          to="/settings"
          end
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav-icon">⚙️</span>
          <span className="bottom-nav-label" style={{ color: location.pathname === '/settings' ? 'var(--text-primary)' : 'var(--nav-inactive)' }}>Settings</span>
        </NavLink>
      )}
    </nav>
  )
}

function Sidebar() {
  const { user, signOut, isLoggedIn } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <aside className="sidebar" style={{
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
        <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>FightLedger</div>
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}
        >
          {isDark ? '☀' : '☾'}
        </button>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {navSections.map(({ label, items }) => {
          const visibleItems = isLoggedIn ? items : items.filter(i => i.public)
          if (!visibleItems.length) return null
          return (
            <div key={label}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.8px', padding: '0 8px', marginBottom: '6px' }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {visibleItems.map(({ to, label: itemLabel }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/dashboard'}
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
                          width: '28px', height: '28px', borderRadius: '6px',
                          background: isActive ? 'var(--nav-active-icon)' : 'var(--bg-hover)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px',
                          color: isActive ? 'var(--nav-active-icon-text)' : 'var(--text-secondary)',
                          flexShrink: 0, fontWeight: '700',
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
          )
        })}
      </nav>

      <div style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: '16px', marginTop: '16px' }}>
        {isLoggedIn ? (
          <>
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
          </>
        ) : (
          <NavLink
            to="/login"
            style={{
              display: 'block', width: '100%', textAlign: 'center',
              padding: '9px', borderRadius: '8px', fontSize: '13px',
              fontWeight: '600', textDecoration: 'none',
              background: 'var(--text-primary)', color: 'var(--bg)',
            }}
          >
            Sign in
          </NavLink>
        )}
      </div>
    </aside>
  )
}

function RequireAuth({ children, redirectTo = '/login' }) {
  const { isLoggedIn, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      navigate(redirectTo)
    }
  }, [loading, isLoggedIn, redirectTo])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Loading...</div>
  if (!isLoggedIn) return null

  return children
}

function AppShell() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <main className="main-content" style={{ flex: 1, padding: '48px 56px', overflowY: 'auto', maxWidth: '960px' }}>
          <Routes>
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<RequireAuth redirectTo="/login"><Dashboard /></RequireAuth>} />
            <Route path="/bets" element={<RequireAuth redirectTo="/login"><Bets /></RequireAuth>} />
            <Route path="/open-parlays" element={<RequireAuth redirectTo="/login"><OpenParlays /></RequireAuth>} />
            <Route path="/activity" element={<RequireAuth redirectTo="/login"><Activity /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth redirectTo="/login"><Settings /></RequireAuth>} />
          </Routes>
        </main>
        <BottomNav />
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