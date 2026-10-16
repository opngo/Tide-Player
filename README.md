# Tide — Minimalist Audiobook Player

A zero-outline, ambient-glass audiobook player inspired by **Spicetify**, **Winamp**, **Plexamp**, **ChatGPT Voice Mode**, and **[React Bits](https://reactbits.dev/)**. Built with React 19, TypeScript, Tailwind CSS v4, WebGL GLSL Shaders, HTML5 `<audio>` + Howler.js + Web Audio API 10-band DSP, and a built-in Node/Vite backend for `~/.tide/all.json` indexing, live **Goodreads / Apple Books / OpenLibrary / Google Books** cover search, **AudioBookBay** discovery, and **qBittorrent** sequential streaming.

---

## Key Features

- **Minimal Slick Billboard Mode (`L` Key)**:
  - Press **`L`** on the keyboard at any time to toggle **Minimal Slick Mode**: hides the sidebar, transport controls, top-right menu, and text labels—leaving **only** the **3D Cursor-Reactive Cover Art** and **Seekbar** over a **huge, bold, ultra-translucent billboard marquee** of the book title drifting continuously across the background.
- **Live Book Cover & Metadata Search (Goodreads + 3 Free APIs)**:
  - Search and apply high-resolution cover art, authors, narrators, genres, star ratings, and descriptions directly from **Goodreads**, **Apple Books / iTunes Audiobooks**, **OpenLibrary**, and **Google Books** (`GET /api/metadata/search`).
  - Automatically extracts a 6-stop color palette (`dominant`, `vibrant`, `muted`, `dark`, `light`, `accent`) from any applied cover and saves it to `~/.tide/all.json`.
- **High-Contrast Waveform Seekbar & Chapter Divider Seekbar**:
  - Real MPEG frame `global_gain` dynamic-range extraction with 8th–92nd percentile normalization and `Math.pow(norm, 2.2)` contrast expansion so quiet pauses stay low (`8%–18%`) and emphatic speech peaks stand out (`75%–100%`).
  - Switchable in one click to a **Normal Seekbar with Chapter Dividers** (`chaptered`) supporting both single-file `.m4b` and multi-file `.mp4`/`.mp3` audiobooks.
- **Full WebGL GLSL Shaders + Brightness / Contrast / Saturation Grading**:
  - Hardware-accelerated WebGL shaders for **CRT Warp**, **Balatro**, **Iridescence**, **Aurora**, **Silk**, **Dither (Bayer 4×4)**, **Mesh**, **Ripple**, and **Particles**, plus **Blurred Cover** and **Solid**.
  - Customize **Shader Brightness (`40%–220%`)**, **Shader Contrast (`50%–250%`)**, **Shader Saturation (`0%–250%`)**, **Intensity**, **Speed**, **Scale**, and **Custom Colors** in Settings.
- **Library Groups & Detailed Context Menu Properties**:
  - Group books by **All**, **Custom Groups** (`Sci-Fi`, `Classics`, `Favorites`, `2026`), **Author**, **Format**, or **Status**.
  - Right-click any book -> **Properties** to inspect audio codec (`MP3`/`M4B`/`MP4`), bitrate, sample rate, exact byte size, total duration, tags, genres, filesystem path, and chapter files.
- **Animated 365-Day Listening Heatmap, Stats & Built-In Docs**:
  - Dedicated **Stats & Docs** view (`Activity` icon in sidebar) featuring an animated 52-week listening heatmap, 24-hour rhythm chart, streak & completion metrics, keyboard shortcut matrix, and copyable packaging guides.
- **Optional Cursor Click Spark Animation**:
  - Enable or disable the React Bits `ClickSpark` radial cursor click animation anytime in **Settings -> Layout -> Cursor Click Spark Animation**.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`L`** | Toggle **Minimal Slick Billboard Mode** (only Cover + Seekbar + huge translucent moving Title in background) |
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

## Quick Start (Local Development)

### Prerequisites
- **Node.js** `>= 20.x`
- **npm** `>= 10.x`

### Run Locally
```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
Open `http://localhost:5173`. On startup, Tide reads `/home/user/.tide/all.json` (`~/.tide/all.json`), crawls all `watchedRoots` (`/home/user/Audiobooks`), and indexes your audiobooks automatically.

---

## Building & Packaging Guide

### 1. Production Web Build
```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```
Produces a static bundle inside `dist/`.

### 2. Native Desktop App via Tauri v2 (macOS `.dmg`, Windows `.msi`, Linux `.AppImage`)
Tide includes a ready-to-use `tauri.conf.json` for lightweight (~12 MB) native desktop installers:
```bash
npm install -D @tauri-apps/cli
npx tauri build
```
Output installers are written to `src-tauri/target/release/bundle/`.

### 3. Desktop App via Electron (`electron-builder`)
```bash
npm run build
npx electron-builder --mac --win --linux
```

### 4. Self-Hosted Docker / Home Server (`Dockerfile` & `docker-compose.yml`)
Mount your host audiobook collection to `/audiobooks` and persist `~/.tide/all.json` in `/root/.tide`:
```bash
docker compose up -d --build
```
Or run directly with Docker:
```bash
docker build -t tide-audiobook-player .
docker run -d \
  -p 5173:5173 \
  -v /path/to/your/Audiobooks:/home/user/Audiobooks \
  -v ~/.tide:/home/user/.tide \
  --name tide-player \
  tide-audiobook-player
```
