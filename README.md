# MixDeck

A collaborative DJ mixing and song-creation studio for two beginners — with guided learning and an AI ghost writer. See `SPEC.md` for the full product spec.

## Status

**Phase 1 (Foundation)** — done: auth (studio + two profiles), audio library with drag-and-drop upload, client-side BPM/key/waveform analysis, named regions, Camelot-aware key filtering, projects list skeleton.

Next up (per spec §10): Phase 2 mix editor (timeline, clips, sync, crossfades, EQ).

## Stack

React + TypeScript + Vite + Tailwind (client) · Node + Express + Prisma + PostgreSQL (server). All audio analysis runs in the browser (`web-audio-beat-detector` for BPM, a chromagram + Krumhansl worker for key); mixable audio is user-owned uploads only — Spotify is metadata/reference-only, per spec §2.

## Getting started

Requires Node 20+ and a Postgres database — either local Docker (`docker compose up -d db`) **or** the deployed instance's database (see `DEPLOY.md` §5).

```bash
# 1. Server env — set DATABASE_URL to local Docker or the deployed instance
cp server/.env.example server/.env

# 2. Install + migrate
npm install
npm run db:migrate                   # creates tables (prompts for a migration name)

# 3. Run both apps
npm run dev                          # client on :5173, server on :4000
```

## Deploying

One Lightsail instance runs Postgres + API + HTTPS via `docker-compose.prod.yml` — full walkthrough in `DEPLOY.md`. In production the Express server also serves the built SPA (same origin, no CORS).

Open http://localhost:5173, choose **Start a studio**, then have your partner **Join a studio** with the invite code (the studio ID — shown in the API `/api/auth/me` response; a Settings page is coming).

## Layout

```
client/   Vite SPA — pages, audio analysis worker (src/lib/analysis), Camelot helpers
server/   Express API — routes/{auth,library,projects}, Prisma schema in prisma/
```

Uploads land in `server/uploads/<studioId>/` in dev (gitignored); swap for S3-compatible storage later.
