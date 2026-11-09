import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRealAds } from '@/services/adsService';
import AdContainer from '@/components/ads/AdContainer';
import { toast } from 'sonner';

interface DownloadButtonProps {
  fileUrl: string;
  fileName: string;
  placement?: 'song_download' | 'video_download' | 'album_download' | 'store_download' | 'all';
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
}

export default function DownloadButton({
  fileUrl,
  fileName,
  placement = 'song_download',
  className = '',
  variant = 'outline',
  size = 'default',
  children,
}: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setDownloading(true);

    try {
      // 1. Check if admin configured popunder ads for downloads
      const ads = await getRealAds();
      const popunderAd = ads.find(
        a => a.is_active && (a.placement === 'popup' || a.placement === placement || a.placement === 'all' || a.placement === 'download-button-overlay') && (a.type === 'popup' || a.target_url)
      );

      if (popunderAd && popunderAd.target_url) {
        window.open(popunderAd.target_url, '_blank', 'noopener,noreferrer');
      }

      // 2. Perform file download
      if (!fileUrl) {
        toast.error('Download link not available');
        setDownloading(false);
        return;
      }

      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success('Download started successfully!');
    } catch (err) {
      try {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.download = fileName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Download opened in new tab');
      } catch (ex) {
        toast.error('Failed to download file');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="inline-block relative group">
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
        onClick={handleDownload}
        disabled={downloading}
      >
        <Download className="w-4 h-4" />
        {children || (downloading ? 'Downloading...' : 'Download')}
      </Button>
      <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 min-w-[240px]">
        <AdContainer containerName="download-button-overlay" />
      </div>
    </div>
  );
}
