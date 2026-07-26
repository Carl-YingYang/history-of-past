'use client';

import { useGameStore } from '@/stores/gameStore';
import quests from '@/data/quests.json';
import { Progress } from '@/components/ui/progress';

export default function QuestTracker() {
  const { completedObjectives, chapterComplete, chapterPhase } = useGameStore();

  const currentQuest = quests.find(q => q.chapterId === 'ch1');

  if (!currentQuest || chapterComplete) return null;

  const completedCount = currentQuest.objectives.filter(obj =>
    completedObjectives.includes(obj.id)
  ).length;
  const totalCount = currentQuest.objectives.length;
  const progress = (completedCount / totalCount) * 100;

  // Phase label mapping for richer UI
  const phaseLabels: Record<string, string> = {
    'intro': 'Arrival',
    'explore': 'Exploring',
    'gossip': 'Listening',
    'ibarra-sighting': 'Morning',
    'complete': 'Complete',
  };
  const phaseLabel = phaseLabels[chapterPhase] || chapterPhase;

  return (
    <div className="absolute top-16 right-4 z-20 max-w-xs w-72 md:w-80">
      <div className="rounded-xl bg-stone-950/92 backdrop-blur-md border border-amber-400/30 p-3 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-400/20">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-amber-400/60 font-bold text-[9px] tracking-widest uppercase">Quest</span>
              <span className="text-white/30 text-[9px] uppercase tracking-wider">·</span>
              <span className="text-amber-400/50 text-[9px] uppercase tracking-wider">{phaseLabel}</span>
            </div>
            <div className="text-white text-sm font-semibold truncate" title={currentQuest.title}>
              {currentQuest.title}
            </div>
          </div>
          <div className="text-amber-400 font-mono text-xs ml-2 shrink-0 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-400/20">
            {completedCount}/{totalCount}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <Progress value={progress} className="h-1.5 bg-stone-800" />
        </div>

        {/* Objectives */}
        <div className="space-y-1.5">
          {currentQuest.objectives.map((obj, idx) => {
            const isCompleted = completedObjectives.includes(obj.id);
            const isCurrent = !isCompleted && completedObjectives.length === idx;
            return (
              <div
                key={obj.id}
                className={`flex items-start gap-2 text-xs p-1.5 rounded transition-all ${
                  isCurrent ? 'bg-amber-400/10 border border-amber-400/30 shadow-inner shadow-amber-900/20' : ''
                }`}
              >
                <span className={`mt-0.5 shrink-0 w-4 text-center ${
                  isCompleted ? 'text-emerald-400' : isCurrent ? 'text-amber-400 animate-pulse' : 'text-white/30'
                }`}>
                  {isCompleted ? '✓' : isCurrent ? '▶' : '○'}
                </span>
                <span className={`leading-snug ${
                  isCompleted
                    ? 'text-emerald-400/70 line-through'
                    : isCurrent
                      ? 'text-white/95'
                      : 'text-white/50'
                }`}>
                  {obj.description}
                </span>
              </div>
            );
          })}
        </div>

        {/* Learning objective hint */}
        <div className="mt-3 pt-2 border-t border-amber-400/10">
          <div className="text-amber-400/40 text-[9px] uppercase tracking-widest mb-1 font-semibold">
            💡 Learning Goal
          </div>
          <div className="text-white/55 text-[10px] italic leading-relaxed">
            {currentQuest.learningObjective}
          </div>
        </div>

        {/* Reward preview */}
        <div className="mt-2 pt-2 border-t border-amber-400/10 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400/60">Reward:</span>
            <span className="text-amber-400">⭐ 60 XP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400/60">+</span>
            <span className="text-emerald-400">🏅 Medal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
