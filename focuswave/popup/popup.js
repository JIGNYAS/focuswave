// FocusWave - Popup UI Logic

const PRESET_LABELS = {
  delta: { name: 'Delta', hz: '2 Hz', label: 'Deep Relaxation' },
  theta: { name: 'Theta', hz: '6 Hz', label: 'Meditation' },
  alpha: { name: 'Alpha', hz: '10 Hz', label: 'Calm Focus' },
  beta: { name: 'Beta', hz: '14 Hz', label: 'Concentration' },
  gamma: { name: 'Gamma', hz: '40 Hz', label: 'Peak Performance' }
};

// --- DOM Elements ---
const presetBtns = document.querySelectorAll('.preset-btn');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const carrierSlider = document.getElementById('carrierSlider');
const carrierValue = document.getElementById('carrierValue');
const timerBtns = document.querySelectorAll('.timer-btn');
const timerDisplay = document.getElementById('timerDisplay');
const timerCountdown = document.getElementById('timerCountdown');
const headphoneNotice = document.getElementById('headphoneNotice');
const statePreset = document.getElementById('statePreset');
const stateFreq = document.getElementById('stateFreq');
const stateLabel = document.getElementById('stateLabel');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
const paletteBtn      = document.getElementById('paletteBtn');
const themePanel      = document.getElementById('themePanel');
const swatchBtns      = document.querySelectorAll('.theme-swatch');

// --- State ---
let state = {
  preset: 'beta',
  beatFreq: 14,
  volume: 0.3,
  carrierFreq: 200,
  isPlaying: false,
  timerMinutes: 0,
  timerEndTime: null,
  theme: 'dark'
};

let timerInterval = null;
let headphoneTimeout = null;
let hasShownHeadphones = false;

// --- Messaging ---
function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, payload });
}

// --- Theme ---
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
  swatchBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
}

paletteBtn.addEventListener('click', e => {
  e.stopPropagation();
  const opening = themePanel.classList.contains('hidden');
  themePanel.classList.toggle('hidden', !opening);
  paletteBtn.classList.toggle('active', opening);
});

themePanel.addEventListener('click', e => e.stopPropagation());

document.addEventListener('click', () => {
  themePanel.classList.add('hidden');
  paletteBtn.classList.remove('active');
});

swatchBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    applyTheme(btn.dataset.theme);
    themePanel.classList.add('hidden');
    paletteBtn.classList.remove('active');
    await sendMessage('SAVE_THEME', { theme: btn.dataset.theme });
  });
});

// --- Initialize ---
async function init() {
  const savedState = await sendMessage('GET_STATE');
  if (savedState) {
    state = { ...state, ...savedState };
  }
  applyTheme(state.theme || 'dark');
  renderAll();
  startVisualizer();

  if (state.timerEndTime && state.timerEndTime > Date.now()) {
    startTimerDisplay();
  }
}

// --- Render ---
function renderAll() {
  renderPresets();
  renderPlayState();
  renderSliders();
  renderTimer();
  renderStateDisplay();
}

function renderPresets() {
  presetBtns.forEach(btn => {
    const preset = btn.dataset.preset;
    btn.classList.toggle('active', preset === state.preset);
  });
}

function renderPlayState() {
  if (state.isPlaying) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    playBtn.classList.add('playing');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    playBtn.classList.remove('playing');
  }
}

function renderSliders() {
  volumeSlider.value = Math.round(state.volume * 100);
  volumeValue.textContent = Math.round(state.volume * 100) + '%';
  carrierSlider.value = state.carrierFreq;
  carrierValue.textContent = state.carrierFreq + ' Hz';
}

function renderTimer() {
  timerBtns.forEach(btn => {
    const minutes = parseInt(btn.dataset.minutes);
    btn.classList.toggle('active', minutes === state.timerMinutes);
  });

  if (state.timerEndTime && state.timerEndTime > Date.now()) {
    timerDisplay.classList.remove('hidden');
  } else {
    timerDisplay.classList.add('hidden');
  }
}

function renderStateDisplay() {
  const info = PRESET_LABELS[state.preset];
  if (info) {
    statePreset.textContent = info.name;
    stateFreq.textContent = info.hz;
    stateLabel.textContent = info.label;
  }
}

