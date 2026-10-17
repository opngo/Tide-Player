


<p align="center">
  <img src="build-resources/icon.png" alt="Alt Text" width="20%">

</p>

![GitHub release](https://shields.io)

---

# Tide — Minimalist Audiobook Player


A zero-outline, ambient-glass audiobook player inspired by **Spicetify**, **Winamp**, **Plexamp**, **ChatGPT Voice Mode**, and **[React Bits](https://reactbits.dev/)**. Built with React, TypeScript, Tailwind CSS v4, WebGL GLSL Shaders, HTML5 `<audio>` + Howler.js + Web Audio API 10-band DSP, an **Electron Desktop UI** with an embedded local HTTP/API server (`electron/main.cjs`), and a Node/Vite backend for `~/.tide/all.json` indexing, `.m4b` `chpl` chapter extraction, **Audnexus** ASIN chapter sync, live **Goodreads / Apple Books / OpenLibrary / Google Books** cover search, **AudioBookBay** discovery, and **qBittorrent** sequential streaming.

---

## Key Features

- **Electron Desktop UI & Frameless Window Chrome (`electron/main.cjs` + `ElectronTitleBar.tsx`)**:
  - Custom frameless title bar (`-webkit-app-region: drag`) with Always-on-Top pin, compact Mini-Player window resize (`420×128`), native OS directory picker (`dialog.showOpenDialog`), global hardware media keys (`MediaPlayPause`, `MediaNextTrack`, `MediaPreviousTrack`), system tray menu, and an embedded local `/api/*` server (`dist-server/apiPlugin.mjs`).
- **Automated Multi-Platform Packaging & GitHub Releases (`.github/workflows/`)**:
  - **`electron-release.yml`**: Builds **Windows NSIS Installer (`Tide-Setup-*-x64.exe`)** + portable `.zip`, **macOS Universal (`.dmg` & `.zip` for `x64` + `arm64`)**, and **Linux (`.AppImage`, `.deb`, `.tar.gz`)** packages, generates `SHA256SUMS.txt`, and publishes a GitHub Release automatically.
  - **`ci-inspect.yml`**: Cross-platform (`ubuntu-latest`, `windows-latest`, `macos-latest`) TypeScript verification, bundle size inspection, standalone API & HTTP 206 byte-range audio streaming smoke tests (`npm run test:ci`).
  - **`pages.yml`**: Deploys the static minimalist showcase website (`docs/index.html`) to GitHub Pages.
  - **`docker-publish.yml`**: Builds the Docker image, verifies live HTTP 200 container health, and publishes to `ghcr.io`.
  - **`codeql-security.yml`**: Runs CodeQL static analysis, Electron context-isolation hardening checks, and production dependency audits.
- **Minimalist Static GitHub Showcase Website (`docs/index.html` & `/showcase/index.html`)**:
  - Zero-outline, interactive single-file showcase matching Tide's dark atmospheric aesthetic, featuring a live interactive chapter-divided seekbar, circular Cover Radial FFT preview, Screen Curtain toggle, Slick Mode (`L`) ticker, and direct OS installer cards.
- **Minimal Slick Billboard Mode (`L` Key)**:
  - Press **`L`** on the keyboard at any time to toggle **Minimal Slick Mode**: smooth cubic-bezier scale/fade transition hiding the sidebar, transport controls, and text labels—leaving **only** the **3D Cursor-Reactive Cover Art** and **Seekbar** over a **slow, bold, translucent billboard marquee** of the book title.
- **10 Seekbar Styles + Exact Chapter Capsule Playhead Alignment**:
  - Includes `segmented` (Divided Chapters), `simple-chapter` (Simple Split, no gradients), `simple` (Flat Bar), `chaptered`, `wave`, `line`, `pill`, `dots`, `glow`, and `brutalist`, plus a **Seekbar Screen Width (`45%–100%`)** slider and a **Full-Screen Translucent Dark Progress Curtain** in Settings.
  - Playhead dot is anchored directly inside the active chapter capsule (`left: ${segFill * 100}%`) so it aligns with the exact leading edge of the orange progress fill across all chapter-divided styles.
- **Real-Time Speech-Reactive Visualizers (`AudioVisualizer.tsx`)**:
  - 60fps Web Audio FFT analysis focused on human vocal frequencies (`85 Hz – 3500 Hz`), including the **Cover Radial (`cover-outline`)** visualizer rendered underneath the cover (`z-0` below `z-10`) with automatic circle cover lock **only** when `cover-outline` is active.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`L`** | Toggle **Minimal Slick Billboard Mode** (only Cover + Seekbar + slow translucent moving Title) |
| **`Space` / `K`** | Play / Pause audiobook |
| **`J` / `←`** | Rewind 15 seconds |
| **`→`** | Skip forward 30 seconds |
| **`N` / `P`** | Next / Previous chapter |
| **`[ ` / ` ]`** | Decrease / Increase playback speed (`0.5×` – `3.0×`) |
| **`B`** | Drop timestamped bookmark at current position |
| **`Z`** | Cycle sleep timer (`Off` -> `15m` -> `30m` -> `60m`) |
| **`F`** | Toggle Immersive Zen Mode |
| **`?`** | Open Keyboard Shortcuts overlay |
| **`Esc`** | Exit Slick Mode / Zen Mode / close active modal |

---

## Quick Start & CI Verification

### Run Locally (Web + API Backend)
```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

### Build Everything & Run Full CI Smoke Suite
```bash
npm run build:all
npm run test:ci
```

### Package Electron Desktop Installers
```bash
# Windows NSIS Installer (.exe) + Portable (.zip)
npm run electron:pack:win

# macOS (.dmg + .zip for x64 & Apple Silicon arm64)
npm run electron:pack:mac

# Linux (.AppImage + .deb + .tar.gz)
npm run electron:pack:linux
```
