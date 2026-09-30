import { useMemo, useState } from 'react'
import { getBets, importBets, deleteImportedBets } from '../lib/db'
import { parseBetmmaProfile } from '../lib/betmmaImport'
import { calcProfitUnits } from '../lib/calc'
import { useAuth } from '../lib/AuthContext'
import { useCachedQuery } from '../lib/queryCache'

const NO_ROWS = []
const MAX_FILE_BYTES = 25 * 1024 * 1024

const btnPrimary = {
  background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', borderRadius: '8px',
  padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
}
const btnGhost = {
  background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-input)', borderRadius: '8px',
  padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
}
const warningStyle = {
  fontSize: '12px', lineHeight: 1.5, color: '#b45309', background: 'rgba(245,158,11,0.1)',
  border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '10px 12px',
}

const fmtUnits = (u) => `${u >= 0 ? '+' : ''}${u.toFixed(2)}u`
const fmtDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const summarize = (bets) => {
  const t = { wins: 0, losses: 0, profit: 0, first: null, last: null }
  for (const b of bets) {
    if (b.result === 'win') t.wins++
    if (b.result === 'loss') t.losses++
    t.profit += calcProfitUnits(b.stake_units, b.odds, b.result)
    if (b.event_date && (!t.first || b.event_date < t.first)) t.first = b.event_date
    if (b.event_date && (!t.last || b.event_date > t.last)) t.last = b.event_date
  }
  return t
}

export default function BetmmaImport() {
  const { user } = useAuth()
  // Same cache entry as the Bets and Dashboard pages, so they update straight after an import
  const betsQuery = useCachedQuery(['bets', user?.id], () => getBets(user.id), { enabled: !!user })
  const { setData: setBets } = betsQuery
  const importedCount = useMemo(() => (betsQuery.data ?? NO_ROWS).filter(b => b.imported).length, [betsQuery.data])

  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null) // 'reading' | 'importing' | 'removing'
  const [done, setDone] = useState('')

  const preview = useMemo(() => parsed && summarize(parsed.bets), [parsed])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again after a fix
    if (!file) return
    setError(''); setDone(''); setParsed(null)
    if (file.size > MAX_FILE_BYTES) return setError('That file is too large to be a saved betmma.tips profile page.')
    setBusy('reading')
    try {
      const result = parseBetmmaProfile(await file.text())
      if (!result.bets.length) setError('No settled bets were found on that page. Make sure it is your betmma.tips profile with "Show All Betting History" selected.')
      else setParsed(result)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(null) }
  }

  const handleImport = async () => {
    setBusy('importing'); setError('')
    try {
      const added = await importBets(parsed.bets)
      setBets(await getBets(user.id))
      const already = parsed.bets.length - added
      setDone(`Imported ${added} bet${added === 1 ? '' : 's'}${already ? ` (${already} were already imported)` : ''}.`)
      setParsed(null)
    } catch (err) {
      console.error(err)
      setError(`Import failed: ${err.message}`)
    } finally { setBusy(null) }
  }

  const handleRemove = async () => {
    if (!window.confirm(`Remove all ${importedCount} imported bets? Bets you logged on FightLedger are not affected.`)) return
    setBusy('removing'); setError(''); setDone('')
    try {
      await deleteImportedBets()
      setBets(prev => (prev ?? []).filter(b => !b.imported))
      setDone('Imported bets removed.')
    } catch (err) {
      console.error(err)
      setError(`Could not remove imported bets: ${err.message}`)
    } finally { setBusy(null) }
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>Import from betmma.tips</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
        Bring your betting history over. Imported bets are private: they count on your dashboard and bets list, never on the leaderboard or activity feed.
      </div>

      <ol style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: '18px', marginBottom: '16px' }}>
        <li>Open your profile on betmma.tips</li>
        <li>Choose <strong style={{ color: 'var(--text-primary)' }}>Show All Betting History</strong></li>
        <li>Save the page (Ctrl+S, or ⌘S on Mac)</li>
        <li>Choose the saved file below</li>
      </ol>

      {!parsed && (
        <label style={{ ...btnPrimary, display: 'inline-block', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
          {busy === 'reading' ? 'Reading...' : 'Choose saved page'}
          <input type="file" accept=".html,.htm,text/html" onChange={handleFile} style={{ display: 'none' }} />
        </label>
      )}

      {parsed && preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ background: 'var(--bg-hover)', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: 'var(--text-primary)' }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{parsed.username || 'betmma.tips profile'}</div>
            <div className="num" style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
              {parsed.bets.length} bets · {preview.wins}–{preview.losses} ·{' '}
              <span style={{ fontWeight: '600', color: preview.profit >= 0 ? '#16a34a' : '#dc2626' }}>{fmtUnits(preview.profit)}</span>
              {preview.first && <> · {fmtDate(preview.first)} – {fmtDate(preview.last)}</>}
            </div>
          </div>

          {!parsed.showsAll && (
            <div style={warningStyle}>
              This page only shows your recent events. For your full history, choose "Show All Betting History" on betmma.tips and save the page again. You can still import this now and add the rest later.
            </div>
          )}
          {parsed.showsAll && !parsed.complete && parsed.overall && (
            <div style={warningStyle}>
              This page looks cut off. betmma.tips reports {fmtUnits(parsed.overall.unitsProfit)} overall, but the saved page only adds up to {fmtUnits(parsed.parsedProfit)}. betmma.tips sometimes stops loading long histories part-way; reload the page, check it reaches your oldest event, and save it again. Anything you import now won't be duplicated later.
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleImport} disabled={!!busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
              {busy === 'importing' ? 'Importing...' : `Import ${parsed.bets.length} bets`}
            </button>
            <button onClick={() => setParsed(null)} disabled={!!busy} style={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '10px' }}>{error}</div>}
      {done && <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '10px' }}>{done}</div>}

      {importedCount > 0 && !parsed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
          <span className="num" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{importedCount} imported bets</span>
          <button onClick={handleRemove} disabled={!!busy}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', fontWeight: '600', color: '#dc2626', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy === 'removing' ? 'Removing...' : 'Remove imported bets'}
          </button>
        </div>
      )}
    </div>
  )
}
