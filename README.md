# 📡 Tracker App

A **web visitor tracking application** deployed on **Vercel**. It silently collects visitor data (IP, location, GPS, browser/device info) from anyone who visits the landing page, and displays it in a secure, protected analytics dashboard.

---

## 🗂️ Project Structure

```
tracker-app/
├── .env                  # Firebase service account key + auth credentials
├── middleware.js          # Vercel Edge Middleware (auth guard)
├── package.json           # Dependencies: firebase-admin, axios
├── api/
│   ├── auth.js            # POST /api/auth — login endpoint
│   ├── logout.js          # GET  /api/logout — logout endpoint
│   ├── track.js           # POST /api/track — records a visit
│   └── getVisits.js       # GET  /api/getVisits — fetches visit records
└── public/
    ├── index.html         # Landing page (runs the tracker)
    ├── login.html         # Dashboard login UI
    └── dashboard.html     # Protected analytics dashboard
```

---

## ⚙️ How It Works

### 🔍 Tracking Flow

1. **Visitor lands on `index.html`** → JavaScript silently fires `POST /api/track`
2. **`/api/track`** extracts:
   - **IP Address** — from `x-forwarded-for` header
   - **User-Agent** — browser/device string
   - **GPS Coordinates** — if the visitor grants browser geolocation permission (`navigator.geolocation`)
   - **IP-based Geo Data** — via `http://ip-api.com/json/{ip}` (country, city, region, ZIP, ISP, org, lat/lon)
   - **Bot Filtering** — UAs containing `bot`, `crawl`, `spider`, or `headless` are ignored and return `{ ignored: true }`
3. All data is saved to **Firebase Firestore** under the `visits` collection

### 🔐 Authentication Flow

| Step | Description |
|---|---|
| Login | `POST /api/auth` validates username & password from environment variables and sets a `dash_token` cookie |
| Cookie | `HttpOnly`, `Secure`, `SameSite=Strict`, valid for **7 days** |
| Edge Guard | `middleware.js` runs at Vercel Edge — protects `/dashboard.html` and `/api/getVisits` by comparing the `dash_token` cookie to `AUTH_SECRET` |
| Logout | `GET /api/logout` clears the cookie and redirects to `/login.html` |

### 📊 Dashboard

- Fetches the **last 100 visits** from `/api/getVisits` every **5 seconds**
- Displays **4 stat cards**: Total Visits, Unique IPs, Top Country, Top Browser
- **Chart.js bar chart** — visits per day (last 14 days)
- **Visitor table** with columns:
  - Masked IP (e.g. `192.168.1.xxx`)
  - Location — GPS-exact 🎯 (green link + accuracy badge `±Xm`) or IP-approximate 📍
  - Region / ZIP
  - ISP / Org
  - Browser
  - Device
  - Timestamp

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (Vercel Serverless Functions) |
| Database | Firebase Firestore (via `firebase-admin`) |
| Geo API | `ip-api.com` — free, no API key required |
| Auth | Cookie-based (`HttpOnly`, `Secure`, `SameSite=Strict`) |
| Edge Guard | Vercel Edge Middleware |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Charts | Chart.js v4.4 (CDN) |
| Font | Inter — Google Fonts |

---

## 🚀 Deployment (Vercel)

This project is designed to be deployed directly to **Vercel** using its file-based routing conventions:

- Files in `api/` are automatically treated as **Serverless Functions**
- `middleware.js` at the root is picked up as **Vercel Edge Middleware**
- Files in `public/` are served as **static assets**

### Required Environment Variables

Set the following in your Vercel project dashboard under **Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `FIREBASE_KEY` | Full Firebase Admin SDK service account JSON (stringified) |
| `DASHBOARD_USER` | Username for dashboard login |
| `DASHBOARD_PASS` | Password for dashboard login |
| `AUTH_SECRET` | A strong secret string used as the auth cookie value |

> ⚠️ **Never commit real credentials to your repository.** The `.env` file should be in `.gitignore`.

---

## 📦 Dependencies

