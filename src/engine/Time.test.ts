import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './Time';

describe('FixedStepClock', () => {
  it('produces stable 60 Hz steps and caps long frames', () => {
    const clock = new FixedStepClock(1 / 60, 0.05);
    expect(clock.consume(0.034)).toBe(2);
    expect(clock.consume(1)).toBe(3);
  });

  it('drops accumulated time when reset', () => {
    const clock = new FixedStepClock(0.01, 0.05);
    clock.consume(0.009);
    clock.reset();
    expect(clock.consume(0.001)).toBe(0);
  });
});
