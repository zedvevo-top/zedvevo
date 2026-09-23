import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// Play custom iPhone or Samsung sound chime when alert arrives
export function playNotificationChime(soundTypeOverride?: 'iphone' | 'samsung') {
  try {
    const soundPreference = soundTypeOverride || localStorage.getItem('zedvevo_notification_sound') || 'iphone';
    if (soundPreference === 'none') return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    if (soundPreference === 'iphone') {
      // High-Fidelity iPhone Tri-Tone: G5 (784Hz) -> C6 (1046.5Hz) -> E6 (1318.5Hz)
      const notes = [784.00, 1046.50, 1318.51];
      const noteDurations = [0.12, 0.12, 0.25];
      const startTimes = [0.0, 0.11, 0.22];

      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTimes[i]);
        
        // Classic metallic bell chime overtones
        const oscOvertone = audioCtx.createOscillator();
        const overtoneGain = audioCtx.createGain();
        oscOvertone.type = 'sine';
        oscOvertone.frequency.setValueAtTime(freq * 2.001, audioCtx.currentTime + startTimes[i]); // slight detune overtone
        
        // Envelope settings
        gain.gain.setValueAtTime(0.0, audioCtx.currentTime + startTimes[i]);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + startTimes[i] + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTimes[i] + noteDurations[i]);

        overtoneGain.gain.setValueAtTime(0.0, audioCtx.currentTime + startTimes[i]);
        overtoneGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + startTimes[i] + 0.01);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTimes[i] + noteDurations[i] * 0.7);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        oscOvertone.connect(overtoneGain);
        overtoneGain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + startTimes[i]);
        oscOvertone.start(audioCtx.currentTime + startTimes[i]);
        
        osc.stop(audioCtx.currentTime + startTimes[i] + noteDurations[i]);
        oscOvertone.stop(audioCtx.currentTime + startTimes[i] + noteDurations[i]);
      });
    } else if (soundPreference === 'samsung') {
      // High-Fidelity Samsung Bubbly/Skyline Chime: 4 fast climbing bubbly bell tones
      // Bb5 (932.33Hz) -> Eb6 (1244.51Hz) -> F6 (1396.91Hz) -> Bb6 (1864.66Hz)
      const notes = [932.33, 1244.51, 1396.91, 1864.66];
      const startTimes = [0.0, 0.06, 0.12, 0.18];
      const noteDurations = [0.15, 0.15, 0.15, 0.3];

      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // Triangle wave gives it a softer, bubblier characteristic, blended with sine wave
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTimes[i]);
        
        // Add subtle pitch sweep (frequency modulation) to sound extra bubbly
        osc.frequency.exponentialRampToValueAtTime(freq * 1.05, audioCtx.currentTime + startTimes[i] + 0.05);

        gain.gain.setValueAtTime(0.0, audioCtx.currentTime + startTimes[i]);
        gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + startTimes[i] + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTimes[i] + noteDurations[i]);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + startTimes[i]);
        osc.stop(audioCtx.currentTime + startTimes[i] + noteDurations[i]);
      });
    }
  } catch (err) {
    console.warn('Failed to play custom notification sound chime:', err);
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
  let lastKnownUserId: string | null = null;
  let lastKnownPaymentId: string | null = null;
  let isInitialCheck = true;

  // 1. Supabase Realtime Channels for Admin
  const channel = supabase
    .channel('admin-comprehensive-activity-popups')
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
    // Video uploads
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'videos' },
      (payload) => {
        const video = payload.new as any;
        if (!video) return;
        showAdminPopNotification('🎬 New Video Uploaded!', {
          body: `"${video.title || 'Untitled'}" by ${video.artist_name || 'Artist'} was uploaded.`,
          tag: `video-${video.id}`,
        });
        toast.info(`🎬 New video uploaded: "${video.title}"`);
      }
    )
    // New Users & Artists
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'users' },
      (payload) => {
        const u = payload.new as any;
        if (!u) return;
        lastKnownUserId = u.id;
        const isArtist = u.is_artist || u.role === 'artist';
        const title = isArtist ? '🎸 New Artist Registered!' : '👤 New User Registered!';
        const body = `${u.full_name || u.username || u.email || 'A new user'} joined ZedVevo.`;
        showAdminPopNotification(title, {
          body,
          tag: `user-${u.id}`,
        });
        toast.success(body);
      }
    )
    // Every Payment
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'payments' },
      (payload) => {
        const p = payload.new as any;
        if (!p) return;
        lastKnownPaymentId = p.id;
        const amount = p.amount;
        const type = p.payment_type || 'transaction';
        const status = p.status || 'completed';
        const title = status === 'completed' || status === 'successful' ? `💰 New Payment Received!` : `⚠️ Payment Notice`;
        const body = `ZMW ${amount} (${type}) transaction status: ${status}.`;
        showAdminPopNotification(title, {
          body,
          tag: `payment-${p.id}`,
        });
        toast.info(body);
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

  // 2. High-reliability Polling Fallback (runs every 10 seconds)
  const pollLatest = async () => {
    if (!active) return;
    try {
      // Check latest payment
      const { data: latestPayments } = await supabase
        .from('payments')
        .select('id, amount, payment_type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestPayments && latestPayments.length > 0) {
        const p = latestPayments[0];
        if (!isInitialCheck && lastKnownPaymentId && p.id !== lastKnownPaymentId) {
          showAdminPopNotification('💰 New Payment Received!', {
            body: `ZMW ${p.amount} (${p.payment_type || 'transaction'}) completed.`,
            tag: `payment-${p.id}`,
          });
        }
        lastKnownPaymentId = p.id;
      }

      // Check latest user
      const { data: latestUsers } = await supabase
        .from('users')
        .select('id, full_name, username, email, is_artist, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestUsers && latestUsers.length > 0) {
        const u = latestUsers[0];
        if (!isInitialCheck && lastKnownUserId && u.id !== lastKnownUserId) {
          const isArtist = u.is_artist;
          showAdminPopNotification(isArtist ? '🎸 New Artist Registered!' : '👤 New User Registered!', {
            body: `${u.full_name || u.username || u.email || 'A user'} joined ZedVevo.`,
            tag: `user-${u.id}`,
          });
        }
        lastKnownUserId = u.id;
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
      // Ignore
    }
  };

  pollLatest();
  const timer = setInterval(pollLatest, 10000);

  return () => {
    active = false;
    clearInterval(timer);
    supabase.removeChannel(channel);
  };
}
