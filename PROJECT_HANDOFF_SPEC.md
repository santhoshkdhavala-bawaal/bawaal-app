# BAWAAL — Complete Project Handoff Specification

**Document date:** 2026-11-21  
**Canonical app repo:** `C:\Users\santosh k dhavala\Desktop\bawaal app\bawaal-mobile`  
**Parent folder:** `C:\Users\santosh k dhavala\Desktop\bawaal app` (contains `bawaal-mobile` plus ancillary assets / older package scaffolding — **the runnable product is `bawaal-mobile`**)  
**Full backup (this folder):** `C:\Users\santosh k dhavala\Desktop\BAWAAL_FULL_BACKUP_2026-11-21`  
**Zip archive:** `C:\Users\santosh k dhavala\Desktop\BAWAAL_FULL_BACKUP_2026-11-21.zip`  
**Verified APK baseline:** `dist\apk\bawaal-preview-91048f75.apk` (also in `apk-baseline/`)  
**Git checkpoint tag:** `v1.0-verified-baseline-2026-11-21` → commit `b8c513a171990af56ecc1744f76301d3653846e7`  
**Checkpoint message:** `Checkpoint: v1 verified APK baseline + pre-Live Match Telecast`

This document is written from the **actual repository state** so another engineer or AI can install, run, build, and extend BAWAAL without prior chat history. Do **not** restyle or rewire locked surfaces unless the product owner explicitly unlocks the matching `.cursor/rules/*.mdc` file.

---

## 1. Project Overview & Product Vision

### 1.1 What BAWAAL is

**BAWAAL** is a mobile-first underground sports social network (Expo / React Native) centered on **asynchronous and live athletic challenges**. The product aesthetic is a minimalist elite “underground arena”: pitch-black canvases, high-contrast white type, and sports-orange accents. Video and raw action own the frame; metric counters stay behind secondary UI (⋮ / action sheets), never as permanent chrome on primary reel overlays.

**Package identity**

| Field | Value |
|---|---|
| App name | BAWAAL |
| Expo slug | `bawaal-mobile` |
| App version (`app.json`) | `1.0.1` |
| `package.json` version | `1.0.0` |
| Android / iOS id | `com.bawaal.mobile` |
| URL scheme | `bawaal` |
| EAS project id | `a73d9071-005c-46b9-bb23-f52ef215941a` |
| EAS owner | `bawaal` |

### 1.2 Core product pillars

| Pillar | What it is in code | Primary surfaces |
|---|---|---|
| **Arena feed** | Cinematic vertical/list video feed hydrated from Supabase `public.videos` + local AsyncStorage cache | `ArenaFeed.js`, `arenaFeedStore.js`, `src/services/arenaPostsService.js` |
| **SPARKS / JOSH reels** | Hub capture modes: SPARKS = stories (30s / 24h), JOSH = reels (60s, unlock 180s) | `UniversalCamera.tsx` `HUB_MODES`, `ArenaReelViewer.js` (Instagram-style vertical paging) |
| **Face Off** | Response challenges — athlete posts a challenge; others answer | Hub `FACEOFF`, shelf table `face_off_challenges`, Battles open callouts |
| **Battles** | Async open challenges + tips/breakdowns; community shelf deep-links here | `BattlesScreen.js`, `battlesFeedStore.js`, `OpenCalloutsPanel` |
| **Locker Room / Clinic** | Training squads, pinned briefs, medical/physio advisory | `LockerRoomScreen.js`, `ClinicScreen.js` (**UI locked**) |
| **Profile (Passport)** | Athlete passport hub — social stats, following, suggested athletes, logout | `ProfileScreen.js`, `AthletePassportScreen.js`, `ProfileGatewayModal.js` (**UI locked**) |
| **GAME ON** | Arena command drawer: search, **NEAR ME**, battle-tier chips, **8** sports category pills | `src/components/GameOnHub.js`, `src/constants/gameOnSports.js`, `src/constants/arenaFeedTiers.js` |
| **Sport Hub Map** | Live GPS + nearby gyms/stadiums/hubs | `SportHubMapScreen.js` — native Google Maps / web Leaflet OSM |
| **War Cry (1v1 live)** | Live 1v1 arena (Agora RTC in dev builds) | `WarCryScreen.js` → `Live1v1BattleScreen.js`, routes `Live1v1Battle` / `ChallengerArena` |
| **Live Match Telecast (next / Phase 1 landed)** | Multi-viewer live scoreboard + votes + banter + skull reactions | `src/components/LiveArenaModal.js`, `src/services/liveMatchService.js`, `supabase/migrations/20261121_live_matches.sql`, Arena header LIVE pill |

