'use client';

import { useGameStore } from '@/stores/gameStore';
import { gameEvents } from '@/lib/game/eventBus';

export default function DialogueBox() {
  const {
    dialogueActive,
    currentLine,
    currentLineIndex,
    totalLines,
    dialogueId,
  } = useGameStore();

  if (!dialogueActive || !currentLine) return null;

  const isNarrator = currentLine.speaker === 'Narrator';
  const isLastLine = currentLineIndex >= totalLines - 1;

  const handleAdvance = () => {
    gameEvents.emit('dialogue:advance');
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 z-30" onClick={handleAdvance}>
      <div className={`rounded-xl p-4 shadow-2xl border-2 max-w-3xl mx-auto transition-all ${
        isNarrator 
          ? 'bg-amber-900/95 border-amber-400/50 text-amber-100' 
          : 'bg-stone-900/95 border-stone-500/50 text-white'
      }`}>
        {/* Speaker name */}
        {!isNarrator && (
          <div className="mb-2">
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${
              currentLine.speaker.includes('Tenyo') 
                ? 'bg-amber-700 text-amber-100' 
                : currentLine.speaker.includes('Vendor') 
                  ? 'bg-stone-600 text-stone-100'
                  : 'bg-emerald-700 text-emerald-100'
            }`}>
              {currentLine.speaker}
            </span>
          </div>
        )}

        {/* Dialogue text */}
        <div className="text-base leading-relaxed mb-2" style={{ fontFamily: '"Geist", sans-serif' }}>
          {currentLine.text}
        </div>

        {/* Translation hint (if present) */}
        {currentLine.translation && (
          <div className="text-sm text-white/50 italic mt-1">
            📝 {currentLine.translation}
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            {Array.from({ length: totalLines }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                i <= currentLineIndex ? 'bg-amber-400' : 'bg-white/20'
              }`} />
            ))}
          </div>
          <span className="text-xs text-white/40 animate-pulse">
            {isLastLine ? '[Click to close]' : '[Click to continue]'}
          </span>
        </div>
      </div>
    </div>
  );
}
