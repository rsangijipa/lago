import { FloatingLeaf } from '../types';

export function createFloatingLeaves(width: number, height: number): FloatingLeaf[] {
  const leaves: FloatingLeaf[] = [];

  // 1. Water Lily Pads (Nenúfares)
  const lilyCount = 5;
  for (let i = 0; i < lilyCount; i++) {
    const types: FloatingLeaf['type'][] = ['lily_pad', 'pink_lotus', 'lily_pad', 'white_lotus', 'lily_pad'];
    leaves.push({
      id: i,
      x: width * 0.15 + (i / lilyCount) * (width * 0.7) + (Math.random() - 0.5) * 60,
      y: height * 0.2 + Math.random() * (height * 0.6),
      targetX: 0,
      targetY: 0,
      radius: 38 + Math.random() * 24,
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.12,
      type: types[i % types.length],
      driftSpeedX: (Math.random() - 0.5) * 9,
      driftSpeedY: (Math.random() - 0.5) * 9,
      swayOffset: Math.random() * Math.PI * 2,
    });
  }

  // 2. Drifting Fallen Leaves / Petals (sakura petals & autumn leaves)
  const driftCount = 8;
  for (let i = 0; i < driftCount; i++) {
    leaves.push({
      id: lilyCount + i,
      x: Math.random() * width,
      y: Math.random() * height,
      targetX: 0,
      targetY: 0,
      radius: 12 + Math.random() * 10,
      angle: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.48,
      type: Math.random() > 0.4 ? 'cherry_petal' : 'autumn_leaf',
      driftSpeedX: 6 + Math.random() * 15,
      driftSpeedY: 3 + Math.random() * 9,
      swayOffset: Math.random() * Math.PI * 2,
    });
  }

  return leaves;
}

export function updateFloatingLeaves(
  leaves: FloatingLeaf[],
  width: number,
  height: number,
  ripples: { x: number; y: number; strength: number }[],
  _time: number,
  dtSeconds: number,
) {
  for (const leaf of leaves) {
    // Gentle natural drift
    leaf.x += leaf.driftSpeedX * dtSeconds;
    leaf.y += leaf.driftSpeedY * dtSeconds;
    leaf.angle += leaf.rotationSpeed * dtSeconds;

    // React to ripples passing by: push leaf gently along wave gradient
    for (const rip of ripples) {
      const dx = leaf.x - rip.x;
      const dy = leaf.y - rip.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120 && dist > 5) {
        const force = (rip.strength * 2.5) / (dist * 0.1 + 1);
        const frameScale = dtSeconds * 60;
        leaf.x += (dx / dist) * force * frameScale;
        leaf.y += (dy / dist) * force * frameScale;
        leaf.angle += (Math.random() - 0.5) * 0.02 * frameScale;
      }
    }

    // Wrap around screen boundaries with margin
    const m = leaf.radius * 2;
    if (leaf.x < -m) leaf.x = width + m;
    if (leaf.x > width + m) leaf.x = -m;
    if (leaf.y < -m) leaf.y = height + m;
    if (leaf.y > height + m) leaf.y = -m;
  }
}

export function renderLeavesOnCanvas(ctx: CanvasRenderingContext2D, leaves: FloatingLeaf[], time: number) {
  for (const leaf of leaves) {
    ctx.save();
    // Wave bobbing translation
    const bob = Math.sin(time * 0.002 + leaf.swayOffset) * 2;
    const currentX = leaf.x;
    const currentY = leaf.y + bob;

    ctx.translate(currentX, currentY);
    ctx.rotate(leaf.angle);
    const sprite = getLeafSprite(leaf);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    ctx.restore();
  }
}

const leafSpriteCache = new Map<string, HTMLCanvasElement>();

