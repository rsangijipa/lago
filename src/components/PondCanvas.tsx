import React, { useEffect, useRef, useCallback, useState, useImperativeHandle, forwardRef } from 'react';
import { WebGLWaterSimulation } from '../webgl/waterSim';
import { createRiverbedCanvas, createSkyCanvas } from '../webgl/riverbedTexture';
import { createKoiFish, updateKoiFish, renderKoiFishOnCanvas } from '../simulation/koiFish';
import {
  createFloatingLeaves,
  updateFloatingLeaves,
  renderLeavesOnCanvas,
} from '../simulation/floatingLeaves';
import { waterAudio } from '../audio/waterSound';
import { WaterSimConfig, KoiFishData, FloatingLeaf, FoodPellet, SplashParticle, RainDrop } from '../types';
import { QualityProfile } from '../types';
import { normalizedToPixels, pointerToNormalized, type NormalizedPoint } from '../engine/CoordinateSystem';
import { FixedStepClock, secondsFromMilliseconds } from '../engine/Time';
import { QualityManager } from '../performance/QualityManager';

export interface PondCanvasHandle {
  clearLake: () => void;
  tossRandomStone: () => void;
  createCenterRipple: () => void;
  feedCenter: () => void;
}

interface PondCanvasProps {
  config: WaterSimConfig;
  onRippleCreated?: () => void;
  /** Called with progress 0–100 as the simulation initialises */
  onLoadProgress?: (progress: number) => void;
  /** Called once initialisation is fully complete */
  onLoadComplete?: () => void;
  onWebGLError?: (message: string | null) => void;
  onAudioStatus?: (status: { available: boolean; error: string | null }) => void;
}

const qualitySettings: Record<
  QualityProfile,
  { sim: number; texture: number; dpr: number; textureCadence: number }
> = {
  economy: { sim: 256, texture: 512, dpr: 1, textureCadence: 50 },
  balanced: { sim: 384, texture: 768, dpr: 1.5, textureCadence: 33 },
  immersive: { sim: 512, texture: 1024, dpr: 2, textureCadence: 33 },
};

