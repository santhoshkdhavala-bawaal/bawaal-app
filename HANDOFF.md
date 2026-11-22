# BAWAAL Mobile — Master Handoff & Architecture Blueprint

> **Self-contained archive package.** Any future AI model or IDE should read this file **and** `AGENTS.md` + `.cursor/rules/*.mdc` before editing.  
> Generated: **2026-11-22** · Snapshot commit below · Do **not** paste real API keys into docs or chat.

---

## 1. Project Overview & Current Build Status

| Field | Value |
|---|---|
| **App name** | BAWAAL |
| **Package / slug** | `com.bawaal.mobile` / `bawaal-mobile` |
| **App version** | `1.0.1` (`app.json`) · npm `1.0.0` |
| **Git branch** | `cursor/supabase-blob-upload-fix` |
| **Commit (HEAD)** | `10077eb1303e52d4c7fe4647b8284b86b005231b` |
| **Latest commit subject** | Replace Arena GAME ON with NEAR ME that opens the sports map directly |
| **EAS projectId** | `a73d9071-005c-46b9-bb23-f52ef215941a` |
| **Owner** | `bawaal` |
| **Primary UX shell** | React Navigation native stack (`App.js`) + custom tab shell (`MainTabs.js`) — **not** Expo Router |

### Production-ready (locked / shipped in source)

- Arena V2 header: **`● LIVE` → `NEAR ME` → Bell`** (NEAR ME → `SportHubMap` directly)
- BAWAAL LIVE telecast hub + room (optional scoreboard, cricket pad, `canScore`, 6-char invites, 5 skull reactions)
- V1 registration / OTP / profiles soft-fail persistence
- Session boot: fresh launch → **Arena**; logout → Phone+OTP only (`hasRegisteredPreviously`)
- Arena reel playback (`expo-video` declarative path), reel ⋮ actions, vault emoji bursts
- Passport / Locker / Clinic visual contracts
- Sport taxonomy (`BAWAAL_SPORTS`) + 8 GAME ON map categories
- War Cry 1v1 surface + Hub modes (no Dark Arena Hub card)
- Soft-fail data layer (missing tables/columns never crash Arena UX)

### Pending / verify on device (mobile)

- Android **preview APK** install + smoke on emulator/device (camera permission, LIVE host camera, Maps key)
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY` must be set for native Google Maps pins
- Agora RTC (`EXPO_PUBLIC_AGORA_APP_ID` / token) for War Cry 1v1 — requires **dev client / APK**, not Expo Go
- Confirm Supabase SQL ENSURE scripts applied on the target project (see §6)
- Local workspace APKs under `dist/` (gitignored) — include in Desktop archive when present

### Recent stabilizing commits (context)

1. `10077eb` — Arena GAME ON → NEAR ME opens sports map directly  
2. `b1f8f5f` — Persist login flags; launch Arena; logout → phone OTP only  
3. `8566eb2` — Harden LIVE host camera for emulator APK + preview APK scripts  
4. `1ef5855` — Master app lock + lint clear for stabilized surfaces  
5. `771c7e8` — Lock BAWAAL LIVE for mobile (invites, soft-fail persistence)

---

## 2. Complete Technology Stack & Versions

Source: `package.json` (Expo SDK **58** family).

### Runtime

| Package | Version |
|---|---|
| `expo` | `~58.0.26` |
| `react` / `react-dom` | `19.3.0` |
| `react-native` | `0.88.1` |
| `react-native-web` | `^0.21.2` |
| `@expo/metro-runtime` | `~58.0.15` |

### Navigation & UI

| Package | Version |
|---|---|
| `@react-navigation/native` | `^7.5.1` |
| `@react-navigation/native-stack` | `^7.21.0` |
| `react-native-screens` | `~4.30.1` |
| `react-native-safe-area-context` | `~5.11.1` |
| `react-native-gesture-handler` | `~3.3.0` |
| `react-native-reanimated` | `4.7.1` |
| `react-native-worklets` | `0.13.0` |
| `@expo/vector-icons` | `^15.0.2` |

