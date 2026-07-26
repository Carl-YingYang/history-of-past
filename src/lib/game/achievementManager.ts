// AchievementManager - Singleton that tracks player milestones beyond chapter medals.
//
// Responsibilities:
//   - Load achievement definitions from /data/achievements.json
//   - Subscribe to relevant game events (dialogue:end, quest:objectiveComplete,
//     chapter:medal, time:transition, panel:opened, player:moved, etc.)
//   - Track event counts and unique-panel sets for count-based achievements
//   - Unlock achievements via saveManager (which persists to localStorage + server)
//   - Emit `achievement:unlock` events on the game event bus when an achievement
//     unlocks, so React UI (toasts, panel highlights) can react
//   - Emit `xp:gained` events so the HUD updates with the reward XP
//
// Lifecycle:
//   - init() is called once on game boot (from GameCanvas useEffect).
//   - On `game:ready`, the manager refreshes its in-memory Set from saveManager
//     (which has now loaded any saved unlocked achievements from localStorage/server).
//
// Note: The game engine does NOT currently emit `player:moved` directly. To make
// the "First Steps" achievement work today, we install a one-shot window
// keydown listener that detects the first WASD/Arrow press and emits
// `player:moved` on the game event bus. Subsequent movements also emit
// `player:moved` so the "The Wanderer" achievement (50 steps) can fire.
// This keeps gameEngine.ts untouched.

import achievementsData from '@/data/achievements.json';
import { gameEvents } from './eventBus';
import { saveManager } from './saveManager';
import { soundManager } from './soundManager';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'exploration' | 'social' | 'scholarship' | 'milestone' | 'secret';
  xpReward: number;
  hidden: boolean;
  check: string;
  count?: number;
  unique?: boolean;
}

const ALL_ACHIEVEMENTS = achievementsData as Achievement[];

// Movement keys we treat as "the player tried to move"
const MOVE_KEYS = new Set([
  'w', 'a', 's', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
]);

// Konami code sequence (lowercase)
const KONAMI = [
  'arrowup', 'arrowup',
  'arrowdown', 'arrowdown',
  'arrowleft', 'arrowright',
  'arrowleft', 'arrowright',
  'b', 'a',
];

class AchievementManager {
  private unlocked: Set<string> = new Set();
  private initialized = false;

  // Counters for count-based achievements
  private dialogueCount = 0;
  private moveCount = 0;
  private churchCollideCount = 0;
  private openedPanels: Set<string> = new Set();

  // Konami code tracker
  private konamiIndex = 0;

  // Unsubscribe handles for listeners installed during init
  private unsubs: Array<() => void> = [];
  private moveKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private konamiHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Wire up all event listeners. Safe to call multiple times — subsequent
   * calls are no-ops.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Sync from saveManager (in case loadProgress already ran before us)
    this._syncFromSaveManager();

    // 2. Listen for `game:ready` — saveManager finishes loading here, so we
    //    re-sync any persisted unlocked achievements into our in-memory Set.
    this.unsubs.push(
      gameEvents.on('game:ready', () => this._syncFromSaveManager()),
    );

    // 3. Subscribe to the base events we care about. Each handler routes to
    //    trackEvent with a normalized event name.
    this.unsubs.push(
      gameEvents.on('dialogue:end', () => {
        this.dialogueCount += 1;
        this.trackEvent('dialogue:end');
      }),
    );

    this.unsubs.push(
      gameEvents.on('quest:objectiveComplete', (objectiveId: unknown) => {
        // The engine emits the raw objectiveId string. Normalise to
        // `objective:completed:<id>` so achievements can match the suffix.
        const id = typeof objectiveId === 'string' ? objectiveId : '';
        this.trackEvent('objective:completed', id);
      }),
    );

    this.unsubs.push(
      gameEvents.on('chapter:medal', (medal: unknown) => {
        const m = medal as { chapterId?: string; medalName?: string } | string;
        const chapterId = typeof m === 'string' ? m : (m?.chapterId ?? '');
        this.trackEvent('chapter:medal', chapterId);
      }),
    );

