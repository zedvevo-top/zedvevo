import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface InstallAppButtonProps {
  variant?: 'header' | 'header-icon' | 'menu-item' | 'banner';
  className?: string;
}

export const InstallAppButton: React.FC<InstallAppButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const triggerApkDownload = async () => {
    setIsDownloading(true);
    try {
      // First try binary blob download to strictly guarantee .apk file extension and mimetype
      const response = await fetch('/ZedVevo.apk');
      if (response.ok) {
        const blob = await response.blob();
        // Guard against any HTML error pages
        if (!blob.type.includes('html') && blob.size > 50000) {
          const apkBlob = new Blob([blob], { type: 'application/vnd.android.package-archive' });
          const blobUrl = URL.createObjectURL(apkBlob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = 'ZedVevo.apk';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);

          toast.success('Downloading ZedVevo Android APK (1.6 MB)...', {
            description: "Tap 'Open' and 'Install' once the download completes.",
            duration: 7000,
          });
          return;
        }
      }

      // Direct fallback
      const link = document.createElement('a');
      link.href = '/ZedVevo.apk';
      link.download = 'ZedVevo.apk';
      link.setAttribute('type', 'application/vnd.android.package-archive');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Downloading ZedVevo APK installer...', {
        description: "Tap 'Open' and 'Install' once the download completes.",
        duration: 7000,
      });
    } catch (err) {
      console.error('Download error:', err);
      window.location.href = '/ZedVevo.apk';
    } finally {
      setTimeout(() => setIsDownloading(false), 2000);
    }
  };

  const handleInstallClick = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // 1. If native Android PWA prompt is ready, offer native 1-tap installation
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          toast.success('ZedVevo is installing on your home screen!');
          setDeferredPrompt(null);
          return;
        }
      } catch (err) {
        console.warn('Native prompt cancelled or error:', err);
      }
    }

    // 2. Always trigger real APK download
    triggerApkDownload();
    setIsModalOpen(true);
  };

  if (variant === 'header-icon') {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          onClick={handleInstallClick}
          className={`h-9 w-9 border-accent/40 bg-accent/15 text-accent hover:bg-accent/25 transition-all ${className}`}
          title="Install ZedVevo Android App (APK)"
        >
          <Download className="h-4 w-4 animate-bounce" />
        </Button>
        <InstallGuideDialog open={isModalOpen} onOpenChange={setIsModalOpen} onDownloadAgain={triggerApkDownload} />
      </>
    );
  }

  if (variant === 'menu-item') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md font-medium text-accent bg-accent/10 hover:bg-accent/20 transition-colors ${className}`}
        >
          <Smartphone className="h-4 w-4" />
          <span>Install Android App (APK)</span>
        </button>
        <InstallGuideDialog open={isModalOpen} onOpenChange={setIsModalOpen} onDownloadAgain={triggerApkDownload} />
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInstallClick}
        disabled={isDownloading}
        className={`h-9 px-3 gap-1.5 rounded-md border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent font-semibold text-xs shadow-sm transition-all ${className}`}
      >
        <Download className="h-3.5 w-3.5 animate-bounce" />
        <span>Install APK</span>
      </Button>

      <InstallGuideDialog open={isModalOpen} onOpenChange={setIsModalOpen} onDownloadAgain={triggerApkDownload} />
    </>
  );
};

function InstallGuideDialog({
  open,
  onOpenChange,
  onDownloadAgain,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownloadAgain: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-accent/20 text-accent">
              <Smartphone className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">Installing ZedVevo on Android</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Your real Android APK package (ZedVevo.apk) is downloading. Follow these quick steps to finish installing:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div>
              <p className="font-semibold text-foreground">Tap "Download Anyway"</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                If Android shows a standard security notice about files downloaded from the browser, tap Download.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div>
              <p className="font-semibold text-foreground">Open Downloaded File</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pull down your notification bar or check your Downloads folder and tap <strong>ZedVevo.apk</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div>
              <p className="font-semibold text-foreground">Tap "Install"</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                ZedVevo will install as a native app on your phone's home screen.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <a
            href="/ZedVevo.apk"
            download="ZedVevo.apk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold h-9 px-3 rounded-md bg-accent text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download ZedVevo.apk (Direct 1.6 MB)</span>
          </a>
          <Button variant="outline" size="sm" onClick={onDownloadAgain} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Retry In-App Download
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="gap-1.5 text-xs">
            <CheckCircle className="h-3.5 w-3.5" />
            Got It
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default InstallAppButton;