**Bottom tabs** (`CustomTabBar.js` / `MainTabs.js`):

1. **ARENA**  
2. **BATTLES**  
3. **+ BATTLE** (center FAB → `UniversalCamera` / create flow)  
4. **LOCKER ROOM**  
5. **PROFILE** (route key remains `Passport`)

**BAWAAL Hub capture modes** (locked order in `UniversalCamera.tsx` — **no Dark Arena card**):

1. SPARKS — Stories · 30s max · vanishes in 24h  
2. JOSH — Reels · 60s default · unlock 180s with coins  
3. BAWAAL BATTLE — Group challenge  
4. FACEOFF — Response challenge  
5. WAR CRY — 1v1 live  

(Legacy `DARK_ARENA` may still exist in switch/deep-link code paths; it must **not** reappear as a Hub card.)

### 1.3 Design system & UI/UX conventions

| Token | Typical value | Where used |
|---|---|---|
| Global / Arena / Passport bg | `#000000` | Core brand, V1 onboarding, most screens |
| Primary sports accent | `#FF5500` / `#FF5A00` / `#FF6600` (surface-dependent) | Arena V2, onboarding orange, CTAs |
| LIVE / telecast accents | `#FF5A1F` / `#E53935` | Arena V2 LIVE pill (`bawaal-v2-arena-ui-locked.mdc`) |
| Sport Hub Map stealth | `#08120F` canvas + gold `#FFD700` / crimson `#FF2A5F` accents | `SportHubMapScreen.js` / GAME ON map lock |
| Onboarding inputs | `#1E1E22`, `borderRadius: 12`, focus `#FF6600` | Registration / OTP |
| Type | Bold white body; orange links/checkboxes | V1 forms |
| Philosophy | Zero clutter — video owns the frame; metrics behind **⋮** only | Arena reel overlay lock |

**Emoji / reactions:** proprietary skeleton + skull PNGs only (`assets/skel_*.png`, `assets/skull_*.png`) via `BawaalEmoji` / `src/constants/bawaalEmojiAssets.js` / `src/constants/skullEmojiRegistry.js`. **Never** unicode reaction trays on Arena / Banter / DMs / War Cry bursts.

### 1.4 Locked rules & files (do not casually edit)

Rules live under `.cursor/rules/`. Treat them as production contracts.

| Rule file | Locks |
|---|---|
| `bawaal-core-system-locked.mdc` | Brand, Hub modes, vault, zero-clutter metrics |
| `bawaal-core-project.mdc` | Stack, web vs native, feed performance |
| `bawaal-ui-baseline.mdc` | Camera chrome, Arena feed cleanliness, tab bar |
| `bawaal-v2-arena-ui-locked.mdc` | ArenaV2Header, GAME ON drawer chrome, reel mute/⋮ geometry |
| `bawaal-gameon-map-locked.mdc` | **8** GAME ON categories; `SportHubMapScreen` live GPS / OSM / no CARTO |
| `bawaal-sport-hub-map-locked.mdc` | Native dark map style tokens |
| `bawaal-sport-taxonomy-locked.mdc` | `BAWAAL_SPORTS` form order |
| `bawaal-challengecam-locked.mdc` | Live viewfinder: Cancel / Flip / shutter / Hub only |
| `bawaal-arena-video-playback-locked.mdc` | Declarative `expo-video` only — no `expo-av` |
| `bawaal-arena-challenge-architecture.mdc` | Shelf indices, 1-tap camera, 200ms teardown |
| `bawaal-v1-fullstack-locked.mdc` / `bawaal-onboarding-locked.mdc` | Registration / OTP / profiles |
| `bawaal-passport-locked.mdc` | ProfileScreen / gateway / logout |
| `bawaal-locker-clinic-locked.mdc` | Locker + Clinic colors & modals |
| `bawaal-emoji-locked.mdc` | Skeleton/skull exclusive vault |
| `bawaal-data-integration-locked.mdc` | Feed filters, social soft-sync |
| `bawaal-stability-checkpoint-locked.mdc` | Soft-fail, circuit breakers, no hot-path logs |
| `bawaal-warcry-vault-hub-locked.mdc` | War Cry layout, skull registry, 5h registration cutoff |
| `bawaal-backend-lockdown-locked.mdc` | Dashboard + reel social RLS |
| `bawaal-backlink-locked.mdc` | `BackLink` chip style |
| `bawaal-async-social-locked.mdc` | Async social patterns (if present) |

