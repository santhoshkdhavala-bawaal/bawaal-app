# BAWAAL Mobile — Project Progress

Session summary of completed updates (Expo / React Native).

## 0. GAME ON 8-categories + NEAR ME map (LOCKED)

**Status: LOCKED** — rule `.cursor/rules/bawaal-gameon-map-locked.mdc` (`alwaysApply: true`). Do not regress without an explicit unlock.

| Surface | Locked behavior |
|---|---|
| **GAME ON → SPORTS CATEGORIES** | Exact 8 pills: `All`, `Ball Sports`, `Combat Sports`, `Racing & Speed`, `Water & Surf`, `Extreme & Adventure`, `Strength & Fitness`, `Others`. No multi-row sub-sport grids. Files: `GameOnHub.js`, `gameOnSports.js`. |
| **NEAR ME / `SportHubMapScreen.js` (native)** | Live GPS (`expo-location` + timeout/last-known) → `react-native-maps` `PROVIDER_GOOGLE`; Overpass + Supabase + curated city hubs. |
| **NEAR ME (web)** | Dark-filtered OSM Leaflet (`tile.openstreetmap.org`, never CARTO API-key tiles); city switcher Hyderabad / Delhi / Mumbai / Bengaluru / Chennai; same 8-category footer. |

Related helpers: `WebOsmMap.js`, `userLocation.js`, `nearbySportsVenuesService.js`, `citySportsVenueFallbacks.js`. Blueprint: `BAWAAL_MASTER_BLUEPRINT.md` §2.1.

## 1. Permanent Categories Locked

Form / publish taxonomy remains `BAWAAL_SPORTS` in `src/constants/sports.js` (ALL → … → OTHERS).  
GAME ON drawer + NEAR ME map footer use the **8** locked categories in §0 (not the nested 11-pill form list).

## 2. Stability & Crash Fixes

- **expo-av / ExponentAV crash (Expo Go):** Arena stream playback no longer depends on the `expo-av` native module. A styled fallback `View` placeholder is used for the live arena stream so Expo Go does not crash on missing native AV bindings.
- **AsyncStorageError (Supabase):** `src/services/supabase.js` uses an in-memory storage fallback for auth/session handling when AsyncStorage is unavailable (offline / Expo Go), avoiding native-module crashes.

## 3. Color Palette & UI Lock

- **Background:** Enforced `#08120F` across primary screens (Landing, OTP, Arena, App root). Removed green/teal dark tint variants such as `#0E1F1B` / `#121E1B`.
- **Accents retained:**
  - Gold `#FFD700`
  - Crimson `#FF2A5F`
  - Platinum `#E5E4E2`
- **Arena cards:** `+ BATTLE / CHALLENGE` is permanently rendered under each feed card.
- **Passport (ProfileScreen):** Strike Velocity & Stamina progress bars use soft tinted fills — `#FF6B6B` (velocity) and `#51CF66` (stamina) — instead of solid white.
- **Overlays:** Removed stray floating settings/gear icons that overlapped the `ALL` sports tab.

## 4. Recording & Navigation Flow

- **Video 404 / local read errors:** `uploadService.js` and `ChallengeCam.js` verify and persist local clip URIs via `expo-file-system/legacy` (copy into `documentDirectory/battle_clips`) instead of `fetch(file://)`, which often returned 404. Soft fallbacks allow Arena local/mock preview when cloud upload cannot proceed.
- **Invalid Compact JWS / cloud failures:** Battle post path continues with local preview when Supabase is unconfigured, the clip is a mock URI, or the local file is missing — rather than hard-blocking the Arena handoff.
- **Registered launch:** `sessionStore.js` + `App.js` check persisted registration on boot. Returning users skip Landing/OTP and land directly on BAWAAL Arena.

### Related files touched this session

| Area | Files |
|------|--------|
| Launch / session | `App.js`, `sessionStore.js`, `RoleSelection.js`, `OTPModal.js` |
| Arena UI | `ArenaFeed.js` |
| Passport | `ProfileScreen.js` |
| Recording / upload | `ChallengeCam.js`, `ChallengeScreen.js`, `src/services/uploadService.js`, `src/services/battleResponseService.js` |
| Auth storage | `src/services/supabase.js` |

## Ready for testing

Suggested smoke checks:

1. Cold start as a **new** user → Landing (`#08120F`) → OTP → Arena.
2. Kill & relaunch as a **registered** user → splash → Arena (no Landing).
3. Arena tabs match the locked list; `+ BATTLE / CHALLENGE` under each card; no gear over `ALL`.
4. Passport close/back returns to Arena; metric bars show tinted fills.
5. Record a challenge → Keep/Review → Post → Arena without “Failed to read local video (404)”.
