'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import GameCanvas from '@/components/game/GameCanvas';
import DialogueBox from '@/components/game/DialogueBox';
import QuestTracker from '@/components/game/QuestTracker';
import CodexPanel from '@/components/game/CodexPanel';
import JournalPanel from '@/components/game/JournalPanel';
import SettingsPanel from '@/components/game/SettingsPanel';
import Minimap from '@/components/game/Minimap';
import HUD from '@/components/game/HUD';
import TouchControls from '@/components/game/TouchControls';
import InteractButton from '@/components/game/InteractButton';
import ChapterCompleteScreen from '@/components/game/ChapterCompleteScreen';
import HelpPanel from '@/components/game/HelpPanel';
import GlossaryPanel from '@/components/game/GlossaryPanel';
import AchievementsPanel from '@/components/game/AchievementsPanel';
import StoryLogPanel from '@/components/game/StoryLogPanel';
import Toolbar from '@/components/game/Toolbar';
import NPCLabelOverlay from '@/components/game/NPCLabelOverlay';
import CulturalFactToast from '@/components/game/CulturalFactToast';
import FieldNotesPanel from '@/components/game/FieldNotesPanel';
import SaveIndicator from '@/components/game/SaveIndicator';
import {
  GlobalKeyboardShortcuts,
  ModalBackdrop,
  useUIStore,
} from '@/components/game/UIManager';
import { soundManager } from '@/lib/game/soundManager';
import { useGameStore } from '@/stores/gameStore';
import quests from '@/data/quests.json';

// Dynamic import with SSR disabled to avoid hydration mismatch from client-only animations
const IntroScreen = dynamic(() => import('@/components/game/IntroScreen'), { ssr: false });

// Phase indicator color mapping
const PHASE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'intro':       { bg: 'bg-stone-700/80',  text: 'text-white/70', label: 'Arrival' },
  'explore':     { bg: 'bg-emerald-900/60', text: 'text-emerald-300', label: 'Exploration' },
  'gossip':      { bg: 'bg-purple-900/60',  text: 'text-purple-300', label: 'Gossip Phase' },
  'ibarra-sighting': { bg: 'bg-amber-900/60', text: 'text-amber-300', label: 'Ibarra Sighting' },
  'complete':    { bg: 'bg-yellow-900/60',  text: 'text-yellow-300', label: 'Complete' },
};

