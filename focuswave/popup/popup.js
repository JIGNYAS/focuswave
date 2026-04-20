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
const proBadge        = document.getElementById('proBadge');
const upgradeLink     = document.getElementById('upgradeLink');
const upgradeModal    = document.getElementById('upgradeModal');
const modalClose      = document.getElementById('modalClose');
const licenseKeyInput = document.getElementById('licenseKeyInput');
const activateBtn     = document.getElementById('activateBtn');
const modalStatus     = document.getElementById('modalStatus');
const carrierProLabel = document.getElementById('carrierProLabel');

// --- State ---
let state = {
  preset: 'beta',
  beatFreq: 14,
  volume: 0.3,
  carrierFreq: 200,
  isPlaying: false,
  timerMinutes: 0,
  timerEndTime: null,
  isPro: false,
  licenseKey: null
};

let timerInterval = null;
let headphoneTimeout = null;
let hasShownHeadphones = false;

// --- Messaging ---
function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, payload });
}

// --- License Validation ---
// Key format: FWPRO-[DATA8]-[CHECK4]
// CHECK4 = ((sum_of_charCodes(DATA8) * 31) % 65536).toString(16).toUpperCase().padStart(4,'0')
function validateLicenseKey(raw) {
  const key = raw.trim().toUpperCase();
  const match = key.match(/^FWPRO-([A-Z0-9]{8})-([A-Z0-9]{4})$/);
  if (!match) return false;
  const sum = match[1].split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const expected = ((sum * 31) % 65536).toString(16).toUpperCase().padStart(4, '0');
  return match[2] === expected;
}

// --- Initialize ---
async function init() {
  const savedState = await sendMessage('GET_STATE');
  if (savedState) {
    state = { ...state, ...savedState };
  }
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
  renderTier();
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

const LOCKED_PRESETS = ['delta', 'theta', 'gamma'];
const LOCKED_MINUTES = [45, 60];

function renderTier() {
  const pro = state.isPro;
  proBadge.classList.toggle('hidden', !pro);
  upgradeLink.classList.toggle('hidden', pro);

  presetBtns.forEach(btn => {
    const locked = !pro && LOCKED_PRESETS.includes(btn.dataset.preset);
    btn.classList.toggle('locked', locked);
    const icon = btn.querySelector('.lock-icon');
    if (icon) icon.classList.toggle('hidden', !locked);
  });

  timerBtns.forEach(btn => {
    const locked = !pro && LOCKED_MINUTES.includes(parseInt(btn.dataset.minutes));
    btn.classList.toggle('locked', locked);
    const icon = btn.querySelector('.lock-icon');
    if (icon) icon.classList.toggle('hidden', !locked);
  });

  carrierSlider.disabled = !pro;
  carrierProLabel.classList.toggle('hidden', pro);
  if (!pro) {
    carrierSlider.value = 200;
    carrierValue.textContent = '200 Hz';
  }
}

// --- Event Handlers ---

// Preset buttons
presetBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const preset = btn.dataset.preset;
    if (!state.isPro && LOCKED_PRESETS.includes(preset)) { openUpgradeModal(); return; }
    if (preset === state.preset) return;

    state.preset = preset;
    const info = PRESET_LABELS[preset];
    state.beatFreq = parseFloat(info.hz);
    renderPresets();
    renderStateDisplay();
    await sendMessage('SET_PRESET', { preset });
  });
});

// Play/Pause
playBtn.addEventListener('click', async () => {
  if (state.isPlaying) {
    state.isPlaying = false;
    renderPlayState();
    await sendMessage('PAUSE');
    stopTimerDisplay();
  } else {
    state.isPlaying = true;
    renderPlayState();
    await sendMessage('PLAY');
    showHeadphoneNotice();
  }
});

// Volume slider
volumeSlider.addEventListener('input', () => {
  const vol = parseInt(volumeSlider.value);
  state.volume = vol / 100;
  volumeValue.textContent = vol + '%';
  sendMessage('SET_VOLUME', { volume: state.volume });
});

// Carrier frequency slider
carrierSlider.addEventListener('input', () => {
  if (!state.isPro) return;
  const freq = parseInt(carrierSlider.value);
  state.carrierFreq = freq;
  carrierValue.textContent = freq + ' Hz';
  sendMessage('SET_CARRIER', { carrierFreq: freq });
});

