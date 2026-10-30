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

Landing / Enter the Arena (`RoleSelection.js`), OTP modal, Terms/legal disclaimers, and worldwide location→flag resolution (`src/utils/locationFlag.js`, `src/data/worldCountries.js`) are **production-final and untouchable**. Do not restyle, reorder fields, change sport pills, or rebuild a parallel LandingScreen. See `.cursor/rules/bawaal-onboarding-locked.mdc`.

## Locker Room & Clinic (locked)

`LockerRoomScreen.js` and `ClinicScreen.js` are **production-final and untouchable** — Clinic mint (`#4ADE80`), ACTIVE HUBS blue (`#3B82F6`), Create yellow (`#FACC15`), Post Brief purple (`#A855F7`), pinned-brief crimson (`#EF4444`), opaque B-logo modals, and tab safe-area padding as shipped. Do not restyle or rebuild parallel locker/clinic UIs. See `.cursor/rules/bawaal-locker-clinic-locked.mdc`.

## Passport / Profile (locked)

`ProfileScreen.js` (Passport tab) is **production-final and untouchable** — profile card (avatar, handle, sport badge, Athlete/Coach/Fan role), social + locker utility stats, Connected Squads, electric blue FOLLOWING (`#3B82F6`), electric crimson SUGGESTED ATHLETES (`#FF3366`), as shipped. Passport ↔ Locker hub nav via `openLockerHub`. Do not restyle or rebuild a parallel Passport UI. See `.cursor/rules/bawaal-passport-locked.mdc`.

## Sport taxonomy (locked)

Canonical list in `src/utils/sportCategory.js`: ALL, CRICKET, FOOTBALL, GYM, KABADDI, COMBAT, THROTTLE, WAVE & BLADE, COURT KINGS, SKY & SUMMIT, OTHERS. Forms/briefs must import shared constants — no local sport arrays. See `.cursor/rules/bawaal-sport-taxonomy-locked.mdc`.

## Arena challenge architecture (locked)

Main Arena is a **single clutter-free cinematic video feed** with **ARENA** + **GAME ON** and **no** floating toasts. Indices 0–1 are always video; every 4–5 items thereafter inject an inline **LIVE COMMUNITY CHALLENGES** shelf (deep-links to BATTLES). **GAME ON** hosts live scores (horizontal pills only). **BATTLES** hosts Active Battles and Open Callouts (**OPEN CHALLENGES** | **TIPS & BREAKDOWNS**). **1-tap** `+ BATTLE` / Battles LAUNCH → `UniversalCamera` challenge mode; keep **200ms** post-stop teardown. See `.cursor/rules/bawaal-arena-challenge-architecture.mdc`.

## Back controls (locked)

Stealth-black Back affordances use `src/components/BackLink.js` (electric blue `#3B82F6` chip, bold `←` label). See `.cursor/rules/bawaal-backlink-locked.mdc`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