export default function Home() {
  const [audioReady, setAudioReady] = useState(false);
  const { chapterComplete, completedObjectives, chapterPhase, chapterMedals, xp } = useGameStore();
  const { activePanel } = useUIStore();

  // Calculate overall completion %
  const currentQuest = quests.find(q => q.chapterId === 'ch1');
  const totalObjectives = currentQuest?.objectives.length ?? 3;
  const completedCount = completedObjectives.length;
  const overallProgress = Math.round((completedCount / totalObjectives) * 100);

  const phaseInfo = PHASE_COLORS[chapterPhase] || PHASE_COLORS['intro'];

  // Set page title and init sound on first user gesture
  useEffect(() => {
    document.title = 'Project Noor — A Stranger in San Diego';

    // Initialize audio context on first user interaction (browser autoplay policy)
    const initAudio = () => {
      if (audioReady) return;
      soundManager.initOnUserGesture();
      setAudioReady(true);
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    document.addEventListener('touchstart', initAudio);

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, [audioReady]);

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* Global keyboard shortcuts mounted once at root */}
      <GlobalKeyboardShortcuts />

      {/* Header — with animated shimmer, Filipino sun emblem, phase indicator */}
      <header className="relative bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/40 border-b border-amber-400/20 px-4 py-2.5 shrink-0 overflow-hidden">
        {/* Animated shimmer overlay — light sweeps across */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="animate-shimmer-sweep w-[50%] h-full bg-gradient-to-r from-transparent via-amber-300/10 to-transparent" />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {/* Filipino sun emblem ☀ with 8 rays */}
              <span className="text-amber-400 text-lg" style={{ filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' }}>☀</span>
              <span className="text-amber-400 font-bold text-lg tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>Project Noor</span>
              <span className="hidden sm:inline text-amber-400/40">|</span>
              <span className="hidden sm:inline text-white/70 text-sm italic" style={{ fontFamily: 'Georgia, serif' }}>Noli Me Tangere — 1887</span>
            </div>
          </div>

          {/* Phase indicator with color coding */}
          <div className="flex items-center gap-3">
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 ${phaseInfo.bg}`}>
              <span className={`text-[10px] uppercase tracking-widest font-semibold ${phaseInfo.text}`}>
                {phaseInfo.label}
              </span>
            </div>

            {/* Ornamental chapter title */}
            <div className="hidden md:flex items-center gap-2 text-amber-400/60 text-xs font-medium tracking-wider uppercase">
              <span className="text-amber-400/30">✦</span>
              <span style={{ fontFamily: 'Georgia, serif' }}>Chapter 1: A Stranger in San Diego</span>
              <span className="text-amber-400/30">✦</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main game area */}
      <main className="flex-1 relative overflow-hidden" style={{ minHeight: '500px' }}>
        <GameCanvas />

        {/* Intro / title screen overlay (fades out once game has started) */}
        <IntroScreen />

        {/* Modal backdrop dims the game when a panel is open */}
        <ModalBackdrop />

        {/* Dialogue box (hidden automatically when a panel is open) */}
        <DialogueBox />

        {/* Toolbar — responsive flex layout for panel toggle buttons */}
        <Toolbar />

        {/* Top-bar panels */}
        <CodexPanel />
        <JournalPanel />
        <SettingsPanel />
        <Minimap />
        <HelpPanel />
        <GlossaryPanel />
        <AchievementsPanel />
        <StoryLogPanel />

        {/* Free-form player notepad (separate from UIManager panel system) */}
        <FieldNotesPanel />

        {/* HUD (XP, time, medal, chapter progress) */}
        <HUD />

        {/* Quest tracker sidebar (top-right) */}
        <QuestTracker />

        {/* NPC proximity name labels */}
        <NPCLabelOverlay />

        {/* Cultural fact toast notifications */}
        <CulturalFactToast />

        {/* Save status indicator (bottom-right, click to manual save) */}
        <SaveIndicator />

        {/* Touch controls (bottom-left, also visible on desktop for accessibility) */}
        {!chapterComplete && activePanel === null && (
          <>
            <TouchControls />
            <InteractButton />
          </>
        )}

        {/* End-of-chapter summary screen */}
        <ChapterCompleteScreen />
      </main>

      {/* Footer — ornamental weaving pattern, styled key badges, progress bar */}
      <footer className="relative bg-stone-900/95 border-t border-amber-400/20 px-4 py-2 mt-auto shrink-0">
        {/* Filipino weaving pattern top border */}
        <div className="filipino-weaving-border absolute top-0 left-0 right-0 h-[6px]" />

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-amber-400/60 text-xs">
            <span>📚</span>
            <span>An educational RPG based on José Rizal&apos;s <em style={{ fontFamily: 'Georgia, serif' }}>Noli Me Tangere</em></span>
          </div>

          {/* Styled keyboard shortcut badges */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <kbd className="px-1.5 py-0.5 rounded-md bg-stone-800/80 border border-amber-400/20 text-amber-400 text-[10px] font-mono">WASD</kbd>
            <span className="text-white/30">move</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-stone-800/80 border border-amber-400/20 text-amber-400 text-[10px] font-mono">Space</kbd>
            <span className="text-white/30">talk</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-stone-800/80 border border-amber-400/20 text-amber-400 text-[10px] font-mono">C/G/J/N/A/L/M/S</kbd>
            <span className="text-white/30">panels</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-stone-800/80 border border-amber-400/20 text-amber-400 text-[10px] font-mono">H</kbd>
            <span className="text-white/30">help</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-stone-800/80 border border-amber-400/20 text-amber-400 text-[10px] font-mono">Esc</kbd>
            <span className="text-white/30">close</span>
          </div>

          {/* Small progress bar showing overall completion */}
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            <span className="text-white/30 text-[10px] uppercase tracking-wider">Progress</span>
            <div className="w-20 h-1.5 bg-stone-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-300 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="text-amber-400/70 text-[10px] font-mono">{overallProgress}%</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