export const PondCanvas = forwardRef<PondCanvasHandle, PondCanvasProps>(
  ({ config, onLoadProgress, onLoadComplete, onWebGLError, onAudioStatus }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [contextGeneration, setContextGeneration] = useState(0);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null); // 2D rain overlay
    const simRef = useRef<WebGLWaterSimulation | null>(null);

    // Simulation state refs
    const fishRef = useRef<KoiFishData[]>([]);
    const leavesRef = useRef<FloatingLeaf[]>([]);
    const foodRef = useRef<FoodPellet[]>([]);
    const splashParticlesRef = useRef<SplashParticle[]>([]);
    const recentRipplesRef = useRef<(NormalizedPoint & { strength: number })[]>([]);
    const rainDropsRef = useRef<RainDrop[]>([]); // visual rain streaks

    // Offscreen canvases for GPU texture uploads
    const riverbedCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const underwaterCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const floatingCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Interaction & loop state
    const activePointersRef = useRef<Map<number, { lastX: number; lastY: number; lastTime: number }>>(
      new Map(),
    );
    const lastRainDropTimeRef = useRef<number>(0);
    const lastKoiWakeTimeRef = useRef<number>(0);
    const animFrameIdRef = useRef<number>(0);
    const windPhaseRef = useRef<number>(0);
    const isMountedRef = useRef(false);
    const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
    const lastTextureUploadRef = useRef(0);
    const reducedMotionRef = useRef(false);
    const initialQuality: QualityProfile = config.quality === 'auto' ? 'balanced' : config.quality;
    const qualityRef = useRef<QualityProfile>(initialQuality);
    const qualityManagerRef = useRef(new QualityManager(initialQuality));
    const isPausedRef = useRef(document.visibilityState === 'hidden');

    const scheduleTimeout = useCallback((callback: () => void, delay: number) => {
      const timeoutId = setTimeout(() => {
        timeoutIdsRef.current.delete(timeoutId);
        if (isMountedRef.current) callback();
      }, delay);
      timeoutIdsRef.current.add(timeoutId);
    }, []);

    // Config snapshot ref — avoids restarting the rAF loop on every config change
    const configRef = useRef(config);
    useEffect(() => {
      configRef.current = config;
    }, [config]);

    // ── Audio sync ──────────────────────────────────────────────────────────
    useEffect(() => {
      waterAudio.setMuted(!config.soundEnabled);
      onAudioStatus?.({ available: waterAudio.getAvailable(), error: waterAudio.getError() });
    }, [config.soundEnabled, onAudioStatus]);
    useEffect(() => {
      waterAudio.setRain(config.rainIntensity);
      onAudioStatus?.({ available: waterAudio.getAvailable(), error: waterAudio.getError() });
    }, [config.rainIntensity, onAudioStatus]);

    useEffect(() => {
      const reportAudioStatus = () => {
        onAudioStatus?.({ available: waterAudio.getAvailable(), error: waterAudio.getError() });
      };
      waterAudio.onStatusChange(reportAudioStatus);
      return () => waterAudio.onStatusChange(null);
    }, [onAudioStatus]);

    useEffect(() => {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => {
        reducedMotionRef.current = media.matches;
      };
      update();
      media.addEventListener?.('change', update);
      return () => media.removeEventListener?.('change', update);
    }, []);

    useEffect(() => {
      const onVisibility = () => {
        isPausedRef.current = document.visibilityState === 'hidden';
        if (isPausedRef.current) waterAudio.suspend();
        else waterAudio.resume();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const onLost = (event: Event) => {
        event.preventDefault();
        isPausedRef.current = true;
        onWebGLError?.('O contexto gráfico foi perdido. Tentando restaurar…');
      };
      const onRestored = () => {
        isPausedRef.current = false;
        setContextGeneration((value) => value + 1);
      };
      canvas.addEventListener('webglcontextlost', onLost);
      canvas.addEventListener('webglcontextrestored', onRestored);
      return () => {
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
      };
    }, [onWebGLError]);

    // ── Initialisation (runs once) ──────────────────────────────────────────
    useEffect(() => {
      isMountedRef.current = true;
      const timeoutIds = timeoutIdsRef.current;
      const canvas = canvasRef.current;
      if (!canvas) {
        isMountedRef.current = false;
        return;
      }

      // Stage 0 – WebGL context
      onLoadProgress?.(10);
      let sim: WebGLWaterSimulation;
      try {
        const quality = qualitySettings[qualityRef.current];
        sim = new WebGLWaterSimulation(canvas, quality.sim);
        simRef.current = sim;
        onWebGLError?.(null);
      } catch (err) {
        console.error('WebGL init failed:', err);
        onWebGLError?.(
          'A aceleração WebGL não está disponível. Você ainda pode usar os controles, mas a água interativa não pôde ser renderizada.',
        );
        isMountedRef.current = false;
        onLoadProgress?.(100);
        onLoadComplete?.();
        return;
      }
      onLoadProgress?.(25);

      // Stage 1 – Offscreen canvases
      const textureSize = qualitySettings[qualityRef.current].texture;
      riverbedCanvasRef.current = createRiverbedCanvas(
        textureSize,
        textureSize,
        configRef.current.environment,
      );
      sim.updateRiverbedTexture(riverbedCanvasRef.current);
      onLoadProgress?.(45);

      const underCanvas = document.createElement('canvas');
      underCanvas.width = textureSize;
      underCanvas.height = textureSize;
      underwaterCanvasRef.current = underCanvas;

      const floatCanvas = document.createElement('canvas');
      floatCanvas.width = textureSize;
      floatCanvas.height = textureSize;
      floatingCanvasRef.current = floatCanvas;
      onLoadProgress?.(58);

      // Stage 2 – Entities
      fishRef.current = createKoiFish(7, textureSize, textureSize);
      onLoadProgress?.(72);
      leavesRef.current = createFloatingLeaves(textureSize, textureSize);
      onLoadProgress?.(84);

      // Stage 3 – Initial GPU textures
      const sky = createSkyCanvas(512, 512, configRef.current.ambient);
      sim.updateSkyTexture(sky);
      onLoadProgress?.(94);

      // Welcome ripples after a short settle
      scheduleTimeout(() => {
        sim.addDrop(0.5, 0.5, 0.05, 0.25);
        sim.addDrop(0.42, 0.45, 0.04, 0.15);
        sim.addDrop(0.58, 0.52, 0.04, 0.18);
        onLoadProgress?.(100);
        onLoadComplete?.();
      }, 350);

      return () => {
        isMountedRef.current = false;
        timeoutIds.forEach(clearTimeout);
        timeoutIds.clear();
        sim.dispose();
        simRef.current = null;
      };
    }, [contextGeneration, scheduleTimeout, onLoadComplete, onLoadProgress, onWebGLError]);

    // ── Sky texture refresh on ambient change ───────────────────────────────
    useEffect(() => {
      if (!simRef.current) return;
      const sky = createSkyCanvas(512, 512, config.ambient);
      simRef.current.updateSkyTexture(sky);
    }, [config.ambient]);

    // Rebuild the procedural bed only when the chosen ecosystem changes.
    useEffect(() => {
      const textureSize = qualitySettings[qualityRef.current].texture;
      riverbedCanvasRef.current = createRiverbedCanvas(textureSize, textureSize, config.environment);
      simRef.current?.updateRiverbedTexture(riverbedCanvasRef.current);
      lastTextureUploadRef.current = 0;
    }, [config.environment]);

    // ── Resize handler ──────────────────────────────────────────────────────
    const handleResize = useCallback(() => {
      const canvas = canvasRef.current;
      const overlay = overlayCanvasRef.current;
      if (!canvas) return;

      const dpr = Math.min(window.devicePixelRatio || 1, qualitySettings[qualityRef.current].dpr);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (overlay) {
        overlay.width = w;
        overlay.height = h;
      }
    }, []);

    useEffect(() => {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [handleResize]);

    useEffect(() => {
      const profile = qualityManagerRef.current.setMode(config.quality);
      if (profile === qualityRef.current) return;
      qualityRef.current = profile;
      const settings = qualitySettings[profile];
      simRef.current?.setResolution(settings.sim);
      riverbedCanvasRef.current = createRiverbedCanvas(
        settings.texture,
        settings.texture,
        config.environment,
      );
      simRef.current?.updateRiverbedTexture(riverbedCanvasRef.current);
      if (underwaterCanvasRef.current)
        underwaterCanvasRef.current.width = underwaterCanvasRef.current.height = settings.texture;
      if (floatingCanvasRef.current)
        floatingCanvasRef.current.width = floatingCanvasRef.current.height = settings.texture;
      fishRef.current = createKoiFish(
        profile === 'economy' ? 4 : profile === 'balanced' ? 7 : 10,
        settings.texture,
        settings.texture,
      );
      leavesRef.current = createFloatingLeaves(settings.texture, settings.texture);
      lastTextureUploadRef.current = 0;
      handleResize();
    }, [config.environment, config.quality, handleResize]);

    // ── Main animation loop (stable — uses configRef, never restarts) ───────
    useEffect(() => {
      let lastTime = performance.now();
      const physicsClock = new FixedStepClock();
      // Throttle: skip frame if last render was less than ~13ms ago (≈75 fps cap)
      const MIN_FRAME_MS = 13;

      const loop = (currentTime: number) => {
        animFrameIdRef.current = requestAnimationFrame(loop);

        const elapsed = currentTime - lastTime;
        if (elapsed < MIN_FRAME_MS) return;

        const dt = Math.min(elapsed, 50);
        lastTime = currentTime;
        if (isPausedRef.current) {
          physicsClock.reset();
          return;
        }

        const cfg = configRef.current;
        const sim = simRef.current;
        const canvas = canvasRef.current;
        if (!sim || !canvas) return;

        const nextQuality = qualityManagerRef.current.sample(dt);
        if (nextQuality !== qualityRef.current) {
          qualityRef.current = nextQuality;
          const settings = qualitySettings[nextQuality];
          sim.setResolution(settings.sim);
          riverbedCanvasRef.current = createRiverbedCanvas(
            settings.texture,
            settings.texture,
            cfg.environment,
          );
          if (underwaterCanvasRef.current)
            underwaterCanvasRef.current.width = underwaterCanvasRef.current.height = settings.texture;
          if (floatingCanvasRef.current)
            floatingCanvasRef.current.width = floatingCanvasRef.current.height = settings.texture;
          fishRef.current = createKoiFish(
            nextQuality === 'economy' ? 4 : nextQuality === 'balanced' ? 7 : 10,
            settings.texture,
            settings.texture,
          );
          leavesRef.current = createFloatingLeaves(settings.texture, settings.texture);
          lastTextureUploadRef.current = 0;
          handleResize();
        }
        const textureSize = qualitySettings[qualityRef.current].texture;
        const W = textureSize;
        const H = textureSize;

        // ── 1. Rain physics drops ──────────────────────────────────────────
        if (cfg.rainIntensity !== 'none') {
          const interval = cfg.rainIntensity === 'light' ? 140 : 45;
          if (currentTime - lastRainDropTimeRef.current > interval) {
            lastRainDropTimeRef.current = currentTime;
            const rx = Math.random();
            const ry = Math.random();
            const radius = 0.012 + Math.random() * 0.02;
            const strength = 0.06 + Math.random() * 0.12;
            sim.addDrop(rx, ry, radius, strength);
            recentRipplesRef.current.push({ x: rx, y: ry, strength });
            if (Math.random() < 0.22) waterAudio.playDrop(0.18);

            // Spawn a visual rain streak on the overlay
            rainDropsRef.current.push({
              x: rx * W,
              y: ry * H - 80 - Math.random() * 120,
              vy: 18 + Math.random() * 22,
              length: 18 + Math.random() * 28,
              alpha: 0.55 + Math.random() * 0.35,
              life: 0,
              maxLife: 120 + Math.random() * 80,
            });
          }
        }

        // ── 2. Wind mode ───────────────────────────────────────────────────
        if (!reducedMotionRef.current && cfg.mode === 'wind' && cfg.windActive) {
          windPhaseRef.current += dt * 0.0012;
          sim.applyWind(windPhaseRef.current, 0.0035);
        }

        // ── 3. Trim ripple buffer ──────────────────────────────────────────
        if (recentRipplesRef.current.length > 20) {
          recentRipplesRef.current = recentRipplesRef.current.slice(-15);
        }

        // ── 4. Fish ────────────────────────────────────────────────────────
        if (cfg.showFish && !reducedMotionRef.current) {
          const pixelRipples = recentRipplesRef.current.map((r) => ({
            ...normalizedToPixels(r, W, H),
            strength: r.strength,
          }));
          updateKoiFish(fishRef.current, W, H, pixelRipples, foodRef.current, dt);
          if (currentTime - lastKoiWakeTimeRef.current > 110 && fishRef.current.length) {
            const fish = fishRef.current.reduce((fastest, item) =>
              item.speed > fastest.speed ? item : fastest,
            );
            const wakeX = Math.max(0, Math.min(1, fish.x / W));
            const wakeY = Math.max(0, Math.min(1, fish.y / H));
            sim.addDrop(wakeX, wakeY, 0.012 + (fish.size / W) * 0.08, Math.min(0.035, fish.speed * 0.006));
            lastKoiWakeTimeRef.current = currentTime;
          }
        }

        // ── 5. Leaves ──────────────────────────────────────────────────────
        if (cfg.showLeaves && !reducedMotionRef.current) {
          const pixelRipples = recentRipplesRef.current.map((r) => ({
            ...normalizedToPixels(r, W, H),
            strength: r.strength,
          }));
          updateFloatingLeaves(
            leavesRef.current,
            W,
            H,
            pixelRipples,
            currentTime,
            secondsFromMilliseconds(dt),
          );
        }

        // ── 6. Food decay ──────────────────────────────────────────────────
        for (const food of foodRef.current) food.life -= dt * 0.00015;
        foodRef.current = foodRef.current.filter((f) => !f.consumed && f.life > 0);

        // ── 7. Splash particles ────────────────────────────────────────────
        for (const p of splashParticlesRef.current) {
          const frameScale = secondsFromMilliseconds(dt) * 60;
          p.x += p.vx * frameScale;
          p.y += p.vy * frameScale;
          p.vy += 0.35 * frameScale;
          p.life += dt;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);
        }
        splashParticlesRef.current = splashParticlesRef.current.filter((p) => p.life < p.maxLife);

        // ── 8. Rain streaks update ─────────────────────────────────────────
        for (const r of rainDropsRef.current) {
          r.y += r.vy * secondsFromMilliseconds(dt) * 60;
          r.life += dt;
          r.alpha = Math.max(0, r.alpha * (1 - r.life / r.maxLife));
        }
        rainDropsRef.current = rainDropsRef.current.filter((r) => r.life < r.maxLife);
        // Cap visual streaks for performance
        if (rainDropsRef.current.length > 120) {
          rainDropsRef.current = rainDropsRef.current.slice(-100);
        }

        // ── 9. Underwater texture (riverbed + tint + food + koi) ───────────
        const shouldUploadTextures =
          currentTime - lastTextureUploadRef.current >= qualitySettings[qualityRef.current].textureCadence;
        const underCanvas = underwaterCanvasRef.current;
        const underCtx = underCanvas?.getContext('2d');
        if (shouldUploadTextures && underCanvas && underCtx) {
          underCtx.clearRect(0, 0, W, H);

          if (cfg.ambient === 'sunset') {
            underCtx.fillStyle = 'rgba(120, 50, 40, 0.12)';
            underCtx.fillRect(0, 0, W, H);
          } else if (cfg.ambient === 'night') {
            underCtx.fillStyle = 'rgba(5, 12, 28, 0.24)';
            underCtx.fillRect(0, 0, W, H);
          }

          for (const food of foodRef.current) {
            underCtx.save();
            underCtx.beginPath();
            underCtx.arc(food.x, food.y, 3.5, 0, Math.PI * 2);
            underCtx.fillStyle = '#9e6231';
            underCtx.fill();
            underCtx.strokeStyle = '#5a3517';
            underCtx.lineWidth = 1;
            underCtx.stroke();
            underCtx.restore();
          }

          if (cfg.showFish) {
            renderKoiFishOnCanvas(underCtx, fishRef.current, cfg.ambient);
          }

          sim.updateUnderwaterTexture(underCanvas);
        }

        // ── 10. Floating surface texture (leaves + splash) ─────────────────
        const floatCanvas = floatingCanvasRef.current;
        const floatCtx = floatCanvas?.getContext('2d');
        if (shouldUploadTextures && floatCanvas && floatCtx) {
          floatCtx.clearRect(0, 0, W, H);

          if (cfg.showLeaves) {
            renderLeavesOnCanvas(floatCtx, leavesRef.current, currentTime);
          }

          for (const p of splashParticlesRef.current) {
            floatCtx.save();
            floatCtx.beginPath();
            floatCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            floatCtx.fillStyle = `rgba(255,255,255,${p.alpha * 0.9})`;
            floatCtx.fill();
            floatCtx.restore();
          }

          sim.updateFloatingTexture(floatCanvas);
          lastTextureUploadRef.current = currentTime;
        }

        // ── 11. Fixed-timestep wave physics ────────────────────────────────
        // Wave speed and damping now stay consistent across 30–75 fps devices.
        const physicsSteps = physicsClock.consume(secondsFromMilliseconds(dt));
        for (let step = 0; step < physicsSteps; step++) sim.step(cfg.damping);

        // ── 12. WebGL composite render ─────────────────────────────────────
        sim.render(
          canvas.width,
          canvas.height,
          cfg.ambient,
          cfg.refractionStrength,
          cfg.sunlightIntensity,
          cfg.causticsIntensity,
        );

        // ── 13. 2D rain overlay drawn on top of WebGL canvas ──────────────
        if (!reducedMotionRef.current) drawRainOverlay(currentTime, cfg);
      };

      animFrameIdRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animFrameIdRef.current);
      // Intentionally stable — reads live config via configRef
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Rain overlay renderer (Canvas2D above the WebGL canvas) ─────────────
    const drawRainOverlay = (time: number, cfg: WaterSimConfig) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (cfg.rainIntensity === 'none' || rainDropsRef.current.length === 0) return;

      const textureSize = qualitySettings[qualityRef.current].texture;
      const scaleX = overlay.width / textureSize;
      const scaleY = overlay.height / textureSize;

      // Wind tilt for rain: medium rain tilts streaks slightly
      const tiltX = cfg.rainIntensity === 'medium' ? 0.22 : 0.08;

      ctx.save();
      ctx.lineCap = 'round';

      for (const drop of rainDropsRef.current) {
        const sx = drop.x * scaleX;
        const sy = drop.y * scaleY;
        const len = drop.length * scaleY;
        const alpha = drop.alpha * (cfg.rainIntensity === 'medium' ? 0.7 : 0.45);

        ctx.beginPath();
        ctx.strokeStyle = `rgba(180,220,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = cfg.rainIntensity === 'medium' ? 1.2 : 0.8;
        ctx.moveTo(sx - len * tiltX, sy - len);
        ctx.lineTo(sx + len * tiltX, sy);
        ctx.stroke();
      }

      ctx.restore();

      // Draw subtle splash ring at rain impact point when medium
      if (cfg.rainIntensity === 'medium') {
        for (const drop of rainDropsRef.current) {
          if (drop.life > drop.maxLife * 0.7 && drop.life < drop.maxLife * 0.95) {
            const progress = (drop.life - drop.maxLife * 0.7) / (drop.maxLife * 0.25);
            const r = progress * 12 * scaleX;
            const a = (1 - progress) * 0.4;
            ctx.beginPath();
            ctx.arc(drop.x * scaleX, drop.y * scaleY + drop.length * scaleY, r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(180,220,255,${a.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    };

    // ── Pointer Handlers ────────────────────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const sim = simRef.current;
      if (!canvas || !sim) return;

      canvas.setPointerCapture(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      const { x: normX, y: normY } = pointerToNormalized(e.clientX, e.clientY, rect);

      activePointersRef.current.set(e.pointerId, {
        lastX: normX,
        lastY: normY,
        lastTime: performance.now(),
      });

      const cfg = configRef.current;

      if (cfg.mode === 'ripple') {
        sim.addDrop(normX, normY, 0.028, 0.18);
        recentRipplesRef.current.push({ x: normX, y: normY, strength: 0.18 });
        waterAudio.playDrop(0.45);
      } else if (cfg.mode === 'stone') {
        tossStone(normX, normY);
      } else if (cfg.mode === 'feed') {
        dropFood(normX, normY);
      } else if (cfg.mode === 'wind') {
        // Manual wind burst at tap point
        sim.addDrop(normX, normY, 0.08, 0.35);
        sim.addDrop(normX + 0.04, normY, 0.06, 0.2);
        sim.addDrop(normX - 0.04, normY + 0.03, 0.07, 0.18);
        recentRipplesRef.current.push({ x: normX, y: normY, strength: 0.35 });
      }
      onAudioStatus?.({ available: waterAudio.getAvailable(), error: waterAudio.getError() });
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const sim = simRef.current;
      if (!canvas || !sim) return;

      const track = activePointersRef.current.get(e.pointerId);
      if (!track) return;

      const rect = canvas.getBoundingClientRect();
      const { x: normX, y: normY } = pointerToNormalized(e.clientX, e.clientY, rect);
      const now = performance.now();

      const dx = normX - track.lastX;
      const dy = normY - track.lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = Math.max(1, now - track.lastTime);
      const speed = dist / dt;

      const cfg = configRef.current;

      if (cfg.mode === 'ripple' && dist > 0.006) {
        const radius = Math.min(0.045, 0.02 + speed * 0.035);
        const strength = Math.min(0.24, 0.08 + speed * 0.15);
        sim.addDrop(normX, normY, radius, strength);
        recentRipplesRef.current.push({ x: normX, y: normY, strength });
        if (Math.random() < 0.18) waterAudio.playDrop(0.2 + speed * 0.3);
        track.lastX = normX;
        track.lastY = normY;
        track.lastTime = now;
      } else if (cfg.mode === 'wind' && dist > 0.008) {
        // Drag to sweep wind across surface
        sim.addDrop(normX, normY, 0.06, 0.2);
        track.lastX = normX;
        track.lastY = normY;
        track.lastTime = now;
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      activePointersRef.current.delete(e.pointerId);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    // ── Actions ─────────────────────────────────────────────────────────────
    const tossStone = (normX: number, normY: number) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.addDrop(normX, normY, 0.065, 0.55);
      scheduleTimeout(() => sim.addDrop(normX, normY, 0.04, -0.3), 60);
      scheduleTimeout(() => sim.addDrop(normX, normY, 0.05, 0.25), 140);
      recentRipplesRef.current.push({ x: normX, y: normY, strength: 0.6 });
      waterAudio.playStoneSplash(0.85);
      onAudioStatus?.({ available: waterAudio.getAvailable(), error: waterAudio.getError() });

      const textureSize = qualitySettings[qualityRef.current].texture;
      const { x: wx, y: wy } = normalizedToPixels({ x: normX, y: normY }, textureSize, textureSize);
      for (let i = 0; i < 14; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 5;
        splashParticlesRef.current.push({
          x: wx,
          y: wy,
          vx: Math.cos(angle) * spd,
          vy: -3 - Math.random() * 6,
          radius: 2 + Math.random() * 3.5,
          alpha: 1,
          life: 0,
          maxLife: 450 + Math.random() * 300,
        });
      }
    };

    const dropFood = (normX: number, normY: number) => {
      const sim = simRef.current;
      if (!sim) return;
      const textureSize = qualitySettings[qualityRef.current].texture;
      const { x: wx, y: wy } = normalizedToPixels({ x: normX, y: normY }, textureSize, textureSize);
      sim.addDrop(normX, normY, 0.018, 0.12);
      waterAudio.playDrop(0.3);
      onAudioStatus?.({ available: waterAudio.getAvailable(), error: waterAudio.getError() });
      for (let i = 0; i < 4; i++) {
        foodRef.current.push({
          id: Date.now() + i,
          x: wx + (Math.random() - 0.5) * 30,
          y: wy + (Math.random() - 0.5) * 30,
          birthTime: performance.now(),
          life: 1,
          consumed: false,
        });
      }
    };

    useImperativeHandle(ref, () => ({
      clearLake: () => {
        simRef.current?.clear();
        recentRipplesRef.current = [];
      },
      tossRandomStone: () => {
        const rx = 0.3 + Math.random() * 0.4;
        const ry = 0.3 + Math.random() * 0.4;
        tossStone(rx, ry);
      },
      createCenterRipple: () => {
        simRef.current?.addDrop(0.5, 0.5, 0.04, 0.22);
        recentRipplesRef.current.push({ x: 0.5, y: 0.5, strength: 0.22 });
      },
      feedCenter: () => dropFood(0.5, 0.5),
    }));

    return (
      <div className="relative w-full h-full overflow-hidden bg-slate-950 touch-none select-none">
        {/* WebGL water simulation canvas */}
        <canvas
          ref={canvasRef}
          id="webgl-pond-canvas"
          className="absolute inset-0 w-full h-full block cursor-crosshair"
          style={{ width: '100%', height: '100%' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Lago interativo. Use Espaço para onda, P para pedra, A para alimentar, V para vento, R para limpar e M para som."
          role="application"
          tabIndex={0}
        />
        {/* 2D overlay: rain streaks rendered above WebGL */}
        <canvas
          ref={overlayCanvasRef}
          id="rain-overlay-canvas"
          className="absolute inset-0 w-full h-full block pointer-events-none"
          aria-hidden="true"
        />
      </div>
    );
  },
);

PondCanvas.displayName = 'PondCanvas';
