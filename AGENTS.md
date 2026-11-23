# BAWAAL Mobile — Agent Instructions (Cross-IDE)

Read this on every new session. Full blueprint: **`HANDOFF.md`**. Production locks: **`.cursor/rules/*.mdc`**. Do not restyle or rewire locked surfaces unless the user explicitly unlocks `bawaal-app-master-locked.mdc` **and** the matching feature rule.

## Stack (exact pins in `package.json`)

- **Expo SDK 58** (`expo ~58.0.26`) · **React 19.3.0** · **RN 0.88.1**
- Navigation: **React Navigation** native stack (`App.js` + `MainTabs.js`) — **not** Expo Router / not `src/app/`
- Backend: Supabase (`@supabase/supabase-js ^2.118`) + AsyncStorage sessions
- Video: **`expo-video` only** on Arena reels — **never** `expo-av`
- Maps: `expo-location` + `react-native-maps` (native) / `WebOsmMap` (web OSM — never CARTO)
- Live 1v1 RTC: Agora via native/dev client (autolink excluded for Expo Go)

Before using Expo APIs: check the `expo` major in `package.json`, then `https://docs.expo.dev/versions/v58.0.0/` and `https://docs.expo.dev/llms.txt`. Do not trust training-memory Expo APIs.

## Commands

```bash
npm install
npx expo start                 # or: npm start
npx expo start --tunnel
npm run lint                   # expo lint
npm run build:android:preview  # EAS APK (eas.json profile: preview)
```

Use `npx expo install <pkg>` for SDK-compatible adds. Emulator: `adb install -r <apk>` then `adb logcat`.

## Boot / auth (non-negotiable)

| State | Route |
|---|---|
| Fresh / guest | **Arena** (`Main`) — no registration wall |
| Logged in | Stay in Arena across restarts |
| After logout | `isLoggedIn: false`, keep `hasRegisteredPreviously: true` → **Email + Password Sign In** → Arena |

Auth: **Email ID + Phone + Create Password** (`signUp` / `signInWithPassword` / `resetPasswordForEmail` / `PASSWORD_RECOVERY` update). Profiles: soft-fail / circuit-breaker — never hard-throw registration.

## Locked UI contracts (obey first)

1. **Arena header** — exact order `● LIVE` → `NEAR ME` → Bell. NEAR ME → `SportHubMap` **directly**. Never reopen GAME ON from this header. (`ArenaV2Header.js`, `bawaal-gameon-map-locked.mdc`)
2. **BAWAAL LIVE** — scoreboard OFF by default; `canScore = host || designated admin` only; cricket pad; center banter; one skull → 5 vibes (`fire`, `devil`, `winning`, `crying`, `screaming`) with **bounded** bursts; 6-char invites (no `0/O/1/I`); targeted WATCH banners only. (`bawaal-live-locked.mdc`)
3. **Reels** — mute `top:16`/`right:16`; metrics **only** behind ⋮; declarative `expo-video`; vault skulls only. (`ArenaReelViewer.js`, `bawaal-arena-video-playback-locked.mdc`)
4. **Hub cards** — SPARKS · JOSH · BAWAAL BATTLE · FACEOFF · WAR CRY (+ Gallery). **No** Dark Arena Hub card. (`UniversalCamera.tsx`, `bawaal-warcry-vault-hub-locked.mdc`)
5. **Camera viewfinder** — Close/Flip/shutter + one `MODE • DETAILS` HUD only; speed/slow-mo on preview only. (`bawaal-challengecam-locked.mdc`)
6. **Emoji** — proprietary `skel_*` / `skull_*` via `BawaalEmoji` only; never unicode reaction trays. (`bawaal-emoji-locked.mdc`)
7. **Sports** — forms use `BAWAAL_SPORTS` (11); map footer uses exact **8** GAME ON categories. No local sport arrays. (`bawaal-sport-taxonomy-locked.mdc`)
8. **Passport / Locker / Clinic / BackLink** — production-final; do not restyle. Matching `*-locked.mdc` files.

## NEVER (hard denylist)

- Metric counters / share counts on primary Arena canvas  
- Arena-header `▶ GAME ON` or GameOnHub gate before the map  
- Multi-row map sub-sport grids; Virar-primary NEAR ME; CARTO tiles  
- Audience score UI or ungated `updateMatchScore` / cricket writes  
- Global LIVE invite broadcast spam; infinite reaction spawn loops  
- Unicode trays on Arena / LIVE / banter / DMs  
- `expo-av` on Arena feed; sync bundled-mp4 feed fallbacks  
- SMS OTP as primary auth; hard-fail profiles on schema miss 
- Hot-path `console.log` on soft-fail paths  
- Parallel `vaultAssets.js` diverging from `skullEmojiRegistry.js`  
- Editing locked files without an explicit unlock  

## Env (names only)

`EXPO_PUBLIC_SUPABASE_URL` · `EXPO_PUBLIC_SUPABASE_ANON_KEY` · `EXPO_PUBLIC_AGORA_APP_ID` · `EXPO_PUBLIC_AGORA_TOKEN` · `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY`  
See `.env.example`. Never commit `.env` or paste real keys into docs.

## Soft-fail law

Missing Supabase tables/columns → empty arrays / local mocks / schema strip. Arena UX must never crash. Prefer `softFailWarn` once per key.

## Verify before done

1. `npm run lint`  
2. Confirm header LIVE → NEAR ME → Bell and NEAR ME → map  
3. Confirm logout → Email + Password Sign In boot 
4. If touching LIVE: viewers cannot score; invites targeted; bursts bounded  
5. If touching reels: no on-canvas metrics; `expo-video` only  

## Native folders

`ios/` / `android/` are CNG-generated — configure via `app.json` / `app.config.js` / plugins, not hand-edits. Agora / maps / camera need a **development build or APK**, not plain Expo Go for full native features.
