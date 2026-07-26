# Task 9-c — NPC Dialogue Depth + Styling Polish

**Agent:** full-stack-developer
**Task ID:** 9-c
**Date:** 2026-07-26

## Goal

Add warmth-based NPC dialogue depth (relationship-aware bonus lines that unlock
as the player talks to NPCs more) and apply tasteful visual polish across the
existing game panels (IntroScreen, HUD, SaveIndicator, CodexPanel,
AchievementsPanel, globals.css).

## Files Modified

- `src/data/dialogueData.json` — added `warmthDialogues` section with 3 tiers × 3-4 lines for `mang-tenyo` and `kitchen-staff` (Aling Nena / Mang Andres).
- `src/stores/gameStore.ts` — added `triggerWarmthDialogue(npcId)` action, `isWarmthDialogue` + `warmthTier` state, helper functions for reading NPC interaction counts and picking warmth lines, and interception logic in the existing `dialogue:start` listener (only dialogue-related parts touched).
- `src/components/game/DialogueBox.tsx` — added warmth badge near speaker name (💕/✨/💛 + tier label, color-coded).
- `src/components/game/IntroScreen.tsx` — ✦ twinkle on decorative stars (staggered), scroll-down-to-continue hint when content overflows, footer updated to "Build v0.4 · 2026 Edition", Continue button gets `animate-gold-shimmer-hover` on hover.
- `src/components/game/HUD.tsx` — XP bar pulses via `animate-xp-pulse` on gain, level-up toast at 100/200/300 XP thresholds, time-of-day icon replaced with custom SVG sun (with rays) / crescent moon (with stars).
- `src/components/game/SaveIndicator.tsx` — spinning 💾 icon during save via `animate-save-spin`, green ✓ confirmation with `animate-save-saved-flash`, faster 5s tick for relative time.
- `src/components/game/CodexPanel.tsx` — page-turn animation on expanded details, "📖 Reading…" progress bar at top of long entries, locked entries now show "🔒 Locked … Entry" + "📜 Unlock by progressing the story".
- `src/components/game/AchievementsPanel.tsx` — confetti animation (`animate-confetti-fall`) on recently-unlocked achievements (within 6s), rarity system (common=gray, rare=blue, epic=purple, legendary=gold) determined by XP reward + hidden status, left-edge accent stripe + rarity badge on each card.
- `src/app/globals.css` — added 9 new keyframes: `gold-shimmer`, `xp-pulse`, `level-up-toast-in`, `page-turn`, `reading-progress`, `confetti-fall`, `save-spin`, `save-saved-flash`, `star-twinkle`, `warmth-badge-in`.

## Implementation Notes

### Warmth Dialogue System
The game engine (read-only) calls `_startDialogue('mang-tenyo-repeat')` or
`_startDialogue('mang-tenyo-after-gossip')` when the player talks to an NPC
they've already met. We intercept the `dialogue:start` event in `gameStore.ts`
and rewrite the first line of those dialogues to a warmth line, looking up the
NPC's interaction count from `localStorage.getItem('noor-npc-interactions')`
to determine the tier:
- 0 talks → not encountered (no warmth line, fall back to default)
- 1-2 talks → acquainted
- 3-4 talks → familiar
- 5+ talks → trusted

The warmth line REPLACES the original first line of the repeat dialogue — the
dialogue still continues normally afterward. The `isWarmthDialogue` and
`warmthTier` flags are cleared on the next `dialogue:line` event.

`triggerWarmthDialogue(npcId)` is also exposed as a store action for future UI
surfaces (e.g. an NPC Relationship panel "Talk" button) that want to trigger
warmth dialogues programmatically.

### Rarity System
Each achievement is assigned a rarity based on its XP reward:
- 5 XP → common (gray border)
- 10 XP → rare (blue border)
- 15 XP → epic (purple border)
- 20+ XP → legendary (gold border)
- Hidden achievements → always legendary

The rarity is shown via a colored left-edge stripe on the card, a border tint,
and a small "◆ {rarity}" badge next to the "✓ Unlocked" badge.

## Lint Status
- `bun run lint` → **0 errors, 0 warnings** ✅

## Files NOT Modified (per task constraints)
- UIManager.tsx, Toolbar.tsx, page.tsx, soundManager.ts, Minimap.tsx, SettingsPanel.tsx, gameEngine.ts, PhotoMode.tsx, ChapterRoadmap.tsx, QuestTracker.tsx — untouched.