### Backend / storage / session

| Package | Version |
|---|---|
| `@supabase/supabase-js` | `^2.118.0` |
| `@react-native-async-storage/async-storage` | `2.2.0` |
| `react-native-url-polyfill` | `^4.0.0` |

### Camera / media / location / maps / live

| Package | Version | Notes |
|---|---|---|
| `expo-camera` | `~58.0.14` | ChallengeCam / UniversalCamera |
| `expo-video` | `~58.0.14` | **Arena feed only** — never re-add `expo-av` |
| `expo-audio` | `~58.0.12` | Global audio session |
| `expo-image` | `~58.0.18` | |
| `expo-image-picker` | `~58.0.10` | |
| `expo-media-library` | `~58.0.14` | Gallery |
| `expo-file-system` | `~58.0.14` | Session FS fallback |
| `expo-location` | `~58.0.22` | NEAR ME GPS |
| `react-native-maps` | `1.29.11` | Native Google Maps |
| `react-native-agora` | `^4.6.4` | Autolinking **excluded** in Expo Go path; used in native builds via plugin |

### Other Expo modules

`expo-dev-client` `~58.0.21` · `expo-device` `~58.0.5` · `expo-font` `~58.0.12` · `expo-asset` `~58.0.21` · `expo-keep-awake` `~58.0.4` · `expo-splash-screen` `~58.0.14` · `expo-status-bar` `~58.0.5`

### Dev / build

| Package | Version |
|---|---|
| `eslint` | `^9.0.0` |
| `eslint-config-expo` | `~58.0.4` |
| `expo-build-properties` | `~58.0.12` |
| `@expo/ngrok` | `^4.1.3` |

### EAS profiles (`eas.json`)

| Profile | Purpose |
|---|---|
| `development` | Dev client, internal, Android **APK** |
| `development-simulator` | Dev client, iOS simulator |
| `preview` | Internal Android **APK** (`cache.disabled: true`) — primary sideload profile |
| `apk` | Extends `preview` |
| `production` | Store / autoIncrement |

**Scripts:** `npm run build:android:preview` / `build:android:apk` → `eas build --platform android --profile preview`  
**Native pins (`app.json` plugins):** Android `minSdkVersion` 24 · `compileSdkVersion` 37 · `targetSdkVersion` 36 · iOS deployment `16.4`

### Brand / theme tokens (quick)

| Token | Value | Where |
|---|---|---|
| Pitch black | `#000000` | Global / onboarding / Passport |
| Arena header BG | `#0A0A0A` | `ArenaV2Header` |
| LIVE / map stealth | `#08120F` | LIVE room / NEAR ME map theme |
| Sports orange | `#FF5500` / `#FF5A00` | Core accent / header ACCENT |
| LIVE / NEAR ME accent | `#FF5A1F` | Header pills, LIVE chrome |
| Onboarding accent | `#FF6600` | V1 forms |
| Input fill | `#1E1E22` | Registration / OTP |

---

## 3. Directory Tree & File-by-File Map

