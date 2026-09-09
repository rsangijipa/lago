import React, { useState } from 'react';
import {
  Waves,
  CircleDot,
  CloudRain,
  Volume2,
  VolumeX,
  Sun,
  Sunset,
  Moon,
  RotateCcw,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Wind,
  Fish,
  Leaf,
} from 'lucide-react';
import { WaterSimConfig, WaterInteractionMode, AmbientLighting, RainIntensity, QualityProfile } from '../types';

interface PondControlsProps {
  config: WaterSimConfig;
  onChangeConfig: (updater: (prev: WaterSimConfig) => WaterSimConfig) => void;
  onClearLake: () => void;
  onTossStoneBurst: () => void;
  audioStatus: { available: boolean; error: string | null };
}

// Tiny Tooltip wrapper
const Tip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="group relative flex items-center justify-center">
    {children}
    <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap
      rounded-lg bg-slate-800/95 border border-slate-700/60 px-2 py-1 text-[10px] text-slate-300 shadow-xl
      opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 z-50">
      {label}
    </span>
  </div>
);

const rainLabels: Record<RainIntensity, string> = {
  none: 'Sem chuva',
  light: 'Chuvisco leve',
  medium: 'Chuva moderada',
};

export const PondControls: React.FC<PondControlsProps> = ({
  config,
  onChangeConfig,
  onClearLake,
  onTossStoneBurst,
  audioStatus,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const setMode = (mode: WaterInteractionMode) => {
    onChangeConfig((prev) => ({ ...prev, mode, windActive: mode === 'wind' }));
  };

  const setAmbient = (ambient: AmbientLighting) => {
    onChangeConfig((prev) => ({ ...prev, ambient }));
  };

  const cycleRain = () => {
    const nextMap: Record<RainIntensity, RainIntensity> = {
      none: 'light',
      light: 'medium',
      medium: 'none',
    };
    onChangeConfig((prev) => ({ ...prev, rainIntensity: nextMap[prev.rainIntensity] }));
  };

  const toggleSound = () => {
    if (!audioStatus.available) return;
    onChangeConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };

  const toggleFish = () => {
    onChangeConfig((prev) => ({ ...prev, showFish: !prev.showFish }));
  };

  const toggleLeaves = () => {
    onChangeConfig((prev) => ({ ...prev, showLeaves: !prev.showLeaves }));
  };

  const nextRainLabel = rainLabels[config.rainIntensity];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-none select-none">
      <div className="pointer-events-auto flex flex-col items-center gap-2">

        {/* ── Expanded Panel ─────────────────────────────────────────── */}
        {isExpanded && (
          <div
            id="panel-expanded-controls"
            className="w-full bg-slate-950/90 backdrop-blur-xl text-slate-100 rounded-2xl
              border border-slate-700/50 p-4 shadow-2xl
              animate-slide-up"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">

              {/* Elementos */}
              <div className="flex flex-col gap-2">
                <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Elementos</span>
                <div className="flex gap-1.5">
                  <button
                    id="btn-toggle-fish"
                    type="button"
                    onClick={toggleFish}
                    aria-pressed={config.showFish}
                    className={`min-h-11 flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all duration-150 ${
                      config.showFish
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Fish className="w-3 h-3" />
                    Carpas
                  </button>
                  <button
                    id="btn-toggle-leaves"
                    type="button"
                    onClick={toggleLeaves}
                    aria-pressed={config.showLeaves}
                    className={`min-h-11 flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-all duration-150 ${
                      config.showLeaves
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Leaf className="w-3 h-3" />
                    Folhas
                  </button>
                </div>
              </div>

              {/* Iluminação */}
              <div className="flex flex-col gap-2">
                <span className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Iluminação</span>
                <div className="flex gap-1">
                  {(
                    [
                      { val: 'day',    icon: <Sun className="w-3.5 h-3.5" />,    label: 'Dia Ensolarado',  active: 'bg-sky-500/25 border-sky-400/70 text-sky-200' },
                      { val: 'sunset', icon: <Sunset className="w-3.5 h-3.5" />, label: 'Pôr do Sol',      active: 'bg-orange-500/25 border-orange-400/70 text-orange-200' },
                      { val: 'night',  icon: <Moon className="w-3.5 h-3.5" />,   label: 'Noite ao Luar',   active: 'bg-indigo-500/25 border-indigo-400/70 text-indigo-200' },
                    ] as const
                  ).map(({ val, icon, label, active }) => (
                    <Tip key={val} label={label}>
                      <button
                        id={`btn-ambient-${val}`}
                        type="button"
                        onClick={() => setAmbient(val)}
                        aria-pressed={config.ambient === val}
                        aria-label={label}
                        className={`min-h-11 p-1.5 rounded-lg border flex-1 flex justify-center items-center transition-all duration-150 ${
                          config.ambient === val
                            ? active
                            : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {icon}
                      </button>
                    </Tip>
                  ))}
                </div>
              </div>

              {/* Persistência da Onda */}
              <div className="flex flex-col gap-2 col-span-2 sm:col-span-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 uppercase tracking-wider font-medium">Persistência da Onda</span>
                  <span className="text-slate-300 tabular-nums">{Math.round(config.damping * 1000) / 10}%</span>
                </div>
                <input
                  id="range-wave-damping"
                  type="range"
                  min="0.980"
                  max="0.996"
                  step="0.001"
                  value={config.damping}
                  onChange={(e) => {
                    const damping = parseFloat(e.target.value);
                    onChangeConfig((prev) => ({ ...prev, damping }));
                  }}
                  className="pond-range w-full cursor-pointer"
                  aria-label="Persistência da onda, controla quanto tempo as ondas permanecem"
                  aria-describedby="wave-damping-description"
                />
                <span id="wave-damping-description" className="text-[10px] text-slate-400">Maior valor mantém as ondas por mais tempo.</span>
              </div>

              {/* Intensidade de Refração */}
              <div className="flex flex-col gap-2 col-span-2 sm:col-span-3">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 uppercase tracking-wider font-medium">Refração da Água</span>
                  <span className="text-slate-300 tabular-nums">
                    {Math.round(config.refractionStrength * 1000) / 10}
                  </span>
                </div>
                <input
                  id="range-refraction"
                  type="range"
                  min="0.010"
                  max="0.070"
                  step="0.002"
                  value={config.refractionStrength}
                  onChange={(e) => {
                    const refractionStrength = parseFloat(e.target.value);
                    onChangeConfig((prev) => ({ ...prev, refractionStrength }));
                  }}
                  className="pond-range w-full cursor-pointer"
                  aria-label="Refração da água, controla a distorção visual do leito"
                  aria-describedby="refraction-description"
                />
                <span id="refraction-description" className="text-[10px] text-slate-400">Ajusta quanto o leito se distorce com as ondas.</span>
              </div>

              <div className="col-span-2 sm:col-span-3 flex flex-col gap-2">
                <label htmlFor="quality-profile" className="text-slate-500 font-medium uppercase tracking-wider text-[10px]">Qualidade visual</label>
                <select
                  id="quality-profile"
                  value={config.quality}
                  onChange={(event) => onChangeConfig((prev) => ({ ...prev, quality: event.target.value as QualityProfile }))}
                  className="min-h-11 rounded-lg border border-slate-700/70 bg-slate-900 px-3 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <option value="economy">Economia — melhor desempenho</option>
                  <option value="balanced">Balanceada — recomendada</option>
                  <option value="immersive">Imersiva — mais detalhes</option>
                </select>
                <span className="text-[10px] text-slate-400">Define a resolução da simulação e a frequência das texturas.</span>
              </div>

            </div>
          </div>
        )}

        {/* ── Primary Floating Dock ──────────────────────────────────── */}
        <div
          id="dock-primary-controls"
        className="flex max-w-full items-center gap-1 overflow-x-auto sm:gap-1.5 bg-slate-950/92 backdrop-blur-xl
            border border-slate-700/70 p-1.5 rounded-full shadow-2xl text-slate-200
            ring-1 ring-inset ring-white/5"
        >

          {/* Mode: Ondular */}
          <Tip label="Ondular — arraste para criar ondas">
            <button
              id="btn-mode-ripple"
              type="button"
              onClick={() => setMode('ripple')}
              aria-pressed={config.mode === 'ripple'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-semibold transition-all duration-150 ${
                config.mode === 'ripple'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ondular</span>
            </button>
          </Tip>

          {/* Mode: Jogar Pedra */}
          <Tip label="Jogar pedra — clique para atirar">
            <button
              id="btn-mode-stone"
              type="button"
              onClick={() => {
                setMode('stone');
                onTossStoneBurst();
              }}
              aria-pressed={config.mode === 'stone'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-semibold transition-all duration-150 ${
                config.mode === 'stone'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                  : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pedra</span>
            </button>
          </Tip>

          {/* Mode: Alimentar */}
          <Tip label="Alimentar carpas — clique na água">
            <button
              id="btn-mode-feed"
              type="button"
              onClick={() => setMode('feed')}
              aria-pressed={config.mode === 'feed'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-semibold transition-all duration-150 ${
                config.mode === 'feed'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                  : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Alimentar</span>
            </button>
          </Tip>

          {/* Mode: Vento */}
          <Tip label="Vento — agita toda a superfície">
            <button
              id="btn-mode-wind"
              type="button"
              onClick={() => {
                setMode('wind');
              }}
              aria-pressed={config.mode === 'wind'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-semibold transition-all duration-150 ${
                config.mode === 'wind'
                  ? 'bg-violet-500 text-slate-950 shadow-md shadow-violet-500/30'
                  : 'hover:bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vento</span>
            </button>
          </Tip>

          <div className="w-px h-5 bg-slate-700/60 mx-0.5 flex-none" aria-hidden="true" />

          {/* Rain cycle */}
          <Tip label={nextRainLabel}>
            <button
              id="btn-toggle-rain"
              type="button"
              onClick={cycleRain}
              aria-label={`Chuva: ${nextRainLabel}`}
              className={`p-2 rounded-full transition-all duration-150 flex items-center justify-center relative ${
                config.rainIntensity !== 'none'
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-400/40'
                  : 'hover:bg-slate-800/70 text-slate-500 hover:text-slate-300'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
              {config.rainIntensity === 'medium' && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" aria-hidden="true" />
              )}
              {config.rainIntensity === 'light' && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-300/60" aria-hidden="true" />
              )}
            </button>
          </Tip>

          {/* Sound */}
          <Tip label={config.soundEnabled ? 'Áudio ligado' : 'Áudio mudo'}>
            <button
              id="btn-toggle-sound"
              type="button"
              onClick={toggleSound}
              aria-pressed={config.soundEnabled}
              aria-label={config.soundEnabled ? 'Desativar áudio' : 'Ativar áudio'}
              disabled={!audioStatus.available}
              title={audioStatus.error ?? (audioStatus.available ? 'Áudio' : 'Áudio indisponível')}
              className={`min-w-11 min-h-11 p-2 rounded-full transition-all duration-150 flex items-center justify-center ${
                config.soundEnabled
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-400/40'
                  : 'hover:bg-slate-800/70 text-slate-500 hover:text-slate-300'
              }`}
            >
              {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </Tip>

          {!audioStatus.available && (
            <span className="hidden max-w-32 truncate px-1 text-[10px] text-amber-200 sm:inline" role="status">
              Áudio indisponível
            </span>
          )}

          {/* Clear lake */}
          <Tip label="Acalmar ondas">
            <button
              id="btn-clear-lake"
              type="button"
              onClick={onClearLake}
              aria-label="Acalmar ondas"
              className="min-w-11 min-h-11 p-2 rounded-full hover:bg-slate-800/70 text-slate-500 hover:text-slate-300 transition-all duration-150 flex items-center justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </Tip>

          {/* Expand toggle */}
          <Tip label={isExpanded ? 'Recolher ajustes' : 'Mais ajustes'}>
            <button
              id="btn-toggle-expand"
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Recolher ajustes' : 'Expandir ajustes'}
              className={`p-2 rounded-full transition-all duration-150 flex items-center justify-center ${
                isExpanded
                  ? 'bg-slate-700/60 text-slate-300'
                  : 'hover:bg-slate-800/70 text-slate-500 hover:text-slate-300'
              }`}
            >
              {isExpanded
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </Tip>

        </div>
      </div>
    </div>
  );
};
