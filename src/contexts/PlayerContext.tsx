import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { Song } from '@/types/index';
import { incrementPlayCount } from '@/lib/api';
import { analytics } from '@/lib/analytics';
import { toast } from 'sonner';

interface PlayerContextValue {
  currentSong: Song | null;
  queue: Song[];
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playSong: (song: Song, queue?: Song[]) => void;
  closeSong: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMutedState] = useState(false);
  const countedRef = useRef<string | null>(null);

  const safePause = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    if (playPromiseRef.current) {
      playPromiseRef.current
        .catch(() => {})
        .finally(() => {
          try {
            audio.pause();
          } catch {}
        });
    } else {
      try {
        audio.pause();
      } catch {}
    }
  }, []);

  // Boot / swap audio when song changes
  useEffect(() => {
    if (!currentSong) {
      if (audioRef.current) {
        safePause(audioRef.current);
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audioRef.current) {
      safePause(audioRef.current);
      audioRef.current.src = '';
    }

    let isCancelled = false;
    const audio = new Audio(currentSong.file_url);
    audio.volume = muted ? 0 : volume;
    audioRef.current = audio;
    countedRef.current = null;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); nextRef.current(); };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);

    const playPromise = audio.play();
    playPromiseRef.current = playPromise;
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          if (isCancelled) {
            safePause(audio);
            return;
          }
          setPlaying(true);
        })
        .catch(err => {
          if (isCancelled) return;
          if (err?.name === 'AbortError' || err?.message?.includes('interrupted') || err?.message?.includes('pause')) {
            return;
          }
          console.warn('Autoplay blocked, binding to first user interaction:', err);
          const resumeOnInteraction = () => {
            if (audioRef.current === audio && !isCancelled) {
              const retryPromise = audio.play();
              playPromiseRef.current = retryPromise;
              if (retryPromise !== undefined) {
                retryPromise
                  .then(() => setPlaying(true))
                  .catch(e => {
                    if (e?.name === 'AbortError' || e?.message?.includes('interrupted') || e?.message?.includes('pause')) return;
                    console.warn('Playback retry error:', e);
                  });
              }
            }
            document.removeEventListener('click', resumeOnInteraction);
            document.removeEventListener('keydown', resumeOnInteraction);
          };
          document.addEventListener('click', resumeOnInteraction);
          document.addEventListener('keydown', resumeOnInteraction);
        });
    }

    return () => {
      isCancelled = true;
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      safePause(audio);
      audio.src = '';
    };
  }, [currentSong?.id, safePause]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume/mute
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // Count play reliably after 2 seconds of active playback
  useEffect(() => {
    if (currentTime >= 2 && currentSong && countedRef.current !== currentSong.id) {
      countedRef.current = currentSong.id;
      incrementPlayCount(currentSong.id);
      setCurrentSong((prev) => (prev && prev.id === currentSong.id ? { ...prev, play_count: (Number(prev.play_count) || 0) + 1 } : prev));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zedvevo:song-played', { detail: { songId: currentSong.id } }));
      }
    }
  }, [currentTime, currentSong]);

  // Keep a stable ref to next so the 'ended' handler always sees the latest queue
  const nextRef = useRef<() => void>(() => undefined);

  const next = useCallback(() => {
    if (!currentSong || !queue.length) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx >= 0 && idx < queue.length - 1) {
      const nextSong = queue[idx + 1];
      analytics.trackPlayerEvent('skip', nextSong.title, nextSong.artist_name || 'Unknown');
      setCurrentSong(nextSong);
    }
  }, [currentSong, queue]);

  const prev = useCallback(() => {
    if (!currentSong || !queue.length) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    if (idx > 0) {
      const prevSong = queue[idx - 1];
      analytics.trackPlayerEvent('prev', prevSong.title, prevSong.artist_name || 'Unknown');
      setCurrentSong(prevSong);
    }
  }, [currentSong, queue]);

  useEffect(() => { nextRef.current = next; }, [next]);

  const playSong = useCallback((song: Song, q: Song[] = []) => {
    setQueue(q);
    setCurrentSong(song);
    analytics.trackPlayerEvent('play', song.title, song.artist_name || 'Unknown');
    toast.info('📢 ZedVevo Uploads Ad: Upload your music & videos today to reach millions of fans across Zambia!', {
      duration: 5000,
      description: `Now playing "${song.title}" by ${song.artist_name || 'Artist'}`
    });
  }, []);

  const closeSong = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      safePause(audio);
      audio.src = '';
      audioRef.current = null;
    }
    setPlaying(false);
    setCurrentSong(null);
    setQueue([]);
  }, [safePause]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      setPlaying(false);
      safePause(audio);
      analytics.trackPlayerEvent('pause', currentSong?.title || 'Unknown', currentSong?.artist_name || 'Unknown');
    }
    else {
      const p = audio.play();
      playPromiseRef.current = p;
      if (p !== undefined) {
        p.then(() => {
          playPromiseRef.current = null;
          setPlaying(true);
          analytics.trackPlayerEvent('play', currentSong?.title || 'Unknown', currentSong?.artist_name || 'Unknown');
        }).catch(err => {
          playPromiseRef.current = null;
          if (err?.name === 'AbortError' || err?.message?.includes('interrupted') || err?.message?.includes('pause')) {
            return;
          }
          console.warn('Audio play failed:', err);
        });
      }
    }
  }, [playing, currentSong, safePause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) { audioRef.current.currentTime = time; setCurrentTime(time); }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    setMutedState(false);
  }, []);

  const setMuted = useCallback((m: boolean) => setMutedState(m), []);

  return (
    <PlayerContext.Provider value={{
      currentSong, queue, playing, currentTime, duration, volume, muted,
      playSong, closeSong, togglePlay, next, prev, seek, setVolume, setMuted,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  // Return a safe no-op fallback during HMR reloads or if used outside the provider
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn('[usePlayer] called outside <PlayerProvider> — returning no-op fallback');
    }
    return {
      currentSong: null,
      queue: [],
      playing: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      muted: false,
      playSong: () => {},
      closeSong: () => {},
      togglePlay: () => {},
      next: () => {},
      prev: () => {},
      seek: () => {},
      setVolume: () => {},
      setMuted: () => {},
    };
  }
  return ctx;
}
