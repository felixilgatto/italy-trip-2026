# Architecture

Bilingual travel site (EN/FR) for a backpacking trip across Italy: interactive Leaflet map with animated route, geotagged photo gallery, and private upload. Runs as a single Docker container on a Raspberry Pi via Coolify, behind Cloudflare.

## System overview

```
Cloudflare (DNS + Tunnel)
   └── Coolify (Raspberry Pi)
         └── Single Docker container (node:22-alpine)
               ├── SvelteKit (adapter-node)     → SSR app on port 3000
               ├── SQLite (better-sqlite3, WAL) → /data/app.db
               ├── Sharp                        → image processing
               └── Volume /data                 → DB + photos + thumbnails
```

No microservices, no external database, no object storage. Everything fits in one container with a single persistent volume.

## Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | SvelteKit (adapter-node) | SSR, small bundle, single process |
| Map | Leaflet + OpenStreetMap | Free, no API key required |
| Database | SQLite (better-sqlite3, WAL mode) | Single file, zero config, performant on Pi |
| Image processing | Sharp | Resize to 2400px display + 600px thumbnail JPEG |
| EXIF | exifr | Extract `DateTimeOriginal` from uploads |
| Auth | bcryptjs + HMAC-signed cookie | Single shared password, no user accounts |
| i18n | `?lang=en` / `?lang=fr` (default FR) | Language in URL, shareable links |
| Fonts | Caveat, Lora, Short Stack | Handwritten/serif aesthetic |
| Container | `node:22-alpine` | ~100 MB, fast startup on Pi |

## Data model

### `photos` table (SQLite)

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `filename` | TEXT | On-disk filename |
| `mime` | TEXT | Original MIME type |
| `caption_en` | TEXT | English caption (optional) |
| `caption_fr` | TEXT | French caption (optional) |
| `lat` | REAL | Latitude |
| `lng` | REAL | Longitude |
| `taken_at` | TEXT | Date photo was taken (from EXIF or client) |
| `created_at` | TEXT | Upload timestamp |

### Static data (in-code)

- **Stops** ([src/lib/data/stops.js](../src/lib/data/stops.js)) — Paris, Milan, Naples, Palermo with coordinates, bilingual names/dates/transport/notes, and a route coordinate array.
- **Itinerary** ([src/lib/data/itinerary.js](../src/lib/data/itinerary.js)) — 9 legs (5 travel, 4 stays) with timestamps (Aug 13–30 2026), travel modes (highspeed/train/boat), animation interpolation, and speed options (1x/2x/4x/8x).

## Project structure

```
src/
├── app.html                          # HTML shell
├── lib/
│   ├── server/
│   │   ├── db.js                     # SQLite init, schema, CRUD
│   │   ├── images.js                 # Sharp processing, MIME whitelist, file cleanup
│   │   ├── exif.js                   # EXIF date extraction
│   │   └── auth.js                   # Password check, HMAC tokens, cookie management
│   ├── i18n/
│   │   ├── index.js                  # Svelte stores (lang, dict), setLang()
│   │   ├── en.js                     # English dictionary
│   │   └── fr.js                     # French dictionary
│   ├── data/
│   │   ├── stops.js                  # Trip stops + route coordinates
│   │   └── itinerary.js              # Animated timeline data + interpolation
│   └── assets/
│       └── favicon.svg
├── routes/
│   ├── +layout.server.js             # Auth check → { authed } for all pages
│   ├── +layout.js                    # Merge server data + lang from URL
│   ├── +layout.svelte                # Header, nav, language switcher, mobile menu
│   ├── +page.svelte                  # / — Interactive map with animation
│   ├── upload/+page.svelte           # /upload — Login + multi-file upload
│   ├── photos/
│   │   ├── +page.server.js           # Load all photos
│   │   ├── +page.svelte              # /photos — Polaroid-style gallery
│   │   └── [id]/
│   │       ├── +page.server.js       # Load single photo
│   │       ├── +page.svelte          # /photos/:id — Detail + lightbox
│   │       └── file/+server.js       # Serve image file (thumb/download)
│   └── api/
│       ├── health/+server.js         # GET /api/health
│       ├── auth/
│       │   ├── login/+server.js      # POST /api/auth/login
│       │   ├── logout/+server.js     # POST /api/auth/logout
│       │   └── status/+server.js     # GET /api/auth/status
│       └── photos/
│           ├── +server.js            # GET/POST /api/photos
│           └── [id]/+server.js       # PATCH/DELETE /api/photos/:id
```

## Key flows

### Visitor browsing

1. `GET /` — Map loads with route polyline, stop markers, and photo markers fetched from `/api/photos`.
2. Timeline scrubber animates a travel marker along the route (play/pause, speed control).
3. Clicking a photo marker opens a popup with thumbnail, caption, and link to detail view.
4. `GET /photos` — Gallery page with polaroid-style grid, language-aware captions.
5. `GET /photos/:id` — Detail page with fullscreen lightbox, "open on map" link (`?focus=ID`).

### Photo upload (authenticated)

1. `POST /api/auth/login` — Validate password (bcrypt hash or plaintext), set signed cookie (`trip_auth`, 7 days, httpOnly).
2. Client selects files (validated: ≤25 MB, image/* only), EXIF date extracted client-side.
3. User places marker on map or uses geolocation API.
4. For each file: `POST /api/photos` with FormData → server writes temp file → EXIF extraction → Sharp processing (2400px + 600px thumb) → SQLite insert → 201 response.
5. Cleanup on failure (temp files removed).

### Authentication

- Single shared password, no user accounts.
- `UPLOAD_PASSWORD_HASH` (bcrypt, preferred) or `UPLOAD_PASSWORD` (plaintext fallback).
- HMAC-signed timestamp token stored in `trip_auth` cookie (SHA-256, `SESSION_SECRET`).
- Dev mode has a fallback secret; production requires `SESSION_SECRET` to be set.
- Protected operations: upload, caption edit, photo delete. Some endpoints accept inline password as fallback.

## Security considerations

- **Image MIME whitelist** — SVG excluded (XSS risk). Only safe raster formats served inline.
- **Sharp re-encoding** — All uploads are re-encoded to JPEG, stripping potentially malicious metadata.
- **Signed cookies** — HMAC-SHA256 prevents token tampering.
- **No plaintext secrets in git** — `.env.example` has placeholders only.
- **Cloudflare Access** — Optional extra layer in front of `/upload`.
- **Healthcheck** — Docker healthcheck verifies DB + filesystem on 30s interval.
