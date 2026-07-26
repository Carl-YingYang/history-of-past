'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { soundManager } from '@/lib/game/soundManager';

/**
 * PhotoMode - Screenshot capture for the game canvas.
 *
 * Renders a floating camera button (📷) positioned next to the touch D-pad on
 * mobile (bottom-left, above the D-pad) and centered below the header on
 * desktop. When clicked (or triggered via the `P` keyboard shortcut — wired
 * in UIManager via a `noor:capture-photo` custom event), it:
 *
 *   1. Captures the game canvas as a PNG via `canvas.toDataURL('image/png')`.
 *   2. Overlays a brief white "flash" animation (mimics a camera flash).
 *   3. Triggers an automatic download: `noor-screenshot-<timestamp>.png`.
 *   4. Plays a camera-shutter sound (uses existing 'ui-click' SFX — we do NOT
 *      modify soundManager.ts per task scope, so a true 'photo' sound is not
 *      added; the existing API is preserved).
 *   5. Shows an inline toast notification: "📸 Photo captured!".
 *
 * Visibility:
 *   - Hides when a dialogue or panel is open (reads
 *     `data-noor-dialogue-active` and `data-noor-panel-active` body attributes
 *     via a MutationObserver so non-React systems setting those attributes
 *     are also respected).
 *
 * Keyboard shortcut:
 *   - `P` is wired in UIManager's GlobalKeyboardShortcuts which dispatches
 *     the `noor:capture-photo` event. This component listens for that event
 *     and triggers the same capture flow as the button click.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAPTURE_EVENT = 'noor:capture-photo';
const TOAST_DURATION_MS = 2600;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PhotoMode() {
  const [hidden, setHidden] = useState(false);
  const [flashKey, setFlashKey] = useState(0); // bump to retrigger flash anim
  const [toast, setToast] = useState<{ visible: boolean; msg: string }>({
    visible: false,
    msg: '',
  });
  const toastTimerRef = useRef<number | null>(null);

  // ---- Visibility: hide while a dialogue or panel is open --------------
  // We watch the body data-attributes set by DialogueBox / UIManager.
  useEffect(() => {
    const update = () => {
      const dialogueActive =
        document.body.getAttribute('data-noor-dialogue-active') === 'true';
      const panelActive =
        document.body.getAttribute('data-noor-panel-active') === 'true';
      setHidden(dialogueActive || panelActive);
    };
    update(); // initial sync

    // MutationObserver on body attributes — robust to non-React setters.
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-noor-dialogue-active', 'data-noor-panel-active'],
    });
    return () => observer.disconnect();
  }, []);

  // ---- Toast helper ----------------------------------------------------
  const showToast = useCallback((msg: string) => {
    setToast({ visible: true, msg });
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast({ visible: false, msg: '' });
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  // ---- Core capture flow ----------------------------------------------
  const capturePhoto = useCallback(() => {
    if (typeof document === 'undefined') return;

    // 1. Find the game canvas. GameCanvas renders a single <canvas>; we use
    //    a more specific selector first, then fall back to the generic one.
    const canvas = (document.querySelector('canvas.game-canvas') as HTMLCanvasElement | null) ??
      (document.querySelector('canvas') as HTMLCanvasElement | null);

    if (!canvas) {
      showToast('⚠️ No canvas found to capture.');
      return;
    }

    // 2. Trigger flash overlay (re-mount via key bump to restart animation).
    setFlashKey(k => k + 1);

    // 3. Play shutter sound — uses existing 'ui-click' SFX to avoid
    //    modifying soundManager.ts (per task scope).
    try {
      soundManager.play('ui-click');
    } catch {
      /* soundManager may not be ready; ignore */
    }

    // 4. Capture PNG. Some canvas contexts are tainted by cross-origin
    //    assets — guard with try/catch so the UI never crashes.
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch (err) {
      console.warn('[PhotoMode] canvas.toDataURL failed:', err);
      showToast('⚠️ Could not capture canvas (tainted).');
      return;
    }

    // 5. Trigger automatic download via temporary <a download> element.
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const filename = `noor-screenshot-${timestamp}.png`;
    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('[PhotoMode] download trigger failed:', err);
      showToast('⚠️ Capture worked, but download failed.');
      return;
    }

    // 6. Toast notification.
    showToast('📸 Photo captured! Click to download.');
  }, [showToast]);

  // ---- Listen for external trigger events (keyboard shortcut P) -------
  useEffect(() => {
    const handler = () => capturePhoto();
    window.addEventListener(CAPTURE_EVENT, handler);
    return () => window.removeEventListener(CAPTURE_EVENT, handler);
  }, [capturePhoto]);

  // ---- Cleanup any pending toast timer on unmount ---------------------
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Don't render the button if hidden (dialogue / panel open) or if we're
  // not in a browser environment (SSR safety via the useEffect above; this
  // guard keeps the initial render consistent).
  if (hidden) return null;

  return (
    <>
      {/* Floating camera button */}
      <button
        type="button"
        onClick={capturePhoto}
        className="group absolute bottom-20 left-4 md:bottom-auto md:top-16 md:left-1/2 md:-translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-stone-900/90 text-amber-400 border border-amber-400/30 hover:bg-stone-800/90 hover:border-amber-400/60 shadow-lg shadow-amber-950/40 transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-stone-950"
        title="📸 Photo Mode (P)"
        aria-label="Capture a screenshot of the current view (Photo Mode, shortcut P)"
      >
        {/* Glow ring around the camera icon */}
        <span
          className="relative flex h-6 w-6 items-center justify-center text-base"
          aria-hidden="true"
        >
          <span className="absolute inset-0 rounded-full bg-amber-400/0 group-hover:bg-amber-400/10 transition-colors duration-200" />
          <span className="relative drop-shadow-[0_0_4px_rgba(251,191,36,0.45)]">📷</span>
        </span>
        {/* Label — hidden on the smallest screens (icon-only) */}
        <span className="hidden sm:inline text-amber-400 font-bold text-[11px] leading-none tracking-wide group-hover:text-amber-300 transition-colors">
          PHOTO
        </span>
        {/* Small "PHOTO MODE" badge — visible on md+ */}
        <span className="hidden md:inline text-[8px] uppercase tracking-widest text-amber-400/50 font-mono leading-none group-hover:text-amber-300/70 transition-colors">
          mode
        </span>
        {/* Shortcut hint pill — visible only on md+ */}
        <span className="hidden md:inline-flex items-center justify-center ml-0.5 min-w-[16px] h-[16px] px-1 rounded bg-amber-950/60 border border-amber-400/20 text-amber-300/80 text-[9px] font-mono leading-none">
          P
        </span>
      </button>

      {/* Camera flash overlay — full-screen white that fades out fast */}
      <CameraFlash key={flashKey} active={flashKey > 0} />

      {/* Inline toast notification (top-center, below header) */}
      {toast.visible && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-30 mt-12 px-3 py-1.5 rounded-full bg-stone-950/95 border border-amber-400/50 shadow-lg shadow-amber-950/50 text-amber-200 text-xs font-medium animate-fade-in-up pointer-events-none"
          role="status"
          aria-live="polite"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CameraFlash — white overlay that fades out, mimicking a camera shutter.
// Mounted once with a key bump so the animation restarts on each capture.
// ---------------------------------------------------------------------------

function CameraFlash({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[60] bg-white animate-camera-flash"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Exported helper — dispatch the capture event from anywhere (e.g. a future
// toolbar button or external shortcut handler). UIManager's keyboard handler
// dispatches this same event directly to avoid a circular import.
// ---------------------------------------------------------------------------

export function triggerPhotoCapture() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CAPTURE_EVENT));
}
