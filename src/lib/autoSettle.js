import {
  getPendingBetsWithFights,
  getPendingParlays,
  updateBetResult,
  getUnitSize,
} from "./db";
import { getFightsByDate } from "./mmaApi";

const normalize = (name) =>
  name
    ?.toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, "") || "";

const namesMatch = (pick, winner) => {
  if (!pick || !winner) return false;
  const p = normalize(pick);
  const w = normalize(winner);
  if (p === w) return true;
  const pLast = p.split(" ").pop();
  const wLast = w.split(" ").pop();
  return pLast.length > 2 && pLast === wLast;
};

const parseParlayLegs = (notes) => {
  if (!notes) return [];
  return notes
    .split(" | ")
    .map((legStr) => {
      const match = legStr.match(/Leg \d+: (.+?) \([-+]?\d+\)/);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);
};

const buildWinnerMap = async (date) => {
  try {
    const apiFights = await getFightsByDate(date);
    if (!apiFights.length) return {};
    const winnerMap = {};
    for (const fight of apiFights) {
      const winner = fight.fighters?.first?.winner
        ? fight.fighters?.first?.name
        : fight.fighters?.second?.winner
          ? fight.fighters?.second?.name
          : null;
      if (winner) {
        winnerMap[normalize(fight.fighters?.first?.name)] = normalize(winner);
        winnerMap[normalize(fight.fighters?.second?.name)] = normalize(winner);
      }
    }
    return winnerMap;
  } catch {
    return {};
  }
};

export const autoSettleBets = async () => {
  try {
    const [pendingBets, pendingParlays] = await Promise.all([
      getPendingBetsWithFights(),
      getPendingParlays(),
    ]);

    const unitSize = await getUnitSize();
    const today = new Date();
    let settled = 0;

    // --- Moneylines ---
    const byDate = {};
    for (const bet of pendingBets) {
      if (!bet.event_date) continue;
      if (new Date(bet.event_date) >= today) continue;
      if (!byDate[bet.event_date]) byDate[bet.event_date] = [];
      byDate[bet.event_date].push(bet);
    }

    for (const [date, bets] of Object.entries(byDate)) {
      try {
        const winnerMap = await buildWinnerMap(date);
        if (!Object.keys(winnerMap).length) continue;

        for (const bet of bets) {
          let result = null;
          for (const [fighter, winner] of Object.entries(winnerMap)) {
            if (namesMatch(bet.pick, fighter) || namesMatch(bet.pick, winner)) {
              result = namesMatch(bet.pick, winner) ? "win" : "loss";
              break;
            }
          }

          if (result) {
            const units = Number(bet.stake_units || 0);
            const odds = Number(bet.odds);
            let actual_payout = 0;
            if (result === "win") {
              const profit =
                odds > 0
                  ? (units * odds) / 100
                  : (units * 100) / Math.abs(odds);
              actual_payout = (profit + units) * unitSize;
            } else if (result === "push") {
              actual_payout = units * unitSize;
            }
            await updateBetResult(bet.id, { result, actual_payout });
            settled++;
          }
        }
      } catch (err) {
        console.error(`Auto-settle failed for date ${date}:`, err);
      }
    }

    // --- Parlays ---
    for (const bet of pendingParlays) {
      try {
        const legs = parseParlayLegs(bet.notes);
        if (!legs.length) continue;

        // Use created_at date to find the right event
        const dateStr = bet.created_at?.slice(0, 10);
        if (!dateStr) continue;
        if (new Date(dateStr) >= today) continue;

        // Try the created_at date; fall back to checking a few days around it
        let winnerMap = await buildWinnerMap(dateStr);

        // If no results on that exact date, check up to 6 days prior (event may have been weekend before)
        if (!Object.keys(winnerMap).length) {
          for (let i = 1; i <= 6; i++) {
            const d = new Date(dateStr);
            d.setDate(d.getDate() - i);
            const fallback = d.toISOString().slice(0, 10);
            winnerMap = await buildWinnerMap(fallback);
            if (Object.keys(winnerMap).length) break;
          }
        }

        if (!Object.keys(winnerMap).length) continue;

        let allWin = true;
        let anyLoss = false;

        for (const pick of legs) {
          let legResult = null;
          for (const [fighter, winner] of Object.entries(winnerMap)) {
            if (namesMatch(pick, fighter) || namesMatch(pick, winner)) {
              legResult = namesMatch(pick, winner) ? "win" : "loss";
              break;
            }
          }
          if (legResult === "loss") {
            anyLoss = true;
            allWin = false;
            break;
          }
          if (legResult === null) allWin = false;
        }

        let result = null;
        if (anyLoss) result = "loss";
        else if (allWin) result = "win";

        if (result) {
          const units = Number(bet.stake_units || 0);
          const odds = Number(bet.odds);
          let actual_payout = 0;
          if (result === "win") {
            const profit =
              odds > 0 ? (units * odds) / 100 : (units * 100) / Math.abs(odds);
            actual_payout = (profit + units) * unitSize;
          }
          await updateBetResult(bet.id, { result, actual_payout });
          settled++;
        }
      } catch (err) {
        console.error(`Parlay auto-settle failed for bet ${bet.id}:`, err);
      }
    }

    if (settled > 0) console.log(`Auto-settled ${settled} bets`);
    return settled;
  } catch (err) {
    console.error("Auto-settle error:", err);
    return 0;
  }
};
