# MixDeck

A collaborative DJ mixing and song-creation studio for two beginners — with guided learning and an AI ghost writer. See `SPEC.md` for the full product spec.

## Status

**Phase 1 (Foundation)** — done: auth (studio + two profiles), audio library with drag-and-drop upload, client-side BPM/key/waveform analysis, named regions, Camelot-aware key filtering, projects list skeleton.

Next up (per spec §10): Phase 2 mix editor (timeline, clips, sync, crossfades, EQ).

## Stack

React + TypeScript + Vite + Tailwind (client) · Node + Express + Prisma + PostgreSQL (server). All audio analysis runs in the browser (`web-audio-beat-detector` for BPM, a chromagram + Krumhansl worker for key); mixable audio is user-owned uploads only — Spotify is metadata/reference-only, per spec §2.

## Getting started

Requires Node 20+ and PostgreSQL (or Docker).

```bash
# 1. Database
docker compose up -d db

# 2. Server env
cp server/.env.example server/.env   # defaults match docker-compose

# 3. Install + migrate
npm install
npm run db:migrate                   # creates tables (prompts for a migration name)

# 4. Run both apps
npm run dev                          # client on :5173, server on :4000
```

Open http://localhost:5173, choose **Start a studio**, then have your partner **Join a studio** with the invite code (the studio ID — shown in the API `/api/auth/me` response; a Settings page is coming).

## Layout

```
client/   Vite SPA — pages, audio analysis worker (src/lib/analysis), Camelot helpers
server/   Express API — routes/{auth,library,projects}, Prisma schema in prisma/
```

Uploads land in `server/uploads/<studioId>/` in dev (gitignored); swap for S3-compatible storage later.