```
bawaal-mobile/
├── App.js                    # Root stack + boot routing
├── index.js                  # registerRootComponent + crash boundary
├── MainTabs.js               # Arena / Battles / Locker / Passport + FAB
├── CustomTabBar.js           # Bottom tab bar (locked spacing)
├── sessionStore.js           # Registration + login flags (AsyncStorage)
├── arenaFeedStore.js         # Arena feed hydrate / persist (never throw)
├── UniversalCamera.tsx       # BAWAAL Hub camera (HUB_MODES)
├── ArenaFeed.js              # Cinematic Arena feed
├── ArenaReelViewer.js        # Full-screen Sparks/Josh reel viewer
├── LiveMatchRoomScreen.js    # BAWAAL LIVE room HUD (LOCKED)
├── SportHubMapScreen.js      # NEAR ME map (LOCKED)
├── RoleSelection.js          # V1 registration / OTP (LOCKED)
├── HANDOFF.md                # This document
├── AGENTS.md                 # Cross-model AI instructions
├── app.json / app.config.js  # Expo config (+ Maps key inject)
├── eas.json                  # EAS build profiles
├── package.json
├── .env.example              # Required env var names
├── .cursor/rules/*.mdc       # Production locks (23 files)
├── assets/                   # Logos, skel_*.png, skull_*.png, icons
├── components/               # Root shared (BawaalEmoji, vault drawer, …)
├── src/
│   ├── components/           # ArenaV2Header, LIVE modals, players, …
│   ├── services/             # Supabase / LIVE / social / upload
│   ├── constants/            # Sports, GAME ON, reel overlay, vault
│   ├── stores/               # arenaFilterStore
│   ├── utils/                # soft-fail, location, emoji text, …
│   ├── data/                 # City hubs, countries, athlete seeds
│   ├── lib/ / config/ / types/ / styles/ / hooks/ / boot/ / camera/ / native/
├── supabase/                 # ENSURE_*.sql + migrations/
├── scripts/                  # Dev start, skull registry generator, APK helpers
├── plugins/withAgora.js
├── dist/apk/                 # Local preview APKs (gitignored; archive separately)
└── flutter_app/              # Legacy/parallel Flutter experiment (not primary)
```

### 3.1 Navigation (`App.js`)

| Stack route | Component | Notes |
|---|---|---|
| `Entry` | `AthleteRegistrationScreen` → `RoleSelection` | `loginOnly` when prior registration + logged out |
| `Main` | `MainTabs` | Default boot → Arena tab |
| `UniversalCamera` / `Challenge` / `ChallengeCam` | `CameraPublishHost` → `UniversalCamera` | Modal camera |
| `Live1v1Battle` / `ChallengerArena` | `WarCryScreen` → `Live1v1BattleScreen` | War Cry |
| `LiveMatchRoom` | `LiveMatchRoomScreen` | BAWAAL LIVE room |
| `SportHubMap` | `SportHubMapScreen` | NEAR ME |
| `Clinic` | `ClinicScreen` | From Locker |
| `AthletePassport` | `AthletePassportScreen` | Full passport |
| `AthleteDashboard` | `AthleteDashboard` | |
| `Leaderboard` | `LeaderboardScreen` | |
| `BattleChallengeForm` | `BattleChallengeForm` | |
| `Arena` / `Profile` | `MainTabs` | Legacy aliases |

**Boot gate (`resolveLaunchRoute` / `getAuthLaunchState`):**

| State | Route |
|---|---|
| `isLoggedIn` + session | `Main` (Arena) |
| `hasRegisteredPreviously && !isLoggedIn` | `Entry` with `loginOnly: true` (Phone + OTP only) |
| Fresh guest / errors | `Main` (Arena — **no** registration wall) |
| Missing Supabase env | `MissingSupabaseEnvScreen` |

**Main tabs:** `Arena` → `ArenaFeed` · `Battles` → `BattlesScreen` · `Locker` → `LockerRoomScreen` · `Passport` → `ProfileScreen` · center FAB → `UniversalCamera`.

### 3.2 Key screens (props / role)

| File | Role / key props |
|---|---|
| `ArenaFeed.js` | Vertical feed; wires `ArenaV2Header` (`onLivePress`, `onNearMePress` → `SportHubMap`, notifications); reel cards + `FloatingEmojiBurst`; `LiveArenaModal` |
| `ArenaReelViewer.js` | Full-screen Sparks/Josh viewer via `SafeFeedVideo` / declarative `expo-video` |
| `LiveMatchRoomScreen.js` | LIVE HUD: scoreboard, banter, skull tray, INVITE, host camera/END; enforces `canScore` |
| `SportHubMapScreen.js` | GPS + 8 category pills; native Google Maps / web OSM Leaflet |
| `BattlesScreen.js` | Battles list + `OpenCalloutsPanel` |
| `ProfileScreen.js` | Passport hub (LOCKED) |
| `LockerRoomScreen.js` / `ClinicScreen.js` | Locker + Clinic (LOCKED) |
| `RoleSelection.js` | Registration form or OTP-only when `loginOnly` |
| `UniversalCamera.tsx` | Hub modes + record; single centered `MODE • DETAILS` HUD |
| `Live1v1BattleScreen.js` | War Cry dual panes + vault bursts |
| `ProfileGatewayModal.js` | OPEN FULL PASSPORT + LOG OUT |

