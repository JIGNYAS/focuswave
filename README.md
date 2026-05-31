# FocusWave — Binaural Beats

A lightweight Chrome extension (Manifest V3) that generates binaural beats for focus, meditation, relaxation, and sleep — right in your browser, no account, no backend.

## How It Works

FocusWave plays two slightly different tones, one in each ear, using the Web Audio API. The brain perceives the difference between them as a third "beat" frequency and gently entrains to it. Stereo headphones are required for the effect.

## Features

### Binaural Beat Presets

Five brainwave presets, each tuned to a target beat frequency and use case:

| Preset | Beat | Use Case |
|--------|------|----------|
| **Delta** | 2 Hz | Deep sleep and relaxation |
| **Theta** | 6 Hz | Meditation and creativity |
| **Alpha** | 10 Hz | Calm focus and light relaxation |
| **Beta** | 14 Hz | Active concentration and problem-solving |
| **Gamma** | 40 Hz | Peak focus and cognitive processing |

### Controls

- **Volume control** — adjustable level (defaults to a safe 30%).
- **Carrier frequency control** — tune the base carrier tone from 150–300 Hz.
- **Focus timers** — preset session durations (15 / 25 / 45 / 60 minutes, or off) with a gentle chime and smooth fade-out when time is up.
- **Animated visualizer** — a live sine-wave canvas animation that responds while audio plays.

### Themes

Six color themes: **Dark**, **Light**, **Midnight**, **Forest**, **Sunset**, and **Ocean**.

### Everything is free

Every feature is unlocked for everyone — all five presets, all timer durations, full carrier-frequency control, and all themes. No accounts, no purchases, no license keys.

## Install (Development)

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked** and select the `focuswave/` folder

## Project Structure

```
focuswave/
  manifest.json          # Manifest V3 configuration
  background/            # Service worker — state coordination & timers
  popup/                 # Popup UI (HTML/CSS/JS)
  offscreen/             # Offscreen document — Web Audio engine
  welcome/               # First-install onboarding page
  fonts/                 # Bundled web fonts
  icons/                 # Extension icons (16 / 48 / 128 px)
```

Audio runs in an offscreen document (service workers can't use the Web Audio API), which keeps playback alive when the popup is closed or you switch tabs. The popup, service worker, and offscreen document communicate via `chrome.runtime` message passing, and preferences persist via `chrome.storage.local`.

## Tech

- **Manifest V3**
- **Vanilla JavaScript, HTML, and CSS** — no framework
- **Web Audio API** for tone generation
- **No build step, no dependencies** — load it as-is

## Privacy

FocusWave collects no personal data and has no backend. All settings are stored locally on your device and never transmitted anywhere. See [PRIVACY.md](PRIVACY.md) for full details.
