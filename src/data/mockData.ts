import {
  Book,
  Palette,
  EqualizerBand,
  ScenePreset,
  CoverMotif,
} from '../types';

export function makePalette(
  dominant: string,
  vibrant: string,
  muted: string,
  dark: string,
  light: string
): Palette {
  return {
    dominant,
    vibrant,
    muted,
    dark,
    light,
    bg: dark,
    surface: `${dominant}22`,
    surface2: `${vibrant}18`,
    accent: vibrant,
    accentSoft: `${vibrant}32`,
    text: '#f8fafc',
    textDim: '#94a3b8',
    glow: `${vibrant}55`,
  };
}

export const DEFAULT_PALETTE: Palette = makePalette(
  '#0c4a6e',
  '#38bdf8',
  '#0369a1',
  '#04080e',
  '#e0f2fe'
);

export const CURATED_PALETTES: Palette[] = [
  DEFAULT_PALETTE,
  makePalette('#7c2d12', '#fb923c', '#9a3412', '#0c0603', '#ffedd5'),
  makePalette('#064e3b', '#34d399', '#047857', '#030d09', '#d1fae5'),
  makePalette('#3b0764', '#c084fc', '#581c87', '#09040f', '#f3e8ff'),
  makePalette('#7f1d1d', '#fb7185', '#991b1b', '#0f0406', '#ffe4e6'),
  makePalette('#713f12', '#facc15', '#854d0e', '#0d0902', '#fef9c3'),
];

export const PALETTES: Record<string, Palette> = {
  ocean: DEFAULT_PALETTE,
  amber: CURATED_PALETTES[1],
  emerald: CURATED_PALETTES[2],
  violet: CURATED_PALETTES[3],
  crimson: CURATED_PALETTES[4],
  gold: CURATED_PALETTES[5],
};

export function derivePaletteFromCustom(
  primaryHex: string,
  accentHex: string,
  bgHex: string
): Palette {
  return makePalette(
    accentHex || '#0c4a6e',
    primaryHex || '#38bdf8',
    accentHex || '#0369a1',
    bgHex || '#04080e',
    '#f8fafc'
  );
}

/**
 * Pure minimal vector cover (16 Bauhaus / Swiss / Teenage Engineering geometric motifs, zero text clutter)
 */
