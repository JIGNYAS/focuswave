// FocusWave - Binaural Beats Audio Engine
// Runs in an offscreen document for persistent audio playback

const PRESETS = {
  delta: { beatFreq: 2, label: 'Deep Relaxation' },
  theta: { beatFreq: 6, label: 'Meditation' },
  alpha: { beatFreq: 10, label: 'Calm Focus' },
  beta: { beatFreq: 14, label: 'Concentration' },
  gamma: { beatFreq: 40, label: 'Peak Performance' }
};

const FADE_DURATION = 0.5; // seconds
const TRANSITION_DURATION = 0.3; // seconds for preset switch

// Valid input ranges for audio parameters
const CARRIER_MIN = 20, CARRIER_MAX = 1500;
const BEAT_MIN = 0, BEAT_MAX = 100;
const VOLUME_MIN = 0, VOLUME_MAX = 1;

// Clamp value into [min, max]; reject NaN/Infinity by using fallback
function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

let ctx = null;
let oscLeft = null;
let oscRight = null;
let masterGain = null;
let merger = null;
let isPlaying = false;
let currentVolume = 0.3;
let currentCarrierFreq = 200;
let currentBeatFreq = 14;

function createAudioGraph(carrierFreq, beatFreq, volume) {
  try {
    ctx = new AudioContext();
    merger = ctx.createChannelMerger(2);
    masterGain = ctx.createGain();
    masterGain.gain.value = 0; // start silent for fade-in

    oscLeft = ctx.createOscillator();
    oscRight = ctx.createOscillator();
    oscLeft.type = 'sine';
    oscRight.type = 'sine';
    oscLeft.frequency.value = carrierFreq;
    oscRight.frequency.value = carrierFreq + beatFreq;

    oscLeft.connect(merger, 0, 0);
    oscRight.connect(merger, 0, 1);
    merger.connect(masterGain);
    masterGain.connect(ctx.destination);

    oscLeft.start();
    oscRight.start();

    currentCarrierFreq = carrierFreq;
    currentBeatFreq = beatFreq;
    currentVolume = volume;
    return true;
  } catch (e) {
    // Audio setup failed: tear down any partial graph and reset state so
    // a later play attempt can retry cleanly.
    console.error('FocusWave: failed to create audio graph', e);
    destroyAudioGraph();
    isPlaying = false;
    return false;
  }
}

function fadeIn(targetVolume, duration = FADE_DURATION) {
  if (!ctx || !masterGain) return;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(targetVolume, now + duration);
}

function fadeOut(duration = FADE_DURATION) {
  if (!ctx || !masterGain) return;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + duration);
}

function destroyAudioGraph() {
  if (oscLeft) { try { oscLeft.stop(); } catch (e) {} oscLeft = null; }
  if (oscRight) { try { oscRight.stop(); } catch (e) {} oscRight = null; }
  if (masterGain) { try { masterGain.disconnect(); } catch (e) {} masterGain = null; }
  if (merger) { try { merger.disconnect(); } catch (e) {} merger = null; }
  if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; }
}

function handlePlay({ carrierFreq, beatFreq, volume } = {}) {
  carrierFreq = clamp(carrierFreq, CARRIER_MIN, CARRIER_MAX, currentCarrierFreq);
  beatFreq = clamp(beatFreq, BEAT_MIN, BEAT_MAX, currentBeatFreq);
  volume = clamp(volume, VOLUME_MIN, VOLUME_MAX, currentVolume);

  if (isPlaying && ctx) {
    // Already playing: update params in place rather than rebuilding the
    // graph, avoiding an audible gap or leaked oscillator nodes. The preset
    // handler smoothly transitions both carrier and beat frequencies.
    handleSetPreset({ beatFreq, carrierFreq });
    handleSetVolume({ volume });
    return;
  }

  destroyAudioGraph();
  if (!createAudioGraph(carrierFreq, beatFreq, volume)) return;
  fadeIn(volume);
  isPlaying = true;
}

function handlePause() {
  if (!isPlaying || !ctx) return;
  fadeOut();
  setTimeout(() => {
    if (ctx) ctx.suspend();
    isPlaying = false;
  }, FADE_DURATION * 1000 + 50);
}

