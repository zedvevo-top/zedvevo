import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// Play subtle, non-intrusive sound chime when alert arrives
function playNotificationChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch {
    // AudioContext blocked or not supported
  }
}

/**
 * Dispatches a native OS / browser pop-up notification.
 * This triggers a system-level popup notification that appears over any other application
 * on the user's screen even if the browser is minimized or the admin is in another app.
 */
export async function showAdminPopNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    icon?: string;
    data?: any;
  }
) {
  playNotificationChime();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    toast.info(`${title}: ${options.body}`, { duration: 6000 });
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      // First try service worker notification for best OS / background popup reliability
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(title, {
            body: options.body,
            icon: options.icon || '/favicon.png',
            badge: '/favicon.png',
            tag: options.tag,
            data: options.data,
            requireInteraction: true,
          } as any);
          return;
        }
      }

      // Fallback to standard window Notification
      const popup = new Notification(title, {
        body: options.body,
        icon: options.icon || '/favicon.png',
        badge: '/favicon.png',
        tag: options.tag,
        requireInteraction: true,
      } as any);

      popup.onclick = () => {
        window.focus();
        popup.close();
      };
    } catch (err) {
      console.warn('[AdminNotifications] Native notification display error:', err);
      toast.info(`${title}: ${options.body}`, { duration: 6000 });
    }
  } else {
    // If not granted, display prominent in-app notification
    toast.info(`${title}: ${options.body}`, { duration: 6000 });
  }
}

/**
 * Requests permission for OS background pop-up messages.
 */
export async function requestAdminNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showAdminPopNotification('🔔 ZedVevo Pop-up Notifications Active', {
        body: 'You will receive instant pop-up alerts on your device for every new song, nominee, and vote even when using other apps.',
        tag: 'admin-welcome',
      });
    }
    return perm;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return 'denied';
  }
}

export function getAdminNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Starts real-time listeners and polling fallback for songs, nominees, and votes.
 */
export function startAdminNotificationMonitor(isAdmin: boolean) {
  if (!isAdmin || typeof window === 'undefined') return () => {};

  let active = true;
  let lastKnownSongId: string | null = null;
  let lastKnownNomineeId: string | null = null;
  let lastKnownVoteId: string | null = null;
  let isInitialCheck = true;

  // 1. Supabase Realtime Channels
  const channel = supabase
    .channel('admin-activity-popups')
    // Song uploads
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'songs' },
      (payload) => {
        const song = payload.new as any;
        if (!song) return;
        lastKnownSongId = song.id;
        showAdminPopNotification('🎵 New Song Uploaded!', {
          body: `"${song.title || 'Untitled'}" by ${song.artist_name || 'Artist'} was submitted.`,
          tag: `song-${song.id}`,
        });
        toast.info(`🎵 New song uploaded: "${song.title}" by ${song.artist_name}`);
      }
    )
    // Award Nominees
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'nominees' },
      (payload) => {
        const nominee = payload.new as any;
        if (!nominee) return;
        lastKnownNomineeId = nominee.id;
        showAdminPopNotification('🏆 New Award Nominee Submitted!', {
          body: `${nominee.name || 'Nominee'} was entered for "${nominee.song_title || 'Award Entry'}"`,
          tag: `nominee-${nominee.id}`,
        });
        toast.info(`🏆 New nominee submitted: ${nominee.name}`);
      }
    )
    // Nominee Votes
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'votes' },
      (payload) => {
        const vote = payload.new as any;
        if (!vote) return;
        lastKnownVoteId = vote.id;
        const count = vote.vote_count || 1;
        showAdminPopNotification('🗳️ New Nominee Vote Cast!', {
          body: `${count} vote(s) recorded for award candidate.`,
          tag: `vote-${vote.id}`,
        });
        toast.success(`🗳️ ${count} vote(s) cast for nominee!`);
      }
    )
    .subscribe();

  // 2. High-reliability Polling Fallback (runs every 12 seconds)
  // Ensures admin gets notified even if websocket disconnected while user was in another app
  const pollLatest = async () => {
    if (!active) return;
    try {
      // Check latest song
      const { data: latestSongs } = await supabase
        .from('songs')
        .select('id, title, artist_name, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestSongs && latestSongs.length > 0) {
        const song = latestSongs[0];
        if (!isInitialCheck && lastKnownSongId && song.id !== lastKnownSongId) {
          showAdminPopNotification('🎵 New Song Uploaded!', {
            body: `"${song.title || 'Untitled'}" by ${song.artist_name || 'Artist'} was submitted.`,
            tag: `song-${song.id}`,
          });
        }
        lastKnownSongId = song.id;
      }

      // Check latest nominee
      const { data: latestNominees } = await supabase
        .from('nominees')
        .select('id, name, song_title, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestNominees && latestNominees.length > 0) {
        const nominee = latestNominees[0];
        if (!isInitialCheck && lastKnownNomineeId && nominee.id !== lastKnownNomineeId) {
          showAdminPopNotification('🏆 New Award Nominee Submitted!', {
            body: `${nominee.name || 'Nominee'} was entered for "${nominee.song_title || 'Award Entry'}"`,
            tag: `nominee-${nominee.id}`,
          });
        }
        lastKnownNomineeId = nominee.id;
      }

      // Check latest vote
      const { data: latestVotes } = await supabase
        .from('votes')
        .select('id, vote_count, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestVotes && latestVotes.length > 0) {
        const vote = latestVotes[0];
        if (!isInitialCheck && lastKnownVoteId && vote.id !== lastKnownVoteId) {
          showAdminPopNotification('🗳️ New Nominee Vote Cast!', {
            body: `${vote.vote_count || 1} vote(s) recorded for award candidate.`,
            tag: `vote-${vote.id}`,
          });
        }
        lastKnownVoteId = vote.id;
      }

      isInitialCheck = false;
    } catch {
      // Ignore background fetch error
    }
  };

  // Run initial poll
  pollLatest();
  const timer = setInterval(pollLatest, 12000);

  return () => {
    active = false;
    clearInterval(timer);
    supabase.removeChannel(channel);
  };
}
