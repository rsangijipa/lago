import { describe, expect, it } from 'vitest';
import { clampPoint, normalizedToPixels, pointerToNormalized } from './CoordinateSystem';

describe('coordinate system', () => {
  it('maps normalized positions to the active texture size', () => {
    expect(normalizedToPixels({ x: 0.25, y: 0.75 }, 512, 768)).toEqual({ x: 128, y: 576 });
  });

  it('clamps pointer coordinates to the interactive surface', () => {
    const rect = { left: 100, top: 50, width: 400, height: 200 };
    expect(pointerToNormalized(600, 0, rect)).toEqual({ x: 1, y: 0 });
    expect(clampPoint({ x: -0.2, y: 1.2 })).toEqual({ x: 0, y: 1 });
  });
});