### 3.3 `src/services/` (critical)

| Service | Exports / role |
|---|---|
| `liveMatchService.js` | LIVE CRUD, scoring, cricket, invites, Realtime channels, `canUserScoreMatch` |
| `authOtp.js` | `sendPhoneOtp` / `verifyPhoneOtp` + dev bypass |
| `profilesService.js` | `upsertRegisteredProfile` + circuit breaker / schema strip |
| `uploadService.js` | Upload to `bawaalvideos` bucket |
| `arenaPostsService.js` | `videos` upsert onConflict `id` |
| `arenaChallengeService.js` | `arena_challenges` soft-fail |
| `reelSocialService.js` / `videoSocialService.js` | ⋮ Like/Comment/Follow + legacy `reel_*` |
| `nearbySportsVenuesService.js` | Overpass + timeout |
| `sportsHubsService.js` | `sports_hubs` |
| `lockerService.js` / `clinicService.js` | Squads / clinic soft-fail |
| `agoraService.js` | RTC for War Cry (native builds) |
| `supabase.js` | Re-export client |

### 3.4 `src/constants/`

| File | Purpose |
|---|---|
| `sports.js` | Locked `BAWAAL_SPORTS` (11 labels, ALL first) |
| `gameOnSports.js` | Locked **8** map category pills + matchers |
| `arenaFeedTiers.js` | Battle destination tiers |
| `arenaReelOverlay.js` | Mute / ⋮ / action-stack geometry |
| `bawaalEmojiAssets.js` / `skullEmojiRegistry.js` | Vault maps |
| `liveMatchFlamingSkulls.js` / `liveMatchTeamSkulls.js` / `liveMatchSports.js` | LIVE assets + sports |
| `darkMapStyle.js` | Native dark map style JSON |

### 3.5 `src/components/` (high-signal)

`ArenaV2Header` · `LiveArenaModal` · `LiveMatchInvite{Modal,Banner,Host}` · `MuteToggleButton` · `ReelActionSheet` · `FloatingEmojiBurst` · `BawaalExpoVideo` / `ArenaClipPlayer` / `SafeFeedVideo` · `WebOsmMap` · `BackLink` · `BawaalPromptModal` · `GameOnHub` (legacy only) · `NotificationsDrawer` · `CommunityChallengesShelf` · `OpenCalloutsPanel`

### 3.6 Assets

| Pattern | Count (approx at snapshot) | Role |
|---|---|---|
| `assets/skel_*.png` | ~106 | Skeleton vault |
| `assets/skull_*.png` | ~189–213 | Skull vault (registry must match) |
| Logos | `BAWAAL_logo_combined.png`, `BAWAAL_white_full.png`, `BAWAAL_B_solo`, icons, splash | Brand |
| LIVE / action PNGs | flaming/team skulls, `bawaal_*.png` reel actions, mute | UI chrome |

### 3.7 `.cursor/rules/*.mdc` (all locks)

