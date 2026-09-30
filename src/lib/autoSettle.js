import {
  getPendingBetsWithFights,
  getPendingParlays,
  getEvents,
  getFightsForEvents,
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

// Notes look like "Leg 1: Pick (+odds) - A vs B | Leg 2: ..."
const parseParlayLegs = (notes) => {
  if (!notes) return [];
  return notes
    .split(" | ")
    .map((legStr) => {
      const match = legStr.match(/Leg \d+: (.+?) \([-+]?\d+\)(?: - (.+))?$/);
      return match ? { pick: match[1].trim(), fight: match[2]?.trim() } : null;
    })
    .filter(Boolean);
};

// Event dates by event id, plus "A vs B" -> event date for every fight on the user's events
const buildEventDateMaps = async () => {
  const events = await getEvents();
  const eventDates = new Map(events.map((e) => [e.id, e.event_date]));
  const fights = await getFightsForEvents(events.map((e) => e.id));
  const fightDates = new Map(
    fights.map((f) => [`${f.fighter_a} vs ${f.fighter_b}`, eventDates.get(f.event_id)]),
  );
  return { eventDates, fightDates };
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

// Only ever touch the signed-in user's own bets
export const autoSettleBets = async (userId) => {
  if (!userId) return 0;
  try {
    const [pendingBets, pendingParlays] = await Promise.all([
      getPendingBetsWithFights(userId),
      getPendingParlays(userId),
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
    // Parlays have no fight_id: use their event_id, or for older parlays each leg's "A vs B" fight
    const { eventDates, fightDates } = pendingParlays.length
      ? await buildEventDateMaps()
      : { eventDates: new Map(), fightDates: new Map() };
    const winnerMapsByDate = {};

    for (const bet of pendingParlays) {
      try {
        const legs = parseParlayLegs(bet.notes);
        if (!legs.length) continue;

        // Parlays with neither can't be placed on a card; leave those for manual settling
        const dates = bet.event_id
          ? [eventDates.get(bet.event_id)]
          : [...new Set(legs.map((l) => fightDates.get(l.fight)))];
        if (dates.some((d) => !d || new Date(d) >= today)) continue;

        const winnerMap = {};
        for (const date of dates) {
          winnerMapsByDate[date] ??= await buildWinnerMap(date);
          Object.assign(winnerMap, winnerMapsByDate[date]);
        }
        if (!Object.keys(winnerMap).length) continue;

        let allWin = true;
        let anyLoss = false;

        for (const { pick } of legs) {
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
