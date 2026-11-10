import { supabase } from '@/lib/supabase';

export type AdPlacement = 
  | 'download-button-overlay' 
  | 'above-player' 
  | 'between-list-items' 
  | 'sidebar' 
  | 'footer' 
  | 'header' 
  | 'home' 
  | 'music' 
  | 'videos' 
  | 'awards' 
  | 'popup'
  | 'download'
  | 'like'
  | 'all'
  | string;

export interface Advertisement {
  id: string;
  name: string;
  provider: 'adsense' | 'adsterra' | 'propeller' | 'popads' | 'custom_banner' | 'custom_script';
  type: 'banner' | 'script' | 'popup';
  placement: AdPlacement;
  format: 'leaderboard' | 'feed' | 'rectangle' | 'compact' | 'popup_modal';
  script_code?: string;
  image_url?: string;
  banner_url?: string;
  target_url?: string;
  cta_text?: string;
  headline?: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  impressions?: number;
  clicks?: number;
  created_at?: string;
}

const ADS_STORAGE_KEY = 'real_ads_config';

const LEGACY_DUMMY_IDS = new Set([
  'ad-mtn-momo',
  'ad-airtel-money',
  'ad-zedvevo-awards',
  'mtn-momo-ad',
  'airtel-money-ad',
  'zedvevo-awards-ad'
]);

function filterOutLegacyDummies(ads: Advertisement[]): Advertisement[] {
  if (!Array.isArray(ads)) return [];
  return ads.filter(ad => ad && !LEGACY_DUMMY_IDS.has(ad.id));
}

/**
 * Fetch all active and inactive advertisements from Supabase cloud settings / LocalStorage.
 * Returns only admin-configured advertisements; never returns hardcoded or mock ads.
 */
export async function getRealAds(): Promise<Advertisement[]> {
  try {
    const { SettingsManager } = await import('@/services/SettingsManager');
    const cloudAds = SettingsManager.get<Advertisement[]>(ADS_STORAGE_KEY);
    if (Array.isArray(cloudAds)) {
      const filtered = filterOutLegacyDummies(cloudAds);
      if (filtered.length > 0) return filtered;
    }
  } catch {
    // continue
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', ADS_STORAGE_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed)) {
        const filtered = filterOutLegacyDummies(parsed);
        try {
          localStorage.setItem(ADS_STORAGE_KEY, JSON.stringify(filtered));
          localStorage.setItem('zed_setting_' + ADS_STORAGE_KEY, JSON.stringify(filtered));
        } catch { /* ignore */ }
        return filtered;
      }
    }
  } catch (err) {
    console.warn('Could not fetch ads from cloud settings:', err);
  }

  try {
    const local = localStorage.getItem(ADS_STORAGE_KEY) || localStorage.getItem('zed_setting_' + ADS_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return filterOutLegacyDummies(parsed);
      }
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Get active advertisements matching a given placement location or container ID
 */
export async function getAdsForPlacement(placement: AdPlacement | string): Promise<Advertisement[]> {
  const allAds = await getRealAds();
  const target = (placement || '').toLowerCase();
  return allAds.filter(
    ad => ad.is_active !== false && (
      ad.placement === 'all' || 
      ad.placement.toLowerCase() === target ||
      ad.placement.toLowerCase().includes(target) ||
      target.includes(ad.placement.toLowerCase())
    )
  );
}

/**
 * Save advertisement list to cloud app_settings & LocalStorage via SettingsManager
 */
export async function saveRealAds(ads: Advertisement[]): Promise<boolean> {
  try {
    const { SettingsManager } = await import('@/services/SettingsManager');
    await SettingsManager.set(ADS_STORAGE_KEY, ads, 'Real advertisements configured by Admin');
    return true;
  } catch (err) {
    console.error('Error saving real ads:', err);
    return false;
  }
}

/**
 * Record an ad view / impression
 */
export async function recordAdImpression(adId: string): Promise<void> {
  try {
    const ads = await getRealAds();
    const target = ads.find(a => a.id === adId);
    if (target) {
      target.impressions = (target.impressions || 0) + 1;
      await saveRealAds(ads);
    }
  } catch { /* silently ignore */ }
}

/**
 * Record an ad user click
 */
export async function recordAdClick(adId: string): Promise<void> {
  try {
    const ads = await getRealAds();
    const target = ads.find(a => a.id === adId);
    if (target) {
      target.clicks = (target.clicks || 0) + 1;
      await saveRealAds(ads);
    }
  } catch { /* silently ignore */ }
}

/**
 * Inject ad content into a specific UI element safely, executing scripts locally without polluting global <head>
 */
export function injectAdToElement(container: HTMLElement, ad: Advertisement): void {
  if (!container) return;

  container.innerHTML = '';
  void recordAdImpression(ad.id);

  if (ad.image_url || ad.banner_url) {
    const imageUrl = ad.image_url || ad.banner_url;
    const link = document.createElement('a');
    link.href = ad.target_url || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'block w-full text-center overflow-hidden rounded-lg group';

    link.onclick = () => {
      void recordAdClick(ad.id);
    };

    const img = document.createElement('img');
    img.src = imageUrl!;
    img.alt = ad.name || 'Advertisement';
    img.className = 'w-full max-h-36 object-cover rounded-lg group-hover:opacity-90 transition-opacity';
    link.appendChild(img);
    container.appendChild(link);
  } else if (ad.script_code) {
    // Local script execution directly inside container
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = ad.script_code;

    Array.from(tempDiv.childNodes).forEach((node) => {
      if (node.nodeName.toLowerCase() === 'script') {
        const oldScript = node as HTMLScriptElement;
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        if (oldScript.innerHTML) newScript.innerHTML = oldScript.innerHTML;
        container.appendChild(newScript);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });
  }
}

/**
 * Centralized helper function to inject active ads directly into targeted UI container ID.
 * Prevents global header script injection and ensures ads only appear in admin-approved containers.
 */
export async function injectAdToContainer(
  containerId: string, 
  placement?: AdPlacement | string
): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[AdManager] Target UI container #${containerId} not found in DOM.`);
    return false;
  }

  const ads = await getAdsForPlacement(placement || containerId);
  if (!ads || ads.length === 0) {
    container.innerHTML = '';
    return false;
  }

  const selectedAd = ads[Math.floor(Math.random() * ads.length)];
  injectAdToElement(container, selectedAd);
  return true;
}

/**
 * Trigger popunder / popup advertisement for specific interactions (e.g., download or like)
 */
export async function triggerPopunderAd(placement: AdPlacement | string = 'download-button-overlay'): Promise<void> {
  try {
    const activeAds = await getAdsForPlacement(placement);
    const popAd = activeAds.find(a => a.type === 'popup' || a.provider === 'popads' || a.placement === 'popup' || a.placement === 'download' || a.placement === 'like');

    if (popAd) {
      void recordAdClick(popAd.id);
      const targetUrl = popAd.target_url || popAd.script_code;
      if (targetUrl && typeof window !== 'undefined' && targetUrl.startsWith('http')) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    }
  } catch (err) {
    console.warn('Popunder trigger error:', err);
  }
}

// Backward-compatible alias export
export const triggerPopunder = triggerPopunderAd;

/**
 * Centralized AdManager Service Instance
 */
export const AdManager = {
  getRealAds,
  getAdsForPlacement,
  getAdsForContainer: getAdsForPlacement,
  saveRealAds,
  recordAdImpression,
  recordAdClick,
  injectAdToElement,
  injectAdToContainer,
  triggerPopunderAd,
  triggerPopunder,
};

export default AdManager;
