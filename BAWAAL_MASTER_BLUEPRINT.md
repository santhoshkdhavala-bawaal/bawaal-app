# BAWAAL — System Architecture & Arena Master Blueprint

## 1. Executive Summary & Core Intent
BAWAAL is a high-performance, stealth-black global sports network centered around asynchronous 1v1 video battles.
- Core Mechanics: Side-by-side video rendering loop ("YOU" on the left vs. "Challenger" on the right).
- Arena Structure: A single clean, cinematic video Arena feed with **zero floating pop-up banners or intrusive overlays**. Discovery of open callouts uses an **inline horizontal challenge shelf** (strictly after leading video rows). Full Open Callouts remain on **BATTLES**. Live scores live in **GAME ON**.
- Scalability Vision: Main feed card displays the primary 1v1 comparison, supported by an expandable horizontal "Responses Tray" of mini split-screen thumbnails allowing viewers to tap and swap active challengers into full clarity.

## 2. Navigation Hubs (LOCKED)

| Hub | Surface | Role |
|---|---|---|
| **ARENA** | Main tab — cinematic single-stream video feed | Header **ARENA** + top-right **GAME ON**. Inline **🔥 LIVE COMMUNITY CHALLENGES** shelf starts at list index **2+** only. No floating toasts. |
| **GAME ON** | Modal hub from Arena header | Live Scores + locked `BAWAAL_SPORTS` horizontal filter pills only. No Open Callouts. No redundant lower taxonomy grid. No Tennis/Badminton/etc. fallbacks. |
| **BATTLES** | Bottom tab | Active 1v1 engagements **and** Open Callouts: **OPEN CHALLENGES** + **TIPS & BREAKDOWNS**. Source of truth for callouts; Arena shelf deep-links here. |

Related: Locker Room / Passport / Clinic remain as separately locked product surfaces (see `.cursor/rules/`).

## 3. Immutable Sports Taxonomy (LOCKED CORE)
Source of truth: `src/constants/sports.js` → `BAWAAL_SPORTS`  
(Re-exported via `src/utils/sportCategory.js` as `BAWAAL_SPORT_TAXONOMY` / `BAWAAL_FORM_SPORTS` / `ARENA_SPORT_TABS`.)

**Exact order — do not reorder, rename, or invent local arrays:**

1. ALL  
2. CRICKET  
3. FOOTBALL  
4. GYM  
5. KABADDI  
6. COMBAT  
7. THROTTLE  
8. WAVE & BLADE  
9. COURT KINGS  
10. SKY & SUMMIT  
11. OTHERS  

```js
export const BAWAAL_SPORTS = [
  'ALL',
  'CRICKET',
  'FOOTBALL',
  'GYM',
  'KABADDI',
  'COMBAT',
  'THROTTLE',
  'WAVE & BLADE',
  'COURT KINGS',
  'SKY & SUMMIT',
  'OTHERS',
];
```

All forms, GAME ON score pills, BATTLES filters, Arena publish pickers, and briefs **must** import this constant (or its re-exports). Never local sport arrays.

## 4. Feed & Startup Logic (LOCKED)
- Arena FlatList **strictly initializes** full-screen video/battle content at indices **0** and **1**.
- The inline horizontal challenge shelf (**🔥 LIVE COMMUNITY CHALLENGES**) is injected only after at least **2** media rows (`MIN_MEDIA_BEFORE_SHELF = 2`), i.e. at list index **2+**, and every **4** media items thereafter (`COMMUNITY_SHELF_INTERVAL = 4`).
- Prevents cold-start layout bugs where a shelf could appear before video hydration.
- Shelf cards (OPEN CHALLENGES / TIPS & BREAKDOWNS) deep-link into the **BATTLES** tab via `openBattlesCallout(id)`.

## 5. Challenge Creation & Camera Navigation
- Trigger Flow: Single-tap from `+ BATTLE` / Battles **LAUNCH ARENA CHALLENGE** → `UniversalCamera.tsx` challenge mode (no blocking pre-camera sheet).
- Post-Recording Stability: **`RECORDING_TEARDOWN_MS = 200`** before preview/unmount to release expo-camera / expo-av locks.
- Publish: opener → Supabase Storage + `arena_challenges`; prepend to Arena (`pushOpenChallenge`); BATTLES Open Callouts + Arena shelves surface new open cards.

## 6. Cursor Re-hydration Prompt
"Load project context for BAWAAL: Navigation hubs are ARENA (cinematic feed + shelf at index 2+), GAME ON (scores + BAWAAL_SPORTS pills only), and BATTLES (OPEN CHALLENGES | TIPS & BREAKDOWNS). BAWAAL_SPORTS in src/constants/sports.js is the immutable taxonomy — never invent local sport arrays. Arena feed indices 0–1 are always video; shelves inject at index 2+. Keep 1-tap UniversalCamera challenge creation and the 200ms recording teardown delay."
