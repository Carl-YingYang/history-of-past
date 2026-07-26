// Game State Store - Zustand store for React UI components to read game state
// This bridges the Canvas game engine with the React UI layer

import { create } from 'zustand';
import { gameEvents } from '@/lib/game/eventBus';
import { saveManager } from '@/lib/game/saveManager';
import { soundManager } from '@/lib/game/soundManager';
import chapters from '@/data/chapters.json';
import quests from '@/data/quests.json';
import codex from '@/data/codex.json';
import quizData from '@/data/quizData.json';
import dialogueData from '@/data/dialogueData.json';

interface DialogueLine {
  speaker: string;
  text: string;
  translation?: string;
  isTimeTransition?: boolean;
  isIbarraSighting?: boolean;
}

// Warmth tier type — used by the relationship-depth dialogue system.
// NPCs progress through tiers as the player talks to them more often.
type WarmthTier = 'acquainted' | 'familiar' | 'trusted';

// Shape of warmth dialogue lines stored in dialogueData.json
interface WarmthDialogueLine {
  fil: string;
  en: string;
  speaker: string;
}

interface WarmthDialogues {
  [npcId: string]: {
    [tier in WarmthTier]?: WarmthDialogueLine[];
  };
}

// Map an NPC id (as used in the game engine) to the warmth dialogue key in
// dialogueData.warmthDialogues. The engine uses 'mang-tenyo' and 'kitchen-staff'
// while the warmth section uses the same ids, so this is essentially a 1:1 map
// today — but kept as a function for future flexibility.
const WARMTH_NPC_MAP: Record<string, string> = {
  'mang-tenyo': 'mang-tenyo',
  'kitchen-staff': 'kitchen-staff',
  // The market-gossip dialogue involves both Aling Nena and Mang Andres, so we
  // also recognise the individual ids (used by NPCRelationshipPanel) and treat
  // them as kitchen-staff for warmth purposes.
  'aling-nena': 'kitchen-staff',
  'mang-andres': 'kitchen-staff',
};

// Dialogues that the game engine fires when the player talks to an NPC they
// already met. When the store sees one of these on `dialogue:start`, we attempt
// to replace the first line with a warmth line if the NPC has built up enough
// relationship depth. This is how we "hook" warmth dialogues in without
// modifying the (read-only) game engine.
const REPEAT_DIALOGUE_IDS = new Set<string>([
  'mang-tenyo-repeat',
  'mang-tenyo-after-gossip',
]);

interface GameState {
  // Dialogue state
  dialogueActive: boolean;
  dialogueId: string | null;
  currentLine: DialogueLine | null;
  currentLineIndex: number;
  totalLines: number;
  // Warmth dialogue indicators — set to true while the current line being
  // shown is a relationship-depth "warmth" bonus line (instead of the
  // original first line of the dialogue).
  isWarmthDialogue: boolean;
  warmthTier: WarmthTier | null;
  
  // Quest tracking
  completedObjectives: string[];
  currentQuest: typeof quests[0] | null;
  
  // Codex
  unlockedCodex: string[];
  codexEntries: typeof codex;
  
  // Progress
  xp: number;
  chapterMedals: { chapterId: string; medalName: string }[];
  chapterComplete: boolean;
  
  // Quiz
  quizActive: boolean;
  quizQuestions: typeof quizData;
  currentQuizQuestion: number;
  quizScore: number;
  quizComplete: boolean;
  
  // Time
  timeOfDay: 'afternoon' | 'morning';
  chapterPhase: string;
  
  // Journal
  journalEntries: { id: string; text: string; timestamp: number }[];
  
  // Chapter medal display
  showMedal: boolean;
  medalInfo: { chapterId: string; medalName: string; medalDescription: string } | null;
  
  // Intro state
  gameReady: boolean;
  introVisible: boolean;
  
