import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Support ?limit=N (default 100, max 500)
  const limit = Math.min(parseInt(req.query?.limit) || 100, 500);

  const snapshot = await db
    .collection("visits")
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();

  const data = snapshot.docs.map(doc => doc.data());

  res.status(200).json(data);
}