export function generateCoverSvg(
  title: string,
  _author: string,
  palette: Palette,
  motif?: CoverMotif
): string {
  const hash = Array.from(title || 'Tide').reduce((a, c) => a + c.charCodeAt(0), 0);
  const modes: CoverMotif[] = [
    'orbit',
    'dunes',
    'waves',
    'monolith',
    'grid',
    'eclipse',
    'prism',
    'botanical',
    'bauhaus',
    'vinyl-grooves',
    'topography',
    'pulsar',
    'cathedral',
    'totem',
    'horizon',
    'constellation',
  ];
  const activeMotif: CoverMotif = motif || modes[hash % modes.length];

  let shapes = '';
  switch (activeMotif) {
    case 'orbit':
      shapes = `
        <circle cx="200" cy="200" r="132" fill="none" stroke="${palette.light}" stroke-width="1" stroke-opacity="0.22" stroke-dasharray="6 8"/>
        <circle cx="200" cy="200" r="105" fill="none" stroke="${palette.vibrant}" stroke-width="1.75" stroke-opacity="0.42"/>
        <circle cx="200" cy="200" r="68" fill="url(#orbGrad)"/>
        <circle cx="274" cy="126" r="12" fill="${palette.light}"/>
        <circle cx="108" cy="252" r="6" fill="${palette.vibrant}"/>
      `;
      break;
    case 'dunes':
      shapes = `
        <circle cx="268" cy="126" r="48" fill="${palette.light}" opacity="0.92"/>
        <circle cx="125" cy="96" r="14" fill="${palette.vibrant}" opacity="0.7"/>
        <path d="M 0 258 Q 130 188 260 250 T 400 222 L 400 400 L 0 400 Z" fill="${palette.dominant}"/>
        <path d="M 0 308 Q 180 248 400 292 L 400 400 L 0 400 Z" fill="${palette.vibrant}" opacity="0.68"/>
      `;
      break;
    case 'waves':
      shapes = `
        <circle cx="200" cy="138" r="44" fill="url(#orbGrad)"/>
        <path d="M 0 218 C 110 175, 190 255, 300 208 C 350 188, 380 212, 400 202 L 400 400 L 0 400 Z" fill="${palette.dominant}" opacity="0.78"/>
        <path d="M 0 268 C 130 232, 220 295, 330 258 C 365 242, 385 262, 400 258 L 400 400 L 0 400 Z" fill="${palette.vibrant}" opacity="0.54"/>
        <path d="M 0 322 C 120 295, 250 345, 400 312 L 400 400 L 0 400 Z" fill="${palette.light}" opacity="0.24"/>
      `;
      break;
    case 'monolith':
      shapes = `
        <rect x="148" y="62" width="104" height="276" rx="52" fill="url(#orbGrad)"/>
        <circle cx="200" cy="138" r="22" fill="${palette.dark}" opacity="0.55"/>
        <rect x="197" y="185" width="6" height="95" rx="3" fill="${palette.light}" opacity="0.65"/>
      `;
      break;
    case 'grid':
      shapes = `
        <circle cx="200" cy="145" r="56" fill="url(#orbGrad)"/>
        <line x1="0" y1="220" x2="400" y2="220" stroke="${palette.light}" stroke-width="1.5" stroke-opacity="0.45"/>
        <line x1="0" y1="250" x2="400" y2="250" stroke="${palette.vibrant}" stroke-width="1.2" stroke-opacity="0.35"/>
        <line x1="0" y1="290" x2="400" y2="290" stroke="${palette.vibrant}" stroke-width="1.2" stroke-opacity="0.4"/>
        <line x1="0" y1="342" x2="400" y2="342" stroke="${palette.vibrant}" stroke-width="1.5" stroke-opacity="0.5"/>
        <line x1="200" y1="220" x2="20" y2="400" stroke="${palette.vibrant}" stroke-width="1.2" stroke-opacity="0.38"/>
        <line x1="200" y1="220" x2="115" y2="400" stroke="${palette.vibrant}" stroke-width="1.2" stroke-opacity="0.38"/>
        <line x1="200" y1="220" x2="200" y2="400" stroke="${palette.light}" stroke-width="1.4" stroke-opacity="0.45"/>
        <line x1="200" y1="220" x2="285" y2="400" stroke="${palette.vibrant}" stroke-width="1.2" stroke-opacity="0.38"/>
        <line x1="200" y1="220" x2="380" y2="400" stroke="${palette.vibrant}" stroke-width="1.2" stroke-opacity="0.38"/>
      `;
      break;
    case 'eclipse':
      shapes = `
        <circle cx="200" cy="200" r="112" fill="none" stroke="${palette.vibrant}" stroke-width="2" stroke-opacity="0.35"/>
        <circle cx="200" cy="200" r="96" fill="${palette.light}" opacity="0.94"/>
        <circle cx="216" cy="186" r="88" fill="${palette.dark}"/>
      `;
      break;
    case 'prism':
      shapes = `
        <line x1="25" y1="235" x2="152" y2="188" stroke="${palette.light}" stroke-width="3" stroke-opacity="0.85"/>
        <polygon points="200,82 312,284 88,284" fill="url(#orbGrad)" opacity="0.9"/>
        <polygon points="200,115 282,268 118,268" fill="${palette.dark}" opacity="0.38"/>
        <line x1="252" y1="182" x2="380" y2="145" stroke="${palette.light}" stroke-width="3" stroke-opacity="0.8"/>
        <line x1="262" y1="204" x2="380" y2="195" stroke="${palette.vibrant}" stroke-width="4" stroke-opacity="0.85"/>
        <line x1="272" y1="226" x2="380" y2="245" stroke="${palette.dominant}" stroke-width="4" stroke-opacity="0.9"/>
      `;
      break;
    case 'botanical':
      shapes = `
        <path d="M 200 335 L 200 95" stroke="${palette.light}" stroke-width="3" stroke-linecap="round"/>
        <path d="M 200 265 C 125 255, 105 190, 200 185 Z" fill="${palette.vibrant}" opacity="0.85"/>
        <path d="M 200 225 C 275 215, 295 150, 200 145 Z" fill="${palette.light}" opacity="0.88"/>
        <path d="M 200 165 C 140 155, 130 105, 200 100 Z" fill="url(#orbGrad)"/>
        <circle cx="200" cy="74" r="12" fill="${palette.light}"/>
      `;
      break;
    case 'bauhaus':
      shapes = `
        <rect x="68" y="68" width="132" height="132" fill="${palette.vibrant}" opacity="0.9"/>
        <path d="M 200 68 A 132 132 0 0 1 332 200 L 200 200 Z" fill="${palette.light}" opacity="0.92"/>
        <path d="M 68 200 A 132 132 0 0 0 200 332 L 200 200 Z" fill="${palette.dominant}" opacity="0.95"/>
        <circle cx="266" cy="266" r="56" fill="url(#orbGrad)"/>
        <circle cx="134" cy="134" r="26" fill="${palette.dark}"/>
      `;
      break;
    case 'vinyl-grooves':
      shapes = `
        <circle cx="200" cy="200" r="142" fill="${palette.dark}" opacity="0.82"/>
        <circle cx="200" cy="200" r="126" fill="none" stroke="${palette.vibrant}" stroke-width="1.5" stroke-opacity="0.35"/>
        <circle cx="200" cy="200" r="106" fill="none" stroke="${palette.light}" stroke-width="1" stroke-opacity="0.25"/>
        <circle cx="200" cy="200" r="86" fill="none" stroke="${palette.vibrant}" stroke-width="1.5" stroke-opacity="0.45"/>
        <circle cx="200" cy="200" r="52" fill="url(#orbGrad)"/>
        <circle cx="200" cy="200" r="12" fill="${palette.dark}"/>
      `;
      break;
    case 'topography':
      shapes = `
        <ellipse cx="200" cy="200" rx="148" ry="112" transform="rotate(-18 200 200)" fill="none" stroke="${palette.vibrant}" stroke-width="1.8" stroke-opacity="0.32"/>
        <ellipse cx="204" cy="196" rx="118" ry="88" transform="rotate(-14 200 200)" fill="none" stroke="${palette.vibrant}" stroke-width="2" stroke-opacity="0.48"/>
        <ellipse cx="208" cy="192" rx="88" ry="64" transform="rotate(-9 200 200)" fill="none" stroke="${palette.light}" stroke-width="2" stroke-opacity="0.64"/>
        <ellipse cx="212" cy="188" rx="56" ry="40" transform="rotate(-5 200 200)" fill="url(#orbGrad)"/>
      `;
      break;
    case 'pulsar':
      shapes = `
        <path d="M 55 125 L 140 125 Q 200 65 260 125 L 345 125" fill="none" stroke="${palette.light}" stroke-width="2.5" stroke-opacity="0.85"/>
        <path d="M 55 165 L 130 165 Q 200 92 270 165 L 345 165" fill="none" stroke="${palette.vibrant}" stroke-width="2.5" stroke-opacity="0.9"/>
        <path d="M 55 205 L 125 205 Q 200 122 275 205 L 345 205" fill="none" stroke="${palette.light}" stroke-width="2.8"/>
        <path d="M 55 245 L 135 245 Q 200 175 265 245 L 345 245" fill="none" stroke="${palette.vibrant}" stroke-width="2.5" stroke-opacity="0.85"/>
        <path d="M 55 285 L 148 285 Q 200 232 252 285 L 345 285" fill="none" stroke="${palette.light}" stroke-width="2" stroke-opacity="0.65"/>
      `;
      break;
    case 'cathedral':
      shapes = `
        <path d="M 104 332 L 104 185 A 96 96 0 0 1 296 185 L 296 332 Z" fill="none" stroke="${palette.light}" stroke-width="2.2" stroke-opacity="0.65"/>
        <path d="M 132 332 L 132 190 A 68 68 0 0 1 268 190 L 268 332 Z" fill="url(#orbGrad)" opacity="0.82"/>
        <circle cx="200" cy="168" r="34" fill="${palette.dark}" opacity="0.65"/>
        <circle cx="200" cy="168" r="16" fill="${palette.light}"/>
      `;
      break;
    case 'totem':
      shapes = `
        <circle cx="200" cy="96" r="34" fill="${palette.light}"/>
        <polygon points="200,138 258,216 142,216" fill="${palette.vibrant}"/>
        <rect x="142" y="226" width="116" height="44" rx="22" fill="url(#orbGrad)"/>
        <path d="M 126 328 A 74 52 0 0 1 274 328 Z" fill="${palette.light}" opacity="0.85"/>
      `;
      break;
    case 'horizon':
      shapes = `
        <circle cx="200" cy="185" r="88" fill="url(#orbGrad)"/>
        <rect x="0" y="210" width="400" height="190" fill="${palette.dark}" opacity="0.92"/>
        <rect x="116" y="222" width="168" height="8" rx="4" fill="${palette.light}" opacity="0.85"/>
        <rect x="132" y="242" width="136" height="7" rx="3.5" fill="${palette.vibrant}" opacity="0.75"/>
        <rect x="152" y="262" width="96" height="6" rx="3" fill="${palette.vibrant}" opacity="0.55"/>
        <rect x="172" y="280" width="56" height="5" rx="2.5" fill="${palette.vibrant}" opacity="0.38"/>
      `;
      break;
    case 'constellation':
      shapes = `
        <polyline points="92,268 148,156 224,192 292,108 316,238 208,292 92,268" fill="none" stroke="${palette.vibrant}" stroke-width="1.8" stroke-opacity="0.65"/>
        <line x1="148" y1="156" x2="208" y2="292" stroke="${palette.light}" stroke-width="1.2" stroke-opacity="0.35" stroke-dasharray="4 6"/>
        <circle cx="92" cy="268" r="7" fill="${palette.light}"/>
        <circle cx="148" cy="156" r="11" fill="url(#orbGrad)"/>
        <circle cx="224" cy="192" r="8" fill="${palette.light}"/>
        <circle cx="292" cy="108" r="14" fill="${palette.light}"/>
        <circle cx="316" cy="238" r="7" fill="${palette.vibrant}"/>
        <circle cx="208" cy="292" r="9" fill="${palette.vibrant}"/>
      `;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.dark}"/>
        <stop offset="60%" stop-color="${palette.dominant}"/>
        <stop offset="100%" stop-color="${palette.dark}"/>
      </linearGradient>
      <radialGradient id="orbGrad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="${palette.light}"/>
        <stop offset="52%" stop-color="${palette.vibrant}"/>
        <stop offset="100%" stop-color="${palette.dominant}"/>
      </radialGradient>
    </defs>
    <rect width="400" height="400" fill="url(#bgGrad)"/>
    ${shapes}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Extracts real dominant/vibrant/dark/light swatches from any cover URL via Canvas
 */
export async function extractPaletteFromImage(imageUrl: string): Promise<Palette> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(DEFAULT_PALETTE);
        ctx.drawImage(img, 0, 0, 48, 48);
        const data = ctx.getImageData(0, 0, 48, 48).data;

        let rSum = 0,
          gSum = 0,
          bSum = 0,
          count = 0;
        let maxSat = -1;
        let vibR = 56,
          vibG = 189,
          vibB = 248;

        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lum = (max + min) / 2;
          if (lum > 18 && lum < 240) {
            rSum += r;
            gSum += g;
            bSum += b;
            count++;
            const sat = max === 0 ? 0 : (max - min) / max;
            if (sat > maxSat && lum > 45 && lum < 215) {
              maxSat = sat;
              vibR = r;
              vibG = g;
              vibB = b;
            }
          }
        }

        if (count === 0) return resolve(DEFAULT_PALETTE);
        const domR = Math.round(rSum / count);
        const domG = Math.round(gSum / count);
        const domB = Math.round(bSum / count);

        const toHex = (r: number, g: number, b: number) =>
          `#${[r, g, b]
            .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
            .join('')}`;

        const dominant = toHex(domR * 0.65, domG * 0.65, domB * 0.65);
        const vibrant = toHex(
          Math.min(255, vibR * 1.15 + 20),
          Math.min(255, vibG * 1.15 + 20),
          Math.min(255, vibB * 1.15 + 20)
        );
        const muted = toHex(domR * 0.8, domG * 0.8, domB * 0.8);
        const dark = toHex(domR * 0.14, domG * 0.14, domB * 0.16);
        const light = toHex(
          215 + vibR * 0.15,
          215 + vibG * 0.15,
          215 + vibB * 0.15
        );

        resolve(makePalette(dominant, vibrant, muted, dark, light));
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };
    img.onerror = () => resolve(DEFAULT_PALETTE);
    img.src = imageUrl;
  });
}

