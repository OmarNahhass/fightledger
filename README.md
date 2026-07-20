# FightLedger

A full-stack social betting tracker for MMA fans. Log bets, track performance, follow other bettors, and compete on a public leaderboard — all with real fight data pulled automatically from the ESPN API.

**Live:** https://fightledger.vercel.app

---

## Features

- **Bet tracking** — Moneyline, parlay, and props with a tiered prop builder (fight props vs fighter props)
- **Unit-based system** — Stakes and profit tracked in units for bankroll-independent comparison
- **Auto-settlement** — Bets settle automatically after fight results are confirmed via ESPN API
- **Public leaderboard** — Ranked by units profit with weekly, monthly, and all-time filters
- **Social graph** — Follow other bettors and view their recent bets in an activity feed
- **ROI breakdowns** — Performance analytics by bet type, sportsbook, and weight class
- **Dark mode** — Persisted to localStorage
- **CSV export** — Download your full bet history
- **Public access** — Leaderboard is viewable without an account

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (avatars) |
| API | ESPN MMA API (no key required) |
| Hosting | Vercel |

---

## Architecture

- **8-table normalized schema** — events, fights, bets, bankroll_snapshots, settings, profiles, follows, and a `bet_summary` security_invoker view
- **Row-level security** — All tables enforce RLS at the database layer; users can only write their own data
- **Serverless functions** — Vercel edge functions handle fight card ingestion
- **Social graph** — Follow/unfollow system with a denormalized activity feed query
- **Auto-settle** — On login, pending bets are cross-referenced against ESPN results and settled automatically

---

## Local Development

```bash
git clone https://github.com/OmarNahhass/fightledger.git
cd fightledger
npm install
```

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

```bash
npm run dev
```

---

## Author

**Omar Nahhas** — [Portfolio](https://omarnahhas.com) · [LinkedIn](https://www.linkedin.com/in/omar-nahhas-bb1aa4186/)
