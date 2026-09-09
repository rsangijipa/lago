/**
 * Procedural Web Audio API sound synthesizer for water drops, splashes, and rain.
 * Works 100% offline with zero external audio assets.
 */

class WaterAudioEngine {
  private ctx: AudioContext | null = null;
  private rainNode: AudioNode | null = null;
  private rainGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = true;
  private rainState: 'none' | 'light' | 'medium' = 'none';
  private error: string | null = null;
  private statusListener: (() => void) | null = null;

  public onStatusChange(listener: (() => void) | null) {
    this.statusListener = listener;
  }

  private reportError(error: unknown) {
    this.error = error instanceof Error ? error.message : 'Não foi possível iniciar o áudio.';
    this.statusListener?.();
  }

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) throw new Error('A API de áudio não está disponível neste navegador.');
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.6, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        this.error = 'O navegador bloqueou o áudio até uma interação.';
      });
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
  }

  public getAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  }

  public getError(): string | null {
    return this.error;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Generates a sweet, natural water droplet sound
   */
  public playDrop(strength: number = 0.5) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // Base frequency between 350Hz and 850Hz with swift pitch rise or decay
      const baseFreq = 400 + Math.random() * 450;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Typical water drop plop has a fast upward or downward sweep
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, now + 0.12);

      const amp = Math.min(1.0, Math.max(0.1, strength)) * 0.35;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (error) {
      this.reportError(error);
    }
  }

  /**
   * Generates a heavier pebble or rock splash
   */
  public playStoneSplash(intensity: number = 0.8) {
    if (this.isMuted) return;
    try {
      const ctx = this.initContext();
      const now = ctx.currentTime;

      // 1. Low frequency thump for water displacement
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(140, now);
      subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.25);

      subGain.gain.setValueAtTime(0.4 * intensity, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      subOsc.connect(subGain);
      if (this.masterGain) subGain.connect(this.masterGain);

      subOsc.start(now);
      subOsc.stop(now + 0.3);

      // 2. Filtered noise burst for water splash droplets
      const bufferSize = ctx.sampleRate * 0.2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.Q.setValueAtTime(2.0, now);

      const splashGain = ctx.createGain();
      splashGain.gain.setValueAtTime(0.25 * intensity, now);
      splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      whiteNoise.connect(filter);
      filter.connect(splashGain);
      if (this.masterGain) splashGain.connect(this.masterGain);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.2);

      // Play 1-2 secondary droplets
      setTimeout(() => this.playDrop(0.4), 40);
      setTimeout(() => this.playDrop(0.25), 90);
    } catch (error) {
      this.reportError(error);
    }
  }

  /**
   * Generates continuous gentle rain noise
   */
  public setRain(level: 'none' | 'light' | 'medium') {
    this.rainState = level;
    if (level === 'none') {
      if (this.rainGain && this.ctx) {
        this.rainGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      }
      return;
    }

    try {
      const ctx = this.initContext();
      if (!this.rainNode) {
        // Create 2-second looped pinkish noise buffer
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          data[i] = (b0 + b1 + b2) * 0.18;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const rainFilter = ctx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.setValueAtTime(1200, ctx.currentTime);

        this.rainGain = ctx.createGain();
        this.rainGain.gain.setValueAtTime(0, ctx.currentTime);

        source.connect(rainFilter);
        rainFilter.connect(this.rainGain);
        if (this.masterGain) this.rainGain.connect(this.masterGain);

        source.start();
        this.rainNode = source;
      }

      if (this.rainGain) {
        const targetVol = level === 'light' ? 0.08 : 0.22;
        this.rainGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.5);
      }
    } catch (error) {
      this.reportError(error);
    }
  }
}

export const waterAudio = new WaterAudioEngine();