| Rule file | Topic |
|---|---|
| `bawaal-app-master-locked.mdc` | Umbrella index — unlock gate |
| `bawaal-live-locked.mdc` | BAWAAL LIVE contracts |
| `bawaal-gameon-map-locked.mdc` | NEAR ME + 8 categories |
| `bawaal-v2-arena-ui-locked.mdc` | Arena header + reel overlay |
| `bawaal-ui-baseline.mdc` | Camera / feed / tab bar baseline |
| `bawaal-arena-video-playback-locked.mdc` | `expo-video` feed contract |
| `bawaal-v1-fullstack-locked.mdc` / `bawaal-onboarding-locked.mdc` | Auth UI + profiles |
| `bawaal-stability-checkpoint-locked.mdc` | Soft-fail / no hot logs |
| `bawaal-data-integration-locked.mdc` | Tables + feed filters |
| `bawaal-emoji-locked.mdc` / `bawaal-warcry-vault-hub-locked.mdc` | Vault + War Cry + Hub |
| `bawaal-core-system-locked.mdc` / `bawaal-core-project.mdc` | Brand + stack |
| `bawaal-challengecam-locked.mdc` | Live viewfinder |
| `bawaal-sport-taxonomy-locked.mdc` | `BAWAAL_SPORTS` |
| `bawaal-sport-hub-map-locked.mdc` | Dark map style tokens |
| `bawaal-passport-locked.mdc` / `bawaal-locker-clinic-locked.mdc` / `bawaal-backlink-locked.mdc` | Passport / Locker / Back |
| `bawaal-arena-challenge-architecture.mdc` | ARENA/BATTLES hubs |
| `bawaal-backend-lockdown-locked.mdc` | Backend lockdown SQL |
| `bawaal-async-social-locked.mdc` | Sparks/Josh/DM/banter realtime |

**Unlock rule:** Do not edit locked surfaces unless the user explicitly unlocks `bawaal-app-master-locked.mdc` **and** the matching feature rule.

---

## 4. Locked Features & Non-Negotiable Rules

### 4.1 ARENA top header (`● LIVE` — `NEAR ME` — `Bell`)

- **File:** `src/components/ArenaV2Header.js` + wiring in `ArenaFeed.js`
- **Order (right chrome):** pulsing `● LIVE` → `NEAR ME` (pin + label) → notification bell
- **Brand left:** combined logo `assets/BAWAAL_logo_combined.png` + `ARENA` under BAWAAL wordmark
- **Colors:** header BG `#0A0A0A`; accent `#FF5A00`; LIVE/NEAR ME `#FF5A1F` / crimson `#E53935`
- **LIVE:** `onLivePress` → `LiveArenaModal`; badge when ≥1 live match
- **NEAR ME:** `onNearMePress` → `navigation.navigate('SportHubMap')` **directly**
- **NEVER:** Arena-header `▶ GAME ON` pill; open `GameOnHub` from this tap; split `B_solo` + text logo; header `⋮`

### 4.2 BAWAAL LIVE (`LiveMatchRoomScreen.js` + `liveMatchService.js`)

| Contract | Detail |
|---|---|
| Hub entry | `LiveArenaModal`: `+ GO LIVE NOW`, `JOIN WITH INVITE CODE` + `WATCH`, active list — **no** multi-row sport chips |
| Scoreboard | Toggle **OFF** by default (pure telecast). ON expands Team A / Team B / Title / Admin |
| Point sports | Host/admin: horned skull +1 / −1 |
| Cricket | Top: `RUNS/WICKETS (O.B)`; controls `+1/+2/+4/+6`, `DOT`, `WICKET`, `UNDO`, `SWAP BATTING` |
| `canScore` | `isHost \|\| isDesignatedAdmin` only; viewers never get score UI or mutation handlers |
| Banter | Center mid-screen stream; slim bottom input |
| Reactions | One left skull → 5 vibes: `fire`, `devil`, `winning` (`skull_champion`), `crying`/`SAD`, `screaming`/`SCREAM`; **bounded** burst (1–3 particles); no infinite loops |
| INVITE | High-contrast for host **and** viewers; 6-char codes from alphabet excluding `0/O/1/I` |
| Delivery | Targeted Realtime `live-user-invites-{id\|handle}` + `WATCH` banner — **never** global spam |
| Soft-fail | Missing columns → local Map + `score_sync` broadcast |

**Channels:** `live-matches-hub` · `live-match-{id}` (banter / reaction / vote_pulse / score_sync) · invite channels above.