function getLeafSprite(leaf: FloatingLeaf): HTMLCanvasElement {
  const radius = Math.max(4, Math.round(leaf.radius / 2) * 2);
  const key = `${leaf.type}:${radius}`;
  const cached = leafSpriteCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(radius * 4.5);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.save();
  ctx.translate(10, 14);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 18, 14, 0.35)';
  ctx.filter = 'blur(7px)';
  ctx.fill();
  ctx.restore();
  if (leaf.type === 'lily_pad' || leaf.type === 'pink_lotus' || leaf.type === 'white_lotus') {
    drawLilyPad(ctx, radius);
    if (leaf.type === 'pink_lotus') drawLotusFlower(ctx, radius * 0.65, '#f078a6', '#fff0f5');
    if (leaf.type === 'white_lotus') drawLotusFlower(ctx, radius * 0.65, '#fff', '#eef9ff');
  } else if (leaf.type === 'cherry_petal') {
    drawCherryPetal(ctx, radius);
  } else {
    drawAutumnLeaf(ctx, radius);
  }
  leafSpriteCache.set(key, canvas);
  return canvas;
}

function drawLilyPad(ctx: CanvasRenderingContext2D, r: number) {
  const notchAngle = 0.35; // The characteristic radial notch in water lily pads

  ctx.beginPath();
  ctx.arc(0, 0, r, notchAngle, Math.PI * 2 - notchAngle);
  ctx.lineTo(0, 0);
  ctx.closePath();

  // Radial gradient: Vibrant emerald green with fresh lighter center
  const padGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.05, 0, 0, r);
  padGrad.addColorStop(0, '#53a059');
  padGrad.addColorStop(0.65, '#3b7a42');
  padGrad.addColorStop(0.95, '#285830');
  padGrad.addColorStop(1, '#1b3d21');

  ctx.fillStyle = padGrad;
  ctx.fill();

  // Delicate radial vein lines
  ctx.strokeStyle = 'rgba(170, 230, 180, 0.35)';
  ctx.lineWidth = 1.2;
  const veins = 9;
  for (let i = 0; i < veins; i++) {
    const a = notchAngle + (i / (veins - 1)) * (Math.PI * 2 - notchAngle * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r * 0.88), Math.sin(a) * (r * 0.88));
    ctx.stroke();
  }

  // Pad rim rimlight
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Tiny water bead rolling on the pad
  ctx.beginPath();
  ctx.arc(r * 0.3, -r * 0.2, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.28, -r * 0.22, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function drawLotusFlower(
  ctx: CanvasRenderingContext2D,
  size: number,
  primaryColor: string,
  tipColor: string,
) {
  const petals = 8;
  ctx.save();
  // Outer petals
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate((i / petals) * Math.PI * 2);
    drawSinglePetal(ctx, size, size * 0.45, primaryColor, tipColor);
    ctx.restore();
  }
  // Inner petals
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate(((i + 0.5) / petals) * Math.PI * 2);
    drawSinglePetal(ctx, size * 0.72, size * 0.38, primaryColor, tipColor);
    ctx.restore();
  }

  // Golden stamen center
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcf33';
  ctx.fill();
  ctx.restore();
}

function drawSinglePetal(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  baseCol: string,
  tipCol: string,
) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(width * 0.8, length * 0.5, 0, length);
  ctx.quadraticCurveTo(-width * 0.8, length * 0.5, 0, 0);
  ctx.closePath();

  const petalGrad = ctx.createLinearGradient(0, 0, 0, length);
  petalGrad.addColorStop(0, baseCol);
  petalGrad.addColorStop(1, tipCol);
  ctx.fillStyle = petalGrad;
  ctx.fill();
}

function drawCherryPetal(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(r * 0.7, -r * 0.4, r * 0.9, r * 0.6, 0, r * 1.3);
  ctx.bezierCurveTo(-r * 0.9, r * 0.6, -r * 0.7, -r * 0.4, 0, 0);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, r * 1.3);
  grad.addColorStop(0, '#ffcad4');
  grad.addColorStop(1, '#f72585');
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawAutumnLeaf(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.8, -r * 0.2, r * 0.6, r * 0.5);
  ctx.quadraticCurveTo(r * 0.2, r * 0.8, 0, r);
  ctx.quadraticCurveTo(-r * 0.2, r * 0.8, -r * 0.6, r * 0.5);
  ctx.quadraticCurveTo(-r * 0.8, -r * 0.2, 0, -r);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, '#e07a5f');
  grad.addColorStop(0.6, '#d48c3b');
  grad.addColorStop(1, '#a84224');
  ctx.fillStyle = grad;
  ctx.fill();

  // Spine line
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.8);
  ctx.lineTo(0, r * 0.8);
  ctx.strokeStyle = 'rgba(70, 20, 10, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
