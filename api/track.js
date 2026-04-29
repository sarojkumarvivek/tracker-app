import admin from "firebase-admin";
import axios from "axios";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY))
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  const ip =
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.socket.remoteAddress;

const userAgent = req.headers["user-agent"];

let location = {};

try {
  const resGeo = await axios.get(`http://ip-api.com/json/${ip}`);
  location = {
    country: resGeo.data.country,
    city: resGeo.data.city
  };
} catch (err) {
  console.log("Location fetch failed");
}

  await db.collection("visits").add({
  ip,
  userAgent,
  timestamp: new Date()
});

  res.status(200).json({ ok: true });
}
