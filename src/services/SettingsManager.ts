import { supabase } from '@/lib/supabase';

export interface ThemeConfig {
  mode: 'dark' | 'light' | 'system';
  primaryColor?: string;
  accentColor?: string;
  borderRadius?: string;
  preset?: string;
}

export interface AdContainerPlacement {
  containerId: string;
  enabled: boolean;
  format?: 'leaderboard' | 'feed' | 'compact' | 'rectangle';
  provider?: string;
  target?: string;
  code?: string;
  customStyles?: Record<string, string>;
}

export interface SettingsState {
  loaded: boolean;
  settings: Record<string, string>;
}

const STORAGE_PREFIX = 'zed_setting_';
const SETTINGS_TABLE_CANDIDATES = ['app_settings', 'settings', 'site_settings'];

class SettingsManagerService {
  private cache: Record<string, string> = {};
  private initialized = false;
  private listeners: Set<(settings: Record<string, string>) => void> = new Set();
  private activeTable: string = 'app_settings';

  constructor() {
    this.hydrateFromLocalStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && (e.key.startsWith(STORAGE_PREFIX) || e.key === 'real_ads_config')) {
          this.hydrateFromLocalStorage();
          this.notifyListeners();
        }
      });

      window.addEventListener('zed_settings_updated', (e: any) => {
        if (e.detail?.key && e.detail?.value !== undefined) {
          this.cache[e.detail.key] = String(e.detail.value);
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * Hydrates memory cache synchronously from browser local storage
   */
  private hydrateFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          const rawKey = key.replace(STORAGE_PREFIX, '');
          this.cache[rawKey] = localStorage.getItem(key) || '';
        }
      }
      // Also pick up direct keys
      ['real_ads_config', 'video_ad_placements_config', 'site_name', 'theme_mode', 'theme_preset'].forEach(k => {
        const val = localStorage.getItem(k);
        if (val && !this.cache[k]) {
          this.cache[k] = val;
        }
      });
    } catch (e) {
      console.warn('[SettingsManager] LocalStorage hydration warning:', e);
    }
  }

  /**
   * Initializes and syncs all global settings from Supabase on app load.
   * Ensures ad-container placements, theme settings, and branding are applied immediately.
   */
  public async init(): Promise<Record<string, string>> {
    if (this.initialized && Object.keys(this.cache).length > 0) {
      return this.cache;
    }

    this.hydrateFromLocalStorage();

    // 1. Fetch from Supabase cloud tables
    for (const tableName of SETTINGS_TABLE_CANDIDATES) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('key, value');

        if (!error && Array.isArray(data) && data.length > 0) {
          this.activeTable = tableName;
          data.forEach((row: { key: string; value: any }) => {
            if (row.key) {
              const strVal = typeof row.value === 'object' ? JSON.stringify(row.value) : String(row.value ?? '');
              this.cache[row.key] = strVal;

              // Sync to local storage
              try {
                localStorage.setItem(STORAGE_PREFIX + row.key, strVal);
                localStorage.setItem(row.key, strVal);
              } catch { /* ignore */ }
            }
          });
          break; // successfully populated from active table
        }
      } catch {
        // Continue fallback to next candidate table
      }
    }

    this.initialized = true;

    // 2. Automatically apply theme & branding on app load
    this.applyTheme();
    this.applyBranding();

    // 3. Broadcast ready state
    this.notifyListeners();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zed_settings_initialized', { detail: this.cache }));
    }

    return this.cache;
  }

  /**
   * Synchronously get a setting from cache or local storage
   */
  public get<T = string>(key: string, defaultValue?: T): T {
    if (this.cache[key] !== undefined) {
      const val = this.cache[key];
      if (defaultValue !== undefined && typeof defaultValue === 'boolean') {
        return (val === 'true' || val === '1') as unknown as T;
      }
      if (defaultValue !== undefined && typeof defaultValue === 'number') {
        const n = Number(val);
        return (isNaN(n) ? defaultValue : n) as unknown as T;
      }
      if (defaultValue !== undefined && typeof defaultValue === 'object' && defaultValue !== null) {
        try {
          return JSON.parse(val) as T;
        } catch {
          return defaultValue;
        }
      }
      return val as unknown as T;
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_PREFIX + key) || localStorage.getItem(key);
      if (stored !== null) {
        this.cache[key] = stored;
        return this.get<T>(key, defaultValue);
      }
    }

    return defaultValue as T;
  }

  /**
   * Returns all current key-value settings
   */
  public getAll(): Record<string, string> {
    return { ...this.cache };
  }

  /**
   * Persists a setting to Supabase ('app_settings' / 'settings' tables) and browser storage,
   * then broadcasts the update to all active components.
   */
  public async set(key: string, value: any, description?: string): Promise<boolean> {
    const stringVal = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    
    // Update cache and localStorage immediately
    this.cache[key] = stringVal;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_PREFIX + key, stringVal);
        localStorage.setItem(key, stringVal);
      } catch (err) {
        console.warn('[SettingsManager] LocalStorage set error:', err);
      }
    }

    // Persist to Supabase cloud
    let cloudSuccess = false;
    for (const tableName of SETTINGS_TABLE_CANDIDATES) {
      try {
        const payload: Record<string, any> = {
          key,
          value: stringVal,
          updated_at: new Date().toISOString(),
        };
        if (description) payload.description = description;

        const { error } = await supabase
          .from(tableName)
          .upsert(payload, { onConflict: 'key' });

        if (!error) {
          cloudSuccess = true;
          this.activeTable = tableName;
          break;
        }
      } catch (err) {
        // try next candidate
      }
    }

    // If setting affects theme or branding, apply immediately
    if (key.startsWith('theme_')) {
      this.applyTheme();
    }
    if (key === 'site_name' || key.includes('favicon') || key.includes('logo')) {
      this.applyBranding();
    }
    if (key === 'real_ads_config' || key.startsWith('ad_code_') || key === 'ads_enabled' || key === 'adsense_client_id') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zedvevo:ads_updated', { detail: value }));
      }
    }

    // Broadcast globally
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zed_settings_updated', { detail: { key, value: stringVal } }));
      window.dispatchEvent(new CustomEvent('zed_setting_changed', { detail: { key, value: stringVal } }));
    }
    this.notifyListeners();

    return true;
  }

  /**
   * Batch sets multiple settings in a single operation
   */
  public async setMany(entries: Record<string, any>): Promise<boolean> {
    let allOk = true;
    for (const [key, val] of Object.entries(entries)) {
      const ok = await this.set(key, val);
      if (!ok) allOk = false;
    }
    return allOk;
  }

  /**
   * Retrieves platform theme configuration
   */
  public getThemeConfig(): ThemeConfig {
    const mode = this.get<'dark' | 'light' | 'system'>('theme_mode', 'dark');
    return {
      mode: mode || 'dark',
      primaryColor: this.get<string>('theme_primary_color', ''),
      accentColor: this.get<string>('theme_accent_color', ''),
      borderRadius: this.get<string>('theme_border_radius', ''),
      preset: this.get<string>('theme_preset', ''),
    };
  }

  /**
   * Persists and applies platform theme configuration
   */
  public async saveThemeConfig(config: Partial<ThemeConfig>): Promise<boolean> {
    const current = this.getThemeConfig();
    const updated: ThemeConfig = { ...current, ...config };

    if (updated.mode) await this.set('theme_mode', updated.mode);
    if (updated.primaryColor !== undefined) await this.set('theme_primary_color', updated.primaryColor);
    if (updated.accentColor !== undefined) await this.set('theme_accent_color', updated.accentColor);
    if (updated.borderRadius !== undefined) await this.set('theme_border_radius', updated.borderRadius);
    if (updated.preset !== undefined) await this.set('theme_preset', updated.preset);

    this.applyTheme(updated);
    return true;
  }

  /**
   * Applies theme CSS rules and classes directly to the DOM
   */
  public applyTheme(customTheme?: ThemeConfig): void {
    if (typeof document === 'undefined') return;

    const theme = customTheme || this.getThemeConfig();

    // 1. Toggle dark/light class
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme.mode === 'light') {
      document.documentElement.classList.remove('dark');
    }

    // 2. Inject dynamic CSS variables if custom colors/radius are configured
    let cssRules = '';
    if (theme.primaryColor) cssRules += `--primary: ${theme.primaryColor}; `;
    if (theme.accentColor) cssRules += `--accent: ${theme.accentColor}; --ring: ${theme.accentColor}; `;
    if (theme.borderRadius) cssRules += `--radius: ${theme.borderRadius}; `;

    if (cssRules) {
      let styleEl = document.getElementById('supabase-theme-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'supabase-theme-style';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `:root { ${cssRules} }`;
    }

    window.dispatchEvent(new CustomEvent('zed_theme_changed', { detail: theme }));
  }

  /**
   * Applies site name, logos, and favicons to the DOM
   */
  public applyBranding(): void {
    if (typeof document === 'undefined') return;

    const siteName = this.get('site_name');
    if (siteName && siteName.trim()) {
      (window as any).ZED_SITE_NAME = siteName;
      if (document.title.includes('ZedVevo')) {
        document.title = document.title.replace('ZedVevo', siteName);
      }
      window.dispatchEvent(new CustomEvent('site_name_changed', { detail: siteName }));
    }

    const faviconUrl = this.get('app_favicon_url') || this.get('favicon_url');
    if (faviconUrl) {
      let icon = document.getElementById('dynamic-favicon') as HTMLLinkElement;
      if (!icon) {
        icon = document.createElement('link');
        icon.id = 'dynamic-favicon';
        icon.rel = 'icon';
        icon.type = 'image/png';
        document.head.appendChild(icon);
      }
      icon.href = faviconUrl;
    }
  }

  /**
   * Retrieves ad container placement configuration
   */
  public getAdPlacements(): Record<string, AdContainerPlacement> {
    return this.get<Record<string, AdContainerPlacement>>('ad_container_placements', {});
  }

  /**
   * Saves ad container placement configuration and updates AdManager
   */
  public async saveAdPlacement(containerId: string, placement: Partial<AdContainerPlacement>): Promise<boolean> {
    const current = this.getAdPlacements();
    current[containerId] = {
      containerId,
      enabled: placement.enabled ?? true,
      format: placement.format || 'leaderboard',
      ...placement,
    };

    const ok = await this.set('ad_container_placements', current, 'Admin configured ad-container placements');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('zedvevo:ads_updated', { detail: current }));
    }
    return ok;
  }

  /**
   * Subscribes to global settings updates
   */
  public subscribe(callback: (settings: Record<string, string>) => void): () => void {
    this.listeners.add(callback);
    callback(this.cache);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const copy = { ...this.cache };
    this.listeners.forEach((fn) => {
      try {
        fn(copy);
      } catch (err) {
        console.warn('[SettingsManager] Listener error:', err);
      }
    });
  }
}

export const SettingsManager = new SettingsManagerService();
export default SettingsManager;
