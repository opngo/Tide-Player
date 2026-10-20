import { Book, Chapter } from '../types';

interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onSeekBackward: (offsetSec: number) => void;
  onSeekForward: (offsetSec: number) => void;
  onSeekTo: (positionSec: number) => void;
}

const rasterCoverCache = new Map<
  string,
  { dataUrl: string; blobUrl: string; httpUrl: string }
>();

/**
 * Renders any cover (including SVG data URIs `data:image/svg+xml`, proxied URLs,
 * or remote JPEGs/PNGs) into a genuine 512x512 `image/png` bitmap required by
 * Windows SMTC (`SystemMediaTransportControls`) and FluentFlyout.
 */
export async function rasterizeCoverForSmtc(
  book: Book
): Promise<{ dataUrl: string; blobUrl: string; httpUrl: string }> {
  const cacheKey = `${book.id}::${book.cover?.slice(0, 120) || ''}`;
  const cached = rasterCoverCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const authorName =
    Array.isArray(book.authors) && book.authors.length > 0
      ? book.authors.join(', ')
      : '';

  if (ctx) {
    const dark = book.palette?.dark || '#0a0e17';
    const vibrant = book.palette?.vibrant || '#f97316';
    const accent = book.palette?.accent || '#38bdf8';

    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, 512, 512);

    let drewImage = false;
    if (book.cover) {
      try {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const scale = Math.max(
              512 / Math.max(1, img.naturalWidth || 512),
              512 / Math.max(1, img.naturalHeight || 512)
            );
            const w = (img.naturalWidth || 512) * scale;
            const h = (img.naturalHeight || 512) * scale;
            const x = (512 - w) / 2;
            const y = (512 - h) / 2;
            ctx.drawImage(img, x, y, w, h);
            drewImage = true;
            resolve();
          };
          img.onerror = () => reject(new Error('cover load error'));
          img.src = book.cover;
        });
      } catch {
        drewImage = false;
      }
    }

    if (!drewImage) {
      const grad = ctx.createRadialGradient(160, 140, 20, 256, 256, 360);
      grad.addColorStop(0, vibrant);
      grad.addColorStop(0.55, accent);
      grad.addColorStop(1, dark);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText((book.title || 'Audiobook').slice(0, 22), 36, 420);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '24px sans-serif';
      ctx.fillText(authorName.slice(0, 28), 36, 462);
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  const blobUrl = blob ? URL.createObjectURL(blob) : dataUrl;
  const httpUrl = `${window.location.origin}/api/smtc/cover.png?bookId=${encodeURIComponent(
    book.id
  )}&t=${Date.now()}`;

  const entry = { dataUrl, blobUrl, httpUrl };
  rasterCoverCache.set(cacheKey, entry);
  return entry;
}

export function registerMediaSessionHandlers(cb: MediaSessionCallbacks): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  const safeSet = (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null
  ) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Action not supported on this platform
    }
  };

  safeSet('play', () => cb.onPlay());
  safeSet('pause', () => cb.onPause());
  safeSet('stop', () => cb.onPause());
  safeSet('previoustrack', () => cb.onPrevChapter());
  safeSet('nexttrack', () => cb.onNextChapter());
  safeSet('seekbackward', (details) =>
    cb.onSeekBackward(details.seekOffset || 15)
  );
  safeSet('seekforward', (details) =>
    cb.onSeekForward(details.seekOffset || 30)
  );
  safeSet('seekto', (details) => {
    if (typeof details.seekTime === 'number') {
      cb.onSeekTo(details.seekTime);
    }
  });
}

export async function syncFluentFlyoutMediaSession(params: {
  book: Book;
  chapter?: Chapter;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  playbackRate: number;
}): Promise<void> {
  const { book, chapter, isPlaying, positionMs, durationMs, playbackRate } =
    params;

  const authorName =
    Array.isArray(book.authors) && book.authors.length > 0
      ? book.authors.join(', ')
      : 'Audiobook';
  const seriesName =
    typeof book.series === 'object' && book.series?.name
      ? book.series.name
      : book.title;
  const albumLabel = chapter?.title || seriesName;

  // Set window document.title to the actual book title & author (never generic "Tide")
  if (typeof document !== 'undefined') {
    document.title = authorName ? `${book.title} — ${authorName}` : book.title;
  }

  const raster = await rasterizeCoverForSmtc(book);

  // Sync raster PNG + metadata to local backend (/api/smtc/cover.png) and Electron main
  try {
    fetch('/api/smtc/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: book.id,
        title: book.title,
        artist: authorName,
        album: albumLabel,
        chapterTitle: chapter?.title || '',
        isPlaying,
        positionMs,
        durationMs,
        pngDataUrl: raster.dataUrl,
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  if (window.tideElectron?.updateMediaMetadata) {
    window.tideElectron
      .updateMediaMetadata({
        title: book.title,
        artist: authorName,
        album: albumLabel,
        isPlaying,
        pngDataUrl: raster.dataUrl,
      })
      .catch(() => {});
  }

  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: book.title,
        artist: authorName,
        album: chapter?.title
          ? `${chapter.title} · ${seriesName}`
          : seriesName,
        artwork: [
          { src: raster.httpUrl, sizes: '512x512', type: 'image/png' },
          { src: raster.httpUrl, sizes: '256x256', type: 'image/png' },
          { src: raster.blobUrl, sizes: '512x512', type: 'image/png' },
          { src: raster.dataUrl, sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      const durSec = Math.max(1, durationMs / 1000);
      const posSec = Math.max(0, Math.min(durSec, positionMs / 1000));
      if (typeof navigator.mediaSession.setPositionState === 'function') {
        navigator.mediaSession.setPositionState({
          duration: durSec,
          playbackRate: Math.max(0.25, playbackRate || 1),
          position: posSec,
        });
      }
    } catch {
      // ignore
    }
  }
}