### 4.3 Auth, persistence & logout

| Flag | Behavior |
|---|---|
| Fresh launch | Opens **Arena** (`Main`) — no registration wall |
| Logged-in restart | Supabase session + AsyncStorage → stay in Arena |
| Logout | `supabase.auth.signOut()` + `logoutRegisteredSession()` → `isLoggedIn: false`, **`hasRegisteredPreviously: true` preserved** |
| Re-open after logout | `Entry` with **Phone + OTP only** (`loginOnly`) → Arena |
| Keys | `@bawaal/athlete_session_v1`, `bawaal_has_registered_previously`, `bawaal_is_logged_in` |

OTP: **manual SUBMIT only** (never auto-verify on 4th digit). Dev bypass phone documented in `authOtp.js` (do not hardcode secrets into new docs beyond existing code).

### 4.4 Sparks & Josh / Arena reels (`ArenaReelViewer.js`)

- Declarative `expo-video` via `SafeFeedVideo` / `BawaalExpoVideo` — URI sources only
- Shell dimensions / black underlay; no logo poster blink; try/catch load handlers
- Metrics **behind** ⋮ / `ReelActionSheet` only — no on-canvas like/share counters
- Mute: `top: 16`, `right: 16`, orange flat icons (`arenaReelOverlay.js`)
- Vault reactions only (no unicode trays)
- **NEVER** re-add `expo-av` or sync bundled-mp4 feed fallbacks

### 4.5 Hub modes (`UniversalCamera` `HUB_MODES`)

Canonical Hub cards: **SPARKS · JOSH · BAWAAL BATTLE · FACEOFF · WAR CRY** (+ Gallery row).  
**Never re-add** `DARK_ARENA` as a Hub card (legacy deep-link cases may remain in switches only).

### 4.6 Global NEVER list (master denylist)

- Metric counters on primary Arena overlay  
- Unicode reaction trays on Arena / LIVE / banter  
- Audience score punches / ungated score writes  
- Global LIVE invite spam  
- Arena-header GAME ON gate before map; multi-row map category grids; Virar-primary NEAR ME; CARTO tiles  
- Registration auto-verify on 4th OTP digit  
- Hard-throw profiles upsert on schema miss  
- Parallel `vaultAssets.js` diverging from `skullEmojiRegistry.js`  
- Hot-path `console.log` on soft-fail paths  

---

## 5. Backend, Database Schema & Environment

### 5.1 Required env vars (placeholders only)

Copy `.env.example` → `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_or_publishable_key
EXPO_PUBLIC_AGORA_APP_ID=
EXPO_PUBLIC_AGORA_TOKEN=
EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY=
```

> **Never commit `.env`.** If `eas.json` historically inlined URL/anon key for builds, treat those as secrets — rotate if leaked; prefer EAS Secrets / env injection with placeholders in docs.

### 5.2 Storage buckets

| Bucket | Use |
|---|---|
| `bawaalvideos` | Primary video uploads (`uploadService`) |
| `bawaal-videos` | Legacy / schema companion |
| `avatars` | Profile avatars |

### 5.3 Core tables (apply ENSURE scripts in order)

Recommended SQL order (from `.env.example` + migrations):

1. `supabase_schema.sql` — profiles / videos / battles + buckets + `handle_new_user`  
2. `supabase/ENSURE_PROFILES_SPORTS_HUBS.sql`  
3. `supabase/ENSURE_REEL_SOCIAL.sql`  
4. `supabase/ENSURE_SOCIAL_GRAPH.sql`  
5. Arena / battles / DMs / locker / dashboard ENSURE scripts as needed  
6. LIVE: `migrations/20261121_live_matches*.sql` + `20261121_live_match_invites.sql`