// --- Event Handlers ---

// Preset buttons
presetBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const preset = btn.dataset.preset;
    if (preset === state.preset) return;

    const info = PRESET_LABELS[preset];
    if (!info) return;

    const prevPreset = state.preset;
    const prevBeatFreq = state.beatFreq;

    // "2 Hz" -> 2 ; parse the leading number explicitly
    state.preset = preset;
    state.beatFreq = parseFloat(info.hz.match(/[\d.]+/)?.[0] ?? info.hz);
    renderPresets();
    renderStateDisplay();
    try {
      await sendMessage('SET_PRESET', { preset });
    } catch (e) {
      state.preset = prevPreset;
      state.beatFreq = prevBeatFreq;
      renderPresets();
      renderStateDisplay();
    }
  });
});

// Play/Pause
playBtn.addEventListener('click', async () => {
  if (state.isPlaying) {
    state.isPlaying = false;
    renderPlayState();
    try {
      await sendMessage('PAUSE');
    } catch (e) {
      state.isPlaying = true;
      renderPlayState();
      return;
    }
    stopTimerDisplay();
  } else {
    state.isPlaying = true;
    renderPlayState();
    try {
      await sendMessage('PLAY');
    } catch (e) {
      state.isPlaying = false;
      renderPlayState();
      return;
    }
    showHeadphoneNotice();
  }
});

// Volume slider
volumeSlider.addEventListener('input', async () => {
  const prevVolume = state.volume;
  const vol = parseInt(volumeSlider.value);
  state.volume = vol / 100;
  volumeValue.textContent = vol + '%';
  try {
    await sendMessage('SET_VOLUME', { volume: state.volume });
  } catch (e) {
    state.volume = prevVolume;
    renderSliders();
  }
});

// Carrier frequency slider
carrierSlider.addEventListener('input', async () => {
  const prevCarrier = state.carrierFreq;
  const freq = parseInt(carrierSlider.value);
  state.carrierFreq = freq;
  carrierValue.textContent = freq + ' Hz';
  try {
    await sendMessage('SET_CARRIER', { carrierFreq: freq });
  } catch (e) {
    state.carrierFreq = prevCarrier;
    renderSliders();
  }
});

// Timer buttons
timerBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const minutes = parseInt(btn.dataset.minutes);

    const prevMinutes = state.timerMinutes;
    const prevEndTime = state.timerEndTime;
    state.timerMinutes = minutes;

    if (minutes > 0) {
      state.timerEndTime = Date.now() + minutes * 60 * 1000;
      try {
        await sendMessage('SET_TIMER', { minutes });
      } catch (e) {
        state.timerMinutes = prevMinutes;
        state.timerEndTime = prevEndTime;
        renderTimer();
        return;
      }
      startTimerDisplay();
    } else {
      state.timerEndTime = null;
      try {
        await sendMessage('CLEAR_TIMER');
      } catch (e) {
        state.timerMinutes = prevMinutes;
        state.timerEndTime = prevEndTime;
        renderTimer();
        return;
      }
      stopTimerDisplay();
    }

    renderTimer();
  });
});

// --- Headphone Notice ---
function showHeadphoneNotice() {
  if (hasShownHeadphones) return;
  hasShownHeadphones = true;

  headphoneNotice.classList.remove('hidden');
  headphoneNotice.classList.remove('fade-out');

  clearTimeout(headphoneTimeout);
  headphoneTimeout = setTimeout(() => {
    headphoneNotice.classList.add('fade-out');
    setTimeout(() => {
      headphoneNotice.classList.add('hidden');
    }, 1000);
  }, 3000);
}

// --- Timer Display ---
function startTimerDisplay() {
  timerDisplay.classList.remove('hidden');
  updateTimerCountdown();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimerCountdown, 1000);
}

function stopTimerDisplay() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerDisplay.classList.add('hidden');
  state.timerMinutes = 0;
  state.timerEndTime = null;
  renderTimer();
}

