This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## UI baseline (locked)

Camera (minimal shutter/cancel/flip + pinch zoom), clean feed surfaces (no sport category pills on clips), and the spaced bottom tab bar are **finalized**. Arena V2 header + GAME ON drawer (search / NEAR ME / battle + sports rows) and reel chrome (top-right orange mute `top:16`/`right:16`, bottom-right `⋮` + on-video action stack) are locked — see `.cursor/rules/bawaal-v2-arena-ui-locked.mdc`, `src/constants/arenaReelOverlay.js`, and `.cursor/rules/bawaal-ui-baseline.mdc`.

## ChallengeCam / UniversalCamera (locked)

Live viewfinder is **untouchable** — Close/Cancel + title, Flip, spinning dotted red shutter only; **no** floating speed/flash/zoom chrome on the lens. Speed / slow-mo stay on `PreviewScreen.tsx` (ChallengeCam) or post-record ClipPreviewModal (UniversalCamera). See `.cursor/rules/bawaal-challengecam-locked.mdc`.

## Onboarding stack (locked)

**V1 full-stack lock** (UI + Supabase): `#000` / `#FF6600` / `#1E1E22` cards (`borderRadius: 12`), registration User Name → Real Name → Age|Gender → Email → Phone → City+flag → Category|Role, sticky orange pill **Continue**, Terms scrollbar + 4-digit OTP (`#1E1E22` / orange focus, manual SUBMIT), `signInWithOtp` → `verifyOtp` → `upsertRegisteredProfile` (`profiles` uuid → `auth.users`, RLS on). See `.cursor/rules/bawaal-v1-fullstack-locked.mdc` and `bawaal-onboarding-locked.mdc`.

## Locker Room & Clinic (locked)

`LockerRoomScreen.js` and `ClinicScreen.js` are **production-final and untouchable** — Clinic mint (`#4ADE80`), ACTIVE HUBS blue (`#3B82F6`), Create yellow (`#FACC15`), Post Brief purple (`#A855F7`), pinned-brief crimson (`#EF4444`), opaque B-logo modals, and tab safe-area padding as shipped. Do not restyle or rebuild parallel locker/clinic UIs. See `.cursor/rules/bawaal-locker-clinic-locked.mdc`.

## Passport / Profile (locked)

`ProfileScreen.js` (Passport tab) is **production-final and untouchable** — profile card, social + locker stats, Connected Squads, FOLLOWING (`#3B82F6`), SUGGESTED ATHLETES (`#FF3366`), as shipped. Profile gateway keeps compact red-bordered **LOG OUT** under **OPEN FULL PASSPORT** (`supabase.auth.signOut()` → Entry). See `.cursor/rules/bawaal-passport-locked.mdc`.

## Sport taxonomy (locked)

Canonical `BAWAAL_SPORTS` in `src/constants/sports.js`: ALL → CRICKET → FOOTBALL → GYM → KABADDI → COMBAT → THROTTLE → WAVE & BLADE → COURT KINGS → SKY & SUMMIT → OTHERS. Single-line horizontal pills; no local sport arrays. See `.cursor/rules/bawaal-sport-taxonomy-locked.mdc`.

## Sport Hub Map (locked)

`SportHubMapScreen` + `darkMapStyle.js` + `sportsHubsService` are **untouchable** — white roads, orange `#FF6600` / cyan `#00F0FF` / gold `#FFE082` labels with black stroke weight 4, `BAWAAL_SPORTS` pills → `fetchSportsHubs` (`public.sports_hubs`) with Virar seed fallback. See `.cursor/rules/bawaal-sport-hub-map-locked.mdc`.

## Arena challenge architecture (locked)

Hubs: **ARENA** (cinematic feed; V2 GAME ON drawer filters; shelf at index 2+), **BATTLES** (OPEN CHALLENGES | TIPS & BREAKDOWNS). Form taxonomy: `src/constants/sports.js`. Arena tiers: `arenaFeedTiers.js` (in GAME ON). **1-tap** challenge camera + **200ms** teardown. See `.cursor/rules/bawaal-arena-challenge-architecture.mdc`, `bawaal-v2-arena-ui-locked.mdc`, and `bawaal-sport-taxonomy-locked.mdc`.

## Arena video playback & hydrate (locked)

Feed players (`ArenaClipPlayer` / `NativeFeedVideo` / `ArenaFeed` shells) use **declarative** `source={{ uri }}` + `shouldPlay` only — no render-path `setStatusAsync` loops, no sync bundled-mp4 feed fallback. Shells keep `width: '100%'`, `height: 450`, `position: 'relative'`. Load/error handlers are try/catch-wrapped. Cloud rows use `.upsert(..., { onConflict: 'id' })`; `arenaFeedStore` hydrate/warmup never throw. See `.cursor/rules/bawaal-arena-video-playback-locked.mdc` and `BAWAAL_MASTER_BLUEPRINT.md` §7.

## Data integration & app logic (locked)

Supabase profiles + OTP, `arena_challenges` / `bawaalvideos` streaming, GAME ON tier+sport filters (`arenaFilterStore`), and reel ⋮ social soft-sync (`reelSocialService` + `ENSURE_REEL_SOCIAL.sql`) are production-final. Soft-fail offline/schema noise. See `.cursor/rules/bawaal-data-integration-locked.mdc`.

## Back controls (locked)

Stealth-black Back affordances use `src/components/BackLink.js` (electric blue `#3B82F6` chip, bold `←` label). See `.cursor/rules/bawaal-backlink-locked.mdc`.

## Custom emoji / reactions (locked — exclusive)

The ~106 skeleton assets (`assets/skel_*.png`) via `BawaalEmoji` + `bawaalEmojiAssets.js` are the **only** emoji/reaction system for chat, banter, DMs, and comments. Never use unicode system emoji (🔥 💀 🏆 …) or generic icons on those surfaces. Vault: `FullEmojiPickerDrawer` — `ALL_SKELETON_KEYS` must include `'love'` (`skel_love.png`). Mixed text+emoji: one flex row at ~36px; emoji-only stickers ~56–64px. Performance: fixed Image width/height, memoized shortcode parse, Banter FlatList `windowSize={5}` / `maxToRenderPerBatch={10}` / `removeClippedSubviews`. See `.cursor/rules/bawaal-emoji-locked.mdc`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
