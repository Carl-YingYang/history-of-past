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
  silhouette: string;
}> = {
  'Mang Tenyo': {
    color: '#D2691E',
    accent: '#F4A460',
    emoji: '👴',
    bg: 'bg-amber-900/60',
    role: 'Cart Driver',
    gradient: 'radial-gradient(circle at 35% 35%, #F4A460 0%, #D2691E 60%, #8B4513 100%)',
    silhouette: 'M16 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm-8 16c0-4.4 3.6-8 8-8s8 3.6 8 8v2H8v-2z',
  },
  'Aling Nena': {
    color: '#CD853F',
    accent: '#FFD89B',
    emoji: '👩‍🍳',
    bg: 'bg-orange-900/60',
    role: 'Kitchen Staff',
    gradient: 'radial-gradient(circle at 35% 35%, #FFD89B 0%, #CD853F 60%, #8B5A2B 100%)',
    silhouette: 'M16 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-8 14c0-4.4 3.6-8 8-8s8 3.6 8 8v2H8v-2z',
  },
  'Mang Andres': {
    color: '#A0522D',
    accent: '#E8B579',
    emoji: '🧑‍🍳',
    bg: 'bg-stone-800/60',
    role: 'Kitchen Staff',
    gradient: 'radial-gradient(circle at 35% 35%, #E8B579 0%, #A0522D 60%, #5C3317 100%)',
    silhouette: 'M16 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm-8 16c0-4.4 3.6-8 8-8s8 3.6 8 8v2H8v-2z',
  },
  'Narrator': {
    color: '#9CA3AF',
    accent: '#E5E7EB',
    emoji: '📜',
    bg: 'bg-stone-900/60',
    role: 'Storyteller',
    gradient: 'radial-gradient(circle at 35% 35%, #E5E7EB 0%, #9CA3AF 60%, #4B5563 100%)',
    silhouette: 'M4 4h24v2H4zm0 6h24v2H4zm0 6h16v2H4zm0 6h20v2H4z',
  },
  'Crisóstomo Ibarra': {
    color: '#FFD700',
    accent: '#FFFACD',
    emoji: '🎩',
    bg: 'bg-yellow-900/40',
    role: 'Ilustrado · Just returned from Europe',
    gradient: 'radial-gradient(circle at 35% 35%, #FFFACD 0%, #FFD700 60%, #B8860B 100%)',
    silhouette: 'M16 4c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-9 15c0-4.4 3.6-8 8-8s8 3.6 8 8v3H7v-3zm12 0v1h4v-1c0-2.2-1.8-4-4-4s-4 1.8-4 4z',
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
    silhouette: 'M16 6c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm-8 16c0-4.4 3.6-8 8-8s8 3.6 8 8v2H8v-2z',
  };
}