function updateTimerCountdown() {
  if (!state.timerEndTime) {
    stopTimerDisplay();
    return;
  }

  const remaining = Math.max(0, state.timerEndTime - Date.now());
  if (remaining <= 0) {
    stopTimerDisplay();
    // Refresh state from background
    sendMessage('GET_STATE').then(s => {
      if (s) {
        state = { ...state, ...s };
        renderAll();
      }
    });
    return;
  }

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  timerCountdown.textContent =
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

// --- Sine Wave Visualizer ---
let animationId = null;
let canvasInitialized = false;

function startVisualizer() {
  if (animationId) return;
  drawWave(0);
}

function drawWave(timestamp) {
  const dpr = window.devicePixelRatio || 1;

  // Handle DPR setup exactly once
  if (!canvasInitialized) {
    canvas.width = 320 * dpr;
    canvas.height = 56 * dpr;
    canvas.style.width = '320px';
    canvas.style.height = '56px';
    canvasCtx.scale(dpr, dpr);
    canvasInitialized = true;
  }

  const w = 320;
  const h = 56;

  canvasCtx.clearRect(0, 0, w, h);

  // Resolve wave color from the active theme's CSS variables
  const cs = getComputedStyle(document.documentElement);
  const accent = (cs.getPropertyValue('--accent').trim() || '#ffc24d');
  const accentRgb = (cs.getPropertyValue('--accent-rgb').trim() || '255,194,77');

  // Respect reduced motion
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Motion params: idle = near-flat barely-moving; playing = breathing wave
  const speed = reduce ? 0 : timestamp * 0.0022;
  const waveFreq = 0.045;
  const amplitude = state.isPlaying ? (state.volume * h * 0.34 + 2) : 1.5;

  // Faint baseline (always)
  canvasCtx.shadowBlur = 0;
  canvasCtx.beginPath();
  canvasCtx.strokeStyle = 'rgba(' + accentRgb + ',0.10)';
  canvasCtx.lineWidth = 1;
  canvasCtx.moveTo(0, h / 2);
  canvasCtx.lineTo(w, h / 2);
  canvasCtx.stroke();

  // Primary line: gradient that fades at both edges
  const g = canvasCtx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(' + accentRgb + ',0.35)');
  g.addColorStop(0.5, accent);
  g.addColorStop(1, 'rgba(' + accentRgb + ',0.35)');

  canvasCtx.beginPath();
  canvasCtx.strokeStyle = g;
  canvasCtx.lineWidth = state.isPlaying ? 2 : 1.25;
  canvasCtx.lineCap = 'round';
  canvasCtx.lineJoin = 'round';
  if (state.isPlaying) {
    canvasCtx.shadowBlur = 10;
    canvasCtx.shadowColor = 'rgba(' + accentRgb + ',0.55)';
  } else {
    canvasCtx.shadowBlur = 0;
  }

  for (let x = 0; x <= w; x++) {
    const y = h / 2 + Math.sin(x * waveFreq + speed) * amplitude;
    if (x === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.stroke();

  // Secondary line (only when playing): halved amplitude, slower drift
  if (state.isPlaying) {
    canvasCtx.shadowBlur = 0;
    canvasCtx.beginPath();
    canvasCtx.strokeStyle = 'rgba(' + accentRgb + ',0.18)';
    canvasCtx.lineWidth = 1;

    for (let x = 0; x <= w; x++) {
      const y = h / 2 + Math.sin(x * waveFreq * 1.4 + speed * 0.65) * amplitude * 0.5;
      if (x === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();
  }

  canvasCtx.shadowBlur = 0;
  animationId = requestAnimationFrame(drawWave);
}

// --- Sync with storage changes (e.g. timer completes while popup open) ---
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  const relevant = ['isPlaying', 'timerEndTime', 'timerMinutes'];
  let playChanged = false;
  let timerChanged = false;

  relevant.forEach(key => {
    if (!(key in changes)) return;
    const newValue = changes[key].newValue;
    if (state[key] === newValue) return; // only react to actual changes
    state[key] = newValue;
    if (key === 'isPlaying') playChanged = true;
    if (key === 'timerEndTime' || key === 'timerMinutes') timerChanged = true;
  });

  if (playChanged) renderPlayState();
  if (timerChanged) {
    if (state.timerEndTime && state.timerEndTime > Date.now()) {
      startTimerDisplay();
    } else {
      stopTimerDisplay();
    }
    renderTimer();
  }
});

// --- Init ---
init();
