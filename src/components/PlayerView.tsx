import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Bookmark as BookmarkIcon,
  Sliders,
  Maximize2,
  Minimize2,
  Repeat,
  FileText,
  Edit3,
  Mic,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import {
  Book,
  Bookmark,
  Palette,
  ProgressBarStyle,
  TimeDisplayMode,
  CoverShape,
  VizConfig,
  VizType,
  PlayerViewMode,
  EqualizerBand,
  QueueItem,
} from '../types';
import {
  ProgressBar,
  formatTimeDisplay,
  formatDurationNumeric,
  findActiveChapterIndex,
} from './ProgressBar';
import { AudioVisualizer } from './AudioVisualizer';
import { EqualizerPanel } from './EqualizerPanel';
import { audioEngine } from '../services/audioEngine';
import { ReactBitsDecryptedText } from './ReactBitsComponents';

interface PlayerViewProps {
  book: Book;
  books: Book[];
  palette?: Palette;
  isPlaying: boolean;
  onTogglePlay: () => void;
  positionMs: number;
  onSeek: (ms: number) => void;
  onSkipSeconds: (sec: number) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  speed: number;
  onChangeSpeed: (spd: number) => void;
  volume: number;
  muted: boolean;
  onChangeVolume: (vol: number) => void;
  onToggleMute: () => void;
  viewMode: PlayerViewMode;
  onChangeViewMode: (mode: PlayerViewMode) => void;
  progressBarStyle: ProgressBarStyle;
  onCycleProgressBarStyle: () => void;
  onChangeProgressBarStyle?: (style: ProgressBarStyle) => void;
  timeMode: TimeDisplayMode;
  onCycleTimeMode: () => void;
  coverShape: CoverShape;
  onChangeCoverShape?: (shape: CoverShape) => void;
  vizConfig: VizConfig;
  onCycleVisualizer: () => void;
  onChangeVizType?: (type: VizType) => void;
  bookmarks: Bookmark[];
  onAddBookmark: (note?: string) => void;
  onDeleteBookmark: (id: string) => void;
  sleepTimerMin: number | 'chapter' | 'book' | null;
  onSetSleepTimer: (val: number | 'chapter' | 'book' | null) => void;
  chapterLoop: boolean;
  onToggleChapterLoop: () => void;
  eqBands: EqualizerBand[];
  preampDb: number;
  voiceBoost: boolean;
  skipSilence: boolean;
  normalizeLoudness: boolean;
  onChangeEq: (bands: EqualizerBand[], preamp: number) => void;
  onToggleVoiceBoost: () => void;
  onToggleSkipSilence: () => void;
  onToggleNormalize: () => void;
  outputDevice: string;
  onChangeOutputDevice: (dev: string) => void;
  queue: QueueItem[];
  onSelectBook: (book: Book) => void;
  onOpenMetadataEditor: () => void;
  onOpenTranscript: () => void;
  isImmersive: boolean;
  onToggleImmersive: () => void;
  isSlickMode?: boolean;
  onToggleSlickMode?: () => void;
  slickTextSpeed?: number;
  fullScreenSeekbar?: boolean;
  chapterOnlySeekbar?: boolean;
  onToggleChapterOnlySeekbar?: () => void;
  seekbarWidthPct?: number;
  squareCorners: boolean;
}

const HORIZONTAL_VIZ_TYPES = new Set<VizType>([
  'bars',
  'mirrored-bars',
  'fluid-wave',
  'aurora-ribbons',
  'oscilloscope',
  'constellation',
  'dots',
]);

const PERIMETER_VIZ_TYPES = new Set<VizType>([
  'cover-outline',
  'halo',
  'breath',
]);

