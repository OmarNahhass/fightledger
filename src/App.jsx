import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
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

function Logo() {
  const { isLoggedIn } = useAuth()
  // Signed-out users would just bounce off /dashboard to /login, so send them home instead
  return (
    <Link to={isLoggedIn ? '/dashboard' : '/'} className="logo-link" aria-label="FightLedger home"
      style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.3px', textDecoration: 'none' }}>
      <span style={{ color: 'var(--text-primary)' }}>Fight</span><span style={{ color: 'var(--accent)' }}>Ledger</span>
    </Link>
  )
}

function MobileTopBar({ onOpenMenu }) {
  return (
    <header className="mobile-topbar">
      <Logo />
      <button className="mobile-menu-btn" onClick={onOpenMenu} aria-label="Open menu">
        <span className="mobile-menu-icon" aria-hidden="true"><span /><span /><span /></span>
        Menu
      </button>
    </header>
  )
}

function Sidebar({ open, onClose }) {
  const { user, signOut, isLoggedIn } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} style={{
      width: '240px',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '32px 18px',
      flexShrink: 0,
      minHeight: '100vh',
      transition: 'background 0.2s',
    }}>
      <div style={{ padding: '0 8px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}
        >
          {isDark ? '☀' : '☾'}
        </button>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">×</button>
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {navSections.map(({ label, items }) => {
          const visibleItems = isLoggedIn ? items : items.filter(i => i.public)
          if (!visibleItems.length) return null
          return (
            <div key={label}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', letterSpacing: '0.08em', padding: '0 12px', marginBottom: '10px' }}>
                {label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {visibleItems.map(({ to, label: itemLabel }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/dashboard'}
                    className="sidebar-link"
                    style={({ isActive }) => ({
                      display: 'block',
                      padding: '11px 12px',
                      borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                      borderRadius: '0 8px 8px 0',
                      fontSize: '14px',
                      textDecoration: 'none',
                      color: isActive ? 'var(--text-primary)' : 'var(--nav-inactive)',
                      background: isActive ? 'var(--nav-active-bg)' : 'transparent',
                      fontWeight: isActive ? '600' : '400',
                      transition: 'all 0.15s',
                    })}
                  >
                    {itemLabel}
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
        {!isLoggedIn && (
          <NavLink
            to="/login?mode=signup"
            style={{
              display: 'block', width: '100%', textAlign: 'center', boxSizing: 'border-box',
              marginTop: '8px', padding: '8px', borderRadius: '8px', fontSize: '13px',
              fontWeight: '600', textDecoration: 'none',
              border: '1px solid var(--sidebar-border)', color: 'var(--text-primary)',
            }}
          >
            Get started
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

function Layout() {
  const location = useLocation()
  // Remember which path the drawer was opened on so navigating closes it
  const [menuOpenedAt, setMenuOpenedAt] = useState(null)
  const menuOpen = menuOpenedAt === location.pathname
  const setMenuOpen = open => setMenuOpenedAt(open ? location.pathname : null)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = e => { if (e.key === 'Escape') setMenuOpenedAt(null) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <MobileTopBar onOpenMenu={() => setMenuOpen(true)} />
      <div className={`sidebar-backdrop${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="main-content" style={{ flex: 1, padding: '48px 56px', overflowY: 'auto', maxWidth: '960px', minWidth: 0 }}>
        <Routes>
          <Route path="/leaderboard" element={<Leaderboard />} />
          {/* Key on the query so switching between Sign in / Get started resets the form mode */}
          <Route path="/login" element={<Login key={location.search} />} />
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<RequireAuth redirectTo="/login"><Dashboard /></RequireAuth>} />
          <Route path="/bets" element={<RequireAuth redirectTo="/login"><Bets /></RequireAuth>} />
          <Route path="/open-parlays" element={<RequireAuth redirectTo="/login"><OpenParlays /></RequireAuth>} />
          <Route path="/activity" element={<RequireAuth redirectTo="/login"><Activity /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth redirectTo="/login"><Settings /></RequireAuth>} />
        </Routes>
      </main>
    </div>
  )
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
      <Layout />
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