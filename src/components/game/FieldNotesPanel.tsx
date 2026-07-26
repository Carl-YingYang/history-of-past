'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from './UIManager';

/**
 * FieldNotesPanel - A free-form personal notepad the player can write in.
 *
 * Distinct from the JournalPanel (which auto-records story events):
 *   - The Journal is a curated list of automatic entries tied to story beats.
 *   - Field Notes are the player's OWN observations, hypotheses, and questions,
 *     written in their own words.
 *
 * Notes are stored in localStorage under 'noor-field-notes' (independent of the
 * server-side SaveManager flow, since these are personal scratchings — not
 * game-progression data).
 *
 * Features:
 *   - Sticky-note style cards in a warm parchment palette
 *   - Pin/unpin notes (pinned notes appear first)
 *   - Color tags (5 colors) so the player can categorize notes
 *   - Word count + last-edited timestamp on each note
 *   - Auto-save with debounce (no explicit "save" button needed)
 *   - Confirmation toast when notes are auto-saved
 *   - Empty-state with prompt to encourage active reading
 */

type NoteColor = 'amber' | 'rose' | 'emerald' | 'sky' | 'violet';

interface Note {
  id: string;
  text: string;
  color: NoteColor;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'noor-field-notes';

const COLOR_STYLES: Record<NoteColor, { bg: string; border: string; accent: string; dot: string; label: string }> = {
  amber:   { bg: 'bg-amber-950/40',   border: 'border-amber-400/40',   accent: 'text-amber-300',   dot: 'bg-amber-400',   label: 'Observation' },
  rose:    { bg: 'bg-rose-950/40',    border: 'border-rose-400/40',    accent: 'text-rose-300',    dot: 'bg-rose-400',    label: 'Question' },
  emerald: { bg: 'bg-emerald-950/40', border: 'border-emerald-400/40', accent: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Insight' },
  sky:     { bg: 'bg-sky-950/40',     border: 'border-sky-400/40',     accent: 'text-sky-300',     dot: 'bg-sky-400',     label: 'Character' },
  violet:  { bg: 'bg-violet-950/40',  border: 'border-violet-400/40',  accent: 'text-violet-300',  dot: 'bg-violet-400',  label: 'Place' },
};

const COLOR_ORDER: NoteColor[] = ['amber', 'rose', 'emerald', 'sky', 'violet'];

// Field Notes uses a custom event so the Toolbar button (and the global 'N'
// keyboard shortcut in UIManager) can toggle this panel without modifying the
// shared PanelId union type. This keeps the change self-contained.
const FIELD_NOTES_EVENT = 'noor:toggle-field-notes';

function loadNotes(): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // localStorage might be full; silently ignore
  }
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function FieldNotesPanel() {
  const { activePanel } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  // Lazy initializer — runs once on first render, no effect needed
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [draftText, setDraftText] = useState('');
  const [draftColor, setDraftColor] = useState<NoteColor>('amber');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [filterColor, setFilterColor] = useState<NoteColor | 'all'>('all');
  const debounceRef = useRef<number | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  // Listen for toggle events from the Toolbar button
  useEffect(() => {
    const handler = () => {
      setIsOpen(prev => !prev);
    };
    window.addEventListener(FIELD_NOTES_EVENT, handler);
    return () => window.removeEventListener(FIELD_NOTES_EVENT, handler);
  }, []);

  // Close on Escape (only if no field within has focus — handled by parent)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only close if not currently focused inside a text input
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
          // blur instead — let user press Escape again to close
          (active as HTMLElement).blur();
          return;
        }
        setIsOpen(false);
        e.stopPropagation();
      }
    };
    // Use capture so we beat the global UIManager Escape handler
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isOpen]);

  // Auto-save notes with debounce + flash indicator
  const triggerSave = useCallback((updatedNotes: Note[]) => {
    setNotes(updatedNotes);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      saveNotes(updatedNotes);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    }, 400);
  }, []);

  const addNote = () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    const now = Date.now();
    const newNote: Note = {
      id: `note_${now}_${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      color: draftColor,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newNote, ...notes];
    triggerSave(updated);
    setDraftText('');
    // Refocus the textarea for rapid note-taking
    requestAnimationFrame(() => draftRef.current?.focus());
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    triggerSave(updated);
    if (editingId === id) {
      setEditingId(null);
      setEditingText('');
    }
  };

  const togglePin = (id: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n);
    triggerSave(updated);
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditingText(note.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      // Empty edit = delete
      deleteNote(editingId);
      return;
    }
    const updated = notes.map(n =>
      n.id === editingId ? { ...n, text: trimmed, updatedAt: Date.now() } : n
    );
    triggerSave(updated);
    setEditingId(null);
    setEditingText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const changeNoteColor = (id: string, color: NoteColor) => {
    const updated = notes.map(n => n.id === id ? { ...n, color, updatedAt: Date.now() } : n);
    triggerSave(updated);
  };

  if (!isOpen) return null;

  // Don't show if another modal panel is open (avoid stacking)
  if (activePanel !== null) return null;

  // Sort: pinned first, then by updatedAt desc
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const filteredNotes = filterColor === 'all'
    ? sortedNotes
    : sortedNotes.filter(n => n.color === filterColor);

  const totalWords = notes.reduce((sum, n) => sum + n.text.trim().split(/\s+/).filter(Boolean).length, 0);

  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-[min(640px,calc(100vw-2rem))] max-h-[calc(100vh-8rem)] rounded-xl overflow-hidden bg-stone-950/97 border border-amber-400/40 shadow-2xl shadow-amber-950/40 animate-panel-slide-in flex flex-col"
      role="dialog"
      aria-label="Field Notes"
    >
      {/* Header */}
      <div className="p-3 border-b border-amber-400/20 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-amber-950/20 to-transparent panel-ornamental-header shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">✏️</span>
          <div>
            <h3 className="text-amber-400 font-bold text-sm flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              Field Notes
            </h3>
            <div className="text-white/40 text-[10px] mt-0.5">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'} · {totalWords} words written
              {savedFlash && (
                <span className="ml-2 text-emerald-400 animate-pulse">✓ saved</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="close-btn-styled w-7 h-7 rounded-md bg-stone-800/40 text-white/60 text-sm flex items-center justify-center hover:bg-stone-700/60 hover:text-white"
          aria-label="Close Field Notes"
        >
          ✕
        </button>
      </div>

      {/* Composer */}
      <div className="p-3 border-b border-amber-400/15 bg-stone-900/40 shrink-0">
        <textarea
          ref={draftRef}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              addNote();
            }
          }}
          placeholder="Jot an observation, a question, a hypothesis about San Diego and its people…  (⌘/Ctrl + Enter to save)"
          rows={3}
          className="w-full p-2 rounded-md bg-stone-950/80 border border-amber-400/20 text-amber-100 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 resize-y font-serif"
          style={{ fontFamily: 'Georgia, serif' }}
        />
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <span className="text-white/40 text-[10px] mr-1 uppercase tracking-wider">Tag:</span>
            {COLOR_ORDER.map(c => (
              <button
                key={c}
                onClick={() => setDraftColor(c)}
                className={`w-5 h-5 rounded-full ${COLOR_STYLES[c].dot} border-2 transition-transform hover:scale-110 ${
                  draftColor === c ? 'border-white scale-110' : 'border-white/20'
                }`}
                title={COLOR_STYLES[c].label}
                aria-label={`Tag as ${COLOR_STYLES[c].label}`}
              />
            ))}
            <span className="ml-2 text-[10px] text-white/50 font-serif italic">
              → {COLOR_STYLES[draftColor].label}
            </span>
          </div>
          <button
            onClick={addNote}
            disabled={!draftText.trim()}
            className="px-3 py-1 rounded-md bg-amber-700/80 hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed text-amber-50 text-xs font-semibold border border-amber-400/40 transition-colors flex items-center gap-1"
          >
            <span>＋</span> Add Note
          </button>
        </div>
      </div>

      {/* Color filter */}
      {notes.length > 0 && (
        <div className="px-3 py-1.5 border-b border-amber-400/10 bg-stone-900/20 flex items-center gap-1.5 flex-wrap shrink-0">
          <span className="text-white/40 text-[10px] uppercase tracking-wider mr-1">Filter:</span>
          <button
            onClick={() => setFilterColor('all')}
            className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
              filterColor === 'all'
                ? 'bg-amber-900/50 border-amber-400/60 text-amber-300'
                : 'bg-stone-800/40 border-white/10 text-white/50 hover:text-white/80'
            }`}
          >
            All ({notes.length})
          </button>
          {COLOR_ORDER.map(c => {
            const count = notes.filter(n => n.color === c).length;
            if (count === 0) return null;
            return (
              <button
                key={c}
                onClick={() => setFilterColor(c)}
                className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors flex items-center gap-1 ${
                  filterColor === c
                    ? `${COLOR_STYLES[c].bg} ${COLOR_STYLES[c].border} ${COLOR_STYLES[c].accent}`
                    : 'bg-stone-800/40 border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${COLOR_STYLES[c].dot}`} />
                {COLOR_STYLES[c].label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Notes list */}
      <div className="overflow-y-auto flex-1 p-3 space-y-2 custom-scroll-amber">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3 opacity-50">🗒️</div>
            <div className="text-amber-300/80 text-sm font-serif italic">
              {notes.length === 0
                ? 'A blank page awaits your first observation…'
                : 'No notes in this category yet.'}
            </div>
            <div className="text-xs mt-3 text-white/30 max-w-[280px] mx-auto leading-relaxed">
              Use Field Notes to record questions, sketch character relationships, or jot down
              Tagalog phrases you want to remember. Notes are saved to this device only.
            </div>
          </div>
        ) : (
          filteredNotes.map(note => {
            const colorStyle = COLOR_STYLES[note.color];
            const isEditing = editingId === note.id;
            const wordCount = note.text.trim().split(/\s+/).filter(Boolean).length;
            return (
              <div
                key={note.id}
                className={`group relative rounded-lg border ${colorStyle.border} ${colorStyle.bg} p-3 transition-all hover:shadow-lg`}
              >
                {/* Pin indicator */}
                {note.pinned && (
                  <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-[10px] shadow-md`}>
                    📌
                  </div>
                )}

                {/* Color tag indicator */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${colorStyle.dot}`} />
                  <span className={`text-[9px] uppercase tracking-wider font-semibold ${colorStyle.accent}`}>
                    {colorStyle.label}
                  </span>
                  <span className="text-white/30 text-[9px] ml-auto">
                    {formatTimestamp(note.updatedAt)} · {wordCount}w
                  </span>
                </div>

                {isEditing ? (
                  <div>
                    <textarea
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      rows={3}
                      className="w-full p-2 rounded-md bg-stone-950/80 border border-amber-400/30 text-amber-100 text-sm focus:outline-none focus:border-amber-400/60 resize-y font-serif"
                      style={{ fontFamily: 'Georgia, serif' }}
                    />
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <button
                        onClick={saveEdit}
                        className="px-2 py-0.5 rounded-md bg-emerald-800/70 hover:bg-emerald-700 text-emerald-100 text-[10px] font-semibold border border-emerald-400/30"
                      >
                        ✓ Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-0.5 rounded-md bg-stone-800/70 hover:bg-stone-700 text-white/70 text-[10px] border border-white/10"
                      >
                        ✕ Cancel
                      </button>
                      <span className="ml-auto text-white/30 text-[9px]">Esc to cancel · ⌘+Enter to save</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-amber-50/90 text-sm whitespace-pre-wrap leading-relaxed font-serif" style={{ fontFamily: 'Georgia, serif' }}>
                      {note.text}
                    </p>
                    {/* Hover actions */}
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => togglePin(note.id)}
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          note.pinned
                            ? 'bg-amber-900/50 border-amber-400/50 text-amber-300'
                            : 'bg-stone-800/60 border-white/10 text-white/60 hover:text-white/90'
                        }`}
                        title={note.pinned ? 'Unpin' : 'Pin to top'}
                      >
                        {note.pinned ? '📌 Unpin' : '📌 Pin'}
                      </button>
                      <button
                        onClick={() => startEdit(note)}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-stone-800/60 border border-white/10 text-white/60 hover:text-white/90"
                      >
                        ✎ Edit
                      </button>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950/50 border border-rose-400/20 text-rose-300/80 hover:text-rose-200 hover:bg-rose-900/50"
                      >
                        🗑 Delete
                      </button>
                      {/* Color re-tag */}
                      <div className="ml-auto flex items-center gap-0.5">
                        {COLOR_ORDER.map(c => (
                          <button
                            key={c}
                            onClick={() => changeNoteColor(note.id, c)}
                            className={`w-3 h-3 rounded-full ${COLOR_STYLES[c].dot} border ${
                              note.color === c ? 'border-white' : 'border-white/20'
                            } hover:scale-125 transition-transform`}
                            title={`Re-tag as ${COLOR_STYLES[c].label}`}
                            aria-label={`Re-tag as ${COLOR_STYLES[c].label}`}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-amber-400/15 bg-stone-900/40 text-[10px] text-white/40 flex items-center justify-between shrink-0">
        <span className="italic">Your private notes · saved to this device</span>
        <span className="font-mono">Press Esc to close</span>
      </div>
    </div>
  );
}

/**
 * Helper exported for the Toolbar to dispatch the toggle event.
 */
export function toggleFieldNotesPanel() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FIELD_NOTES_EVENT));
}
