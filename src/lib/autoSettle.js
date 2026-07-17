import { getPendingBetsWithFights, updateBetResult, getUnitSize } from "./db";
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

export const autoSettleBets = async () => {
  try {
    const pendingBets = await getPendingBetsWithFights();
    if (!pendingBets.length) return;

    const unitSize = await getUnitSize();

    const byDate = {};
    for (const bet of pendingBets) {
      if (!bet.event_date) continue;
      const eventDate = new Date(bet.event_date);
      const today = new Date();
      if (eventDate >= today) continue;
      if (!byDate[bet.event_date]) byDate[bet.event_date] = [];
      byDate[bet.event_date].push(bet);
    }

    if (!Object.keys(byDate).length) return;

    let settled = 0;

    for (const [date, bets] of Object.entries(byDate)) {
      try {
        const apiFights = await getFightsByDate(date);
        if (!apiFights.length) continue;

        const winnerMap = {};
        for (const fight of apiFights) {
          const winner = fight.fighters?.first?.winner
            ? fight.fighters?.first?.name
            : fight.fighters?.second?.winner
              ? fight.fighters?.second?.name
              : null;
          if (winner) {
            winnerMap[normalize(fight.fighters?.first?.name)] =
              normalize(winner);
            winnerMap[normalize(fight.fighters?.second?.name)] =
              normalize(winner);
          }
        }

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

    if (settled > 0) console.log(`Auto-settled ${settled} bets`);
    return settled;
  } catch (err) {
    console.error("Auto-settle error:", err);
    return 0;
  }
};
