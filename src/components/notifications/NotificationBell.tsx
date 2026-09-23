import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Trash2, ExternalLink, ShieldCheck,
  Sparkles, CheckCircle2, XCircle, AlertTriangle, ArrowRight,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserNotifications, markNotificationRead, deleteNotification,
  markAllNotificationsRead, getUnreadNotificationCount, clearAllUserNotifications
} from '@/lib/api';
import type { Notification } from '@/types/index';
import { formatDate, cn } from '@/lib/utils';
import { supabase } from '@/db/supabase';
import { playNotificationChime } from '@/services/adminNotificationService';

const getNotificationDetails = (n: Notification) => {
  const type = n.notification_type || n.type || 'general';
  const meta = n.metadata || {};

  let icon = '🔔';
  let badgeColor = 'bg-primary/10 text-primary border-primary/20';
  let defaultLink = '/dashboard';
  let actionText = 'View Details';

  switch (type) {
    case 'payment_success':
    case 'approved':
      icon = '💰';
      badgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      if (meta.plan_type || meta.plan_id || n.message?.includes('upload') || n.message?.includes('plan')) {
        defaultLink = '/upload';
        actionText = 'Start Upload';
      } else if (meta.item_id || n.message?.includes('purchase') || n.message?.includes('Downloads')) {
        defaultLink = '/downloads';
        actionText = 'My Downloads';
      } else {
        defaultLink = '/dashboard?tab=payments';
        actionText = 'View Payment';
      }
      break;

    case 'payment_failed':
    case 'payment_declined':
    case 'error':
      icon = '❌';
      badgeColor = 'bg-destructive/10 text-destructive border-destructive/20';
      defaultLink = '/dashboard?tab=payments';
      actionText = 'Payment Status';
      break;

    case 'voting_open':
    case 'vote_success':
    case 'vote':
      icon = '🗳️';
      badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      defaultLink = meta.nominee_id ? `/awards?nominee=${meta.nominee_id}` : '/awards';
      actionText = 'View Nominee & Votes';
      break;

    case 'nomination_approved':
    case 'nominee_approved':
      icon = '🌟';
      badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      defaultLink = '/awards';
      actionText = 'View Award Category';
      break;

    case 'award_winner':
    case 'winner_of_month':
      icon = '🏆';
      badgeColor = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      defaultLink = '/awards';
      actionText = 'View Winners';
      break;

    case 'song_release':
    case 'song':
      icon = '🎵';
      badgeColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      defaultLink = n.link || '/music';
      actionText = 'Listen Now';
      break;

    case 'video_release':
    case 'video':
      icon = '🎬';
      badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
      defaultLink = n.link || '/videos';
      actionText = 'Watch Video';
      break;

    default:
      icon = 'ℹ️';
      badgeColor = 'bg-accent/10 text-accent border-accent/20';
      defaultLink = n.link || '/dashboard';
      actionText = 'View Details';
      break;
  }

  const destination = n.link || n.action_url || defaultLink;

  return { icon, badgeColor, destination, actionText };
};

