// ESPN public MMA API — no key needed, CORS supported
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc";

// Unannounced slots come back as "Opponent TBA" / "TBA"
const isPlaceholder = (name) => /\bTBA\b|\bTBD\b/i.test(name);

// ESPN buckets scoreboard dates by US Eastern time, so a 1am UTC main card
// still belongs to the previous day. Returns "YYYY-MM-DD".
const toEasternDate = (iso) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

// Upcoming UFC events from ESPN's season calendar, shaped like rows in the
// events table so they can be passed straight to createEvent
export const getUpcomingEvents = async () => {
  const res = await fetch(`${ESPN_BASE}/scoreboard`);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  const data = await res.json();

  const now = Date.now();
  const events = [];

  for (const entry of data.leagues?.[0]?.calendar || []) {
    if (!entry?.label || !entry.startDate) continue;
    // Keep events still in progress today
    if (new Date(entry.endDate || entry.startDate).getTime() < now) continue;

    events.push({
      name: entry.label,
      promotion: "UFC",
      event_date: toEasternDate(entry.startDate),
      location: "TBD",
      status: "upcoming",
    });
  }

  return events.sort((a, b) => a.event_date.localeCompare(b.event_date));
};

export const getFightsByDate = async (dateStr) => {
  // ESPN expects YYYYMMDD format
  const espnDate = dateStr.replace(/-/g, "");

  const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${espnDate}`);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  const data = await res.json();

  const fights = [];

  for (const event of data.events || []) {
    for (const comp of event.competitions || []) {
      const status = comp.status?.type?.name || "";

      // Skip cancelled fights
      if (status === "STATUS_CANCELED" || status === "STATUS_POSTPONED")
        continue;

      const competitors = comp.competitors || [];
      const first = competitors.find((c) => c.order === 1) || competitors[0];
      const second = competitors.find((c) => c.order === 2) || competitors[1];

      if (!first || !second) continue;

      const fighterAName = first.athlete?.displayName;
      const fighterBName = second.athlete?.displayName;

      if (!fighterAName || !fighterBName) continue;
      if (isPlaceholder(fighterAName) || isPlaceholder(fighterBName)) continue;

      const completed = comp.status?.type?.completed || false;
      const winner = completed
        ? first.winner
          ? fighterAName
          : second.winner
            ? fighterBName
            : null
        : null;

      fights.push({
        fighters: {
          first: {
            name: fighterAName,
            winner: first.winner || false,
          },
          second: {
            name: fighterBName,
            winner: second.winner || false,
          },
        },
        category: comp.type?.text || event.name || "",
        status: { short: completed ? "FT" : "NS" },
        winner,
        eventName: event.name,
        eventId: event.id,
        competitionId: comp.id,
      });
    }
  }

  return fights;
};

// Get all fights for a specific ESPN event ID
export const getFightsByEventId = async (espnEventId) => {
  const res = await fetch(`${ESPN_BASE}/summary?event=${espnEventId}`);
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`);
  const data = await res.json();

  const fights = [];
  for (const comp of data.competitions || []) {
    const status = comp.status?.type?.name || "";
    if (status === "STATUS_CANCELED" || status === "STATUS_POSTPONED") continue;

    const competitors = comp.competitors || [];
    const first = competitors.find((c) => c.order === 1) || competitors[0];
    const second = competitors.find((c) => c.order === 2) || competitors[1];

    if (!first || !second) continue;

    const fighterAName = first.athlete?.displayName;
    const fighterBName = second.athlete?.displayName;
    if (!fighterAName || !fighterBName) continue;
    if (isPlaceholder(fighterAName) || isPlaceholder(fighterBName)) continue;

    const completed = comp.status?.type?.completed || false;

    fights.push({
      fighters: {
        first: { name: fighterAName, winner: first.winner || false },
        second: { name: fighterBName, winner: second.winner || false },
      },
      category: comp.type?.text || "",
      status: { short: completed ? "FT" : "NS" },
      winner: completed
        ? first.winner
          ? fighterAName
          : second.winner
            ? fighterBName
            : null
        : null,
    });
  }

  return fights;
};
