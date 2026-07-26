// StoryLogManager - Tracks chronological game events for the Story Log panel.
//
// Similar in shape to saveManager.ts, but persists to a SEPARATE localStorage
// key (`noor-story-log`) so the story log survives page reloads and is
// independent of save/load/reset cycles (the player can review their full
// journey across multiple playthroughs).
//
// Responsibilities:
//   1. Maintain an in-memory array of StoryEvent records.
//   2. Persist that array to localStorage (load on construct, save on every add).
//   3. Emit `storylog:event` via gameEvents whenever a new event is added
//      (so React UI can subscribe and re-render).
//   4. On `init()`, subscribe to the canonical set of gameEvents and translate
//      them into human-readable StoryEvent entries (with friendly names mapped
//      from dialogue/quest/codex/chapter data files).
//
// The class is a singleton — game code imports `storyLogManager` and calls
// `storyLogManager.init()` once from a top-level client component (GameCanvas).

import { gameEvents } from './eventBus';
import dialogueData from '@/data/dialogueData.json';
import questsData from '@/data/quests.json';
import codexData from '@/data/codex.json';
import chaptersData from '@/data/chapters.json';
import charactersData from '@/data/characters.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoryEventType =
  | 'dialogue-start'
  | 'dialogue-end'
  | 'quest-objective'
  | 'quest-complete'
  | 'chapter-medal'
  | 'chapter-complete'
  | 'time-transition'
  | 'codex-unlock'
  | 'xp-gained'
  | 'panel-opened'
  | 'achievement-unlock';

export interface StoryEvent {
  id: string;
  timestamp: number;
  type: StoryEventType;
  title: string;
  description: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'noor-story-log';
// Cap the log to avoid unbounded localStorage growth.
// When exceeded, the OLDEST entries are trimmed first.
const MAX_EVENTS = 500;

// Friendly-icon map per event type (used as a fallback when callers
// don't supply an explicit icon).
const DEFAULT_ICON: Record<StoryEventType, string> = {
  'dialogue-start': '💬',
  'dialogue-end': '🤝',
  'quest-objective': '✅',
  'quest-complete': '🏆',
  'chapter-medal': '🏅',
  'chapter-complete': '📜',
  'time-transition': '🌅',
  'codex-unlock': '📖',
  'xp-gained': '⭐',
  'panel-opened': '🪟',
  'achievement-unlock': '🎖️',
};

// ---------------------------------------------------------------------------
// Data lookups (cached at module load — JSON imports are stable references)
// ---------------------------------------------------------------------------

type DialogueMap = typeof dialogueData.dialogues;
type CharacterMap = typeof charactersData.characters;

const dialogueMap = dialogueData.dialogues as DialogueMap;
const characterMap = charactersData.characters as CharacterMap;

interface QuestObjective {
  id: string;
  description: string;
}
interface Quest {
  id: string;
  title: string;
  objectives?: QuestObjective[];
}
const quests = questsData as Quest[];

interface CodexEntry {
  id: string;
  name: string;
}
const codex = codexData as CodexEntry[];

interface Chapter {
  id: string;
  title: string;
  medal?: string;
}
const chapters = chaptersData as Chapter[];

// Friendly-name mapping helpers --------------------------------------------

function lookupDialogueSpeaker(dialogueId: string): string | null {
  const d = dialogueMap[dialogueId];
  if (!d) return null;
  // npcId may map to either a characters.json key (e.g. "mang-tenyo")
  // or be "narrator"/"ibara". characters.json keys are used directly.
  const npcId = (d as { npcId?: string }).npcId;
  if (!npcId) return null;
  const ch = characterMap[npcId];
  if (ch) {
    return (ch as { displayName?: string }).displayName || npcId;
  }
  // Fallback: humanize the raw npcId
  return humanizeId(npcId);
}

function lookupObjectiveDescription(objectiveId: string): string {
  for (const q of quests) {
    const obj = q.objectives?.find(o => o.id === objectiveId);
    if (obj) return obj.description;
  }
  return humanizeId(objectiveId);
}

function lookupQuestTitle(questId: string): string {
  const q = quests.find(qq => qq.id === questId);
  return q?.title || humanizeId(questId);
}

function lookupCodexName(codexId: string): string {
  const e = codex.find(c => c.id === codexId);
  return e?.name || humanizeId(codexId);
}

function lookupChapterTitle(chapterId: string): string {
  const c = chapters.find(cc => cc.id === chapterId);
  return c?.title || humanizeId(chapterId);
}

function lookupChapterMedalName(chapterId: string): string {
  const c = chapters.find(cc => cc.id === chapterId);
  return c?.medal || `Chapter ${chapterId}`;
}

function lookupPanelName(panelId: string): string {
  const names: Record<string, string> = {
    codex: 'Codex',
    journal: 'Journal',
    settings: 'Settings',
    minimap: 'Map',
    help: 'Help',
    glossary: 'Glossary',
    achievements: 'Achievements',
    storylog: 'Story Log',
    about: 'About',
  };
  return names[panelId] || humanizeId(panelId);
}

// Convert IDs like "mang-tenyo-first" or "obj.ch1.follow_tenyo" into
// readable strings ("Mang Tenyo First", "Follow Tenyo").
function humanizeId(raw: string): string {
  return raw
    .replace(/^(obj\.|mq\.|char\.|place\.|historical\.)/, '')
    .replace(/\.ch\d+\./, '.')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// Pull a string out of an unknown event payload.
function asString(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.id === 'string') return obj.id;
    if (typeof obj.panelName === 'string') return obj.panelName;
    if (typeof obj.dialogueId === 'string') return obj.dialogueId;
    if (typeof obj.chapterId === 'string') return obj.chapterId;
    if (typeof obj.medalName === 'string') return obj.medalName;
  }
  return null;
}

