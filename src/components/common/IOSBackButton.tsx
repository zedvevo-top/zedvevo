import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function IOSBackButton({ label = 'Back', homePath = '/' }: { label?: string; homePath?: string }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between py-3 px-4 mb-4 bg-card/40 backdrop-blur-xl border border-border/40 rounded-2xl shadow-sm">
      <button
        onClick={() => {
          if (window.history.length > 2) {
            navigate(-1);
          } else {
            navigate(homePath);
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-all group py-1 px-2 rounded-lg bg-accent/10 hover:bg-accent/20"
      >
        <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span>{label}</span>
      </button>

      <button
        onClick={() => navigate(homePath)}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-white/5"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Home</span>
      </button>
    </div>
  );
}
