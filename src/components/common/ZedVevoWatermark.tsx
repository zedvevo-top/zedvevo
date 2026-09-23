import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ZedVevoWatermarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  forceShow?: boolean; // For Admin preview
}

export function ZedVevoWatermark({ className, size = 'sm', forceShow = false }: ZedVevoWatermarkProps) {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [appIcon, setAppIcon] = useState<string>('/app-icon.png');

  const loadSettings = () => {
    try {
      const isEnabled = localStorage.getItem('zed_setting_watermark_enabled');
      setEnabled(isEnabled === null ? true : isEnabled === 'true');

      const logo =
        localStorage.getItem('zed_setting_watermark_app_icon_url') ||
        localStorage.getItem('zed_setting_app_logo_url') ||
        localStorage.getItem('zed_setting_app_icon_url') ||
        localStorage.getItem('zed_setting_app_favicon_url') ||
        '/app-icon.png';
      setAppIcon(logo);
    } catch {
      setEnabled(true);
      setAppIcon('/app-icon.png');
    }
  };

  useEffect(() => {
    loadSettings();

    const handleSettingsUpdate = () => loadSettings();
    window.addEventListener('zed_settings_updated', handleSettingsUpdate);
    window.addEventListener('storage', handleSettingsUpdate);

    return () => {
      window.removeEventListener('zed_settings_updated', handleSettingsUpdate);
      window.removeEventListener('storage', handleSettingsUpdate);
    };
  }, []);

  if (!enabled && !forceShow) {
    return null;
  }

  const iconSizes = {
    sm: 'h-7 w-7',
    md: 'h-9.5 w-9.5',
    lg: 'h-12 w-12',
  };

  return (
    <div
      className={cn(
        'absolute top-2.5 left-2.5 z-20 pointer-events-none select-none flex items-center justify-center transition-all duration-300 hover:scale-105',
        className
      )}
    >
      <img
        src={appIcon}
        alt="ZedVevo Logo"
        className={cn(
          'object-contain shrink-0 filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.95)] transition-transform',
          iconSizes[size]
        )}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/app-icon.png';
        }}
      />
    </div>
  );
}

export default ZedVevoWatermark;
