import React, { useEffect, useState } from 'react';

interface ZedVevoVideoTagOverlayProps {
  title?: string;
  artistName?: string;
  isPlaying?: boolean;
  className?: string;
}

export default function ZedVevoVideoTagOverlay({
  title,
  artistName,
  isPlaying = true,
  className = '',
}: ZedVevoVideoTagOverlayProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);

  // Periodic 3D flip animation matching user video (every 5 seconds)
  useEffect(() => {
    const flipInterval = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => setIsFlipping(false), 900);
    }, 5500);

    return () => clearInterval(flipInterval);
  }, []);

  // Periodic glitch / lens shine sweep on "NOW ON ZEDVEVO"
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setIsGlitching(true);
      setTimeout(() => setIsGlitching(false), 1200);
    }, 4500);

    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-20 ${className}`}>
      {/* ── 1. Top-Left Floating Tag: "Z VEVO - NOW PLAYING" with 3D Flip ── */}
      <div className="absolute top-3 left-3 md:top-5 md:left-5 z-30">
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-blue-500/50 shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform duration-700 ${
            isFlipping ? 'animate-[zed-flip_0.85s_cubic-bezier(0.4,0,0.2,1)]' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Blue ZedVevo Disc Icon */}
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-gradient-to-tr from-[#1d4ed8] via-[#2563eb] to-[#00D4FF] flex flex-col items-center justify-center text-white shadow-[0_0_10px_#2563eb] border border-white/60 shrink-0">
            <span className="text-[10px] md:text-[11px] font-black leading-none tracking-tighter">Z</span>
            <span className="text-[6px] md:text-[7px] font-bold leading-none tracking-tight -mt-0.5 opacity-90">vevo</span>
          </div>

          {/* Text: NOW PLAYING */}
          <div className="flex flex-col pr-1">
            <span className="text-[9px] md:text-[10px] font-black tracking-widest uppercase text-white/95 drop-shadow">
              NOW PLAYING
            </span>
            {title && (
              <span className="text-[8px] font-semibold text-blue-200/90 truncate max-w-[120px] md:max-w-[180px] -mt-0.5">
                {title}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Lower Prominent Tag: "NOW ON ZEDVEVO ▶" with Glitch/Shine Sweep ── */}
      <div className="absolute bottom-12 md:bottom-16 left-3 md:left-8 z-30">
        <div
          className={`relative overflow-hidden rounded-xl bg-black/85 backdrop-blur-md border border-cyan-500/50 p-2.5 md:p-3 pr-4 md:pr-5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] flex items-center gap-3.5 md:gap-5 transition-all duration-300 ${
            isGlitching ? 'ring-2 ring-cyan-400 shadow-[0_0_25px_rgba(0,212,255,0.6)] scale-[1.02]' : ''
          }`}
        >
          {/* Glitch Scanline / Lens Flare Sweep */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
              isGlitching
                ? 'opacity-100 bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent animate-[zed-sweep_1.1s_ease-out]'
                : 'opacity-0'
            }`}
          />

          {/* Left Text Block: NOW ON / ZEDVEVO */}
          <div className="flex flex-col relative z-10 pl-1">
            <span className="text-[9px] md:text-[11px] font-black tracking-[0.25em] uppercase text-white/90 drop-shadow">
              NOW ON
            </span>
            <div className="relative">
              <span className="text-xl md:text-3xl font-black tracking-tight text-[#00D4FF] drop-shadow-[0_0_12px_rgba(0,212,255,0.85)]">
                ZEDVEVO
              </span>
              {/* Subtle Glitch Text Offset when active */}
              {isGlitching && (
                <span className="absolute top-0 left-0 text-xl md:text-3xl font-black tracking-tight text-white/60 blur-[0.5px] translate-x-[1.5px] translate-y-[-1px] pointer-events-none">
                  ZEDVEVO
                </span>
              )}
            </div>
            {artistName && (
              <span className="text-[9px] md:text-[10px] font-semibold text-gray-300 truncate max-w-[140px] md:max-w-[220px]">
                {artistName}
              </span>
            )}
          </div>

          {/* Right Glowing Play Button Icon */}
          <div className="relative z-10 shrink-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-[#00D4FF] flex items-center justify-center text-white shadow-[0_0_18px_#00D4FF] border-2 border-white/80 animate-pulse">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 md:w-6 md:h-6 fill-white text-white translate-x-0.5 drop-shadow"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            {/* Outer Pulsing Ring */}
            <div className="absolute -inset-1 rounded-full border border-cyan-400/40 animate-ping pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Global CSS keyframes for 3D coin flip & sweep */}
      <style>{`
        @keyframes zed-flip {
          0% {
            transform: perspective(400px) rotateY(0deg);
          }
          50% {
            transform: perspective(400px) rotateY(180deg) scale(1.1);
          }
          100% {
            transform: perspective(400px) rotateY(360deg);
          }
        }
        @keyframes zed-sweep {
          0% {
            transform: translateX(-100%) skewX(-20deg);
          }
          100% {
            transform: translateX(200%) skewX(-20deg);
          }
        }
      `}</style>
    </div>
  );
}
