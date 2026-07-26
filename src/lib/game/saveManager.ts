// SaveManager - Abstraction layer for game persistence
// Game code only calls these methods, never raw DB/API calls
// Internals can be swapped later for offline APK build without touching scene/quest/dialogue code

import { gameEvents } from './eventBus';

interface AchievementRecord {
  id: string;
  unlockedAt: number;
  xpAwarded: number;
}

interface SaveData {
  playerId: string;
  currentChapter: string;
  completedObjectives: string[];
  completedQuests: string[];
  unlockedCodexEntries: string[];
  journalEntries: JournalEntry[];
  xp: number;
  chapterMedals: ChapterMedal[];
  unlockedAchievements: AchievementRecord[];
  gameState: GameState;
  lastSaveTime: number;
}

interface JournalEntry {
  id: string;
  chapterId: string;
  text: string;
  timestamp: number;
}

interface ChapterMedal {
  chapterId: string;
  medalName: string;
  awardedAt: number;
}

interface GameState {
  playerPosition: { row: number; col: number };
  playerDirection: string;
  currentDialogue: string | null;
  timeOfDay: 'afternoon' | 'morning';
  chapterPhase: 'intro' | 'explore' | 'gossip' | 'ibarra-sighting' | 'complete';
}

class SaveManager {
  private saveData: SaveData;
  private autoSaveInterval: number | null = null;

  constructor() {
    this.saveData = this._createDefaultSaveData();
  }

  private _createDefaultSaveData(): SaveData {
    return {
      playerId: `player-${Date.now()}`,
      currentChapter: 'ch1',
      completedObjectives: [],
      completedQuests: [],
      unlockedCodexEntries: [],
      journalEntries: [],
      xp: 0,
      chapterMedals: [],
      unlockedAchievements: [],
      gameState: {
        playerPosition: { row: 15, col: 10 },
        playerDirection: 'north',
        currentDialogue: null,
        timeOfDay: 'afternoon',
        chapterPhase: 'intro',
      },
      lastSaveTime: 0,
    };
  }

  // --- Public API (game code only uses these) ---