// Timer buttons
timerBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const minutes = parseInt(btn.dataset.minutes);
    if (!state.isPro && LOCKED_MINUTES.includes(minutes)) { openUpgradeModal(); return; }
    state.timerMinutes = minutes;

    if (minutes > 0) {
      state.timerEndTime = Date.now() + minutes * 60 * 1000;
      await sendMessage('SET_TIMER', { minutes });
      startTimerDisplay();
    } else {
      state.timerEndTime = null;
      await sendMessage('CLEAR_TIMER');
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

// --- Upgrade Modal ---
function openUpgradeModal() {
  upgradeModal.classList.remove('hidden');
  licenseKeyInput.value = '';
  licenseKeyInput.classList.remove('input-error', 'input-success');
  modalStatus.className = 'modal-status hidden';
  activateBtn.disabled = false;
  setTimeout(() => licenseKeyInput.focus(), 50);
}

function closeUpgradeModal() {
  upgradeModal.classList.add('hidden');
}

async function handleActivate() {
  if (!validateLicenseKey(licenseKeyInput.value)) {
    licenseKeyInput.classList.add('input-error');
    modalStatus.className = 'modal-status status-error';
    modalStatus.textContent = 'Invalid key. Format: FWPRO-XXXXXXXX-XXXX';
    return;
  }
  const key = licenseKeyInput.value.trim().toUpperCase();
  activateBtn.disabled = true;
  try {
    await sendMessage('ACTIVATE_LICENSE', { licenseKey: key, isPro: true });
  } catch (e) {
    activateBtn.disabled = false;
    modalStatus.className = 'modal-status status-error';
    modalStatus.textContent = 'Activation failed. Please try again.';
    return;
  }
  licenseKeyInput.classList.add('input-success');
  modalStatus.className = 'modal-status status-success';
  modalStatus.textContent = 'Pro unlocked! Enjoy all features.';
  state.isPro = true;
  state.licenseKey = key;
  renderTier();
  setTimeout(closeUpgradeModal, 1800);
}

upgradeLink.addEventListener('click', openUpgradeModal);
modalClose.addEventListener('click', closeUpgradeModal);
upgradeModal.addEventListener('click', e => { if (e.target === upgradeModal) closeUpgradeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !upgradeModal.classList.contains('hidden')) closeUpgradeModal();
});
activateBtn.addEventListener('click', handleActivate);
licenseKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleActivate(); });

licenseKeyInput.addEventListener('input', () => {
  const raw = licenseKeyInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const parts = [];
  if (raw.length > 0)  parts.push(raw.slice(0, 5));
  if (raw.length > 5)  parts.push(raw.slice(5, 13));
  if (raw.length > 13) parts.push(raw.slice(13, 17));
  licenseKeyInput.value = parts.join('-');
  licenseKeyInput.classList.remove('input-error', 'input-success');
  modalStatus.classList.add('hidden');
});

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

function startVisualizer() {
  if (animationId) return;
  drawWave(0);
}

function drawWave(timestamp) {
  const width = canvas.width;
  const height = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  // Handle DPR on first frame
  if (canvas.width === 320) {
    canvas.width = 320 * dpr;
    canvas.height = 56 * dpr;
    canvas.style.width = '320px';
    canvas.style.height = '56px';
    canvasCtx.scale(dpr, dpr);
  }

  const w = 320;
  const h = 56;

  canvasCtx.clearRect(0, 0, w, h);

  // Draw sine wave
  const amplitude = state.isPlaying ? (state.volume * h * 0.35 + 2) : 2;
  const waveFreq = 0.04;
  const speed = timestamp * 0.002;

  // Glow effect
  canvasCtx.shadowBlur = state.isPlaying ? 14 : 0;
  canvasCtx.shadowColor = '#f5b942';

  // Create gradient stroke
  const gradient = canvasCtx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, '#f5b942');
  gradient.addColorStop(0.5, '#a78bfa');
  gradient.addColorStop(1, '#f5b942');

  canvasCtx.beginPath();
  canvasCtx.strokeStyle = gradient;
  canvasCtx.lineWidth = state.isPlaying ? 2 : 1;

  for (let x = 0; x <= w; x++) {
    const y = h / 2 + Math.sin(x * waveFreq + speed) * amplitude;
    if (x === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }

  canvasCtx.stroke();

  // Second wave (subtle, offset)
  if (state.isPlaying) {
    canvasCtx.beginPath();
    canvasCtx.strokeStyle = 'rgba(167, 139, 250, 0.2)';
    canvasCtx.lineWidth = 1;
    canvasCtx.shadowBlur = 0;

    for (let x = 0; x <= w; x++) {
      const y = h / 2 + Math.sin(x * waveFreq * 1.3 + speed * 0.7) * amplitude * 0.5;
      if (x === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();
  }

  canvasCtx.shadowBlur = 0;
  animationId = requestAnimationFrame(drawWave);
}

// --- Init ---
init();
