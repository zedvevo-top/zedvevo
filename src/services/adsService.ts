import { supabase } from '@/lib/supabase';

export interface Advertisement {
  id: string;
  name: string;
  provider: 'adsense' | 'adsterra' | 'propeller' | 'popads' | 'custom_banner' | 'custom_script';
  type: 'banner' | 'script' | 'popup';
  placement: 'all' | 'home' | 'music' | 'videos' | 'awards' | 'sidebar' | 'popup';
  format: 'leaderboard' | 'feed' | 'rectangle' | 'compact' | 'popup_modal';
  script_code?: string;
  image_url?: string;
  target_url?: string;
  cta_text?: string;
  headline?: string;
  is_active: boolean;
  display_order: number;
  impressions?: number;
  clicks?: number;
  created_at?: string;
}

const ADS_STORAGE_KEY = 'real_ads_config';

const DEFAULT_REAL_ADS: Advertisement[] = [
  {
    id: 'ad-momo-1',
    name: 'MTN MoMo Instant Pay',
    provider: 'custom_banner',
    type: 'banner',
    placement: 'all',
    format: 'leaderboard',
    headline: 'Pay fast, securely & effortlessly with MTN MoMo in Zambia',
    image_url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&h=300&fit=crop',
    target_url: 'https://www.mtn.zm/momo',
    cta_text: 'Use MTN MoMo',
    is_active: true,
    display_order: 1,
    impressions: 420,
    clicks: 38,
  },
  {
    id: 'ad-airtel-1',
    name: 'Airtel Money Zambia',
    provider: 'custom_banner',
    type: 'banner',
    placement: 'all',
    format: 'feed',
    headline: 'Instant mobile payments and bundles across Zambia',
    image_url: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=1200&h=300&fit=crop',
    target_url: 'https://www.airtel.co.zm',
    cta_text: 'Dial *778#',
    is_active: true,
    display_order: 2,
    impressions: 310,
    clicks: 29,
  },
  {
    id: 'ad-awards-popup-1',
    name: 'ZedVevo Music Awards Voting',
    provider: 'custom_banner',
    type: 'popup',
    placement: 'popup',
    format: 'popup_modal',
    headline: 'Official Voting is Open! Vote for your favorite Zambian artists today.',
    image_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=450&fit=crop',
    target_url: '/awards',
    cta_text: 'Vote Now (K5/vote)',
    is_active: true,
    display_order: 3,
    impressions: 150,
    clicks: 45,
  }
];

export async function getRealAds(): Promise<Advertisement[]> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', ADS_STORAGE_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not fetch ads from cloud settings, using local fallback:', err);
  }

  const local = localStorage.getItem(ADS_STORAGE_KEY);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {
      // fallback
    }
  }

  return DEFAULT_REAL_ADS;
}

export async function saveRealAds(ads: Advertisement[]): Promise<boolean> {
  try {
    localStorage.setItem(ADS_STORAGE_KEY, JSON.stringify(ads));

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: ADS_STORAGE_KEY,
        value: JSON.stringify(ads),
        description: 'Real advertisements configured by Admin',
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Failed saving ads to app_settings:', error.message);
    }
    return true;
  } catch (err) {
    console.error('Error saving real ads:', err);
    return false;
  }
}

export async function recordAdImpression(adId: string) {
  try {
    const ads = await getRealAds();
    const target = ads.find(a => a.id === adId);
    if (target) {
      target.impressions = (target.impressions || 0) + 1;
      await saveRealAds(ads);
    }
  } catch {
    // silently ignore metric error
  }
}

export async function recordAdClick(adId: string) {
  try {
    const ads = await getRealAds();
    const target = ads.find(a => a.id === adId);
    if (target) {
      target.clicks = (target.clicks || 0) + 1;
      await saveRealAds(ads);
    }
  } catch {
    // silently ignore metric error
  }
}