export function generatePeaks(seed: number, count = 96): number[] {
  const arr: number[] = [];
  let s = Math.max(1, seed);
  for (let i = 0; i < count; i++) {
    s = (s * 16807) % 2147483647;
    const raw = (s % 1000) / 1000;
    const phrase =
      0.5 +
      0.32 * Math.sin(i * 0.68 + seed * 0.1) +
      0.18 * Math.cos(i * 1.85);
    // Exponential curve so low notes stay low (8-18%) and high notes pop (75-98%)
    let val = 0.08 + Math.pow(raw * 0.65 + phrase * 0.35, 2.15) * 0.9;
    if ((i + 3) % 11 === 0 || (i + 7) % 15 === 0) {
      val *= 0.38;
    }
    arr.push(Math.max(0.07, Math.min(0.98, Number(val.toFixed(3)))));
  }
  return arr;
}

/**
 * Fetches a REAL public-domain human-narrated audiobook from Archive.org / LibriVox via our backend proxy
 */
export async function fetchRealLibriVoxAudiobook(
  identifier = 'war_of_the_worlds_librivox'
): Promise<Book> {
  const resp = await fetch(`/api/librivox/book?id=${encodeURIComponent(identifier)}`);
  if (!resp.ok) {
    throw new Error('Failed to fetch LibriVox metadata');
  }
  const data = await resp.json();
  const palette = data.coverUrl
    ? await extractPaletteFromImage(data.coverUrl)
    : CURATED_PALETTES[0];

  let elapsedMs = 0;
  const chapters = (data.tracks || []).map((t: any, idx: number) => {
    const durMs = Math.round((t.durationSec || 300) * 1000);
    const ch = {
      id: `${identifier}-ch-${idx + 1}`,
      title: t.title || `${String(idx + 1).padStart(2, '0')}`,
      startMs: elapsedMs,
      endMs: elapsedMs + durMs,
      streamUrl: t.streamUrl,
    };
    elapsedMs += durMs;
    return ch;
  });

  const totalDur = Math.max(60000, elapsedMs);
  const firstStream = chapters[0]?.streamUrl;

  return {
    id: `librivox-${identifier}`,
    title: data.title || identifier,
    authors: [data.author || 'LibriVox'],
    narrators: ['LibriVox Public Domain'],
    description:
      typeof data.description === 'string'
        ? data.description.replace(/<[^>]+>/g, '')
        : '',
    tags: ['LibriVox'],
    genres: ['Audiobook'],
    folderPath: `https://archive.org/details/${identifier}`,
    importMode: 'single-book',
    cover:
      data.coverUrl ||
      generateCoverSvg(data.title || identifier, data.author || '', palette, 'orbit'),
    palette,
    peaks: generatePeaks(identifier.length * 137),
    durationMs: totalDur,
    addedAt: Date.now(),
    files: (data.tracks || []).map((t: any) => ({
      path: t.streamUrl,
      name: t.name,
      format: 'MP3',
      sizeBytes: t.sizeBytes || 0,
      durationMs: Math.round((t.durationSec || 300) * 1000),
      bitrateKbps: 128,
      objectUrl: t.streamUrl || firstStream,
    })),
    chapters:
      chapters.length > 0
        ? chapters
        : [
            {
              id: `${identifier}-ch-1`,
              title: '01',
              startMs: 0,
              endMs: totalDur,
            },
          ],
  };
}

