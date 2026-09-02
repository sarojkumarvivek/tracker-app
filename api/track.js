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
  const ua = userAgent.toLowerCase();

  if (
    ua.includes("bot") ||
    ua.includes("crawl") ||
    ua.includes("spider") ||
    ua.includes("headless")
  ) {
    return res.status(200).json({ ignored: true });
  }

let location = {};

try {
  const resGeo = await axios.get(`http://ip-api.com/json/${ip}`);
  location = {
    country:    resGeo.data.country,
    regionName: resGeo.data.regionName,
    city:       resGeo.data.city,
    zip:        resGeo.data.zip,
    lat:        resGeo.data.lat,
    lon:        resGeo.data.lon,
    isp:        resGeo.data.isp,
    org:        resGeo.data.org,
  };
} catch (err) {
  console.log("Location fetch failed");
}

  // Read GPS coords sent from browser (if user allowed location)
  const gps = req.body?.gps || null;

  await db.collection("visits").add({
    ip,
    userAgent,
    location,
    gps,               // null if denied, { lat, lon, accuracy } if granted
    timestamp: new Date()
  });

  // ── Telegram Alert ────────────────────────────────────────────────────
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId   = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      const gpsLine = gps?.lat
        ? `🎯 GPS: ${gps.lat}, ${gps.lon} ±${gps.accuracy}m`
        : `📡 GPS: Not shared`;

      const message = [
        `🔔 <b>New Visitor</b>`,
        ``,
        `🌍 ${location.country || 'Unknown'}, ${location.city || 'Unknown'}`,
        `🏙️ ${location.regionName || '—'} ${location.zip ? `(${location.zip})` : ''}`,
        `🏢 ${location.isp || '—'}`,
        `🖥️ IP: <code>${ip}</code>`,
        `📱 ${userAgent}`,
        gpsLine,
      ].join('\n');

      await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        { chat_id: chatId, parse_mode: 'HTML', text: message }
      );
    }
  } catch (e) {
    console.log('Telegram notify failed:', e.message);
  }

  res.status(200).json({ ok: true });
}