export default function DialogueBox() {
  const {
    dialogueActive,
    currentLine,
    currentLineIndex,
    totalLines,
    dialogueId,
    introVisible,
    chapterPhase,
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

  // Hide dialogue box when intro screen is visible, or when an overlay panel is open
  if (!dialogueActive || !currentLine || activePanel !== null || introVisible) return null;

  const speakerStyle = getSpeakerStyle(currentLine.speaker);

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[min(680px,calc(100vw-2rem))]"
      onClick={handleAdvance}
      role="button"
      aria-label="Dialogue — click to advance"
    >
      {/* Animated golden shimmer border glow — an outer wrapper with a pulsing glow */}
      <div className="relative rounded-xl animate-border-shimmer">
        {/* Inner dialogue card */}
        <div
          className={`relative rounded-xl shadow-2xl border-2 backdrop-blur-md transition-all ${
            isNarrator
              ? 'bg-gradient-to-br from-amber-950/95 to-stone-950/95 border-amber-400/50 text-amber-100'
              : 'bg-stone-950/95 border-stone-600/50 text-white'
          }`}
        >
          {/* Filipino-themed watermark pattern (subtle background overlay) */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl overflow-hidden"
            style={{
              backgroundImage: `
                repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 20px,
                  rgba(251,191,36,0.4) 20px,
                  rgba(251,191,36,0.4) 21px
                ),
                repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 20px,
                  rgba(251,191,36,0.4) 20px,
                  rgba(251,191,36,0.4) 21px
                )
              `,
            }}
          />
          {/* Filipino sun watermark — center */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.04]">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="20" fill="rgba(251,191,36,0.6)" />
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <line
                  key={i}
                  x1="60"
                  y1="60"
                  x2={60 + 50 * Math.cos((i * 45 - 90) * Math.PI / 180)}
                  y2={60 + 50 * Math.sin((i * 45 - 90) * Math.PI / 180)}
                  stroke="rgba(251,191,36,0.6)"
                  strokeWidth="2"
                />
              ))}
            </svg>
          </div>

          {/* Corner flourish decorations (all 4 corners) */}
          <div className="absolute top-2 left-4 text-[10px] text-amber-400/60 select-none">✦</div>
          <div className="absolute top-2 right-4 text-[10px] text-amber-400/60 select-none">✦</div>
          <div className="absolute bottom-2 left-4 text-[10px] text-amber-400/60 select-none">✦</div>
          <div className="absolute bottom-2 right-4 text-[10px] text-amber-400/60 select-none">✦</div>

          <div className="flex gap-3 p-4">
            {/* Speaker portrait with silhouette SVG shape */}
            <div className="shrink-0 flex flex-col items-center gap-1">
              <div
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-2 shadow-lg overflow-hidden"
                style={{
                  background: speakerStyle.gradient,
                  borderColor: speakerStyle.accent,
                  boxShadow: `0 0 18px ${speakerStyle.color}50, 0 4px 10px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.25)`,
                }}
              >
                {/* SVG silhouette shape */}
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="white"
                  className="opacity-80"
                >
                  <path d={speakerStyle.silhouette} />
                </svg>
                {/* Emoji overlay for character identity (smaller, positioned top-right) */}
                <span className="absolute -top-1 -right-1 text-sm bg-stone-950/80 rounded-full px-0.5">
                  {isNarrator ? '📜' : speakerStyle.emoji}
                </span>
                {/* Small decorative dot indicator */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-stone-950"
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

              {/* Translation section with enhanced toggle */}
              {currentLine.translation && (
                <div className="flex items-start gap-2 mt-2 min-h-[1.5em]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTranslation(!showTranslation);
                    }}
                    className={`shrink-0 text-[10px] px-2 py-1 rounded-md transition-all duration-200 font-semibold tracking-wide ${
                      showTranslation
                        ? 'bg-amber-500/20 border border-amber-400/60 text-amber-300 shadow-sm shadow-amber-400/20 hover:bg-amber-500/30 hover:border-amber-400/80'
                        : 'bg-stone-800/40 border border-white/15 text-white/40 hover:bg-amber-950/30 hover:text-white/60 hover:border-amber-400/30'
                    }`}
                    aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
                  >
                    🇵🇭 {showTranslation ? 'EN' : 'Toggle'}
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

              {/* Chapter phase indicator at bottom */}
              <div className="flex items-center justify-center gap-1.5 mt-2 pt-1.5 border-t border-white/5">
                <span className="text-[9px] text-amber-400/40 uppercase tracking-widest font-medium">
                  Chapter 1
                </span>
                <span className="text-[9px] text-white/25">·</span>
                <span className="text-[9px] text-amber-400/50 uppercase tracking-wider font-semibold">
                  {chapterPhase === 'intro' ? 'Arrival' : chapterPhase === 'exploration' ? 'Exploration' : chapterPhase === 'complete' ? 'Complete' : chapterPhase}
                </span>
                <span className="text-[9px] text-white/25">·</span>
                <span className="text-[9px] text-white/30 italic" style={{ fontFamily: 'Georgia, serif' }}>
                  Noli Me Tangere
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
