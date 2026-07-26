'use client';

import { useUIStore } from './UIManager';

/**
 * AboutChapterPanel - Historical context for the current chapter
 * (Chapter 1: San Diego, 1887).
 *
 * Uses the shared useUIStore panel system (panel id: 'about' — already in
 * the PanelId union type). Renders when `activePanel === 'about'`.
 *
 * Content is static JSX — no data file needed. Sections cover:
 *   1. Header — ornamental title
 *   2. The Novel — Noli Me Tangere (1887, Berlin, Rizal's first novel)
 *   3. The Setting: San Diego — fictional town, Laguna-inspired
 *   4. The Time: 1887 — late Spanish colonial period context
 *   5. Key Characters — mini cards for Ibarra, Dámaso, Tiago, Mang Tenyo
 *   6. Themes to Watch For — bullet list
 *   7. Historical Note — disclaimer blockquote
 *   8. Footer — invitation to keep exploring
 */

interface CharacterCard {
  name: string;
  role: string;
  blurb: string;
  emoji: string;
  accent: string; // tailwind text color class
}

const CHARACTERS: CharacterCard[] = [
  {
    name: 'Crisóstomo Ibarra',
    role: 'The returning son',
    blurb:
      'A young Filipino of the ilustrado class, educated in Europe for seven years. He returns to San Diego carrying progressive ideals — and the grief of a father recently buried.',
    emoji: '🎓',
    accent: 'text-amber-300',
  },
  {
    name: 'Padre Dámaso',
    role: 'The Franciscan friar',
    blurb:
      'Parish priest of San Diego for twenty years. Loud, domineering, and contemptuous of Filipinos — including the family of the man whose funeral he just ruined.',
    emoji: '⛪',
    accent: 'text-rose-300',
  },
  {
    name: 'Capitán Tiago',
    role: 'The wealthy hostsman',
    blurb:
      'Ibarra’s godfather and one of the richest men in Binondo. A pragmatist who curries favour with the friars and the colonial government alike.',
    emoji: '🏛',
    accent: 'text-emerald-300',
  },
  {
    name: 'Mang Tenyo',
    role: 'Your guide',
    blurb:
      'An old boatman and former prisoner who knows San Diego intimately. He has seen the cruelty of the friars first-hand — and is willing to talk about it.',
    emoji: '🚣',
    accent: 'text-sky-300',
  },
];

const THEMES: string[] = [
  'Colonialism and the quiet violence of unequal power.',
  'Education as liberation — and as a threat to authority.',
  'The hypocrisy of the friars: vows of poverty masking vast wealth.',
  'The power of language: who is allowed to speak, and in whose tongue.',
  'Memory and forgetting: what a town chooses to remember, and to bury.',
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-amber-400 uppercase tracking-wider text-xs font-bold flex items-center gap-2 mt-5 mb-2">
      <span className="text-amber-500/80" aria-hidden="true">✦</span>
      {children}
    </h4>
  );
}

