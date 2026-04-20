# FocusWave - Binaural Beats Generator Chrome Extension PRD

## Overview

FocusWave is a Chrome extension that generates binaural beats tuned to brainwave frequencies that aid concentration, focus, relaxation, meditation, and sleep. The extension uses the Web Audio API to produce two slightly different frequencies in each ear, creating a perceived third tone that entrains the brain to a target frequency. It will be published on the Chrome Web Store for a broad audience.

## Problem Statement

Users seeking to improve focus and concentration while working in the browser currently need to rely on external apps or streaming services. A lightweight Chrome extension can deliver scientifically-grounded binaural beats directly in the browser with zero friction.

## Target Brainwave Frequencies

| State | Frequency Range | Beat Frequency | Use Case |
|-------|----------------|----------------|----------|
| Delta | 0.5 - 4 Hz | 2 Hz | Deep sleep, relaxation |
| Theta | 4 - 8 Hz | 6 Hz | Meditation, creativity |
| Alpha | 8 - 13 Hz | 10 Hz | Calm focus, light relaxation |
| Beta | 13 - 30 Hz | 14 Hz | Active concentration, problem-solving |
| Gamma | 30 - 50 Hz | 40 Hz | Peak focus, cognitive processing |

**Default mode: Beta (14 Hz)** - optimized for concentration. All presets are equally valued — users will use relaxation/sleep modes just as much as focus modes.

## How Binaural Beats Work

- A base carrier frequency (e.g., 200 Hz) is played in the left ear
- A slightly offset frequency (e.g., 214 Hz) is played in the right ear
- The brain perceives the difference (14 Hz) and entrains to that frequency
- Stereo headphones are required for the effect

## Features

### MVP (v1.0)

1. **Popup UI (350px wide)**
   - Play/pause toggle button
   - Preset selector for brainwave states (Delta, Theta, Alpha, Beta, Gamma)
   - Volume slider (default: 30% — safe, non-startling default)
   - Carrier frequency slider (150-300 Hz range, live Hz label while dragging)
   - Visual indicator showing current state and frequency
   - Sine wave visualizer animation when playing
   - Session timer with preset durations (15 / 25 / 45 / 60 minutes)
   - Headphone reminder shown when audio starts playing (fades after a few seconds)

2. **Audio Engine**
   - Web Audio API-based tone generation (two oscillators, one per stereo channel)
   - Configurable base carrier frequency (150-300 Hz, default: 200 Hz)
   - Smooth fade-in/fade-out to avoid audio clicks
   - Runs via an offscreen document so audio persists across tab switches
   - Auto-recreate offscreen document if Chrome kills it, resume playback silently
   - Preset transitions: fade out current beat, then fade in new beat (clean break)

3. **Timer**
   - Preset durations: 15, 25, 45, 60 minutes
   - When timer ends: play a gentle chime, then fade audio out over ~5 seconds, then stop
   - Optional — user can play indefinitely without a timer

4. **Session Persistence**
   - Remember last-used preset, carrier frequency, volume, and timer setting across popup open/close
   - Audio continues playing when popup is closed
   - Auto-resume playback when Chrome reopens if it was playing when Chrome closed

5. **Toolbar Badge**
   - Show a colored badge dot on the extension icon when audio is actively playing

6. **Welcome Page**
   - Opens in a new tab on first install
   - Quick-start guide: 3 steps — put on headphones, pick a preset, hit play
   - Minimal and fast, no lengthy explainers

### Future (v2.0+)

- Background noise layering (rain, white noise, brown noise)
- Usage statistics / session history
- Keyboard shortcut to toggle play/pause (Chrome commands API)
- Monetization (premium tier — TBD)
- Optional anonymous analytics (opt-in)
- Pomodoro integration
- Custom beat frequency input (beyond presets)

## Technical Architecture

### Tech Stack

- **Vanilla HTML, CSS, and JavaScript** — no frameworks, no build step
- Simplest to develop, debug, and package for the Web Store
- CSS custom properties for theming
- No external dependencies

### Chrome Extension Structure

```
focuswave/
  manifest.json          # Manifest V3 configuration
  popup/
    popup.html           # Extension popup UI
    popup.css            # Glassmorphism styles, animations
    popup.js             # Popup logic, communicates with background
  background/
    service-worker.js    # Background service worker, manages state
  offscreen/
    offscreen.html       # Offscreen document for audio playback
    offscreen.js         # Web Audio API engine
  welcome/
    welcome.html         # First-install welcome/quick-start page
    welcome.css          # Welcome page styles
    welcome.js           # Welcome page logic (if needed)
  icons/
    icon-16.png
    icon-48.png
    icon-128.png
  assets/
    chime.mp3            # Gentle chime sound for timer end
```

### Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Manifest version | V3 | Required for new Chrome extensions |
| Audio playback | Offscreen document | Service workers can't use Web Audio API; offscreen docs persist audio |
| State management | chrome.storage.local | Persists user preferences across sessions |
| Communication | chrome.runtime.sendMessage | Message passing between popup, service worker, and offscreen doc |
| Tech stack | Vanilla HTML/CSS/JS | No build step, no framework overhead, simple packaging |
| Offscreen recovery | Auto-recreate + resume | Silently recover if Chrome kills the offscreen document |
| Styling | CSS custom properties + glassmorphism | Frosted glass UI with backdrop-filter blur |

### Audio Engine Design

