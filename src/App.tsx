import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Navigate as NavRedirect } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import ScrollToTop from '@/components/common/ScrollToTop';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
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
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return <NavRedirect to="/" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

// Guard for super_admin-only routes — redirects admin to /admin overview
function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <NavRedirect to="/" replace />;
  if (profile.role === 'admin') {
    return <NavRedirect to="/admin" replace />;
  }
  if (profile.role !== 'super_admin') {
    return <NavRedirect to="/" replace />;
  }
  return <AdminLayout>{children}</AdminLayout>;
}

// Dynamic platform theme and site branding loader via SettingsManager
const GlobalScriptsAndTheme: React.FC = () => {
  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function loadConfigAndTheme() {
      try {
        const { SettingsManager } = await import('@/services/SettingsManager');
        await SettingsManager.init();

        unsubscribe = SettingsManager.subscribe((settings) => {
          // Dynamic favicon sync
          const faviconUrl = settings['app_favicon_url'] || settings['favicon_url'];
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

          // Dynamic global header ad code inserted by Admin (Popunder, Social Bar, Adsterra header, etc.)
          const headerAdCode = settings['ad_code_header'];
          if (headerAdCode && typeof headerAdCode === 'string' && headerAdCode.trim()) {
            let container = document.getElementById('admin-header-ad-script-container');
            if (!container) {
              container = document.createElement('div');
              container.id = 'admin-header-ad-script-container';
              container.style.display = 'none';
              document.body.appendChild(container);
            }
            if (container.dataset.appliedCode !== headerAdCode) {
              container.dataset.appliedCode = headerAdCode;
              container.innerHTML = '';
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = headerAdCode;
              Array.from(tempDiv.childNodes).forEach((node) => {
                if (node.nodeName.toLowerCase() === 'script') {
                  const oldScript = node as HTMLScriptElement;
                  const newScript = document.createElement('script');
                  Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                  if (oldScript.innerHTML) newScript.innerHTML = oldScript.innerHTML;
                  container?.appendChild(newScript);
                } else {
                  container?.appendChild(node.cloneNode(true));
                }
              });
            }
          } else {
            const container = document.getElementById('admin-header-ad-script-container');
            if (container) {
              container.remove();
            }
          }
        });
      } catch (err) {
        console.warn('[App] SettingsManager init warning:', err);
      }
    }

    loadConfigAndTheme();

    return () => {
      if (unsubscribe) unsubscribe();
    };
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
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
};

export default App;
