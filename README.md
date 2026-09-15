<div align="center">

# 📡 Tracker App

**A silent visitor intelligence tool — tracks every visit, pinpoints location, alerts you on Telegram, and displays real-time analytics in a protected dashboard.**

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel&style=flat-square)](https://vercel.com)
[![Firebase](https://img.shields.io/badge/Database-Firestore-orange?logo=firebase&style=flat-square)](https://firebase.google.com)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js-green?logo=node.js&style=flat-square)](https://nodejs.org)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

</div>

---

## ✨ Features

- 🌍 **IP Geolocation** — Country, city, region, ZIP, ISP, org (with 30-day cache to stay within free tier)
- 🎯 **Exact GPS** — Captures precise browser coordinates when visitor grants permission
- 🔔 **Telegram Alerts** — Real-time notification on every new visit
- 🤖 **Bot Filtering** — Crawlers, bots, and headless browsers are silently ignored
- 🔒 **Secure Dashboard** — Protected by Vercel Edge Middleware (HttpOnly cookie auth)
- 📊 **Analytics Dashboard** — Stat cards, 14-day bar chart, full visitor table
- 🛡️ **XSS Protection** — All dynamic data is escaped before rendering
- 🔁 **Geo API Fallback** — Falls back to `ipwho.is` automatically if `ip-api.com` fails

---

## 🗂️ Project Structure

```
tracker-app/
├── middleware.js           # Vercel Edge Middleware — auth guard for dashboard + API
├── vercel.json             # Function config + security headers
├── package.json
├── api/
│   ├── lib/
│   │   └── firebase.js     # Shared Firebase Admin init (single source of truth)
│   ├── auth.js             # POST /api/auth     — login endpoint
│   ├── logout.js           # GET  /api/logout   — logout + cookie clear
│   ├── track.js            # POST /api/track    — records a visit
│   └── getVisits.js        # GET  /api/getVisits — fetches visit records
└── public/
    ├── index.html          # Landing page (silently runs the tracker)
    ├── login.html          # Dashboard login UI
    └── dashboard.html      # Protected analytics dashboard
```

---

## ⚙️ How It Works

### 🔍 Tracking Flow

```
Visitor lands on index.html
        │
        ▼
 Try GPS (navigator.geolocation, 3s timeout)
        │
        ▼
 POST /api/track  { gps: { lat, lon, accuracy } | null }
        │
        ├── Bot check (user-agent contains bot/crawl/spider/headless → skip)
        │
        ├── Geo lookup
        │     ├── 1. Check ip_cache in Firestore (30-day TTL)  ← cache hit: free!
        │     ├── 2. ip-api.com  (primary, 45 req/min free)
        │     └── 3. ipwho.is   (fallback, free, no key needed)
        │
        ├── Validate GPS (lat/lon must be real numbers in valid range)
        │
        └── Fire in parallel:
              ├── Save visit → Firestore `visits` collection
              └── Send Telegram alert → bot message
```

### 🔐 Authentication Flow

| Step | Detail |
|------|--------|
| **Login** | `POST /api/auth` checks username + password against env vars, sets `dash_token` cookie |
| **Cookie** | `HttpOnly`, `Secure`, `SameSite=Strict` — valid for **7 days** |
| **Edge Guard** | `middleware.js` runs at Vercel Edge — blocks `/dashboard.html` and `/api/getVisits` if cookie is missing or invalid |
| **Logout** | `GET /api/logout` clears the cookie and redirects to `/login.html` |

### 📊 Dashboard

- **4 Stat Cards** — Total Visits, Unique IPs, Top Country, Top Browser
- **Bar Chart** — Visits per day over the last 14 days (Chart.js)
- **Visitor Table** — IP chip, Location (GPS-exact 🎯 or IP-approximate 📍), Region/ZIP, ISP/Org, Browser, Device, Timestamp
- **Refresh Button** — Manual reload with loading state
- **Error Display** — Shows real API error messages if Firestore is unavailable

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js — Vercel Serverless Functions |
| Database | Firebase Firestore (`firebase-admin`) |
| Primary Geo API | `ip-api.com` — free, no key, 45 req/min |
| Fallback Geo API | `ipwho.is` — free, no key required |
| Auth | Cookie-based (`HttpOnly`, `Secure`, `SameSite=Strict`) |
| Edge Guard | Vercel Edge Middleware |
| Alerts | Telegram Bot API |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Charts | Chart.js v4.4 (CDN) |
| Font | Inter — Google Fonts |

---

## 🚀 Deployment (Vercel)

### 1. Clone & install

```bash
git clone https://github.com/sarojkumarvivek/tracker-app.git
cd tracker-app
npm install
```

### 2. Set environment variables

Go to your Vercel project → **Settings → Environment Variables** and add:

| Variable | Description |
|----------|-------------|
| `FIREBASE_KEY` | Full Firebase Admin SDK service account JSON (stringified with `JSON.stringify`) |
| `DASHBOARD_USER` | Username for dashboard login |
| `DASHBOARD_PASS` | Password for dashboard login |
| `AUTH_SECRET` | A strong random secret — used as the auth cookie value |
| `TELEGRAM_BOT_TOKEN` | *(Optional)* Your Telegram bot token for visit alerts |
| `TELEGRAM_CHAT_ID` | *(Optional)* Your Telegram chat/channel ID |

> ⚠️ **Never commit credentials to your repository.** Keep them only in Vercel's Environment Variables.

### 3. Deploy

```bash
# Push to GitHub — Vercel auto-deploys on every push
git push origin main

# Or deploy manually via CLI
npx vercel --prod
```

### 4. Run locally

```bash
npm run dev   # starts vercel dev server
```

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `firebase-admin` | Read/write visit records and IP cache to Firestore |
| `axios` | HTTP requests to geo APIs and Telegram Bot API |

---

## 📄 API Reference

### `POST /api/auth`
Authenticate to access the dashboard.

**Body:**
```json
{ "username": "string", "password": "string" }
```

| Status | Meaning |
|--------|---------|
| `200` | Valid credentials — `dash_token` cookie is set |
| `401` | Invalid username or password |
| `500` | Auth env vars not configured on server |

---

### `POST /api/track`
Records a visitor's data. Called silently from `index.html`.

**Body:**
```json
{ "gps": { "lat": 28.6139, "lon": 77.2090, "accuracy": 15 } }
```
> `gps` is `null` if the visitor denied location permission. GPS values are validated server-side (lat ∈ [-90, 90], lon ∈ [-180, 180]).

**Response:** `200 OK` always (even for bots — returns `{ ignored: true }`)

---

### `GET /api/getVisits?limit=N`
Returns the last N visits ordered by timestamp descending.

> 🔒 Requires a valid `dash_token` cookie (enforced by Edge Middleware).

| Param | Default | Max |
|-------|---------|-----|
| `limit` | `100` | `500` |

**Responses:**
- `200` — JSON array of visit objects
- `500` — `{ "error": "Failed to load visits. Please try again." }`

---

### `GET /api/logout`
Clears the `dash_token` cookie and redirects to `/login.html`.

---

## 🏗️ Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `visits` | One document per visitor — stores IP, userAgent, location, GPS, timestamp |
| `ip_cache` | Location cache keyed by IP — expires after 30 days, reduces geo API calls |

### Enabling Auto-Delete (TTL) — Recommended for Lifetime Use

To keep Firestore within the **free tier forever**, enable TTL in the Firebase Console:

1. Go to **Firebase Console → Firestore → Indexes → TTL policies**
2. Click **Add TTL policy**
3. Collection group: `visits`, Field path: `deleteAt`
4. Firebase will automatically delete documents when `deleteAt` is reached

> The `ip_cache` collection self-manages — stale entries are overwritten when a cached IP is looked up after 30 days.

---

## 🎨 UI Design

All pages share a consistent dark glassmorphism design:

- **Background** — Deep dark (`#080d1a`) with animated radial gradient glows
- **Cards** — `rgba(255,255,255,0.04)` + `backdrop-filter: blur(12px)`
- **Accent** — Indigo `#6366f1` → Purple `#a855f7` gradient
- **Typography** — Inter (Google Fonts), 300–800 weight range
- **Animations** — Fade-in on load, hover lift on cards, floating logo, pulsing live indicator
- **Responsive** — Mobile-optimised with column hiding on the visitor table

---

## ✅ Resolved Issues

| # | Issue | Status |
|---|-------|--------|
| 1 | Firebase private key committed to repo | ✅ Fixed — stored in Vercel env vars only |
| 2 | `AUTH_SECRET` / credentials missing from env config | ✅ Fixed |
| 3 | No pagination in `getVisits.js` | ✅ Fixed — supports `?limit=N` (max 500) |
| 4 | GPS permission requested with no notice | ✅ Fixed — consent banner added |
| 5 | XSS vulnerability via raw `innerHTML` in dashboard | ✅ Fixed — `escapeHTML()` on all dynamic data |
| 6 | No `vercel.json` | ✅ Fixed — added with function config + security headers |
| 7 | No local dev script | ✅ Fixed — `npm run dev` uses `vercel dev` |
| 8 | Inconsistent indentation in `track.js` | ✅ Fixed |
| 9 | Incomplete country flag map in dashboard | ✅ Fixed — 60+ countries |
| 10 | Duplicate Firebase init in every API file | ✅ Fixed — shared `api/lib/firebase.js` |
| 11 | `ip-api.com` rate limit with no caching | ✅ Fixed — 30-day Firestore IP cache |
| 12 | No fallback if geo API is down | ✅ Fixed — `ipwho.is` fallback |
| 13 | No GPS input validation | ✅ Fixed — lat/lon range checked server-side |
| 14 | Sequential Firestore + Telegram writes | ✅ Fixed — `Promise.allSettled` parallel execution |
| 15 | `getVisits.js` crashes silently on Firestore error | ✅ Fixed — `try/catch` with clean JSON error |

---

## 📜 License

ISC © [sarojkumarvivek](https://github.com/sarojkumarvivek)
