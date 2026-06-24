export const calcProfitUnits = (units, odds, result) => {
  const u = Number(units || 0);
  const o = Number(odds);
  if (result === "win") {
    return o > 0 ? (u * o) / 100 : (u * 100) / Math.abs(o);
  }
  if (result === "loss") return -u;
  return 0; // push, void, pending
};
