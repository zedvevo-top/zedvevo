import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Music2, Video, CreditCard, Trophy,
  Image, Settings, Menu, X, LogOut, ChevronRight, Download,
  Star, TrendingUp, Bell, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = profile?.role === 'super_admin';
  const navItems = isSuperAdmin ? NAV_ITEMS_ALL : NAV_ITEMS_ADMIN;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-0.5">ZedVevo</p>
        <p className="text-sm font-bold">Admin Panel</p>
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
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
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

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border bg-card">
        <SidebarContent />
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
          <p className="text-sm font-bold">Admin Panel</p>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 p-0 bg-card">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        {/* Breadcrumb strip (desktop) */}
        <div className="hidden lg:flex items-center gap-1.5 px-6 py-2 border-b border-border bg-background text-xs text-muted-foreground">
          <span>Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Dashboard</span>
        </div>

        <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
