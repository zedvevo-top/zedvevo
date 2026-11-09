import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

interface ZedVevoVideoBadgeProps {
  videoId?: string;
  className?: string;
}

export function ZedVevoVideoBadge({ videoId, className = '' }: ZedVevoVideoBadgeProps) {
  const [tags, setTags] = useState<string[]>(['ZEDVEVO NOW PLAYING']);
  const [animationStyle, setAnimationStyle] = useState<'pulse' | 'glow' | 'bounce' | 'marquee'>('pulse');
  const [tagIndex, setTagIndex] = useState(0);

  useEffect(() => {
    if (!videoId) return;
    try {
      const saved = localStorage.getItem('zedvevo_video_tags_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[videoId]) {
          if (parsed[videoId].tags?.length > 0) setTags(parsed[videoId].tags);
          if (parsed[videoId].animationStyle) setAnimationStyle(parsed[videoId].animationStyle);
        }
      }
    } catch {}
  }, [videoId]);

  // Rotate tags if multiple
  useEffect(() => {
    if (tags.length <= 1) return;
    const interval = setInterval(() => {
      setTagIndex(prev => (prev + 1) % tags.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [tags]);

  const currentTag = tags[tagIndex] || 'ZEDVEVO NOW PLAYING';

  const getAnimationClass = () => {
    switch (animationStyle) {
      case 'glow': return 'animate-pulse shadow-[0_0_20px_rgba(0,212,255,0.8)] border-accent';
      case 'bounce': return 'animate-bounce';
      case 'marquee': return 'animate-pulse';
      case 'pulse':
      default:
        return 'animate-pulse';
    }
  };

  return (
    <div className={`absolute top-4 left-4 z-20 flex items-center gap-2 pointer-events-none ${getAnimationClass()} ${className}`}>
      <div className="flex items-center gap-2 bg-black/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-primary/60 shadow-2xl">
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-[10px] tracking-tighter shadow-sm">
          Z
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-primary tracking-widest leading-none">ZEDVEVO</span>
          <span className="text-[8px] font-semibold text-white/90 uppercase tracking-wider leading-none">{currentTag}</span>
        </div>
      </div>
    </div>
  );
}

export function ZedVevoNowPlayingOverlay({ title, artist, videoId }: { title?: string; artist?: string; videoId?: string }) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center justify-center">
      <div className="bg-primary/95 text-primary-foreground px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/20 animate-bounce duration-1000">
        <div className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center shadow-inner">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </div>
        <div className="text-left">
          <p className="text-xs font-black tracking-wider uppercase">NOW ON ZEDVEVO</p>
          {title && <p className="text-[10px] font-medium text-white/90 truncate max-w-[180px]">{title} {artist ? `- ${artist}` : ''}</p>}
        </div>
      </div>
    </div>
  );
}
