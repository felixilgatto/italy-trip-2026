# API Reference

All endpoints are under the SvelteKit app on port 3000.

## Authentication

### `POST /api/auth/login`

Authenticate with the upload password.

**Request body** (JSON):
```json
{ "password": "your-password" }
```

**Response** (200):
```json
{ "ok": true }
```

Sets a `trip_auth` httpOnly cookie (7-day TTL, HMAC-signed timestamp).

**Response** (401):
```json
{ "error": "wrong password" }
```

### `POST /api/auth/logout`

Clear the session cookie.

**Response** (200):
```json
{ "ok": true }
```

### `GET /api/auth/status`

Check current authentication state.

**Response** (200):
```json
{ "authed": true }
```

---

## Photos

### `GET /api/photos`

List all photos, newest first.

**Response** (200):
```json
[
  {
    "id": 1,
    "filename": "abc123.jpg",
    "mime": "image/jpeg",
    "caption_en": "Duomo di Milano",
    "caption_fr": "Cathédrale de Milan",
    "lat": 45.4642,
    "lng": 9.1900,
    "taken_at": "2026-08-15T14:30:00.000Z",
    "created_at": "2026-08-15T18:00:00.000Z"
  }
]
```

### `POST /api/photos`

Upload a photo. Requires authentication (cookie or inline `password` field).

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `photo` | File | Yes | Image file (max 25 MB, image/* MIME types) |
| `lat` | Number | Yes | Latitude (-90 to 90) |
| `lng` | Number | Yes | Longitude (-180 to 180) |
| `caption_en` | String | No | English caption |
| `caption_fr` | String | No | French caption |
| `taken_at` | String | No | ISO date string (falls back to EXIF data) |
| `password` | String | No | Inline auth (alternative to cookie) |

**Processing pipeline**:
1. File written to temp location
2. EXIF date extracted (if `taken_at` not provided)
3. Sharp re-encodes to JPEG: display image (max 2400px) + thumbnail (600px)
4. Record inserted into SQLite
5. Temp file cleaned up

**Response** (201):
```json
{
  "id": 1,
  "filename": "abc123.jpg",
  "lat": 45.4642,
  "lng": 9.1900
}
```

**Errors**:
- `401` — Not authenticated
- `400` — Missing file, invalid coordinates, file too large, unsupported type

### `PATCH /api/photos/:id`

Update photo captions. Requires authentication.

**Request body** (JSON):
```json
{
  "caption_en": "Updated caption",
  "caption_fr": "Légende mise à jour"
}
```

**Response** (200):
```json
{ "ok": true }
```

### `DELETE /api/photos/:id`

Delete a photo and its files from disk. Requires authentication.

**Response** (200):
```json
{ "ok": true }
```

---

## Image serving

### `GET /photos/:id/file`

Serve the photo file. Public (no auth required).

**Query parameters**:

| Param | Description |
|---|---|
| `thumb=1` | Serve the 600px thumbnail instead of the full image |
| `dl=1` | Force download (`Content-Disposition: attachment`) |

**Headers**: Immutable cache (`Cache-Control: public, max-age=31536000, immutable`).

Safe MIME types (JPEG, PNG, WebP, GIF, AVIF) are served inline. Others default to `application/octet-stream`.

---

## Health

### `GET /api/health`

Health check for Docker/monitoring. Verifies the database responds and the photos directory is writable.

**Response** (200):
```json
{ "status": "ok" }
```

**Response** (503): Database or filesystem error.
