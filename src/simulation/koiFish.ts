import { KoiFishData, FoodPellet } from '../types';

export function createKoiFish(count: number, width: number, height: number): KoiFishData[] {
  const varieties: ('kohaku' | 'yamabuki' | 'sanke' | 'shiro_bekko')[] = [
    'kohaku',
    'yamabuki',
    'sanke',
    'shiro_bekko',
    'kohaku',
    'yamabuki',
  ];

  const fishList: KoiFishData[] = [];
  const spineSegments = 12;

  for (let i = 0; i < count; i++) {
    const x = Math.random() * (width * 0.8) + width * 0.1;
    const y = Math.random() * (height * 0.8) + height * 0.1;
    const angle = Math.random() * Math.PI * 2;
    const size = 32 + Math.random() * 26; // Scale of the fish
    const spineLength = size * 2.8;
    const segDist = spineLength / spineSegments;

    const bodyPoints: { x: number; y: number }[] = [];
    for (let s = 0; s < spineSegments; s++) {
      bodyPoints.push({
        x: x - Math.cos(angle) * s * segDist,
        y: y - Math.sin(angle) * s * segDist,
      });
    }

    fishList.push({
      id: i,
      x,
      y,
      targetX: Math.random() * width,
      targetY: Math.random() * height,
      speed: 1.2 + Math.random() * 0.8,
      maxSpeed: 3.8 + Math.random() * 1.5,
      angle,
      targetAngle: angle,
      size,
      variety: varieties[i % varieties.length],
      bodyPoints,
      spineLength,
      wigglePhase: Math.random() * Math.PI * 2,
      wiggleSpeed: 0.15 + Math.random() * 0.05,
      isFrightened: false,
      frightenedTimer: 0,
    });
  }

  return fishList;
}

