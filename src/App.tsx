import React, { useState, useRef, useCallback, useEffect } from 'react';
import { PondCanvas, PondCanvasHandle } from './components/PondCanvas';
import { PondControls } from './components/PondControls';
import { LoadingScreen } from './components/LoadingScreen';
import { WaterSimConfig } from './types';
import { Sparkles, Info, X, Droplets, EyeOff } from 'lucide-react';

export default function App() {
  const pondRef = useRef<PondCanvasHandle | null>(null);
  const infoOpenerRef = useRef<HTMLButtonElement | null>(null);
  const infoDialogRef = useRef<HTMLDivElement | null>(null);
  const infoCloseRef = useRef<HTMLButtonElement | null>(null);
  const wasInfoOpenRef = useRef(false);
  const [showInfo, setShowInfo] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState({ available: true, error: null as string | null });
  const [zenMode, setZenMode] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);

  const [config, setConfig] = useState<WaterSimConfig>({
    damping: 0.991,
    refractionStrength: 0.034,
    sunlightIntensity: 0.85,
    causticsIntensity: 0.75,
    rainIntensity: 'none',
    showFish: true,
    showLeaves: true,
    ambient: 'day',
    soundEnabled: false,
    mode: 'ripple',
    windActive: false,
    quality: 'auto',
    environment: 'japanese_garden',
  });

  const handleClearLake = () => {
    pondRef.current?.clearLake();
  };

  const handleTossStoneBurst = () => {
    pondRef.current?.tossRandomStone();
  };

  // Called by PondCanvas as each init stage completes
  const handleLoadProgress = useCallback((progress: number) => {
    setLoadingProgress(progress);
  }, []);

  const handleLoadComplete = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleWebGLError = useCallback((message: string | null) => setWebglError(message), []);
  const handleAudioStatus = useCallback(
    (status: { available: boolean; error: string | null }) => setAudioStatus(status),
    [],
  );

  useEffect(() => {
    if (showInfo) {
      infoCloseRef.current?.focus();
    } else if (wasInfoOpenRef.current) {
      infoOpenerRef.current?.focus();
    }
    wasInfoOpenRef.current = showInfo;
  }, [showInfo]);

  useEffect(() => {
    let timeoutId = window.setTimeout(() => setUiVisible(false), 4500);
    const reveal = () => {
      if (!zenMode) setUiVisible(true);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setUiVisible(false), 4500);
    };
    window.addEventListener('pointermove', reveal, { passive: true });
    window.addEventListener('pointerdown', reveal, { passive: true });
    window.addEventListener('keydown', reveal);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointermove', reveal);
      window.removeEventListener('pointerdown', reveal);
      window.removeEventListener('keydown', reveal);
    };
  }, [zenMode]);

  useEffect(() => {
    if (!showInfo) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowInfo(false);
      }
      if (event.key === 'Tab' && infoDialogRef.current) {
        const focusable = Array.from(
          infoDialogRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ) as NodeListOf<HTMLElement>,
        ).filter((element) => !element.hasAttribute('disabled'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showInfo]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button') || showInfo) return;
      const key = event.key.toLowerCase();
      if (event.code === 'Space') {
        event.preventDefault();
        pondRef.current?.createCenterRipple();
      } else if (key === 'p') {
        setConfig((prev) => ({ ...prev, mode: 'stone' }));
        pondRef.current?.tossRandomStone();
      } else if (key === 'a') {
        setConfig((prev) => ({ ...prev, mode: 'feed' }));
        pondRef.current?.feedCenter();
      } else if (key === 'v') {
        setConfig((prev) => ({ ...prev, mode: 'wind', windActive: !prev.windActive }));
      } else if (key === 'r') {
        pondRef.current?.clearLake();
      } else if (key === 'm') {
        setConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [showInfo]);

  const modeHints: Record<WaterSimConfig['mode'], string> = {
    ripple: 'Toque ou arraste para ondular',
    stone: 'Clique para atirar pedras',
    feed: 'Toque para alimentar as carpas',
    wind: 'Clique e arraste para soprar o vento',
  };

  const ambientLabel: Record<WaterSimConfig['ambient'], string> = {
    day: 'Dia',
    sunset: 'Entardecer',
    night: 'Noite',
  };

  return (
    <main className="pond-app relative w-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Loading Screen — overlaid until sim is ready */}
      <LoadingScreen progress={loadingProgress} onComplete={() => {}} />

      {/* WebGL Canvas Layer */}
      <PondCanvas
        ref={pondRef}
        config={config}
        onLoadProgress={handleLoadProgress}
        onLoadComplete={handleLoadComplete}
        onWebGLError={handleWebGLError}
        onAudioStatus={handleAudioStatus}
      />

      {webglError && (
        <div
          className="absolute inset-x-4 top-20 z-20 mx-auto max-w-lg rounded-xl border border-amber-300/30 bg-slate-950/90 p-4 text-sm text-amber-100 shadow-xl"
          role="alert"
        >
          <strong className="block text-amber-200">Visualização indisponível</strong>
          <span>{webglError}</span>
        </div>
      )}

      {/* Top bar — fades in after load */}
      <header
        className={`absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20
          transition-opacity duration-700 ${isLoaded && uiVisible && !zenMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/70 backdrop-blur-md border border-slate-700/50 px-3.5 py-1.5 rounded-full shadow-lg">
          <div className="flex items-center gap-2">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            <h1 className="text-sm font-semibold tracking-widest text-slate-100 font-serif">Lago</h1>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline border-l border-slate-700/80 pl-2.5 leading-none">
            {modeHints[config.mode]}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZenMode(true)}
            className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 p-2 rounded-full text-slate-400 hover:text-white"
            aria-label="Ativar modo Zen"
            title="Modo Zen"
          >
            <EyeOff className="w-4 h-4" />
          </button>
          {/* Ambient badge */}
          <span className="hidden sm:flex items-center gap-1.5 bg-slate-900/60 backdrop-blur-md border border-slate-700/40 px-2.5 py-1 rounded-full text-[10px] text-slate-400 tracking-wider select-none">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                config.ambient === 'day'
                  ? 'bg-sky-400'
                  : config.ambient === 'sunset'
                    ? 'bg-orange-400'
                    : 'bg-indigo-400'
              }`}
            />
            {ambientLabel[config.ambient]}
          </span>

          <button
            id="btn-open-info"
            type="button"
            ref={infoOpenerRef}
            onClick={() => setShowInfo(true)}
            className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 p-2 rounded-full text-slate-400 hover:text-white hover:border-slate-600 transition-all shadow-lg"
            title="Sobre a Simulação"
            aria-label="Abrir informações sobre a simulação"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Controls — fades in after load */}
      <div
        className={`transition-opacity duration-700 delay-200 ${isLoaded && uiVisible && !zenMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <PondControls
          config={config}
          onChangeConfig={setConfig}
          onClearLake={handleClearLake}
          onTossStoneBurst={handleTossStoneBurst}
          audioStatus={audioStatus}
        />
      </div>

      {zenMode && (
        <button
          type="button"
          onClick={() => {
            setZenMode(false);
            setUiVisible(true);
          }}
          className="fixed right-4 top-4 z-40 rounded-full bg-black/25 px-3 py-2 text-xs text-white/55 opacity-30 transition-opacity hover:opacity-100 focus:opacity-100"
          aria-label="Sair do modo Zen"
        >
          Sair do Zen
        </button>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            id="modal-info"
            ref={infoDialogRef}
            tabIndex={-1}
            className="w-full max-w-md bg-slate-900/98 border border-slate-700/80 rounded-2xl p-6 text-slate-200 shadow-2xl space-y-4 animate-modal-in"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-cyan-400" aria-hidden="true" />
                <h2 id="modal-title" className="text-sm font-semibold text-white tracking-wide">
                  Sobre o Lago WebGL
                </h2>
              </div>
              <button
                id="btn-close-info"
                type="button"
                ref={infoCloseRef}
                onClick={() => setShowInfo(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Uma experiência sensorial de águas calmas simulada em tempo real com equações de onda em{' '}
              <span className="text-cyan-300 font-medium">WebGL</span>.
            </p>

            <ul className="space-y-2 pt-0.5">
              {[
                {
                  color: 'bg-cyan-400',
                  label: 'Toques na água',
                  desc: 'Ondas concêntricas que se propagam e amortecem suavemente.',
                },
                {
                  color: 'bg-amber-400',
                  label: 'Carpas Koi',
                  desc: 'Peixes que nadam organicamente e reagem às perturbações.',
                },
                {
                  color: 'bg-emerald-400',
                  label: 'Nenúfares & Folhas',
                  desc: 'Vegetação flutuante que oscila com as marolas.',
                },
                {
                  color: 'bg-blue-400',
                  label: 'Chuva & Pedras',
                  desc: 'Gotas suaves ou impacto de seixos atirados.',
                },
                {
                  color: 'bg-violet-400',
                  label: 'Cáusticas & Reflexos',
                  desc: 'Refração do leito de pedras e reflexo do céu.',
                },
                {
                  color: 'bg-rose-400',
                  label: 'Vento',
                  desc: 'Rajadas que criam ondas suaves em toda a superfície.',
                },
              ].map(({ color, label, desc }) => (
                <li key={label} className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className={`mt-0.5 flex-none w-1.5 h-1.5 rounded-full ${color}`} aria-hidden="true" />
                  <span>
                    <strong className="text-slate-200">{label}:</strong> {desc}
                  </span>
                </li>
              ))}
            </ul>

            <button
              id="btn-understand-info"
              type="button"
              onClick={() => setShowInfo(false)}
              className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-semibold text-xs rounded-xl transition-all shadow-md"
            >
              Retornar ao Lago
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
