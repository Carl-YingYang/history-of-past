# Task 9-a — full-stack-developer (Photo Mode + Chapter Roadmap)

## Scope
Build two new features for Project Noor:
1. **Photo Mode** — screenshot capture of the game canvas (floating 📷 button + flash overlay + auto-download + toast).
2. **Chapter Roadmap** — vertical timeline panel showing all 11 chapters of *Noli Me Tangere* with live progress for Chapter 1.

## Files Created
- `src/components/game/PhotoMode.tsx` — Full Photo Mode component + `triggerPhotoCapture()` helper.
- `src/components/game/ChapterRoadmap.tsx` — Full Roadmap panel component + `toggleChapterRoadmap()` helper.

## Files Modified
- `src/components/game/UIManager.tsx`:
  - Added `'roadmap'` to `PanelId` union.
  - Added `R` shortcut → `store.togglePanel('roadmap')`.
  - Added `P` shortcut → dispatches `noor:capture-photo` custom event (handled by PhotoMode; avoids circular import).
- `src/components/game/Toolbar.tsx`:
  - Added `'roadmap'` to the `id` union in the main `buttons[]` array (with icon 🛣️, label "Roadmap", shortcut "R", counter "1/11").
  - Imported `triggerPhotoCapture` from PhotoMode.
  - Added a new Photo Mode button at the end of the toolbar (icon-only on mobile, label on md+).
- `src/app/page.tsx`:
  - Imported `PhotoMode` and `ChapterRoadmap`.
  - Rendered `<ChapterRoadmap />` alongside other panels.
  - Rendered `<PhotoMode />` (renders floating button + flash + toast).
  - Updated footer shortcut hints to include `R` (in panels list) and `P` (photo).
- `src/app/globals.css`:
  - Added `@keyframes camera-flash` (white overlay that fades from 0.92 → 0 over 0.42s).
  - Added `.animate-camera-flash` utility class.

## Architecture Notes
- **Photo Mode trigger flow**: UIManager's `GlobalKeyboardShortcuts` listens for `P` and dispatches a `noor:capture-photo` window event. PhotoMode listens for this event and runs the same `capturePhoto` callback as the button click. This avoids any circular import between UIManager and PhotoMode.
- **Photo Mode visibility**: Uses a `MutationObserver` on `document.body` watching `data-noor-dialogue-active` and `data-noor-panel-active` attributes. Robust to non-React setters (DialogueBox / UIManager both set these attributes imperatively).
- **Photo Mode canvas capture**: Uses `document.querySelector('canvas.game-canvas')` first (no element with that class exists yet, but future-proofs the selector), falls back to generic `canvas`. Wrapped in try/catch to handle tainted-canvas errors gracefully.
- **Photo Mode sound**: Uses existing `soundManager.play('ui-click')`. Did NOT modify soundManager.ts (out of scope per task constraints). A true 'photo' sound could be added later without breaking the API.
- **Photo Mode toast**: Self-contained inline toast (2.6s timeout) rather than reusing the existing `AchievementToast` or `CulturalFactToast` systems, since this is a transient action-confirmation toast, not an event-driven one.
- **Chapter Roadmap progress**: Reads `completedObjectives` and `xp` live from `useGameStore`, and `objectives` length from `quests.json` for Chapter 1. Progress bar shows live % completion with a subtle shimmer overlay (reuses `shimmer-sweep` keyframe).
- **Chapter Roadmap teasers**: All 11 chapter teasers are shown (including locked ones) since this is an educational tool — task spec explicitly allows spoilers for educational use.
- **Chapter Roadmap status colors**: Available (current) = amber with shadow glow; Coming Next = amber border on darker card; Locked = subtle gray/white border; Completed = emerald (future-proofed, no chapters are completed yet).

## Lint Status
`bun run lint` — zero errors, exit code 0.

## Dev Server Status
GET `/` returns 200. No compilation errors. No runtime errors in dev.log.

## What Was NOT Modified (per task constraints)
- `src/lib/game/soundManager.ts` (other agent owns)
- `src/components/game/Minimap.tsx` (other agent owns)
- `src/components/game/SettingsPanel.tsx` (other agent owns)
- `src/lib/game/gameEngine.ts` (other agent owns)
- `src/data/dialogueData.json` (other agent owns)
- `src/stores/gameStore.ts` (other agent owns)

## Known Risks / Follow-ups
- Photo Mode's `canvas.toDataURL()` will throw on tainted canvases (cross-origin assets without CORS). All current Noor assets are local sprites so this shouldn't happen, but the try/catch handles it gracefully with a toast.
- The Chapter Roadmap's "1/11" counter in the toolbar is hardcoded (only Chapter 1 is implemented). Future chapters would update this dynamically when added.
- The Photo Mode button at `md:top-16 md:left-1/2` could overlap with the toolbar on very narrow desktop viewports if the toolbar wraps to multiple rows. Acceptable for now — toolbar wraps below the photo button if needed.
- A future improvement could add a "true" camera shutter sound to soundManager without breaking the API (additive change only).
