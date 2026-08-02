# Setup Guide

## Prerequisites

- Node.js 22+
- npm

## Development

```sh
# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` with your values:

```env
SESSION_SECRET=change-me          # any string for dev, see below for production
UPLOAD_PASSWORD=your-password     # plaintext password for uploads
COOKIE_SECURE=false               # false for local dev (no HTTPS)
DATA_DIR=data                     # where DB + photos are stored
```

Start the dev server:

```sh
npm run dev
```

The site is available at `http://localhost:5173`.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | Yes (prod) | Dev fallback | Signs the session cookie. Generate with `openssl rand -hex 32`. The app refuses to start logins without it in production. |
| `UPLOAD_PASSWORD` | Yes* | — | Plaintext upload password. Used only if `UPLOAD_PASSWORD_HASH` is not set. |
| `UPLOAD_PASSWORD_HASH` | No | — | bcrypt hash of the password. Takes precedence over `UPLOAD_PASSWORD`. |
| `COOKIE_SECURE` | No | `false` | Set to `true` when behind HTTPS (e.g. Cloudflare). Marks the cookie as `Secure`. |
| `DATA_DIR` | No | `data` | Directory for the SQLite database (`app.db`) and uploaded photos (`photos/`). |
| `BODY_SIZE_LIMIT` | No | `512K` | Max request body size. Set to `30M` for photo uploads (the Dockerfile does this automatically). |

*One of `UPLOAD_PASSWORD` or `UPLOAD_PASSWORD_HASH` is required.

## Using a hashed password

For better security, store a bcrypt hash instead of a plaintext password:

```sh
npm run hash-password -- "your-password"
```

This outputs a hash like `$2b$10$...`. Set it in your `.env`:

```env
UPLOAD_PASSWORD_HASH=$2b$10$your-hash-here
# UPLOAD_PASSWORD=         # can be removed or left empty
```

## Building for production

```sh
npm run build
npm run preview    # test the production build locally
```

The build output is in the `build/` directory. Run it with:

```sh
NODE_ENV=production node build
```

## Type checking

```sh
npm run check
```

## Data directory

The app stores all persistent data in `DATA_DIR` (default: `data/`):

```
data/
├── app.db          # SQLite database
└── photos/
    ├── abc123.jpg       # display image (max 2400px)
    └── abc123.thumb.jpg # thumbnail (600px)
```

This directory is created automatically on first run. In Docker, mount it as a volume to persist data across container restarts.