```
Popup (UI) 
  --> sendMessage --> Service Worker (state coordinator)
    --> sendMessage --> Offscreen Document (audio engine)
      --> Web Audio API
        --> OscillatorNode (left channel, carrier freq)
        --> OscillatorNode (right channel, carrier freq + beat freq)
        --> GainNode (volume + fade-in/fade-out)
        --> ChannelMergerNode (stereo output)
        --> AudioContext.destination
```

### Message Protocol

```json
{ "action": "play", "preset": "beta", "volume": 0.3, "carrierFreq": 200 }
{ "action": "pause" }
{ "action": "setVolume", "volume": 0.7 }
{ "action": "setPreset", "preset": "alpha" }
{ "action": "setCarrierFreq", "carrierFreq": 250 }
{ "action": "getState" }
```

## UI Design

### Visual Style: Glassmorphism + Cool Blues/Purples

- **Background**: Deep navy/dark gradient (#0a0a1a to #1a1030)
- **Cards**: Frosted glass panels using `backdrop-filter: blur(20px)` with semi-transparent white borders
- **Accent colors**: Cool blues (#4a9eff) and purples (#8b5cf6)
- **Active elements**: Soft glow/box-shadow in accent color
- **Typography**: System font stack, clean and readable
- **Interactions**: Smooth CSS transitions on all hover/active states

### Popup Layout (350px wide)

```
+--------------------------------------+
|  FOCUSWAVE                    [badge]|
|  ~~~~~~~~~~~~~~~~~~~~                |
|                                      |
|  ┌──────────────────────────────┐    |
|  │ [ Delta ] [ Theta ] [ Alpha]│    |
|  │ [ Beta  ] [ Gamma ]         │    |
|  └──────────────────────────────┘    |
|                                      |
|  Selected: Beta - 14 Hz             |
|  "Active Concentration"              |
|                                      |
|  ╭─╮     ╭─╮     ╭─╮     ╭─╮       |
|  │  │    │  │    │  │    │  │       |
|  ╯  ╰────╯  ╰────╯  ╰────╯  ╰──   |
|  (sine wave visualizer)             |
|                                      |
|         [  ▶  PLAY  ]               |
|                                      |
|  Volume:  ━━━●━━━━━━━━━━━  30%     |
|  Carrier: ━━━━━━●━━━━━━━━  200 Hz  |
|                                      |
|  Timer: [15] [25] [45] [60] [OFF]   |
|                                      |
|  🎧 Headphones recommended          |
+--------------------------------------+
```

### Visualizer

- Smooth **sine wave line** animation using CSS or canvas
- Amplitude tied to volume level
- Animates when playing, flatlines when paused
- Rendered within the popup between the preset info and play button

### Animations & Micro-interactions

- Glassmorphism frosted cards with `backdrop-filter: blur()`
- Soft glow pulse on the active preset button
- Play button morphs between play/pause icons with smooth transition
- Sine wave visualizer animates continuously while playing
- Volume and carrier sliders show live value labels
- Headphone reminder fades in when playing starts, fades out after ~3 seconds
- Preset switch: active button gets glow, previous one loses it with transition

## Implementation Plan

### Phase 1: Project Setup
- Initialize project structure and manifest.json (Manifest V3)
- Create placeholder icons (16, 48, 128px)
- Set up basic popup HTML skeleton

### Phase 2: Audio Engine
- Implement Web Audio API binaural beat generator in offscreen document
- Two oscillators with stereo panning via ChannelMergerNode
- Implement fade-in/fade-out (GainNode ramping)
- Implement preset switching with fade-out-then-fade-in transition
- Configurable carrier frequency (150-300 Hz)
- Add offscreen document auto-recovery on termination

### Phase 3: Extension Wiring
- Service worker for state coordination and message routing
- Message passing between popup, service worker, and offscreen doc
- chrome.storage.local for preference persistence (preset, volume, carrier freq, timer)
- Auto-resume logic on Chrome startup
- Toolbar badge management (colored dot when playing)

### Phase 4: Popup UI
- Build glassmorphism-themed popup with CSS custom properties
- Preset selector buttons with glow states
- Play/pause button with icon morph
- Volume slider with live % label (default 30%)
- Carrier frequency slider with live Hz label (150-300 Hz)
- Timer preset buttons (15/25/45/60/OFF)
- Sine wave visualizer (CSS or canvas)
- Headphone reminder with fade-in/fade-out

### Phase 5: Timer & Chime
- Implement countdown timer logic in service worker
- Timer display in popup (remaining time)
- Gentle chime audio on timer end
- Fade-out audio over ~5 seconds after chime

### Phase 6: Welcome Page & Polish
- Welcome page with 3-step quick-start guide
- Opens on `runtime.onInstalled` event
- Error handling (no audio context, offscreen doc failures)
- Smooth transitions and animation polish
- Cross-browser edge case testing

### Phase 7: Store Preparation
- Final icon design (16, 48, 128px)
- Store listing screenshots and description
- Privacy policy (no data collection in MVP)
- Package and submit to Chrome Web Store

## Permissions Required

```json
{
  "permissions": ["storage", "offscreen"]
}
```

No host permissions needed — the extension is fully self-contained.

## Success Criteria

- Audio plays correctly with stereo separation (verified with headphones)
- Beats persist when popup is closed or tabs are switched
- Smooth transitions with no audio clicks or pops
- Popup loads and responds in under 100ms
- Extension package size under 500KB
- Offscreen document auto-recovers if killed by Chrome
- Timer chime plays and audio fades out gracefully
- Glassmorphism UI renders correctly across Chrome versions
- Welcome page opens on first install
- Toolbar badge reflects playing state accurately
