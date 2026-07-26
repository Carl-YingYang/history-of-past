'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { gameEvents } from '@/lib/game/eventBus';
import { soundManager } from '@/lib/game/soundManager';

export default function DialogueBox() {
  const {
    dialogueActive,
    currentLine,
    currentLineIndex,
    totalLines,
    dialogueId,
  } = useGameStore();

  const [displayedText, setDisplayedText] = useState('');
  const [displayedTranslation, setDisplayedTranslation] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  const isNarrator = currentLine?.speaker === 'Narrator';
  const isLastLine = currentLineIndex >= totalLines - 1;

  // Typewriter effect
  useEffect(() => {
    if (!currentLine) {
      setDisplayedText('');
      setDisplayedTranslation('');
      setIsComplete(false);
      return;
    }

    // Reset
    setDisplayedText('');
    setDisplayedTranslation('');
    setIsComplete(false);
    setIsTyping(true);

    const fullText = currentLine.text;
    const fullTranslation = currentLine.translation || '';
    let charIdx = 0;

    // Clear any existing timer
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
    }

    // Type out the main text
    typewriterRef.current = setInterval(() => {
      if (charIdx < fullText.length) {
        setDisplayedText(fullText.substring(0, charIdx + 1));
        charIdx++;
        // Subtle typing sound every few chars
        if (charIdx % 3 === 0) {
          soundManager.play('dialogue-advance');
        }
      } else {
        // Main text done, type translation
        clearInterval(typewriterRef.current);
        typewriterRef.current = null;

        if (fullTranslation) {
          let transIdx = 0;
          typewriterRef.current = setInterval(() => {
            if (transIdx < fullTranslation.length) {
              setDisplayedTranslation(fullTranslation.substring(0, transIdx + 1));
              transIdx++;
            } else {
              clearInterval(typewriterRef.current);
              typewriterRef.current = null;
              setIsTyping(false);
              setIsComplete(true);
            }
          }, 15);
        } else {
          setIsTyping(false);
          setIsComplete(true);
        }
      }
    }, 25);

    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
    };
  }, [currentLine]);

  const handleAdvance = () => {
    // If still typing, skip to end of text
    if (isTyping) {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
      setDisplayedText(currentLine?.text || '');
      setDisplayedTranslation(currentLine?.translation || '');
      setIsTyping(false);
      setIsComplete(true);
      return;
    }
    gameEvents.emit('dialogue:advance');
  };

  if (!dialogueActive || !currentLine) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-30" onClick={handleAdvance}>
      <div className={`rounded-xl p-4 shadow-2xl border-2 max-w-3xl mx-auto transition-all backdrop-blur-sm ${
        isNarrator
          ? 'bg-amber-950/95 border-amber-400/50 text-amber-100'
          : 'bg-stone-950/95 border-stone-500/50 text-white'
      }`}>
        {/* Speaker name */}
        {!isNarrator && (
          <div className="mb-2 flex items-center gap-2">
            <span className={`text-sm font-bold px-3 py-1 rounded-full shadow-md ${
              currentLine.speaker.includes('Tenyo')
                ? 'bg-amber-700 text-amber-100'
                : currentLine.speaker.includes('Vendor')
                  ? 'bg-stone-600 text-stone-100'
                  : 'bg-emerald-700 text-emerald-100'
            }`}>
              {currentLine.speaker}
            </span>
            {/* Decorative line */}
            <div className="flex-1 h-px bg-gradient-to-r from-amber-400/30 to-transparent" />
          </div>
        )}

        {/* Dialogue text with typewriter effect */}
        <div className="text-base leading-relaxed mb-1 min-h-[3em]" style={{ fontFamily: '"Geist", Georgia, serif' }}>
          {displayedText}
          {isTyping && <span className="inline-block w-2 h-4 bg-amber-400 ml-0.5 animate-pulse" />}
        </div>

        {/* Translation hint (if present) */}
        {currentLine.translation && (
          <div className="text-sm text-white/50 italic mt-2 min-h-[1.5em] border-l-2 border-amber-400/30 pl-2">
            {displayedTranslation && <>📝 {displayedTranslation}</>}
          </div>
        )}

        {/* Progress indicator and hint */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
          <div className="flex gap-1">
            {Array.from({ length: totalLines }).map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${
                i < currentLineIndex ? 'bg-amber-400/50'
                  : i === currentLineIndex ? 'bg-amber-400 scale-125'
                  : 'bg-white/20'
              }`} />
            ))}
          </div>
          <span className="text-xs text-white/40 animate-pulse">
            {isTyping ? '[Click to skip]' : isLastLine ? '[Click to close]' : '[Click to continue]'}
          </span>
        </div>
      </div>
    </div>
  );
}
