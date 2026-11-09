import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, Share2, Check, Download, Music2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export interface DownloadThankYouModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  artistName?: string;
  itemType?: 'song' | 'video';
  coverUrl?: string;
  onShare?: () => void;
}

export default function DownloadThankYouModal({
  open,
  onOpenChange,
  title = 'Media',
  artistName = 'Artist',
  itemType = 'song',
  coverUrl,
  onShare,
}: DownloadThankYouModalProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Download className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-bold">
            Thanks for Downloading!
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your {itemType} is now downloading. Support Zambian music by sharing with friends and followers!
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 my-2">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              className="h-12 w-12 rounded-md object-cover shrink-0"
              onError={(e) => {
                e.currentTarget.src = '/app-icon.png';
              }}
            />
          ) : (
            <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Music2 className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{artistName}</p>
          </div>
        </div>

        <div className="space-y-2 mt-2">
          <Button
            className="w-full gap-2 font-medium"
            onClick={() => {
              if (onShare) {
                onShare();
              } else {
                handleCopyLink();
              }
            }}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-400" />
                Copied Link!
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share with Friends
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full text-xs"
            onClick={() => onOpenChange(false)}
          >
            Continue Browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