export function updateKoiFish(
  fishList: KoiFishData[],
  width: number,
  height: number,
  ripples: { x: number; y: number; strength: number }[],
  foodPellets: FoodPellet[],
  dt: number,
) {
  const spineSegments = 12;

  for (const fish of fishList) {
    // 1. Check for nearby ripple disturbances (frighten response)
    for (const rip of ripples) {
      const dx = fish.x - rip.x;
      const dy = fish.y - rip.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 160 && rip.strength > 0.08) {
        fish.isFrightened = true;
        fish.frightenedTimer = 750; // milliseconds of frightened darting
        // Dart directly away from the disturbance
        fish.targetAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.6;
        fish.speed = fish.maxSpeed * 1.6;
      }
    }

    // 2. Check for food pellets
    let targetFound = false;
    if (!fish.isFrightened && foodPellets.length > 0) {
      let closestDist = 280;
      let closestFood: FoodPellet | null = null;
      for (const food of foodPellets) {
        if (food.consumed) continue;
        const dx = food.x - fish.x;
        const dy = food.y - fish.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closestFood = food;
        }
      }

      if (closestFood) {
        const dx = closestFood.x - fish.x;
        const dy = closestFood.y - fish.y;
        fish.targetAngle = Math.atan2(dy, dx);
        fish.speed = Math.min(fish.speed + 0.1, 2.5);
        targetFound = true;

        // Nibble food
        if (closestDist < fish.size * 0.7) {
          closestFood.consumed = true;
          fish.targetAngle += (Math.random() - 0.5) * 1.5;
        }
      }
    }

    // 3. Normal wandering behavior
    if (!targetFound) {
      if (fish.isFrightened) {
        fish.frightenedTimer -= dt;
        if (fish.frightenedTimer <= 0) {
          fish.isFrightened = false;
        }
        fish.speed = Math.max(1.5, fish.speed * 0.97);
      } else {
        // Natural cruising with slight cruising speed fluctuations
        fish.speed = fish.speed * 0.98 + (1.2 + Math.sin(fish.wigglePhase * 0.4) * 0.4) * 0.02;

        // Smooth course adjustments towards random waypoints
        const toTargetX = fish.targetX - fish.x;
        const toTargetY = fish.targetY - fish.y;
        const distToTarget = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

        if (distToTarget < 100 || Math.random() < 0.01) {
          const margin = 100;
          fish.targetX = margin + Math.random() * (width - margin * 2);
          fish.targetY = margin + Math.random() * (height - margin * 2);
        }

        fish.targetAngle = Math.atan2(toTargetY, toTargetX);
      }
    }

    // 4. Boundary steering (keep within pond)
    const padding = 80;
    let repelX = 0;
    let repelY = 0;
    if (fish.x < padding) repelX += 1;
    if (fish.x > width - padding) repelX -= 1;
    if (fish.y < padding) repelY += 1;
    if (fish.y > height - padding) repelY -= 1;

    if (repelX !== 0 || repelY !== 0) {
      fish.targetAngle = Math.atan2(repelY, repelX);
      fish.speed = Math.max(fish.speed, 2.0);
    }

    // Keep a comfortable personal space so the school does not visually overlap.
    for (const other of fishList) {
      if (other === fish) continue;
      const dx = fish.x - other.x;
      const dy = fish.y - other.y;
      const distance = Math.hypot(dx, dy) || 1;
      const comfortDistance = (fish.size + other.size) * 1.15;
      if (distance < comfortDistance) {
        const separation = (comfortDistance - distance) / comfortDistance;
        fish.targetAngle = Math.atan2(dy, dx);
        fish.speed = Math.max(fish.speed, 1.4 + separation * 1.6);
      }
    }

    // 5. Turn smoothly towards target angle
    let diff = fish.targetAngle - fish.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    const turnRate = fish.isFrightened ? 0.12 : 0.045;
    fish.angle += diff * turnRate;

    // 6. Advance head position
    const moveStep = fish.speed * (dt / 16.6);
    fish.x += Math.cos(fish.angle) * moveStep;
    fish.y += Math.sin(fish.angle) * moveStep;

    // 7. Update spine wiggle & segments (Inverse Kinematics chain)
    fish.wigglePhase += fish.wiggleSpeed * fish.speed * (dt / 16.6);
    const segDist = fish.spineLength / spineSegments;

    // Head is segment 0
    fish.bodyPoints[0] = { x: fish.x, y: fish.y };

    // Spine segments follow their predecessor with organic wave undulation
    for (let s = 1; s < spineSegments; s++) {
      const prev = fish.bodyPoints[s - 1];
      const curr = fish.bodyPoints[s];

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const currentDist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Natural S-curve lateral wave
      const lateralFactor = Math.sin(fish.wigglePhase - s * 0.5) * (s * 0.9) * (fish.speed / 2.0);
      const normalX = -Math.sin(fish.angle) * lateralFactor;
      const normalY = Math.cos(fish.angle) * lateralFactor;

      const targetX = prev.x + (dx / currentDist) * segDist + normalX * 0.15;
      const targetY = prev.y + (dy / currentDist) * segDist + normalY * 0.15;

      curr.x += (targetX - curr.x) * 0.55;
      curr.y += (targetY - curr.y) * 0.55;
    }
  }
}

/**
 * Draws realistic Koi Carp with procedural fins, gradients, and traditional Japanese markings
 */
