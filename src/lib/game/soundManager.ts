// SoundManager - Web Audio API based sound effects and music
// No external audio files needed - all sounds are synthesized procedurally

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

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private musicEnabled: boolean = true;
  private musicNodes: { osc: OscillatorNode; gain: GainNode } | null = null;
  private musicInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Load settings from localStorage
    if (typeof window !== 'undefined') {
      this.soundEnabled = localStorage.getItem('noor-sound') !== 'false';
      this.musicEnabled = localStorage.getItem('noor-music') !== 'false';

      // Listen for setting changes
      window.addEventListener('noor:setting', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail.sound !== undefined) this.soundEnabled = detail.sound;
        if (detail.music !== undefined) {
          this.musicEnabled = detail.music;
          if (detail.music) this.startMusic();
          else this.stopMusic();
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
  }
}

export const soundManager = new SoundManager();
export default SoundManager;