| Table | Purpose |
|---|---|
| `profiles` | V1 registration fields; RLS; soft-compat columns |
| `videos` / `bawaal_posts` / `arena_challenges` | Feed / challenges |
| `likes` / `comments` / `follows` | Social graph |
| `reel_likes` / `reel_banter` / … | Legacy reel social |
| `battles` / `battle_*` | Battles + War Cry schedule columns |
| `direct_messages` | DMs |
| `sports_hubs` | Map hubs |
| `squads` / `squad_briefs` / clinic tables | Locker / Clinic |
| `live_matches` / `live_match_invites` | BAWAAL LIVE |
| Dashboard shelves | `war_cry_matches`, `sparks_josh_clips`, `battle_bawaal_reels`, `face_off_challenges` |

**RPCs (legacy battles):** `send_battle_reaction`, `increment_battle_reps`, `cast_battle_vote` (+ lockdown helpers).

### 5.4 Soft-fail contract

- Missing table/column → `[]` / local mock / strip columns; session circuit breakers  
- `softFailWarn` once per key — no hot-path spam  
- Registration always completes locally if remote fails  

---

## 6. Setup, Run, APK Build & Emulator Runbook

### 6.1 Install & env

```bash
cd "C:\Users\santosh k dhavala\Desktop\bawaal app\bawaal-mobile"
npm install
copy .env.example .env
# Fill EXPO_PUBLIC_* placeholders (never commit .env)
```

Apply Supabase SQL (SQL Editor) per §5.3.

### 6.2 Local run

```bash
npx expo start
# or project wrapper:
npm start
# tunnel (device on different network):
npx expo start --tunnel
# web:
npm run web
# Expo Go alternate port:
npm run start:go
```

Metro typically serves web at `localhost:8081` / Go at `8082` per scripts.

### 6.3 Lint

```bash
npm run lint
# equivalent: npx expo lint
```

### 6.4 Android APK (EAS)

```bash
npx eas-cli@latest login
npm run build:android:preview
# or: eas build --platform android --profile preview
```

Download the APK from the EAS build page. Local copies may land under `dist/apk/` after manual download.

### 6.5 Emulator install + logcat

```bash
# Start Android emulator from Android Studio / avdmanager first
adb devices
adb install -r "path\to\bawaal-preview-XXXX.apk"
adb logcat *:S ReactNative:V ReactNativeJS:V Expo:V AndroidRuntime:E
# optional filtered smoke:
adb logcat | findstr /i "bawaal Error Exception"
```

### 6.6 Verification checklist

- [ ] Cold start opens **Arena** (guest) or stays logged in  
- [ ] Logout → Phone + OTP only → Arena  
- [ ] Header order LIVE → NEAR ME → Bell; NEAR ME opens map  
- [ ] LIVE: scoreboard OFF default; cricket pad; viewers cannot score; invite WATCH banner targeted  
- [ ] Reel mute top-right; metrics only behind ⋮; vault skulls only  
- [ ] `npm run lint` clean  

---

## 7. Resume Protocol for Future AI / IDE

1. Read **`AGENTS.md`** (short rules) then this **`HANDOFF.md`**.  
2. Open matching **`.cursor/rules/*.mdc`** before touching a locked surface.  
3. Confirm git HEAD vs §1; do not unlock or restyle without explicit user unlock language.  
4. Prefer soft-fail + locked tokens over “improvements” that re-clutter UI.  
5. After changes: `npm run lint`; smoke Arena / LIVE / logout on device or emulator.

---

## 8. Archive package contents

Desktop export path (see also sync step):

`C:\Users\santosh k dhavala\Desktop\bawaal-mobile-handoff-archive`

Should contain: latest source, `HANDOFF.md`, `AGENTS.md`, `.cursor/rules/`, `dist` APKs if present — **excluding** `node_modules/`, `.env`, and other secrets.

---

*End of Master Handoff. Companion: `AGENTS.md` · Locks: `.cursor/rules/` · Blueprint: `BAWAAL_MASTER_BLUEPRINT.md` · Prior notes: `PROJECT_HANDOFF_SPEC.md`, `PROJECT_PROGRESS.md`.*