function handleSetVolume({ volume } = {}) {
  volume = clamp(volume, VOLUME_MIN, VOLUME_MAX, currentVolume);
  currentVolume = volume;
  if (!ctx || !masterGain) return;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(volume, now + 0.1);
}

function handleSetPreset({ beatFreq, carrierFreq } = {}) {
  beatFreq = clamp(beatFreq, BEAT_MIN, BEAT_MAX, currentBeatFreq);
  carrierFreq = clamp(carrierFreq, CARRIER_MIN, CARRIER_MAX, currentCarrierFreq);
  if (!ctx || !isPlaying) {
    currentBeatFreq = beatFreq;
    currentCarrierFreq = carrierFreq;
    return;
  }

  // Fade out, switch, fade in
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + TRANSITION_DURATION);

  setTimeout(() => {
    if (!oscLeft || !oscRight || !ctx) return;
    oscLeft.frequency.setValueAtTime(carrierFreq, ctx.currentTime);
    oscRight.frequency.setValueAtTime(carrierFreq + beatFreq, ctx.currentTime);
    currentBeatFreq = beatFreq;
    currentCarrierFreq = carrierFreq;

    const nowAfter = ctx.currentTime;
    masterGain.gain.setValueAtTime(0, nowAfter);
    masterGain.gain.linearRampToValueAtTime(currentVolume, nowAfter + TRANSITION_DURATION);
  }, TRANSITION_DURATION * 1000 + 30);
}

function handleSetCarrier({ carrierFreq } = {}) {
  carrierFreq = clamp(carrierFreq, CARRIER_MIN, CARRIER_MAX, currentCarrierFreq);
  currentCarrierFreq = carrierFreq;
  if (!ctx || !oscLeft || !oscRight) return;
  const now = ctx.currentTime;
  oscLeft.frequency.setValueAtTime(carrierFreq, now);
  oscRight.frequency.setValueAtTime(carrierFreq + currentBeatFreq, now);
}

function handleFadeStop({ fadeDuration = 5 }) {
  if (!ctx || !masterGain) return;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterGain.gain.value, now);
  masterGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

  setTimeout(() => {
    destroyAudioGraph();
    isPlaying = false;
    chrome.runtime.sendMessage({ type: 'AUDIO_FADE_COMPLETE' });
  }, fadeDuration * 1000 + 100);
}

function handlePlayChime() {
  if (!ctx) return;

  // Synthesize a gentle two-tone chime
  const chimeGain = ctx.createGain();
  chimeGain.connect(ctx.destination);

  const now = ctx.currentTime;

  // First tone: A5 (880 Hz)
  const chime1 = ctx.createOscillator();
  chime1.type = 'sine';
  chime1.frequency.value = 880;
  const gain1 = ctx.createGain();
  gain1.gain.setValueAtTime(0.25, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  chime1.connect(gain1);
  gain1.connect(ctx.destination);
  chime1.start(now);
  chime1.stop(now + 1.5);

  // Second tone: E6 (1320 Hz), slightly delayed
  const chime2 = ctx.createOscillator();
  chime2.type = 'sine';
  chime2.frequency.value = 1320;
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.setValueAtTime(0.15, now + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  chime2.connect(gain2);
  gain2.connect(ctx.destination);
  chime2.start(now);
  chime2.stop(now + 1.8);
}

// Message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'AUDIO_PLAY':
      handlePlay(msg.payload);
      sendResponse({ success: true });
      break;
    case 'AUDIO_PAUSE':
      handlePause();
      sendResponse({ success: true });
      break;
    case 'AUDIO_SET_VOLUME':
      handleSetVolume(msg.payload);
      sendResponse({ success: true });
      break;
    case 'AUDIO_SET_PRESET':
      handleSetPreset(msg.payload);
      sendResponse({ success: true });
      break;
    case 'AUDIO_SET_CARRIER':
      handleSetCarrier(msg.payload);
      sendResponse({ success: true });
      break;
    case 'AUDIO_FADE_STOP':
      handleFadeStop(msg.payload);
      sendResponse({ success: true });
      break;
    case 'AUDIO_PLAY_CHIME':
      handlePlayChime();
      sendResponse({ success: true });
      break;
    case 'AUDIO_PING':
      sendResponse({ type: 'AUDIO_PONG' });
      break;
  }
  return false;
});
