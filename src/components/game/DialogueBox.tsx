'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from './UIManager';
import { gameEvents } from '@/lib/game/eventBus';
import { soundManager } from '@/lib/game/soundManager';

// Speaker color/avatar configuration
const SPEAKER_STYLES: Record<string, { color: string; emoji: string; bg: string }> = {
  'Mang Tenyo':          { color: '#D2691E', emoji: '👴', bg: 'bg-amber-900/60' },
  'Aling Nena':          { color: '#CD853F', emoji: '👩‍🍳', bg: 'bg-orange-900/60' },
  'Mang Andres':         { color: '#A0522D', emoji: '🧑‍🍳', bg: 'bg-stone-800/60' },
  'Narrator':            { color: '#9CA3AF', emoji: '📜', bg: 'bg-stone-900/60' },
  'Crisóstomo Ibarra':   { color: '#FFD700', emoji: '🎩', bg: 'bg-yellow-900/40' },
};

function getSpeakerStyle(speaker: string) {
  return SPEAKER_STYLES[speaker] || { color: '#8B7355', emoji: '🗣️', bg: 'bg-stone-800/60' };
}

export default function DialogueBox() {
  const {
    dialogueActive,
    currentLine,
    currentLineIndex,
    totalLines,
    dialogueId,
  } = useGameStore();
  const { activePanel } = useUIStore();

  const [displayedText, setDisplayedText] = useState('');
  const [displayedTranslation, setDisplayedTranslation] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  const isNarrator = currentLine?.speaker === 'Narrator';
  const isLastLine = currentLineIndex >= totalLines - 1;

  // Tag body so keyboard shortcuts pause while dialogue is open
  useEffect(() => {
    if (dialogueActive) {
      document.body.setAttribute('data-noor-dialogue-active', 'true');
    } else {
      document.body.removeAttribute('data-noor-dialogue-active');
    }
    return () => {
      document.body.removeAttribute('data-noor-dialogue-active');
    };
  }, [dialogueActive]);

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

  // Hide dialogue box entirely if an overlay panel is open (Codex/Journal/etc.)
  if (!dialogueActive || !currentLine || activePanel !== null) return null;

  const speakerStyle = getSpeakerStyle(currentLine.speaker);

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[min(680px,calc(100vw-2rem))]"
      onClick={handleAdvance}
      role="button"
      aria-label="Dialogue — click to advance"
    >
      <div
        className={`rounded-xl shadow-2xl border-2 backdrop-blur-md transition-all ${
          isNarrator
            ? 'bg-gradient-to-br from-amber-950/95 to-stone-950/95 border-amber-400/50 text-amber-100'
            : 'bg-stone-950/95 border-stone-600/50 text-white'
        }`}
      >
        <div className="flex gap-3 p-4">
          {/* Speaker avatar */}
          <div
            className="shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 shadow-inner"
            style={{
              backgroundColor: speakerStyle.color + '30',
              borderColor: speakerStyle.color,
              boxShadow: `0 0 14px ${speakerStyle.color}40 inset, 0 2px 6px rgba(0,0,0,0.4)`,
            }}
          >
            {isNarrator ? '📜' : speakerStyle.emoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Speaker name */}
            {!isNarrator && (
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full shadow-md text-white"
                  style={{ backgroundColor: speakerStyle.color }}
                >
                  {currentLine.speaker}
                </span>
                {/* Decorative line */}
                <div className="flex-1 h-px bg-gradient-to-r from-amber-400/40 to-transparent" />
              </div>
            )}

            {/* Dialogue text with typewriter effect */}
            <div className="text-base leading-relaxed mb-1 min-h-[3em]" style={{ fontFamily: '"Geist", Georgia, serif' }}>
              {displayedText}
              {isTyping && <span className="inline-block w-2 h-4 bg-amber-400 ml-0.5 animate-pulse align-middle" />}
            </div>

            {/* Translation hint (if present) */}
            {currentLine.translation && (
              <div className="text-sm text-white/55 italic mt-2 min-h-[1.5em] border-l-2 border-amber-400/40 pl-2 leading-relaxed">
                {displayedTranslation && <>📝 {displayedTranslation}</>}
              </div>
            )}

            {/* Progress indicator and hint */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
              <div className="flex gap-1">
                {Array.from({ length: totalLines }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i < currentLineIndex ? 'bg-amber-400/60'
                        : i === currentLineIndex ? 'bg-amber-400 scale-125 shadow shadow-amber-400/50'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                {isTyping && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdvance();
                    }}
                    className="text-[10px] text-amber-400/70 hover:text-amber-300 px-2 py-0.5 rounded border border-amber-400/30 hover:border-amber-400/60 hover:bg-amber-950/40 transition-colors"
                    aria-label="Skip typing"
                  >
                    ⏭ Skip text
                  </button>
                )}
                <span className="text-[10px] text-white/50 animate-pulse font-medium">
                  {isTyping ? '[Click to skip]' : isLastLine ? '[Click to close]' : '[Click to continue]'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
