import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Music2, Video, CreditCard, Trophy,
  Image, Settings, Menu, X, LogOut, ChevronRight, Download,
  Star, TrendingUp, Bell, Wallet, Home, Globe, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import BackButton from '@/components/common/BackButton';
import FreshTunesPortalModal from '@/components/distribution/FreshTunesPortalModal';
import NotificationBell from '@/components/notifications/NotificationBell';
import { getUnreadNotificationCount } from '@/lib/api';
import { supabase } from '@/db/supabase';

const NAV_ITEMS_ADMIN = [
  { label: 'Overview',   path: '/admin',             icon: LayoutDashboard },
  { label: 'Content',   path: '/admin/content',     icon: Music2 },
  { label: 'Videos',    path: '/admin/videos',       icon: Video },
];

const NAV_ITEMS_SUPER_ADMIN = [
  { label: 'Users',         path: '/admin/users',         icon: Users },
  { label: 'Payments',      path: '/admin/payments',      icon: CreditCard },
  { label: 'Payment Gateway', path: '/admin/payment-gateway', icon: Wallet },
  { label: 'Sponsors',      path: '/admin/sponsors',      icon: Star },
  { label: 'Downloads',     path: '/admin/downloads',     icon: Download },
  { label: 'Awards',        path: '/admin/awards',        icon: Trophy },
  { label: 'Nominees',      path: '/admin/nominees',      icon: Star },
  { label: 'Trending',       path: '/admin/trending',      icon: TrendingUp },
  { label: 'Banners',       path: '/admin/banners',       icon: Image },
  { label: 'Notifications', path: '/admin/notifications', icon: Bell },
  { label: 'Settings',      path: '/admin/settings',      icon: Settings },
];

const NAV_ITEMS_ALL = [...NAV_ITEMS_ADMIN, ...NAV_ITEMS_SUPER_ADMIN];

function SidebarContent({ onNavigate, onOpenFreshTunes }: { onNavigate?: () => void; onOpenFreshTunes?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = profile?.role === 'super_admin';
  const navItems = isSuperAdmin ? NAV_ITEMS_ALL : NAV_ITEMS_ADMIN;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    getUnreadNotificationCount(user.id).then(setUnreadCount).catch(() => {});

    const channel = supabase
      .channel(`admin_sidebar_notif_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        getUnreadNotificationCount(user.id).then(setUnreadCount).catch(() => {});
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-0.5">ZedVevo</p>
          <p className="text-sm font-bold">Admin Panel</p>
        </div>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/admin'}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </span>
            {label === 'Notifications' && unreadCount > 0 && (
              <span className="h-5 px-1.5 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              if (onOpenFreshTunes) onOpenFreshTunes();
              if (onNavigate) onNavigate();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors shadow-xs group"
          >
            <span className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
              All Streaming (FreshTunes)
            </span>
            <span className="text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.2 rounded-sm uppercase">Frame</span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-4 space-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
            {(profile?.display_name || profile?.username || 'A')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{profile?.display_name || profile?.username}</p>
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
              {profile?.role?.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground gap-2 text-xs"
          onClick={handleSignOut}>
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showFreshTunesModal, setShowFreshTunesModal] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-card">
        <SidebarContent onOpenFreshTunes={() => setShowFreshTunesModal(true)} />
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <BackButton variant="ghost" size="sm" fallbackPath="/" className="h-8 w-8 border border-border/40" />
            <p className="text-sm font-bold">Admin Panel</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 p-0 bg-card">
                <SidebarContent onNavigate={() => setMobileOpen(false)} onOpenFreshTunes={() => setShowFreshTunesModal(true)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Breadcrumb strip (desktop) */}
        <div className="hidden lg:flex items-center justify-between px-6 py-2.5 border-b border-border bg-card/60 backdrop-blur text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BackButton
              showLabel
              label="Back"
              variant="ghost"
              size="sm"
              fallbackPath="/admin"
              className="h-7 px-2 border border-border/50 bg-background/50 hover:bg-accent/10 hover:text-accent rounded-lg"
            />
            <div className="h-3.5 w-px bg-border/60 mx-1" />
            <span>Admin</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setShowFreshTunesModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 font-medium transition-colors py-1 px-2.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>All Streaming (FreshTunes)</span>
            </button>
            <NavLink
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-muted"
            >
              <Home className="h-3.5 w-3.5" />
              Return to Website
            </NavLink>
          </div>
        </div>

        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>

      <FreshTunesPortalModal
        open={showFreshTunesModal}
        onOpenChange={setShowFreshTunesModal}
      />
    </div>
  );
}
