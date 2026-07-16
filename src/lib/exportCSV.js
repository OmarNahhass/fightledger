export const exportBetsToCSV = (bets) => {
  const headers = [
    "Date",
    "Event",
    "Pick",
    "Bet Type",
    "Odds",
    "Stake (units)",
    "Stake ($)",
    "To Win (units)",
    "Result",
    "Profit/Loss (units)",
    "Sportsbook",
    "Confidence",
    "Notes",
  ];

  const calcPayoutUnits = (units, odds) => {
    const u = Number(units),
      o = Number(odds);
    if (!u || !o) return 0;
    return o > 0 ? (u * o) / 100 : (u * 100) / Math.abs(o);
  };

  const rows = bets.map((bet) => {
    const profitUnits =
      bet.result === "win"
        ? calcPayoutUnits(bet.stake_units, bet.odds)
        : bet.result === "loss"
          ? -Number(bet.stake_units)
          : 0;

    return [
      bet.event_date
        ? new Date(bet.event_date).toLocaleDateString("en-US")
        : "",
      bet.event_name || "",
      bet.pick || "",
      bet.bet_type || "",
      bet.odds || "",
      bet.stake_units || "",
      bet.stake ? Number(bet.stake).toFixed(2) : "",
      calcPayoutUnits(bet.stake_units, bet.odds).toFixed(2),
      bet.result || "",
      bet.result !== "pending" ? profitUnits.toFixed(2) : "",
      bet.sportsbook || "",
      bet.confidence || "",
      bet.notes || "",
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mma-bets-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
