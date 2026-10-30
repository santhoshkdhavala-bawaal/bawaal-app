# BAWAAL — System Architecture & Arena Master Blueprint

## 1. Executive Summary & Core Intent
BAWAAL is a high-performance, stealth-black global sports network centered around asynchronous 1v1 video battles.
- Core Mechanics: Side-by-side video rendering loop ("YOU" on the left vs. "Challenger" on the right).
- Arena Structure: A single clean, high-impact video Arena feed. Discovery chrome (scores, sport filters, open callouts) lives in a dedicated **FACEOFF** hub — not stacked on the main feed.
- Scalability Vision: Main feed card displays the primary 1v1 comparison, supported by an expandable horizontal "Responses Tray" of mini split-screen thumbnails allowing viewers to tap and swap active challengers into full clarity.

## 2. Updated Arena UI/UX Logic
- Main Arena surface: Clutter-free stealth-black video feed only. Header shows **ARENA** with a top-right **FACEOFF** action.
- FACEOFF hub (tap FACEOFF): Dedicated discovery surface containing:
  1. Live sports scores ticker (`ScoresSportsPanel` — B&W monochromatic).
  2. Sports category grid (locked taxonomy: ALL → CRICKET → … → OTHERS).
  3. Active open callouts & challenges (RESPOND-ready battle shells).
- In-feed live alert ticker: Floating minimalist dark toast/banner on the main feed surfaces real-time open callout alerts (e.g. ⚡ `OPEN: 6 jabs 5 crosses in 30s`) and battle accepts (e.g. 🥊 `BATTLE LIVE: Sunny vs Boons`). Tap deep-links into the FACEOFF hub challenge screen.
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
- Direct-to-Arena Publishing: Recorded benchmark videos upload to Supabase storage and instantly prepend to the active `arena_challenges` state; FACEOFF + in-feed alert ticker surface the new open callout.

## 4. Cursor Re-hydration Prompt
"Load project context for BAWAAL: Keep the main Arena surface as a single clutter-free video feed with ARENA + FACEOFF in the header. FACEOFF hosts scores ticker, sports category grid, and open callouts. Preserve the in-feed floating alert ticker that deep-links into FACEOFF. Keep the 1-tap challenge creation route to UniversalCamera.tsx active, preserving the asynchronous video teardown delay (200ms) to prevent native camera memory unmount crashes."