**High-sensitivity locked UI files (examples):**  
`SportHubMapScreen.js`, `src/components/GameOnHub.js`, `src/constants/gameOnSports.js`, `src/components/ArenaV2Header.js`, `ArenaFeed.js` reel chrome, `UniversalCamera.tsx` live HUD, `RoleSelection.js` / OTP stack, `ProfileScreen.js`, `LockerRoomScreen.js`, `ClinicScreen.js`.

### 1.5 Recent milestones / checkpoints

| Milestone | Detail |
|---|---|
| Verified crash-free APK | `dist\apk\bawaal-preview-91048f75.apk` (~355 MB / 372,550,359 bytes) |
| Git tag | `v1.0-verified-baseline-2026-11-21` @ `b8c513a` |
| Branch at checkpoint | `cursor/supabase-blob-upload-fix` |
| Pre–Live Match Telecast | LIVE pill + `LiveArenaModal` + `live_matches` SQL migration committed in checkpoint |
| Full Desktop backup | `BAWAAL_FULL_BACKUP_2026-11-21` + `.zip` |

---

## 2. Technology Stack, Dependencies & Environment Setup

### 2.1 Exact stack (from `package.json` / `app.json` / Android)

| Layer | Version / note |
|---|---|
| Expo SDK | `~58.0.26` |
| React | `19.3.0` |
| React DOM | `19.3.0` |
| React Native | `0.88.1` |
| React Native Web | `^0.21.2` |
| Navigation | `@react-navigation/native` `^7.5.1`, native-stack `^7.21.0` |
| Supabase JS | `@supabase/supabase-js` `^2.118.0` |
| Persistence | `@react-native-async-storage/async-storage` `2.2.0` |
| Video | `expo-video` `~58.0.14` (**required** for Arena — do not re-add `expo-av`) |
| Camera | `expo-camera` `~58.0.14` |
| Location | `expo-location` `~58.0.22` |
| Maps | `react-native-maps` `1.29.11` |
| Live RTC | `react-native-agora` `^4.6.4` (autolinking **excluded** in Expo Go path via `package.json` `expo.autolinking.exclude`) |
| Reanimated | `4.7.1` + `react-native-worklets` `0.13.0` |
| Gesture Handler | `~3.3.0` |
| Dev client | `expo-dev-client` `~58.0.21` |
| Android (config plugin) | `minSdkVersion` **24**, `compileSdkVersion` **37**, `targetSdkVersion` **36** (`app.json` → `expo-build-properties`) |
| iOS deployment | **16.4** |
| Gradle wrapper | **9.4.1** (`android/gradle/wrapper/gradle-wrapper.properties`) |
| Native package | `com.bawaal.mobile`, `versionName` `1.0.1`, `versionCode` 1 |
| Observed local Node | `v24.21.0` / npm `11.19.0` (developer machine at handoff) |
| ADB | Android Debug Bridge `1.0.41` available on handoff machine |

**Navigation note:** This app uses **React Navigation** (`App.js` stack + `MainTabs`), **not** Expo Router file routes under `src/app/`. `AGENTS.md` mentions Expo Router as a general Expo convention; **BAWAAL’s live entry is `index.js` → `App.js`**.

### 2.2 Environment variables (`EXPO_PUBLIC_*`)

Create a root `.env` (gitignored). Template: `.env.example`. Backup also has `backend-supabase/.env.example` (redacted) and `ENV_KEYS_LOCAL_ONLY.txt` (local restore — **secrets; do not publish**).

