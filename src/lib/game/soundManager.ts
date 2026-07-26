// SoundManager - Web Audio API based sound effects and music
// No external audio files needed - all sounds are synthesized procedurally
//
// Ambient system (Task 9-b):
//   - playFootstep(): randomized noise burst through a low-pass filter,
//     called by the game engine every ~400ms while the player walks.
//   - startMarketAmbient()/stopMarketAmbient(): a self-scheduling loop of
//     distant chatter + cart creaks triggered when the player is near the
//     Market building. Max gain 0.04.
//   - playChurchBell(): inharmonic sine partials with a slow 3s decay,
//     fired once when Chapter 1 completes.
//   - startNatureAmbient()/stopNatureAmbient(): bird chirps during the day,
//     rhythmic cricket pulses at night. Max gain 0.03.
//   - setAmbientVolume(vol)/setAmbientEnabled(enabled) control all of the
//     above. Persisted to localStorage key 'noor-ambient-enabled' (default
//     true) and applied live.

type SoundType =
  | 'dialogue-open'
  | 'dialogue-close'
  | 'dialogue-advance'
  | 'quest-complete'
  | 'objective-complete'
  | 'codex-unlock'
  | 'xp-gain'
  | 'medal'
  | 'quiz-correct'
  | 'quiz-wrong'
  | 'time-transition'
  | 'ui-click'
  | 'chapter-complete';

