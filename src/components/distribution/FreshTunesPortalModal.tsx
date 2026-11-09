import React, { useState } from 'react';
import {
  ExternalLink,
  RotateCw,
  X,
  Lock,
  Globe,
  Music,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FreshTunesPortalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedToUpload?: () => void;
}

export default function FreshTunesPortalModal({
  open,
  onOpenChange,
  onProceedToUpload,
}: FreshTunesPortalModalProps) {
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleProceed = () => {
    onOpenChange(false);
    if (onProceedToUpload) {
      onProceedToUpload();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`bg-background border border-border shadow-2xl p-0 overflow-hidden flex flex-col transition-all duration-300 ${
          isFullScreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none'
            : 'w-[96vw] max-w-6xl h-[88vh] max-h-[880px] rounded-2xl'
        }`}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>FreshTunes All Streaming Platforms Portal</DialogTitle>
          <DialogDescription>
            Embedded in-app frame to distribute your music to Spotify, Apple Music, and DSPs worldwide via FreshTunes.
          </DialogDescription>
        </DialogHeader>

        {/* In-App Browser App Frame Header */}
        <div className="bg-card border-b border-border/80 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
          {/* Left: Branding & Status */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-accent/10 border border-accent/30 text-accent rounded-lg px-2.5 py-1 text-xs font-bold">
              <Globe className="h-3.5 w-3.5" />
              <span>FreshTunes Portal</span>
            </div>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex border-emerald-500/40 bg-emerald-500/10 text-emerald-500 gap-1 text-[11px] font-semibold py-0.5"
            >
              <CheckCircle2 className="h-3 w-3" /> All Streaming Unlocked
            </Badge>
          </div>

          {/* Center: In-App Browser URL Bar */}
          <div className="flex-1 max-w-xl mx-auto flex items-center gap-2 bg-muted/50 border border-border/80 rounded-xl px-3 py-1.5 text-xs text-muted-foreground shadow-inner">
            <Lock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="font-mono text-[11px] sm:text-xs text-foreground truncate select-all">
              https://freshtunes.com/
            </span>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleRefresh}
                title="Reload Portal"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-accent' : ''}`} />
              </button>
            </div>
          </div>

          {/* Right: Frame Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden sm:inline-flex"
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => window.open('https://freshtunes.com/', '_blank', 'noopener,noreferrer')}
              title="Open in new window (optional)"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden md:inline-flex"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
            >
              <X className="h-4 w-4 mr-1" />
              <span>Done</span>
            </Button>
          </div>
        </div>

        {/* Main App Frame Area */}
        <div className="relative flex-1 w-full bg-muted/20 overflow-hidden">
          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs gap-3">
              <Loader2 className="h-8 w-8 text-accent animate-spin" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Loading FreshTunes Portal...</p>
                <p className="text-xs text-muted-foreground">Preparing in-app frame for all streaming distribution</p>
              </div>
            </div>
          )}

          {/* Embedded App Frame */}
          <iframe
            key={iframeKey}
            src="https://freshtunes.com/"
            title="FreshTunes In-App Frame"
            className="w-full h-full border-0 bg-white"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            onLoad={() => setIsLoading(false)}
          />
        </div>

        {/* Footer Quick Controls */}
        <div className="bg-card border-t border-border/80 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">Global DSPs: Spotify, Apple Music, YouTube Music, Deezer, TikTok & Boomplay.</span>
            <span className="text-foreground font-medium">Keep 100% Royalties</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="flex-1 sm:flex-none h-8 text-xs font-medium border-border"
            >
              Close Frame
            </Button>
            {onProceedToUpload && (
              <Button
                type="button"
                size="sm"
                onClick={handleProceed}
                className="flex-1 sm:flex-none h-8 text-xs font-semibold bg-accent hover:bg-accent/90 text-accent-foreground flex items-center gap-1.5"
              >
                <Music className="h-3.5 w-3.5" />
                <span>Upload to ZedVevo</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