| Variable | Purpose | Where to get / how used |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase → Project Settings → API → Project URL. Client: `src/services/supabase.js` / `lib/supabase.js`. Also baked into `eas.json` `build.*.env` for cloud APK builds. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon / publishable key | Same API panel. Safe for client bundles; still treat as project-scoped. Required for Auth, PostgREST, Storage. |
| `EXPO_PUBLIC_AGORA_APP_ID` | Agora RTC App ID for War Cry / live 1v1 | https://console.agora.io/ — requires a **development build**, not Expo Go. Channel naming via `src/config/agora.ts` (`arena-1v1-<battleId>`). |
| `EXPO_PUBLIC_AGORA_TOKEN` | Optional RTC token | Leave empty only if App Certificate is disabled (dev). Production should use token server. |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` | Google Maps SDK for Android | Google Cloud Console → Maps SDK for Android. Restrict to package `com.bawaal.mobile` + SHA-1. Injected by `app.config.js` → `android.config.googleMaps.apiKey`. **Must be set before native APK builds** or maps tiles fail on device. |

Without Supabase URL/key, `App.js` can surface `MissingSupabaseEnvScreen` (“Missing Supabase Environment Variables”) for builds that lack baked env.

### 2.3 Install & run (Web)

```bash
cd "C:\Users\santosh k dhavala\Desktop\bawaal app\bawaal-mobile"

# 1) Install (prefer npm; project has package-lock.json)
npm install

# 2) Copy env
copy .env.example .env
# Edit .env — set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY at minimum

# 3) Web
npx expo start --web
# or: npm run web
```

Default Metro/web often lands on **localhost:8081**. Alternate scripts: `npm run start:go` / `npm run go` use port **8082**.

### 2.4 Android APK (local Gradle / prebuild)

```bash
# Ensure .env has Google Maps key + Supabase keys before native generate
npx expo prebuild --platform android

# Local native run (dev client)
npx expo run:android
# or: npm run android

# Or assemble release/debug APK via Gradle from generated android/
cd android
.\gradlew.bat assembleRelease
# APK typically under android\app\build\outputs\apk\
```

### 2.5 Android APK (EAS)

Profiles in `eas.json`: `development` (dev client APK), `preview` (internal APK), `production` (autoIncrement).

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
# or: npm run build:android:dev
```

Download the artifact; the verified baseline on disk is:

`dist\apk\bawaal-preview-91048f75.apk`

### 2.6 Install on emulator / device & logcat

```bash
adb devices
adb install -r "C:\Users\santosh k dhavala\Desktop\bawaal app\bawaal-mobile\dist\apk\bawaal-preview-91048f75.apk"

# Crash / runtime monitoring
adb logcat *:S ReactNative:V ReactNativeJS:V AndroidRuntime:E libc:E
# Broader:
adb logcat | findstr /i "bawaal expo fatal exception"
```

Prior smoke dumps (if present): `dist\apk\logcat-dump.txt`, `logcat-final.txt`, `logcat-smoke.txt`.

### 2.7 Lint / typecheck

```bash
npx expo lint
# TypeScript config exists (tsconfig.json); many screens are still .js
```

---

## 3. Backend, Database Schema & Storage Architecture

### 3.1 Supabase client

| File | Role |
|---|---|
| `src/services/supabase.js` | App service entry |
| `lib/supabase.js` | Shared client + AsyncStorage session persistence (`persistSession` / `autoRefreshToken`) |
| `src/lib/supabaseClient.js` | Additional client helper (data-integration lock) |

Auth: phone OTP via `src/services/authOtp.js`.

### 3.2 Auth (`auth.users` + OTP)

**Production path**

1. Continue → `sendPhoneOtp` → `supabase.auth.signInWithOtp({ phone })`  
2. OTP SUBMIT (manual — **never** auto-verify on 4th digit) → `verifyPhoneOtp` → `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`  
3. `upsertRegisteredProfile` → `public.profiles` keyed by auth user UUID  

**Dev bypass** (`authOtp.js`):

| Phone | OTP | Behavior |
|---|---|---|
| `+917993992315` | `1234` | Local session, no SMS |
| `+919876543210` | `1234` | Same |

Dev sessions are **not** real `auth.users` UUIDs. Profile writes for non-UUID / `phone:` / `local:` ids **short-circuit** to local success (`profilesService` stability contract) — zero PostgREST spam.

### 3.3 Core tables (run SQL in Supabase SQL Editor)

Recommended bootstrap order (from `.env.example` comments + ENSURE scripts):

