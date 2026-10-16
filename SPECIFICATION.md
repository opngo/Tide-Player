# Audiobook Player — Product & Technical Specification

> **Working Title**: *Tide / Amp*  
> **Category**: Desktop & Self-Hosted Web Audiobook Player  
> **Inspiration**: [Spicetify](https://spicetify.app/), [Winamp](https://winamp.com/), Apple Music / Dynamic Island, Plexamp, AudioBookShelf, ChatGPT Voice Mode, and [React Bits](https://reactbits.dev/)  
> **Core Philosophy**: *Radical minimalism, zero outlines, zero visual noise, instant HTTP 206 playback, automatic `~/.tide/all.json` indexing, real Goodreads / Apple Books / OpenLibrary / Google Books cover & metadata discovery, full WebGL shader backgrounds with brightness/contrast/saturation grading, Minimal Slick Billboard Mode (`L`), and live AudioBookBay + qBittorrent sequential streaming.*

---

## 1. Design Principles & Strict Minimalist Mandates

1. **Zero Outlines / Zero Borders**:
   - No `1px solid` borders, outlines, or harsh dividers anywhere in the interface (`border: none`, `outline: none`).
   - Separation is achieved purely through translucent luminance (`bg-white/[0.04]` to `bg-white/[0.14]`), backdrop blur (`backdrop-filter: blur(28px) saturate(185%)`), and soft ambient shadows.
2. **Minimal Text & No AI Clichés**:
   - **Player View Text Budget**: At most **one single line of text** above the seekbar (`Chapter Title` on the left with `DecryptedText` cipher transition, `Time Remaining` on the right).
3. **Minimal Slick Billboard Mode (`L` on Keyboard) with Choreographed Transition**:
   - Pressing **`L`** on the keyboard (or selecting **Minimal Slick Billboard Mode (`L`)** from the Player top-right menu) triggers a choreographed `cubic-bezier(0.16, 1, 0.3, 1)` transition: the top bar, chapter header, and transport dock smoothly glide out while the **3D Cursor-Reactive Cover Art** and **Seekbar** smoothly morph and scale up into center stage.
   - In the background behind the cover, **huge, bold, ultra-translucent billboard text** (`16vw`–`19vw` uppercase black typography at `3.5%`–`6.5%` opacity) fades and blurs into focus, continuously gliding across the screen in dual counter-scrolling marquee tracks (`animate-billboard-left` and `animate-billboard-right`) with adjustable speed (`slickTextSpeed`).
4. **10 Cover Presentation Designs & 16 Procedural Vector Art Motifs**:
   - **10 Cover Frame Styles (`CoverShape`)**: `rounded`, `square`, `circle`, `vinyl` (spinning LP record with concentric grooves & spindle label), `cd-jewel` (optical iridescent hub), `hardcover` (3D book spine crease & page-edge stack), `floating-glass` (frosted glass pedestal), `polaroid` (editorial gallery frame with micro-typeset caption), `tape` (dual spinning cassette reels), and `octagon` (geometric cutout).
   - **16 Procedural Vector Cover Motifs (`CoverMotif`)**: `orbit`, `dunes`, `waves`, `monolith`, `grid`, `eclipse`, `prism`, `botanical`, `bauhaus`, `vinyl-grooves`, `topography`, `pulsar`, `cathedral`, `totem`, `horizon`, and `constellation`.
5. **Auto-Hiding Icon-Only Sidebar**:
   - **Icons only (zero words)** in the sidebar (`Player`, `Library`, `Queue`, `AudioBookBay`, `Transfers`, `Heatmap & Docs`, `Settings`).
   - **One single `+` button** at the top of the sidebar with **no background** (`bg-transparent`), opening a unified popover to add a Root Library Folder (where each child folder = 1 book), Single Book Folder, Quick Path Scan, Author, Playlist, or Tag.
   - **No Frosted Glass button in the sidebar** — the **Frosted Glass Sidebar** toggle and the **Cursor Click Spark (`ClickSpark`) Enable/Disable** toggle live cleanly inside **Settings (`CustomizeView`)**.
   - **No Bottom Black Mini-Player Bar**: Exiting the full-screen Player view to Library, Queue, AudioBookBay, Transfers, Stats, or Settings never renders a persistent black bottom player bar.

---

## 2. Live Cover & Metadata Search APIs (`GET /api/metadata/search`)

Tide integrates four free, no-key-required book & audiobook metadata APIs in parallel inside `server/apiPlugin.ts` (`GET /api/metadata/search?q=...&source=all|goodreads|apple|openlibrary|google`):

1. **Goodreads Live JSON API (`goodreads.com/book/auto_complete`)**:
   - Returns verified book titles, authors, community star ratings (`avgRating`), rating counts, HTML descriptions, and high-resolution `._SY600_` jacket covers proxied via `/api/proxy`.
2. **Apple Books / iTunes Audiobook API (`itunes.apple.com/search?media=audiobook`)**:
   - Returns uncropped `600x600bb.jpg` square audiobook covers, narrators/artists, release years, genres, chapter/track counts, and synopses.
3. **OpenLibrary Search & Covers API (`openlibrary.org/search.json` & `covers.openlibrary.org`)**:
   - Returns archival `-L.jpg` covers, first publish years, ratings, and subject classifications.
4. **Google Books API (`googleapis.com/books/v1/volumes`)**:
   - Returns high-zoom book covers (`zoom=2`), publishers, categories, and full volume synopses.
5. **One-Click Cover & Palette Extraction (`MetadataEditorModal.tsx`)**:
   - Accessible from the Library right-click context menu (**Find Cover (Goodreads / APIs)**), the Book Properties modal, or the Player menu.
   - Clicking **Cover Only** or **Cover + Info** downloads the cover through `/api/proxy`, extracts its dominant/vibrant/dark/light color palette via HTML5 Canvas (`extractPaletteFromImage`), and persists the updated book to `~/.tide/all.json`.

---

## 3. Persistent Local Library, Groups, Properties & Auto-Sync (`~/.tide/all.json`)

- **No File Uploads**: Tide references local filesystem paths directly and persists the entire library inside **`~/.tide/all.json`** (`/home/user/.tide/all.json`).
- **Auto-Generation into `~/.tide/all.json`**:
  - Every time a book or folder is added or scanned, or when the app boots (`GET /api/library`), `watchedRoots` are crawled and synced into `~/.tide/all.json`.
- **Settings Management & Repair Controls (`CustomizeView`)**:
  - **Force Index Now (`POST /api/library/force-index`)**: Re-crawls all `watchedRoots` and recomputes MPEG `global_gain` dynamic-range waveform peaks.
  - **Fix Lost & Missing Books (`POST /api/library/repair`)**: Audits every book and chapter file on disk, relocates moved folders inside `watchedRoots`, repairs stream URLs, and prunes dead entries.
  - **Reset & Re-Add Everything (`POST /api/library/reset`)**: Wipes and rebuilds `~/.tide/all.json` cleanly from disk.
- **Library Groups (`src/components/LibraryView.tsx`)**:
  - Group books dynamically by **All**, **Groups** (custom collection groups like `Sci-Fi`, `Classics`, `Favorites`, `2026`), **Author**, **Format** (`MP3 · Multi-Chapter`, `M4B · Single-File`), or **Status** (`In Progress`, `Unplayed`, `Finished`).
  - Assign any book to a group directly from the right-click context menu or Metadata Editor.
- **Book Properties Inspector Modal (`src/components/LibraryView.tsx`)**:
  - Right-clicking any book and selecting **Properties (Format, Size, Tags)** opens a detailed inspector showing:
    - Audio codec/format (`MP3`, `M4B`, `MP4`), bitrate (`64 kbps` / `128 kbps`), sample rate (`44.1 kHz`), total file size in MB and exact bytes, total duration, chapter count, structure (`Multi-File` vs `Single-File`), tags, genres, assigned group, filesystem path (`folderPath`), and a per-chapter file table.

---

## 4. Instant Audio Engine, Multi-Style Seekbars & Speech-Reactive Visualizer

1. **Instant In-Memory Blob URL + HTTP 206 Audio Engine (`src/services/audioEngine.ts`)**:
   - Pre-buffers active chapter or single-file `.m4b` streams into in-memory `Blob` URLs (`URL.createObjectURL(blob)`), guaranteeing 0ms local RAM seeking for seekbar dragging, `-15s`/`+30s` buttons, chapter jumps, and keyboard shortcuts (`←`, `→`, `J`, `Shift+←`, `Shift+→`) without ever resetting to `0:00` behind reverse proxies.
   - Supports both multi-file audiobooks and single-file `.m4b` audiobooks with embedded binary MP4 `chpl` / QuickTime chapters (`isSingleFileBook`).
2. **Real-Time Speech-Reactive Web Audio Visualizer & Strict Stillness When Paused**:
   - Connects `HTMLAudioElement` via `ctx.createMediaElementSource(this.audio)` into a 10-band Web Audio EQ + `AnalyserNode`, driving real-time FFT spectrum, PCM time-domain waveform, and human speech formant bands (`F0`, `F1`, `F2`, sibilance).
   - When paused, `AudioVisualizer.tsx` freezes completely so the visualizer never moves on its own.
3. **10 Seekbar Styles + Screen-Relative Width Slider (`src/components/ProgressBar.tsx` & `CustomizeView.tsx`)**:
   - **`simple`**: Clean flat solid progress bar with zero gradients and zero glow.
   - **`simple-chapter`**: Flat solid chapter-segmented progress bar with crisp chapter gaps and zero gradients.
   - **`stepped`** & **`minimal-ticks`**: Flat discrete equalizer blocks and field-recorder ruler ticks (no gradients).
   - **`screen-veil`** & **`fullScreenSeekbar`**: Full-screen translucent dark progress filter covering the played portion (`0%` → playhead) from left to right.
   - **`wave`**, **`chaptered`**, **`line`**, **`dual`**, **`dots`**: Dynamic-range soundwave, glass chapter capsules, laser horizon, dual macro/chapter, and LED matrix scrubbers.
   - **Seekbar Width Slider (`seekbarWidthPct`)**: Adjustable in Settings (`35%` to `100%` of screen width).

---

## 5. Full WebGL Shaders & Post-Processing Grading (`DynamicBackground.tsx` & `ReactBitsComponents.tsx`)

All animated shader backgrounds run on hardware-accelerated **WebGL GLSL fragment shaders**:
- **`crt-warp`**: React Bits CRT Warp shader (`CRTWarpBackground.tsx`) with barrel curvature, 80×24 quantized plasma grid, scanlines, 9-tap bloom, and RGB chromatic shift.
- **`balatro`**: React Bits Balatro polar vortex swirl shader.
- **`iridescence`**: React Bits Iridescence cosine matrix interference shader.
- **`aurora`**: React Bits FBM simplex-noise northern-lights curtain shader.
- **`silk`**: React Bits rotated UV interference silk fabric shader.
- **`dither`**: React Bits 4×4 ordered Bayer matrix dithering field shader.
- **`mesh`**: Volumetric multi-lobe plasma mesh shader.
- **`ripple`**: Dual-source radial wave interference shader.
- **`particles`**: Multi-layer twinkling starfield & nebula shader.
- **Shader Grading Controls in Settings (`CustomizeView.tsx`)**:
  - Real-time sliders for **Shader Brightness** (`40%`–`220%`), **Shader Contrast** (`50%`–`250%`), **Shader Saturation** (`0%`–`250%`), **Intensity**, **Speed**, **Scale**, **Color Source** (`Cover`, `Custom` via `ReactBitsColorPickerPopover`, `Mono`), and **Audio Reactivity** (`Off`, `Low`, `High`).

---

## 6. Animated Listening Heatmap, Stats & In-App Documentation (`src/components/StatsView.tsx`)

- **Animated 365-Day / 52-Week Listening Heatmap**:
  - Staggered spring entrance animation across all 364 day cells, colored by daily listening intensity (`0` to `4` levels) with hover tooltips displaying date, minutes listened, and book title.
- **Animated KPI Cards & 24-Hour Listening Rhythm**:
  - Tracks total listening hours, active day streak, indexed books/chapters, disk usage, average playback speed, 24-hour time-of-day distribution bars, and per-book completion bars.
- **Built-In Documentation, Keyboard Shortcuts & Packaging Guide**:
  - Interactive reference for all keyboard shortcuts, free metadata APIs, `~/.tide/all.json` architecture, and one-click copyable build commands for **Local Dev**, **Tauri v2 Native Desktop (`.dmg` / `.msi` / `.AppImage`)**, **Electron**, and **Docker Compose**.
