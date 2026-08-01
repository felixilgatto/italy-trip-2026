# Architecture — Italie 2026

Site de voyage : carte interactive du parcours + photos géolocalisées, bilingue EN/FR, hébergé sur Raspberry Pi (Coolify + Cloudflare).

## Vue d'ensemble

Un monolithe léger dans un seul conteneur Docker — adapté à un Raspberry Pi (ressources limitées) + Coolify. Pas de microservices ni de base de données séparée.

```
Cloudflare (DNS + Tunnel)
   └──> Coolify (RPi)
         └──> Conteneur unique "app" (SvelteKit)
               ├── SQLite (fichier)  → données
               ├── Volume /data      → SQLite + images uploadées
               └── Leaflet + OSM     → carte (gratuit, sans clé API)
```

## Stack

| Composant | Choix | Pourquoi |
|---|---|---|
| Framework | **SvelteKit** | SSG/SSR léger, bundle minimal, un seul port |
| Carte | **Leaflet + OpenStreetMap** | Gratuit, sans clé API |
| Base de données | **SQLite** (better-sqlite3) | Fichier unique, zéro conteneur, super sur Pi |
| Photos | Disque via **volume Docker** | Pas besoin d'object storage sur un Pi |
| Géoloc photo | Extraction **EXIF GPS** (`exifr`) + fallback | Fallback = sélecteur manuel sur la carte |
| Auth upload | **Mot de passe unique** (bcrypt + cookie signé) | Pas de comptes utilisateurs |
| i18n | **`?lang=fr` / `?lang=en`** (défaut FR) | Langue dans l'URL, partageable |
| Image Docker | `node:22-alpine` | ~100 MB, démarrage rapide sur Pi |

## Modèle de données

- **Stops** : depuis `Voyage Italie - planning.csv` (Paris, Milan, Naples, Palerme) → nom, dates, transport, coordonnées, notes
- **Trajet** : polyline GeoJSON entre les stops (générée depuis `stops.js`)
- **Photos** : caption (EN/FR), lat/lng, date de prise de vue, chemin fichier, stop associé (optionnel)

## Structure du projet

```
app/
├── src/
│   ├── lib/
│   │   ├── server/db.js          # SQLite (better-sqlite3)
│   │   ├── server/images.js      # sharp (reencode + thumbnails), MIME allowlist
│   │   ├── server/exif.js        # extraction GPS EXIF
│   │   ├── server/auth.js        # bcrypt + session cookie signé
│   │   ├── i18n/en.js, fr.js     # dictionnaires EN/FR
│   │   └── data/stops.js         # stops depuis le CSV (coordonnées, dates)
│   ├── routes/
│   │   ├── +page.svelte          # /  → carte interactive
│   │   ├── upload/+page.svelte   # /upload → password + upload photos
│   │   ├── photos/[id]/file      # rendu de l'image (thumb, download)
│   │   └── api/photos/+server.js # GET liste, POST upload (auth)
│   └── app.html
├── data/                         # DATA_DIR : SQLite + photos (volume Docker)
│   └── photos/
├── Dockerfile                    # node:22-alpine
└── .env.example                  # SESSION_SECRET, UPLOAD_PASSWORD
```

## Workflow

1. **Visiteur** → `/` : carte interactive, tracé du parcours, photos en markers/popups. Langue via `?lang=fr` / `?lang=en` (défaut FR).
2. **Toi** → `/upload` : mot de passe → upload → auto-géoloc EXIF → sinon drag du marker sur la carte → caption optionnelle → sauvegardé

## Déploiement Coolify

1. Repo git → Coolify build (Dockerfile)
2. Ajouter un volume : `/data` (SQLite `app.db` + photos dans `/data/photos`)
3. Variables d'env : `UPLOAD_PASSWORD`, `SESSION_SECRET` (jamais dans git)
4. Domaine → CNAME Cloudflare → tunnel `cloudflared` via Coolify
5. Bonus : Cloudflare Access devant `/upload` pour une couche de protection supplémentaire
