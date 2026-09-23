import React from 'react';

export function ZedVevoWatermark({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute bottom-2 right-2 z-10 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/15 shadow-lg ${className}`}>
      <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
      <span className="text-[10px] font-black uppercase tracking-wider text-white font-mono">
        ZEDVEVO <span className="text-accent">VERIFIED</span>
      </span>
    </div>
  );
}
