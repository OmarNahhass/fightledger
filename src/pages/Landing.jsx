import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useEffect } from 'react'

export default function Landing() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoggedIn) navigate('/dashboard')
  }, [isLoggedIn])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Nav */}
      <div style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #ebebeb', background: '#ffffff' }}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', letterSpacing: '-0.3px' }}>FightLedger</div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/login')}
            style={{ background: 'transparent', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '8px 18px', fontSize: '14px', fontWeight: '600', color: '#1a1a1a', cursor: 'pointer' }}>
            Sign in
          </button>
          <button onClick={() => navigate('/login')}
            style={{ background: '#1a1a1a', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '14px', fontWeight: '600', color: '#ffffff', cursor: 'pointer' }}>
            Get started
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '20px' }}>
          MMA Betting Tracker
        </div>
        <h1 style={{ fontSize: '52px', fontWeight: '700', color: '#000', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '20px', maxWidth: '700px' }}>
          Track your MMA bets like a professional
        </h1>
        <p style={{ fontSize: '18px', color: '#666', lineHeight: 1.7, maxWidth: '540px', marginBottom: '36px' }}>
          Log bets, track ROI, compete on leaderboards, and build open parlays — all in one clean platform built for serious MMA bettors.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => navigate('/login')}
            style={{ background: '#1a1a1a', border: 'none', borderRadius: '10px', padding: '14px 32px', fontSize: '15px', fontWeight: '600', color: '#ffffff', cursor: 'pointer' }}>
            Start tracking free
          </button>
          <button onClick={() => navigate('/leaderboard')}
            style={{ background: '#ffffff', border: '1px solid #e0e0e0', borderRadius: '10px', padding: '14px 32px', fontSize: '15px', fontWeight: '600', color: '#1a1a1a', cursor: 'pointer' }}>
            View leaderboard →
          </button>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '40px 24px 80px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            { icon: '🥊', title: 'Bet Tracking', desc: 'Log moneyline, parlay, and prop bets with odds, units, sportsbook, and confidence rating.' },
            { icon: '📊', title: 'ROI Analytics', desc: 'Track your ROI by bet type. See exactly where you make and lose money.' },
            { icon: '🏆', title: 'Leaderboard', desc: 'Compete publicly with other bettors ranked by units profit and ROI.' },
            { icon: '🎰', title: 'Open Parlays', desc: 'Build compounding open parlays available on BetOnline, Bovada, and more.' },
            { icon: '⚡', title: 'Auto-Settlement', desc: 'Bets settle automatically after fights using live ESPN data.' },
            { icon: '📡', title: 'Activity Feed', desc: 'Follow other bettors and see their picks in real time.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: '#ffffff', border: '1px solid #ebebeb', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{icon}</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#000', marginBottom: '8px' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #ebebeb', padding: '24px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a1a' }}>FightLedger</div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>© 2026 Omar Nahhas</div>
      </div>
    </div>
  )
}