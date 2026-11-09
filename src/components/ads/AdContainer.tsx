import React, { useEffect, useState } from 'react';
import { AdManager, type AdContainerType } from '@/services/AdManager';
import type { Advertisement } from '@/services/adsService';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdContainerProps {
  containerName: AdContainerType | string;
  className?: string;
}

export default function AdContainer({ containerName, className = '' }: AdContainerProps) {
  const [ads, setAds] = useState<Advertisement[]>([]);

  useEffect(() => {
    let isMounted = true;
    AdManager.getAdsForContainer(containerName).then(data => {
      if (isMounted) setAds(data);
    }).catch(() => {});

    const handleUpdate = () => {
      AdManager.getAdsForContainer(containerName).then(data => {
        if (isMounted) setAds(data);
      }).catch(() => {});
    };

    window.addEventListener('zedvevo:ads_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('zedvevo:ads_updated', handleUpdate);
    };
  }, [containerName]);

  if (ads.length === 0) return null;

  return (
    <div className={`w-full my-2 space-y-2 ${className}`}>
      {ads.map((ad) => {
        const targetUrl = ad.target_url || '#';
        const cta = ad.cta_text || 'Learn More';
        return (
          <div key={ad.id} className="relative rounded-xl border border-border/60 bg-card p-3 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 text-[10px] text-muted-foreground uppercase font-semibold">
              <span className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-primary" /> Sponsored ({containerName})
              </span>
              <span>Ad</span>
            </div>
            {ad.image_url ? (
              <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="block group">
                <img src={ad.image_url} alt={ad.name} className="w-full h-24 object-cover rounded-lg group-hover:opacity-90 transition-opacity" />
              </a>
            ) : ad.script_code ? (
              <div dangerouslySetInnerHTML={{ __html: ad.script_code }} className="overflow-hidden text-center" />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-foreground truncate">{ad.name}</h4>
                  <p className="text-[11px] text-muted-foreground truncate">{ad.headline || 'Official Partner Offer'}</p>
                </div>
                <Button asChild size="sm" className="shrink-0 text-xs h-7 gap-1 bg-primary text-primary-foreground">
                  <a href={targetUrl} target="_blank" rel="noopener noreferrer">
                    {cta} <ExternalLink className="w-3 h-3" />
                  </a>
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
