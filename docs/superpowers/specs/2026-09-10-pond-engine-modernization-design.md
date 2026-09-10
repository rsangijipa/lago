# Pond Engine Modernization Design

## Goal

Modernize Lago into a resilient WebGL2-only sensory experience, resolving every issue in the supplied diagnosis while preserving the current environment work.

## Constraints

- WebGL2 is mandatory; unsupported browsers receive an accessible error.
- Manual Economy, Balanced, and Immersive profiles remain available; Auto is the default adaptive option.
- All world interactions use normalized coordinates and convert to texture pixels only at rendering boundaries.
- Simulation uses elapsed seconds or a fixed 60 Hz step and pauses while the document is hidden.
- React owns UI/configuration; focused engine modules own timing, quality, input, simulation, and rendering policy.

## Architecture

`PondCanvas` remains the React lifecycle adapter while pure modules under `engine/` and `performance/` provide coordinate conversion, fixed-step timing, quality selection, and runtime profiling. WebGL resources stay encapsulated in `WebGLWaterSimulation`, which gains capability validation, a single-pass procedural wind force, quality reconfiguration, and context-loss recovery.

Static riverbed and procedural entity art are cached. Dynamic canvases upload only when required by their quality cadence; all entity motion is time-based. Koi wakes and shader micro-waves keep the surface alive without repeated CPU-side wind drops.

## Interaction and accessibility

The interactive canvas is keyboard-focusable and exposes Space/ripple, P/stone, A/feed, V/wind, R/clear, and M/sound equivalents. Controls auto-hide after inactivity, a Zen toggle hides chrome, touch-safe labels remain available, and mobile layout uses dynamic viewport units, safe-area padding, and a bottom-sheet settings panel.

## Resilience and audio

The engine stops rendering, simulation, uploads, and audio while hidden. A lost WebGL context is prevented and reported; restoration rebuilds the engine and textures. Rain audio exists only while sound is enabled, and the audio context suspends while hidden.

## Verification

Vitest covers coordinates, fixed timing, quality hysteresis, and time-based entity motion. Playwright covers keyboard commands, quality changes, resize, and accessible canvas behavior. ESLint, TypeScript, production build, and browser smoke tests form the delivery gate.
