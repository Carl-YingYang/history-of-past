'use client';

import { useUIStore } from './UIManager';
import { useGameStore } from '@/stores/gameStore';

/**
 * HelpPanel - Tutorial / Controls overlay.
 * Triggered by pressing H or clicking the "?" button.
 * Shows controls, objectives, and contextual hints based on chapter phase.
 */
export default function HelpPanel() {
  const { activePanel, togglePanel } = useUIStore();
  const { chapterPhase, completedObjectives } = useGameStore();
  const isOpen = activePanel === 'help';

  // Build contextual hint based on chapter phase
  const getContextualHint = () => {
    const followTenyo = completedObjectives.includes('obj.ch1.follow_tenyo');
    const gossip = completedObjectives.includes('obj.ch1.overhear_gossip');
    const seenIbarra = completedObjectives.includes('obj.ch1.see_ibarra');

    if (!followTenyo) {
      return {
        title: '🎯 Current Goal',
        body: 'Walk up to Mang Tenyo (south of the plaza) and press Space or 💬 to talk. He\'ll show you around town.',
      };
    }
    if (!gossip) {
      return {
        title: '🎯 Current Goal',
        body: 'Head to the Market / Stalls area (southwest of the plaza). Walk into the gossip zone — you\'ll overhear the kitchen staff talking about last night\'s reception.',
      };
    }
    if (!seenIbarra) {
      return {
        title: '🎯 Current Goal',
        body: 'Walk to the center of the plaza. The next morning, you\'ll see Crisóstomo Ibarra crossing the square.',
      };
    }
    return {
      title: '🎯 Current Goal',
      body: 'Take the end-of-chapter quiz to test what you\'ve learned. Pass it to earn the Listener medal and unlock 3 Codex entries.',
    };
  };

  const hint = getContextualHint();

  const controls = [
    { keys: ['W', 'A', 'S', 'D'], desc: 'Move (8-directional)' },
    { keys: ['↑', '↓', '←', '→'], desc: 'Move (arrow keys)' },
    { keys: ['Space'], desc: 'Talk to NPC / Advance dialogue' },
    { keys: ['C'], desc: 'Open Codex — characters, places, concepts' },
    { keys: ['J'], desc: 'Open Journal — your observations' },
    { keys: ['G'], desc: 'Open Glossary — Filipino terms' },
    { keys: ['A'], desc: 'Open Achievements — your milestones' },
    { keys: ['L'], desc: 'Open Story Log — chronological events' },
    { keys: ['M'], desc: 'Open Map — minimap of San Diego' },
    { keys: ['S'], desc: 'Open Settings — sound, reset' },
    { keys: ['H', '?'], desc: 'Open this Help' },
    { keys: ['Esc'], desc: 'Close any panel' },
  ];

  const tips = [
    { icon: '💡', text: 'Click anywhere on the dialogue box to advance text. Click during typing to skip the typewriter effect.' },
    { icon: '📖', text: 'The Codex records every character, place, and concept you discover. Entries unlock progressively as you meet people and overhear conversations.' },
    { icon: '📔', text: 'Your Journal auto-records key observations after each dialogue — read it later to review the story.' },
    { icon: '🗣️', text: 'The Glossary explains Filipino words used in dialogue. Hover or open it whenever you see a word you don\'t recognize.' },
    { icon: '🏆', text: 'Achievements track milestones beyond chapter medals — explore, talk to everyone, open every panel to earn them all.' },
    { icon: '📜', text: 'The Story Log records every major event in order — useful if you step away and need to remember what just happened.' },
    { icon: '🗺️', text: 'Use the Map to orient yourself. Orange dots are NPCs; the gold dot is Ibarra (when visible).' },
    { icon: '⭐', text: 'Earn XP by completing objectives. Each chapter awards 60 XP plus a medal.' },
  ];

  return (
    <>
      {/* Help "?" button */}
      <button
        onClick={() => togglePanel('help')}
        className={`absolute bottom-4 right-24 z-20 w-10 h-10 rounded-lg border flex items-center justify-center shadow-lg transition-all hover:scale-105 ${
          isOpen
            ? 'bg-amber-900/80 border-amber-400/60'
            : 'bg-stone-900/90 border-amber-400/30 hover:bg-stone-800/90'
        }`}
        title="Help (H)"
        aria-label="Open help"
      >
        <span className="text-amber-400 text-base font-bold">?</span>
      </button>

      {isOpen && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[480px] max-w-[calc(100vw-2rem)] max-h-[85vh] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-stone-950 to-stone-950">
            <div>
              <h3 className="text-amber-400 font-bold text-base flex items-center gap-2">
                <span className="text-lg">❓</span> How to Play
              </h3>
              <div className="text-white/40 text-xs mt-0.5">Project Noor — A Stranger in San Diego</div>
            </div>
            <button
              onClick={() => togglePanel('help')}
              className="w-8 h-8 rounded-md hover:bg-stone-800 text-white/60 hover:text-white flex items-center justify-center"
              aria-label="Close help"
            >
              ✕
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto p-4 space-y-4">
            {/* Contextual hint */}
            <div className="rounded-lg p-3 bg-amber-950/30 border border-amber-400/40">
              <div className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">
                {hint.title}
              </div>
              <div className="text-white/80 text-sm leading-relaxed">
                {hint.body}
              </div>
              <div className="mt-2 text-[10px] text-white/40 uppercase tracking-widest">
                Phase: {chapterPhase}
              </div>
            </div>

            {/* Controls */}
            <div>
              <h4 className="text-amber-400/80 text-xs uppercase tracking-widest font-semibold mb-2 flex items-center gap-2">
                <span>🎮</span> Controls
              </h4>
              <div className="rounded-lg border border-stone-800/50 bg-stone-900/40 divide-y divide-stone-800/40">
                {controls.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-white/70">{c.desc}</span>
                    <div className="flex gap-1">
                      {c.keys.map((k, j) => (
                        <kbd
                          key={j}
                          className="min-w-[24px] px-1.5 h-6 rounded bg-stone-800 border border-stone-700/60 text-amber-400 text-[10px] font-mono flex items-center justify-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div>
              <h4 className="text-amber-400/80 text-xs uppercase tracking-widest font-semibold mb-2 flex items-center gap-2">
                <span>💡</span> Tips
              </h4>
              <div className="space-y-2">
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-white/70 leading-relaxed p-2 rounded hover:bg-stone-900/40 transition-colors">
                    <span className="text-sm shrink-0">{tip.icon}</span>
                    <span>{tip.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* About */}
            <div className="pt-3 border-t border-amber-400/20 text-center">
              <div className="text-white/40 text-xs italic">
                &ldquo;A novel about the Philippines… a mirror in which to see ourselves.&rdquo;
              </div>
              <div className="text-amber-400/40 text-[10px] mt-1">— José Rizal, on Noli Me Tangere</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
