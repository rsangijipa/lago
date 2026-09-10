# Pond Engine Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the full Lago diagnosis with a modular, adaptive, accessible WebGL2 engine.

**Architecture:** Keep React as a thin adapter and move deterministic policies into tested modules. Extend the existing renderer incrementally so every task leaves a runnable application.

**Tech Stack:** React 19, TypeScript, Vite, WebGL2, Vitest, ESLint, Prettier, Playwright

**Spec:** `docs/superpowers/specs/2026-09-10-pond-engine-modernization-design.md`

## Global Constraints

- WebGL2 is mandatory.
- Preserve Economy, Balanced, and Immersive manual profiles and add Auto.
- Preserve existing uncommitted environment changes.
- Use normalized world coordinates and time-based simulation.

---

### Task 1: Deterministic engine foundations

**Files:** create `src/engine/CoordinateSystem.ts`, `src/engine/Time.ts`, `src/performance/QualityManager.ts`; add matching Vitest tests.

- [ ] Write tests for normalized conversion, fixed-step accumulation, and adaptive-quality hysteresis.
- [ ] Run tests and observe failures caused by missing modules.
- [ ] Implement the minimal pure APIs and rerun tests to green.

### Task 2: WebGL2 renderer lifecycle and GPU forces

**Files:** modify `src/webgl/waterSim.ts`, `src/webgl/shaders.ts`; test capability-facing pure behavior where practical.

- [ ] Require WebGL2 and validated float/half-float render targets.
- [ ] Add single-pass wind disturbance, micro-normal animation, boundary damping, and runtime resize/quality support.
- [ ] Add explicit disposal and context restoration paths.

### Task 3: Time-based simulations and cached art

**Files:** modify `src/simulation/koiFish.ts`, `src/simulation/floatingLeaves.ts`; create sprite cache helpers and tests.

- [ ] Write failing frame-rate-independence tests.
- [ ] Convert velocities/timers to seconds and add koi wake output.
- [ ] Cache reusable koi/vegetation procedural sprites and verify tests.

### Task 4: Thin canvas lifecycle adapter

**Files:** modify `src/components/PondCanvas.tsx`; create focused input/lifecycle helpers.

- [ ] Replace 1024 world coordinates with normalized points.
- [ ] Keep one stable animation loop across quality changes and apply quality without canceling it.
- [ ] Add visibility pause, context loss/restoration, keyboard commands, adaptive profiling, and bounded texture uploads.

### Task 5: Sensory UI and mobile accessibility

**Files:** modify `src/App.tsx`, `src/components/PondControls.tsx`, `src/index.css`, `src/types.ts`.

- [ ] Add Auto quality, Zen mode, inactivity auto-hide, permanent accessible labels, and keyboard help.
- [ ] Use `100dvh`/`100svh`, safe-area padding, and mobile bottom-sheet behavior.
- [ ] Verify reduced-motion and focus behavior.

### Task 6: Tooling, cleanup, and documentation

**Files:** modify `package.json`, `README.md`; create ESLint, Prettier, Vitest, and Playwright configuration/tests.

- [ ] Remove unused AI Studio/server dependencies and add quality scripts.
- [ ] Add unit and browser smoke coverage.
- [ ] Run tests, lint, TypeScript, production build, and Playwright; resolve every failure.
