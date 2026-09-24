import React, { useEffect, useState } from 'react';
import { ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { getActiveSponsors } from '@/lib/api';
import { getRealAds, recordAdImpression, recordAdClick, type Advertisement } from '@/services/adsService';
import type { Sponsor } from '@/types';

// Authentic Zambian partner sponsor ads fallback to guarantee ads always work
const FALLBACK_ADS: Sponsor[] = [
  {
    id: 'mtn-momo-ad',
    name: 'MTN Mobile Money',
    headline: 'Pay fast, securely & effortlessly with MTN MoMo in Zambia',
    logo_url: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=200',
    banner_url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&h=300&fit=crop',
    website_url: 'https://www.mtn.zm/momo',
    cta_text: 'Use MTN MoMo',
    cta_url: 'https://www.mtn.zm/momo',
    tier: 'gold',
    display_order: 1,
    is_active: true,
    position: 'all',
    created_at: new Date().toISOString(),
  },
  {
    id: 'airtel-money-ad',
    name: 'Airtel Money Zambia',
    headline: 'Send money, buy bundles & vote without transaction hassles',
    logo_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=200',
    banner_url: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=1200&h=300&fit=crop',
    website_url: 'https://www.airtel.co.zm',
    cta_text: 'Dial *115#',
    cta_url: 'https://www.airtel.co.zm',
    tier: 'gold',
    display_order: 2,
    is_active: true,
    position: 'all',
    created_at: new Date().toISOString(),
  },
  {
    id: 'zedvevo-awards-ad',
    name: 'ZedVevo Music Awards 2026',
    headline: 'Vote for your favorite Zambian music icons — Live voting now open!',
    logo_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200',
    banner_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=300&fit=crop',
    website_url: '/awards',
    cta_text: 'Vote Now',
    cta_url: '/awards',
    tier: 'gold',
    display_order: 3,
    is_active: true,
    position: 'all',
    created_at: new Date().toISOString(),
  }
];

// Profitablerate CPM Ad Network Container & Invoker with Anti-Adblock Force Loading
function ProfitablerateCpmContainer() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [adBlocked, setAdBlocked] = React.useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    try {
      const targetDiv = document.createElement('div');
      targetDiv.id = 'container-29a990e051b1bc82dfb7d8c83a9a64af';
      targetDiv.className = 'w-full min-h-[60px] flex justify-center items-center text-center';

      const script = document.createElement('script');
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      script.src = 'https://pl30824478.profitableratecpmnetwork.com/29a990e051b1bc82dfb7d8c83a9a64af/invoke.js';

      script.onerror = () => {
        console.warn('AdBlocker detected blocking CPM script. Force loading native sponsor ads.');
        setAdBlocked(true);
      };

      containerRef.current.appendChild(targetDiv);
      containerRef.current.appendChild(script);

      const timer = setTimeout(() => {
        if (targetDiv && (targetDiv.clientHeight === 0 || targetDiv.children.length === 0)) {
          setAdBlocked(true);
        }
      }, 2000);

      return () => clearTimeout(timer);
    } catch (e) {
      setAdBlocked(true);
    }
  }, []);

  if (adBlocked) {
    return (
      <div className="w-full my-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-center">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
          <span>Native Sponsor Deal</span>
          <span className="text-accent text-[9px]">Adblocker Force-Loaded</span>
        </div>
        <a
          href="https://momo.mtn.zm"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 p-2 bg-card/80 rounded-lg hover:border-accent border border-border/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs">
              MTN
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-foreground">MTN MoMo Music Pass</p>
              <p className="text-[10px] text-muted-foreground">Subscribe to ZedVevo Unlimited Music with MTN MoMo *115#</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-500 text-black hover:bg-amber-400">
            Subscribe
          </span>
        </a>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center items-center overflow-visible my-2 min-h-[60px]">
      <div ref={containerRef} className="w-full min-h-[60px] flex justify-center items-center text-center" />
    </div>
  );
}