1. `supabase_schema.sql` — profiles / videos / battles + storage buckets  
2. `supabase/ENSURE_PROFILES_SPORTS_HUBS.sql` — V1 registration columns + `sports_hubs`  
3. `supabase/ENSURE_REEL_SOCIAL.sql` — legacy `reel_*`  
4. `supabase/ENSURE_SOCIAL_GRAPH.sql` — `likes` / `comments` / `follows` + belt  
5. `supabase/ENSURE_ARENA_CHALLENGES.sql` / migrations `006` — `arena_challenges`  
6. `supabase/ENSURE_ARENA_DASHBOARD.sql` then **`ENSURE_BAWAAL_BACKEND_LOCKDOWN.sql`** — dashboard shelves + strict RLS  
7. Other ENSURE_*: locker/clinic, DMs, challenges/votes, war cry schedule, etc.  
8. `supabase/migrations/20261121_live_matches.sql` — Live Match Telecast Phase 1  

#### `public.profiles`

- PK `id uuid` → `auth.users(id)` ON DELETE CASCADE  
- V1 fields: `username`, `real_name`, `age`, `gender`, `email`, `phone`, `country`, `category`, `role`, `created_at`  
- Also: `full_name`, `avatar_url`, `primary_sport`, `belt_tier` (White→Gold), location aliases (`location`, `city_country`), etc.  
- Client write allowlist: `PROFILE_SAFE_WRITE_COLUMNS` in `src/types/profile.js`  
- RLS: enabled; public/demo select historically open; own-row update preferred (`auth.uid() = id`)

#### `public.videos`

- Arena cinematic feed rows: `id`, `user_id`, `video_url`, `thumbnail_url`, `caption`, `category` (BAWAAL_SPORTS check), `created_at`  
- Upsert on conflict `id` from `arenaPostsService.persistArenaPostToSupabase`  
- Canonical cloud table — **do not** resurrect legacy `bawaal_posts` writes

#### `public.battles`

- Async open challenges: creator/responder, category, status (`open`/`active`/`completed`), video URLs  

#### `public.arena_challenges`

- Challenge posts for Arena shelf / Battles: title, sport, video_url, user_id, created_at  

#### Dashboard shelf tables (`ENSURE_ARENA_DASHBOARD` / lockdown)

| Table | Role |
|---|---|
| `war_cry_matches` | Live 1v1 match metadata |
| `sparks_josh_clips` | SPARKS/JOSH shelf clips |
| `battle_bawaal_reels` | Group battle reels |
| `face_off_challenges` | Face Off challenge rows |

Lockdown: public SELECT; authenticated INSERT/UPDATE/DELETE scoped to creator where applicable.

#### Social

| Table | Role |
|---|---|
| `likes`, `comments`, `follows` | Preferred social graph |
| `reel_likes`, `reel_banter`, `reel_follows`, … | Legacy mirror; soft-fail if missing |

#### Other

| Table | Role |
|---|---|
| `sports_hubs` | Curated map hubs (Supabase) |
| `direct_messages` | DMs |
| `squads` / `squad_briefs` | Locker (via `lockerService.js`) |
| `live_matches` | Live Match Telecast scores/votes/status + realtime publication |

#### `public.live_matches` (Phase 1)

Columns: `id`, `host_id`, `host_handle`, `sport`, `title`, `team_a_name`, `team_b_name`, `score_a/b`, `votes_a/b`, `status` (`live`|`ended`), `stream_room_id`, `created_at`, `ended_at`.  
Client: Postgres authoritative for scores/status; ephemeral banter/reactions/vote pulses on Realtime channel `live-match-{id}`; presence for watching count (`liveMatchService.js`). Soft-fail → in-memory local map if table missing.

### 3.4 Storage buckets

| Bucket | Notes |
|---|---|
| `bawaalvideos` | **Active upload target** in `uploadService.js` (`BAWAAL_VIDEO_BUCKET`) — legacy name still used by Expo uploads |
| `bawaal-videos` | Preferred new architecture name in `supabase_schema.sql` |
| `avatars` | Profile images |

Public read + anon/authenticated insert policies are defined in `supabase_schema.sql`. Object paths are typically battle/clip filenames under the video bucket; public HTTPS URLs are required for feed playback (`ensurePublicBawaalVideoUrl`).

### 3.5 Soft-fail / offline / mock behavior

| Condition | Behavior |
|---|---|
| Missing env / offline Supabase | Local AsyncStorage caches; UI stays up; no hard throws on Arena hydrate |
| Missing table / 404 / PGRST | `softFailWarn` once per key; return `[]` / local mock; session circuit may short-circuit that table |
| Non-UUID profile id | Local `ok: true` — no PostgREST profile writes |
| Missing Google Maps key on Android | Map tiles/blank map — set `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` and rebuild |
| Web video `blob:` URIs | Must be uploaded to Storage before durable feed playback; local-first prepend then cloud URL swap |
| Arena hydrate | `arenaFeedStore`: local → remote merge; shared `hydratePromise`; never throw to awaiters |

