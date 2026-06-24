import { supabase } from "./supabase";

const getUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
};

// ── SETTINGS ─────────────────────────────────────────

export const getUnitSize = async () => {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "unit_size")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const userId = await getUserId();
    await supabase
      .from("settings")
      .insert({ key: "unit_size", value: "10", user_id: userId });
    return 10;
  }
  return Number(data.value);
};

export const setUnitSize = async (value) => {
  const userId = await getUserId();
  const { error } = await supabase
    .from("settings")
    .upsert(
      { user_id: userId, key: "unit_size", value: String(value) },
      { onConflict: "user_id,key" },
    );
  if (error) throw error;
};

// ── EVENTS ──────────────────────────────────────────

export const getEvents = async () => {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });
  if (error) throw error;
  return data;
};

export const createEvent = async (event) => {
  const { data, error } = await supabase
    .from("events")
    .insert(event)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteEvent = async (eventId) => {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
};

// ── FIGHTS ──────────────────────────────────────────

export const getFightsByEvent = async (eventId) => {
  const { data, error } = await supabase
    .from("fights")
    .select("*")
    .eq("event_id", eventId)
    .order("fight_order", { ascending: true });
  if (error) throw error;
  return data;
};

export const createFight = async (fight) => {
  const { data, error } = await supabase
    .from("fights")
    .insert(fight)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateFightResult = async (
  fightId,
  { winner, method, result_round },
) => {
  const { data, error } = await supabase
    .from("fights")
    .update({ winner, method, result_round })
    .eq("id", fightId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── BETS ────────────────────────────────────────────

export const getBets = async () => {
  const { data, error } = await supabase
    .from("bet_summary")
    .select("*")
    .order("event_date", { ascending: false });
  if (error) throw error;
  return data;
};

export const createBet = async (bet) => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bets")
    .insert({ ...bet, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateBetResult = async (betId, { result, actual_payout }) => {
  const { data, error } = await supabase
    .from("bets")
    .update({ result, actual_payout })
    .eq("id", betId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── BANKROLL ─────────────────────────────────────────

export const getBankrollHistory = async () => {
  const { data, error } = await supabase
    .from("bankroll_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: true });
  if (error) throw error;
  return data;
};

export const addBankrollSnapshot = async (balance, notes = "") => {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("bankroll_snapshots")
    .insert({ balance, notes, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── STATS ────────────────────────────────────────────

export const getBetStats = async () => {
  const { data, error } = await supabase
    .from("bet_summary")
    .select("result, stake, stake_units, profit_loss, odds");
  if (error) throw error;

  const settled = data.filter((b) => b.result !== "pending");
  const wins = settled.filter((b) => b.result === "win");
  const totalUnitsStaked = data.reduce(
    (sum, b) => sum + Number(b.stake_units || 0),
    0,
  );
  const totalUnitsProfit = settled.reduce((sum, b) => {
    const units = Number(b.stake_units || 0);
    if (b.result === "win") {
      const odds = Number(b.odds);
      return (
        sum + (odds > 0 ? (units * odds) / 100 : (units * 100) / Math.abs(odds))
      );
    }
    if (b.result === "loss") return sum - units;
    return sum;
  }, 0);

  return {
    totalBets: settled.length,
    wins: wins.length,
    losses: settled.filter((b) => b.result === "loss").length,
    winRate: settled.length
      ? ((wins.length / settled.length) * 100).toFixed(1)
      : 0,
    totalUnitsStaked: totalUnitsStaked.toFixed(2),
    totalUnitsProfit: totalUnitsProfit.toFixed(2),
    roi:
      totalUnitsStaked > 0
        ? ((totalUnitsProfit / totalUnitsStaked) * 100).toFixed(1)
        : 0,
    pendingBets: data.filter((b) => b.result === "pending").length,
  };
};
