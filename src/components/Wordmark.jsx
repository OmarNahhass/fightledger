// The FightLedger logo text. Styles live in index.css (.wordmark); pass size to scale it.
// `ink` fixes the colour of "Fight" on surfaces that don't follow the theme (e.g. the always-white landing page).
export default function Wordmark({ size = 22, ink }) {
  return (
    <span className="wordmark" style={{ fontSize: `${size}px` }}>
      <span className="wordmark-fight" style={ink ? { color: ink } : undefined}>Fight</span>
      <span className="wordmark-ledger"><span>LEDGER</span></span>
    </span>
  )
}
