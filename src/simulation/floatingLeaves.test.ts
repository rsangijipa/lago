import { describe, expect, it, vi } from 'vitest';
import type { FloatingLeaf } from '../types';
import { updateFloatingLeaves } from './floatingLeaves';

const leaf = (): FloatingLeaf => ({
  id: 1,
  x: 100,
  y: 100,
  targetX: 0,
  targetY: 0,
  radius: 10,
  angle: 0,
  rotationSpeed: 0.6,
  type: 'cherry_petal',
  driftSpeedX: 12,
  driftSpeedY: 6,
  swayOffset: 0,
});

describe('updateFloatingLeaves', () => {
  it('moves the same distance for equivalent elapsed time at different frame rates', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const at30 = leaf();
    const at60 = leaf();
    for (let i = 0; i < 30; i++) updateFloatingLeaves([at30], 1000, 1000, [], i / 30, 1 / 30);
    for (let i = 0; i < 60; i++) updateFloatingLeaves([at60], 1000, 1000, [], i / 60, 1 / 60);
    expect(at30.x).toBeCloseTo(at60.x, 6);
    expect(at30.y).toBeCloseTo(at60.y, 6);
    expect(at30.angle).toBeCloseTo(at60.angle, 6);
    vi.restoreAllMocks();
  });
});
