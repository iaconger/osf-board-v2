# OSF FY27 Strategy Commitment

A team-together walkthrough for the FY27 strategy, with a real-time shared board.
A team gathers around one device, says who they are, and makes a commitment to each
part of the strategy. Every commitment flows live over WebSocket into a shared
"heart," and any big-screen viewer updates in real time.

- **Team page** (`/`) — the walkthrough. The team says who they are, picks the teams
  they work with across OSF (from OSF's real divisions), notes how their work reaches
  the people they serve (directly or through the teams they support), and then makes
  one commitment for each part of the strategy: Excellence, One OSF Team, and
  Destination OSF. They can add more commitments beyond the three. The team joins the
  shared heart as one commitment card (one dot, one feed item); every commitment is
  still captured for export. Then they see their Strategy Commitment Card, watch the
  count tick up, and can print the card.
- **Big screen** (`/screen.html`) — a filling heart with a live counter and a scrolling
  feed of what teams are committing to. Dots and feed items are colored by strategic goal.
  Point this at a projector in the room.
- **Data page** (`/admin.html`) — paste your export key to see the running total, recent
  cards, and one-click CSV / JSON downloads.
- **Server** (`server.js`) — Express serves the pages; a WebSocket relays each card to
  every connected board and screen.

## Requirements

- Node.js 18 or newer.

## Run locally

```bash
npm install
npm start
# Team device:  http://localhost:3000/
# Big screen:   http://localhost:3000/screen.html
# Data page:    http://localhost:3000/admin.html
```

On a shared network, other devices can reach the host at its LAN address
(for example `http://10.0.0.5:3000/`).

Configuration (environment variables):

| Variable          | Default | Purpose                                                        |
|-------------------|---------|----------------------------------------------------------------|
| `PORT`            | `3000`  | HTTP/WebSocket port.                                            |
| `SEED_COUNT`      | `0`     | Starting value for the counter. Defaults to a true zero start; set a number to make the board look lively at launch. |
| `SEED_FEED_ON`    | (unset) | Set to `1` to show example commitments alongside real ones. Off by default (real submissions only). |
| `MAX_CLIENTS`     | `20000` | Maximum concurrent WebSocket connections.                      |
| `ALLOWED_ORIGINS` | (unset) | Comma-separated origin allow-list for WebSocket connections. When unset, only same-origin connections are accepted. |
| `EXPORT_KEY`      | (unset) | Secret required to download captured cards. When unset, the export endpoints are disabled. |
| `DATABASE_URL`    | (unset) | PostgreSQL connection string. When set, cards are stored in a real database. On Render the blueprint provisions one and sets this automatically. |
| `DATA_FILE`       | `./data/submissions.jsonl` | Local fallback file used only when `DATABASE_URL` is unset. |
| `KEEPALIVE`       | `on`    | Self-ping to stay awake on idle-sleep hosts. Set to `off` to disable. |

## Deploying to Render

This repo ships a `render.yaml` blueprint. Push the repo to GitHub, then in Render
choose **New +** → **Blueprint** and point it at the repo (or, if the service already
exists, just push — Render redeploys automatically). Render supports the WebSocket
connection this app uses and injects `PORT` and `RENDER_EXTERNAL_URL`. After the first
deploy, set `ALLOWED_ORIGINS` to your Render URL so only your own site can open sockets.

## Capturing cards

Every accepted card is stored in a real **PostgreSQL** database when `DATABASE_URL`
is set (the Render blueprint provisions one and wires it up automatically), so cards
survive restarts, redeploys, and scaling. With no `DATABASE_URL` — e.g. local
development — it falls back to an append-only JSON-lines file so the app runs with
zero setup. On startup the live board is rebuilt from stored cards either way. Cards
can be downloaded any time the app is running.

Open `/admin.html`, paste your export key, and click **Load data** for the live total,
the most recent cards, and **Download CSV (Excel)** / **Download JSON**. Bookmark it with
the key in the URL to skip the paste: `.../admin.html?key=YOUR_EXPORT_KEY`.

Direct links (same data, no page):

- `GET /export?key=YOUR_EXPORT_KEY` — CSV (`timestamp, team, strategic_goal, what_we_do, connected_to, reaches_patient, commitment`).
- `GET /export.json?key=YOUR_EXPORT_KEY` — the same as JSON.

Set `EXPORT_KEY` to a secret value; without it the export endpoints and the data page
return `403`. On Render the blueprint generates one — read it under the service's
Environment tab.

**No personal data is collected.** A card contains only a team name (an org unit, not a
person), the teams it works with, a short free-text phrase, and one commitment per
strategy pillar with the chosen goal — no names, emails, IP addresses, or network metadata.

## Fonts

The pages use OSF's brand fonts. **Brandon Grotesque** is self-hosted from `public/fonts/`
so the body and buttons render in the real brand face; **Chaparral Pro** headings fall back
to Bitter/Georgia (load your licensed Chaparral webfont to render them exactly). The
Brandon Grotesque files included here are a trial/demo build — replace `public/fonts/*.woff2`
with your licensed webfont files before a public production launch.

## Security

- **Security headers** via Helmet, including a Content-Security-Policy that restricts
  scripts to same-origin (`script-src 'self'`), disallows third-party framing, and disables
  MIME sniffing. `X-Powered-By` is removed.
- **No inline scripts or event handlers** — all client logic lives in `app.js`,
  `screen.js`, and `admin.js`, so the strict CSP holds.
- **WebSocket origin checking**, **bounded input** (8 KB frames; validated, length-capped
  fields; goal checked against an allow-list), **per-connection rate limiting**, **output
  encoding** (all user text HTML-escaped on the client), a **heartbeat** that drops dead
  connections, and a basic profanity filter (`BLOCKED` in `server.js`).

Serve it over HTTPS (the WebSocket then upgrades to `wss://` automatically) and set
`ALLOWED_ORIGINS` to your site's origin in production.

## Files

```
server.js            Express + WebSocket server
public/index.html    Team walkthrough (markup + styles)
public/app.js        Team walkthrough + live board logic
public/screen.html   Big-screen board (markup + styles)
public/screen.js     Big-screen board logic
public/admin.html    Data page (markup)
public/admin.js      Data page logic
public/fonts/        Self-hosted Brandon Grotesque (replace with licensed files)
public/logo.png      OSF logo (big screen)
render.yaml          Render.com blueprint
```
