// FocusWave - Service Worker (State Coordinator)

const PRESETS = {
  delta: { beatFreq: 2, label: 'Deep Relaxation' },
  theta: { beatFreq: 6, label: 'Meditation' },
  alpha: { beatFreq: 10, label: 'Calm Focus' },
  beta: { beatFreq: 14, label: 'Concentration' },
  gamma: { beatFreq: 40, label: 'Peak Performance' }
};

const DEFAULT_STATE = {
  preset: 'beta',
  beatFreq: 14,
  volume: 0.3,
  carrierFreq: 200,
  isPlaying: false,
  timerMinutes: 0,
  timerEndTime: null,
  licenseKey: null,
  isPro: false
};

const TIMER_ALARM_NAME = 'focuswave-timer';

// --- Offscreen Document Lifecycle ---

let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
  });

  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing binaural beat audio via Web Audio API'
  });

  await creatingOffscreen;
  creatingOffscreen = null;
}

async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (e) {
    // Offscreen doc may have been killed, recreate and retry
    creatingOffscreen = null;
    await ensureOffscreenDocument();
    return await chrome.runtime.sendMessage(message);
  }
}

// --- State Management ---

async function getState() {
  const state = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  return { ...DEFAULT_STATE, ...state };
}

async function setState(updates) {
  await chrome.storage.local.set(updates);
}

// --- Badge Management ---

function setBadgePlaying() {
  chrome.action.setBadgeText({ text: ' ' });
  chrome.action.setBadgeBackgroundColor({ color: '#34d399' });
}

function setBadgeIdle() {
  chrome.action.setBadgeText({ text: '' });
}

// --- Timer ---

async function setTimer(minutes) {
  const endTime = Date.now() + minutes * 60 * 1000;
  await setState({ timerMinutes: minutes, timerEndTime: endTime });
  await chrome.alarms.create(TIMER_ALARM_NAME, { delayInMinutes: minutes });
}

async function clearTimer() {
  await chrome.alarms.clear(TIMER_ALARM_NAME);
  await setState({ timerMinutes: 0, timerEndTime: null });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== TIMER_ALARM_NAME) return;

  const state = await getState();
  if (!state.isPlaying) {
    await clearTimer();
    return;
  }

  // Play chime
  await sendToOffscreen({ type: 'AUDIO_PLAY_CHIME' });

  // Wait for chime (~1.5s), then fade out over 5 seconds
  setTimeout(async () => {
    await sendToOffscreen({ type: 'AUDIO_FADE_STOP', payload: { fadeDuration: 5 } });

    // After fade completes, update state
    setTimeout(async () => {
      await setState({ isPlaying: false, timerMinutes: 0, timerEndTime: null });
      setBadgeIdle();
    }, 5200);
  }, 1500);
});

// --- Message Handling (from Popup) ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Ignore messages from offscreen document
  if (msg.type === 'AUDIO_PONG' || msg.type === 'AUDIO_FADE_COMPLETE') return;

  handlePopupMessage(msg).then(sendResponse);
  return true; // async response
});

async function handlePopupMessage(msg) {
  const state = await getState();

  switch (msg.type) {
    case 'GET_STATE': {
      return state;
    }

    case 'PLAY': {
      await ensureOffscreenDocument();
      await sendToOffscreen({
        type: 'AUDIO_PLAY',
        payload: {
          carrierFreq: state.carrierFreq,
          beatFreq: state.beatFreq,
          volume: state.volume
        }
      });
      await setState({ isPlaying: true });
      setBadgePlaying();
      return { success: true };
    }

    case 'PAUSE': {
      await sendToOffscreen({ type: 'AUDIO_PAUSE' });
      await setState({ isPlaying: false });
      setBadgeIdle();
      // Clear timer if active
      if (state.timerEndTime) {
        await clearTimer();
      }
      return { success: true };
    }

    case 'SET_PRESET': {
      const preset = msg.payload.preset;
      const presetData = PRESETS[preset];
      if (!presetData) return { success: false, error: 'Invalid preset' };

      const updates = {
        preset,
        beatFreq: presetData.beatFreq
      };

      if (state.isPlaying) {
        await sendToOffscreen({
          type: 'AUDIO_SET_PRESET',
          payload: {
            beatFreq: presetData.beatFreq,
            carrierFreq: state.carrierFreq
          }
        });
      }

      await setState(updates);
      return { success: true };
    }

    case 'SET_VOLUME': {
      const volume = msg.payload.volume;
      if (state.isPlaying) {
        await sendToOffscreen({
          type: 'AUDIO_SET_VOLUME',
          payload: { volume }
        });
      }
      await setState({ volume });
      return { success: true };
    }

    case 'SET_CARRIER': {
      const carrierFreq = msg.payload.carrierFreq;
      if (state.isPlaying) {
        await sendToOffscreen({
          type: 'AUDIO_SET_CARRIER',
          payload: { carrierFreq }
        });
      }
      await setState({ carrierFreq });
      return { success: true };
    }

    case 'SET_TIMER': {
      const minutes = msg.payload.minutes;
      if (minutes > 0) {
        await setTimer(minutes);
      } else {
        await clearTimer();
      }
      return { success: true };
    }

    case 'CLEAR_TIMER': {
      await clearTimer();
      return { success: true };
    }

    case 'ACTIVATE_LICENSE': {
      const { licenseKey, isPro } = msg.payload;
      await setState({ licenseKey, isPro });
      return { success: true };
    }

    case 'DEACTIVATE_LICENSE': {
      await setState({ licenseKey: null, isPro: false });
      return { success: true };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// --- Auto-Resume on Chrome Startup ---

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();

  // Check if timer expired while Chrome was closed
  if (state.timerEndTime && state.timerEndTime <= Date.now()) {
    await setState({ isPlaying: false, timerMinutes: 0, timerEndTime: null });
    return;
  }

  if (state.isPlaying) {
    await ensureOffscreenDocument();
    await sendToOffscreen({
      type: 'AUDIO_PLAY',
      payload: {
        carrierFreq: state.carrierFreq,
        beatFreq: state.beatFreq,
        volume: state.volume
      }
    });
    setBadgePlaying();

    // Recreate timer alarm if it was active
    if (state.timerEndTime) {
      const remainingMs = state.timerEndTime - Date.now();
      if (remainingMs > 0) {
        await chrome.alarms.create(TIMER_ALARM_NAME, {
          delayInMinutes: remainingMs / 60000
        });
      }
    }
  }
});

// --- Welcome Page on Install ---

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'welcome/welcome.html' });
    // Initialize default state
    setState(DEFAULT_STATE);
  }
});
