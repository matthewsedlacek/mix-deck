# MixDeck — Application Specification

*A collaborative DJ mixing and song-creation studio for two beginners, with guided learning and an AI ghost writer.*

---

## 1. Product Overview

MixDeck is a web application for two users (a couple) who want to learn DJing and music blending together. Neither user has DJ experience. The app lets them:

1. Connect Spotify to browse their libraries and playlists for **inspiration and reference** (metadata only — see §2, Critical Constraint).
2. Import **audio they own** (purchased files, royalty-free stems, record-pool downloads, original recordings) into a library.
3. Blend pieces of tracks together in a visual, beginner-friendly **mix editor** with a timeline, waveforms, crossfades, loops, and effects.
4. **Save projects** (editable) and **export finished mixes** (rendered audio files).
5. Follow **guided walkthroughs** that teach core DJ concepts interactively inside the editor.
6. Chat with an **AI Ghost Writer** (Claude API) that acts as a creative collaborator: the users describe what they're trying to achieve, and it suggests structure, transitions, track pairings, and step-by-step guidance.

Design tone: warm, playful, encouraging. This is a hobby app for two people learning together — not a pro tool. Every screen should assume zero prior DJ knowledge.

---

## 2. Critical Constraint: Spotify Audio

**Spotify's Web API does not provide downloadable or manipulable audio.** The app must never attempt to extract, record, or process Spotify's audio streams — this violates Spotify's Developer Terms and is not technically supported.

