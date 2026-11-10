import { getCustomVoiceWatermarkUrl, getAppIconUrl } from '@/lib/downloadHelper';

/**
 * Encodes an AudioBuffer into a valid PCM WAV Blob (16-bit stereo/mono)
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let pos = 0;
  let offset = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(pos++, str.charCodeAt(i));
    }
  }

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF header
  writeString('RIFF');
  setUint32(length - 8);
  writeString('WAVE');

  // fmt chunk
  writeString('fmt ');
  setUint32(16); // Chunk size = 16
  setUint16(1);  // Uncompressed PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * numOfChan * 2); // Byte rate
  setUint16(numOfChan * 2); // Block align
  setUint16(16); // Bits per sample

  // data chunk
  writeString('data');
  setUint32(length - pos - 4);

  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

/**
 * Synthesizes or loads a voice tag AudioBuffer ("ZedVevo - Official Zambian Music")
 */
export async function getOrSynthesizeVoiceWatermarkBuffer(
  audioCtx: AudioContext | OfflineAudioContext
): Promise<AudioBuffer> {
  const customVoiceUrl = getCustomVoiceWatermarkUrl();

  // 1. Try loading custom voice watermark or official voice watermark file
  const candidateUrls = [
    customVoiceUrl,
    '/audio/zedvevo-voice-watermark.wav',
    '/audio/zedvevo-voice-watermark.mp3',
  ].filter(Boolean) as string[];

  for (const url of candidateUrls) {
    try {
      let res = await fetch(url).catch(() => null);
      if (!res || !res.ok) {
        // Try proxy if external URL
        if (url.startsWith('http')) {
          res = await fetch(`/api/proxy-audio?url=${encodeURIComponent(url)}`).catch(() => null);
        }
      }
      if (res && res.ok) {
        const ab = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(ab.slice(0));
        if (decoded && decoded.duration > 0.5) {
          return decoded;
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  // 2. Synthesize fallback energetic radio chime + voice drop watermark
  const sampleRate = audioCtx.sampleRate || 44100;
  const duration = 2.4;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Musical intro chime chords: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
  const freqs = [523.25, 659.25, 783.99, 1046.5];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // Note 1: 0.0s - 0.4s
    if (t < 0.4) {
      const envelope = Math.sin((t / 0.4) * Math.PI);
      sample += 0.25 * Math.sin(2 * Math.PI * freqs[0] * t) * envelope;
    }
    // Note 2: 0.2s - 0.7s
    if (t >= 0.2 && t < 0.7) {
      const envelope = Math.sin(((t - 0.2) / 0.5) * Math.PI);
      sample += 0.25 * Math.sin(2 * Math.PI * freqs[1] * t) * envelope;
    }
    // Note 3: 0.5s - 1.2s
    if (t >= 0.5 && t < 1.2) {
      const envelope = Math.sin(((t - 0.5) / 0.7) * Math.PI);
      sample += 0.3 * Math.sin(2 * Math.PI * freqs[2] * t) * envelope;
    }
    // Note 4: 0.8s - 2.4s (sustaining chime)
    if (t >= 0.8) {
      const envelope = Math.exp(-(t - 0.8) * 2.5);
      sample += 0.35 * Math.sin(2 * Math.PI * freqs[3] * t) * envelope;
    }

    left[i] = sample;
    right[i] = sample;
  }

  return buffer;
}

/**
 * Merges a voice watermark tag onto the start of an audio file using OfflineAudioContext.
 */
export async function createWatermarkedAudioBlob(
  audioUrl: string
): Promise<Blob | null> {
  try {
    let res = await fetch(audioUrl, { mode: 'cors' }).catch(() => null);
    if (!res || !res.ok) {
      // Try audio proxy fallback
      res = await fetch(`/api/proxy-audio?url=${encodeURIComponent(audioUrl)}`).catch(() => null);
    }
    if (!res || !res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const songBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));

    // Get voice watermark buffer
    const voiceBuffer = await getOrSynthesizeVoiceWatermarkBuffer(tempCtx);

    const sampleRate = songBuffer.sampleRate || 44100;
    const voiceDuration = voiceBuffer.duration;
    const songStartTime = Math.max(0, voiceDuration - 0.25);
    const totalSamples = Math.ceil((songStartTime + songBuffer.duration + 0.5) * sampleRate);

    // Create 2-channel stereo OfflineAudioContext to render watermarked audio
    const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

    // Voice tag source at 0.0s
    const voiceSource = offlineCtx.createBufferSource();
    voiceSource.buffer = voiceBuffer;

    const voiceGain = offlineCtx.createGain();
    voiceGain.gain.setValueAtTime(0.95, 0);
    voiceGain.gain.setValueAtTime(0.95, songStartTime);
    voiceGain.gain.linearRampToValueAtTime(0.0, voiceDuration);
    voiceSource.connect(voiceGain);
    voiceGain.connect(offlineCtx.destination);

    // Song source starting seamlessly after voice tag
    const songSource = offlineCtx.createBufferSource();
    songSource.buffer = songBuffer;

    const songGain = offlineCtx.createGain();
    songGain.gain.setValueAtTime(0.0, songStartTime);
    songGain.gain.linearRampToValueAtTime(1.0, voiceDuration + 0.2);

    songSource.connect(songGain);
    songGain.connect(offlineCtx.destination);

    voiceSource.start(0);
    songSource.start(songStartTime);

    const renderedBuffer = await offlineCtx.startRendering();
    tempCtx.close();

    return audioBufferToWav(renderedBuffer);
  } catch (err) {
    console.warn('Audio watermarking fallback:', err);
    return null;
  }
}

/**
 * Draws the ZedVevo Image Logo & Watermark Badge on a canvas over a video frame.
 */
export function drawVideoLogoWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  logoImg?: HTMLImageElement | null
) {
  ctx.save();

  // Watermark Badge dimensions
  const badgeWidth = Math.max(120, width * 0.18);
  const badgeHeight = Math.max(36, height * 0.07);
  const padding = 16;
  const x = width - badgeWidth - padding;
  const y = padding;

  // Draw semi-transparent dark rounded badge
  ctx.fillStyle = 'rgba(10, 15, 25, 0.75)';
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)';
  ctx.lineWidth = 1.5;

  const radius = 8;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + badgeWidth - radius, y);
  ctx.quadraticCurveTo(x + badgeWidth, y, x + badgeWidth, y + radius);
  ctx.lineTo(x + badgeWidth, y + badgeHeight - radius);
  ctx.quadraticCurveTo(x + badgeWidth, y + badgeHeight, x + badgeWidth - radius, y + badgeHeight);
  ctx.lineTo(x + radius, y + badgeHeight);
  ctx.quadraticCurveTo(x, y + badgeHeight, x, y + badgeHeight - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw Logo icon if available
  const iconSize = badgeHeight * 0.65;
  const iconX = x + 8;
  const iconY = y + (badgeHeight - iconSize) / 2;

  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.drawImage(logoImg, iconX, iconY, iconSize, iconSize);
  } else {
    // Cyan Brand Dot
    ctx.fillStyle = '#00D4FF';
    ctx.beginPath();
    ctx.arc(iconX + iconSize / 2, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw "ZedVevo" watermark text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.max(11, Math.floor(badgeHeight * 0.38))}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('ZedVevo', iconX + iconSize + 8, y + badgeHeight * 0.38);

  ctx.fillStyle = '#00D4FF';
  ctx.font = `500 ${Math.max(8, Math.floor(badgeHeight * 0.28))}px system-ui, -apple-system, sans-serif`;
  ctx.fillText('Official Video', iconX + iconSize + 8, y + badgeHeight * 0.72);

  ctx.restore();
}