function asNumber(data: unknown): number | null {
  if (typeof data === 'number') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.amount === 'number') return obj.amount;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

class StoryLogManager {
  private events: StoryEvent[] = [];
  // Cache of `getEvents()` result. Invalidated whenever `events` mutates so
  // that `useSyncExternalStore` consumers see a stable snapshot reference
  // (otherwise they would re-render in an infinite loop).
  private sortedCache: StoryEvent[] | null = null;
  private initialized = false;
  private unsubs: Array<() => void> = [];

  constructor() {
    // Load any persisted events from localStorage. Guarded so SSR doesn't
    // crash (no window/document on the server).
    if (typeof window !== 'undefined') {
      this._loadFromStorage();
    }
  }

  // --- Public API --------------------------------------------------------

  /**
   * Subscribe to gameEvents and translate them into StoryEvent records.
   * Idempotent — safe to call multiple times. Should be called once from
   * a client-side component (e.g. GameCanvas useEffect).
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.unsubs.push(
      gameEvents.on('dialogue:start', (data: unknown) => {
        const dialogueId = (data && typeof data === 'object'
          ? (data as { dialogueId?: string }).dialogueId
          : undefined) || asString(data) || 'Unknown';
        const speaker = lookupDialogueSpeaker(dialogueId);
        const title = speaker
          ? `Conversation with ${speaker}`
          : 'Conversation started';
        this.addEvent(
          'dialogue-start',
          title,
          `Began a dialogue (${dialogueId}).`,
          DEFAULT_ICON['dialogue-start'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('dialogue:end', () => {
        this.addEvent(
          'dialogue-end',
          'Finished conversation',
          'The conversation came to a close.',
          DEFAULT_ICON['dialogue-end'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('quest:objectiveComplete', (data: unknown) => {
        const id = asString(data) || 'Unknown objective';
        const desc = lookupObjectiveDescription(id);
        this.addEvent(
          'quest-objective',
          `Objective completed: ${desc}`,
          `Marked objective "${id}" as complete.`,
          DEFAULT_ICON['quest-objective'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('quest:complete', (data: unknown) => {
        const id = asString(data) || 'Unknown quest';
        const title = lookupQuestTitle(id);
        this.addEvent(
          'quest-complete',
          `Quest completed: ${title}`,
          `Finished quest "${id}".`,
          DEFAULT_ICON['quest-complete'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('chapter:medal', (data: unknown) => {
        let medalName = 'a medal';
        let chapterId = '';
        if (data && typeof data === 'object') {
          const obj = data as { medalName?: string; chapterId?: string };
          if (typeof obj.medalName === 'string') medalName = obj.medalName;
          if (typeof obj.chapterId === 'string') chapterId = obj.chapterId;
        } else if (typeof data === 'string') {
          chapterId = data;
          medalName = lookupChapterMedalName(data);
        }
        const chapterTitle = chapterId
          ? lookupChapterTitle(chapterId)
          : 'the chapter';
        this.addEvent(
          'chapter-medal',
          `Medal earned: ${medalName}`,
          `Awarded the "${medalName}" medal for completing ${chapterTitle}.`,
          DEFAULT_ICON['chapter-medal'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('chapter:complete', (data: unknown) => {
        const id = asString(data) || 'Unknown chapter';
        const title = lookupChapterTitle(id);
        this.addEvent(
          'chapter-complete',
          `Chapter completed: ${title}`,
          `Concluded chapter "${id}".`,
          DEFAULT_ICON['chapter-complete'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('time:transition', (data: unknown) => {
        const time = asString(data) || 'a new time';
        this.addEvent(
          'time-transition',
          `Time passed: ${time}`,
          `The time of day shifted to ${time}.`,
          DEFAULT_ICON['time-transition'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('codex:unlock', (data: unknown) => {
        const id = asString(data) || 'Unknown entry';
        const name = lookupCodexName(id);
        this.addEvent(
          'codex-unlock',
          `Codex entry unlocked: ${name}`,
          `Discovered new codex entry "${id}".`,
          DEFAULT_ICON['codex-unlock'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('xp:gained', (data: unknown) => {
        const amount = asNumber(data);
        this.addEvent(
          'xp-gained',
          `Gained ${amount ?? 'some'} XP`,
          amount != null
            ? `Earned ${amount} experience points.`
            : 'Earned experience points.',
          DEFAULT_ICON['xp-gained'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('panel:opened', (data: unknown) => {
        const panelId = asString(data) || 'unknown';
        const panelName = lookupPanelName(panelId);
        this.addEvent(
          'panel-opened',
          `Opened ${panelName} panel`,
          `Viewed the ${panelName} panel.`,
          DEFAULT_ICON['panel-opened'],
        );
      }),
    );

    this.unsubs.push(
      gameEvents.on('achievement:unlock', (data: unknown) => {
        const name = asString(data) || 'Unknown achievement';
        this.addEvent(
          'achievement-unlock',
          `Achievement unlocked: ${name}`,
          `Earned the "${name}" achievement.`,
          DEFAULT_ICON['achievement-unlock'],
        );
      }),
    );
  }

  /**
   * Append a new StoryEvent. Persists immediately and emits `storylog:event`
   * so subscribers (e.g. StoryLogPanel) can refresh.
   */
  addEvent(
    type: StoryEventType,
    title: string,
    description: string,
    icon?: string,
  ): void {
    const event: StoryEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type,
      title,
      description,
      icon: icon ?? DEFAULT_ICON[type] ?? '•',
    };
    this.events.push(event);

