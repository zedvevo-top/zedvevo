import { AdManager, type AdPlacement, type Advertisement, injectAdToContainer, injectAdToElement, getAdsForPlacement, getRealAds, triggerPopunderAd } from './adsService';

export type AdContainerType = 
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
  | 'all'
  | string;

export {
  AdManager,
  injectAdToContainer,
  injectAdToElement,
  getAdsForPlacement,
  getRealAds,
  triggerPopunderAd,
};

export type { Advertisement, AdPlacement };

export default AdManager;
