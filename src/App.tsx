import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { Navigate as NavRedirect } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from './routes';

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

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <PlayerProvider>
        <RouteGuard>
          <ScrollToTop />
          <IntersectObserver />
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
