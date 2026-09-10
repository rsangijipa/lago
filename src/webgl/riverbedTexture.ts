/**
 * Generates procedural high-resolution textures for the pond bed:
 * - Natural river pebbles (pedras de rio) with varying sizes, organic tones, and ambient occlusion
 * - Underwater sand, gravel, and subtle moss accents
 */

import { PondEnvironment } from '../types';

const environmentBeds: Record<PondEnvironment, { colors: [string, string, string]; stone: string[] }> = {
  japanese_garden: {
    colors: ['#1c2e28', '#243b32', '#1b2d26'],
    stone: ['#3d4e48', '#554f47', '#425157', '#685c4d', '#32483d', '#5d6872', '#4b4845', '#746252'],
  },
  mountain_spring: {
    colors: ['#17323a', '#28515a', '#17323a'],
    stone: ['#526b70', '#7a8990', '#42565c', '#84979b', '#35525a', '#6c7c78'],
  },
  tropical_lagoon: {
    colors: ['#285b58', '#3d8177', '#21635d'],
    stone: ['#c5b28a', '#8eb99a', '#769d8d', '#d4c28e', '#4b8779', '#a9b98c'],
  },
  moonlit_marsh: {
    colors: ['#182836', '#243b46', '#14242d'],
    stone: ['#34454b', '#42504c', '#273c3d', '#596454', '#2b3537', '#4c5950'],
  },
};

export function createRiverbedCanvas(
  width = 1024,
  height = 1024,
  environment: PondEnvironment = 'japanese_garden',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Base underwater river sand / silt
  const bed = environmentBeds[environment];
  const baseGrad = ctx.createLinearGradient(0, 0, width, height);
  baseGrad.addColorStop(0, bed.colors[0]);
  baseGrad.addColorStop(0.5, bed.colors[1]);
  baseGrad.addColorStop(1, bed.colors[2]);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Micro gravel & sand texture
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Layered River Stones (Pedras de Rio)
  // Stone color palettes: Slate greys, warm terracotta/sandstones, river moss greens, smooth dark basalt
  const stonePalettes = bed.stone.map((base) => ({ base, light: '#9aa79a', dark: '#1b2721' }));

  // Pseudo-random deterministic distribution of river stones
  interface Stone {
    x: number;
    y: number;
    rx: number;
    ry: number;
    angle: number;
    palette: (typeof stonePalettes)[0];
    hasMoss: boolean;
  }

  const stones: Stone[] = [];
  const cols = 22;
  const rows = 22;
  const cellW = width / cols;
  const cellH = height / rows;

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // Jitter center
      const x = (c + 0.5 + (Math.random() - 0.5) * 0.7) * cellW;
      const y = (r + 0.5 + (Math.random() - 0.5) * 0.7) * cellH;
      const rx = cellW * (0.35 + Math.random() * 0.42);
      const ry = cellH * (0.35 + Math.random() * 0.42);
      const angle = Math.random() * Math.PI * 2;
      const palette = stonePalettes[Math.floor(Math.random() * stonePalettes.length)];
      const hasMoss = Math.random() < 0.28;

      stones.push({ x, y, rx, ry, angle, palette, hasMoss });
    }
  }

  // Draw Stone Drop Shadows (Ambient Occlusion on the river bottom)
  ctx.save();
  for (const s of stones) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.beginPath();
    ctx.ellipse(4, 6, s.rx + 3, s.ry + 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 16, 14, 0.45)';
    ctx.filter = 'blur(5px)';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Draw Stones Bodies with 3D spherical shading
  for (const s of stones) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);

    // Stone path
    ctx.beginPath();
    // Slightly organic distorted pebble
    const points = 12;
    for (let p = 0; p < points; p++) {
      const a = (p / points) * Math.PI * 2;
      const distVariation = 1.0 + Math.sin(p * 2.3 + s.x) * 0.08;
      const px = Math.cos(a) * s.rx * distVariation;
      const py = Math.sin(a) * s.ry * distVariation;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    // 3D Spherical gradient for stone
    const stoneGrad = ctx.createRadialGradient(
      -s.rx * 0.25,
      -s.ry * 0.3,
      s.rx * 0.1,
      0,
      0,
      Math.max(s.rx, s.ry) * 1.1,
    );
    stoneGrad.addColorStop(0, s.palette.light);
    stoneGrad.addColorStop(0.55, s.palette.base);
    stoneGrad.addColorStop(1, s.palette.dark);

    ctx.fillStyle = stoneGrad;
    ctx.fill();

    // Subtle edge contour
    ctx.strokeStyle = 'rgba(15, 20, 18, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Moss on stone edge if applicable
    if (s.hasMoss) {
      ctx.beginPath();
      ctx.ellipse(s.rx * 0.2, s.ry * 0.3, s.rx * 0.45, s.ry * 0.35, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(38, 77, 48, 0.42)';
      ctx.fill();
    }

    ctx.restore();
  }

  // Draw smaller gravel scatter over crevices
  ctx.fillStyle = '#22302a';
  for (let g = 0; g < 160; g++) {
    const gx = Math.random() * width;
    const gy = Math.random() * height;
    const gr = 2 + Math.random() * 5;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Sky reflection gradient texture:
 * Generates natural sky reflection with soft horizon and cloud tints
 */
export function createSkyCanvas(
  width = 512,
  height = 512,
  mode: 'day' | 'sunset' | 'night' = 'day',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (mode === 'day') {
    grad.addColorStop(0, '#74a7d4'); // Zenith blue
    grad.addColorStop(0.5, '#99c2e6'); // Sky mid
    grad.addColorStop(0.85, '#dbebf7'); // Low horizon
    grad.addColorStop(1, '#ffffff'); // Sun haze
  } else if (mode === 'sunset') {
    grad.addColorStop(0, '#2d2146'); // Twilight indigo
    grad.addColorStop(0.4, '#87405c'); // Magenta
    grad.addColorStop(0.7, '#d6683b'); // Warm sunset amber
    grad.addColorStop(1, '#ffc470'); // Golden horizon
  } else {
    // Night
    grad.addColorStop(0, '#0a101d'); // Midnight deep blue
    grad.addColorStop(0.6, '#111d2e');
    grad.addColorStop(0.9, '#1a2a40');
    grad.addColorStop(1, '#2c4366'); // Moonlit horizon
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft ambient cloud wisps
  ctx.fillStyle = mode === 'night' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.arc(width * 0.35, height * 0.3, width * 0.4, 0, Math.PI * 2);
  ctx.filter = 'blur(40px)';
  ctx.fill();

  return canvas;
}