---

## 4. State Management & End-to-End Data Flows

### 4.1 Architecture pattern

- **No Redux / Zustand.** Module-level stores + listener sets + AsyncStorage.  
- **Navigation:** React Navigation native stack in `App.js` + custom tab shell in `MainTabs.js` / `mainTabContext.js`.  
- **Session:** `sessionStore.js` (`@bawaal/athlete_session_v1`, flag `bawaal_registered_user`).  
- **Filters:** `src/stores/arenaFilterStore.js` (`@bawaal/arena_filters_v1`).  
- **Feeds:** `arenaFeedStore.js`, `battlesFeedStore.js`, `battleClipStore.js`, `dmStore.js`.  
- **Social queue:** `reelSocialService.js` (`@bawaal/reel_social_queue_v1`).  
- **Local posts cache:** `arenaPostsService` (`@bawaal/arena_local_posts_v1`).

### 4.2 Journey A — Launch → splash → Entry or Main

1. `index.js` mounts app (outer crash boundary).  
2. `App.js` `AppBoot`: show splash asset `assets/splash_android_PROPER_1080x1920_black.png` until `bootReady`.  
3. Resolve initial route:  
   - `getRegisteredSession()` registered → **Main**  
   - else `hasRegisteredUserFlag()` → **Main**  
   - else Supabase `auth.getSession()` has user → **Main**  
   - else **Entry** (`AthleteRegistrationScreen` → `RoleSelection.js`)  
4. Registration: form → Terms → OTP → `setRegisteredSession` + optional `upsertRegisteredProfile` → navigate Main / Arena.

### 4.3 Journey B — Arena feed & SPARKS/JOSH reel viewer

1. `MainTabs` mounts → `startArenaFeedWarmup()` (local cache then Supabase `videos`).  
2. `ArenaFeed.js` renders cinematic cards; GAME ON filters apply via `arenaFilterStore` + `filterArenaFeedByTier` / `matchesGameOnCategory`.  
3. Community shelf every N items after leading media (`MIN_MEDIA_BEFORE_SHELF = 2`, interval 4) deep-links to Battles.  
4. Mute top-right (`arenaReelOverlay.js`); **⋮** opens on-video action stack (DM · Like · Follow · Share · Save · Banter · Comment · Send) — **no** on-canvas metric counters.  
5. Full-screen Sparks/Josh: `ArenaReelViewer.js` — vertical `FlatList` with `pagingEnabled` / `snapToInterval`, one active player.  
6. Reactions: `FloatingEmojiBurst` + vault skull/skel keys only. Banter: `BanterBottomSheet.js` → comments / `reel_banter` soft-sync.

### 4.4 Journey C — Face Off record → slow-mo preview → publish → feed

1. Hub pick **FACEOFF** (or Battles RESPOND) → stack `UniversalCamera` / `ChallengeCam` / `Challenge` → `CameraPublishHost`.  
2. Live lens: Cancel, Flip, spinning red shutter, single `MODE • DETAILS` HUD — **no** speed/flash/zoom pills on lens.  
3. After stop: `RECORDING_TEARDOWN_MS = 200` then preview. Speed / slow-mo **only** on preview (`PreviewScreen.tsx` / ClipPreviewModal).  
4. Publish sheet (`PostCreationSheet` / destination publish) → upload via `uploadService` to `bawaalvideos` → upsert `public.videos` (and Face Off shelf row when applicable) → `arenaFeedStore` prepend → Arena shows new post (local HTTPS/public URL preferred over ephemeral `blob:`).

### 4.5 Journey D — SportHubMapScreen

1. GAME ON → **NEAR ME** → stack `SportHubMap`.  
2. **Android/iOS:** `expo-location` permission + last-known/timeout GPS; `react-native-maps` with `PROVIDER_GOOGLE` on Android; `showsUserLocation`. Needs Maps API key in native config.  
3. **Web:** `WebOsmMap.js` — OpenStreetMap tiles `tile.openstreetmap.org`, dark CSS filter; city switcher Hyderabad / Delhi / Mumbai / Bengaluru / Chennai; **never** CARTO key tiles.  
4. Venues: Overpass (≈6s AbortController) + curated city fallbacks (`citySportsVenueFallbacks.js`) + Supabase `sports_hubs` merge.  
5. Footer filters: same **8** GAME ON categories (not 11-pill `BAWAAL_SPORTS`).

