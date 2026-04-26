import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  await db.collection("visits").add({
    ip,
    userAgent,
    timestamp: new Date()
  });

  res.status(200).json({ ok: true });
}