// Dynamic script injection wrapper using isolated iframe doc.write for full ad network compatibility (Adsterra, PropellerAds, PopAds, AdSense, etc.)
function ScriptHtmlContainer({ code }: { code: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!code) return;

    const hasScript = code.includes('<script') || code.includes('atOptions') || code.includes('document.write') || code.includes('adsbygoogle') || code.includes('script');

    if (hasScript && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        try {
          doc.open();
          doc.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <base target="_blank" />
                <style>
                  html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; text-align: center; font-family: system-ui, -apple-system, sans-serif; }
                  img, iframe, div, ins { max-width: 100% !important; margin: 0 auto; }
                </style>
              </head>
              <body>
                ${code}
              </body>
            </html>
          `);
          doc.close();
        } catch (e) {
          console.warn('Iframe script write fallback:', e);
        }
      }
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = code;

      Array.from(tempDiv.childNodes).forEach((node) => {
        if (node.nodeName.toLowerCase() === 'script') {
          const oldScript = node as HTMLScriptElement;
          const newScript = document.createElement('script');
          Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
          if (oldScript.innerHTML) newScript.innerHTML = oldScript.innerHTML;
          containerRef.current?.appendChild(newScript);
        } else {
          containerRef.current?.appendChild(node.cloneNode(true));
        }
      });
    }
  }, [code]);

  return (
    <div className="w-full flex flex-col justify-center items-center overflow-visible min-h-[60px]">
      <iframe
        ref={iframeRef}
        title="Sponsored Ad Network Unit"
        className="w-full min-h-[90px] border-0 bg-transparent overflow-hidden"
        scrolling="no"
      />
      <div ref={containerRef} className="w-full flex justify-center items-center overflow-visible" />
    </div>
  );
}

interface AdBannerProps {
  position?: 'all' | 'home' | 'music' | 'videos' | 'awards';
  format?: 'leaderboard' | 'feed' | 'compact';
  className?: string;
  adSlot?: string;
}

export default function AdBanner({
  position = 'all',
  format = 'leaderboard',
  className = '',
  adSlot,
}: AdBannerProps) {
  const [activeAd, setActiveAd] = useState<Sponsor | null>(FALLBACK_ADS[0]);
  const [adsenseClientId, setAdsenseClientId] = useState<string | null>(null);
  const [adsEnabled, setAdsEnabled] = useState<boolean>(true);
  const [customLeaderboardCode, setCustomLeaderboardCode] = useState<string | null>(null);
  const [customFeedCode, setCustomFeedCode] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAdData() {
      try {
        // 1. Fetch settings from app_settings
        const { data: settings } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['ads_enabled', 'adsense_client_id', 'ad_code_leaderboard', 'ad_code_feed']);

        let enabled = true;
        let client = import.meta.env.VITE_ADSENSE_CLIENT_ID || null;
        let leaderboardCode: string | null = null;
        let feedCode: string | null = null;

        if (settings) {
          const adsSetting = settings.find((s: any) => s.key === 'ads_enabled');
          const clientSetting = settings.find((s: any) => s.key === 'adsense_client_id');
          const leaderboardSetting = settings.find((s: any) => s.key === 'ad_code_leaderboard');
          const feedSetting = settings.find((s: any) => s.key === 'ad_code_feed');

          if (adsSetting && (adsSetting.value === false || adsSetting.value === 'false')) enabled = false;
          if (clientSetting && clientSetting.value) client = String(clientSetting.value);
          if (leaderboardSetting && leaderboardSetting.value) leaderboardCode = String(leaderboardSetting.value);
          if (feedSetting && feedSetting.value) feedCode = String(feedSetting.value);
        }

        // 2. ALSO fetch real ads configured in Admin Ads Page
        const realAds = await getRealAds();
        const activeRealAds = realAds.filter(
          a => a.is_active !== false && (a.placement === 'all' || a.placement === position)
        );

        // Check if there are active script codes from Admin Ads campaigns
        const matchingRealScriptAd = activeRealAds.find(
          a => a.script_code && a.script_code.trim().length > 0 && (a.format === format || a.format === 'leaderboard' || a.format === 'feed')
        );

        if (matchingRealScriptAd?.script_code) {
          if (format === 'leaderboard') leaderboardCode = matchingRealScriptAd.script_code;
          else if (format === 'feed') feedCode = matchingRealScriptAd.script_code;
          else leaderboardCode = matchingRealScriptAd.script_code;
          
          recordAdImpression(matchingRealScriptAd.id);
        }

        if (!isMounted) return;
        setAdsEnabled(enabled);
        setAdsenseClientId(client);
        setCustomLeaderboardCode(leaderboardCode);
        setCustomFeedCode(feedCode);

        if (!enabled) return;

        // 3. Fetch active sponsors from Supabase
        const dbSponsors = await getActiveSponsors();
        const matchingSponsors = dbSponsors.filter(
          s => !s.position || s.position === 'all' || s.position === position
        );

        if (matchingSponsors.length > 0) {
          const picked = matchingSponsors[Math.floor(Math.random() * matchingSponsors.length)];
          setActiveAd(picked);
          void supabase
            .from('sponsors')
            .update({ impression_count: ((picked as any).impression_count || 0) + 1 })
            .eq('id', picked.id);
        } else {
          const fallbackMatching = FALLBACK_ADS.filter(
            s => s.position === 'all' || s.position === position
          );
          const picked = fallbackMatching[Math.floor(Math.random() * fallbackMatching.length)] || FALLBACK_ADS[0];
          setActiveAd(picked);
        }
      } catch (err) {
        console.warn('Could not load ad settings, using fallback partner ad:', err);
        if (isMounted) setActiveAd(FALLBACK_ADS[0]);
      }
    }

    void loadAdData();

    return () => {
      isMounted = false;
    };
  }, [position]);

  // If ads are explicitly disabled by admin, render nothing
  if (!adsEnabled) return null;

  // 1. Render custom admin ad codes if provided (Adsterra, PropellerAds, custom banner scripts, etc.)
  if (format === 'leaderboard' && customLeaderboardCode) {
    return (
      <div className="space-y-2">
        <ProfitablerateCpmContainer />
        <div className={`w-full overflow-hidden rounded-xl border border-border/40 bg-card/40 my-4 text-center ${className}`}>
          <div className="flex items-center justify-between px-3 py-1 bg-muted/40 border-b border-border/20 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            <span>Sponsored Ad</span>
          </div>
          <div className="p-2 min-h-[90px] flex items-center justify-center">
            <ScriptHtmlContainer code={customLeaderboardCode} />
          </div>
        </div>
      </div>
    );
  }

  if (format === 'feed' && customFeedCode) {
    return (
      <div className="space-y-2">
        <ProfitablerateCpmContainer />
        <div className={`w-full overflow-hidden rounded-xl border border-border/40 bg-card/40 my-4 text-center ${className}`}>
          <div className="flex items-center justify-between px-3 py-1 bg-muted/40 border-b border-border/20 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            <span>Sponsored Ad</span>
          </div>
          <div className="p-2 min-h-[90px] flex items-center justify-center">
            <ScriptHtmlContainer code={customFeedCode} />
          </div>
        </div>
      </div>
    );
  }

  // Handle click to track clicks
  const handleAdClick = () => {
    if (activeAd && activeAd.id && !activeAd.id.endsWith('-ad')) {
      void supabase
        .from('sponsors')
        .update({ click_count: ((activeAd as any).click_count || 0) + 1 })
        .eq('id', activeAd.id);
    }
  };

  // Google AdSense render if publisher ID & slot are set
  if (adsenseClientId && adSlot) {
    return (
      <div className={`w-full overflow-hidden rounded-xl border border-border/40 bg-card/40 my-4 text-center ${className}`}>
        <div className="flex items-center justify-between px-3 py-1 bg-muted/40 border-b border-border/20 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
          <span>Sponsored Advertisement</span>
          <span>Google AdSense</span>
        </div>
        <div className="p-2 min-h-[90px] flex items-center justify-center">
          <ins
            className="adsbygoogle"
            style={{ display: 'block' }}
            data-ad-client={adsenseClientId}
            data-ad-slot={adSlot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </div>
      </div>
    );
  }

  if (!activeAd) return null;

  const targetUrl = activeAd.website_url || activeAd.cta_url || '#';
  const ctaLabel = activeAd.cta_text || 'Learn More';

  if (format === 'compact') {
    return (
      <div className={`rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm my-3 ${className}`}>
        <div className="flex items-center justify-between px-3 py-1 bg-muted/50 border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          <span className="flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-primary" /> Sponsored
          </span>
          <span className="capitalize">{activeAd.tier} Partner</span>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-3 mb-2">
            {activeAd.logo_url && (
              <img
                src={activeAd.logo_url}
                alt={activeAd.name}
                className="w-8 h-8 rounded-md object-contain bg-white/10 p-0.5 border"
              />
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-xs text-foreground truncate">{activeAd.name}</h4>
              <p className="text-[11px] text-muted-foreground truncate">{activeAd.headline || 'Official Partner'}</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="w-full text-xs h-7 gap-1" onClick={handleAdClick}>
            <a href={targetUrl} target={targetUrl.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
              {ctaLabel} <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>
      </div>
    );
  }

  if (format === 'feed') {
    return (
      <div className="space-y-2">
        <ProfitablerateCpmContainer />
        <div className={`w-full rounded-2xl border border-border/70 bg-gradient-to-r from-card via-card to-primary/5 overflow-hidden shadow-md my-4 ${className}`}>
          <div className="flex items-center justify-between px-4 py-1.5 bg-muted/40 border-b border-border/30 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-primary" /> Official Sponsor
            </span>
            <span className="capitalize">{activeAd.tier} Partner</span>
          </div>
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-4 min-w-0">
              {activeAd.logo_url && (
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-background border border-border/80 p-1 shrink-0 flex items-center justify-center shadow-sm">
                  <img
                    src={activeAd.logo_url}
                    alt={activeAd.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-base text-foreground truncate">{activeAd.name}</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">Ad</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {activeAd.headline || 'Support the artists you love with our trusted official partners.'}
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0 w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow" onClick={handleAdClick}>
              <a href={targetUrl} target={targetUrl.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
                {ctaLabel} <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default: 'leaderboard'
  return (
    <div className="space-y-2">
      <ProfitablerateCpmContainer />
      <div className={`w-full rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm my-4 transition-all hover:border-primary/40 ${className}`}>
        <div className="flex items-center justify-between px-4 py-1.5 bg-muted/50 border-b border-border/30 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-primary" /> Featured Partner
          </span>
          <span>Sponsored</span>
        </div>

        <div className="relative overflow-hidden">
          {activeAd.banner_url && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 filter blur-sm"
              style={{ backgroundImage: `url(${activeAd.banner_url})` }}
            />
          )}
          <div className="relative z-10 p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center md:text-left flex-1 min-w-0">
              {activeAd.logo_url && (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl overflow-hidden bg-background border border-border p-1 shrink-0 flex items-center justify-center shadow-md">
                  <img
                    src={activeAd.logo_url}
                    alt={activeAd.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-base md:text-lg text-foreground truncate">
                  {activeAd.name}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5 line-clamp-2 max-w-2xl">
                  {activeAd.headline || 'Proud sponsor of ZedVevo music and culture.'}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-3 w-full md:w-auto">
              <Button asChild className="w-full md:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md" onClick={handleAdClick}>
                <a href={targetUrl} target={targetUrl.startsWith('http') ? '_blank' : '_self'} rel="noopener noreferrer">
                  {ctaLabel} <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
