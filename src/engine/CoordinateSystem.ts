export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface SurfaceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function clampPoint(point: NormalizedPoint): NormalizedPoint {
  return { x: clamp01(point.x), y: clamp01(point.y) };
}

export function pointerToNormalized(clientX: number, clientY: number, rect: SurfaceRect): NormalizedPoint {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
  return clampPoint({ x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height });
}

export function normalizedToPixels(point: NormalizedPoint, width: number, height: number): NormalizedPoint {
  const normalized = clampPoint(point);
  return { x: normalized.x * width, y: normalized.y * height };
}
