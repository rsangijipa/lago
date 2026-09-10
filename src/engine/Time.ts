export class FixedStepClock {
  private accumulator = 0;

  constructor(
    readonly stepSeconds = 1 / 60,
    readonly maxFrameSeconds = 0.05,
  ) {}

  consume(elapsedSeconds: number): number {
    this.accumulator += Math.min(Math.max(elapsedSeconds, 0), this.maxFrameSeconds);
    const steps = Math.floor((this.accumulator + Number.EPSILON) / this.stepSeconds);
    this.accumulator -= steps * this.stepSeconds;
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
  }
}

export const secondsFromMilliseconds = (milliseconds: number): number =>
  Math.min(Math.max(milliseconds, 0), 50) / 1000;
