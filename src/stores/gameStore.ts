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

interface GameState {
  // Dialogue state
  dialogueActive: boolean;
  dialogueId: string | null;
  currentLine: DialogueLine | null;
  currentLineIndex: number;
  totalLines: number;
  
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
  
  // Actions
  advanceDialogue: () => void;
  answerQuiz: (questionIndex: number, answerId: string) => void;
  startQuiz: (chapterId: string) => void;
  completeChapterLoop: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set, get) => {
  // Listen to game events and update store
  gameEvents.on('dialogue:start', (data: unknown) => {
    const d = data as { dialogueId: string; line: DialogueLine; lineIndex: number; totalLines: number };
    set({
      dialogueActive: true,
      dialogueId: d.dialogueId,
      currentLine: d.line,
      currentLineIndex: d.lineIndex,
      totalLines: d.totalLines,
    });
    soundManager.play('dialogue-open');
  });

  gameEvents.on('dialogue:line', (data: unknown) => {
    const d = data as { dialogueId: string; line: DialogueLine; lineIndex: number; totalLines: number };
    set({
      currentLine: d.line,
      currentLineIndex: d.lineIndex,
      totalLines: d.totalLines,
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
    
    // Actions
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
      });
    },
  };
});

export default useGameStore;
