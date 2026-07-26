'use client';

import { useState } from 'react';
import { useUIStore } from './UIManager';
import { useGameStore } from '@/stores/gameStore';

/**
 * HelpPanel - Tutorial / Controls / About the Novel overlay.
 * Triggered by pressing H or clicking the Help button in the Toolbar.
 * Shows controls, objectives, contextual hints, and an "About the Novel"
 * section with historical context about José Rizal and Noli Me Tangere.
 */
export default function HelpPanel() {
  const { activePanel, togglePanel } = useUIStore();
  const { chapterPhase, completedObjectives } = useGameStore();
  const isOpen = activePanel === 'help';
  const [activeSection, setActiveSection] = useState<'guide' | 'about'>('guide');

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
    { icon: '🗣️', text: 'The Glossary explains Filipino words used in dialogue. Open it whenever you see a word you don\'t recognize.' },
    { icon: '🏆', text: 'Achievements track milestones beyond chapter medals — explore, talk to everyone, open every panel to earn them all.' },
    { icon: '📜', text: 'The Story Log records every major event in order — useful if you step away and need to remember what just happened.' },
    { icon: '🗺️', text: 'Use the Map to orient yourself. Orange dots are NPCs; the gold dot is Ibarra (when visible).' },
    { icon: '⭐', text: 'Earn XP by completing objectives. Each chapter awards 60 XP plus a medal.' },
  ];

  // About the Novel — historical context about José Rizal and Noli Me Tangere
  const novelInfo = {
    title: 'Noli Me Tangere',
    author: 'José Protasio Rizal',
    year: 1887,
    language: 'Spanish',
    setting: 'Philippines, 1880s — Spanish colonial era',
    synopsis: 'The novel follows Crisóstomo Ibarra, a young Filipino who returns home after seven years studying in Europe. His idealistic hopes for reform collide with the entrenched power of the Spanish friars — especially Padre Dámaso, who had persecuted Ibarra\'s late father. Through Ibarra\'s journey, Rizal exposes the corruption, abuse, and social injustice of colonial Philippine society.',
    significance: [
      'Published in Berlin, 1887 — the first novel by a Filipino to expose Spanish colonial abuses',
      'Banned in the Philippines but circulated secretly, becoming a catalyst for the reform movement',
      'Its sequel, El Filibusterismo (1891), continues Ibarra\'s story under the alias "Simoun"',
      'Rizal was executed by firing squad on December 30, 1896 — his death catalyzed the Philippine Revolution',
      'Rizal is now the national hero of the Philippines; December 30 is a national holiday (Rizal Day)',
    ],
    historicalContext: 'The Philippines was under Spanish colonial rule for 333 years (1565–1898). Catholic friar orders — Dominicans, Franciscans, Augustinians — held enormous power: they controlled education, land ownership, and local governance. The ilustrados (educated Filipino class) who studied in Europe brought back reformist ideas that challenged this authority. Rizal\'s novels were the most powerful literary expression of this challenge.',
    aboutRizal: 'José Rizal (1861–1896) was a polymath: novelist, poet, ophthalmologist, sculptor, painter, educator, and reformist. Born in Calamba, Laguna, he studied in Manila, Spain, France, Germany, and other European countries. He wrote Noli Me Tangere in Spanish at age 25, while studying in Madrid and Berlin. His execution at Bagumbayan (now Rizal Park, Manila) made him the martyr of Philippine independence.',
    titleMeaning: 'The title Noli Me Tangere is Latin for "Touch me not" — words spoken by Jesus to Mary Magdalene after the Resurrection. Rizal chose this title to suggest that the social cancer of colonial abuse should not be touched lightly, but also that the Filipino people should not be touched (oppressed) further. The full Latin phrase from John 20:17 carries both a warning and a plea.',
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-w-[calc(100vw-2rem)] max-h-[85vh] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-stone-950 to-stone-950 panel-ornamental-header shrink-0">
        <div>
          <h3 className="text-amber-400 font-bold text-base flex items-center gap-2">
            <span className="text-lg">❓</span> Help & About
          </h3>
          <div className="text-white/40 text-xs mt-0.5">Project Noor — A Stranger in San Diego</div>
        </div>
        <button
          onClick={() => togglePanel('help')}
          className="close-btn-styled w-8 h-8 rounded-md bg-stone-800/40 text-white/60 flex items-center justify-center"
          aria-label="Close help"
        >
          ✕
        </button>
      </div>

      {/* Section tabs */}
      <div className="px-4 pt-3 shrink-0">
        <div
          role="tablist"
          className="w-full bg-stone-900/60 grid grid-cols-2 h-9 rounded-lg p-[3px] gap-[2px]"
        >
          <button
            role="tab"
            aria-selected={activeSection === 'guide'}
            onClick={() => setActiveSection('guide')}
            className={`text-xs rounded-md border border-transparent transition-colors font-semibold ${
              activeSection === 'guide'
                ? 'bg-amber-900/60 text-amber-300 border-amber-400/40 shadow-sm'
                : 'text-white/50 hover:text-white/80 hover:bg-stone-800/60'
            }`}
          >
            🎮 Guide
          </button>
          <button
            role="tab"
            aria-selected={activeSection === 'about'}
            onClick={() => setActiveSection('about')}
            className={`text-xs rounded-md border border-transparent transition-colors font-semibold ${
              activeSection === 'about'
                ? 'bg-amber-900/60 text-amber-300 border-amber-400/40 shadow-sm'
                : 'text-white/50 hover:text-white/80 hover:bg-stone-800/60'
            }`}
          >
            📚 About the Novel
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto p-4 space-y-4 flex-1 min-h-0">
        {activeSection === 'guide' ? (
          <>
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

            {/* Quote */}
            <div className="pt-3 border-t border-amber-400/20 text-center">
              <div className="text-white/40 text-xs italic">
                &ldquo;A novel about the Philippines… a mirror in which to see ourselves.&rdquo;
              </div>
              <div className="text-amber-400/40 text-[10px] mt-1">— José Rizal, on Noli Me Tangere</div>
            </div>
          </>
        ) : (
          <>
            {/* Novel info card */}
            <div className="rounded-xl bg-gradient-to-br from-amber-950/40 to-stone-950/60 border border-amber-400/40 p-4">
              {/* Title and author */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0 bg-amber-900/40 border border-amber-400/30 shadow-lg shadow-amber-900/20">
                  📖
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-amber-400 text-xl font-bold leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
                    {novelInfo.title}
                  </h4>
                  <div className="text-white/80 text-sm mt-1" style={{ fontFamily: 'Georgia, serif' }}>
                    by <span className="text-amber-300 font-semibold">{novelInfo.author}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                    <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-400/30 text-amber-400/80 font-mono">{novelInfo.year}</span>
                    <span>Written in {novelInfo.language}</span>
                    <span className="text-white/20">·</span>
                    <span>{novelInfo.setting}</span>
                  </div>
                </div>
              </div>

              {/* Synopsis */}
              <div className="mb-4">
                <h5 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold mb-1.5">Synopsis</h5>
                <p className="text-white/75 text-sm leading-relaxed" style={{ fontFamily: 'Georgia, serif' }}>
                  {novelInfo.synopsis}
                </p>
              </div>

              {/* Title meaning */}
              <div className="rounded-lg bg-stone-900/40 p-3 border border-amber-400/20 mb-4">
                <h5 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold mb-1.5">Title Meaning</h5>
                <p className="text-white/70 text-xs leading-relaxed italic" style={{ fontFamily: 'Georgia, serif' }}>
                  {novelInfo.titleMeaning}
                </p>
              </div>

              {/* Historical significance */}
              <div className="mb-4">
                <h5 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold mb-2">Historical Significance</h5>
                <ul className="space-y-1.5">
                  {novelInfo.significance.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/70 leading-relaxed">
                      <span className="text-amber-400/60 mt-0.5 shrink-0">✦</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Historical context */}
              <div className="rounded-lg bg-gradient-to-r from-stone-900/40 to-amber-950/20 p-3 border border-stone-800/40 mb-4">
                <h5 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold mb-1.5">🇵🇭 Historical Context: Spanish Colonial Philippines</h5>
                <p className="text-white/70 text-xs leading-relaxed">
                  {novelInfo.historicalContext}
                </p>
              </div>

              {/* About Rizal */}
              <div className="rounded-lg bg-gradient-to-r from-amber-950/20 to-stone-900/40 p-3 border border-amber-400/30">
                <h5 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold mb-1.5">✍️ About José Rizal</h5>
                <p className="text-white/70 text-xs leading-relaxed">
                  {novelInfo.aboutRizal}
                </p>
              </div>
            </div>

            {/* Key characters preview */}
            <div>
              <h5 className="text-amber-400/70 text-[10px] uppercase tracking-widest font-semibold mb-2">Key Characters You'll Meet</h5>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-3 rounded-lg p-2.5 bg-stone-900/40 border border-stone-800/30">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-200 to-amber-600 flex items-center justify-center text-sm shadow-md">🎓</div>
                  <div>
                    <div className="text-amber-300 text-xs font-semibold">Crisóstomo Ibarra</div>
                    <div className="text-white/50 text-[10px]">European-educated mestizo, returning to reform his country</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg p-2.5 bg-stone-900/40 border border-stone-800/30">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-400 to-stone-700 flex items-center justify-center text-sm shadow-md">⛪</div>
                  <div>
                    <div className="text-red-400/80 text-xs font-semibold">Padre Dámaso</div>
                    <div className="text-white/50 text-[10px]">Arrogant Franciscan friar — the antagonist of colonial power</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg p-2.5 bg-stone-900/40 border border-stone-800/30">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-800 flex items-center justify-center text-sm shadow-md">🎩</div>
                  <div>
                    <div className="text-amber-300/80 text-xs font-semibold">Capitán Tiago</div>
                    <div className="text-white/50 text-[10px]">Wealthy elite — torn between Spanish authority and Filipino loyalty</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg p-2.5 bg-stone-900/40 border border-stone-800/30">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-300 to-pink-700 flex items-center justify-center text-sm shadow-md">🌺</div>
                  <div>
                    <div className="text-pink-300/80 text-xs font-semibold">Maria Clara</div>
                    <div className="text-white/50 text-[10px]">Ibarra's beloved — the ideal woman of colonial society</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Educational note */}
            <div className="pt-3 border-t border-amber-400/20 text-center">
              <div className="text-white/50 text-xs italic" style={{ fontFamily: 'Georgia, serif' }}>
                &ldquo;I die just when I see the dawn break, Through the gloom of night, to herald the day;&rdquo;
              </div>
              <div className="text-amber-400/50 text-[10px] mt-1 font-semibold">— José Rizal, Mi Último Adiós (My Last Farewell)</div>
              <div className="text-white/30 text-[10px] mt-2">
                📚 Open the Codex (C) and Glossary (G) panels for deeper historical context
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
