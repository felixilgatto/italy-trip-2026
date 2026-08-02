# Italie 2026

A bilingual (EN/FR) travel site for a backpacking trip across Italy: an interactive Leaflet map of the route plus a geotagged photo gallery. Self-hosted in a single Docker container (Coolify on a Raspberry Pi, behind Cloudflare).

## Features

- **Map** (`/`) — trip route with an animated train/ferry marker and geotagged photo markers with popups
- **Gallery** (`/photos`) — captions in EN/FR, thumbnails, download and (when authed) delete
- **Private upload** (`/upload`) — password auth, manual map-marker placement with a geolocation button, per-file captions
- **i18n** — `?lang=en` / `?lang=fr`, default FR, language preserved across links

## Tech stack

SvelteKit (adapter-node) · Leaflet + OpenStreetMap · SQLite (better-sqlite3) · sharp · exifr · bcryptjs

## Development

```sh
npm install
cp .env.example .env   # then set SESSION_SECRET and UPLOAD_PASSWORD
npm run dev
```

To store a bcrypt hash of the upload password instead of plaintext:

```sh
npm run hash-password -- "your-password"
```

## Building

```sh
npm run build
npm run preview
```

## Environment variables

| Variable | Description |
|---|---|
| `SESSION_SECRET` | **Required in production.** Signs the session cookie (`openssl rand -hex 32`). The app refuses to start logins without it outside dev. |
| `UPLOAD_PASSWORD` | Plaintext upload password (used only if no hash is set). |
| `UPLOAD_PASSWORD_HASH` | bcrypt hash of the upload password; takes precedence over `UPLOAD_PASSWORD`. |
| `COOKIE_SECURE` | Set to `true` when behind HTTPS (e.g. Cloudflare). |
| `DATA_DIR` | Where the SQLite DB and photos are stored (default `data`). |
| `BODY_SIZE_LIMIT` | Max request body accepted by the server (default `512K`). Set to `30M` so photo uploads up to the 25 MB limit work. |

## Deployment

Build the Docker image and mount a volume at `/data` (holds `app.db` and `/data/photos`). See `docs/architecture.md` for the full Coolify + Cloudflare setup.
