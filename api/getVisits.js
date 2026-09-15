import { db } from "./lib/firebase.js";

export default async function handler(req, res) {
  // Support ?limit=N (default 100, max 500)
  const limit = Math.min(parseInt(req.query?.limit) || 100, 500);

  try {
    const snapshot = await db
      .collection("visits")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const data = snapshot.docs.map(doc => doc.data());
    res.status(200).json(data);
  } catch (err) {
    console.error("getVisits error:", err);
    res.status(500).json({ error: "Failed to load visits. Please try again." });
  }
}
