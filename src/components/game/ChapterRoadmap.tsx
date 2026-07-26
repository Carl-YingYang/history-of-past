'use client';

import { useUIStore } from './UIManager';
import { useGameStore } from '@/stores/gameStore';
import quests from '@/data/quests.json';

/**
 * ChapterRoadmap - Vertical timeline of all 11 chapters of Noli Me Tangere.
 *
 * Uses the shared useUIStore panel system (panel id: 'roadmap').
 * Renders when `activePanel === 'roadmap'`.
 * Keyboard shortcut: R (registered in UIManager GlobalKeyboardShortcuts).
 *
 * Each chapter card shows:
 *   - Numbered circular badge (amber for current, emerald for completed,
 *     gray for locked/coming-next)
 *   - Chapter title in Georgia serif
 *   - Status badge: Available / Coming Next / Locked
 *   - Italic Georgia teaser text
 *   - For the current chapter: a live progress bar (objectives completed)
 *
 * Styling mirrors AboutChapterPanel / DiscoveryLogPanel:
 *   - parchment-texture, panel-ornamental-header, custom-scroll-amber,
 *     corner-flourish, animate-panel-slide-in
 *
 * Spec note: This is an educational tool, so all teaser text is shown
 * even for "locked" chapters (rather than blurring as ???). Players can
 * preview what's coming — this matches the task spec which explicitly
 * allows spoilers for educational use.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChapterStatus = 'available' | 'coming-next' | 'locked' | 'completed';

interface ChapterEntry {
  number: number;
  title: string;
  status: ChapterStatus;
  teaser: string;
}

// ---------------------------------------------------------------------------
// Data — all 11 chapters of Noli Me Tangere
// ---------------------------------------------------------------------------

const CHAPTERS: ChapterEntry[] = [
  {
    number: 1,
    title: 'A Stranger in San Diego',
    status: 'available',
    teaser:
      'You arrive in San Diego as a stranger. Mang Tenyo guides you through the plaza, the church, the market — and the quiet tensions of a town under friar rule. A funeral has just ended; the air is heavy.',
  },
  {
    number: 2,
    title: 'Ibarra\'s Return',
    status: 'coming-next',
    teaser:
      'Crisóstomo Ibarra arrives after seven years in Europe. Meet María Clara, Capitán Tiago\'s daughter, and witness the tensions of a returning ilustrado.',
  },
  {
    number: 3,
    title: 'The Dinner',
    status: 'locked',
    teaser:
      'A tense dinner at Capitán Tiago\'s reveals the fractures of colonial society. Dámaso\'s hostility simmers.',
  },
  {
    number: 4,
    title: 'The School Project',
    status: 'locked',
    teaser:
      'Ibarra dreams of building a school for the town\'s children — a vision of progress that will collide with vested interests.',
  },
  {
    number: 5,
    title: 'The Excavation',
    status: 'locked',
    teaser:
      'Workers uncover something sinister in the school foundation. Old wounds reopen.',
  },
  {
    number: 6,
    title: 'The Banquet',
    status: 'locked',
    teaser:
      'Tiago throws a lavish banquet. Beneath the music, alliances shift and plots thicken.',
  },
  {
    number: 7,
    title: 'María Clara\'s Confession',
    status: 'locked',
    teaser:
      'In the convent garden, María Clara confesses a secret that will shatter Ibarra\'s world.',
  },
  {
    number: 8,
    title: 'Elias, the Helmsman',
    status: 'locked',
    teaser:
      'A mysterious boatman saves Ibarra from drowning. Elias carries a vendetta older than the town itself.',
  },
  {
    number: 9,
    title: 'The Hunt',
    status: 'locked',
    teaser:
      'A hunting expedition turns deadly. The past catches up with the present.',
  },
  {
    number: 10,
    title: 'Rumors and Reckonings',
    status: 'locked',
    teaser:
      'Whispered accusations spread through San Diego. Ibarra is named a subversive.',
  },
  {
    number: 11,
    title: 'Merry Christmas',
    status: 'locked',
    teaser:
      'The Christmas Eve mass becomes a stage for revelations. The chapter closes as the novel\'s first act ends.',
  },
];

const TOTAL_CHAPTERS = CHAPTERS.length;

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------

const STATUS_META: Record<ChapterStatus, {
  icon: string;
  label: string;
  badgeClass: string; // bg + border + text classes for the status pill
}> = {
  available: {
    icon: '✅',
    label: 'Available',
    badgeClass: 'border-emerald-400/60 text-emerald-300 bg-emerald-950/40',
  },
  'coming-next': {
    icon: '🔜',
    label: 'Coming Next',
    badgeClass: 'border-amber-400/60 text-amber-300 bg-amber-950/40',
  },
  locked: {
    icon: '🔒',
    label: 'Locked',
    badgeClass: 'border-white/20 text-white/50 bg-stone-900/60',
  },
  completed: {
    icon: '🏆',
    label: 'Completed',
    badgeClass: 'border-amber-400/70 text-amber-200 bg-amber-900/40',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChapterRoadmap() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'roadmap';

  // Live progress for Chapter 1 (the only available chapter).
  const { completedObjectives, xp } = useGameStore();
  const currentQuest = (quests as Array<{ chapterId: string; objectives: Array<{ id: string }> }>)
    .find(q => q.chapterId === 'ch1');
  const totalObjectives = currentQuest?.objectives?.length ?? 3;
  const completedCount = completedObjectives.length;
  const progressPct = Math.min(100, Math.round((completedCount / totalObjectives) * 100));

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-16 left-4 z-50 w-[480px] max-w-[calc(100vw-2rem)] max-h-[80vh] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in flex flex-col overflow-hidden parchment-texture corner-flourish"
      role="dialog"
      aria-label="Chapter Roadmap"
    >
      {/* Header */}
      <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/50 via-stone-950 to-stone-950 panel-ornamental-header shrink-0">
        <div>
          <h3
            className="text-amber-400 font-bold text-base flex items-center gap-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <span className="text-lg">🗺️</span> Chapter Roadmap <span className="text-amber-500/80">✦</span>
          </h3>
          <div className="text-white/50 text-xs mt-0.5">
            Your journey through <em style={{ fontFamily: 'Georgia, serif' }}>Noli Me Tangere</em> — 11 chapters
          </div>
        </div>
        <button
          type="button"
          onClick={() => togglePanel('roadmap')}
          className="close-btn-styled w-8 h-8 rounded-md bg-stone-800/40 text-white/60 flex items-center justify-center shrink-0"
          aria-label="Close Chapter Roadmap"
        >
          ✕
        </button>
      </div>

      {/* Vertical timeline body */}
      <div
        className="flex-1 overflow-y-auto p-4 custom-scroll-amber"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        <div className="relative">
          {/* Timeline rail (vertical line) */}
          <div
            className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-amber-400/40 via-amber-400/20 to-transparent pointer-events-none"
            aria-hidden="true"
          />

          <ul className="space-y-3">
            {CHAPTERS.map((ch) => (
              <ChapterCard
                key={ch.number}
                chapter={ch}
                progressPct={progressPct}
                completedCount={completedCount}
                totalObjectives={totalObjectives}
                currentXp={xp}
              />
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <div className="mt-5 pt-3 border-t border-amber-400/15 text-[11px] text-white/40 italic text-center">
          New chapters unlock as José Rizal&apos;s story unfolds.
        </div>
      </div>

      {/* Footer bar */}
      <div className="px-4 py-2 border-t border-amber-400/20 bg-stone-900/60 flex items-center justify-between shrink-0">
        <div className="text-[11px] text-white/55 flex items-center gap-1.5">
          <span className="text-amber-400/80">📖</span>
          <span>
            <span className="text-amber-300/90 font-semibold">1</span> of{' '}
            <span className="text-amber-300/90 font-semibold">{TOTAL_CHAPTERS}</span> chapters available
          </span>
        </div>
        <div className="text-[10px] text-white/35 font-mono uppercase tracking-wider">
          Build v0.4
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterCard — single chapter row in the timeline
// ---------------------------------------------------------------------------

interface ChapterCardProps {
  chapter: ChapterEntry;
  progressPct: number;
  completedCount: number;
  totalObjectives: number;
  currentXp: number;
}

function ChapterCard({
  chapter,
  progressPct,
  completedCount,
  totalObjectives,
  currentXp,
}: ChapterCardProps) {
  const meta = STATUS_META[chapter.status];
  const isCurrent = chapter.status === 'available';
  const isLocked = chapter.status === 'locked';
  const isComingNext = chapter.status === 'coming-next';
  const isCompleted = chapter.status === 'completed';

  // Badge color by status: amber for current, emerald for completed,
  // gray for locked/coming-next.
  const badgeClass = isCompleted
    ? 'bg-emerald-900/60 border-emerald-400/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
    : isCurrent
      ? 'bg-amber-900/60 border-amber-400/70 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
      : 'bg-stone-800/70 border-white/15 text-white/55';

  // Card border / background by status
  const cardClass = isCurrent
    ? 'border-amber-400/40 bg-amber-950/15 hover:border-amber-400/60'
    : isComingNext
      ? 'border-amber-400/25 bg-stone-900/40 hover:border-amber-400/40'
      : isLocked
        ? 'border-white/10 bg-stone-900/30 hover:border-white/20'
        : 'border-emerald-400/30 bg-emerald-950/10 hover:border-emerald-400/50';

  return (
    <li className="relative pl-12">
      {/* Circular numbered badge on the timeline rail */}
      <div
        className={`absolute left-0 top-1 w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm ${badgeClass}`}
        style={{ fontFamily: 'Georgia, serif' }}
        aria-hidden="true"
      >
        {chapter.number}
      </div>

      {/* Card body */}
      <div className={`rounded-lg border ${cardClass} p-3 transition-colors`}>
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h4
            className={`text-sm font-semibold leading-tight ${
              isLocked ? 'text-white/70' : 'text-amber-200'
            }`}
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {chapter.title}
          </h4>
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-mono leading-none ${meta.badgeClass}`}
          >
            <span aria-hidden="true">{meta.icon}</span>
            {meta.label}
          </span>
        </div>

        {/* Teaser text — shown for all chapters (educational spoilers OK) */}
        <p
          className={`mt-1.5 text-[11.5px] leading-snug italic ${
            isLocked ? 'text-white/45' : 'text-white/65'
          }`}
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {chapter.teaser}
        </p>

        {/* Progress section — only for the current chapter */}
        {isCurrent && (
          <div className="mt-2.5 pt-2 border-t border-amber-400/15">
            <div className="flex items-center justify-between text-[10px] text-white/55 mb-1">
              <span>
                Objectives:{' '}
                <span className="text-amber-300 font-semibold">
                  {completedCount}/{totalObjectives}
                </span>
              </span>
              <span>
                XP earned:{' '}
                <span className="text-amber-300 font-semibold">{currentXp}</span>
              </span>
            </div>
            {/* Progress bar */}
            <div className="relative h-2 w-full bg-stone-800/80 rounded-full overflow-hidden border border-amber-400/10">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-300 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
              {/* Subtle shimmer on the progress fill */}
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-sweep 2.5s ease-in-out infinite',
                }}
                aria-hidden="true"
              />
            </div>
            <div className="text-[9px] text-amber-400/60 mt-1 text-right font-mono">
              {progressPct}% complete
            </div>
          </div>
        )}

        {/* Coming-next hint */}
        {isComingNext && (
          <div className="mt-2 pt-1.5 border-t border-amber-400/15 text-[10px] text-amber-400/60 italic">
            Unlocks when Chapter 1 is complete.
          </div>
        )}

        {/* Locked hint */}
        {isLocked && (
          <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] text-white/35 italic">
            Complete earlier chapters to unlock.
          </div>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Exported helper — toggle the Chapter Roadmap panel from anywhere.
// Mirrors the pattern used by DiscoveryLogPanel / FieldNotesPanel /
// RizalQuoteLibrary / NPCRelationshipPanel.
// ---------------------------------------------------------------------------

export function toggleChapterRoadmap() {
  if (typeof window === 'undefined') return;
  // Use the global UI store directly so it integrates with the single-panel
  // system (closing any other open panel, opening the backdrop, etc.).
  const store = useUIStore.getState();
  store.togglePanel('roadmap');
}
