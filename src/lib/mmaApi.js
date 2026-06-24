const API_KEY = import.meta.env.VITE_RAPIDAPI_KEY;
const BASE_URL = "https://mmaapi.p.rapidapi.com/api/mma";

const headers = {
  "x-rapidapi-key": API_KEY,
  "x-rapidapi-host": "mmaapi.p.rapidapi.com",
};

export const searchEvent = async (name) => {
  const res = await fetch(`${BASE_URL}/search/${encodeURIComponent(name)}`, {
    headers,
  });
  const data = await res.json();
  console.log("Search response:", data);
  return data;
};

export const getEventDetails = async (eventId) => {
  const res = await fetch(`${BASE_URL}/event/${eventId}`, { headers });
  const data = await res.json();
  console.log("Event details:", data);
  return data;
};
