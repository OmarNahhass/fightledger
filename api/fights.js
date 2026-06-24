export default async function handler(req, res) {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Missing date parameter" });
  }

  try {
    const response = await fetch(
      `https://v1.mma.api-sports.io/fights?date=${date}`,
      {
        headers: { "x-apisports-key": process.env.MMA_API_KEY },
      },
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