```json
{
  "axios": "^1.15.2",
  "firebase-admin": "^13.8.0"
}
```

- **`axios`** — used in `api/track.js` to call the `ip-api.com` geolocation service
- **`firebase-admin`** — used to read/write visit records to Firestore

---

## 📄 API Reference

### `POST /api/auth`
Authenticates the dashboard user.

**Request Body:**
```json
{ "username": "string", "password": "string" }
```

**Responses:**
- `200 OK` — credentials valid, sets `dash_token` cookie
- `401 Unauthorized` — invalid credentials
- `500 Internal Server Error` — auth env vars not configured

---

### `POST /api/track`
Records a visitor's data to Firestore.

**Request Body:**
```json
{ "gps": { "lat": 0.0, "lon": 0.0, "accuracy": 10 } }
```
> `gps` can be `null` if the visitor denied location permission.

**Responses:**
- `200 OK` — visit recorded or bot ignored

---

### `GET /api/getVisits`
Returns the last 100 visits, ordered by timestamp descending.

> 🔒 Protected by Edge Middleware — requires valid `dash_token` cookie.

**Response:** `200 OK` — JSON array of visit objects

---

### `GET /api/logout`
Clears the `dash_token` cookie and redirects to `/login.html`.

---

## 🎨 UI Design

Both pages use a **dark glassmorphism design** with:

- Deep dark background (`#080d1a`) with radial gradient glows
- Glassmorphism cards (`rgba(255,255,255,0.05)` + `backdrop-filter: blur`)
- Accent gradient — Indigo (`#6366f1`) → Purple (`#a855f7`)
- **Inter** typeface (Google Fonts)
- Smooth animations: fade-in on load, hover lift on cards, pulse on live indicator
- Fully responsive with mobile column hiding on the visitor table

---

## ⚠️ Known Issues & Observations

| # | Issue | Severity |
|---|---|---|
| 1 | ~~**`.env` contains a real Firebase private key** — critical secret leak risk if pushed to a public repo~~ ✅ **FIXED** — `.env` is gitignored (never committed). Key is stored in Vercel Environment Variables for production. | 🟢 Resolved |
| 2 | ~~**`AUTH_SECRET`, `DASHBOARD_USER`, `DASHBOARD_PASS` must be set in Vercel** — not present in `.env`~~ ✅ **FIXED** — Added all three to `.env` with placeholder values. | 🟢 Resolved |
| 3 | ~~**No pagination in `getVisits.js`** — hardcoded `limit(100)`, older records are inaccessible~~ ✅ **FIXED** — Supports `?limit=N` (default 100, max 500). | 🟢 Resolved |
| 4 | ~~**GPS permission is silent** — `index.html` requests geolocation with no visible notice~~ ✅ **FIXED** — Added an analytics consent banner that auto-hides after 5s. | 🟢 Resolved |
| 5 | ~~**Potential XSS in `dashboard.html`** — `tr.innerHTML` injects raw Firestore data without sanitization~~ ✅ **FIXED** — Added `escapeHTML()` applied to all dynamic ISP, org, IP, region, ZIP data. | 🟢 Resolved |
| 6 | ~~**No `vercel.json`** — relies on Vercel conventions; adding one would give more routing control~~ ✅ **FIXED** — Created `vercel.json` with function config and security headers. | 🟢 Resolved |
| 7 | ~~**No local dev server** — no `start` script; requires Vercel CLI to run locally~~ ✅ **FIXED** — Added `"dev": "vercel dev"` and `"start": "vercel dev"` to `package.json`. | 🟢 Resolved |
| 8 | ~~**Inconsistent indentation in `track.js`** — IP/UA block is not indented inside `handler`~~ ✅ **FIXED** — Reformatted all code to consistent 2-space indentation inside `handler`. | 🟢 Resolved |
| 9 | ~~**Incomplete flag map in `getFlag()`** — many countries fall back to the generic 🌍 emoji~~ ✅ **FIXED** — Expanded from 24 to 60+ countries across Asia, Europe, Americas, Africa, Oceania. | 🟢 Resolved |

---

## 📜 License

ISC