    // Trim oldest entries if we exceed the cap.
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(this.events.length - MAX_EVENTS);
    }

    this.sortedCache = null;
    this._saveToStorage();
    gameEvents.emit('storylog:event', event);
  }

  /** Returns events sorted newest-first (cached for referential stability). */
  getEvents(): StoryEvent[] {
    if (this.sortedCache) return this.sortedCache;
    this.sortedCache = [...this.events].sort((a, b) => b.timestamp - a.timestamp);
    return this.sortedCache;
  }

  /** Returns events of a single type, sorted newest-first. */
  getEventsByType(type: string): StoryEvent[] {
    return this.events
      .filter(e => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Total event count (handy for badge counters). */
  getCount(): number {
    return this.events.length;
  }

  /** Empty the log and wipe localStorage. */
  clearLog(): void {
    this.events = [];
    this.sortedCache = null;
    this._saveToStorage();
    gameEvents.emit('storylog:event', null);
  }

  /** Detach all event listeners (used in tests / hot-reload safety). */
  destroy(): void {
    for (const unsub of this.unsubs) {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    }
    this.unsubs = [];
    this.initialized = false;
  }

  // --- Internal: persistence -------------------------------------------

  private _loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoryEvent[];
      if (Array.isArray(parsed)) {
        // Defensive: only keep entries that look like valid StoryEvents.
        this.events = parsed.filter(
          e =>
            e &&
            typeof e.id === 'string' &&
            typeof e.timestamp === 'number' &&
            typeof e.type === 'string' &&
            typeof e.title === 'string',
        );
        this.sortedCache = null;
      }
    } catch {
      // Corrupt storage — start fresh.
      this.events = [];
      this.sortedCache = null;
    }
  }

  private _saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch {
      // Quota exceeded or storage disabled — fail silently; in-memory
      // log still works for the current session.
    }
  }
}

// Singleton instance — game code imports this directly.
export const storyLogManager = new StoryLogManager();
export default StoryLogManager;
