/**
 * Audio Tag Service for ZedVevo
 * Manages active international rock jingle intros, layered voice-over audio,
 * custom uploaded audio files, and outro artist recruitment promos.
 */

let voicesLoaded = false;
let availableVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    availableVoices = window.speechSynthesis.getVoices();
    voicesLoaded = true;
  };
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function getInternationalRealisticVoice(): SpeechSynthesisVoice | null {
  if (!voicesLoaded) {
    availableVoices = window.speechSynthesis.getVoices();
  }
  if (!availableVoices.length) return null;

  return (
    availableVoices.find((v) =>
      /google uk english female|google us english female|google natural|samantha|karen|victoria|zira|moira|fiona|female|google|siri|en-us-x-sfg/i.test(
        v.name
      )
    ) ||
    availableVoices.find((v) => /en-US|en-GB|en-AU|en-ZA/i.test(v.lang) && /female|woman/i.test(v.name)) ||
    availableVoices.find((v) => v.lang.startsWith('en')) ||
    availableVoices[0]
  );
}

/**
 * Synthesizes an international-quality Rock Music Jingle
 * (Heavy power chords + electric guitar overdrive + kick/snare rock drive + cymbal crash)
 */
export function playActiveRockBeat() {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Distortion WaveShaper Node for heavy Overdriven Rock Guitar
    const distortion = ctx.createWaveShaper();
    const curve = new Float32Array(44100);
    const deg = Math.PI / 180;
    const k = 45; // Overdrive intensity
    for (let i = 0; i < 44100; ++i) {
      const x = (i * 2) / 44100 - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    distortion.curve = curve;
    distortion.oversample = '4x';

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, now);
    distortion.connect(masterGain);
    masterGain.connect(ctx.destination);

    // 1. Heavy Rock Power Chords (E3 - B3 - E4 - G4: 164.81, 246.94, 329.63, 392.00 Hz)
    const chordFreqs = [164.81, 246.94, 329.63, 392.0];
    chordFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(distortion);
      osc.start(now);
      osc.stop(now + 1.25);
    });

    // 2. Energetic Rock Drum Beat (Driving Kick Drum Pattern + Crash Cymbal)
    // Kick 1
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(200, now);
    kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.28);
    kickGain.gain.setValueAtTime(0.85, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    kickOsc.connect(kickGain);
    kickGain.connect(ctx.destination);
    kickOsc.start(now);
    kickOsc.stop(now + 0.32);

    // Kick 2 at 0.30s
    const kick2Osc = ctx.createOscillator();
    const kick2Gain = ctx.createGain();
    kick2Osc.type = 'sine';
    kick2Osc.frequency.setValueAtTime(180, now + 0.3);
    kick2Osc.frequency.exponentialRampToValueAtTime(35, now + 0.58);
    kick2Gain.gain.setValueAtTime(0.8, now + 0.3);
    kick2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    kick2Osc.connect(kick2Gain);
    kick2Gain.connect(ctx.destination);
    kick2Osc.start(now + 0.3);
    kick2Osc.stop(now + 0.62);

    // Snare / Crash Cymbal Burst at 0.30s
    const bufferSize = ctx.sampleRate * 0.3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1200;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now + 0.3);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now + 0.3);
    whiteNoise.stop(now + 0.68);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 2500);
  } catch (err) {
    console.warn('[AudioTagService] Web Audio synth error:', err);
  }
}

/**
 * Executes the Audio Branding intro jingle sequence:
 * Plays the Rock Jingle beat while the voice-over speaks directly ON TOP OF THE BEAT.
 * Resolves ONLY after the complete jingle & voice finish so the track starts right after.
 */
