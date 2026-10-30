# BAWAAL — System Architecture & Arena Master Blueprint

## 1. Executive Summary & Core Intent
BAWAAL is a high-performance, stealth-black global sports network centered around asynchronous 1v1 video battles.
- Core Mechanics: Side-by-side video rendering loop ("YOU" on the left vs. "Challenger" on the right).
- Arena Structure: A single clean, cinematic video Arena feed. Scores/sports discovery lives in **FACEOFF**; Open Callouts live on the **BATTLES** tab — never stacked as feed overlays.
- Scalability Vision: Main feed card displays the primary 1v1 comparison, supported by an expandable horizontal "Responses Tray" of mini split-screen thumbnails allowing viewers to tap and swap active challengers into full clarity.

## 2. Updated Arena UI/UX Logic
- Main Arena surface: Clutter-free stealth-black cinematic video feed only. Header shows **ARENA** with a top-right **FACEOFF** action. **No** in-feed floating notification ticker/toast banners.
- FACEOFF hub (tap FACEOFF): Dedicated discovery surface focused strictly on:
  1. Live sports scores ticker (`ScoresSportsPanel` — B&W monochromatic).
  2. Sports category grid/filters (locked taxonomy: ALL → CRICKET → … → OTHERS).
  - FACEOFF does **not** host Open Callouts (removed to prevent layout bloat).
- BATTLES tab: Hosts Active Battles **and** the Open Callouts system with two categories:
  - **OPEN CHALLENGES** — Performance, benchmark, or 1v1 action callouts.
  - **TIPS & BREAKDOWNS** — Technique, advice, or form-check requests.
- Sports Categories (FACEOFF grid — locked taxonomy, never rename/reorder):
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
- Direct-to-Arena Publishing: Recorded benchmark videos upload to Supabase storage and instantly prepend to the active `arena_challenges` state; Open Callouts on the BATTLES tab surface new open challenges.

## 4. Cursor Re-hydration Prompt
"Load project context for BAWAAL: Keep the main Arena surface as a single clutter-free cinematic video feed with ARENA + FACEOFF in the header and no in-feed alert ticker. FACEOFF hosts only live scores and the sports category grid. Open Callouts (OPEN CHALLENGES | TIPS & BREAKDOWNS) live on the BATTLES tab alongside Active Battles. Keep the 1-tap challenge creation route to UniversalCamera.tsx active, preserving the asynchronous video teardown delay (200ms) to prevent native camera memory unmount crashes."