Spotify's role in this app is strictly:
- OAuth login to each user's Spotify account.
- Browsing playlists, liked songs, and search (track name, artist, album art, duration, popularity).
- Building "reference boards" — collections of Spotify tracks that inspire a mix.
- Optional in-app playback of Spotify tracks via the **Spotify Web Playback SDK** (requires Spotify Premium; plays through Spotify's own player, full tracks, no manipulation) so users can listen to references without leaving the app.

**Do not rely on Spotify's audio-features or audio-analysis endpoints** (tempo, key, energy). These have been deprecated/restricted for new third-party apps. Instead, compute BPM and key **locally** on user-imported audio files (see §5.3).

All mixable audio comes from the user's own uploaded files.

---

## 3. Users & Auth

- Two primary users sharing one household account ("Studio"), each with their own profile and their own Spotify connection.
- Simple email/password or magic-link auth for the app itself; Spotify connected per-profile via OAuth (Authorization Code with PKCE).
- Both profiles share the same audio library, projects, and saved mixes. Show "last edited by" attribution so collaboration feels shared.
- No multi-tenant complexity needed in v1 — but structure the schema so Studios could contain N members later.

---

## 4. Tech Stack (recommended)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + TypeScript + Vite | SPA |
| Styling | Tailwind CSS | Dark, club-inspired theme with a warm accent palette |
| Audio engine | Web Audio API + **Tone.js** | Scheduling, effects, transport |
| Waveforms | **wavesurfer.js** (with regions plugin) | Waveform display, region selection |
| Audio analysis | **essentia.js** or `web-audio-beat-detector` + a chromagram-based key detector | Client-side BPM & key detection on import |
| Backend | Node.js + Express (or Fastify) + TypeScript | REST API |
| DB | PostgreSQL (Prisma ORM) | Projects, clips, users, chat history |
| File storage | S3-compatible object storage (or local disk in dev) | Uploaded audio + rendered exports |
| Export rendering | `OfflineAudioContext` in-browser render → encode to WAV/MP3 (`lamejs` for MP3) | Avoids server-side audio processing in v1 |
| AI | Anthropic API (Claude) | Ghost Writer chat + walkthrough hints |
| Spotify | Web API + Web Playback SDK | Metadata, playback of references |

Keep the audio engine isolated behind a clean interface (`AudioEngine` module) so it can be swapped or moved server-side later.

---

## 5. Core Features

### 5.1 Spotify Integration ("Crate Digging")
- Connect/disconnect Spotify per profile.
- Browse: user playlists, liked songs, recently played, and search.
- Create **Reference Boards**: named collections of Spotify tracks with user notes (e.g., "wedding after-party vibes," "songs with great drops").
- Play references in-app via Web Playback SDK (Premium accounts) with graceful fallback:
  - If no Premium, show a "Open in Spotify" deep link per track.
- From any reference track, one-click action: "Find this in my library" (fuzzy-match against uploaded files by title/artist) and "Ask Ghost Writer about blending this."

### 5.2 Audio Library (user-owned files)
- Drag-and-drop upload: MP3, WAV, FLAC, AAC/M4A. Multi-file.
- On import (client-side): decode, generate waveform peaks, detect **BPM**, detect **musical key** (report in both standard and Camelot notation, e.g., "A minor / 8A"), extract duration and ID3 metadata (title, artist, artwork).
- Library view: sortable/filterable table (title, artist, BPM, key, duration, date added), with Camelot-wheel-aware "compatible keys" filter.
- Each file gets a detail view with full waveform and the ability to define reusable **named regions** ("intro," "drop," "vocal hook") for use in projects.
- Show a friendly copyright note on first upload: users are responsible for having rights to the audio they upload; exports are for personal use.

### 5.3 BPM & Key Detection
- Run analysis in a Web Worker so the UI stays responsive.
- BPM: onset-detection based (essentia.js RhythmExtractor or `web-audio-beat-detector`), with a manual "tap tempo" override and half/double-time correction buttons.
- Key: chromagram + Krumhansl profile matching (essentia.js KeyExtractor), with manual override.
- Persist results to DB so analysis runs once per file.

### 5.4 Mix Editor (the heart of the app)
A horizontal, multi-track timeline. Beginner-friendly defaults everywhere.

**Layout**
- 2–4 audio tracks (lanes). Default two lanes labeled "Deck A" and "Deck B" to mirror DJ mental models; allow adding lanes.
- Master transport: play/pause, loop, metronome toggle, master BPM display, zoom.
- Bottom panel tabs: Clip Inspector | Effects | Ghost Writer chat | Walkthrough.

**Clips**
- Drag a library file (or one of its named regions) onto a lane to create a **clip**.
- Clips render waveforms; trim by dragging edges; split at playhead; snap-to-beat grid (toggleable).
- Per-clip controls: gain, fade-in/out handles, **time-stretch to project BPM** (preserve pitch — use a granular/phase-vocoder approach via Tone.js GrainPlayer or SoundTouchJS), pitch shift ± semitones, loop region.
- "Sync" button on each clip: one click conforms the clip to the project tempo and nudges it onto the beat grid. This is the beginner magic moment — make it prominent.

**Transitions**
- Crossfade tool: select two overlapping clips → choose curve (equal-power default, linear, exponential).
- Transition presets a beginner can apply in one click: "Smooth Blend" (16-bar crossfade + low-cut on outgoing), "Cut on the One" (hard cut at next downbeat), "Echo Out" (delay tail on outgoing), "Filter Sweep" (high-pass sweep across the transition).

**Effects (per-clip and per-lane)**
- 3-band EQ (the DJ essential — low/mid/high kill), high/low-pass filter with resonance, reverb, delay (beat-synced), and a simple compressor on the master.
- Keep the UI to big friendly knobs with labels; tooltips explain what each does in plain language.

**Key/tempo assistance**
- Project header shows master BPM and key. When a user drags in a clip whose key clashes (per Camelot wheel), show a gentle inline hint: "F♯ minor may clash with A minor — try pitching +1 or pick a track in 8A/8B/9A." Never block the action; suggest.

### 5.5 Projects: Save, Version, Export
- **Autosave** project state (clips, positions, effect settings, automation) every few seconds; manual "Save version" snapshots with names ("v1 — first full blend").
- Project list view with artwork (auto-collage of source track art), duration, last edited, and per-user attribution.
- **Export**: render the timeline via `OfflineAudioContext` → WAV (always) and MP3 320kbps (via lamejs). Show progress. Store export in the Studio's "Finished Mixes" shelf with playback, download, and simple notes.
- Nice-to-have: shareable private listen link (signed URL, expiring).

### 5.6 Guided Walkthroughs ("DJ School")
Interactive lessons that run *inside the mix editor* with a spotlight/coach-mark system (dim the UI, highlight the control being taught, advance on completion of each step). Track per-user progress.

Lesson track for v1 (each 5–15 minutes):
1. **Meet the Decks** — tour of the editor; import a provided practice loop pack (bundle 6–8 royalty-free loops with the app so lessons work before users upload anything).
2. **Beatmatching Basics** — what BPM is, using Sync, nudging clips onto the grid.
3. **Phrasing** — bars and phrases (8/16/32), why transitions land on phrase boundaries; exercise: place a transition marker on the right downbeat.
4. **Your First Blend** — full guided crossfade between two practice loops with EQ swap (bass kill on outgoing).
5. **Keys & the Camelot Wheel** — harmonic mixing; exercise: pick the compatible track from three options.
6. **Transition Flavors** — apply each transition preset and hear the difference.
7. **Structure a Mini-Set** — arrange three tracks with energy progression; export your first mix.

Each lesson ends with a "Try it with your own music" prompt and an optional "Ask Ghost Writer to critique what I made."

### 5.7 Ghost Writer (AI creative collaborator)
A persistent chat panel, scoped per-project, powered by the Anthropic API.

**Context provided to the model on each request (server-side):**
- Project summary: BPM, key, duration, lane/clip layout (track names, regions used, positions, transitions and effects applied).
- Library metadata (titles, artists, BPM, key — never audio).
- Active Reference Board contents and user notes.
- Recent chat history for the project.
- User's stated goal (there's a pinned "What are we going for?" field at the top of each project, e.g., "a sunset house set for our rooftop party").

