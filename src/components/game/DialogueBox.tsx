'use client';

import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useUIStore } from './UIManager';
import { gameEvents } from '@/lib/game/eventBus';
import { soundManager } from '@/lib/game/soundManager';

// Speaker color/avatar configuration
// Each speaker has a primary color, accent, emoji, role label, and CSS background gradient
// for a richer portrait than a plain colored circle.
const SPEAKER_STYLES: Record<string, {
  color: string;
  accent: string;
  emoji: string;
  bg: string;
  role: string;
  gradient: string;
}> = {
  'Mang Tenyo': {
    color: '#D2691E',
    accent: '#F4A460',
    emoji: '👴',
    bg: 'bg-amber-900/60',
    role: 'Cart Driver',
    gradient: 'radial-gradient(circle at 35% 35%, #F4A460 0%, #D2691E 60%, #8B4513 100%)',
  },
  'Aling Nena': {
    color: '#CD853F',
    accent: '#FFD89B',
    emoji: '👩‍🍳',
    bg: 'bg-orange-900/60',
    role: 'Kitchen Staff',
    gradient: 'radial-gradient(circle at 35% 35%, #FFD89B 0%, #CD853F 60%, #8B5A2B 100%)',
  },
  'Mang Andres': {
    color: '#A0522D',
    accent: '#E8B579',
    emoji: '🧑‍🍳',
    bg: 'bg-stone-800/60',
    role: 'Kitchen Staff',
    gradient: 'radial-gradient(circle at 35% 35%, #E8B579 0%, #A0522D 60%, #5C3317 100%)',
  },
  'Narrator': {
    color: '#9CA3AF',
    accent: '#E5E7EB',
    emoji: '📜',
    bg: 'bg-stone-900/60',
    role: 'Storyteller',
    gradient: 'radial-gradient(circle at 35% 35%, #E5E7EB 0%, #9CA3AF 60%, #4B5563 100%)',
  },
  'Crisóstomo Ibarra': {
    color: '#FFD700',
    accent: '#FFFACD',
    emoji: '🎩',
    bg: 'bg-yellow-900/40',
    role: 'Ilustrado · Just returned from Europe',
    gradient: 'radial-gradient(circle at 35% 35%, #FFFACD 0%, #FFD700 60%, #B8860B 100%)',
  },
};

function getSpeakerStyle(speaker: string) {
  return SPEAKER_STYLES[speaker] || {
    color: '#8B7355',
    accent: '#C9B498',
    emoji: '🗣️',
    bg: 'bg-stone-800/60',
    role: 'Townsperson',
    gradient: 'radial-gradient(circle at 35% 35%, #C9B498 0%, #8B7355 60%, #5C4033 100%)',
  };
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
  const [showTranslation, setShowTranslation] = useState(true);
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
        className={`relative rounded-xl shadow-2xl border-2 backdrop-blur-md transition-all corner-flourish parchment-texture ${
          isNarrator
            ? 'bg-gradient-to-br from-amber-950/95 to-stone-950/95 border-amber-400/50 text-amber-100'
            : 'bg-stone-950/95 border-stone-600/50 text-white'
        }`}
      >
        {/* Corner flourish decorations (all 4 corners) */}
        <div className="absolute top-2 left-4 text-[10px] text-amber-400/60 select-none">✦</div>
        <div className="absolute top-2 right-4 text-[10px] text-amber-400/60 select-none">✦</div>
        <div className="absolute bottom-2 left-4 text-[10px] text-amber-400/60 select-none">✦</div>
        <div className="absolute bottom-2 right-4 text-[10px] text-amber-400/60 select-none">✦</div>

        <div className="flex gap-3 p-4">
          {/* Speaker portrait with gradient background and decorative ring */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 shadow-lg"
              style={{
                background: speakerStyle.gradient,
                borderColor: speakerStyle.accent,
                boxShadow: `0 0 18px ${speakerStyle.color}50, 0 4px 10px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.25)`,
              }}
            >
              {isNarrator ? '📜' : speakerStyle.emoji}
              {/* Small decorative dot indicator (top-right of portrait) */}
              <div
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border border-stone-950"
                style={{ backgroundColor: speakerStyle.accent }}
              />
            </div>
            {/* Speaker role / title under portrait */}
            {!isNarrator && (
              <div
                className="text-[9px] uppercase tracking-wider font-semibold text-center max-w-[80px] leading-tight"
                style={{ color: speakerStyle.accent }}
              >
                {speakerStyle.role}
              </div>
            )}
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
              {isTyping && <span className="inline-block w-2 h-4 bg-amber-400 ml-0.5 animate-cursor-blink align-middle" />}
            </div>

            {/* Translation section with toggle */}
            {currentLine.translation && (
              <div className="flex items-start gap-1 mt-2 min-h-[1.5em]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTranslation(!showTranslation);
                  }}
                  className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border transition-colors hover:bg-amber-950/40 mt-0.5"
                  style={{
                    borderColor: showTranslation ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.2)',
                    color: showTranslation ? 'rgba(251,191,36,0.8)' : 'rgba(255,255,255,0.4)',
                  }}
                  aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
                >
                  {showTranslation ? '🇵🇭 EN' : '🇵🇭'}
                </button>
                {showTranslation && displayedTranslation && (
                  <div className="text-sm text-white/55 italic border-l-2 border-amber-400/40 pl-2 leading-relaxed">
                    📝 {displayedTranslation}
                  </div>
                )}
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
                        : i === currentLineIndex ? 'bg-amber-400 scale-125 animate-dot-glow'
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
