// Parses a saved betmma.tips profile page ("Show All Betting History") into
// rows for the imported_bets table. The page has no export or API, so this
// reads its HTML tables:
//   - each event starts with an <h1>: "<a>Event name</a>, Location, 13th Feb '21"
//   - straight picks are rows whose last cell has id "td_pwriteup_<id>"
//   - props and parlays are boxes whose last cell has id "td_ppwriteup<n>_<id>",
//     holding an inner table of legs: type (Pr/Pi/PrPi), fight, pick, result, odds
// Odds on betmma.tips are decimal; FightLedger stores American.

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const EVENT_DATE = /(\d{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3})\s+'(\d{2})\s*$/

// D = draw, NC = no contest, NA = no action; blank means the fight hasn't happened yet
const LETTER_RESULTS = { W: 'win', L: 'loss', D: 'push', NC: 'void', NA: 'void' }

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
const num = (el) => Number(text(el).replace(/[$,%]/g, ''))

const parseEventDate = (str) => {
  const m = str.match(EVENT_DATE)
  if (!m) return null
  const month = MONTHS[m[2].toLowerCase()]
  if (!month) return null
  return `20${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// Two decimals keeps profit within a cent of betmma.tips; the UI rounds for display
const toAmerican = (decimal) => {
  const american = decimal >= 2 ? (decimal - 1) * 100 : -100 / (decimal - 1)
  return Math.round(american * 100) / 100
}

const fmtLegOdds = (decimal) => {
  const o = Math.round(toAmerican(decimal))
  return `${o > 0 ? '+' : ''}${o}`
}

// "O'Malley to win" style picks are straight bets; everything else is a prop
const isPickLeg = (leg) => leg.type === 'Pi'

const parseStraightRow = (idCell) => {
  const cells = [...idCell.parentElement.children]
  if (cells.length < 6) return null
  const result = LETTER_RESULTS[text(cells[2])]
  const decimal = num(cells[3])
  const units = num(cells[4])
  if (!result || !(units > 0) || !(decimal > 1)) return null
  return {
    bet_type: 'moneyline',
    pick: text(cells[0]),
    odds: toAmerican(decimal),
    stake_units: units,
    result,
    notes: `vs ${text(cells[1])}`,
    unit_profit: num(cells[5]),
  }
}

const parseLegs = (legsCell) =>
  [...legsCell.querySelectorAll('tr')]
    .map(tr => [...tr.children])
    // Header row uses <strong>; spacer rows are empty
    .filter(tds => tds.length === 5 && !tds[0].closest('tr').querySelector('strong'))
    .map(tds => ({
      type: text(tds[0]),
      fight: text(tds[1]),
      pick: text(tds[2]),
      result: LETTER_RESULTS[text(tds[3])] || null,
      decimal: num(tds[4]),
    }))
    .filter(leg => leg.pick && leg.decimal > 0)

const parseBox = (idCell) => {
  const cells = [...idCell.parentElement.children]
  if (cells.length < 5) return null
  const legs = parseLegs(cells[0])
  const units = num(cells[2])
  const unitProfit = num(cells[3])
  if (!legs.length || !(units > 0) || !Number.isFinite(unitProfit)) return null
  // Upcoming bets have no result yet; only settled history is imported
  if (legs.some(l => !l.result)) return null

  let result
  if (unitProfit > 0) result = 'win'
  else if (unitProfit < 0) result = 'loss'
  else result = legs.every(l => l.result === 'void') ? 'void' : 'push'

  if (legs.length === 1) {
    const [leg] = legs
    if (!(leg.decimal > 1) && result !== 'void') return null
    return {
      bet_type: isPickLeg(leg) ? 'moneyline' : 'props',
      pick: isPickLeg(leg) ? leg.pick : `${leg.pick} (${leg.fight})`,
      odds: leg.decimal > 1 ? toAmerican(leg.decimal) : 100,
      stake_units: units,
      result,
      notes: leg.fight,
      unit_profit: unitProfit,
    }
  }

  // A won parlay's payout already accounts for voided legs, so derive its odds from
  // the payout; otherwise multiply the legs that were live
  const liveLegs = legs.filter(l => l.result !== 'void' && l.decimal > 1)
  const decimal = result === 'win'
    ? unitProfit / units + 1
    : liveLegs.reduce((acc, l) => acc * l.decimal, 1)
  return {
    bet_type: 'parlay',
    pick: legs.map(l => l.pick).join(' + '),
    odds: decimal > 1 ? toAmerican(decimal) : 100,
    stake_units: units,
    result,
    // Same "Leg n: Pick (+odds) - A vs B" format the Bets page expands
    notes: legs.map((l, i) => `Leg ${i + 1}: ${l.pick} (${fmtLegOdds(l.decimal)}) - ${l.fight}`).join(' | '),
    unit_profit: unitProfit,
  }
}

// The "Overall Stats" box at the top of the profile: first Right/Wrong/Units Profit are the overall column
const parseOverallStats = (doc) => {
  const body = text(doc.body)
  const start = body.indexOf('Overall Stats')
  if (start === -1) return null
  const stats = body.slice(start, start + 2000)
  const right = stats.match(/Right\s+([\d,]+)/)
  const wrong = stats.match(/Wrong\s+([\d,]+)/)
  const profit = stats.match(/Units Profit\s+(-?[\d,.]+)/)
  if (!right || !wrong || !profit) return null
  const n = (m) => Number(m[1].replace(/,/g, ''))
  return { decided: n(right) + n(wrong), unitsProfit: n(profit) }
}

/**
 * Returns { username, showsAll, bets, skipped, overall, complete }.
 * `bets` are ready for imported_bets except user_id; `unit_profit` is betmma.tips'
 * own per-bet figure. betmma.tips sometimes cuts long pages off part-way, so
 * `complete` checks the parsed bets add up to the profile's own overall totals.
 */
export const parseBetmmaProfile = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const title = text(doc.querySelector('title'))
  if (!/MMA Handicapper Profile/i.test(title)) {
    throw new Error("This doesn't look like a betmma.tips profile page. Open your profile, choose \"Show All Betting History\", then save the page.")
  }
  const username = title.replace(/^MMA Handicapper Profile,?\s*/i, '').replace(/\s*:\s*MMA Betting Tips.*$/i, '').trim()

  // The history dropdown marks the selected view; "Last 20 Events" would import a partial history
  const selectedViews = [...doc.querySelectorAll('option[selected]')].map(text)
  const showsAll = selectedViews.some(v => /show all/i.test(v))

  const bets = []
  let skipped = 0
  let event = null
  const nodes = doc.querySelectorAll('h1, td[id^="td_pwriteup_"], td[id^="td_ppwriteup"]')
  for (const node of nodes) {
    if (node.tagName === 'H1') {
      const date = parseEventDate(text(node))
      if (date) event = { name: text(node.querySelector('a')) || text(node).split(',')[0], date }
      continue
    }
    if (!event) continue
    const isStraight = node.id.startsWith('td_pwriteup_')
    const bet = isStraight ? parseStraightRow(node) : parseBox(node)
    if (!bet) { skipped++; continue }
    bets.push({
      ...bet,
      source: 'betmma',
      source_id: node.id.replace(/^td_/, ''),
      event_name: event.name,
      event_date: event.date,
    })
  }

  const overall = parseOverallStats(doc)
  const parsedProfit = bets.reduce((sum, b) => sum + b.unit_profit, 0)
  // Per-bet figures are rounded to 2 decimals, so allow a little drift on long histories
  const complete = !!overall && showsAll &&
    Math.abs(parsedProfit - overall.unitsProfit) <= Math.max(0.5, bets.length * 0.005)

  return { username, showsAll, bets, skipped, overall, parsedProfit, complete }
}
