export const getFightsByDate = async (date) => {
  const res = await fetch(`/api/fights?date=${date}`);
  const data = await res.json();
  return data.response || [];
};
