import React from 'react';
import { ExternalLink, CheckCircle2, Globe, Music, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
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
  onProceedToUpload: () => void;
}

const STREAMING_PLATFORMS = [
  { name: 'Spotify', color: '#1DB954' },
  { name: 'Apple Music', color: '#FA243C' },
  { name: 'YouTube Music', color: '#FF0000' },
  { name: 'TikTok', color: '#00F2FE' },
  { name: 'Amazon Music', color: '#00A8E1' },
  { name: 'Deezer', color: '#A238FF' },
  { name: 'Boomplay', color: '#00C853' },
  { name: 'Audiomack', color: '#FFA000' },
];

export default function FreshTunesPortalModal({
  open,
  onOpenChange,
  onProceedToUpload,
}: FreshTunesPortalModalProps) {
  const handleOpenFreshTunes = () => {
    // Open the real web www.freshtunes.com in a new browser window/tab
    // This preserves the app iframe and keeps the user in ZedVevo
    window.open('https://www.freshtunes.com', '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg bg-card border-border shadow-2xl p-0 overflow-hidden">
        {/* Header with App Theme Accent */}
        <div className="relative p-6 bg-gradient-to-br from-card via-card to-accent/10 border-b border-border/80">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="font-black tracking-tight text-foreground text-lg">ZedVevo</span>
              <span className="text-muted-foreground text-xs">✕</span>
              <span className="font-bold text-accent text-sm tracking-wide">FreshTunes</span>
            </div>
            <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent gap-1 text-[11px] font-semibold py-0.5">
              <CheckCircle2 className="h-3 w-3" /> Plan Activated
            </Badge>
          </div>

          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>All Streaming Platforms</span>
              <Sparkles className="h-4 w-4 text-accent" />
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Your payment is authenticated! Your release will be distributed worldwide through FreshTunes and featured on ZedVevo.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5">
          {/* Platforms Grid */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Global Distribution Coverage
            </p>
            <div className="grid grid-cols-4 gap-2">
              {STREAMING_PLATFORMS.map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center justify-center p-2 rounded-lg bg-muted/30 border border-border/60 text-center hover:border-accent/40 transition-colors"
                >
                  <span className="text-xs font-medium text-foreground truncate">{platform.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Steps */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Upload to ZedVevo</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  First, complete your upload here on ZedVevo for instant Zambian streaming, downloads, and airplay charts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Open FreshTunes Real Web</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Use your credentials at <span className="font-mono text-accent">www.freshtunes.com</span> to register your ISRC and deliver to DSPs worldwide with 100% royalties kept.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <Button
              onClick={handleOpenFreshTunes}
              className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold flex items-center justify-center gap-2 shadow-sm"
            >
              <Globe className="h-4 w-4" />
              <span>Open www.freshtunes.com (Real Web)</span>
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>

            <Button
              variant="outline"
              onClick={onProceedToUpload}
              className="w-full h-10 border-border hover:bg-muted font-medium flex items-center justify-center gap-2"
            >
              <Music className="h-4 w-4 text-accent" />
              <span>Proceed to Upload on ZedVevo</span>
              <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span>Opens real external website in a clean new tab without breaking the app</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
