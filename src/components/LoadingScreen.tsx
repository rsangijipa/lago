import React, { useEffect, useState, useRef } from 'react';

interface LoadingScreenProps {
  progress: number; // 0–100
  onComplete?: () => void;
}

/**
 * Full-screen animated loading screen for the Lago WebGL simulation.
 * Shows an animated pond surface built purely with SVG + CSS, a progress bar,
 * and sequential status messages as the simulation initialises.
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, onComplete }) => {
  const [visible, setVisible] = useState(true);
  const [statusIndex, setStatusIndex] = useState(0);
  const prevProgress = useRef(0);

  const steps = [
    { threshold: 0,  label: 'Inicializando WebGL…' },
    { threshold: 18, label: 'Gerando leito do lago…' },
    { threshold: 38, label: 'Compilando shaders de água…' },
    { threshold: 55, label: 'Animando carpas koi…' },
    { threshold: 72, label: 'Espalhando nenúfares…' },
    { threshold: 88, label: 'Sintonizando o áudio…' },
    { threshold: 98, label: 'Quase lá…' },
  ];

  // Advance status message based on progress
  useEffect(() => {
    const next = steps.reduceRight((acc, s, i) =>
      progress >= s.threshold ? i : acc, 0);
    setStatusIndex(next);
    prevProgress.current = progress;
  }, [progress]);

  // Trigger fade-out when done
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [progress, onComplete]);

  if (!visible) return null;

  const isDone = progress >= 100;

  return (
    <div
      className={`loading-screen fixed inset-0 z-[100] flex flex-col items-center justify-center
        bg-slate-950 transition-opacity duration-700 ${isDone ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      aria-label="Carregando simulação"
      aria-live="polite"
      role="status"
    >
      {/* Animated SVG pond rings */}
      <div className="relative mb-10 flex items-center justify-center">
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="loading-rings"
          aria-hidden="true"
        >
          {/* Outer rings — water ripples */}
          {[72, 56, 40, 24].map((r, i) => (
            <circle
              key={r}
              cx="80"
              cy="80"
              r={r}
              stroke="rgba(34,211,238,0.18)"
              strokeWidth="1.5"
              fill="none"
              style={{
                animation: `ring-pulse 3s ease-out infinite`,
                animationDelay: `${i * 0.45}s`,
              }}
            />
          ))}
          {/* Inner water surface */}
          <circle cx="80" cy="80" r="36" fill="url(#pondGrad)" />
          {/* Koi silhouette */}
          <ellipse
            cx="74"
            cy="80"
            rx="14"
            ry="6"
            fill="rgba(251,146,60,0.75)"
            style={{ animation: 'koi-swim 4s ease-in-out infinite' }}
          />
          <ellipse
            cx="92"
            cy="76"
            rx="10"
            ry="4.5"
            fill="rgba(248,250,252,0.55)"
            style={{ animation: 'koi-swim 4s ease-in-out infinite', animationDelay: '1.6s' }}
          />
          {/* Lily pad */}
          <circle cx="68" cy="68" r="5" fill="rgba(52,163,74,0.65)" />
          <defs>
            <radialGradient id="pondGrad" cx="40%" cy="38%" r="70%">
              <stop offset="0%" stopColor="#164e63" />
              <stop offset="100%" stopColor="#0a1628" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Brand */}
      <h1 className="font-serif text-4xl tracking-widest text-slate-100 mb-1 select-none">
        Lago
      </h1>
      <p className="text-slate-500 text-xs tracking-[0.25em] uppercase mb-10 select-none">
        simulação interativa
      </p>

      {/* Progress bar */}
      <div className="w-56 sm:w-72 flex flex-col gap-2.5">
        <div
          className="h-0.5 w-full bg-slate-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[10px] tracking-wider animate-pulse">
            {steps[statusIndex]?.label}
          </span>
          <span className="text-slate-600 text-[10px] tabular-nums">
            {Math.min(100, Math.round(progress))}%
          </span>
        </div>
      </div>

      {/* Subtle ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-cyan-400/10"
            style={{
              width: `${4 + (i % 5) * 3}px`,
              height: `${4 + (i % 5) * 3}px`,
              left: `${8 + i * 7.5}%`,
              top: `${20 + ((i * 53) % 60)}%`,
              animation: `float-particle ${5 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};