export function playZedVevoIntroTagSequence(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    try {
      const isEnabled = localStorage.getItem('zed_setting_audio_tag_enabled');
      if (isEnabled === 'false') {
        resolve();
        return;
      }

      // 1. Check if Admin uploaded custom 'Rock' Jingle or custom 'Thank You' Voice audio
      const customJingleUrl =
        localStorage.getItem('zed_setting_audio_branding_jingle_url') ||
        localStorage.getItem('zed_setting_audio_tag_custom_file_url');

      const customVoiceUrl = localStorage.getItem('zed_setting_audio_branding_voice_url');

      if ((customJingleUrl && customJingleUrl.trim().length > 5) || (customVoiceUrl && customVoiceUrl.trim().length > 5)) {
        let resolved = false;
        const finish = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        let pendingCount = 0;

        if (customJingleUrl && customJingleUrl.trim().length > 5) {
          pendingCount++;
          const jingleAudio = new Audio(customJingleUrl.trim());
          jingleAudio.volume = 0.95;
          jingleAudio.onended = () => {
            pendingCount--;
            if (pendingCount <= 0) finish();
          };
          jingleAudio.onerror = () => {
            pendingCount--;
            if (pendingCount <= 0) finish();
          };
          jingleAudio.play().catch(() => {
            pendingCount--;
            if (pendingCount <= 0) finish();
          });
        }

        if (customVoiceUrl && customVoiceUrl.trim().length > 5) {
          pendingCount++;
          // Play voice on top after 150ms delay
          setTimeout(() => {
            const voiceAudio = new Audio(customVoiceUrl.trim());
            voiceAudio.volume = 1.0;
            voiceAudio.onended = () => {
              pendingCount--;
              if (pendingCount <= 0) finish();
            };
            voiceAudio.onerror = () => {
              pendingCount--;
              if (pendingCount <= 0) finish();
            };
            voiceAudio.play().catch(() => {
              pendingCount--;
              if (pendingCount <= 0) finish();
            });
          }, 150);
        }

        setTimeout(finish, 8000);
        return;
      }

      // 2. Voice-Only Tag (Clean Speech without background beat sound)
      const playBeat = localStorage.getItem('zed_setting_audio_tag_intro_beat');
      if (playBeat === 'true') {
        playActiveRockBeat();
      }

      const text =
        localStorage.getItem('zed_setting_audio_tag_intro_text') ||
        'Thank You For Streaming On Zed Vevo';

      const speedVal = localStorage.getItem('zed_setting_audio_tag_speed');
      const rate = speedVal ? parseFloat(speedVal) : 0.88;

      if (!('speechSynthesis' in window)) {
        setTimeout(resolve, 2400);
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.6, Math.min(1.2, rate));
      utterance.pitch = 1.12; // Realistic studio voice quality
      utterance.volume = 1.0;

      const voice = getInternationalRealisticVoice();
      if (voice) {
        utterance.voice = voice;
      }

      let finished = false;
      const onComplete = () => {
        if (!finished) {
          finished = true;
          // Short 200ms pause after voice tag finishes before main song starts
          setTimeout(resolve, 200);
        }
      };

      utterance.onend = onComplete;
      utterance.onerror = onComplete;

      // Speak directly ON TOP of the Rock Beat (starts 100ms into the beat)
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 100);

      // Safety timeout fallback
      setTimeout(onComplete, 5000);
    } catch (err) {
      console.warn('[AudioTagService] Error playing intro sequence:', err);
      resolve();
    }
  });
}

/**
 * Legacy wrapper for backward compatibility
 */
export function playZedVevoIntroTag() {
  playZedVevoIntroTagSequence();
}

/**
 * Plays the end-of-song promotional audio message:
 * "Are You An Artist or Content Creator? Download Zed Vevo App And Discover How To Earn Money"
 */
export function playZedVevoOutroTag() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    const isOutroEnabled = localStorage.getItem('zed_setting_audio_tag_outro_enabled');
    if (isOutroEnabled === 'false') return;

    const text =
      localStorage.getItem('zed_setting_audio_tag_outro_text') ||
      'Are You An Artist or Content Creator? Download Zed Vevo App And Discover How To Earn Money';

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.86;
    utterance.pitch = 1.12;
    utterance.volume = 0.95;

    const voice = getInternationalRealisticVoice();
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[AudioTagService] Outro voice tag error:', err);
  }
}
