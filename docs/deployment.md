# Deployment

Guide for deploying to a Raspberry Pi with Coolify and Cloudflare.

## Overview

```
Internet
   └── Cloudflare (DNS + Tunnel + optional Access)
         └── cloudflared (on Pi)
               └── Coolify
                     └── Docker container (port 3000)
                           └── SvelteKit app + SQLite + photos
```

## Docker

### Build the image

```sh
docker build -t italie-2026 .
```

The multi-stage Dockerfile:
1. **deps** — Installs native dependencies (python3, make, g++ for better-sqlite3/sharp)
2. **build** — Compiles SvelteKit with `vite build`
3. **runtime** — Minimal `node:22-alpine` image (~100 MB) with just the build output

### Run locally with Docker

```sh
docker run -d \
  --name italie-2026 \
  -p 3000:3000 \
  -v italie-data:/data \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e UPLOAD_PASSWORD=your-password \
  -e COOKIE_SECURE=false \
  italie-2026
```

The container:
- Listens on port 3000
- Stores all persistent data in `/data` (SQLite DB + photos)
- Has a healthcheck every 30s (`GET /api/health`)
- Sets `BODY_SIZE_LIMIT=30M` for photo uploads

## Coolify setup

1. **Add the Git repository** to Coolify as a new service (Docker-based).

2. **Configure the volume**: Mount a persistent volume at `/data`. This holds:
   - `app.db` — SQLite database
   - `photos/` — uploaded images and thumbnails

3. **Set environment variables**:

   | Variable | Value |
   |---|---|
   | `SESSION_SECRET` | `openssl rand -hex 32` — generate a unique secret |
   | `UPLOAD_PASSWORD_HASH` | Output of `npm run hash-password -- "your-password"` |
   | `COOKIE_SECURE` | `true` (behind Cloudflare HTTPS) |

4. **Deploy** — Coolify builds from the Dockerfile and starts the container.

## Cloudflare setup

### DNS tunnel

1. Install `cloudflared` on the Raspberry Pi (or use Coolify's built-in tunnel support).
2. Create a tunnel: `cloudflared tunnel create italie`.
3. Configure the tunnel to route traffic to `http://localhost:3000`.
4. Add a CNAME record in Cloudflare DNS pointing your domain to `<tunnel-id>.cfargotunnel.com`.

### Optional: Cloudflare Access

Add an extra authentication layer in front of `/upload` using Cloudflare Access:

1. Go to **Cloudflare Zero Trust > Access > Applications**.
2. Create an application for your domain, restricting the path `/upload*`.
3. Add an authentication policy (email OTP, GitHub, etc.).

This provides a second factor before anyone even sees the upload page.

## Backups

The entire application state is in the `/data` volume:

```sh
# Stop the container first for a consistent backup
docker stop italie-2026

# Copy the data directory
cp -r /path/to/volume/data /path/to/backup/data-$(date +%Y%m%d)

# Restart
docker start italie-2026
```

For SQLite-safe live backups:

```sh
sqlite3 /path/to/volume/data/app.db ".backup '/path/to/backup/app.db'"
```

## Troubleshooting

| Issue | Fix |
|---|---|
| Login fails in production | Ensure `SESSION_SECRET` is set (not the dev fallback) |
| Uploads return 413 | Check `BODY_SIZE_LIMIT` is `30M` (set automatically in Dockerfile) |
| Cookies not sent | Set `COOKIE_SECURE=true` if behind HTTPS |
| Photos not persisting | Verify the `/data` volume is mounted and writable |
| Container unhealthy | Check logs: `docker logs italie-2026`. The healthcheck hits `/api/health` which verifies DB + filesystem |
| ARM build issues | The `node:22-alpine` image supports ARM64 natively. For older Pi (ARMv7), you may need `--platform linux/arm/v7` |
