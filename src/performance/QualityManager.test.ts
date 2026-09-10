import { describe, expect, it } from 'vitest';
import { QualityManager } from './QualityManager';

describe('QualityManager', () => {
  it('downgrades only after sustained slow frames', () => {
    const manager = new QualityManager('immersive', 3);
    expect(manager.sample(25)).toBe('immersive');
    expect(manager.sample(25)).toBe('immersive');
    expect(manager.sample(25)).toBe('balanced');
  });

  it('upgrades only after sustained fast frames', () => {
    const manager = new QualityManager('economy', 3);
    expect(manager.sample(16)).toBe('economy');
    expect(manager.sample(16)).toBe('economy');
    expect(manager.sample(16)).toBe('balanced');
  });

  it('keeps manual quality untouched', () => {
    const manager = new QualityManager('balanced', 1);
    manager.setMode('immersive');
    expect(manager.sample(40)).toBe('immersive');
  });
});