    this.unsubs.push(
      gameEvents.on('time:transition', () => {
        this.trackEvent('time:transition');
      }),
    );

    this.unsubs.push(
      gameEvents.on('panel:opened', (panelId: unknown) => {
        const id = typeof panelId === 'string' ? panelId : '';
        if (id) this.openedPanels.add(id);
        this.trackEvent('panel:opened', id);
      }),
    );

    // 4. Player movement: the engine doesn't emit `player:moved` today, so we
    //    install our own one-shot window listener. On any movement key, we
    //    emit `player:moved` on the bus. We DO NOT unsubscribe after the first
    //    press — we want every step (so "The Wanderer" can fire after 50).
    if (typeof window !== 'undefined') {
      this.moveKeyDownHandler = (e: KeyboardEvent) => {
        // Ignore when typing in inputs (mirrors GlobalKeyboardShortcuts logic)
        const target = e.target as HTMLElement | null;
        if (target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        )) return;

        const key = e.key.toLowerCase();
        if (MOVE_KEYS.has(key)) {
          this.moveCount += 1;
          gameEvents.emit('player:moved', { key, count: this.moveCount });
          this.trackEvent('player:moved', { key, count: this.moveCount });
        }
      };
      window.addEventListener('keydown', this.moveKeyDownHandler);