export const PlayerView: React.FC<PlayerViewProps> = ({
  book,
  books,
  palette: propPalette,
  isPlaying,
  onTogglePlay,
  positionMs,
  onSeek,
  onSkipSeconds,
  onPrevChapter,
  onNextChapter,
  speed,
  onChangeSpeed,
  volume,
  muted,
  onChangeVolume,
  onToggleMute,
  viewMode,
  onChangeViewMode,
  progressBarStyle,
  onCycleProgressBarStyle,
  onChangeProgressBarStyle,
  timeMode,
  onCycleTimeMode,
  coverShape,
  onChangeCoverShape,
  vizConfig,
  onCycleVisualizer,
  onChangeVizType,
  bookmarks,
  onAddBookmark,
  sleepTimerMin,
  onSetSleepTimer,
  chapterLoop,
  onToggleChapterLoop,
  eqBands,
  preampDb,
  voiceBoost,
  skipSilence,
  normalizeLoudness,
  onChangeEq,
  onToggleVoiceBoost,
  onToggleSkipSilence,
  onToggleNormalize,
  outputDevice,
  onChangeOutputDevice,
  queue,
  onSelectBook,
  onOpenMetadataEditor,
  onOpenTranscript,
  isImmersive,
  onToggleImmersive,
  isSlickMode = false,
  onToggleSlickMode,
  slickTextSpeed = 18,
  fullScreenSeekbar = true,
  chapterOnlySeekbar = false,
  onToggleChapterOnlySeekbar,
  seekbarWidthPct = 88,
  squareCorners,
}) => {
  const [showTopRightMenu, setShowTopRightMenu] = useState(false);
  const [showEqDrawer, setShowEqDrawer] = useState(false);
  const [micActive, setMicActive] = useState(audioEngine.isMicActive);
  const [forceCoverInOrbMode, setForceCoverInOrbMode] = useState(false);
  const [abStartMs, setAbStartMs] = useState<number | null>(
    audioEngine.abLoopStartMs
  );
  const [abEndMs, setAbEndMs] = useState<number | null>(audioEngine.abLoopEndMs);
  const [screenHoverRatio, setScreenHoverRatio] = useState<number | null>(null);
  const screenCurtainRef = useRef<HTMLDivElement | null>(null);

  // 3D Cursor-Reactive Cover Tilt State
  const coverRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 50,
    active: false,
  });

  const currentChapterIndex = findActiveChapterIndex(book.chapters, positionMs);
  const currentChapter = book.chapters[currentChapterIndex] ||
    book.chapters[0] || {
      id: 'ch-1',
      title: book.title,
      startMs: 0,
      endMs: book.durationMs,
    };

  const palette = propPalette || book.palette;
  const bookBookmarks = bookmarks.filter((b) => b.bookId === book.id);
  const timeString = formatTimeDisplay(
    positionMs,
    book.durationMs,
    currentChapter,
    speed,
    timeMode,
    chapterOnlySeekbar
  );

  const isOrbVisualizer =
    vizConfig.type === 'chatgpt-orb' || vizConfig.type === 'chatgpt-dots';
  const isHorizontalVisualizer = HORIZONTAL_VIZ_TYPES.has(vizConfig.type);
  const isPerimeterVisualizer = PERIMETER_VIZ_TYPES.has(vizConfig.type);
  const isCoverRadialVisualizer = vizConfig.type === 'cover-outline';

  const handleCoverMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = coverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const ry = (x - 0.5) * 22;
    const rx = (0.5 - y) * 22;
    setTilt({
      rx,
      ry,
      gx: Math.round(x * 100),
      gy: Math.round(y * 100),
      active: true,
    });
  };

  const handleCoverMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50, active: false });
  };

  const renderCoverArt = (forceActualCover = false, largeSlick = false) => {
    if (isOrbVisualizer && !forceCoverInOrbMode && !forceActualCover) {
      return (
        <div
          onClick={onTogglePlay}
          className={`relative ${
            largeSlick
              ? 'w-80 h-80 sm:w-[420px] sm:h-[420px]'
              : 'w-72 h-72 sm:w-84 sm:h-84'
          } flex items-center justify-center cursor-pointer group transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isPlaying ? 'scale-[0.945]' : 'scale-[1.045]'
          }`}
        >
          <AudioVisualizer
            config={vizConfig}
            palette={palette}
            width={largeSlick ? 420 : 340}
            height={largeSlick ? 420 : 340}
            isAroundCover={false}
            className="w-full h-full transition-transform duration-700 group-hover:scale-[1.04]"
          />
        </div>
      );
    }

    const baseSize = largeSlick
      ? 'w-76 h-76 sm:w-[410px] sm:h-[410px] md:w-[460px] md:h-[460px]'
      : 'w-64 h-64 sm:w-76 sm:h-76';

    // Lock cover to circle ONLY when the Cover Radial ('cover-outline') visualizer is active!
    const effectiveShape: CoverShape = isCoverRadialVisualizer
      ? 'circle'
      : coverShape;

    let shapeClass = 'rounded-3xl';
    if (effectiveShape === 'circle') {
      shapeClass = 'rounded-full';
    } else if (squareCorners || effectiveShape === 'square') {
      shapeClass = 'rounded-none';
    } else if (effectiveShape === 'vinyl' || effectiveShape === 'cd-jewel') {
      shapeClass = 'rounded-full';
    } else if (effectiveShape === 'tape') {
      shapeClass = largeSlick
        ? 'rounded-3xl aspect-[4/3] h-64 sm:h-84'
        : 'rounded-2xl aspect-[4/3] h-52 sm:h-60';
    } else if (effectiveShape === 'hardcover') {
      shapeClass = largeSlick
        ? 'rounded-r-2xl rounded-l-sm aspect-[4/5] h-80 sm:h-[430px]'
        : 'rounded-r-xl rounded-l-sm aspect-[4/5] h-68 sm:h-80';
    } else if (effectiveShape === 'floating-glass') {
      shapeClass = 'rounded-3xl p-3.5 bg-white/[0.07] backdrop-blur-2xl';
    } else if (effectiveShape === 'polaroid') {
      shapeClass = 'rounded-2xl p-3 pb-11 bg-zinc-900/90 backdrop-blur-xl';
    }

    const octagonClip =
      effectiveShape === 'octagon'
        ? 'polygon(28% 0%, 72% 0%, 100% 28%, 100% 72%, 72% 100%, 28% 100%, 0% 72%, 0% 28%)'
        : undefined;

    const isSpinningDisc =
      (effectiveShape === 'vinyl' || effectiveShape === 'cd-jewel') && isPlaying;

    return (
      <div className="flex flex-col items-center">
        {/* Outer wrapper scales up slightly on pause (1.045) and shrinks slightly on play (0.945) */}
        <div
          className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isPlaying ? 'scale-[0.945]' : 'scale-[1.045]'
          }`}
        >
          <div
            ref={coverRef}
            onMouseMove={handleCoverMouseMove}
            onMouseLeave={handleCoverMouseLeave}
            onClick={onTogglePlay}
            className="relative flex items-center justify-center group cursor-pointer select-none"
            style={{
              perspective: '900px',
            }}
          >
            {/* Perimeter / Cover Radial Visualizer positioned UNDERNEATH (z-0) the z-10 cover and sized larger */}
            {isPerimeterVisualizer && (
              <AudioVisualizer
                config={vizConfig}
                palette={palette}
                width={
                  isCoverRadialVisualizer
                    ? largeSlick
                      ? 660
                      : 510
                    : largeSlick
                    ? 540
                    : 420
                }
                height={
                  isCoverRadialVisualizer
                    ? largeSlick
                      ? 660
                      : 510
                    : largeSlick
                    ? 540
                    : 420
                }
                isAroundCover={true}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
              />
            )}

            {/* 3D Cursor-Reactive & Floating Cover Card (z-10, sits ON TOP of the z-0 radial visualizer) */}
            <div
              className={`relative ${baseSize} ${shapeClass} overflow-hidden shadow-[0_36px_100px_rgba(0,0,0,0.78)] z-10 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                !tilt.active ? 'animate-[floatCover_6s_ease-in-out_infinite]' : ''
              } ${isSpinningDisc ? 'animate-[spin_20s_linear_infinite]' : ''}`}
              style={{
                clipPath: octagonClip,
                transform: tilt.active
                  ? `rotateX(${tilt.rx.toFixed(2)}deg) rotateY(${tilt.ry.toFixed(
                      2
                    )}deg) scale3d(1.04, 1.04, 1.04)`
                  : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
                transition: tilt.active
                  ? 'transform 80ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
                transformStyle: 'preserve-3d',
              }}
            >
              <img
                src={book.cover}
                alt={book.title}
                className={`w-full h-full object-cover select-none pointer-events-none ${
                  effectiveShape === 'floating-glass'
                    ? 'rounded-2xl shadow-2xl'
                    : effectiveShape === 'polaroid'
                    ? 'rounded-xl'
                    : ''
                }`}
              />

              {/* Dynamic Cursor-Following Specular Glare Overlay */}
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                style={{
                  opacity: tilt.active ? 1 : 0,
                  background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.04) 42%, transparent 70%)`,
                }}
              />

              {/* Cover Design: VINYL LP Grooves & Center Label */}
              {effectiveShape === 'vinyl' && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none opacity-35"
                    style={{
                      background:
                        'repeating-radial-gradient(circle at center, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 5px, rgba(255,255,255,0.08) 6px)',
                    }}
                  />
                  <div
                    className="absolute inset-0 m-auto w-16 h-16 rounded-full shadow-inner flex items-center justify-center"
                    style={{
                      background: `radial-gradient(circle, ${palette.vibrant} 0%, ${palette.dominant} 75%, #09090b 100%)`,
                    }}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-black shadow-inner" />
                  </div>
                </>
              )}

              {/* Cover Design: CD-JEWEL Optical Iridescent Hub */}
              {effectiveShape === 'cd-jewel' && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none opacity-25"
                    style={{
                      background:
                        'conic-gradient(from 45deg, transparent 0deg, rgba(255,255,255,0.35) 35deg, transparent 75deg, rgba(56,189,248,0.28) 150deg, transparent 210deg, rgba(232,121,249,0.28) 310deg, transparent 360deg)',
                    }}
                  />
                  <div className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-zinc-950/90" />
                  </div>
                </>
              )}

              {/* Cover Design: CASSETTE TAPE Dual Reel Windows */}
              {effectiveShape === 'tape' && (
                <div className="absolute inset-x-6 bottom-4 h-12 rounded-xl bg-black/65 backdrop-blur-md flex items-center justify-around px-6 pointer-events-none">
                  <div
                    className={`w-7 h-7 rounded-full bg-white/15 flex items-center justify-center ${
                      isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white/70" />
                  </div>
                  <div className="h-3 flex-1 mx-4 rounded bg-white/10 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(
                          5,
                          Math.min(100, (positionMs / Math.max(1, book.durationMs)) * 100)
                        )}%`,
                        backgroundColor: palette.vibrant,
                      }}
                    />
                  </div>
                  <div
                    className={`w-7 h-7 rounded-full bg-white/15 flex items-center justify-center ${
                      isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white/70" />
                  </div>
                </div>
              )}

              {/* Cover Design: HARDCOVER BOOK Spine Crease & Page Edge Sheen */}
              {effectiveShape === 'hardcover' && (
                <>
                  <div
                    className="absolute inset-y-0 left-0 w-6 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(255,255,255,0.18) 38%, rgba(0,0,0,0.45) 70%, transparent 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-y-1 right-0 w-2 rounded-r pointer-events-none"
                    style={{
                      background:
                        'repeating-linear-gradient(90deg, rgba(255,255,255,0.75) 0px, rgba(220,220,225,0.55) 1px, rgba(255,255,255,0.8) 2px)',
                    }}
                  />
                </>
              )}

              {/* Cover Design: POLAROID Editorial Caption */}
              {effectiveShape === 'polaroid' && (
                <div className="absolute inset-x-4 bottom-2.5 flex items-center justify-between text-[10px] font-mono text-white/75 pointer-events-none">
                  <span className="truncate font-sans font-semibold text-white/90">
                    {book.title}
                  </span>
                  <span className="text-white/45 shrink-0 ml-2">
                    {book.authors[0] || ''}
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-xl flex items-center justify-center text-white">
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current" />
                  ) : (
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Horizontal Visualizer Stage BELOW Cover (hidden smoothly in Slick 'L' Mode) */}
        {isHorizontalVisualizer && (
          <div
            className={`w-full max-w-md flex items-center justify-center pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              largeSlick
                ? 'mt-0 h-0 opacity-0 scale-90 overflow-hidden'
                : 'mt-5 h-20 opacity-100 scale-100'
            }`}
          >
            <AudioVisualizer
              config={vizConfig}
              palette={palette}
              width={440}
              height={80}
              isAroundCover={false}
              className="w-full h-full"
            />
          </div>
        )}
      </div>
    );
  };

  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  // Full-Screen Seekbar Curtain:
  // Left portion of the screen (0% -> bookProgress) has a darker translucent filter,
  // while the right portion (bookProgress -> 100%) is normal. Moves right as the book progresses!
  const showFullScreenCurtain =
    fullScreenSeekbar || progressBarStyle === 'screen-veil';
  const safeDur = Math.max(1, book.durationMs);
  const chStartMs = chapterOnlySeekbar ? currentChapter.startMs : 0;
  const chSpanMs = chapterOnlySeekbar
    ? Math.max(1, currentChapter.endMs - currentChapter.startMs)
    : safeDur;
  const fullScreenProgress = Math.max(
    0,
    Math.min(1, (positionMs - chStartMs) / chSpanMs)
  );

  const handleScreenCurtainScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!screenCurtainRef.current) return;
    const rect = screenCurtainRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(Math.round(chStartMs + ratio * chSpanMs));
  };

  const renderFullScreenSeekbar = () => {
    if (!showFullScreenCurtain) return null;
    const activeRatio =
      screenHoverRatio !== null && progressBarStyle === 'screen-veil'
        ? screenHoverRatio
        : fullScreenProgress;

    return (
      <div
        ref={screenCurtainRef}
        onClick={
          progressBarStyle === 'screen-veil' ? handleScreenCurtainScrub : undefined
        }
        onMouseMove={
          progressBarStyle === 'screen-veil'
            ? (e) => {
                if (!screenCurtainRef.current) return;
                const rect = screenCurtainRef.current.getBoundingClientRect();
                const ratio = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / rect.width)
                );
                setScreenHoverRatio(ratio);
                if (e.buttons === 1) {
                  onSeek(Math.round(chStartMs + ratio * chSpanMs));
                }
              }
            : undefined
        }
        onMouseLeave={() => setScreenHoverRatio(null)}
        className={`fixed inset-0 z-10 overflow-hidden select-none ${
          progressBarStyle === 'screen-veil'
            ? 'cursor-ew-resize pointer-events-auto'
            : 'pointer-events-none'
        }`}
      >
        {/* Darker Translucent Filter covering Played Portion (Left -> Playhead) */}
        <div
          className="absolute top-0 bottom-0 left-0 transition-[width] duration-100 ease-out pointer-events-none"
          style={{
            width: `${fullScreenProgress * 100}%`,
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.46) 92%, rgba(0,0,0,0.55) 100%)',
            backdropFilter: 'brightness(0.62) contrast(1.06)',
          }}
        />

        {/* Luminous Vertical Horizon Seam at Playhead Boundary */}
        <div
          className="absolute top-0 bottom-0 w-[1.5px] transition-[left] duration-100 ease-out pointer-events-none"
          style={{
            left: `${fullScreenProgress * 100}%`,
            background: `linear-gradient(180deg, transparent 0%, ${palette.vibrant}75 20%, ${palette.light}d0 50%, ${palette.vibrant}75 80%, transparent 100%)`,
            boxShadow: `0 0 22px ${palette.vibrant}88`,
          }}
        />

        {/* Subtle Chapter Boundary Micro-Markers Along Top Screen Edge */}
        {book.chapters.length > 1 &&
          book.chapters.slice(1).map((ch, idx) => {
            const r = Math.max(0, Math.min(1, ch.startMs / safeDur));
            return (
              <div
                key={ch.id || idx}
                className="absolute top-0 w-[1.5px] h-2.5 bg-white/25 pointer-events-none"
                style={{ left: `${r * 100}%` }}
              />
            );
          })}

        {/* Hover Preview Line when in Full-Screen Wipe ('screen-veil') mode */}
        {screenHoverRatio !== null && progressBarStyle === 'screen-veil' && (
          <div
            className="absolute top-0 bottom-0 w-[1px] bg-white/40 pointer-events-none"
            style={{ left: `${activeRatio * 100}%` }}
          />
        )}
      </div>
    );
  };

  // Billboard text rows for Minimal Slick 'L' Mode (always mounted so entering/exiting 'L' mode animates smoothly!)
  const billboardPrimary = `${book.title.toUpperCase()}   ·   ${(
    book.authors[0] || 'AUDIOBOOK'
  ).toUpperCase()}   ·   `;
  const billboardSecondary = `${currentChapter.title.toUpperCase()}   —   ${book.title.toUpperCase()}   —   `;
  const speedVal = Math.max(4, slickTextSpeed || 18);
  const row1DurationSec = Math.round(2900 / speedVal);
  const row2DurationSec = Math.round(3600 / speedVal);

  // Seekbar width relative to screen (adjustable via slider in Settings, 30%..100%)
  const clampedSeekbarWidthPct = Math.max(30, Math.min(100, seekbarWidthPct || 88));

  return (
    <div className="relative h-full w-full flex flex-col justify-between px-6 py-5 select-none overflow-hidden">
      <style>{`
        @keyframes floatCover {
          0%, 100% { transform: translateY(0px) rotateX(0deg) rotateY(0deg); }
          50% { transform: translateY(-7px) rotateX(1.5deg) rotateY(-1.5deg); }
        }
      `}</style>

      {/* Full-Screen Darker Translucent Seekbar Curtain */}
      {renderFullScreenSeekbar()}

      {/* Choreographed Huge Bold Translucent Moving Billboard Text for 'L' Mode */}
      <div
        className={`fixed inset-0 z-10 pointer-events-none overflow-hidden flex flex-col justify-center gap-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSlickMode
            ? 'opacity-100 scale-100 blur-0 translate-y-0'
            : 'opacity-0 scale-110 blur-md translate-y-8'
        }`}
      >
        <div
          className="animate-billboard-left"
          style={{ animationDuration: `${row1DurationSec}s` }}
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <span
              key={idx}
              className="font-black uppercase tracking-tighter text-[16vw] sm:text-[19vw] leading-[0.86] text-white/[0.065] whitespace-nowrap pr-14"
            >
              {billboardPrimary}
            </span>
          ))}
        </div>

        <div
          className="animate-billboard-right"
          style={{ animationDuration: `${row2DurationSec}s` }}
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <span
              key={idx}
              className="font-black uppercase tracking-tight text-[11vw] sm:text-[13vw] leading-[0.88] text-white/[0.035] whitespace-nowrap pr-14"
              style={{ color: `${palette.light}0c` }}
            >
              {billboardSecondary}
            </span>
          ))}
        </div>
      </div>

      {/* Fully Hidden Exit Pill in Top-Right when in Slick Mode ('L'), slightly shown only on hover in corner area */}
      {onToggleSlickMode && (
        <div
          className={`fixed top-0 right-0 w-28 h-20 z-40 flex items-start justify-end p-5 group ${
            isSlickMode ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <button
            onClick={onToggleSlickMode}
            className={`px-3 py-1.5 ${pillRadius} bg-white/[0.04] hover:bg-white/[0.1] text-[11px] font-mono text-white/70 transition-all duration-300 ${
              isSlickMode
                ? 'opacity-0 group-hover:opacity-35 hover:!opacity-60 scale-100 translate-y-0'
                : 'opacity-0 scale-75 -translate-y-3 pointer-events-none'
            }`}
            title="Exit Slick Mode (L)"
          >
            L
          </button>
        </div>
      )}

      {/* Mode 2: Full-Bleed Cover Background */}
      {viewMode === 'full-cover' && !isSlickMode && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src={book.cover}
            alt=""
            className="w-full h-full object-cover opacity-50 scale-105 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/25" />
        </div>
      )}

      {/* Top Bar: Smoothly glides out when entering 'L' Mode; 3-dots hidden unless hovered or expanded */}
      <div
        className={`relative z-30 flex items-center justify-end transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSlickMode
            ? 'opacity-0 -translate-y-6 scale-95 pointer-events-none h-0 overflow-hidden'
            : 'mt-5 opacity-100 translate-y-0 scale-100'
        }`}
      >
        <div className="relative group/dots p-3 -m-3">
          <button
            onClick={() => setShowTopRightMenu((s) => !s)}
            className={`p-2.5 ${pillRadius} backdrop-blur-2xl bg-white/[0.07] hover:bg-white/[0.14] text-white/80 hover:text-white transition-all duration-300 ${
              showTopRightMenu
                ? 'opacity-100'
                : 'opacity-0 group-hover/dots:opacity-100 hover:!opacity-100'
            }`}
            title="Player Menu & Equalizer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Unified Top-Right Frosted Dropdown Menu */}
          {showTopRightMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute right-0 mt-2 w-76 p-4 ${
                squareCorners ? 'rounded-none' : 'rounded-2xl'
              } backdrop-blur-3xl bg-zinc-950/85 shadow-[0_24px_80px_rgba(0,0,0,0.85)] space-y-4 text-xs z-50 animate-enter max-h-[82vh] overflow-y-auto`}
            >
              {/* Equalizer Button */}
              <button
                onClick={() => {
                  setShowEqDrawer((s) => !s);
                  setShowTopRightMenu(false);
                }}
                className={`w-full px-3.5 py-2.5 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center justify-between transition-all`}
              >
                <span className="flex items-center gap-2">
                  <Sliders
                    className="w-4 h-4"
                    style={{ color: palette.vibrant }}
                  />
                  <span>Equalizer & DSP</span>
                </span>
                <span className="text-[11px] font-mono text-white/45">
                  {voiceBoost ? 'Voice+' : '10-Band'}
                </span>
              </button>

              {/* View Mode Switcher */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-1">
                  Stage
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'focus', label: 'Focus' },
                      { id: 'visualizer', label: 'Visualizer' },
                      { id: 'chapters', label: 'Chapters' },
                      { id: 'full-cover', label: 'Full Cover' },
                    ] as { id: PlayerViewMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onChangeViewMode(m.id);
                      }}
                      className={`px-3 py-2 ${pillRadius} text-left transition-all flex items-center justify-between ${
                        viewMode === m.id
                          ? 'bg-white/20 text-white font-medium'
                          : 'bg-white/[0.04] text-white/60 hover:text-white'
                      }`}
                    >
                      <span>{m.label}</span>
                      {viewMode === m.id && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Frame Design Selector */}
              {onChangeCoverShape && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-1">
                    Cover Design
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'rounded', label: 'Rounded' },
                        { id: 'vinyl', label: 'Vinyl LP' },
                        { id: 'cd-jewel', label: 'CD Disc' },
                        { id: 'hardcover', label: 'Hardcover' },
                        { id: 'floating-glass', label: 'Glass Frame' },
                        { id: 'polaroid', label: 'Editorial' },
                        { id: 'tape', label: 'Cassette' },
                        { id: 'octagon', label: 'Octagon' },
                        { id: 'circle', label: 'Circle' },
                      ] as { id: CoverShape; label: string }[]
                    ).map((cs) => (
                      <button
                        key={cs.id}
                        onClick={() => onChangeCoverShape(cs.id)}
                        className={`px-2 py-1.5 ${pillRadius} text-[11px] font-mono truncate transition-all ${
                          coverShape === cs.id
                            ? 'bg-white/20 text-white font-medium'
                            : 'bg-white/[0.04] text-white/60 hover:text-white'
                        }`}
                      >
                        {cs.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Visualizer Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                    Visualizer
                  </span>
                  {isOrbVisualizer && (
                    <button
                      onClick={() => setForceCoverInOrbMode((f) => !f)}
                      className="text-[10px] font-mono text-white/60 hover:text-white"
                    >
                      {forceCoverInOrbMode ? 'Show Orb' : 'Show Cover'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'chatgpt-orb', label: 'Orb' },
                      { id: 'chatgpt-dots', label: 'Dots' },
                      { id: 'fluid-wave', label: 'Silk' },
                      { id: 'bars', label: 'Bars' },
                      { id: 'mirrored-bars', label: 'Mirror' },
                      { id: 'cover-outline', label: 'Outline' },
                      { id: 'halo', label: 'Halo' },
                      { id: 'aurora-ribbons', label: 'Ribbon' },
                      { id: 'oscilloscope', label: 'Scope' },
                      { id: 'none', label: 'Off' },
                    ] as { id: VizType; label: string }[]
                  ).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        if (onChangeVizType) onChangeVizType(v.id);
                        else onCycleVisualizer();
                      }}
                      className={`px-2.5 py-1.5 ${pillRadius} text-[11px] font-mono transition-all ${
                        vizConfig.type === v.id
                          ? 'text-black font-medium'
                          : 'bg-white/[0.04] text-white/60 hover:text-white'
                      }`}
                      style={
                        vizConfig.type === v.id
                          ? { backgroundColor: palette.vibrant }
                          : undefined
                      }
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seekbar Style Selector */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-1">
                  Seekbar Style
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'simple', label: 'Simple (Flat)' },
                      { id: 'simple-chapter', label: 'Simple Chapter Split' },
                      { id: 'screen-veil', label: 'Full-Screen Wipe' },
                      { id: 'wave', label: 'Neon Soundwave' },
                      { id: 'chaptered', label: 'Glass Chapters' },
                      { id: 'line', label: 'Laser Horizon' },
                      { id: 'stepped', label: 'Stepped Blocks' },
                      { id: 'minimal-ticks', label: 'Ruler Ticks' },
                      { id: 'dual', label: 'Dual Macro' },
                      { id: 'dots', label: 'LED Matrix' },
                    ] as { id: ProgressBarStyle; label: string }[]
                  ).map((sb) => (
                    <button
                      key={sb.id}
                      onClick={() => {
                        if (onChangeProgressBarStyle) onChangeProgressBarStyle(sb.id);
                        else onCycleProgressBarStyle();
                      }}
                      className={`px-3 py-1.5 ${pillRadius} text-[11px] font-mono text-left truncate transition-all ${
                        progressBarStyle === sb.id
                          ? 'bg-white/20 text-white font-medium'
                          : 'bg-white/[0.04] text-white/60 hover:text-white'
                      }`}
                    >
                      {sb.label}
                    </button>
                  ))}
                </div>

                {onToggleChapterOnlySeekbar && (
                  <button
                    onClick={onToggleChapterOnlySeekbar}
                    className={`w-full mt-1.5 px-3 py-2 ${pillRadius} text-[11px] font-mono flex items-center justify-between transition-all ${
                      chapterOnlySeekbar
                        ? 'bg-white/20 text-white font-medium'
                        : 'bg-white/[0.04] text-white/60 hover:text-white'
                    }`}
                  >
                    <span>Show Current Chapter Only on Bar</span>
                    <span className="text-[10px] opacity-75">
                      {chapterOnlySeekbar ? 'ON' : 'OFF'}
                    </span>
                  </button>
                )}
              </div>

              {/* Playback Speed */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] px-1">
                  <span className="font-mono uppercase text-white/40">Speed</span>
                  <span className="font-mono text-white">{speed.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={3.5}
                  step={0.05}
                  value={speed}
                  onChange={(e) => onChangeSpeed(Number(e.target.value))}
                  className="w-full"
                />
                <div className="grid grid-cols-5 gap-1">
                  {[0.8, 1.0, 1.25, 1.5, 2.0].map((s) => (
                    <button
                      key={s}
                      onClick={() => onChangeSpeed(s)}
                      className={`py-1 ${pillRadius} font-mono text-[11px] ${
                        Math.abs(speed - s) < 0.01
                          ? 'bg-white/20 text-white'
                          : 'bg-white/[0.04] text-white/50 hover:text-white'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>

              {/* Sleep Timer */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-1">
                  Sleep Timer
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {(
                    [
                      { label: 'Off', val: null },
                      { label: '15m', val: 15 },
                      { label: '30m', val: 30 },
                      { label: '60m', val: 60 },
                      { label: 'Ch', val: 'chapter' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.label)}
                      onClick={() => onSetSleepTimer(opt.val)}
                      className={`py-1.5 ${pillRadius} font-mono text-[11px] ${
                        sleepTimerMin === opt.val
                          ? 'bg-white/20 text-white'
                          : 'bg-white/[0.04] text-white/50 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* A-B Segment Loop */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                    A–B Segment Loop
                  </span>
                  {(abStartMs !== null || abEndMs !== null) && (
                    <button
                      onClick={() => {
                        setAbStartMs(null);
                        setAbEndMs(null);
                        audioEngine.setAbLoop(null, null);
                      }}
                      className="text-[10px] font-mono text-rose-400 hover:text-rose-300"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      const trackMs = Math.max(
                        0,
                        positionMs - currentChapter.startMs
                      );
                      setAbStartMs(trackMs);
                      audioEngine.setAbLoop(trackMs, abEndMs);
                    }}
                    className={`py-1.5 px-2.5 ${pillRadius} font-mono text-[11px] flex items-center justify-between ${
                      abStartMs !== null
                        ? 'bg-white/20 text-white'
                        : 'bg-white/[0.04] text-white/55 hover:text-white'
                    }`}
                  >
                    <span>A</span>
                    <span>
                      {abStartMs !== null
                        ? formatDurationNumeric(abStartMs)
                        : 'Set'}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      const trackMs = Math.max(
                        0,
                        positionMs - currentChapter.startMs
                      );
                      setAbEndMs(trackMs);
                      audioEngine.setAbLoop(abStartMs ?? 0, trackMs);
                    }}
                    className={`py-1.5 px-2.5 ${pillRadius} font-mono text-[11px] flex items-center justify-between ${
                      abEndMs !== null
                        ? 'bg-white/20 text-white'
                        : 'bg-white/[0.04] text-white/55 hover:text-white'
                    }`}
                  >
                    <span>B</span>
                    <span>
                      {abEndMs !== null
                        ? formatDurationNumeric(abEndMs)
                        : 'Set'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Actions Row */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={async () => {
                    const active = await audioEngine.toggleMicrophone();
                    setMicActive(active);
                  }}
                  className={`px-3 py-2 ${pillRadius} flex items-center gap-2 ${
                    micActive
                      ? 'bg-rose-500/25 text-rose-200'
                      : 'bg-white/[0.04] text-white/70 hover:text-white'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{micActive ? 'Mic Live' : 'Mic Input'}</span>
                </button>

                <button
                  onClick={() => {
                    onAddBookmark();
                    setShowTopRightMenu(false);
                  }}
                  className={`px-3 py-2 ${pillRadius} bg-white/[0.04] text-white/70 hover:text-white flex items-center gap-2`}
                >
                  <BookmarkIcon className="w-3.5 h-3.5" />
                  <span>Bookmark</span>
                </button>

                <button
                  onClick={onToggleChapterLoop}
                  className={`px-3 py-2 ${pillRadius} flex items-center gap-2 ${
                    chapterLoop
                      ? 'bg-white/20 text-white'
                      : 'bg-white/[0.04] text-white/70 hover:text-white'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Loop Ch</span>
                </button>

                <button
                  onClick={() => {
                    onOpenTranscript();
                    setShowTopRightMenu(false);
                  }}
                  className={`px-3 py-2 ${pillRadius} bg-white/[0.04] text-white/70 hover:text-white flex items-center gap-2`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Transcript</span>
                </button>

                <button
                  onClick={() => {
                    onOpenMetadataEditor();
                    setShowTopRightMenu(false);
                  }}
                  className={`px-3 py-2 ${pillRadius} bg-white/[0.04] text-white/70 hover:text-white flex items-center gap-2`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Info</span>
                </button>

                <button
                  onClick={() => {
                    onToggleImmersive();
                    setShowTopRightMenu(false);
                  }}
                  className={`px-3 py-2 ${pillRadius} bg-white/[0.04] text-white/70 hover:text-white flex items-center gap-2`}
                >
                  {isImmersive ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isImmersive ? 'Exit Zen' : 'Zen Mode'}</span>
                </button>

                {onToggleSlickMode && (
                  <button
                    onClick={() => {
                      onToggleSlickMode();
                      setShowTopRightMenu(false);
                    }}
                    className={`col-span-2 px-3 py-2 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-between`}
                  >
                    <span className="flex items-center gap-2">
                      <Maximize2
                        className="w-3.5 h-3.5"
                        style={{ color: palette.vibrant }}
                      />
                      <span>Minimal Slick Billboard Mode</span>
                    </span>
                    <span className="font-mono text-[10px] text-white/50">L</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Equalizer Popover Drawer */}
      {showEqDrawer && (
        <EqualizerPanel
          bands={eqBands}
          preampDb={preampDb}
          voiceBoost={voiceBoost}
          skipSilence={skipSilence}
          normalizeLoudness={normalizeLoudness}
          palette={palette}
          outputDevice={outputDevice}
          onChangeBands={onChangeEq}
          onToggleVoiceBoost={onToggleVoiceBoost}
          onToggleSkipSilence={onToggleSkipSilence}
          onToggleNormalize={onToggleNormalize}
          onChangeDevice={onChangeOutputDevice}
          onClose={() => setShowEqDrawer(false)}
          squareCorners={squareCorners}
        />
      )}

      {/* Center Stage: Smoothly morphs into enlarged Slick 'L' Mode stage */}
      <div
        className={`relative z-20 flex-1 flex flex-col items-center justify-center min-h-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSlickMode ? 'my-4 translate-y-2' : 'my-1 translate-y-0'
        }`}
      >
        {(viewMode === 'focus' || isSlickMode) &&
          renderCoverArt(isSlickMode, isSlickMode)}

        {!isSlickMode && viewMode === 'full-cover' && <div className="h-32" />}

        {/* Vertical List for Up-Next Books */}
        {!isSlickMode && viewMode === 'up-next' && (
          <div className="w-full max-w-md max-h-[340px] overflow-y-auto space-y-2 p-3 rounded-2xl backdrop-blur-2xl bg-white/[0.04]">
            {queue.length > 0 ? (
              queue.map((item) => {
                const qBook = books.find((b) => b.id === item.bookId) || book;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectBook(qBook)}
                    className={`w-full flex items-center gap-3.5 p-2.5 ${pillRadius} bg-white/[0.04] hover:bg-white/[0.1] text-left transition-all`}
                  >
                    <img
                      src={qBook.cover}
                      alt=""
                      className={`w-10 h-10 ${pillRadius} object-cover shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-white truncate">
                        {qBook.title}
                      </div>
                      <div className="text-[11px] font-mono text-white/45">
                        {qBook.chapters.length} ch ·{' '}
                        {formatDurationNumeric(qBook.durationMs)}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-10 text-center text-xs font-mono text-white/35">
                Queue empty
              </div>
            )}
          </div>
        )}

        {/* Vertical Chapter List */}
        {!isSlickMode && viewMode === 'chapters' && (
          <div className="w-full max-w-md max-h-[340px] overflow-y-auto space-y-1.5 p-3 rounded-2xl backdrop-blur-2xl bg-white/[0.04]">
            {book.chapters.map((ch, idx) => {
              const active = idx === currentChapterIndex;
              return (
                <button
                  key={ch.id}
                  onClick={() => onSeek(ch.startMs)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 ${pillRadius} text-xs transition-all ${
                    active
                      ? 'bg-white/15 text-white font-medium'
                      : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="font-mono text-[11px] opacity-40 w-5">
                      {idx + 1}
                    </span>
                    <span className="truncate">{ch.title}</span>
                  </div>
                  <span className="font-mono text-[11px] opacity-55 ml-3 shrink-0">
                    {formatDurationNumeric(ch.endMs - ch.startMs)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Full-Stage Visualizer Mode */}
        {!isSlickMode && viewMode === 'visualizer' && (
          <div
            onClick={onCycleVisualizer}
            className="w-full max-w-2xl h-72 sm:h-88 flex items-center justify-center cursor-pointer"
          >
            <AudioVisualizer
              config={vizConfig}
              palette={palette}
              width={640}
              height={340}
              isAroundCover={false}
              className="w-full h-full"
            />
          </div>
        )}
      </div>

      {/* Bottom Transport & Seekbar Stage (Seekbar Width controlled by seekbarWidthPct relative to screen!) */}
      <div
        className={`relative z-20 mx-auto transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isSlickMode ? 'pb-6 -translate-y-4' : 'pb-0 translate-y-0'
        }`}
        style={{
          width: `${clampedSeekbarWidthPct}%`,
          maxWidth: isSlickMode ? '1100px' : '960px',
        }}
      >
        {/* Strict 1-Line Text Budget: Chapter Title — Time Remaining (glides out in 'L' mode) */}
        <div
          className={`flex items-center justify-between text-xs px-1 gap-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isSlickMode
              ? 'opacity-0 translate-y-4 max-h-0 overflow-hidden pointer-events-none mb-0'
              : 'opacity-100 translate-y-0 max-h-10 mb-2'
          }`}
        >
          <span className="font-medium text-white/90 truncate">
            <ReactBitsDecryptedText text={currentChapter.title} speed={22} />
          </span>
          <button
            onClick={onCycleTimeMode}
            className="font-mono tabular-nums text-white/55 hover:text-white transition-colors shrink-0"
          >
            {timeString}
          </button>
        </div>

        {/* Scrubber (Width follows seekbarWidthPct%) */}
        <div className="w-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <ProgressBar
            style={progressBarStyle}
            positionMs={positionMs}
            durationMs={book.durationMs}
            chapters={book.chapters}
            currentChapter={currentChapter}
            bookmarks={bookBookmarks}
            peaks={book.peaks}
            palette={palette}
            speed={speed}
            onSeek={onSeek}
            onCycleStyle={onCycleProgressBarStyle}
            large={isSlickMode}
            chapterOnly={chapterOnlySeekbar}
          />
        </div>

        {/* Transport Controls + Volume + Equalizer Quick Button (glides out in 'L' mode) */}
        <div
          className={`flex items-center justify-between max-w-xl mx-auto transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isSlickMode
              ? 'opacity-0 translate-y-8 scale-95 max-h-0 overflow-hidden pointer-events-none pt-0'
              : 'opacity-100 translate-y-0 scale-100 max-h-24 pt-2'
          }`}
        >
          {/* Volume */}
          <div className="flex items-center gap-2 w-28">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-full text-white/50 hover:text-white transition-colors"
            >
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => onChangeVolume(Number(e.target.value))}
              className="w-16 opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Center Transport */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onPrevChapter}
              className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Previous Chapter (Shift + ←)"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => onSkipSeconds(-15)}
              className="p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Back 15s (← or J)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              className={`w-13 h-13 ${
                squareCorners ? 'rounded-none' : 'rounded-full'
              } flex items-center justify-center text-black shadow-xl transition-transform active:scale-90 hover:scale-105`}
              style={{
                backgroundColor: palette.vibrant,
                boxShadow: `0 10px 32px -4px ${palette.vibrant}65`,
              }}
              title="Play / Pause (Space)"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => onSkipSeconds(30)}
              className="p-2.5 rounded-full text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Forward 30s (→)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={onNextChapter}
              className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Next Chapter (Shift + →)"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Equalizer Quick Toggle */}
          <div className="flex items-center justify-end w-28">
            <button
              onClick={() => setShowEqDrawer((s) => !s)}
              className={`p-2 rounded-full transition-colors ${
                showEqDrawer || voiceBoost
                  ? 'text-white bg-white/15'
                  : 'text-white/45 hover:text-white'
              }`}
              title="Equalizer"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
