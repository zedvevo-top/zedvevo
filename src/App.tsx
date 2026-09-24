import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Navigate as NavRedirect } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import ScrollToTop from '@/components/common/ScrollToTop';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { RouteGuard } from '@/components/common/RouteGuard';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import MusicPlayer from '@/components/music/MusicPlayer';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverviewPage from '@/pages/admin/AdminOverviewPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminContentPage from '@/pages/admin/AdminContentPage';
import AdminPaymentsPage from '@/pages/admin/AdminPaymentsPage';
import AdminAwardsPage from '@/pages/admin/AdminAwardsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminDownloadsPage from '@/pages/admin/AdminDownloadsPage';
import AdminNotificationsPage from '@/pages/admin/AdminNotificationsPage';
import AdminSponsorsPage from '@/pages/admin/AdminSponsorsPage';
import AdminPaymentGatewayPage from '@/pages/admin/AdminPaymentGatewayPage';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from './routes';
import { AdminNotificationListener } from '@/components/admin/AdminNotificationListener';
import { UniversalNotificationListener } from '@/components/notifications/UniversalNotificationListener';
import { analytics } from '@/lib/analytics';

// Guard for admin routes — only admin/super_admin can access
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, user, loading } = useAuth();
  if (loading) return null;
  const isSuperAdminEmail = user?.email?.toLowerCase() === 'topkuchalo@gmail.com' || profile?.email?.toLowerCase() === 'topkuchalo@gmail.com';
  if (!isSuperAdminEmail && (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin'))) {
    return <NavRedirect to="/" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

// Guard for super_admin-only routes — redirects admin to /admin overview
function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, user, loading } = useAuth();
  if (loading) return null;
  const isSuperAdminEmail = user?.email?.toLowerCase() === 'topkuchalo@gmail.com' || profile?.email?.toLowerCase() === 'topkuchalo@gmail.com';
  if (isSuperAdminEmail) {
    return <AdminLayout>{children}</AdminLayout>;
  }
  if (!profile) return <NavRedirect to="/" replace />;
  if (profile.role === 'admin') {
    return <NavRedirect to="/admin" replace />;
  }
  if (profile.role !== 'super_admin') {
    return <NavRedirect to="/" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

// Dynamic platform theme loader from Supabase & Settings
const GlobalScriptsAndTheme: React.FC = () => {
  // 1. Fetch config and apply theme/branding settings ONCE on mount
  React.useEffect(() => {
    async function loadConfigAndTheme() {
      try {
        const { getSettings } = await import('@/lib/api');
        const settings = await getSettings();

        // 2. Set dynamic branding & favicon
        const siteName = settings['site_name'];
        if (siteName) {
          (window as any).ZED_SITE_NAME = siteName;
          document.title = document.title.replace('ZedVevo', siteName);
          window.dispatchEvent(new CustomEvent('site_name_changed', { detail: siteName }));
        }

        const updateFavicon = (url: string) => {
          if (!url) return;
          let icon = document.getElementById('dynamic-favicon') as HTMLLinkElement;
          if (!icon) {
            icon = document.createElement('link');
            icon.id = 'dynamic-favicon';
            icon.rel = 'icon';
            icon.type = 'image/png';
            document.head.appendChild(icon);
          }
          icon.href = url;

          let appleIcon = document.getElementById('dynamic-apple-favicon') as HTMLLinkElement;
          if (!appleIcon) {
            appleIcon = document.createElement('link');
            appleIcon.id = 'dynamic-apple-favicon';
            appleIcon.rel = 'apple-touch-icon';
            document.head.appendChild(appleIcon);
          }
          appleIcon.href = url;
        };

        const faviconUrl = settings['app_favicon_url'] || settings['favicon_url'];
        if (faviconUrl) {
          updateFavicon(faviconUrl);
        }

        const onFaviconChanged = (e: Event) => {
          const customEvent = e as CustomEvent<string>;
          if (customEvent.detail) {
            updateFavicon(customEvent.detail);
          }
        };
        window.addEventListener('favicon_changed', onFaviconChanged);

        // 3. Set dynamic theme attributes (primary color, accent highlight, and radius)
        const primaryColor = settings['theme_primary_color'];
        const accentColor = settings['theme_accent_color'];
        const borderRadius = settings['theme_border_radius'];
        const themeMode = settings['theme_mode'];

        let styleRules = '';
        if (primaryColor || accentColor || borderRadius) {
          styleRules += `
            :root {
              ${primaryColor ? `--primary: ${primaryColor};` : ''}
              ${accentColor ? `--accent: ${accentColor}; --ring: ${accentColor};` : ''}
              ${borderRadius ? `--radius: ${borderRadius};` : ''}
            }
          `;
        }

        if (styleRules) {
          let styleEl = document.getElementById('supabase-theme-style');
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'supabase-theme-style';
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = styleRules;
        }

        // 4. Force default theme mode if configured
        if (themeMode === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (themeMode === 'light') {
          document.documentElement.classList.remove('dark');
        }

      } catch (err) {
        console.warn('Failed to load theme scripts:', err);
      }
    }
    loadConfigAndTheme();
  }, []);

  return null;
};

// Lightweight analytics route listener
const NavigationAnalytics: React.FC = () => {
  const location = useLocation();
  React.useEffect(() => {
    analytics.trackPageview(location.pathname, location.search);
  }, [location]);
  return null;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <PlayerProvider>
        <RouteGuard>
          <ScrollToTop />
          <GlobalScriptsAndTheme />
          <NavigationAnalytics />
          <IntersectObserver />
          <AdminNotificationListener />
          <UniversalNotificationListener />
          <Routes>
            {/* Admin sub-routes — full-screen layout, no Header/MobileNav */}
            <Route path="/admin" element={<AdminGuard><AdminOverviewPage /></AdminGuard>} />
            <Route path="/admin/content"       element={<AdminGuard><AdminContentPage /></AdminGuard>} />
            <Route path="/admin/videos"        element={<AdminGuard><AdminContentPage /></AdminGuard>} />
            <Route path="/admin/users"         element={<SuperAdminGuard><AdminUsersPage /></SuperAdminGuard>} />
            <Route path="/admin/payments"      element={<SuperAdminGuard><AdminPaymentsPage /></SuperAdminGuard>} />
            <Route path="/admin/awards"        element={<SuperAdminGuard><AdminAwardsPage /></SuperAdminGuard>} />
            <Route path="/admin/nominees"      element={<SuperAdminGuard><AdminAwardsPage /></SuperAdminGuard>} />
            <Route path="/admin/trending"      element={<SuperAdminGuard><AdminAwardsPage /></SuperAdminGuard>} />
            <Route path="/admin/downloads"     element={<SuperAdminGuard><AdminDownloadsPage /></SuperAdminGuard>} />
            <Route path="/admin/notifications" element={<SuperAdminGuard><AdminNotificationsPage /></SuperAdminGuard>} />
            <Route path="/admin/banners"       element={<SuperAdminGuard><AdminSettingsPage /></SuperAdminGuard>} />
            <Route path="/admin/settings"      element={<SuperAdminGuard><AdminSettingsPage /></SuperAdminGuard>} />
            <Route path="/admin/sponsors"      element={<SuperAdminGuard><AdminSponsorsPage /></SuperAdminGuard>} />
            <Route path="/admin/payment-gateway" element={<SuperAdminGuard><AdminPaymentGatewayPage /></SuperAdminGuard>} />

            {/* All other routes wrapped in the public layout */}
            <Route path="/*" element={
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-grow">
                  <Routes>
                    {routes.filter(r => !r.path.startsWith('/admin')).map((route) => (
                      <Route key={route.path} path={route.path} element={<route.component />} />
                    ))}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                {/* Player sits above mobile nav */}
                <MusicPlayer />
                <MobileNav />
              </div>
            } />
          </Routes>
          <Toaster richColors />
        </RouteGuard>
        </PlayerProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
