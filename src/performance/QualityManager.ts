import type { QualityMode, QualityProfile } from '../types';

const ORDER: QualityProfile[] = ['economy', 'balanced', 'immersive'];

export class QualityManager {
  private mode: QualityMode = 'auto';
  private slowSamples = 0;
  private fastSamples = 0;

  constructor(
    private active: QualityProfile = 'balanced',
    private readonly sampleThreshold = 180,
  ) {}

  setMode(mode: QualityMode): QualityProfile {
    this.mode = mode;
    this.slowSamples = 0;
    this.fastSamples = 0;
    if (mode !== 'auto') this.active = mode;
    return this.active;
  }

  getActive(): QualityProfile {
    return this.active;
  }

  sample(frameMilliseconds: number): QualityProfile {
    if (this.mode !== 'auto') return this.active;
    const fps = frameMilliseconds > 0 ? 1000 / frameMilliseconds : 60;
    this.slowSamples = fps < 45 ? this.slowSamples + 1 : 0;
    this.fastSamples = fps >= 58 ? this.fastSamples + 1 : 0;
    const index = ORDER.indexOf(this.active);
    if (this.slowSamples >= this.sampleThreshold && index > 0) {
      this.active = ORDER[index - 1];
      this.slowSamples = 0;
      this.fastSamples = 0;
    } else if (this.fastSamples >= this.sampleThreshold && index < ORDER.length - 1) {
      this.active = ORDER[index + 1];
      this.slowSamples = 0;
      this.fastSamples = 0;
    }
    return this.active;
  }
}
