'use client';

import { useGameStore } from '@/stores/gameStore';
import quests from '@/data/quests.json';
import { Progress } from '@/components/ui/progress';

export default function QuestTracker() {
  const { completedObjectives, chapterComplete } = useGameStore();

  const currentQuest = quests.find(q => q.chapterId === 'ch1');

  if (!currentQuest || chapterComplete) return null;

  const completedCount = currentQuest.objectives.filter(obj =>
    completedObjectives.includes(obj.id)
  ).length;
  const totalCount = currentQuest.objectives.length;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="absolute top-4 right-4 z-20 max-w-xs w-72">
      <div className="rounded-xl bg-stone-950/90 backdrop-blur-sm border border-amber-400/30 p-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-amber-400/20">
          <div>
            <div className="text-amber-400/60 font-bold text-[10px] tracking-widest uppercase">Quest</div>
            <div className="text-white text-sm font-semibold">{currentQuest.title}</div>
          </div>
          <div className="text-amber-400/60 text-xs font-mono">
            {completedCount}/{totalCount}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <Progress value={progress} className="h-1.5 bg-stone-800" />
        </div>

        {/* Objectives */}
        <div className="space-y-2">
          {currentQuest.objectives.map((obj, idx) => {
            const isCompleted = completedObjectives.includes(obj.id);
            const isCurrent = !isCompleted && completedObjectives.length === idx;
            return (
              <div
                key={obj.id}
                className={`flex items-start gap-2 text-xs p-1.5 rounded transition-all ${
                  isCurrent ? 'bg-amber-400/10 border border-amber-400/20' : ''
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${
                  isCompleted ? 'text-emerald-400' : isCurrent ? 'text-amber-400 animate-pulse' : 'text-white/30'
                }`}>
                  {isCompleted ? '✓' : isCurrent ? '▶' : '○'}
                </span>
                <span className={`${
                  isCompleted
                    ? 'text-emerald-400/80 line-through'
                    : isCurrent
                      ? 'text-white/90'
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
          <div className="text-white/40 text-[10px] italic">
            💡 {currentQuest.learningObjective}
          </div>
        </div>
      </div>
    </div>
  );
}
