'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from './UIManager';
import { gameEvents } from '@/lib/game/eventBus';
import { achievementManager, type Achievement } from '@/lib/game/achievementManager';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Category = Achievement['category'];
type TabValue = 'all' | Category;

const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  exploration: { label: 'Exploration', icon: '🧭' },
  social: { label: 'Social', icon: '💬' },
  scholarship: { label: 'Scholarship', icon: '📚' },
  milestone: { label: 'Milestones', icon: '🏅' },
  secret: { label: 'Secret', icon: '✨' },
};

/**
 * AchievementsPanel - Player milestone tracker (beyond chapter medals).
 *
 * Follows the same single-modal pattern as CodexPanel/JournalPanel:
 *   - Renders a small "Trophies" toggle button in the top bar
 *   - When open, shows a scrollable grid of achievement cards organized
 *     by category, with progress bar + XP totals
 *   - Hidden achievements show "???" until unlocked
 *   - Subscribes to `achievement:unlock` events so the UI refreshes live
 */
export default function AchievementsPanel() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'achievements';

  // Force a re-render whenever an achievement unlocks while this panel is open
  const [, setBump] = useState(0);
  const [tab, setTab] = useState<TabValue>('all');

  // Initialize the achievement manager on first mount. Safe to call multiple
  // times — the manager guards against double-init.
  useEffect(() => {
    achievementManager.init();

    const unsub = gameEvents.on('achievement:unlock', () => {
      setBump(b => b + 1);
    });
    return unsub;
  }, []);

  const allAchievements = achievementManager.getAll();
  const unlockedCount = achievementManager.getUnlockedCount();
  const totalCount = achievementManager.getTotalCount();
  const totalXp = achievementManager.getTotalXp();
  const maxXp = achievementManager.getMaxXp();
  const progressPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Filter by selected tab
  const visibleAchievements = tab === 'all'
    ? allAchievements
    : allAchievements.filter(a => a.category === tab);

  // Sort: unlocked first (most recent first), then locked by category order
  const sortedAchievements = [...visibleAchievements].sort((a, b) => {
    const aUnlocked = achievementManager.isUnlocked(a.id);
    const bUnlocked = achievementManager.isUnlocked(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    if (aUnlocked && bUnlocked) {
      const aTime = achievementManager.getUnlockedAt(a.id) ?? 0;
      const bTime = achievementManager.getUnlockedAt(b.id) ?? 0;
      return bTime - aTime;
    }
    return 0;
  });

  const renderCard = (ach: Achievement) => {
    const isUnlocked = achievementManager.isUnlocked(ach.id);
    const isHiddenLocked = ach.hidden && !isUnlocked;
    const displayName = isHiddenLocked ? '???' : ach.name;
    const displayDesc = isHiddenLocked
      ? 'Keep playing to discover this hidden achievement...'
      : ach.description;
    const displayIcon = isHiddenLocked ? '❔' : ach.icon;
    const meta = CATEGORY_META[ach.category];

    return (
      <div
        key={ach.id}
        className={`relative rounded-lg p-3 border transition-all ${
          isUnlocked
            ? 'bg-amber-950/30 border-amber-400/50 shadow-md shadow-amber-950/20'
            : 'bg-stone-900/40 border-stone-700/40'
        }`}
        style={isUnlocked ? {
          boxShadow: '0 0 0 1px rgba(251, 191, 36, 0.15), 0 4px 14px -2px rgba(251, 191, 36, 0.18)',
        } : undefined}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0 ring-1 ring-inset ring-white/5 ${
              isUnlocked
                ? 'bg-amber-900/40 border border-amber-400/40'
                : 'bg-stone-900/60 border border-stone-800/60'
            }`}
            style={isUnlocked ? { filter: 'none' } : { filter: 'grayscale(1) brightness(0.6)' }}
          >
            {displayIcon}
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`text-sm font-semibold ${
                  isUnlocked ? 'text-amber-200' : 'text-white/70'
                }`}
              >
                {displayName}
              </span>
              {isUnlocked ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-amber-400/60 text-amber-300 bg-amber-950/40"
                >
                  ✓ Unlocked
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 border-stone-600/60 text-white/40 bg-stone-900/40"
                >
                  🔒 Locked
                </Badge>
              )}
            </div>

            <div
              className={`text-xs leading-relaxed mb-2 ${
                isUnlocked ? 'text-white/75' : 'text-white/45'
              }`}
            >
              {displayDesc}
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  ach.category === 'secret'
                    ? 'border-purple-400/40 text-purple-300 bg-purple-950/30'
                    : 'border-stone-600/40 text-white/50 bg-stone-900/30'
                }`}
              >
                {meta.icon} {meta.label}
              </Badge>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-amber-400/80 font-semibold">+{ach.xpReward}</span>
                <span className="text-white/40">XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-[640px] max-w-[calc(100vw-2rem)] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/50 via-stone-950 to-stone-950 panel-ornamental-header">
            <div className="flex-1 min-w-0">
              <h3 className="text-amber-400 font-bold text-base flex items-center gap-2">
                <span className="text-lg">🏆</span> Achievements
              </h3>
              <div className="text-white/50 text-xs mt-0.5">
                {unlockedCount} of {totalCount} unlocked · {progressPct}% complete
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-stone-800/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => togglePanel('achievements')}
              className="close-btn-styled w-8 h-8 rounded-md bg-stone-800/40 text-white/60 flex items-center justify-center shrink-0"
              aria-label="Close Achievements"
            >
              ✕
            </button>
          </div>

          {/* Category tabs */}
          <div className="px-3 pt-3 pb-1 border-b border-stone-800/40">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="w-full">
              <TabsList className="w-full bg-stone-900/60 grid grid-cols-3 sm:grid-cols-6 h-9 gap-1">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="exploration" className="text-xs">🧭 Explore</TabsTrigger>
                <TabsTrigger value="social" className="text-xs">💬 Social</TabsTrigger>
                <TabsTrigger value="scholarship" className="text-xs">📚 Scholar</TabsTrigger>
                <TabsTrigger value="milestone" className="text-xs">🏅 Milestone</TabsTrigger>
                <TabsTrigger value="secret" className="text-xs">✨ Secret</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Scrollable content */}
          <ScrollArea className="max-h-[70vh]">
            <div className="p-3">
              {sortedAchievements.length === 0 ? (
                <div className="text-white/50 text-sm text-center py-12">
                  <div className="text-4xl mb-3 opacity-60">🏆</div>
                  <div className="text-white/70">No achievements in this category.</div>
                  <div className="text-xs mt-2 text-white/30">
                    Keep playing to discover more milestones.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sortedAchievements.map(renderCard)}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer — total XP from achievements */}
          <div className="px-4 py-3 border-t border-amber-400/20 bg-gradient-to-r from-stone-950 via-stone-950 to-amber-950/30 flex items-center justify-between">
            <div className="text-white/50 text-xs">
              <span className="text-amber-400/80 font-semibold">Achievement XP:</span>{' '}
              <span className="text-amber-300 font-bold">{totalXp}</span>
              <span className="text-white/30"> / {maxXp}</span>
            </div>
            <div className="text-white/40 text-[10px] italic">
              &ldquo;The journey of a thousand leagues begins with a single step.&rdquo;
            </div>
          </div>
    </div>
  );
}
