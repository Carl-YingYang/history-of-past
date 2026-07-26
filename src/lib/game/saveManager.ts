// SaveManager - Abstraction layer for game persistence
// Game code only calls these methods, never raw DB/API calls
// Internals can be swapped later for offline APK build without touching scene/quest/dialogue code

import { gameEvents } from './eventBus';

interface SaveData {
  playerId: string;
  currentChapter: string;
  completedObjectives: string[];
  completedQuests: string[];
  unlockedCodexEntries: string[];
  journalEntries: JournalEntry[];
  xp: number;
  chapterMedals: ChapterMedal[];
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
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.saveData),
      });
    } catch (e) {
      console.warn('Server save failed, data kept locally:', e);
    }
    // Also persist to localStorage as fallback
    localStorage.setItem('noor-save', JSON.stringify(this.saveData));
  }

  async loadProgress(): Promise<SaveData> {
    // Try server first
    try {
      const res = await fetch('/api/save');
      if (res.ok) {
        const serverData = await res.json();
        if (serverData && serverData.playerId) {
          this.saveData = serverData;
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
        this.saveData = JSON.parse(local);
        return this.saveData;
      } catch {
        this.saveData = this._createDefaultSaveData();
      }
    }

    return this.saveData;
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
export type { SaveData, JournalEntry, ChapterMedal, GameState };