export function renderKoiFishOnCanvas(
  ctx: CanvasRenderingContext2D,
  fishList: KoiFishData[],
  ambient: 'day' | 'sunset' | 'night',
) {
  for (const fish of fishList) {
    const { bodyPoints, size, variety, angle, wigglePhase } = fish;
    if (bodyPoints.length < 5) continue;

    ctx.save();

    // 1. Draw Fish Underwater Shadow (cast onto the riverbed)
    ctx.save();
    ctx.translate(20, 26);
    ctx.beginPath();
    ctx.moveTo(bodyPoints[0].x, bodyPoints[0].y);
    for (let i = 1; i < bodyPoints.length; i++) {
      ctx.lineTo(bodyPoints[i].x, bodyPoints[i].y);
    }
    ctx.lineWidth = size * 0.75;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10, 18, 14, 0.4)';
    ctx.filter = 'blur(10px)';
    ctx.stroke();
    ctx.restore();

    // 2. Body radii along the spine (head to tail taper)
    const spineCount = bodyPoints.length;
    const bodyWidths: number[] = [];
    for (let i = 0; i < spineCount; i++) {
      const t = i / (spineCount - 1);
      // Koi profile: rounded snout, wide gill area, tapering sleek body, narrow caudal peduncle
      let w = Math.sin(t * Math.PI) * size * 0.55;
      if (t < 0.2) w = (0.25 + t * 2.0) * size * 0.45;
      bodyWidths.push(Math.max(w, 2.5));
    }

    // 3. Pectoral Fins (Asymmetric rhythmic flap)
    const head = bodyPoints[0];
    const pectoralSeg = bodyPoints[1];
    const finAngle = Math.atan2(head.y - pectoralSeg.y, head.x - pectoralSeg.x);
    const finWiggle = Math.sin(wigglePhase) * 0.28;

    ctx.save();
    ctx.translate(pectoralSeg.x, pectoralSeg.y);
    // Left fin
    ctx.save();
    ctx.rotate(finAngle + Math.PI * 0.55 + finWiggle);
    drawFin(ctx, size * 0.7, size * 0.35, variety);
    ctx.restore();
    // Right fin
    ctx.save();
    ctx.rotate(finAngle - Math.PI * 0.55 - finWiggle);
    drawFin(ctx, size * 0.7, size * 0.35, variety);
    ctx.restore();
    ctx.restore();

    // 4. Pelvic and Dorsal fins
    const pelvicSeg = bodyPoints[6];
    ctx.save();
    ctx.translate(pelvicSeg.x, pelvicSeg.y);
    ctx.rotate(finAngle + Math.PI * 0.7);
    drawFin(ctx, size * 0.4, size * 0.2, variety);
    ctx.rotate(-Math.PI * 1.4);
    drawFin(ctx, size * 0.4, size * 0.2, variety);
    ctx.restore();

    // 5. Construct smooth curved polygon along left and right flanks
    const leftFlank: { x: number; y: number }[] = [];
    const rightFlank: { x: number; y: number }[] = [];

    for (let i = 0; i < spineCount; i++) {
      const curr = bodyPoints[i];
      let segAngle = angle;
      if (i < spineCount - 1) {
        const next = bodyPoints[i + 1];
        segAngle = Math.atan2(next.y - curr.y, next.x - curr.x);
      } else {
        const prev = bodyPoints[i - 1];
        segAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      }

      const perpAngle = segAngle + Math.PI * 0.5;
      const w = bodyWidths[i];

      leftFlank.push({
        x: curr.x + Math.cos(perpAngle) * w,
        y: curr.y + Math.sin(perpAngle) * w,
      });
      rightFlank.push({
        x: curr.x - Math.cos(perpAngle) * w,
        y: curr.y - Math.sin(perpAngle) * w,
      });
    }

    // 6. Draw Body Contour
    ctx.beginPath();
    ctx.moveTo(bodyPoints[0].x, bodyPoints[0].y); // Snout
    for (let i = 0; i < leftFlank.length; i++) {
      ctx.lineTo(leftFlank[i].x, leftFlank[i].y);
    }
    const tailEnd = bodyPoints[spineCount - 1];
    ctx.lineTo(tailEnd.x, tailEnd.y);
    for (let i = rightFlank.length - 1; i >= 0; i--) {
      ctx.lineTo(rightFlank[i].x, rightFlank[i].y);
    }
    ctx.closePath();

    // Body Base Color (Pearly White or Metallic Gold)
    const baseColor = variety === 'yamabuki' ? '#ffaa2b' : '#f5f4ef';
    ctx.fillStyle = baseColor;
    ctx.fill();

    // 3D Shading along body spine
    ctx.save();
    ctx.clip();
    const fishGrad = ctx.createLinearGradient(
      leftFlank[2]?.x || 0,
      leftFlank[2]?.y || 0,
      rightFlank[2]?.x || 0,
      rightFlank[2]?.y || 0,
    );
    fishGrad.addColorStop(0, 'rgba(0, 0, 0, 0.22)');
    fishGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    fishGrad.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = fishGrad;
    ctx.fill();

    // 7. Paint Distinctive Japanese Koi Pattern Markings (Hi & Sumi)
    if (variety === 'kohaku') {
      // Vivid Red-Orange (Hi) patches on white body
      ctx.fillStyle = '#eb4023';
      // Head patch (Tancho or standard crown)
      ctx.beginPath();
      ctx.ellipse(bodyPoints[1].x, bodyPoints[1].y, size * 0.32, size * 0.24, angle, 0, Math.PI * 2);
      ctx.fill();
      // Mid-body stepped patches
      ctx.beginPath();
      ctx.ellipse(bodyPoints[4].x, bodyPoints[4].y, size * 0.36, size * 0.28, angle + 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bodyPoints[7].x, bodyPoints[7].y, size * 0.28, size * 0.22, angle - 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (variety === 'sanke') {
      // Red markings
      ctx.fillStyle = '#e8391d';
      ctx.beginPath();
      ctx.ellipse(bodyPoints[1].x, bodyPoints[1].y, size * 0.3, size * 0.22, angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bodyPoints[5].x, bodyPoints[5].y, size * 0.35, size * 0.26, angle, 0, Math.PI * 2);
      ctx.fill();
      // Black Sumi patches
      ctx.fillStyle = '#222326';
      ctx.beginPath();
      ctx.ellipse(bodyPoints[3].x, bodyPoints[3].y, size * 0.16, size * 0.12, angle + 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bodyPoints[8].x, bodyPoints[8].y, size * 0.18, size * 0.14, angle - 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (variety === 'shiro_bekko') {
      // Ink black markings on white
      ctx.fillStyle = '#1e2024';
      ctx.beginPath();
      ctx.ellipse(bodyPoints[3].x, bodyPoints[3].y, size * 0.2, size * 0.14, angle + 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(bodyPoints[6].x, bodyPoints[6].y, size * 0.24, size * 0.16, angle - 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (variety === 'yamabuki') {
      // Golden highlights
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.ellipse(bodyPoints[2].x, bodyPoints[2].y, size * 0.32, size * 0.25, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes
    const eyeOffsetX = Math.cos(angle + Math.PI * 0.5) * (size * 0.24);
    const eyeOffsetY = Math.sin(angle + Math.PI * 0.5) * (size * 0.24);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(head.x + eyeOffsetX, head.y + eyeOffsetY, 2.2, 0, Math.PI * 2);
    ctx.arc(head.x - eyeOffsetX, head.y - eyeOffsetY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Undo clip

    // 8. Caudal (Tail) Fin waving gracefully
    const tailSeg1 = bodyPoints[spineCount - 2];
    const tailSeg2 = bodyPoints[spineCount - 1];
    const tailAngle = Math.atan2(tailSeg2.y - tailSeg1.y, tailSeg2.x - tailSeg1.x);

    ctx.save();
    ctx.translate(tailEnd.x, tailEnd.y);
    ctx.rotate(tailAngle);
    drawTailFin(ctx, size * 1.1, size * 0.75, variety, wigglePhase);
    ctx.restore();

    // Night bioluminescent glow if night mode
    if (ambient === 'night') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(head.x, head.y, size * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(70, 190, 255, 0.08)';
      ctx.filter = 'blur(12px)';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }
}

function drawFin(ctx: CanvasRenderingContext2D, length: number, width: number, variety: string) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(length * 0.3, width * 0.9, length * 0.7, width * 0.8, length, 0);
  ctx.bezierCurveTo(length * 0.7, -width * 0.3, length * 0.3, -width * 0.2, 0, 0);
  ctx.closePath();
  ctx.fillStyle = variety === 'yamabuki' ? 'rgba(255, 185, 60, 0.65)' : 'rgba(255, 255, 255, 0.65)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTailFin(
  ctx: CanvasRenderingContext2D,
  length: number,
  width: number,
  variety: string,
  wiggle: number,
) {
  const tailSway = Math.sin(wiggle) * 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(
    length * 0.4,
    -width * 0.7,
    length * 0.9,
    -width * 0.9 + tailSway,
    length,
    -width * 0.4 + tailSway,
  );
  ctx.bezierCurveTo(length * 0.75, 0 + tailSway, length * 0.75, 0 + tailSway, length, width * 0.4 + tailSway);
  ctx.bezierCurveTo(length * 0.9, width * 0.9 + tailSway, length * 0.4, width * 0.7, 0, 0);
  ctx.closePath();

  ctx.fillStyle = variety === 'yamabuki' ? 'rgba(255, 175, 50, 0.7)' : 'rgba(255, 255, 255, 0.7)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}