export default function NotificationBell({ className }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'transactions'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const [list, count] = await Promise.all([
        getUserNotifications(user.id),
        getUnreadNotificationCount(user.id),
      ]);
      setNotifications(list);
      setUnread(count);
    } catch (err) {
      console.warn('Error loading notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    // Real-time Supabase subscription for instant live notification bell count
    const channel = supabase
      .channel(`realtime_bell_notifications_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)]);
            if (!newNotif.is_read) {
              setUnread((c) => c + 1);
              try { playNotificationChime(); } catch {}
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
            );
            loadNotifications();
          } else if (payload.eventType === 'DELETE') {
            const oldNotif = payload.old as { id: string };
            setNotifications((prev) => prev.filter((n) => n.id !== oldNotif.id));
            loadNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotifications]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpenToggle = async () => {
    const nextState = !open;
    setOpen(nextState);
    if (nextState && user) {
      setLoading(true);
      await loadNotifications();
      setLoading(false);
    }
  };

  const handleNotificationClick = async (n: Notification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Mark as read immediately in UI and DB
    if (!n.is_read) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
      setUnread((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(console.error);
    }

    setOpen(false);
    const { destination } = getNotificationDetails(n);
    if (destination) {
      navigate(destination);
    }
  };

  const handleMarkAsReadOnly = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = notifications.find((x) => x.id === id);
    if (item && !item.is_read) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === id ? { ...x, is_read: true } : x))
      );
      setUnread((c) => Math.max(0, c - 1));
      await markNotificationRead(id);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = notifications.find((x) => x.id === id);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (item && !item.is_read) {
      setUnread((c) => Math.max(0, c - 1));
    }
    await deleteNotification(id).catch(console.error);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    await markAllNotificationsRead(user.id).catch(console.error);
  };

  const handleClearAll = async () => {
    if (!user) return;
    setNotifications([]);
    setUnread(0);
    await clearAllUserNotifications(user.id).catch(console.error);
  };

  if (!user) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'transactions') {
      const t = n.notification_type || '';
      return t.includes('payment') || t.includes('vote') || t.includes('nominee') || t.includes('plan');
    }
    return true;
  });

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      {/* Trigger Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'relative h-9 w-9 rounded-xl transition-all duration-200 hover:bg-accent/15',
          open && 'bg-accent/20 text-accent ring-2 ring-accent/30'
        )}
        onClick={handleOpenToggle}
        aria-label="Notifications"
      >
        <Bell className={cn('h-5 w-5 transition-transform duration-200', unread > 0 && 'text-foreground animate-[wiggle_1.5s_ease-in-out_infinite]')} />
        
        {/* Real-time Unread Badge: 🔔 3 */}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-black text-white shadow-md ring-2 ring-background animate-in zoom-in-50 duration-200">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {/* Clickable Notification Center Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[420px] max-w-[95vw] z-[300] bg-card/95 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-border/60 bg-muted/30">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight">Notification Center</span>
                {unread > 0 ? (
                  <Badge variant="destructive" className="h-5 px-2 text-[10px] font-bold">
                    {unread} Unread
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                    All caught up
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {unread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    className="h-7 px-2 text-xs font-semibold text-accent hover:text-accent hover:bg-accent/10"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Read all
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Clear notification list"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-background/60 p-1 rounded-xl border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  'flex-1 py-1 px-2 rounded-lg font-medium transition-colors text-center',
                  activeTab === 'all'
                    ? 'bg-accent text-accent-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={cn(
                  'flex-1 py-1 px-2 rounded-lg font-medium transition-colors text-center',
                  activeTab === 'unread'
                    ? 'bg-accent text-accent-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Unread ({unread})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('transactions')}
                className={cn(
                  'flex-1 py-1 px-2 rounded-lg font-medium transition-colors text-center',
                  activeTab === 'transactions'
                    ? 'bg-accent text-accent-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Payments & Votes
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[440px] overflow-y-auto divide-y divide-border/40">
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <div className="h-5 w-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Updating notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3 text-2xl">
                  🔔
                </div>
                <p className="text-sm font-semibold text-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
                  {activeTab === 'unread'
                    ? 'You have read all your notifications.'
                    : 'When you make payments, receive votes, or upload music, live alerts will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const { icon, badgeColor, destination, actionText } = getNotificationDetails(n);
                const txnId = n.transaction_id || n.payment_id || n.metadata?.transaction_id || n.metadata?.payment_id;

                return (
                  <div
                    key={n.id}
                    onClick={(e) => handleNotificationClick(n, e)}
                    className={cn(
                      'group relative p-3.5 sm:p-4 transition-all duration-150 cursor-pointer flex gap-3 hover:bg-muted/60',
                      !n.is_read ? 'bg-accent/[0.07] hover:bg-accent/[0.12]' : 'bg-transparent'
                    )}
                  >
                    {/* Unread indicator bar */}
                    {!n.is_read && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-accent rounded-r-full" />
                    )}

                    {/* Notification Icon */}
                    <div className="text-2xl shrink-0 mt-0.5 select-none">{icon}</div>

                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={cn('text-xs sm:text-sm leading-tight text-foreground line-clamp-1', !n.is_read ? 'font-bold' : 'font-medium')}>
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                          {formatDate(n.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                        {n.message}
                      </p>

                      {/* Transaction & Reference Metadata Chips */}
                      {txnId && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[10px] font-mono text-muted-foreground border border-border/50">
                            <ShieldCheck className="h-3 w-3 text-emerald-500" />
                            ID: {String(txnId).slice(0, 16)}
                          </span>
                          {n.metadata?.amount && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                              ZMW {n.metadata.amount}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action trigger button */}
                      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-border/30">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent group-hover:underline">
                          {actionText}
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {!n.is_read && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsReadOnly(n.id, e)}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted text-[10px]"
                              title="Mark as read"
                            >
                              <CheckCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNotification(n.id, e)}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-[10px]"
                            title="Dismiss notification"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
