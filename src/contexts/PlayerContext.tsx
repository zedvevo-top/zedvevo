import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { Song } from '@/types/index';
import { incrementPlayCount } from '@/lib/api';
import { analytics } from '@/lib/analytics';
import { playZedVevoIntroTagSequence, playZedVevoOutroTag } from '@/services/audioTagService';

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
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMutedState] = useState(false);
  const countedRef = useRef<string | null>(null);
  const outroPlayedRef = useRef<string | null>(null);

  // Boot / swap audio when song changes
  useEffect(() => {
    if (!currentSong) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.src = '';
      audioRef.current = null;
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = '';

    const audio = new Audio(currentSong.file_url);
    audio.volume = muted ? 0 : volume;
    audioRef.current = audio;
    countedRef.current = null;
    outroPlayedRef.current = null;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); nextRef.current(); };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);

    // Play jingle/voice tag FIRST and always wait for it to finish before song starts
    setPlaying(true);
    playZedVevoIntroTagSequence().then(() => {
      if (audioRef.current === audio) {
        audio
          .play()
          .then(() => {
            setPlaying(true);
          })
          .catch((err) => {
            console.warn('Autoplay blocked, binding to first user interaction:', err);
            const resumeOnInteraction = () => {
              if (audioRef.current === audio) {
                audio
                  .play()
                  .then(() => setPlaying(true))
                  .catch(console.error);
              }
              document.removeEventListener('click', resumeOnInteraction);
              document.removeEventListener('keydown', resumeOnInteraction);
            };
            document.addEventListener('click', resumeOnInteraction);
            document.addEventListener('keydown', resumeOnInteraction);
          });
      }
    });

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audio.src = '';
    };
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Trigger end-of-song promo voice tag near song completion (e.g. 7s before end)
    if (
      duration > 12 &&
      currentTime >= duration - 7 &&
      currentSong &&
      outroPlayedRef.current !== currentSong.id
    ) {
      outroPlayedRef.current = currentSong.id;
      playZedVevoOutroTag();
    }
  }, [currentTime, duration, currentSong]);

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

  const playSong = useCallback((song: Song, newQueue?: Song[]) => {
    analytics.trackPlayerEvent('play', song.title, song.artist_name || 'Unknown');
    if (newQueue && newQueue.length > 0) setQueue(newQueue);
    else setQueue([song]);
    setCurrentSong(song);
  }, []);

  const closeSong = useCallback(() => {
    if (currentSong) {
      analytics.trackPlayerEvent('stop', currentSong.title, currentSong.artist_name || 'Unknown');
    }
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.src = '';
    audioRef.current = null;
    setCurrentSong(null);
    setQueue([]);
    setPlaying(false);
  }, [currentSong]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentSong) return;
    if (playing) {
      analytics.trackPlayerEvent('pause', currentSong.title, currentSong.artist_name || 'Unknown');
      audioRef.current.pause();
      setPlaying(false);
    } else {
      analytics.trackPlayerEvent('resume', currentSong.title, currentSong.artist_name || 'Unknown');
      audioRef.current.play().then(() => setPlaying(true)).catch(console.error);
    }
  }, [playing, currentSong]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (v > 0) setMutedState(false);
  }, []);

  const setMuted = useCallback((m: boolean) => {
    setMutedState(m);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentSong, queue, playing, currentTime, duration, volume, muted,
        playSong, closeSong, togglePlay, next, prev, seek, setVolume, setMuted,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