export const DEFAULT_EQ_BANDS: EqualizerBand[] = [
  { freq: 31, label: '31', gainDb: 0 },
  { freq: 62, label: '62', gainDb: 0 },
  { freq: 125, label: '125', gainDb: 0 },
  { freq: 250, label: '250', gainDb: 0 },
  { freq: 500, label: '500', gainDb: 0 },
  { freq: 1000, label: '1k', gainDb: 0 },
  { freq: 2000, label: '2k', gainDb: 0 },
  { freq: 4000, label: '4k', gainDb: 0 },
  { freq: 8000, label: '8k', gainDb: 0 },
  { freq: 16000, label: '16k', gainDb: 0 },
];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Voice: [-5, -3, -1, 2, 4, 5, 4, 2, -1, -3],
  Bass: [6, 5, 4, 2, 0, 0, 0, 1, 2, 2],
  Bright: [-2, -1, 0, 0, 1, 2, 4, 5, 6, 5],
  Night: [-6, -4, -2, 1, 3, 3, 2, -1, -3, -5],
};

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'scene-voice-orb',
    name: 'Voice Orb',
    bg: {
      type: 'aurora',
      intensity: 0.65,
      speed: 0.7,
      scale: 1.0,
      reactivity: 'high',
      colorSource: 'cover',
      customColor: '#38bdf8',
      blend: 'screen',
      fpsCap: 60,
    },
    viz: {
      type: 'chatgpt-orb',
      secondaryLayers: [],
      placement: 'around-cover',
      lineCount: 64,
      thickness: 2.5,
      offset: 10,
      sensitivity: 1.25,
      smoothing: 0.8,
      opacity: 0.95,
      glowStrength: 18,
      mirrored: true,
      fill: true,
      peakCaps: false,
      reflection: false,
      speechMode: true,
    },
    themeMode: 'vivid',
    colorScheme: 'dark',
    coverShape: 'circle',
    progressBarStyle: 'wave',
    fontFamily: 'geist',
  },
  {
    id: 'scene-voice-dots',
    name: 'Voice Capsules',
    bg: {
      type: 'mesh',
      intensity: 0.55,
      speed: 0.6,
      scale: 1.1,
      reactivity: 'high',
      colorSource: 'cover',
      customColor: '#38bdf8',
      blend: 'screen',
      fpsCap: 60,
    },
    viz: {
      type: 'chatgpt-dots',
      secondaryLayers: [],
      placement: 'around-cover',
      lineCount: 48,
      thickness: 3,
      offset: 8,
      sensitivity: 1.3,
      smoothing: 0.78,
      opacity: 0.95,
      glowStrength: 12,
      mirrored: false,
      fill: true,
      peakCaps: false,
      reflection: false,
      speechMode: true,
    },
    themeMode: 'vivid',
    colorScheme: 'oled',
    coverShape: 'rounded',
    progressBarStyle: 'line',
    fontFamily: 'jakarta',
  },
  {
    id: 'scene-silk-wave',
    name: 'Silk Wave',
    bg: {
      type: 'silk',
      intensity: 0.5,
      speed: 0.5,
      scale: 1.0,
      reactivity: 'low',
      colorSource: 'cover',
      customColor: '#38bdf8',
      blend: 'screen',
      fpsCap: 60,
    },
    viz: {
      type: 'fluid-wave',
      secondaryLayers: [],
      placement: 'below-cover',
      lineCount: 64,
      thickness: 2,
      offset: 10,
      sensitivity: 1.15,
      smoothing: 0.84,
      opacity: 0.9,
      glowStrength: 14,
      mirrored: true,
      fill: true,
      peakCaps: false,
      reflection: false,
      speechMode: true,
    },
    themeMode: 'soft',
    colorScheme: 'dark',
    coverShape: 'rounded',
    progressBarStyle: 'chaptered',
    fontFamily: 'instrument',
  },
  {
    id: 'scene-crt-warp',
    name: 'CRT Warp',
    bg: {
      type: 'crt-warp',
      intensity: 0.9,
      speed: 0.65,
      scale: 1.0,
      reactivity: 'low',
      colorSource: 'cover',
      customColor: '#c755f7',
      blend: 'screen',
      fpsCap: 60,
    },
    viz: {
      type: 'bars',
      secondaryLayers: [],
      placement: 'below-cover',
      lineCount: 64,
      thickness: 2.5,
      offset: 10,
      sensitivity: 1.2,
      smoothing: 0.82,
      opacity: 0.92,
      glowStrength: 16,
      mirrored: true,
      fill: true,
      peakCaps: false,
      reflection: false,
      speechMode: true,
    },
    themeMode: 'vivid',
    colorScheme: 'oled',
    coverShape: 'rounded',
    progressBarStyle: 'wave',
    fontFamily: 'geist',
  },
  {
    id: 'scene-oled-minimal',
    name: 'Pure Black',
    bg: {
      type: 'oled',
      intensity: 0,
      speed: 0.5,
      scale: 1.0,
      reactivity: 'off',
      colorSource: 'mono',
      customColor: '#ffffff',
      blend: 'normal',
      fpsCap: 30,
    },
    viz: {
      type: 'cover-outline',
      secondaryLayers: [],
      placement: 'around-cover',
      lineCount: 56,
      thickness: 2,
      offset: 12,
      sensitivity: 1.1,
      smoothing: 0.85,
      opacity: 0.85,
      glowStrength: 0,
      mirrored: true,
      fill: false,
      peakCaps: false,
      reflection: false,
      speechMode: true,
    },
    themeMode: 'mono',
    colorScheme: 'oled',
    coverShape: 'square',
    progressBarStyle: 'line',
    fontFamily: 'newsreader',
  },
];
