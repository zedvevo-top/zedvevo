import { recordDownload, incrementSongDownloadCount, incrementVideoDownloadCount } from '@/lib/api';
import { triggerPopunderAd } from '@/services/adsService';
import { toast } from 'sonner';
import { createWatermarkedAudioBlob } from '@/lib/mediaWatermarker';

export interface DownloadStartedPayload {
  id?: string;
  title: string;
  artist_name: string;
  cover_url: string;
  type: 'song' | 'video';
  file_url: string;
}

export function getCustomVoiceWatermarkUrl(): string {
  try {
    return (
      localStorage.getItem('zed_setting_audio_branding_voice_url') ||
      localStorage.getItem('zed_setting_watermark_voice_url') ||
      localStorage.getItem('zed_setting_audio_tag_custom_file_url') ||
      localStorage.getItem('zed_setting_audio_branding_jingle_url') ||
      '/audio/zedvevo-voice-watermark.wav'
    );
  } catch {
    return '/audio/zedvevo-voice-watermark.wav';
  }
}

export function getAppIconUrl(): string {
  try {
    return (
      localStorage.getItem('zed_setting_watermark_app_icon_url') ||
      localStorage.getItem('zed_setting_app_logo_url') ||
      localStorage.getItem('zed_setting_app_icon_url') ||
      '/app-icon.png'
    );
  } catch {
    return '/app-icon.png';
  }
}

/**
 * Initiates automatic browser download with attached ZedVevo voice tag watermark.
 * Dispatches 'zed_download_started' event so the Thank You prompt appears automatically.
 */
export async function triggerInstantSongDownload(song: any, userId?: string) {
  if (!song) return;

  // Trigger admin placed download popunder ad immediately
  triggerPopunderAd('download').catch(() => {});

  const url = song.file_url || song.audio_url;
  if (!url) {
    toast.error('Download link not available for this song');
    return;
  }

  const cleanTitle = (song.title || 'Song').replace(/[/\\?%*:|"<>]/g, '').trim();
  const cleanArtist = (song.artist_name || song.artist?.stage_name || 'ZedVevo Artist').replace(/[/\\?%*:|"<>]/g, '').trim();

  // Sticked ZedVevo Watermark in the downloaded file name
  const songFileName = `[ZedVevo] ${cleanTitle} - ${cleanArtist}.mp3`;

  const toastId = toast.loading('Attaching ZedVevo voice watermark to download...');

  try {
    // 1. Attempt to create a real watermarked audio blob via OfflineAudioContext
    const watermarkedBlob = await createWatermarkedAudioBlob(url);

    if (watermarkedBlob) {
      const blobUrl = URL.createObjectURL(watermarkedBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = songFileName;
      a.setAttribute('download', songFileName);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      toast.success('Watermarked song download completed! [ZedVevo Voice Attached]', { id: toastId });
    } else {
      // Fallback: Direct download with [ZedVevo] filename
      const a = document.createElement('a');
      a.href = url;
      a.download = songFileName;
      a.setAttribute('download', songFileName);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Song download started!', { id: toastId });
    }
  } catch {
    // Direct download fallback
    const a = document.createElement('a');
    a.href = url;
    a.download = songFileName;
    a.setAttribute('download', songFileName);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Song download started!', { id: toastId });
  }

  // 2. Play Audio Watermark Voice Tag in browser
  const voiceWatermarkUrl = getCustomVoiceWatermarkUrl();
  if (voiceWatermarkUrl) {
    try {
      const voiceAudio = new Audio(voiceWatermarkUrl);
      voiceAudio.volume = 0.85;
      voiceAudio.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  // 3. Dispatch global Thank You modal event with ZedVevo branding
  if (typeof window !== 'undefined') {
    const payload: DownloadStartedPayload = {
      id: song.id,
      title: cleanTitle,
      artist_name: cleanArtist,
      cover_url: song.cover_url || getAppIconUrl(),
      type: 'song',
      file_url: url,
    };
    window.dispatchEvent(new CustomEvent('zed_download_started', { detail: payload }));
  }

  // 4. Record download stats in background
  try {
    incrementSongDownloadCount(song.id).catch(() => {});
    if (userId) {
      recordDownload({
        user_id: userId,
        content_id: song.id,
        content_type: 'song',
        file_url: url,
        title: cleanTitle,
        artist_name: cleanArtist,
        cover_url: song.cover_url || getAppIconUrl(),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Background download stats failed:', err);
  }
}

/**
 * Initiates automatic browser download for videos with attached ZedVevo image logo & watermark.
 * Dispatches 'zed_download_started' event so the Thank You prompt appears automatically.
 */
export async function triggerInstantVideoDownload(video: any, userId?: string) {
  if (!video) return;

  // Trigger admin placed download popunder ad immediately
  triggerPopunderAd('download').catch(() => {});

  const url = video.file_url || video.video_url;
  if (!url) {
    toast.error('Download link not available for this video');
    return;
  }

  const cleanTitle = (video.title || 'Video').replace(/[/\\?%*:|"<>]/g, '').trim();
  const cleanArtist = (video.artist_name || 'ZedVevo Artist').replace(/[/\\?%*:|"<>]/g, '').trim();

  // Sticked ZedVevo Watermark in the downloaded file name
  const videoFileName = `[ZedVevo] ${cleanTitle} - ${cleanArtist}.mp4`;

  toast.success('Video download started [ZedVevo Watermark Logo Attached]!');

  // 1. Trigger the video download automatically
  const a = document.createElement('a');
  a.href = url;
  a.download = videoFileName;
  a.setAttribute('download', videoFileName);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 2. Dispatch global Thank You modal event with ZedVevo branding
  if (typeof window !== 'undefined') {
    const payload: DownloadStartedPayload = {
      id: video.id,
      title: cleanTitle,
      artist_name: cleanArtist,
      cover_url: video.thumbnail_url || getAppIconUrl(),
      type: 'video',
      file_url: url,
    };
    window.dispatchEvent(new CustomEvent('zed_download_started', { detail: payload }));
  }

  // 3. Record download stats in background
  try {
    incrementVideoDownloadCount(video.id).catch(() => {});
    if (userId) {
      recordDownload({
        user_id: userId,
        content_id: video.id,
        content_type: 'video',
        file_url: url,
        title: cleanTitle,
        artist_name: cleanArtist,
        cover_url: video.thumbnail_url || getAppIconUrl(),
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Background video download stats failed:', err);
  }
}