### 4.6 Journey E — Profile / bottom navigation

1. Tab **PROFILE** (`Passport` key) → `ProfileScreen.js`.  
2. Compact gateway `ProfileGatewayModal`: OPEN FULL PASSPORT + red-bordered **LOG OUT** (`supabase.auth.signOut()` + clear session → Entry).  
3. Full passport: `AthletePassportScreen.js`. Locker reverse link via `BackLink`.  
4. Tab bar safe-area padding must clear system nav (`CustomTabBar.js`).

### 4.7 Live Match Telecast (Phase 1 — in progress)

1. Arena V2 header **● LIVE** pill (`ArenaV2Header.js`) with count when ≥1 live `live_matches` row.  
2. Opens `LiveArenaModal.js`.  
3. `liveMatchService.js`: list/create/update matches; Realtime postgres_changes for scores; broadcast banter/reactions/votes; presence watching; vote flush ~8s; soft local fallback.

---

## 5. File & Folder Directory Map + Gotchas / Next Steps

### 5.1 Top-level map (`bawaal-mobile`)

| Path | Role |
|---|---|
| `App.js` | Root boot, splash, React Navigation stack, env missing screen |
| `index.js` | Entry + crash boundary |
| `MainTabs.js` / `CustomTabBar.js` | 5-tab shell + FAB |
| `ArenaFeed.js` | Primary Arena cinematic feed |
| `arenaFeedStore.js` | Feed hydrate / prepend / warmup |
| `ArenaReelViewer.js` | Full-screen vertical Sparks/Josh pager |
| `UniversalCamera.tsx` | Hub camera + modes (live viewfinder locked) |
| `CameraPublishHost.js` | Camera + publish modal host for stack routes |
| `PreviewScreen.tsx` | ChallengeCam post-record speed / slow-mo |
| `BattlesScreen.js` | Battles + open callouts |
| `SportHubMapScreen.js` | NEAR ME map (locked) |
| `WarCryScreen.js` / `Live1v1BattleScreen.js` | 1v1 live arena |
| `ProfileScreen.js` / `AthletePassportScreen.js` | Passport / Profile |
| `LockerRoomScreen.js` / `ClinicScreen.js` | Locker + Clinic |
| `RoleSelection.js` / `OTPModal.js` / `TermsModal.js` | V1 onboarding |
| `sessionStore.js` | Registration session persistence |
| `theme.js` | Shared color tokens |
| `app.json` / `app.config.js` / `eas.json` | Expo + Maps key injection + EAS profiles |
| `package.json` / `package-lock.json` | Dependencies & scripts |
| `android/` | Generated native project (Gradle 9.4.1); do not hand-edit CNG outputs lightly |
| `assets/` | Logos, splash, skel/skull PNGs, reel action icons |
| `.cursor/rules/` | Production lock contracts |
| `supabase/` | ENSURE SQL + migrations |
| `supabase_schema.sql` | Master profiles/videos/battles/storage bootstrap |
| `dist/apk/` | Verified APK baseline + logcat dumps |
| `src/services/` | Supabase, upload, social, maps, live match, Agora |
| `src/constants/` | Sports, GAME ON, arena tiers, emoji registry, overlay geometry |
| `src/components/` | ArenaV2Header, GameOnHub, LiveArenaModal, BawaalExpoVideo, WebOsmMap, … |
| `src/stores/` | `arenaFilterStore.js` |
| `components/` | Shared `BawaalEmoji.js`, drawers, etc. |
| `scripts/` | Dev start helpers, skull registry generators |
| `BAWAAL_MASTER_BLUEPRINT.md` | Product/architecture blueprint |
| `AGENTS.md` | Agent operating notes (Expo caveats + locks) |

### 5.2 Important `src/services/*` (one-liners)