**Capabilities (v1 = advice; v2 = actions):**
- Answer "how do I…" questions in beginner language.
- Suggest track pairings from the user's actual library ("Your library has X at 122 BPM in 8A — it'll blend cleanly out of Y").
- Propose set structure and energy arcs; critique the current timeline ("your transition at 2:45 lands mid-phrase — slide it 4 bars later").
- Draft transition recipes as numbered steps the user performs.
- v2: structured tool-use so Ghost Writer can *apply* suggestions (create clips, set crossfades) with a confirm/undo step. Design the chat API response format now with an optional `actions[]` array so v2 doesn't require a rework.

**System prompt guidance:** encouraging, concrete, never condescending; always reference the users' real library and project state; when suggesting something, explain the "why" in one sentence so they learn.

---

## 6. Data Model (Prisma-style sketch)

```
Studio        id, name, createdAt
User          id, studioId, name, email, spotifyRefreshToken?, lessonProgress(JSON)
AudioFile     id, studioId, title, artist, durationMs, bpm, bpmManual?, key, keyManual?,
              camelot, fileUrl, peaksUrl, artworkUrl, uploadedById, createdAt
NamedRegion   id, audioFileId, label, startMs, endMs
Project       id, studioId, name, goalStatement, masterBpm, masterKey?, artworkUrl,
              createdById, updatedAt
ProjectVersion id, projectId, label, snapshot(JSON), createdById, createdAt
Clip          id, projectId, lane, audioFileId, regionId?, startMs (timeline),
              offsetMs (source), durationMs, gainDb, fadeInMs, fadeOutMs,
              stretchRatio, pitchSemitones, effects(JSON), createdAt
Transition    id, projectId, fromClipId, toClipId, type, curve, params(JSON)
Export        id, projectId, format, fileUrl, durationMs, createdById, createdAt
ReferenceBoard id, studioId, name, notes
ReferenceTrack id, boardId, spotifyTrackId, title, artist, artworkUrl, note
ChatMessage   id, projectId, userId?, role, content, actions(JSON?), createdAt
```

Project playback state (clips/transitions) is the source of truth; `ProjectVersion.snapshot` stores immutable copies.

---

## 7. API Surface (sketch)

```
POST   /auth/…                          app auth
GET    /spotify/connect | /callback     OAuth PKCE per user
GET    /spotify/playlists | /search     proxied metadata
POST   /library/upload-url             signed upload
POST   /library/:id/analysis           persist client-computed BPM/key/peaks
CRUD   /library, /library/:id/regions
CRUD   /projects, /projects/:id/clips, /transitions, /versions
POST   /projects/:id/export            register rendered file (client renders)
POST   /projects/:id/chat              Ghost Writer (server holds Anthropic key,
                                        assembles context, streams response)
CRUD   /boards, /boards/:id/tracks
```

Never expose the Anthropic or Spotify client secrets to the browser.

---

## 8. UX Notes

- Dark theme, high-contrast waveforms, one warm accent color. Big touch-friendly controls (they may use a laptop on the couch).
- Empty states teach: an empty library shows "Add your first tracks" + the bundled practice pack; an empty project offers "Start Lesson 4: Your First Blend."
- Undo/redo everywhere in the editor (⌘Z), including effect changes.
- Latency: keep the play button → sound gap under 100ms; preload/decode clips on project open.
- Celebrate: confetti (tasteful) on first export; "Finished Mixes" shelf is designed to feel like a trophy case for the couple.

## 9. Non-Goals (v1)

- No live performance mode (real-time two-deck DJing with a crowd) — this is an arrangement/blending studio.
- No downloading, recording, or processing of Spotify audio, ever.
- No stem separation (vocal/instrumental splitting) in v1 — flag as v2 candidate (e.g., server-side Demucs), it's a big feature the users will love later.
- No public sharing/social features; private listen links only.
- No mobile app; responsive desktop-first web.

## 10. Build Phases

**Phase 1 — Foundation:** auth, studio/profiles, library upload + analysis (BPM/key/waveforms), library UI, bundled practice pack.
**Phase 2 — Editor core:** timeline, clips, sync/time-stretch, crossfades, EQ/filter, autosave, project list.
**Phase 3 — Export & polish:** offline render to WAV/MP3, versions, finished-mixes shelf, undo/redo hardening.
**Phase 4 — Spotify layer:** OAuth, browsing, reference boards, Web Playback SDK with non-Premium fallback.
**Phase 5 — DJ School:** coach-mark walkthrough engine + lessons 1–7, progress tracking.
**Phase 6 — Ghost Writer:** chat panel, server-side context assembly, streaming responses; design `actions[]` schema for v2.

**Acceptance test for v1:** two users can each connect Spotify, build a reference board, upload six songs they own, complete Lesson 4, blend three tracks into a 6-minute mix with two clean transitions, ask Ghost Writer for a critique, export an MP3, and play it back from the Finished Mixes shelf.