  async saveProgress(): Promise<void> {
    this.saveData.lastSaveTime = Date.now();
    let success = false;
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.saveData),
      });
      success = res.ok;
    } catch (e) {
      console.warn('Server save failed, data kept locally:', e);
      success = false;
    }
    // Also persist to localStorage as fallback
    try {
      localStorage.setItem('noor-save', JSON.stringify(this.saveData));
    } catch {
      // localStorage may be full or unavailable; ignore
    }
    // Emit a save-completion event so UI indicators can react
    gameEvents.emit('save:complete', { success, timestamp: this.saveData.lastSaveTime });
  }

  /** Returns the timestamp (ms since epoch) of the last successful save. */
  getLastSaveTime(): number {
    return this.saveData.lastSaveTime;
  }

  async loadProgress(): Promise<SaveData> {
    // Try server first
    try {
      const res = await fetch('/api/save');
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && serverData.playerId) {
          this.saveData = this._normalize(serverData);
          localStorage.setItem('noor-save', JSON.stringify(this.saveData));
          return this.saveData;
        }
      }
    } catch (e) {
      console.warn('Server load failed, trying localStorage:', e);
    }

    // Fallback to localStorage
    const local = localStorage.getItem('noor-save');
    if (local) {
      try {
        this.saveData = this._normalize(JSON.parse(local));
        return this.saveData;
      } catch {
        this.saveData = this._createDefaultSaveData();
      }
    }

    return this.saveData;
  }

  /**
   * Ensure all expected fields exist on a freshly-loaded save object.
   * Older save data (from before achievements were added) will be missing
   * `unlockedAchievements`; this fills in sane defaults without dropping
   * any existing fields.
   */
  private _normalize(data: Partial<SaveData>): SaveData {
    const defaults = this._createDefaultSaveData();
    return {
      playerId: data.playerId ?? defaults.playerId,
      currentChapter: data.currentChapter ?? defaults.currentChapter,
      completedObjectives: data.completedObjectives ?? [],
      completedQuests: data.completedQuests ?? [],
      unlockedCodexEntries: data.unlockedCodexEntries ?? [],
      journalEntries: data.journalEntries ?? [],
      xp: data.xp ?? 0,
      chapterMedals: data.chapterMedals ?? [],
      unlockedAchievements: data.unlockedAchievements ?? [],
      gameState: data.gameState ?? defaults.gameState,
      lastSaveTime: data.lastSaveTime ?? 0,
    };
  }

  unlockCodexEntry(id: string): void {
    if (!this.saveData.unlockedCodexEntries.includes(id)) {
      this.saveData.unlockedCodexEntries.push(id);
      gameEvents.emit('codex:unlock', id);
    }
  }

  addJournalEntry(text: string, chapterId: string = 'ch1'): void {
    const entry: JournalEntry = {
      id: `journal-${Date.now()}`,
      chapterId,
      text,
      timestamp: Date.now(),
    };
    this.saveData.journalEntries.push(entry);
    gameEvents.emit('journal:entry', entry);
  }

  awardXp(amount: number): void {
    this.saveData.xp += amount;
    gameEvents.emit('xp:gained', amount);
  }

  completeObjective(objectiveId: string): void {
    if (!this.saveData.completedObjectives.includes(objectiveId)) {
      this.saveData.completedObjectives.push(objectiveId);
      gameEvents.emit('quest:objectiveComplete', objectiveId);
    }
  }

  completeQuest(questId: string): void {
    if (!this.saveData.completedQuests.includes(questId)) {
      this.saveData.completedQuests.push(questId);
      gameEvents.emit('quest:complete', questId);
    }
  }

  awardChapterMedal(chapterId: string, medalName: string): void {
    if (!this.saveData.chapterMedals.find(m => m.chapterId === chapterId)) {
      const medal: ChapterMedal = {
        chapterId,
        medalName,
        awardedAt: Date.now(),
      };
      this.saveData.chapterMedals.push(medal);
      gameEvents.emit('chapter:medal', medal);
    }
  }

  completeChapter(chapterId: string): void {
    this.saveData.currentChapter = chapterId;
    gameEvents.emit('chapter:complete', chapterId);
  }

  updateGameState(state: Partial<GameState>): void {
    this.saveData.gameState = { ...this.saveData.gameState, ...state };
  }

  isObjectiveCompleted(objectiveId: string): boolean {
    return this.saveData.completedObjectives.includes(objectiveId);
  }

  isQuestCompleted(questId: string): boolean {
    return this.saveData.completedQuests.includes(questId);
  }

  isCodexUnlocked(codexId: string): boolean {
    return this.saveData.unlockedCodexEntries.includes(codexId);
  }

  getXp(): number {
    return this.saveData.xp;
  }

  getGameState(): GameState {
    return this.saveData.gameState;
  }

  getSaveData(): SaveData {
    return this.saveData;
  }

  getJournalEntries(): JournalEntry[] {
    return this.saveData.journalEntries;
  }

  getUnlockedCodexEntries(): string[] {
    return this.saveData.unlockedCodexEntries;
  }

  getChapterMedals(): ChapterMedal[] {
    return this.saveData.chapterMedals;
  }

  // --- Achievements ---

  unlockAchievement(id: string, xpReward: number): boolean {
    if (this.saveData.unlockedAchievements.find(a => a.id === id)) {
      return false;
    }
    const record: AchievementRecord = {
      id,
      unlockedAt: Date.now(),
      xpAwarded: xpReward,
    };
    this.saveData.unlockedAchievements.push(record);
    // Award the achievement XP to the player's total too
    this.saveData.xp += xpReward;
    return true;
  }

  isAchievementUnlocked(id: string): boolean {
    return this.saveData.unlockedAchievements.some(a => a.id === id);
  }

  getUnlockedAchievements(): AchievementRecord[] {
    return this.saveData.unlockedAchievements;
  }

  getAchievementsXp(): number {
    return this.saveData.unlockedAchievements.reduce((sum, a) => sum + a.xpAwarded, 0);
  }

  resetProgress(): void {
    this.saveData = this._createDefaultSaveData();
    localStorage.removeItem('noor-save');
  }

  // Auto-save every 30 seconds
  startAutoSave(): void {
    this.autoSaveInterval = window.setInterval(() => {
      this.saveProgress();
    }, 30000);
  }

  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }
}

export const saveManager = new SaveManager();
export default SaveManager;
export type { SaveData, JournalEntry, ChapterMedal, GameState, AchievementRecord };
