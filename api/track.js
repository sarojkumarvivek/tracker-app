import { db } from "./lib/firebase.js";
import axios from "axios";

// ── Config ─────────────────────────────────────────────────────────────────
const BOT_SIGNALS   = ["bot", "crawl", "spider", "headless"];
const CACHE_TTL_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// ── IP → Location (with Firestore cache + fallback API) ────────────────────
async function getLocation(ip) {
  // Sanitise IP for use as a Firestore document ID (colons break IPv6 IDs)
  const cacheId  = ip.replace(/:/g, "_");
  const cacheRef = db.collection("ip_cache").doc(cacheId);

  // 1. Check Firestore cache first
  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      const { location, cachedAt } = cached.data();
      const ageMs = Date.now() - cachedAt.toMillis();
      if (ageMs < CACHE_TTL_MS) {
        return location; // ✅ Cache hit — no external API call needed
      }
    }
  } catch (e) {
    console.log("Cache read failed:", e.message);
  }

  // 2. Primary geo API: ip-api.com (45 req/min free)
  let location = {};
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
    if (res.data.status === "success") {
      location = {
        country:    res.data.country,
        regionName: res.data.regionName,
        city:       res.data.city,
        zip:        res.data.zip,
        lat:        res.data.lat,
        lon:        res.data.lon,
        isp:        res.data.isp,
        org:        res.data.org,
      };
    } else {
      throw new Error("ip-api returned non-success status");
    }
  } catch {
    // 3. Fallback geo API: ipwho.is (free, no key required)
    try {
      const res = await axios.get(`https://ipwho.is/${ip}`, { timeout: 3000 });
      if (res.data.success) {
        location = {
          country:    res.data.country,
          regionName: res.data.region,
          city:       res.data.city,
          zip:        res.data.postal,
          lat:        res.data.latitude,
          lon:        res.data.longitude,
          isp:        res.data.connection?.isp,
          org:        res.data.connection?.org,
        };
      }
    } catch {
      console.log("Both geo APIs failed for IP:", ip);
    }
  }

  // 4. Write result to cache (even if empty — stops hammering APIs for bad IPs)
  try {
    await cacheRef.set({ location, cachedAt: new Date() });
  } catch (e) {
    console.log("Cache write failed:", e.message);
  }

  return location;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  const userAgent = req.headers["user-agent"] || "";
  const ua        = userAgent.toLowerCase();

  // Drop bots silently
  if (BOT_SIGNALS.some(s => ua.includes(s))) {
    return res.status(200).json({ ignored: true });
  }

  // ── Validate GPS input (prevents storing injected/malformed data) ──────
  let gps = null;
  const rawGps = req.body?.gps;
  if (
    rawGps &&
    typeof rawGps.lat === "number" && rawGps.lat >= -90  && rawGps.lat <= 90 &&
    typeof rawGps.lon === "number" && rawGps.lon >= -180 && rawGps.lon <= 180
  ) {
    gps = {
      lat:      rawGps.lat,
      lon:      rawGps.lon,
      accuracy: typeof rawGps.accuracy === "number" ? Math.round(rawGps.accuracy) : null,
    };
  }

  // ── Geo lookup (cache-first) ───────────────────────────────────────────
  const location = await getLocation(ip);

  // ── Build visit record ─────────────────────────────────────────────────
  const visitData = { ip, userAgent, location, gps, timestamp: new Date() };

  // ── Telegram message builder ───────────────────────────────────────────
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;

  let sendTelegram = Promise.resolve();
  if (botToken && chatId) {
    const gpsLine = gps?.lat
      ? `🎯 GPS: ${gps.lat}, ${gps.lon} ±${gps.accuracy}m`
      : `📡 GPS: Not shared`;

    const message = [
      `🔔 <b>New Visitor</b>`,
      ``,
      `🌍 ${location.country || "Unknown"}, ${location.city || "Unknown"}`,
      `🏙️ ${location.regionName || "—"} ${location.zip ? `(${location.zip})` : ""}`,
      `🏢 ${location.isp || "—"}`,
      `🖥️ IP: <code>${ip}</code>`,
      `📱 ${userAgent}`,
      gpsLine,
    ].join("\n");

    sendTelegram = axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      { chat_id: chatId, parse_mode: "HTML", text: message }
    );
  }

  // ── Fire Firestore write + Telegram in parallel (faster response) ──────
  await Promise.allSettled([
    db.collection("visits").add(visitData),
    sendTelegram,
  ]);

  res.status(200).json({ ok: true });
}
