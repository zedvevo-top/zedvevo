import React, { useEffect, useState } from 'react';
import { Palette, Check, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primary: string; // HSL
  accent: string;  // HSL
  previewHex: string;
  accentHex: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'icon-electric-blue',
    name: 'Electric Blue (App Icon)',
    description: 'Matches the official ZedVevo logo icon colors',
    primary: '221 83% 53%',
    accent: '217 91% 60%',
    previewHex: '#2563eb',
    accentHex: '#38bdf8',
  },
  {
    id: 'copper-gold',
    name: 'Zambian Copper',
    description: 'Classic warm copper and amber signal tone',
    primary: '220 13% 10%',
    accent: '28 85% 50%',
    previewHex: '#ea580c',
    accentHex: '#f59e0b',
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    description: 'Vibrant Zambian gemstone green',
    primary: '158 64% 42%',
    accent: '142 71% 45%',
    previewHex: '#10b981',
    accentHex: '#34d399',
  },
  {
    id: 'purple-neon',
    name: 'Cyber Purple',
    description: 'Deep violet with neon highlights',
    primary: '262 83% 58%',
    accent: '271 91% 65%',
    previewHex: '#8b5cf6',
    accentHex: '#c084fc',
  },
  {
    id: 'crimson',
    name: 'Crimson Pulse',
    description: 'Bold red energy for high-impact streaming',
    primary: '350 89% 60%',
    accent: '0 84% 60%',
    previewHex: '#ef4444',
    accentHex: '#f87171',
  },
];

export function applyTheme(presetId: string, isDark?: boolean) {
  const preset = THEME_PRESETS.find(p => p.id === presetId) || THEME_PRESETS[0];
  localStorage.setItem('zed_theme_preset', preset.id);

  let styleEl = document.getElementById('dynamic-theme-vars');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-theme-vars';
    document.head.appendChild(styleEl);
  }

  // Update dynamic styles for both light & dark
  styleEl.textContent = `
    :root {
      --primary: ${preset.primary};
      --accent: ${preset.accent};
      --ring: ${preset.accent};
      --chart-1: ${preset.accent};
      --sidebar-ring: ${preset.accent};
    }
    .dark {
      --primary: ${preset.primary};
      --accent: ${preset.accent};
      --ring: ${preset.accent};
      --chart-1: ${preset.accent};
      --sidebar-ring: ${preset.accent};
    }
  `;

  if (typeof isDark === 'boolean') {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('zed_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('zed_theme_mode', 'light');
    }
  }

  window.dispatchEvent(new CustomEvent('zed_theme_changed', { detail: { preset, isDark } }));
}

export default function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<string>('icon-electric-blue');
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem('zed_theme_preset') || 'icon-electric-blue';
    const savedMode = localStorage.getItem('zed_theme_mode');
    const darkMode = savedMode ? savedMode === 'dark' : document.documentElement.classList.contains('dark') || true;

    setCurrentTheme(saved);
    setIsDark(darkMode);
    applyTheme(saved, darkMode);
  }, []);

  const handleSelect = (id: string) => {
    setCurrentTheme(id);
    applyTheme(id, isDark);
  };

  const toggleDarkMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    applyTheme(currentTheme, nextDark);
  };

  const activePreset = THEME_PRESETS.find(p => p.id === currentTheme) || THEME_PRESETS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 gap-1.5 border border-border/60 hover:border-accent hover:bg-muted text-xs font-medium rounded-lg"
          title="Switch App Theme & Colors"
        >
          <span
            className="w-3.5 h-3.5 rounded-full shadow-xs border border-white/20"
            style={{ backgroundColor: activePreset.previewHex }}
          />
          <Palette className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1 flex items-center justify-between">
          <span>Theme & Colors</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md hover:bg-muted"
            onClick={toggleDarkMode}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-700" />}
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_PRESETS.map((preset) => {
          const isSelected = preset.id === currentTheme;
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handleSelect(preset.id)}
              className="flex items-center justify-between px-2 py-2 cursor-pointer rounded-md text-xs font-medium"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-4 h-4 rounded-full border border-border shadow-xs shrink-0 flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${preset.previewHex}, ${preset.accentHex})` }}
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">{preset.name}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{preset.description}</span>
                </div>
              </div>
              {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