| File | Role |
|---|---|
| `authOtp.js` | Phone OTP + dev bypass |
| `profilesService.js` | Profile upsert / soft-fail circuit |
| `uploadService.js` | Storage upload to `bawaalvideos`, public URL normalize |
| `arenaPostsService.js` | `videos` upsert + local post cache |
| `arenaChallengeService.js` | `arena_challenges` fetch (soft-fail) |
| `reelSocialService.js` / `videoSocialService.js` | Like/comment/follow + legacy reel_* |
| `nearbySportsVenuesService.js` | Overpass + merge for NEAR ME |
| `sportsHubsService.js` | Supabase `sports_hubs` |
| `liveMatchService.js` | Live Match Telecast CRUD + realtime |
| `agoraService.js` | RTC helpers for War Cry |
| `lockerService.js` / `clinicService.js` | Locker / Clinic data |
| `destinationPublishService.js` | Route publishes into shelf tables |

### 5.3 Parent folder `bawaal app`

Contains `bawaal-mobile` (the app) plus loose skull PNGs and a secondary `package.json` / `src` scaffolding. **Build and run only from `bawaal-mobile`.** The Desktop backup mirrors the mobile app tree under `frontend-and-app-code/` and SQL under `backend-supabase/`.

### 5.4 Known gotchas

1. **Android Google Maps blank map** — `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` must be present at **prebuild/EAS build** time (`app.config.js` injection). Changing `.env` alone does not fix an already-built APK.  
2. **Dev OTP vs real UUIDs** — `+917993992315` / `1234` skips Supabase Auth; profile cloud writes soft-skip. Real phone OTP users get `auth.users` UUIDs required for strict RLS inserts.  
3. **Web `blob:` URLs** — fine for preview; Arena persistence needs Storage HTTPS. Publish path must upload before relying on cloud hydrate.  
4. **Never use `expo-av` on Android APK** — historical JSI `IRuntime` ABI crash; Arena uses declarative `expo-video` only.  
5. **Agora / War Cry** — needs a development/production native build; Expo Go autolinks exclude Agora.  
6. **Bucket naming** — uploads use `bawaalvideos`; schema also provisions `bawaal-videos`. Keep both public if migrating.  
7. **Locked UI** — do not re-add Dark Arena Hub card, on-canvas like counters, multi-row GAME ON sub-sport grids, Virar-primary map seeds, or CARTO tiles.  
8. **War Cry registration cutoff** — `src/utils/warCrySchedule.js`: registrations close 5 hours before start.  
9. **Soft-fail discipline** — missing tables must not crash Arena; use existing circuit helpers, not unbounded retries.  
10. **iOS folder** — may be absent until `expo prebuild --platform ios`; Android folder is present for current APK workflow.

### 5.5 Planned next phase — Live Match Telecast (high concurrency)

**Goal:** Stadium-style live match rooms with concurrent viewers.

| Capability | Direction (Phase 1+ already sketched in code) |
|---|---|
| Live scores | Authoritative `live_matches.score_*` + postgres_changes |
| High-concurrency votes | Buffered vote pulses (`VOTE_FLUSH_MS` ≈ 8s) → DB counters; ephemeral broadcast for UX |
| Banter | Realtime broadcast on `live-match-{id}` (cap ~40 client-side) |
| Skull reactions | Vault PNG bursts (same emoji lock — no unicode) |
| Watching count | Presence on match channel (no per-viewer DB rows) |
| Live video | Future: bind `stream_room_id` to RTC/HLS pipeline (Agora or streaming CDN) beyond scoreboard UI |
| Entry UX | Arena header LIVE pill → `LiveArenaModal` list/join/host |

**Before scaling production:** tighten `live_matches` RLS (current migration allows broad anon update for local-dev softness), add rate limits, and run `20261121_live_matches.sql` on the live Supabase project if not already applied.

---

## 6. Quick restore checklist

1. Unzip / open `BAWAAL_FULL_BACKUP_2026-11-21` or clone `bawaal-mobile` at tag `v1.0-verified-baseline-2026-11-21`.  
2. `npm install`  
3. Restore `.env` from `backend-supabase/ENV_KEYS_LOCAL_ONLY.txt` (local only) or fill `.env.example`.  
4. Run ENSURE / schema SQL on Supabase if tables missing.  
5. `npx expo start --web` for UI; use verified APK + `adb install -r` for native baseline.  
6. Read `.cursor/rules/*.mdc` before changing Arena, GAME ON, Map, Camera, Onboarding, Passport, or Locker.

---

*End of handoff specification — generated from repository inspection on 2026-11-21. Application source files were not modified to produce this document (docs only).*