  // Actions
  setIntroVisible: (v: boolean) => void;
  advanceDialogue: () => void;
  answerQuiz: (questionIndex: number, answerId: string) => void;
  startQuiz: (chapterId: string) => void;
  completeChapterLoop: () => void;
  resetGame: () => void;
  // Warmth dialogue trigger — picks a random line from the appropriate tier
  // for the given NPC and starts a dialogue using the dialogue:start event.
  triggerWarmthDialogue: (npcId: string) => void;
}

// ---------------------------------------------------------------------------
// Warmth dialogue helpers (read-only — do not mutate game state directly)
// ---------------------------------------------------------------------------

/**
 * Read NPC interaction counts from localStorage 'noor-npc-interactions'.
 * Returns a map of npcId → timesTalked. SSR-safe (returns {} on server).
 */
function readNpcInteractionCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem('noor-npc-interactions');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      const v = val as { timesTalked?: unknown };
      if (typeof v?.timesTalked === 'number') {
        result[key] = v.timesTalked;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Determine the warmth tier for an NPC based on its interaction count.
 * 0       → not encountered (returns null — caller should fall back)
 * 1–2     → 'acquainted'
 * 3–4     → 'familiar'
 * 5+      → 'trusted'
 */
function tierFromCount(count: number): WarmthTier | null {
  if (count <= 0) return null;
  if (count <= 2) return 'acquainted';
  if (count <= 4) return 'familiar';
  return 'trusted';
}

/**
 * Pick a random warmth line for the given NPC and tier. Returns null if no
 * lines are defined for that NPC/tier combo.
 */
function pickWarmthLine(npcId: string, tier: WarmthTier): WarmthDialogueLine | null {
  const warmthKey = WARMTH_NPC_MAP[npcId];
  if (!warmthKey) return null;
  const warmthData = (dialogueData as unknown as { warmthDialogues: WarmthDialogues }).warmthDialogues;
  if (!warmthData) return null;
  const npcTiers = warmthData[warmthKey];
  if (!npcTiers) return null;
  const lines = npcTiers[tier];
  if (!lines || lines.length === 0) return null;
  const idx = Math.floor(Math.random() * lines.length);
  return lines[idx] ?? null;
}

/**
 * Convert a warmth dialogue line (with fil/en fields) into the standard
 * DialogueLine shape used by the rest of the dialogue system.
 */
function warmthLineToDialogueLine(line: WarmthDialogueLine): DialogueLine {
  return {
    speaker: line.speaker,
    text: line.fil,
    translation: line.en,
  };
}

export const useGameStore = create<GameState>((set, get) => {
  // Listen to game events and update store
  gameEvents.on('dialogue:start', (data: unknown) => {
    const d = data as { dialogueId: string; line: DialogueLine; lineIndex: number; totalLines: number };

    // ── Warmth dialogue hook ──
    // When the game engine fires one of the "repeat" dialogues (the player
    // has already met this NPC), we attempt to show a relationship-depth
    // "warmth" line instead of the original first line. We do this without
    // modifying the (read-only) game engine by intercepting the dialogue:start
    // event here and rewriting the line + isWarmthDialogue flag.
    let effectiveLine: DialogueLine = d.line;
    let isWarmthDialogue = false;
    let warmthTier: WarmthTier | null = null;

    if (REPEAT_DIALOGUE_IDS.has(d.dialogueId)) {
      // Map repeat dialogue id → NPC id (for warmth lookup).
      const npcId = d.dialogueId.startsWith('mang-tenyo') ? 'mang-tenyo' : 'kitchen-staff';
      const interactions = readNpcInteractionCounts();
      const count = interactions[npcId] ?? 0;
      const tier = tierFromCount(count);
      if (tier) {
        const warmthLine = pickWarmthLine(npcId, tier);
        if (warmthLine) {
          effectiveLine = warmthLineToDialogueLine(warmthLine);
          isWarmthDialogue = true;
          warmthTier = tier;
        }
      }
      // If no warmth line was found, fall through and show the original
      // repeat dialogue as-is (default repeat-line behaviour).
    }

    set({
      dialogueActive: true,
      dialogueId: d.dialogueId,
      currentLine: effectiveLine,
      currentLineIndex: d.lineIndex,
      totalLines: d.totalLines,
      isWarmthDialogue,
      warmthTier,
    });
    soundManager.play('dialogue-open');

    // Dispatch a 'noor:discovery' event for the NPC the player is talking to
    // — this lets the DiscoveryLogPanel auto-record NPC encounters. We dedupe
    // by speaker name, so repeat conversations with the same NPC don't spam.
    if (d.line?.speaker && typeof window !== 'undefined') {
      const speakerName = d.line.speaker;
      const npcId = `npc-${speakerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      // Only dispatch if not already recorded
      try {
        const raw = localStorage.getItem('noor-discovery-log');
        const existing = raw ? JSON.parse(raw) : [];
        if (Array.isArray(existing) && !existing.some((e: { id: string }) => e.id === npcId)) {
          window.dispatchEvent(new CustomEvent('noor:discovery', {
            detail: {
              id: npcId,
              name: speakerName,
              type: 'npc',
              position: { x: 0, y: 0 }, // position unknown from dialogue event
              timestamp: Date.now(),
              note: `First encountered during "${d.dialogueId}"`,
            },
          }));
        }
      } catch {
        // ignore — localStorage may be unavailable
      }
    }
  });

  gameEvents.on('dialogue:line', (data: unknown) => {
    const d = data as { dialogueId: string; line: DialogueLine; lineIndex: number; totalLines: number };
    // Once we advance past the warmth "bonus" intro line, clear the warmth
    // flags — subsequent lines are the standard repeat dialogue.
    set({
      currentLine: d.line,
      currentLineIndex: d.lineIndex,
      totalLines: d.totalLines,
      isWarmthDialogue: false,
      warmthTier: null,
    });
    soundManager.play('dialogue-advance');
  });

  gameEvents.on('dialogue:end', () => {
    set({
      dialogueActive: false,
      dialogueId: null,
      currentLine: null,
      currentLineIndex: 0,
      totalLines: 0,
      isWarmthDialogue: false,
      warmthTier: null,
    });
    soundManager.play('dialogue-close');
  });

  gameEvents.on('quest:objectiveComplete', (objectiveId: unknown) => {
    set(state => ({
      completedObjectives: [...state.completedObjectives, objectiveId as string],
    }));
    soundManager.play('objective-complete');
  });

  gameEvents.on('xp:gained', (amount: unknown) => {
    set(state => ({ xp: state.xp + (amount as number) }));
    soundManager.play('xp-gain');
  });

  gameEvents.on('codex:unlock', (id: unknown) => {
    set(state => ({ unlockedCodex: [...state.unlockedCodex, id as string] }));
    soundManager.play('codex-unlock');
  });

  gameEvents.on('journal:entry', (entry: unknown) => {
    const e = entry as { id: string; text: string; timestamp: number };
    set(state => ({ journalEntries: [...state.journalEntries, e] }));
  });

  gameEvents.on('chapter:medal', (medal: unknown) => {
    const m = medal as { chapterId: string; medalName: string };
    const chapter = chapters.find(c => c.id === m.chapterId);
    set({
      chapterMedals: [...get().chapterMedals, m],
      showMedal: true,
      medalInfo: {
        chapterId: m.chapterId,
        medalName: m.medalName,
        medalDescription: chapter?.medalDescription || '',
      },
    });
    soundManager.play('medal');
    // Auto-hide medal after 5 seconds
    setTimeout(() => set({ showMedal: false, medalInfo: null }), 5000);
  });

  gameEvents.on('chapter:complete', () => {
    set({ chapterComplete: true });
    soundManager.play('chapter-complete');
  });

  gameEvents.on('time:transition', (time: unknown) => {
    set({ timeOfDay: time as 'afternoon' | 'morning' });
    soundManager.play('time-transition');
  });

  gameEvents.on('quiz:start', (chapterId: unknown) => {
    const questions = quizData.filter(q => q.chapterId === chapterId);
    set({
      quizActive: true,
      quizQuestions: questions,
      currentQuizQuestion: 0,
      quizScore: 0,
      quizComplete: false,
    });
  });

  gameEvents.on('game:ready', () => {
    // Refresh store state from saveManager (which has now loaded saved data)
    const saveData = saveManager.getSaveData();
    set({
      gameReady: true,
      completedObjectives: saveData.completedObjectives,
      unlockedCodex: saveData.unlockedCodexEntries,
      xp: saveData.xp,
      chapterMedals: saveData.chapterMedals,
      journalEntries: saveData.journalEntries,
      timeOfDay: saveData.gameState.timeOfDay,
      chapterPhase: saveData.gameState.chapterPhase,
    });
  });

  // Load initial state from save manager
  const initialSaveData = saveManager.getSaveData();
  
  return {
    // Initial state from save data
    dialogueActive: false,
    dialogueId: null,
    currentLine: null,
    currentLineIndex: 0,
    totalLines: 0,
    isWarmthDialogue: false,
    warmthTier: null,
    
    completedObjectives: initialSaveData.completedObjectives,
    currentQuest: quests.find(q => q.chapterId === 'ch1') || null,
    
    unlockedCodex: initialSaveData.unlockedCodexEntries,
    codexEntries: codex,
    
    xp: initialSaveData.xp,
    chapterMedals: initialSaveData.chapterMedals,
    chapterComplete: false,
    
    quizActive: false,
    quizQuestions: [],
    currentQuizQuestion: 0,
    quizScore: 0,
    quizComplete: false,
    
    timeOfDay: initialSaveData.gameState.timeOfDay,
    chapterPhase: initialSaveData.gameState.chapterPhase,
    
    journalEntries: initialSaveData.journalEntries,
    
    showMedal: false,
    medalInfo: null,
    
    gameReady: false,
    introVisible: true,
    
    // Actions
    setIntroVisible: (v: boolean) => {
      set({ introVisible: v });
    },
    advanceDialogue: () => {
      // This calls the game engine's advanceDialogue
      // The engine will emit dialogue:line or dialogue:end events
      // which the store will pick up via the event listeners above
      const { dialogueId } = get();
      if (!dialogueId) return;
      
      // We need to call the engine's advanceDialogue method
      // This is done via a callback that the GameCanvas component sets up
      // For now, emit a custom event that the engine listens to
      gameEvents.emit('dialogue:advance');
    },
    
    answerQuiz: (questionIndex: number, answerId: string) => {
      const { quizQuestions, quizScore, currentQuizQuestion } = get();
      const question = quizQuestions[questionIndex];
      if (!question) return;
      
      const selectedOption = question.options.find(o => o.id === answerId);
      const isCorrect = selectedOption?.correct || false;
      
      const newScore = isCorrect ? quizScore + 1 : quizScore;
      const nextQuestion = currentQuizQuestion + 1;
      
      if (nextQuestion >= quizQuestions.length) {
        set({
          quizScore: newScore,
          currentQuizQuestion: nextQuestion,
          quizComplete: true,
          quizActive: false,
        });
        // After quiz, trigger chapter completion
        get().completeChapterLoop();
      } else {
        set({
          quizScore: newScore,
          currentQuizQuestion: nextQuestion,
        });
      }
    },
    
    startQuiz: (chapterId: string) => {
      const questions = quizData.filter(q => q.chapterId === chapterId);
      set({
        quizActive: true,
        quizQuestions: questions,
        currentQuizQuestion: 0,
        quizScore: 0,
        quizComplete: false,
      });
    },
    
    completeChapterLoop: () => {
      // This calls saveManager methods and emits events
      saveManager.awardXp(60);
      saveManager.unlockCodexEntry('char.ibarra');
      saveManager.unlockCodexEntry('char.tiago');
      saveManager.unlockCodexEntry('char.damaso');
      saveManager.addJournalEntry(
        "Mang Tenyo warned me not to mention the Ibarra name loudly. Something happened at last night's reception. I overheard the kitchen staff talking about Padre Dámaso's rudeness to Ibarra. Then I saw Ibarra himself crossing the plaza — a young man carrying ideas from Europe that the friars fear.",
        'ch1'
      );
      saveManager.awardChapterMedal('ch1', 'Listener');
      saveManager.completeQuest('mq.ch1.arrival');
      saveManager.completeChapter('ch1');
      saveManager.saveProgress();
      
      set({
        chapterComplete: true,
        chapterPhase: 'complete',
      });
    },
    
    resetGame: () => {
      saveManager.resetProgress();
      set({
        dialogueActive: false,
        dialogueId: null,
        currentLine: null,
        completedObjectives: [],
        unlockedCodex: [],
        xp: 0,
        chapterMedals: [],
        chapterComplete: false,
        quizActive: false,
        quizComplete: false,
        timeOfDay: 'afternoon',
        chapterPhase: 'intro',
        journalEntries: [],
        showMedal: false,
        medalInfo: null,
        introVisible: true,
        isWarmthDialogue: false,
        warmthTier: null,
      });
    },

    // Warmth dialogue trigger — picks a random line from the appropriate tier
    // for the given NPC and starts a one-line dialogue using the dialogue:start
    // event. The game engine doesn't call this directly today (the engine fires
    // the standard repeat dialogues, which we intercept above); this method is
    // exposed so other UI surfaces (e.g. an NPC Relationship panel "Talk" button)
    // can trigger warmth dialogues programmatically. If the NPC has no warmth
    // lines defined or the player hasn't met them yet, a default repeat line
    // is shown instead.
    triggerWarmthDialogue: (npcId: string) => {
      const interactions = readNpcInteractionCounts();
      const count = interactions[npcId] ?? 0;
      const tier = tierFromCount(count);

      // Try to pick a warmth line at the appropriate tier, walking down the
      // tiers if a higher one is empty (defensive — shouldn't happen with our
      // data, but safe).
      let warmthLine: WarmthDialogueLine | null = null;
      let effectiveTier: WarmthTier | null = null;
      const tierOrder: WarmthTier[] = ['trusted', 'familiar', 'acquainted'];
      if (tier) {
        // Start from the player's current tier and walk down
        const startIdx = tierOrder.indexOf(tier);
        for (let i = startIdx; i < tierOrder.length; i++) {
          const candidate = pickWarmthLine(npcId, tierOrder[i]);
          if (candidate) {
            warmthLine = candidate;
            effectiveTier = tierOrder[i];
            break;
          }
        }
      }

      let line: DialogueLine;
      if (warmthLine && effectiveTier) {
        line = warmthLineToDialogueLine(warmthLine);
      } else {
        // Fallback default repeat line — a generic NPC acknowledgement.
        line = {
          speaker: 'Narrator',
          text: 'You greet the townsfolk, but they seem busy with their own thoughts. Perhaps try again later.',
          translation: '',
        };
        effectiveTier = null;
      }

      // Emit dialogue:start directly. The store's own listener (above) will
      // pick this up and update the React state accordingly.
      gameEvents.emit('dialogue:start', {
        dialogueId: `warmth-${npcId}`,
        line,
        lineIndex: 0,
        totalLines: 1,
      });
      // Explicitly set warmth flags (the listener only sets them when the
      // dialogueId is in REPEAT_DIALOGUE_IDS, which warmth-<id> is not).
      set({
        isWarmthDialogue: warmthLine !== null,
        warmthTier: effectiveTier,
      });
    },
  };
});

export default useGameStore;