      // 5. Konami code listener — purely additive (doesn't interfere with game)
      this.konamiHandler = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key !== KONAMI[this.konamiIndex]) {
          // Reset on any wrong key, but only if the key is something we care about
          if (KONAMI.includes(key)) {
            this.konamiIndex = key === KONAMI[0] ? 1 : 0;
          } else {
            this.konamiIndex = 0;
          }
          return;
        }
        this.konamiIndex += 1;
        if (this.konamiIndex === KONAMI.length) {
          this.konamiIndex = 0;
          gameEvents.emit('secret:konami', {});
          this.trackEvent('secret:konami', {});
        }
      };
      window.addEventListener('keydown', this.konamiHandler);
    }

    // 6. Player:collide:church — engine doesn't emit this yet, but we listen
    //    so future wiring Just Works.
    this.unsubs.push(
      gameEvents.on('player:collide:church', () => {
        this.churchCollideCount += 1;
        this.trackEvent('player:collide:church', { count: this.churchCollideCount });
      }),
    );
  }

  /**
   * Pull the latest unlocked achievement IDs from saveManager into our
   * in-memory Set. Called on init and on `game:ready`.
   */
  private _syncFromSaveManager(): void {
    const records = saveManager.getUnlockedAchievements();
    this.unlocked = new Set(records.map(r => r.id));
  }

  /**
   * Public hook for systems that want to push a custom event into the
   * achievement pipeline (e.g. an engine extension emitting `player:moved`
   * directly, or a story beat emitting `story:choice`).
   */
  trackEvent(eventName: string, payload?: unknown): void {
    for (const ach of ALL_ACHIEVEMENTS) {
      if (this.unlocked.has(ach.id)) continue;
      if (this._matches(ach, eventName, payload)) {
        this._unlock(ach);
      }
    }
  }

  /**
   * Returns true if the achievement's `check` rule is satisfied by the
   * given event + payload, taking into account optional `count` / `unique`
   * modifiers.
   */
  private _matches(ach: Achievement, eventName: string, payload: unknown): boolean {
    const check = ach.check;

    // Exact match (no suffix) — e.g. "player:moved", "time:transition"
    if (!check.includes(':')) {
      // Shouldn't really happen — all our checks have a colon — but handle it
      return check === eventName;
    }

    // Split into base + suffix. e.g. "panel:opened:codex" => ["panel","opened","codex"]
    // We rejoin the first two parts as the base event name: "panel:opened".
    const parts = check.split(':');
    const baseEvent = parts.length > 2 ? `${parts[0]}:${parts[1]}` : check;
    const suffix = parts.length > 2 ? parts.slice(2).join(':') : '';

    if (eventName !== baseEvent) return false;

    // No suffix — base event match. Apply count/unique modifiers.
    if (!suffix) {
      if (ach.count != null) {
        if (ach.unique) {
          // Count unique payloads (used for "open 5 different panels")
          return this.openedPanels.size >= ach.count;
        }
        // Use the appropriate counter based on the event
        if (baseEvent === 'dialogue:end') return this.dialogueCount >= ach.count;
        if (baseEvent === 'player:moved') return this.moveCount >= ach.count;
        if (baseEvent === 'player:collide:church') return this.churchCollideCount >= ach.count;
        return false;
      }
      return true;
    }

    // Suffix match — the payload must equal the suffix (or, for object
    // payloads, the relevant field must equal the suffix).
    if (typeof payload === 'string') {
      return payload === suffix;
    }
    if (payload && typeof payload === 'object') {
      // Already extracted chapterId upstream; payload here is the chapterId string
      // for chapter:medal events. So this branch shouldn't normally trigger.
    }
    return false;
  }

  /**
   * Mark an achievement as unlocked. Persists via saveManager, emits
   * `achievement:unlock` + `xp:gained` events, plays a sound, and persists
   * progress to localStorage/server.
   */
  private _unlock(ach: Achievement): void {
    if (this.unlocked.has(ach.id)) return;

    const wasNew = saveManager.unlockAchievement(ach.id, ach.xpReward);
    if (!wasNew) {
      // Already unlocked in save data — just sync our set
      this.unlocked.add(ach.id);
      return;
    }

    this.unlocked.add(ach.id);

    // Emit events for the rest of the system
    gameEvents.emit('achievement:unlock', {
      id: ach.id,
      name: ach.name,
      description: ach.description,
      icon: ach.icon,
      category: ach.category,
      xpReward: ach.xpReward,
    });

    // Mirror the XP reward through the standard xp channel so HUD updates
    gameEvents.emit('xp:gained', ach.xpReward);

    // Sound feedback (best-effort — soundManager handles its own gating)
    try {
      soundManager.play('codex-unlock');
    } catch {
      // ignore — sound may not be initialized yet
    }

    // Persist progress so the unlock survives a reload
    saveManager.saveProgress().catch(() => {
      // Swallow — local in-memory state is already updated; localStorage
      // fallback inside saveProgress will keep a copy even if the server fails.
    });
  }

  // --- Public read API ---

  isUnlocked(id: string): boolean {
    return this.unlocked.has(id);
  }

  getUnlockedCount(): number {
    return this.unlocked.size;
  }

  getTotalCount(): number {
    return ALL_ACHIEVEMENTS.length;
  }

  getAll(): Achievement[] {
    return ALL_ACHIEVEMENTS;
  }

  getByCategory(category: Achievement['category']): Achievement[] {
    return ALL_ACHIEVEMENTS.filter(a => a.category === category);
  }

  getTotalXp(): number {
    return ALL_ACHIEVEMENTS
      .filter(a => this.unlocked.has(a.id))
      .reduce((sum, a) => sum + a.xpReward, 0);
  }

  getMaxXp(): number {
    return ALL_ACHIEVEMENTS.reduce((sum, a) => sum + a.xpReward, 0);
  }

  /**
   * Returns the unlocked timestamp (ms) for an achievement, or null if locked
   * or not found in save data.
   */
  getUnlockedAt(id: string): number | null {
    const rec = saveManager.getUnlockedAchievements().find(r => r.id === id);
    return rec ? rec.unlockedAt : null;
  }

  // --- Test/debug helpers (not used in production UI) ---

  /** Force-unlock an achievement by id (used by debug menus or future admin UI). */
  forceUnlock(id: string): void {
    const ach = ALL_ACHIEVEMENTS.find(a => a.id === id);
    if (ach) this._unlock(ach);
  }

  /** Forcibly wipe in-memory state. Does NOT touch saveManager. */
  resetInMemory(): void {
    this.unlocked.clear();
    this.dialogueCount = 0;
    this.moveCount = 0;
    this.churchCollideCount = 0;
    this.openedPanels.clear();
    this.konamiIndex = 0;
  }
}

export const achievementManager = new AchievementManager();
export default AchievementManager;