type NatureMode = 'day' | 'night';

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private musicNodes: { osc: OscillatorNode; gain: GainNode } | null = null;
  private musicInterval: NodeJS.Timeout | null = null;

  // === Ambient sound state ===
  private ambientEnabled: boolean = true;
  private ambientVolume: number = 0.5;
  private noiseBuffer: AudioBuffer | null = null;

  // Market ambient
  private marketAmbientActive: boolean = false;
  private marketAmbientTimer: ReturnType<typeof setTimeout> | null = null;

  // Nature ambient
  private natureAmbientActive: boolean = false;
  private natureAmbientTimer: ReturnType<typeof setTimeout> | null = null;
  private natureMode: NatureMode = 'day';

  constructor() {
    // Load settings from localStorage
    if (typeof window !== 'undefined') {
      this.soundEnabled = localStorage.getItem('noor-sound') !== 'false';
      this.musicEnabled = localStorage.getItem('noor-music') !== 'false';
      this.ambientEnabled = localStorage.getItem('noor-ambient-enabled') !== 'false';

      // Listen for setting changes
      window.addEventListener('noor:setting', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail.sound !== undefined) this.soundEnabled = detail.sound;
        if (detail.music !== undefined) {
          this.musicEnabled = detail.music;
          if (detail.music) this.startMusic();
          else this.stopMusic();
        }
        if (detail.ambient !== undefined) {
          this.setAmbientEnabled(detail.ambient);
        }
      });
    }
  }

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AC();
      } catch (e) {
        console.warn('Web Audio API not available');
        return null;
      }
    }
    // Resume if suspended (browser autoplay policy)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play a simple synthesized sound effect
  play(sound: SoundType): void {
    if (!this.soundEnabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (sound) {
      case 'dialogue-open':
        this._playTone(ctx, 440, 0.08, 0.05, now, 'sine');
        this._playTone(ctx, 660, 0.08, 0.04, now + 0.05, 'sine');
        break;
      case 'dialogue-close':
        this._playTone(ctx, 660, 0.08, 0.05, now, 'sine');
        this._playTone(ctx, 440, 0.08, 0.04, now + 0.05, 'sine');
        break;
      case 'dialogue-advance':
        this._playTone(ctx, 800, 0.04, 0.03, now, 'square');
        break;
      case 'objective-complete':
        this._playChime(ctx, [523, 659, 784], 0.1, now);
        break;
      case 'quest-complete':
        this._playChime(ctx, [523, 659, 784, 1047], 0.12, now);
        break;
      case 'codex-unlock':
        this._playChime(ctx, [784, 988, 1175], 0.1, now);
        break;
      case 'xp-gain':
        this._playTone(ctx, 880, 0.06, 0.05, now, 'triangle');
        this._playTone(ctx, 1175, 0.06, 0.04, now + 0.06, 'triangle');
        break;
      case 'medal':
        this._playChime(ctx, [523, 659, 784, 1047, 1319], 0.15, now);
        break;
      case 'quiz-correct':
        this._playChime(ctx, [659, 880], 0.12, now);
        break;
      case 'quiz-wrong':
        this._playTone(ctx, 200, 0.15, 0.08, now, 'sawtooth');
        this._playTone(ctx, 150, 0.15, 0.08, now + 0.1, 'sawtooth');
        break;
      case 'time-transition':
        // Soft chime for time of day change
        this._playTone(ctx, 392, 0.3, 0.04, now, 'sine');
        this._playTone(ctx, 523, 0.3, 0.03, now + 0.15, 'sine');
        this._playTone(ctx, 659, 0.4, 0.03, now + 0.3, 'sine');
        break;
      case 'ui-click':
        this._playTone(ctx, 600, 0.03, 0.02, now, 'square');
        break;
      case 'chapter-complete':
        // Triumphant fanfare
        this._playChime(ctx, [523, 659, 784, 1047], 0.15, now);
        this._playChime(ctx, [1047, 1319, 1568], 0.2, now + 0.5);
        break;
    }
  }

  private _playTone(
    ctx: AudioContext,
    freq: number,
    duration: number,
    gain: number,
    startTime: number,
    type: OscillatorType = 'sine'
  ): void {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  private _playChime(ctx: AudioContext, freqs: number[], noteDuration: number, startTime: number): void {
    freqs.forEach((freq, i) => {
      this._playTone(ctx, freq, noteDuration, 0.05, startTime + i * noteDuration * 0.8, 'sine');
    });
  }

  // Simple ambient background music using oscillators
  startMusic(): void {
    if (!this.musicEnabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    if (this.musicNodes) return; // Already playing

    // Simple ambient drone with slow melody
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = 110; // A2
    bassGain.gain.value = 0.02;
    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassOsc.start();
    this.musicNodes = { osc: bassOsc, gain: bassGain };

    // Slow melody notes
    const melodyNotes = [220, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63, 246.94];
    let noteIdx = 0;
    this.musicInterval = setInterval(() => {
      if (!this.musicEnabled || !this.musicNodes) return;
      const now = ctx.currentTime;
      this._playTone(ctx, melodyNotes[noteIdx], 1.5, 0.015, now, 'triangle');
      noteIdx = (noteIdx + 1) % melodyNotes.length;
    }, 2000);
  }

  stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.musicNodes) {
      try {
        this.musicNodes.osc.stop();
      } catch (e) {
        // Already stopped
      }
      this.musicNodes = null;
    }
  }

  // Call when user interacts (to satisfy autoplay policies)
  initOnUserGesture(): void {
    const ctx = this.getCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    if (this.musicEnabled) {
      this.startMusic();
    }
    // Start nature ambient on first user gesture (browser autoplay policy)
    if (this.ambientEnabled) {
      this.startNatureAmbient();
    }
  }

  // ==================== AMBIENT SOUND SYSTEM ====================
  // All ambient sources are gated by both `soundEnabled` and `ambientEnabled`.
  // The ambient volume is scaled by `ambientVolume` (0..1, default 0.5).

  /**
   * Play a soft, randomized footstep sound.
   * Short white-noise burst through a low-pass filter; the filter cutoff is
   * jittered per call to give a subtle pitch/texture variation between steps.
   * The game engine is responsible for throttling this to ~400ms intervals.
   */
  playFootstep(): void {
    if (!this.soundEnabled || !this.ambientEnabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.08 + Math.random() * 0.04; // 80-120ms
    const cutoff = 700 + Math.random() * 700;     // pitch variation

    const noise = ctx.createBufferSource();
    noise.buffer = this._getNoiseBuffer(ctx);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.7;

    const gain = ctx.createGain();
    const vol = 0.12 * this.ambientVolume;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }

  /**
   * Cached 1s white-noise buffer reused for footstep / chatter / etc.
   * Lazily created on first use.
   */
  private _getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /**
   * Start the Market ambient loop: distant chatter (band-passed noise)
   * and occasional cart-wheel creaks (low-frequency sawtooth) at random
   * intervals of 1-3s. Max gain 0.04. Idempotent.
   */
  startMarketAmbient(): void {
    if (!this.ambientEnabled) return;
    if (this.marketAmbientActive) return;
    this.marketAmbientActive = true;
    this._scheduleMarketSound();
  }

  /** Stop the Market ambient loop and clear the pending timer. */
  stopMarketAmbient(): void {
    this.marketAmbientActive = false;
    if (this.marketAmbientTimer) {
      clearTimeout(this.marketAmbientTimer);
      this.marketAmbientTimer = null;
    }
  }

  private _scheduleMarketSound(): void {
    if (!this.marketAmbientActive) return;
    const ctx = this.getCtx();
    if (ctx) {
      const now = ctx.currentTime;
      // ~70% chance of chatter, ~30% chance of cart creak
      if (Math.random() < 0.7) {
        this._playChatter(ctx, now);
      } else {
        this._playCartCreak(ctx, now);
      }
    }
    // Next event in 1-3s
    const nextDelay = 1000 + Math.random() * 2000;
    this.marketAmbientTimer = setTimeout(() => this._scheduleMarketSound(), nextDelay);
  }

  private _playChatter(ctx: AudioContext, startTime: number): void {
    const duration = 0.4 + Math.random() * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = this._getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500 + Math.random() * 700;
    bp.Q.value = 1.5;
    const gain = ctx.createGain();
    const vol = 0.04 * this.ambientVolume; // max gain 0.04
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
    gain.gain.linearRampToValueAtTime(vol * 0.6, startTime + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    noise.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration + 0.02);
  }

  private _playCartCreak(ctx: AudioContext, startTime: number): void {
    const duration = 0.6;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const baseFreq = 65 + Math.random() * 35;
    osc.frequency.setValueAtTime(baseFreq, startTime);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.7, startTime + duration);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 280;
    const gain = ctx.createGain();
    const vol = 0.04 * this.ambientVolume; // max gain 0.04
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  /**
   * Play a church-bell-like sound: a stack of inharmonic sine partials
   * with a slow exponential decay (~3s). The fundamental is jittered slightly
   * so each strike sounds distinct.
   */
  playChurchBell(): void {
    if (!this.soundEnabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const fundamental = 195 + Math.random() * 30;
    // Inharmonic partials approximate a tuned church bell.
    const partials: { mult: number; gain: number }[] = [
      { mult: 1.0, gain: 0.50 },
      { mult: 2.0, gain: 0.30 },
      { mult: 2.4, gain: 0.25 },
      { mult: 3.0, gain: 0.18 },
      { mult: 4.5, gain: 0.10 },
    ];
    const decay = 3.0;
    const baseVol = 0.18 * this.ambientVolume;

    for (const p of partials) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fundamental * p.mult;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(baseVol * p.gain, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }
  }

  /**
   * Start the nature ambient loop: bird chirps during 'day', rhythmic
   * cricket pulses during 'night'. Max gain 0.03. Idempotent.
   */
  startNatureAmbient(): void {
    if (!this.ambientEnabled) return;
    if (this.natureAmbientActive) return;
    this.natureAmbientActive = true;
    this._scheduleNatureSound();
  }

  /** Stop the nature ambient loop and clear the pending timer. */
  stopNatureAmbient(): void {
    this.natureAmbientActive = false;
    if (this.natureAmbientTimer) {
      clearTimeout(this.natureAmbientTimer);
      this.natureAmbientTimer = null;
    }
  }

  /**
   * Switch the nature ambient mode between 'day' (birds) and 'night' (crickets).
   * Safe to call while the loop is running — the next scheduled sound will
   * respect the new mode.
   */
  setNatureMode(mode: NatureMode): void {
    this.natureMode = mode;
  }

  private _scheduleNatureSound(): void {
    if (!this.natureAmbientActive) return;
    const ctx = this.getCtx();
    if (ctx) {
      const now = ctx.currentTime;
      if (this.natureMode === 'day') {
        this._playBirdChirp(ctx, now);
      } else {
        this._playCricket(ctx, now);
      }
    }
    // Birds: chirps every 1.5-4s. Crickets: pulses every 0.3-0.6s.
    const nextDelay = this.natureMode === 'day'
      ? 1500 + Math.random() * 2500
      : 300 + Math.random() * 300;
    this.natureAmbientTimer = setTimeout(() => this._scheduleNatureSound(), nextDelay);
  }

  private _playBirdChirp(ctx: AudioContext, startTime: number): void {
    // 2-3 quick upward sine sweeps with very fast decay
    const numChirps = 2 + Math.floor(Math.random() * 2);
    const baseFreq = 2400 + Math.random() * 1600;
    const vol = 0.03 * this.ambientVolume; // max gain 0.03
    for (let i = 0; i < numChirps; i++) {
      const t = startTime + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.35, t + 0.035);
      osc.frequency.linearRampToValueAtTime(baseFreq, t + 0.07);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    }
  }

  private _playCricket(ctx: AudioContext, startTime: number): void {
    // 4-6 rhythmic high-frequency square-wave pulses with quick decay
    const numPulses = 4 + Math.floor(Math.random() * 3);
    const freq = 3800 + Math.random() * 1200;
    const vol = 0.025 * this.ambientVolume; // under the 0.03 ceiling
    for (let i = 0; i < numPulses; i++) {
      const t = startTime + i * 0.04;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.03);
    }
  }

  /**
   * Scale all ambient sound sources. `vol` is clamped to 0..1.
   * Applies to footsteps, market ambient, church bell, and nature ambient.
   */
  setAmbientVolume(vol: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Enable/disable the ambient sound system.
   * When disabled, all running ambient loops stop and new ones won't start.
   * Persisted to localStorage key 'noor-ambient-enabled'.
   */
  setAmbientEnabled(enabled: boolean): void {
    this.ambientEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('noor-ambient-enabled', String(enabled));
      } catch {
        // localStorage may be unavailable; ignore
      }
    }
    if (!enabled) {
      this.stopMarketAmbient();
      this.stopNatureAmbient();
    }
  }

  /** Read-only accessors useful for debugging/UI display. */
  isAmbientEnabled(): boolean { return this.ambientEnabled; }
  getAmbientVolume(): number { return this.ambientVolume; }
  isMarketAmbientActive(): boolean { return this.marketAmbientActive; }
  isNatureAmbientActive(): boolean { return this.natureAmbientActive; }
}

export const soundManager = new SoundManager();
export default SoundManager;
