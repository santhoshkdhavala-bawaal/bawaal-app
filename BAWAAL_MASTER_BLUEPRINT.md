# BAWAAL — System Architecture & Arena Master Blueprint

## 1. Executive Summary & Core Intent
BAWAAL is a high-performance, stealth-black global sports network centered around asynchronous 1v1 video battles.
- Core Mechanics: Side-by-side video rendering loop ("YOU" on the left vs. "Challenger" on the right).
- Arena Structure: A single clean, cinematic video Arena feed with **zero floating pop-up banners or intrusive overlays**. Discovery of open callouts uses an **inline horizontal challenge shelf** every 4–5 feed items (strictly **after** leading video rows); full Open Callouts remain on the **BATTLES** tab. Live scores live in **GAME ON**.
- Scalability Vision: Main feed card displays the primary 1v1 comparison, supported by an expandable horizontal "Responses Tray" of mini split-screen thumbnails allowing viewers to tap and swap active challengers into full clarity.

## 2. Updated Arena UI/UX Logic
- Main Arena surface: Clutter-free stealth-black cinematic video feed. Header shows **ARENA** with a top-right **GAME ON** action. **No** in-feed floating notification ticker/toast banners layered over video playback.
- Inline challenge shelf rule: Every **4–5** video items in the vertical Arena FlatList, inject a horizontal scroller row titled **🔥 LIVE COMMUNITY CHALLENGES**.
  - The shelf **MUST** render strictly **below** initial video items — feed indices **0** and **1** are always full-screen video/battle content on cold start. Never inject the shelf as the first list row before video data hydrates.
  - Cards are stealth-black and represent active **OPEN CHALLENGES** and **TIPS & BREAKDOWNS**.
  - CTAs: **RESPOND** (challenges) / **TEACH** (tips).
  - Tap deep-links into the **BATTLES** tab focused on that specific callout ID.
- **GAME ON** hub (tap GAME ON): Live sports scores with the panel’s horizontal sport filter pills only — focused on match updates. No redundant lower taxonomy grid. No Open Callouts list.
- **BATTLES** tab: Home for active 1v1 engagements **and** all Open Callouts:
  - **OPEN CHALLENGES** — Performance, benchmark, or 1v1 action callouts.
  - **TIPS & BREAKDOWNS** — Technique, advice, or form-check requests.
- Sports taxonomy (forms / BATTLES filters — locked, never rename/reorder):
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

## 3. Challenge Creation & Camera Navigation
- Trigger Flow: Single-tap trigger from the `+ BATTLE` sheet or `BATTLES` tab launches `UniversalCamera.tsx` directly in challenge mode with pre-selected categories.
- Post-Recording Stability: Asynchronous delay (200ms safety buffer) and memory lock release applied before unmounting `expo-camera`/`expo-av` to prevent post-recording thread crashes.
- Direct-to-Arena Publishing: Recorded benchmark videos upload to Supabase storage and instantly prepend to the active `arena_challenges` state; BATTLES Open Callouts + Arena inline shelves (after leading videos) surface new open challenges.

## 4. Cursor Re-hydration Prompt
"Load project context for BAWAAL: Keep the main Arena surface as a single clutter-free cinematic video feed with ARENA + GAME ON in the header and no floating alert toasts. Indices 0–1 are always video content; every 4–5 feed items thereafter inject an inline LIVE COMMUNITY CHALLENGES shelf whose cards deep-link into BATTLES Open Callouts (OPEN CHALLENGES | TIPS & BREAKDOWNS). GAME ON hosts live scores with horizontal sport pills only. Keep the 1-tap challenge creation route to UniversalCamera.tsx active, preserving the asynchronous video teardown delay (200ms) to prevent native camera memory unmount crashes."
