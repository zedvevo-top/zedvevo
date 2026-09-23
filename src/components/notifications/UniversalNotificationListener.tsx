import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Sparkles, Music2, Award, DollarSign, CheckCircle2, XCircle, Bell, X, ExternalLink } from 'lucide-react';
import { showAdminPopNotification, requestAdminNotificationPermission, playNotificationChime } from '@/services/adminNotificationService';

interface MobilePushNotification {
  id: string;
  title: string;
  body: string;
  type: 'song_release' | 'payment_success' | 'payment_failed' | 'announcement';
  iconUrl?: string;
  actionUrl?: string;
  timeText: string;
}

export function UniversalNotificationListener() {
  const [activePush, setActivePush] = useState<MobilePushNotification | null>(null);

  // Play subtle haptic feedback and custom sound when alert arrives
  const triggerNotificationFeedback = () => {
    try {
      playNotificationChime();
      if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // ignore
    }
  };

  const pushMobileBanner = (notif: MobilePushNotification) => {
    setActivePush(notif);
    triggerNotificationFeedback();

    // Sticky like Facebook / WhatsApp - does not auto-dismiss! The user must interact or swipe/X dismiss.
  };

  useEffect(() => {
    // 1. Auto request notification permission on first user interaction if default
    const handleFirstInteraction = () => {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        void requestAdminNotificationPermission();
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    // 2. Realtime Subscription for NEW SONGS
    const songChannel = supabase
      .channel('realtime_universal_songs_broadcast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'songs' },
        (payload) => {
          const newSong = payload.new;
          if (!newSong) return;

          const artistName = newSong.artist_name || newSong.artist || 'ZedVevo Artist';
          const songTitle = newSong.title || 'New Song';
          const coverUrl = newSong.cover_url || '/app-icon.png';
          const songSlug = newSong.slug || newSong.id;

          const title = `🎵 NEW SONG RELEASED!`;
          const body = `"${songTitle}" by ${artistName} is now live. Tap to listen!`;

          // Native OS Push Notification
          void showAdminPopNotification(title, {
            body,
            icon: coverUrl,
            tag: `song-${newSong.id}`,
            data: { url: `/song/${songSlug}` }
          });

          // Custom Mobile App Push Notification Overlay
          pushMobileBanner({
            id: `song-${newSong.id}-${Date.now()}`,
            title,
            body,
            type: 'song_release',
            iconUrl: coverUrl,
            actionUrl: `/song/${songSlug}`,
            timeText: 'Just now'
          });

          // Sonner Toast Backup
          toast.custom((t) => (
            <div
              onClick={() => {
                window.location.href = `/song/${songSlug}`;
                toast.dismiss(t);
              }}
              className="bg-card/95 backdrop-blur-md border-2 border-primary text-card-foreground p-3 rounded-2xl shadow-2xl flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-all animate-in fade-in slide-in-from-top-4 duration-300"
            >
              <img src={coverUrl} alt={songTitle} className="w-12 h-12 rounded-xl object-cover border border-primary/30" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[10px] text-primary uppercase font-bold tracking-wider">
                  <Sparkles className="w-3 h-3 text-primary" /> New Release Alert
                </div>
                <p className="font-bold text-xs truncate text-foreground">{songTitle}</p>
                <p className="text-[11px] text-muted-foreground truncate">{artistName}</p>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 bg-primary text-primary-foreground rounded-lg shadow-sm">
                Play
              </span>
            </div>
          ), { duration: 10000 });
        }
      )
      .subscribe();

    // Realtime Subscription for NEW VIDEOS
    const videoChannel = supabase
      .channel('realtime_universal_videos_broadcast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'videos' },
        (payload) => {
          const newVideo = payload.new;
          if (!newVideo) return;

          const artistName = newVideo.artist_name || 'ZedVevo Artist';
          const videoTitle = newVideo.title || 'New Video';
          const thumbnail = newVideo.thumbnail_url || '/app-icon.png';
          const videoSlug = newVideo.slug || newVideo.id;

          const title = `🎬 NEW VIDEO UPLOADED!`;
          const body = `"${videoTitle}" by ${artistName} is now live. Tap to watch!`;

          // Native OS Push Notification
          void showAdminPopNotification(title, {
            body,
            icon: thumbnail,
            tag: `video-${newVideo.id}`,
            data: { url: `/video/${videoSlug}` }
          });

          // Custom Mobile App Push Notification Overlay
          pushMobileBanner({
            id: `video-${newVideo.id}-${Date.now()}`,
            title,
            body,
            type: 'song_release',
            iconUrl: thumbnail,
            actionUrl: `/video/${videoSlug}`,
            timeText: 'Just now'
          });
        }
      )
      .subscribe();

    // 3. Realtime Subscription for PAYMENTS (Success & Failed)
    const pmtChannel = supabase
      .channel('realtime_universal_payments_broadcast')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        (payload) => {
          const p = payload.new as any;
          if (!p) return;

          const type = p.payment_type;
          const amount = p.amount;
          const status = p.status;
          const meta = p.metadata || {};

          let popupTitle = "🎉 Payment Successful";
          let popupBody = `ZMW ${amount} payment completed successfully.`;
          let isSuccess = status === 'completed' || status === 'successful';
          let notifType: 'payment_success' | 'payment_failed' = isSuccess ? 'payment_success' : 'payment_failed';

          if (!isSuccess && status !== 'failed') {
            return; // Ignore pending states in broadcast push
          }

          if (!isSuccess) {
            popupTitle = "❌ Payment Failed";
            popupBody = p.failure_reason || `Mobile Money transaction of ZMW ${amount} failed or was declined.`;
          } else {
            if (type === 'vote') {
              const nomineeName = meta.nominee_name || 'artist';
              const votes = meta.vote_count || 1;
              popupTitle = "🗳️ Vote Confirmed!";
              popupBody = `${votes} vote(s) cast for ${nomineeName} (ZMW ${amount}).`;
            } else if (type === 'donation') {
              const donor = meta.donor_name || 'A generous supporter';
              popupTitle = "💰 Donation Received";
              popupBody = `${donor} donated ZMW ${amount} on ZedVevo!`;
            } else if (type === 'nominee_registration') {
              const nomineeName = meta.nominee_name || 'Nominee';
              popupTitle = "🌟 Nominee Approved!";
              popupBody = `${nomineeName} is now registered for ZedVevo Awards!`;
            } else if (type === 'plan' || type === 'subscription') {
              popupTitle = "⚡ Plan Activated!";
              popupBody = `Artist Upload Plan (ZMW ${amount}) is now active.`;
            }
          }

          // Native OS Push Notification
          void showAdminPopNotification(popupTitle, {
            body: popupBody,
            icon: meta.photo_url || '/app-icon.png',
            tag: `pmt-${p.id}`
          });

          // Custom Mobile App Push Notification Overlay
          pushMobileBanner({
            id: `pmt-${p.id}-${Date.now()}`,
            title: popupTitle,
            body: popupBody,
            type: notifType,
            iconUrl: meta.photo_url || '/app-icon.png',
            timeText: 'Just now'
          });

          // Toast Backup
          if (isSuccess) {
            toast.success(`${popupTitle}: ${popupBody}`, { duration: 6000 });
          } else {
            toast.error(`${popupTitle}: ${popupBody}`, { duration: 6000 });
          }
        }
      )
      .subscribe();

    // 4. Realtime Subscription for BROADCAST NOTIFICATIONS
    const notifChannel = supabase
      .channel('realtime_universal_notifications_broadcast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new;
          if (!n) return;

          const title = n.title || 'ZedVevo Announcement';
          const message = n.message || n.body || '';

          void showAdminPopNotification(title, {
            body: message,
            icon: '/app-icon.png',
            tag: `notif-${n.id}`
          });

          pushMobileBanner({
            id: `notif-${n.id}-${Date.now()}`,
            title,
            body: message,
            type: 'announcement',
            iconUrl: '/app-icon.png',
            timeText: 'Just now'
          });
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      void supabase.removeChannel(songChannel);
      void supabase.removeChannel(videoChannel);
      void supabase.removeChannel(pmtChannel);
      void supabase.removeChannel(notifChannel);
    };
  }, []);

  return (
    <>
      {/* Mobile App Push Notification Overlay Banner */}
      {activePush && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[94%] max-w-md animate-in slide-in-from-top-6 fade-in duration-300">
          <div
            onClick={() => {
              if (activePush.actionUrl) {
                window.location.href = activePush.actionUrl;
              }
            }}
            className={`relative p-3.5 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-start gap-3 cursor-pointer transition-all hover:scale-[1.01] ${
              activePush.type === 'payment_failed'
                ? 'bg-red-950/90 border-red-500/50 text-red-100'
                : activePush.type === 'payment_success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                : 'bg-zinc-900/95 border-amber-500/40 text-white'
            }`}
          >
            {/* App Icon / Media Thumbnail */}
            <div className="relative shrink-0">
              <img
                src={activePush.iconUrl || '/app-icon.png'}
                alt="App Icon"
                className="w-11 h-11 rounded-xl object-cover border border-white/20 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px]">
                {activePush.type === 'payment_failed' ? (
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                ) : activePush.type === 'payment_success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                )}
              </span>
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center justify-between text-[10px] text-white/60 mb-0.5">
                <span className="font-bold tracking-wider uppercase text-amber-400">ZedVevo • Push</span>
                <span>{activePush.timeText}</span>
              </div>
              <p className="font-bold text-xs truncate leading-tight">{activePush.title}</p>
              <p className="text-[11px] text-white/80 line-clamp-2 mt-0.5 leading-snug">{activePush.body}</p>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActivePush(null);
              }}
              className="absolute top-2.5 right-2.5 text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