export default function AboutChapterPanel() {
  const { activePanel, togglePanel } = useUIStore();
  const isOpen = activePanel === 'about';

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-16 left-4 z-50 w-[460px] max-w-[calc(100vw-2rem)] max-h-[80vh] rounded-xl bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in flex flex-col overflow-hidden"
      role="dialog"
      aria-label="About Chapter 1"
    >
      {/* Header */}
      <div className="p-4 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/50 via-stone-950 to-stone-950 panel-ornamental-header shrink-0">
        <div>
          <h3
            className="text-amber-400 font-bold text-base flex items-center gap-2"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            <span className="text-lg">📖</span> About Chapter 1
          </h3>
          <div className="text-white/50 text-xs mt-0.5">
            San Diego · 1887 · Historical Context
          </div>
        </div>
        <button
          type="button"
          onClick={() => togglePanel('about')}
          className="close-btn-styled w-8 h-8 rounded-md bg-stone-800/40 text-white/60 flex items-center justify-center shrink-0"
          aria-label="Close About panel"
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto p-4 custom-scroll-amber"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {/* 1. The Novel */}
        <section>
          <SectionHeading>The Novel</SectionHeading>
          <p className="text-white/75 text-sm leading-relaxed">
            <em>Noli Me Tangere</em> — Latin for &ldquo;Touch me not&rdquo; — was
            published in <strong className="text-amber-300">1887 in Berlin</strong>,
            and was José Rizal’s first novel. Written in Spanish, it was the
            first major literary work to expose the corruption and cruelty of
            the Spanish friarocracy in the Philippines. Rizal paid for the
            printing himself; the manuscript had already been refused by
            several publishers.
          </p>
          <blockquote className="bg-amber-950/30 border-l-2 border-amber-400/50 pl-3 py-2 mt-2 text-amber-100/80 italic text-xs leading-relaxed">
            &ldquo;I have attempted to do what no one else has wished to do — to
            reply to the calumnies which for so many centuries have been
            heaped upon us and our country.&rdquo;
            <span className="block mt-1 not-italic text-white/40 text-[10px]">
              — José Rizal, on writing the Noli
            </span>
          </blockquote>
        </section>

        {/* 2. The Setting */}
        <section>
          <SectionHeading>The Setting: San Diego</SectionHeading>
          <p className="text-white/75 text-sm leading-relaxed">
            San Diego is a <em>fictional</em> town — the central setting of the
            novel, inspired by the lakeside communities of <strong className="text-amber-300">Laguna
            province</strong> where Rizal was born. Its plaza is the social heart
            of the chapter: the church on one side, the school and convento on
            another, the houses of the principalía lining the rest. Gossip,
            commerce, and politics all flow through the plaza.
          </p>
        </section>

        {/* 3. The Time */}
        <section>
          <SectionHeading>The Time: 1887</SectionHeading>
          <p className="text-white/75 text-sm leading-relaxed">
            By 1887, the Spanish had ruled the Philippines for{' '}
            <strong className="text-amber-300">over 320 years</strong> — since
            Legazpi’s expedition in 1565. Three currents shape the world of
            the novel:
          </p>
          <ul className="mt-2 space-y-1.5 text-white/75 text-sm leading-relaxed list-none">
            <li className="pl-4 relative">
              <span className="absolute left-0 text-amber-500/80" aria-hidden="true">✦</span>
              <strong className="text-amber-200">Spanish colonial rule</strong> —
              the civil government answers to Madrid, but local power is
              increasingly delegated to the friars.
            </li>
            <li className="pl-4 relative">
              <span className="absolute left-0 text-amber-500/80" aria-hidden="true">✦</span>
              <strong className="text-amber-200">The Ilustrado class</strong> —
              European-educated Filipinos (like Ibarra, like Rizal himself)
              return home carrying liberal ideas, and find themselves feared by
              the colonial order.
            </li>
            <li className="pl-4 relative">
              <span className="absolute left-0 text-amber-500/80" aria-hidden="true">✦</span>
              <strong className="text-amber-200">Friarocracy (frailocracia)</strong> —
              the Dominican, Franciscan, and Augustinian friars hold not only
              spiritual but also secular power: they control land, education,
              and the local courts. To challenge them is to risk exile — or
              worse.
            </li>
          </ul>
        </section>

        {/* 4. Key Characters */}
        <section>
          <SectionHeading>Key Characters You&apos;ll Meet</SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {CHARACTERS.map(c => (
              <div
                key={c.name}
                className="rounded-lg p-2.5 bg-stone-900/50 border border-amber-400/20 hover:border-amber-400/40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div
                    className="shrink-0 w-8 h-8 rounded-full bg-stone-800/70 border border-amber-400/20 flex items-center justify-center text-base"
                    aria-hidden="true"
                  >
                    {c.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold ${c.accent} leading-tight`}>
                      {c.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                      {c.role}
                    </div>
                    <div className="text-[11px] text-white/65 leading-snug">
                      {c.blurb}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Themes */}
        <section>
          <SectionHeading>Themes to Watch For</SectionHeading>
          <ul className="space-y-1 text-white/75 text-sm leading-relaxed">
            {THEMES.map((theme, i) => (
              <li key={i} className="pl-4 relative">
                <span className="absolute left-0 text-amber-500/80" aria-hidden="true">✦</span>
                {theme}
              </li>
            ))}
          </ul>
        </section>

        {/* 6. Historical Note */}
        <section>
          <SectionHeading>Historical Note</SectionHeading>
          <blockquote className="bg-amber-950/30 border-l-2 border-amber-400/50 pl-3 py-2 text-amber-100/80 italic text-xs leading-relaxed">
            This is a work of fiction set in a real historical period.
            Characters such as Padre Dámaso and Capitán Tiago are
            <em> archetypes</em>, not portraits of real individuals — but Rizal’s
            critique was aimed squarely at the actual Spanish friarocracy he
            observed. The Noli’s publication would help spark the
            Propaganda Movement, and ultimately the Philippine Revolution of
            1896.
          </blockquote>
        </section>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-amber-400/15 text-[11px] text-white/40 italic text-center">
          Continue exploring to unlock more about each character in the{' '}
          <span className="text-amber-300/80 not-italic font-semibold">Codex</span>.
        </div>
      </div>
    </div>
  );
}
