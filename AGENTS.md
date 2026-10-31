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

Camera (minimal shutter/cancel/flip + pinch zoom), Arena B&W sports ticker, clean feed surfaces (no category pills), and the spaced bottom tab bar are **finalized**. Do not re-introduce removed chrome or reshape those layouts. See `.cursor/rules/bawaal-ui-baseline.mdc`.

## ChallengeCam / UniversalCamera (locked)

Live viewfinder is **untouchable** — Close/Cancel + title, Flip, spinning dotted red shutter only; **no** floating speed/flash/zoom chrome on the lens. Speed / slow-mo stay on `PreviewScreen.tsx` (ChallengeCam) or post-record ClipPreviewModal (UniversalCamera). See `.cursor/rules/bawaal-challengecam-locked.mdc`.

## Onboarding stack (locked)

Landing / Enter the Arena (`RoleSelection.js`), 4-digit OTP (`OTPInput` `#0A192F`, manual SUBMIT only), `authOtp` dev bypass (`+917993992315` / `1234`), Gender+Age under Real Name, Terms/legal, and worldwide location→flag resolution are **production-final and untouchable**. Do not restyle, reorder fields, change sport pills, or rebuild a parallel LandingScreen. See `.cursor/rules/bawaal-onboarding-locked.mdc`.

## Locker Room & Clinic (locked)

`LockerRoomScreen.js` and `ClinicScreen.js` are **production-final and untouchable** — Clinic mint (`#4ADE80`), ACTIVE HUBS blue (`#3B82F6`), Create yellow (`#FACC15`), Post Brief purple (`#A855F7`), pinned-brief crimson (`#EF4444`), opaque B-logo modals, and tab safe-area padding as shipped. Do not restyle or rebuild parallel locker/clinic UIs. See `.cursor/rules/bawaal-locker-clinic-locked.mdc`.

## Passport / Profile (locked)

`ProfileScreen.js` (Passport tab) is **production-final and untouchable** — profile card, social + locker stats, Connected Squads, FOLLOWING (`#3B82F6`), SUGGESTED ATHLETES (`#FF3366`), as shipped. Profile gateway keeps compact red-bordered **LOG OUT** under **OPEN FULL PASSPORT** (`supabase.auth.signOut()` → Entry). See `.cursor/rules/bawaal-passport-locked.mdc`.

## Sport taxonomy (locked)

Canonical `BAWAAL_SPORTS` in `src/constants/sports.js`: ALL → CRICKET → FOOTBALL → GYM → KABADDI → COMBAT → THROTTLE → WAVE & BLADE → COURT KINGS → SKY & SUMMIT → OTHERS. Single-line horizontal pills; no local sport arrays. See `.cursor/rules/bawaal-sport-taxonomy-locked.mdc`.

## Sport Hub Map (locked)

`SportHubMapScreen` + `darkMapStyle.js` + Virar spots are **untouchable** — white roads, orange `#FF6600` / cyan `#00F0FF` / gold `#FFE082` labels with black stroke weight 4, `selectedCategory` pills bound to `filterVirarSportsSpots` Markers. See `.cursor/rules/bawaal-sport-hub-map-locked.mdc`.

## Arena challenge architecture (locked)

Hubs: **ARENA** (cinematic feed; shelf at index 2+), **GAME ON** (scores + locked `BAWAAL_SPORTS` pills), **BATTLES** (OPEN CHALLENGES | TIPS & BREAKDOWNS). Taxonomy source: `src/constants/sports.js`. **1-tap** challenge camera + **200ms** teardown. See `.cursor/rules/bawaal-arena-challenge-architecture.mdc` and `bawaal-sport-taxonomy-locked.mdc`.

## Back controls (locked)

Stealth-black Back affordances use `src/components/BackLink.js` (electric blue `#3B82F6` chip, bold `←` label). See `.cursor/rules/bawaal-backlink-locked.mdc`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
