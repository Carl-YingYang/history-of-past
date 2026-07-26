'use client';

import { useGameStore } from '@/stores/gameStore';
import quests from '@/data/quests.json';

export default function QuestTracker() {
  const { completedObjectives, chapterComplete } = useGameStore();

  const currentQuest = quests.find(q => q.chapterId === 'ch1');

  if (!currentQuest || chapterComplete) return null;

  return (
    <div className="absolute top-4 right-4 z-20 max-w-xs">
      <div className="rounded-lg bg-stone-900/90 border border-amber-400/30 p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-amber-400 font-bold text-xs tracking-wider uppercase">Quest</span>
          <span className="text-white text-sm font-semibold">{currentQuest.title}</span>
        </div>
        <div className="space-y-2">
          {currentQuest.objectives.map((obj) => {
            const isCompleted = completedObjectives.includes(obj.id);
            return (
              <div key={obj.id} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 ${isCompleted ? 'text-emerald-400' : 'text-white/30'}`}>
                  {isCompleted ? '✓' : '○'}
                </span>
                <span className={`${isCompleted ? 'text-emerald-400' : 'text-white/70'} ${isCompleted ? 'line-through' : ''}`}>
                  {obj.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
