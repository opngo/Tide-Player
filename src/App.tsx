import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Waves,
  Grid,
  Layers,
  Search,
  ArrowDownToLine,
  Sliders,
  Play,
  Pause,
  User,
  Tag,
  Folder,
  Maximize2,
  Edit3,
  Plus,
  FolderPlus,
  Folders,
  Headphones,
  Pin,
  Activity,
} from 'lucide-react';
import {
  Book,
  Progress,
  Bookmark,
  QueueItem,
  Playlist,
  SidebarCustomItem,
  BgConfig,
  BgType,
  VizConfig,
  VizType,
  ProgressBarStyle,
  TimeDisplayMode,
  CoverShape,
  ThemeMode,
  ColorScheme,
  FontChoice,
  PlayerViewMode,
  NavigationTab,
  AudioBookBayResult,
  TorrentTransfer,
  QbittorrentConfig,
  EqualizerBand,
  ScenePreset,
  TranscriptSegment,
  Palette,
  ListeningDayRecord,
} from './types';
import {
  DEFAULT_PALETTE,
  CURATED_PALETTES,
  DEFAULT_EQ_BANDS,
  SCENE_PRESETS,
  generateCoverSvg,
  generatePeaks,
  fetchRealLibriVoxAudiobook,
  extractPaletteFromImage,
} from './data/mockData';
import { audioEngine } from './services/audioEngine';
import { DynamicBackground } from './components/DynamicBackground';
import { PlayerView } from './components/PlayerView';
import { LibraryView } from './components/LibraryView';
import { QueueView } from './components/QueueView';
import { AudioBookBayView } from './components/AudioBookBayView';
import { DownloadsView } from './components/DownloadsView';
import { StatsView } from './components/StatsView';
import { CustomizeView, CustomThemePreset } from './components/CustomizeView';
import { MetadataEditorModal } from './components/MetadataEditorModal';
import { TranscriptModal } from './components/TranscriptModal';
import { LandingPage } from './components/LandingPage';
import {
  formatDurationNumeric,
  findActiveChapterIndex,
} from './components/ProgressBar';
import { ReactBitsClickSpark } from './components/ReactBitsComponents';
import { ElectronTitleBar } from './components/ElectronTitleBar';
import {
  registerMediaSessionHandlers,
  syncFluentFlyoutMediaSession,
} from './services/mediaSession';

const ALL_BG_TYPES: BgType[] = [
  'aurora',
  'mesh',
  'silk',
  'dither',
  'crt-warp',
  'balatro',
  'iridescence',
  'ripple',
  'particles',
  'blurred-cover',
  'solid',
  'oled',
];

const ALL_VIZ_TYPES: VizType[] = [
  'chatgpt-orb',
  'chatgpt-dots',
  'fluid-wave',
  'cover-outline',
  'halo',
  'bars',
  'mirrored-bars',
  'aurora-ribbons',
  'oscilloscope',
  'constellation',
  'dots',
  'breath',
  'none',
];

const ALL_PROGRESS_STYLES: ProgressBarStyle[] = [
  'simple',
  'simple-chapter',
  'screen-veil',
  'wave',
  'chaptered',
  'line',
  'stepped',
  'minimal-ticks',
  'dual',
  'dots',
];

const ALL_TIME_MODES: TimeDisplayMode[] = [
  'remaining',
  'elapsed',
  'chapter-remaining',
  'finish-clock',
];

const LOCAL_WOTW_CH1 =
  '/api/fs/stream?path=' +
  encodeURIComponent('/home/user/Audiobooks/The War of the Worlds/01 - The Eve of the War.mp3');
const LOCAL_WOTW_CH2 =
  '/api/fs/stream?path=' +
  encodeURIComponent('/home/user/Audiobooks/The War of the Worlds/02 - The Falling Star.mp3');

const EMPTY_BOOK_FALLBACK: Book = {
  id: 'local-war-of-the-worlds',
  title: 'The War of the Worlds',
  authors: ['H. G. Wells'],
  narrators: ['LibriVox Cast'],
  tags: ['Sci-Fi', 'Local'],
  genres: ['Science Fiction'],
  folderPath: '/home/user/Audiobooks/The War of the Worlds',
  importMode: 'single-book',
  cover: generateCoverSvg('The War of the Worlds', 'H. G. Wells', DEFAULT_PALETTE, 'orbit'),
  palette: DEFAULT_PALETTE,
  files: [
    {
      path: '/home/user/Audiobooks/The War of the Worlds/01 - The Eve of the War.mp3',
      name: '01 - The Eve of the War.mp3',
      format: 'MP3',
      sizeBytes: 6398229,
      durationMs: 799000,
      bitrateKbps: 64,
      objectUrl: LOCAL_WOTW_CH1,
    },
    {
      path: '/home/user/Audiobooks/The War of the Worlds/02 - The Falling Star.mp3',
      name: '02 - The Falling Star.mp3',
      format: 'MP3',
      sizeBytes: 3918653,
      durationMs: 489000,
      bitrateKbps: 64,
      objectUrl: LOCAL_WOTW_CH2,
    },
  ],
  chapters: [
    {
      id: 'local-wotw-ch-1',
      title: '01 - The Eve of the War',
      startMs: 0,
      endMs: 799000,
      streamUrl: LOCAL_WOTW_CH1,
    },
    {
      id: 'local-wotw-ch-2',
      title: '02 - The Falling Star',
      startMs: 799000,
      endMs: 1288000,
      streamUrl: LOCAL_WOTW_CH2,
    },
  ],
  peaks: generatePeaks(42),
  durationMs: 1288000,
  addedAt: Date.now(),
};

export const App: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([EMPTY_BOOK_FALLBACK]);
  const [currentBookId, setCurrentBookId] = useState<string>(EMPTY_BOOK_FALLBACK.id);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>({});
  const [listeningHistory, setListeningHistory] = useState<
    Record<string, ListeningDayRecord>
  >({});
  const [hydratedFromTideJson, setHydratedFromTideJson] = useState<boolean>(false);

  // Navigation & Auto-Hiding Frosted Icon-Only Sidebar State
  const [activeTab, setActiveTab] = useState<NavigationTab>('landing');
  const [shellMode, setShellMode] = useState<'sidebar' | 'dock'>('sidebar');
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(false);
  const [sidebarPinned, setSidebarPinned] = useState<boolean>(false);
  const [sidebarFrosted, setSidebarFrosted] = useState<boolean>(true);
  const [showAddPopover, setShowAddPopover] = useState<boolean>(false);
  const [addingKind, setAddingKind] = useState<
    'author' | 'folder-path' | 'playlist' | 'tag' | null
  >(null);
  const [addingInput, setAddingInput] = useState<string>('');
  const [externalScannerMode, setExternalScannerMode] = useState<
    'auto-root' | 'single-book' | null
  >(null);

  const [sidebarItems, setSidebarItems] = useState<SidebarCustomItem[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<{
    type: string;
    value: string;
  } | null>(null);

  const [playerViewMode, setPlayerViewMode] = useState<PlayerViewMode>('focus');
  const [isImmersive, setIsImmersive] = useState<boolean>(false);
  const [isSlickMode, setIsSlickMode] = useState<boolean>(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState<boolean>(false);
  const [clickSparkEnabled, setClickSparkEnabled] = useState<boolean>(true);

  // Look, Background, Visualizer & Theme Override State
  const [bgConfig, setBgConfig] = useState<BgConfig>(SCENE_PRESETS[0].bg);
  const [vizConfig, setVizConfig] = useState<VizConfig>(SCENE_PRESETS[0].viz);
  const [progressBarStyle, setProgressBarStyle] =
    useState<ProgressBarStyle>('wave');
  const [timeMode, setTimeMode] = useState<TimeDisplayMode>('elapsed');
  const [coverShape, setCoverShape] = useState<CoverShape>('circle');
  const [themeMode, setThemeMode] = useState<ThemeMode>('vivid');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('dark');
  const [squareCorners, setSquareCorners] = useState<boolean>(false);
  const [lockTheme, setLockTheme] = useState<boolean>(false);
  const [lockedPalette, setLockedPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [customThemes, setCustomThemes] = useState<CustomThemePreset[]>([]);
  const [fontFamily, setFontFamily] = useState<FontChoice>('geist');

  // Audio DSP & Playback Controls
  const [volume, setVolume] = useState<number>(0.8);
  const [muted, setMuted] = useState<boolean>(false);
  const [eqBands, setEqBands] = useState<EqualizerBand[]>(DEFAULT_EQ_BANDS);
  const [preampDb, setPreampDb] = useState<number>(0);
  const [voiceBoost, setVoiceBoost] = useState<boolean>(false);
  const [skipSilence, setSkipSilence] = useState<boolean>(false);
  const [normalizeLoudness, setNormalizeLoudness] = useState<boolean>(true);
  const [outputDevice, setOutputDevice] = useState<string>('Default');
  const [sleepTimerMin, setSleepTimerMin] = useState<
    number | 'chapter' | 'book' | null
  >(null);
  const [chapterLoop, setChapterLoop] = useState<boolean>(false);
  const [watchedRoots, setWatchedRoots] = useState<string[]>([
    '/home/user/Audiobooks',
  ]);

  // Bookmarks, Queue (Grouped by Book) & Playlists
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [removedQueueHistory, setRemovedQueueHistory] = useState<QueueItem[][]>(
    []
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [autoAdvance, setAutoAdvance] = useState<
    'next-queue' | 'next-series' | 'stop' | 'repeat-book' | 'shuffle'
  >('next-queue');

  // Local Search History
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tide_abb_search_history_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // qBittorrent Web API Config
  const [qbitConfig, setQbitConfig] = useState<QbittorrentConfig>(() => {
    try {
      const saved = localStorage.getItem('tide_qbit_config');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      url: 'http://127.0.0.1:8080',
      username: 'admin',
      password: '',
      category: 'audiobooks',
      savePath: '/Media/Audiobooks',
      abbMirror: 'https://audiobookbay.lu',
      sequentialByDefault: true,
      firstLastPiecePrio: true,
      connected: false,
    };
  });

  const [transfers, setTransfers] = useState<TorrentTransfer[]>([]);

  const [editingBook, setEditingBook] = useState<{
    book: Book;
    tab?: 'core' | 'chapters' | 'cover';
  } | null>(null);
  const [transcriptBook, setTranscriptBook] = useState<Book | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastText(msg);
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(null), 2400);
    return () => clearTimeout(t);
  }, [toastText]);

  const handleLoadRealLibriVox = useCallback(
    async (identifier: string) => {
      try {
        const realBook = await fetchRealLibriVoxAudiobook(identifier);
        setBooks((prev) => {
          const exists = prev.some((b) => b.id === realBook.id);
          return exists ? prev : [realBook, ...prev];
        });
        setCurrentBookId(realBook.id);
      } catch {
        // silent fallback if offline
      }
    },
    []
  );

  // 1. Load Persistent Library & Settings from ~/.tide/all.json on every startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('/api/library');
        const json = await resp.json();
        if (mounted && json.exists && json.data) {
          const d = json.data;
          if (Array.isArray(d.books) && d.books.length > 0) {
            const validBooks = d.books.filter(
              (b: Book) => b.id !== 'librivox-art_of_war_librivox'
            );
            const finalBooks =
              validBooks.length > 0 ? validBooks : [EMPTY_BOOK_FALLBACK];
            setBooks(finalBooks);
            const validCur = finalBooks.some((b: Book) => b.id === d.currentBookId)
              ? d.currentBookId
              : finalBooks[0].id;
            setCurrentBookId(validCur);
          } else {
            setBooks([EMPTY_BOOK_FALLBACK]);
            setCurrentBookId(EMPTY_BOOK_FALLBACK.id);
          }
          if (d.progressMap) setProgressMap(d.progressMap);
          if (d.listeningHistory) setListeningHistory(d.listeningHistory);
          if (Array.isArray(d.watchedRoots) && d.watchedRoots.length > 0) {
            setWatchedRoots(d.watchedRoots);
          }
          if (Array.isArray(d.queue)) setQueue(d.queue);
          if (Array.isArray(d.playlists)) setPlaylists(d.playlists);
          if (Array.isArray(d.sidebarItems)) setSidebarItems(d.sidebarItems);
          if (Array.isArray(d.bookmarks)) setBookmarks(d.bookmarks);
          if (typeof d.sidebarFrosted === 'boolean')
            setSidebarFrosted(d.sidebarFrosted);
          if (typeof d.clickSparkEnabled === 'boolean')
            setClickSparkEnabled(d.clickSparkEnabled);
          if (typeof d.lockTheme === 'boolean') setLockTheme(d.lockTheme);
          if (d.lockedPalette) setLockedPalette(d.lockedPalette);
          if (Array.isArray(d.customThemes)) setCustomThemes(d.customThemes);
          if (d.bgConfig) setBgConfig(d.bgConfig);
          if (d.vizConfig) setVizConfig(d.vizConfig);
          if (d.progressBarStyle) setProgressBarStyle(d.progressBarStyle);
        } else if (mounted) {
          setBooks([EMPTY_BOOK_FALLBACK]);
          setCurrentBookId(EMPTY_BOOK_FALLBACK.id);
        }
      } catch {
        if (mounted) {
          setBooks([EMPTY_BOOK_FALLBACK]);
          setCurrentBookId(EMPTY_BOOK_FALLBACK.id);
        }
      } finally {
        if (mounted) setHydratedFromTideJson(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [handleLoadRealLibriVox]);

  const progressMapRef = useRef(progressMap);
  progressMapRef.current = progressMap;
  const listeningHistoryRef = useRef(listeningHistory);
  listeningHistoryRef.current = listeningHistory;

  // Real-time 1-second listening tracker when audio is actively playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const hr = now.getHours();

      setListeningHistory((prev) => {
        const cur = prev[dateKey] || {
          date: dateKey,
          seconds: 0,
          bookIds: [],
          hourlySeconds: new Array(24).fill(0),
        };
        const nextHourly =
          cur.hourlySeconds && cur.hourlySeconds.length === 24
            ? [...cur.hourlySeconds]
            : new Array(24).fill(0);
        nextHourly[hr] = (nextHourly[hr] || 0) + 1;
        const nextBookIds = cur.bookIds.includes(currentBookId)
          ? cur.bookIds
          : [...cur.bookIds, currentBookId];
        return {
          ...prev,
          [dateKey]: {
            date: dateKey,
            seconds: cur.seconds + 1,
            bookIds: nextBookIds,
            hourlySeconds: nextHourly,
          },
        };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, currentBookId]);

  // 2. Automatically save book locations, progress, queue, and themes to ~/.tide/all.json
  useEffect(() => {
    if (!hydratedFromTideJson) return;
    const timer = window.setTimeout(() => {
      fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          books,
          watchedRoots,
          currentBookId,
          progressMap: progressMapRef.current,
          listeningHistory: listeningHistoryRef.current,
          queue,
          playlists,
          sidebarItems,
          bookmarks,
          sidebarFrosted,
          clickSparkEnabled,
          lockTheme,
          lockedPalette,
          customThemes,
          bgConfig,
          vizConfig,
          progressBarStyle,
        }),
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [
    hydratedFromTideJson,
    books,
    watchedRoots,
    currentBookId,
    isPlaying,
    queue,
    playlists,
    sidebarItems,
    bookmarks,
    sidebarFrosted,
    clickSparkEnabled,
    lockTheme,
    lockedPalette,
    customThemes,
    bgConfig,
    vizConfig,
    progressBarStyle,
  ]);

  // Periodic checkpoint of playback position to ~/.tide/all.json while playing
  useEffect(() => {
    if (!hydratedFromTideJson || !isPlaying) return;
    const id = window.setInterval(() => {
      fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          books,
          watchedRoots,
          currentBookId,
          progressMap: progressMapRef.current,
          listeningHistory: listeningHistoryRef.current,
        }),
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [hydratedFromTideJson, isPlaying, books, watchedRoots, currentBookId]);

  // Settings index handlers for ~/.tide/all.json
  const handleForceIndex = useCallback(
    async (customRootPath?: string) => {
      try {
        const resp = await fetch('/api/library/force-index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            customRootPath ? { rootPath: customRootPath } : {}
          ),
        });
        const json = await resp.json();
        if (json.ok && json.data) {
          if (Array.isArray(json.data.books) && json.data.books.length > 0) {
            setBooks(json.data.books);
          }
          if (Array.isArray(json.data.watchedRoots)) {
            setWatchedRoots(json.data.watchedRoots);
          }
          showToast(
            `Indexed ${json.stats?.total || json.data.books?.length || 0} books → ~/.tide/all.json (+${json.stats?.added || 0} new)`
          );
          return json.stats;
        }
      } catch {
        showToast('Index scan failed');
      }
      return undefined;
    },
    [showToast]
  );

  const handleRepairLibrary = useCallback(async () => {
    try {
      const resp = await fetch('/api/library/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await resp.json();
      if (json.ok && json.data) {
        if (Array.isArray(json.data.books) && json.data.books.length > 0) {
          setBooks(json.data.books);
          if (
            !json.data.books.some((b: Book) => b.id === currentBookId) &&
            json.data.books[0]
          ) {
            setCurrentBookId(json.data.books[0].id);
          }
        }
        showToast(
          `Repaired ${json.stats?.repaired || 0} · Relocated ${json.stats?.relocated || 0} · Pruned ${json.stats?.removedDead || 0}`
        );
        return json.stats;
      }
    } catch {
      showToast('Library repair failed');
    }
    return undefined;
  }, [currentBookId, showToast]);

  const handleResetLibrary = useCallback(async () => {
    try {
      const resp = await fetch('/api/library/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchedRoots }),
      });
      const json = await resp.json();
      if (json.ok && json.data) {
        if (Array.isArray(json.data.books) && json.data.books.length > 0) {
          setBooks(json.data.books);
          setCurrentBookId(json.data.books[0].id);
        }
        if (json.data.progressMap) {
          setProgressMap(json.data.progressMap);
        }
        showToast(
          `Reset & re-indexed ${json.stats?.total || json.data.books?.length || 0} books in ~/.tide/all.json`
        );
        return json.stats;
      }
    } catch {
      showToast('Reset & re-index failed');
    }
    return undefined;
  }, [watchedRoots, showToast]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'tide_abb_search_history_v2',
        JSON.stringify(searchHistory)
      );
    } catch {
      // ignore
    }
  }, [searchHistory]);

  useEffect(() => {
    try {
      localStorage.setItem('tide_qbit_config', JSON.stringify(qbitConfig));
    } catch {
      // ignore
    }
  }, [qbitConfig]);

  // Auto-hiding sidebar mouse sensor near left screen edge
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 22) {
        setSidebarVisible(true);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const currentBook =
    books.find((b) => b.id === currentBookId) || books[0] || EMPTY_BOOK_FALLBACK;
  const currentProgress = progressMap[currentBook.id] || {
    bookId: currentBook.id,
    positionMs: 0,
    speed: 1.0,
    finished: false,
    updatedAt: Date.now(),
  };

  const activePalette = lockTheme ? lockedPalette : currentBook.palette;

  const currentChapterIndex = findActiveChapterIndex(
    currentBook.chapters,
    currentProgress.positionMs
  );

  const currentChapter =
    currentBook.chapters[currentChapterIndex] || currentBook.chapters[0];

  // Build physical audio file segments spanning 0 .. currentBook.durationMs
  // Works seamlessly whether 1 file has 8 chapters (.m4b), 2 files have 2 chapters, or 2 files have 27 Audnexus chapters!
  const fileSegments = React.useMemo(() => {
    const totalBookDur = Math.max(
      1000,
      currentBook.durationMs,
      currentBook.chapters[currentBook.chapters.length - 1]?.endMs || 0
    );
    const files = currentBook.files || [];
    if (files.length <= 1) {
      const singleUrl =
        files[0]?.objectUrl ||
        (files[0]?.path
          ? `/api/fs/stream?path=${encodeURIComponent(files[0].path)}`
          : undefined) ||
        currentBook.chapters[0]?.streamUrl ||
        LOCAL_WOTW_CH1;
      return [
        {
          index: 0,
          startMs: 0,
          endMs: totalBookDur,
          streamUrl: singleUrl,
        },
      ];
    }

    const rawFileDurs = files.map((f, idx) => {
      if (f.durationMs && f.durationMs > 500) return f.durationMs;
      // Fallback to matching chapter or size estimate
      const ch = currentBook.chapters[idx];
      if (ch && ch.endMs > ch.startMs) return ch.endMs - ch.startMs;
      return Math.max(60000, Math.round(((f.sizeBytes || 1000000) / 8000) * 1000));
    });
    const rawSum = Math.max(1, rawFileDurs.reduce((a, b) => a + b, 0));
    let accMs = 0;

    return files.map((f, idx) => {
      const startMs = accMs;
      const spanMs =
        idx === files.length - 1
          ? Math.max(1000, totalBookDur - startMs)
          : Math.round((rawFileDurs[idx] / rawSum) * totalBookDur);
      accMs = startMs + spanMs;
      const streamUrl =
        f.objectUrl ||
        (f.path
          ? `/api/fs/stream?path=${encodeURIComponent(f.path)}`
          : undefined) ||
        currentBook.chapters[idx]?.streamUrl ||
        LOCAL_WOTW_CH1;
      return {
        index: idx,
        startMs,
        endMs: accMs,
        streamUrl,
      };
    });
  }, [currentBook]);

  const findFileSegmentForMs = useCallback(
    (ms: number) => {
      for (let i = fileSegments.length - 1; i >= 0; i--) {
        if (ms >= fileSegments[i].startMs - 5) {
          return fileSegments[i];
        }
      }
      return fileSegments[0];
    },
    [fileSegments]
  );

  const currentFileSegment = findFileSegmentForMs(currentProgress.positionMs);

  // Refs so callbacks and rapid skip/shortcut/seekbar interactions never read stale closures
  const latestPositionMsRef = React.useRef<number>(currentProgress.positionMs);
  const activeBookRef = React.useRef<Book>(currentBook);
  const activeFileSegRef = React.useRef(currentFileSegment);
  const fileSegmentsRef = React.useRef(fileSegments);
  const lastManualSeekAppTimeRef = React.useRef<number>(0);

  useEffect(() => {
    latestPositionMsRef.current = currentProgress.positionMs;
    activeBookRef.current = currentBook;
    activeFileSegRef.current = currentFileSegment;
    fileSegmentsRef.current = fileSegments;
  }, [currentProgress.positionMs, currentBook, currentFileSegment, fileSegments]);

  // Sync book peaks into audioEngine so the visualizer reflects real amplitude
  useEffect(() => {
    audioEngine.setBookPeaks(currentBook.peaks);
  }, [currentBook.id, currentBook.peaks]);

  // Sync audioEngine with active physical audio file stream
  // Runs ONLY when book or physical audio file changes, or when ~/.tide/all.json finishes hydrating
  useEffect(() => {
    const seg = findFileSegmentForMs(latestPositionMsRef.current);
    activeFileSegRef.current = seg;
    const offsetInFileMs = Math.max(
      0,
      latestPositionMsRef.current - seg.startMs
    );
    const segSpanMs = Math.max(1000, seg.endMs - seg.startMs);
    audioEngine.setBookProfile(
      currentBook.voiceProfile?.basePitchHz || 115,
      currentBook.voiceProfile?.cadenceSpeed || 1.0,
      seg.streamUrl,
      offsetInFileMs,
      segSpanMs
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentBook.id,
    currentFileSegment.index,
    currentFileSegment.streamUrl,
    hydratedFromTideJson,
  ]);

  useEffect(() => {
    audioEngine.setSpeed(currentProgress.speed || 1.0);
  }, [currentProgress.speed]);

  // Sync play/pause state from actual HTMLAudioElement / Howler events
  useEffect(() => {
    audioEngine.onPlayStateChange((playing) => {
      setIsPlaying(playing);
    });
  }, []);

  // Listen to audioEngine time updates and automatic file/chapter/book advancement
  useEffect(() => {
    audioEngine.onTimeUpdate((trackMs, trackDurationMs = 0) => {
      const book = activeBookRef.current;
      const seg = activeFileSegRef.current;
      if (!book || !seg) return;

      const segSpanMs = Math.max(1000, seg.endMs - seg.startMs);
      let mappedWithinSeg = trackMs;
      if (
        trackDurationMs > 1000 &&
        Math.abs(trackDurationMs - segSpanMs) > segSpanMs * 0.15
      ) {
        mappedWithinSeg = Math.min(
          segSpanMs - 20,
          (trackMs / trackDurationMs) * segSpanMs
        );
      } else {
        mappedWithinSeg = Math.min(segSpanMs - 20, trackMs);
      }

      const bookMs = Math.round(seg.startMs + Math.max(0, mappedWithinSeg));
      const clampedBookMs = Math.max(0, Math.min(book.durationMs, bookMs));

      // Guard against stale emission right after a user seek
      if (
        performance.now() - lastManualSeekAppTimeRef.current < 550 &&
        Math.abs(clampedBookMs - latestPositionMsRef.current) > 2500
      ) {
        return;
      }

      latestPositionMsRef.current = clampedBookMs;

      // If chapterLoop is enabled and playback reached the end of the active chapter, loop back to chapter start
      if (chapterLoop && book.chapters.length > 0) {
        const curChIdx = findActiveChapterIndex(book.chapters, clampedBookMs - 120);
        const curCh = book.chapters[curChIdx];
        if (curCh && clampedBookMs >= curCh.endMs - 80) {
          const loopTarget = curCh.startMs;
          latestPositionMsRef.current = loopTarget;
          const targetSeg =
            fileSegmentsRef.current.find(
              (s) => loopTarget >= s.startMs && loopTarget <= s.endMs
            ) || seg;
          audioEngine.seekRealFile(
            Math.max(0, loopTarget - targetSeg.startMs),
            Math.max(1000, targetSeg.endMs - targetSeg.startMs)
          );
          return;
        }
      }

      setProgressMap((prev) => {
        const prevPos = prev[book.id]?.positionMs ?? 0;
        if (Math.abs(prevPos - clampedBookMs) < 40) return prev;
        return {
          ...prev,
          [book.id]: {
            bookId: book.id,
            positionMs: clampedBookMs,
            speed: prev[book.id]?.speed || 1.0,
            finished: clampedBookMs >= book.durationMs - 1000,
            updatedAt: Date.now(),
          },
        };
      });
    });

    audioEngine.onTrackEnd(() => {
      const book = activeBookRef.current;
      const curSeg = activeFileSegRef.current;
      const segs = fileSegmentsRef.current;
      const nextSeg = segs[curSeg.index + 1];

      if (chapterLoop) {
        const curChIdx = findActiveChapterIndex(
          book.chapters,
          latestPositionMsRef.current
        );
        const curCh = book.chapters[curChIdx];
        if (curCh) {
          const targetSeg =
            segs.find(
              (s) => curCh.startMs >= s.startMs && curCh.startMs < s.endMs
            ) || curSeg;
          activeFileSegRef.current = targetSeg;
          latestPositionMsRef.current = curCh.startMs;
          audioEngine.setBookProfile(
            book.voiceProfile?.basePitchHz || 115,
            book.voiceProfile?.cadenceSpeed || 1.0,
            targetSeg.streamUrl,
            Math.max(0, curCh.startMs - targetSeg.startMs),
            Math.max(1000, targetSeg.endMs - targetSeg.startMs)
          );
          audioEngine.play();
          return;
        }
      }

      if (nextSeg) {
        const nextPos = nextSeg.startMs + 10;
        activeFileSegRef.current = nextSeg;
        latestPositionMsRef.current = nextPos;
        lastManualSeekAppTimeRef.current = performance.now();
        audioEngine.setBookProfile(
          book.voiceProfile?.basePitchHz || 115,
          book.voiceProfile?.cadenceSpeed || 1.0,
          nextSeg.streamUrl,
          0,
          Math.max(1000, nextSeg.endMs - nextSeg.startMs)
        );
        setProgressMap((prev) => ({
          ...prev,
          [book.id]: {
            bookId: book.id,
            positionMs: nextPos,
            speed: prev[book.id]?.speed || 1.0,
            finished: false,
            updatedAt: Date.now(),
          },
        }));
      } else if (queue.length > 0 && autoAdvance === 'next-queue') {
        const nextQueueItem = queue[0];
        const nextBook = books.find((b) => b.id === nextQueueItem.bookId);
        if (nextBook) {
          setCurrentBookId(nextBook.id);
          setQueue((q) => q.slice(1));
        }
      } else {
        setIsPlaying(false);
      }
    });
  }, [chapterLoop, queue, autoAdvance, books]);

  const handleTogglePlay = useCallback(() => {
    if (audioEngine.isActive()) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.play();
      setIsPlaying(true);
    }
  }, []);

  const handleSeek = useCallback(
    (ms: number) => {
      const maxDur = Math.max(
        1000,
        currentBook.durationMs,
        currentBook.chapters[currentBook.chapters.length - 1]?.endMs || 0
      );
      const clamped = Math.round(Math.max(0, Math.min(maxDur, ms)));
      latestPositionMsRef.current = clamped;
      lastManualSeekAppTimeRef.current = performance.now();

      const targetSeg = findFileSegmentForMs(clamped);
      const prevSeg = activeFileSegRef.current;
      activeFileSegRef.current = targetSeg;

      const offsetInFileMs = Math.max(0, clamped - targetSeg.startMs);
      const segSpanMs = Math.max(1000, targetSeg.endMs - targetSeg.startMs);

      if (
        targetSeg.index !== prevSeg.index ||
        targetSeg.streamUrl !== prevSeg.streamUrl
      ) {
        audioEngine.setBookProfile(
          currentBook.voiceProfile?.basePitchHz || 115,
          currentBook.voiceProfile?.cadenceSpeed || 1.0,
          targetSeg.streamUrl,
          offsetInFileMs,
          segSpanMs
        );
      } else {
        audioEngine.seekRealFile(offsetInFileMs, segSpanMs);
      }

      setProgressMap((prev) => ({
        ...prev,
        [currentBook.id]: {
          bookId: currentBook.id,
          positionMs: clamped,
          speed: prev[currentBook.id]?.speed || 1.0,
          finished: clamped >= maxDur - 1000,
          updatedAt: Date.now(),
        },
      }));
    },
    [currentBook, findFileSegmentForMs]
  );

  const handleSkipSeconds = useCallback(
    (sec: number) => {
      const baseMs = latestPositionMsRef.current;
      handleSeek(baseMs + sec * 1000);
    },
    [handleSeek]
  );

  const handlePrevChapter = useCallback(() => {
    const baseMs = latestPositionMsRef.current;
    const chIdx = findActiveChapterIndex(currentBook.chapters, baseMs);
    const ch = currentBook.chapters[chIdx];
    if (!ch) {
      handleSeek(0);
      return;
    }
    if (baseMs - ch.startMs > 3000 || chIdx === 0) {
      handleSeek(ch.startMs);
    } else {
      const prevCh = currentBook.chapters[chIdx - 1];
      if (prevCh) handleSeek(prevCh.startMs);
      else handleSeek(0);
    }
  }, [currentBook.chapters, handleSeek]);

  const handleNextChapter = useCallback(() => {
    const baseMs = latestPositionMsRef.current;
    const chIdx = findActiveChapterIndex(currentBook.chapters, baseMs);
    const nextCh = currentBook.chapters[chIdx + 1];
    if (nextCh) {
      handleSeek(nextCh.startMs + 5);
    } else {
      handleSeek(currentBook.durationMs);
    }
  }, [currentBook.chapters, currentBook.durationMs, handleSeek]);

  // Poll real qBittorrent Web API transfers when connected
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (qbitConfig.connected) {
        try {
          const resp = await fetch('/api/qbit/torrents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: qbitConfig.url,
              username: qbitConfig.username,
              password: qbitConfig.password,
              category: qbitConfig.category,
            }),
          });
          const data = await resp.json();
          if (data.connected && Array.isArray(data.torrents) && data.torrents.length > 0) {
            setTransfers((prev) => {
              const mapped: TorrentTransfer[] = data.torrents.map(
                (t: any, idx: number) => {
                  const existing = prev.find((p) => p.hash === t.hash);
                  const pal =
                    existing?.palette ||
                    CURATED_PALETTES[idx % CURATED_PALETTES.length];
                  return {
                    hash: t.hash,
                    name: t.name,
                    author: existing?.author || '',
                    narrator: existing?.narrator || '',
                    format: existing?.format || 'M4B',
                    bitrate: existing?.bitrate || '128 kbps',
                    sizeBytes: t.size || t.total_size || 0,
                    progress: t.progress || 0,
                    dlspeed: t.dlspeed || 0,
                    etaSec: t.eta || 0,
                    state: t.state || 'downloading',
                    sequential: Boolean(t.seq_dl),
                    firstLastPiecePrio: Boolean(t.f_l_piece_prio),
                    category: t.category || qbitConfig.category,
                    savePath: t.save_path || qbitConfig.savePath,
                    addedOn: (t.added_on || 0) * 1000,
                    cover:
                      existing?.cover ||
                      generateCoverSvg(t.name, '', pal, 'orbit'),
                    palette: pal,
                    durationMs: existing?.durationMs || 36000000,
                    importedBookId: existing?.importedBookId,
                    pieces:
                      existing?.pieces ||
                      Array(32).fill(t.progress >= 1 ? 2 : 1),
                    files: existing?.files || [
                      {
                        name: `${t.name}.m4b`,
                        sizeBytes: t.size || 0,
                        progress: t.progress || 0,
                      },
                    ],
                  };
                }
              );
              return mapped;
            });
            return;
          }
        } catch {
          // ignore
        }
      }

      setTransfers((prev) =>
        prev.map((tr) => {
          if (tr.state !== 'downloading') return tr;
          const nextProg = Math.min(1, tr.progress + 0.015);
          const isDone = nextProg >= 1;
          const remainingBytes = tr.sizeBytes * (1 - nextProg);
          return {
            ...tr,
            progress: nextProg,
            state: isDone ? 'completed' : 'downloading',
            dlspeed: isDone ? 0 : tr.dlspeed,
            etaSec: isDone
              ? 0
              : Math.ceil(remainingBytes / Math.max(1, tr.dlspeed)),
            files: tr.files.map((f) => ({
              ...f,
              progress: Math.min(1, nextProg * 1.25),
            })),
          };
        })
      );
    }, 1500);
    return () => clearInterval(id);
  }, [qbitConfig]);

  const handleSelectBook = useCallback(
    async (book: Book) => {
      const savedPosMs = progressMap[book.id]?.positionMs ?? 0;
      latestPositionMsRef.current = savedPosMs;
      activeBookRef.current = book;
      lastManualSeekAppTimeRef.current = performance.now();
      setCurrentBookId(book.id);

      if (!isPlaying) {
        audioEngine.play();
        setIsPlaying(true);
      }

      if (book.cover && !book.cover.startsWith('data:image/svg')) {
        const extracted = await extractPaletteFromImage(book.cover);
        setBooks((prev) =>
          prev.map((b) => (b.id === book.id ? { ...b, palette: extracted } : b))
        );
      }
    },
    [isPlaying, progressMap]
  );

  // Real AudioBookBay -> qBittorrent Web API Handoff
  const handleSendToQbittorrent = useCallback(
    async (result: AudioBookBayResult) => {
      const resp = await fetch('/api/qbit/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: qbitConfig.url,
          username: qbitConfig.username,
          password: qbitConfig.password,
          detailUrl: result.detailUrl,
          mirror: qbitConfig.abbMirror,
          category: qbitConfig.category,
          savePath: qbitConfig.savePath,
          sequential: qbitConfig.sequentialByDefault,
          firstLastPiecePrio: qbitConfig.firstLastPiecePrio,
        }),
      });
      const data = await resp.json();
      const resolvedHash =
        data.infoHash ||
        Array.from(result.title)
          .reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 1984)
          .toString(16)
          .padStart(40, '0');

      const extractedPalette = result.cover
        ? await extractPaletteFromImage(result.cover)
        : result.palette;

      const newTransfer: TorrentTransfer = {
        hash: resolvedHash,
        name: result.title,
        author: result.author || '',
        narrator: result.narrator || '',
        format: result.format,
        bitrate: result.bitrate,
        sizeBytes: result.sizeBytes || 524288000,
        progress: data.ok ? 0.02 : 0.14,
        dlspeed: 5840000,
        etaSec: Math.ceil((result.sizeBytes || 524288000) / 5840000),
        state: 'downloading',
        sequential: qbitConfig.sequentialByDefault,
        firstLastPiecePrio: qbitConfig.firstLastPiecePrio,
        category: qbitConfig.category,
        savePath: `${qbitConfig.savePath}/${result.title
          .replace(/[^\w\s-]/g, '')
          .trim()}`,
        addedOn: Date.now(),
        cover: result.cover,
        palette: extractedPalette,
        durationMs: 36000000,
        pieces: Array(32).fill(0),
        files: [
          {
            name: `01 - ${result.title}.${result.format.toLowerCase()}`,
            sizeBytes: result.sizeBytes || 524288000,
            progress: 0.25,
          },
        ],
      };

      setTransfers((prev) =>
        prev.some((t) => t.hash === resolvedHash) ? prev : [newTransfer, ...prev]
      );
      showToast('Sequential transfer started');
    },
    [qbitConfig, showToast]
  );

  // Import finished torrent to Library (saves file location to ~/.tide/all.json)
  const handleImportFinishedTorrent = useCallback(
    async (transfer: TorrentTransfer) => {
      let diskFiles: any[] = [];
      let realPeaks: number[] = [];
      try {
        const scanResp = await fetch('/api/fs/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dirPath: transfer.savePath,
            mode: 'single-book',
          }),
        });
        if (scanResp.ok) {
          const scanData = await scanResp.json();
          diskFiles = scanData.files || [];
          if (scanData.detectedBooks?.[0]?.peaks?.length > 0) {
            realPeaks = scanData.detectedBooks[0].peaks;
          }
        }
      } catch {
        // ignore
      }

      const newBookId = `book-qbit-${Date.now()}`;
      const filesList =
        diskFiles.length > 0
          ? diskFiles.map((df: any) => ({
              path: df.path,
              name: df.name,
              format: df.format,
              sizeBytes: df.sizeBytes,
              durationMs: 3600000,
              bitrateKbps: 128,
              objectUrl: df.streamUrl,
            }))
          : transfer.files.map((f) => ({
              path: `${transfer.savePath}/${f.name}`,
              name: f.name,
              format: transfer.format,
              sizeBytes: f.sizeBytes,
              durationMs: transfer.durationMs,
              bitrateKbps: 128,
            }));

      const chCount = Math.max(1, filesList.length);
      const chDur = Math.floor(transfer.durationMs / chCount);

      const newBook: Book = {
        id: newBookId,
        title: transfer.name,
        authors: [transfer.author || 'Audiobook'],
        narrators: [transfer.narrator || ''],
        tags: [transfer.category],
        genres: [],
        folderPath: transfer.savePath,
        importMode: 'single-book',
        cover: transfer.cover,
        palette: transfer.palette,
        peaks:
          realPeaks.length > 0 ? realPeaks : generatePeaks(Date.now() % 999),
        durationMs: transfer.durationMs,
        addedAt: Date.now(),
        files: filesList,
        chapters: filesList.map((f, idx) => ({
          id: `${newBookId}-ch-${idx}`,
          title: f.name.replace(/\.[^/.]+$/, ''),
          startMs: idx * chDur,
          endMs: (idx + 1) * chDur,
          streamUrl: (f as any).objectUrl,
        })),
      };

      setBooks((prev) => [newBook, ...prev]);
      setTransfers((prev) =>
        prev.map((t) =>
          t.hash === transfer.hash ? { ...t, importedBookId: newBookId } : t
        )
      );
      setCurrentBookId(newBookId);
      showToast('Saved to ~/.tide/all.json');
    },
    [showToast]
  );

  // Add item from the ONE + button in the sidebar
  const handleConfirmSidebarAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = addingInput.trim();
    if (!val || !addingKind) return;

    if (addingKind === 'folder-path') {
      try {
        const resp = await fetch('/api/fs/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dirPath: val, mode: 'auto-root' }),
        });
        const data = await resp.json();
        if (resp.ok && data.detectedBooks?.length > 0) {
          const scannedBooks: Book[] = data.detectedBooks.map(
            (db: any, bIdx: number) => {
              const pal =
                CURATED_PALETTES[(books.length + bIdx) % CURATED_PALETTES.length];
              let cumMs = 0;
              const chs = (db.files || []).map((f: any, i: number) => {
                const dur = Math.max(
                  180000,
                  Math.round(((f.sizeBytes || 1000000) / (128 * 125)) * 1000)
                );
                const startMs = cumMs;
                cumMs += dur;
                return {
                  id: `fs-ch-${bIdx}-${i}`,
                  title: f.name.replace(/\.[^/.]+$/, ''),
                  startMs,
                  endMs: cumMs,
                  streamUrl: f.streamUrl,
                };
              });
              return {
                id: `fs-${Date.now()}-${bIdx}`,
                title: db.title,
                authors: ['Local Library'],
                narrators: [''],
                tags: [],
                genres: [],
                folderPath: db.folderPath,
                cover: generateCoverSvg(db.title, '', pal, 'waves'),
                palette: pal,
                peaks:
                  db.peaks?.length > 0
                    ? db.peaks
                    : generatePeaks((Date.now() + bIdx) % 888),
                durationMs: cumMs || 1800000,
                addedAt: Date.now(),
                files: (db.files || []).map((f: any, i: number) => ({
                  path: f.path,
                  name: f.name,
                  format: f.format,
                  sizeBytes: f.sizeBytes,
                  durationMs: chs[i].endMs - chs[i].startMs,
                  bitrateKbps: 128,
                  objectUrl: f.streamUrl,
                })),
                chapters: chs,
              };
            }
          );

          setBooks((prev) => [...scannedBooks, ...prev]);
          showToast(
            `Saved ${scannedBooks.length} ${
              scannedBooks.length === 1 ? 'book' : 'books'
            } to .tide/all.json`
          );
        }
      } catch {
        // ignore
      }
      setSidebarItems((prev) => [
        ...prev,
        {
          id: `sb-${Date.now()}`,
          kind: 'folder',
          label: val.split('/').pop() || val,
          value: val,
        },
      ]);
    } else if (addingKind === 'playlist') {
      const plId = `pl-${Date.now()}`;
      setPlaylists((prev) => [
        ...prev,
        {
          id: plId,
          name: val,
          icon: 'Folder',
          color: activePalette.vibrant,
          bookIds: currentBook.id !== 'empty-state' ? [currentBook.id] : [],
        },
      ]);
      setSidebarItems((prev) => [
        ...prev,
        { id: `sb-${Date.now()}`, kind: 'playlist', label: val, value: plId },
      ]);
    } else {
      setSidebarItems((prev) => [
        ...prev,
        {
          id: `sb-${Date.now()}`,
          kind: addingKind === 'author' ? 'author' : 'tag',
          label: val,
          value: val,
        },
      ]);
    }

    setAddingInput('');
    setAddingKind(null);
    setShowAddPopover(false);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        handlePrevChapter();
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        handleNextChapter();
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'j') {
        e.preventDefault();
        handleSkipSeconds(-15);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkipSeconds(30);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextVol = Math.min(1, volume + 0.05);
        setVolume(nextVol);
        audioEngine.setVolume(nextVol);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextVol = Math.max(0, volume - 0.05);
        setVolume(nextVol);
        audioEngine.setVolume(nextVol);
      } else if (e.key === '[') {
        const nextSpd = Math.max(
          0.5,
          Number((currentProgress.speed - 0.05).toFixed(2))
        );
        audioEngine.setSpeed(nextSpd);
        setProgressMap((prev) => ({
          ...prev,
          [currentBook.id]: { ...currentProgress, speed: nextSpd },
        }));
      } else if (e.key === ']') {
        const nextSpd = Math.min(
          4.0,
          Number((currentProgress.speed + 0.05).toFixed(2))
        );
        audioEngine.setSpeed(nextSpd);
        setProgressMap((prev) => ({
          ...prev,
          [currentBook.id]: { ...currentProgress, speed: nextSpd },
        }));
      } else if (e.key.toLowerCase() === 'b') {
        const bm: Bookmark = {
          id: `bm-${Date.now()}`,
          bookId: currentBook.id,
          positionMs: currentProgress.positionMs,
          createdAt: Date.now(),
        };
        setBookmarks((prev) => [...prev, bm]);
        showToast(formatDurationNumeric(currentProgress.positionMs));
      } else if (e.key.toLowerCase() === 'q') {
        setActiveTab((prev) => (prev === 'queue' ? 'player' : 'queue'));
      } else if (e.key.toLowerCase() === 'v') {
        setVizConfig((prev) => {
          const next =
            ALL_VIZ_TYPES[
              (ALL_VIZ_TYPES.indexOf(prev.type) + 1) % ALL_VIZ_TYPES.length
            ];
          showToast(next);
          return { ...prev, type: next };
        });
      } else if (e.key.toLowerCase() === 'g') {
        setBgConfig((prev) => {
          const next =
            ALL_BG_TYPES[
              (ALL_BG_TYPES.indexOf(prev.type) + 1) % ALL_BG_TYPES.length
            ];
          showToast(next);
          return { ...prev, type: next };
        });
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setActiveTab('player');
        setIsSlickMode((prev) => {
          const next = !prev;
          showToast(next ? 'Slick Billboard Mode (L)' : 'Standard Player');
          return next;
        });
      } else if (e.key === 'Escape' && isSlickMode) {
        setIsSlickMode(false);
      } else if (e.key.toLowerCase() === 'f') {
        setIsImmersive((prev) => !prev);
      } else if (e.key.toLowerCase() === 'm') {
        setIsMiniPlayer((prev) => !prev);
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const modes: PlayerViewMode[] = [
          'focus',
          'full-cover',
          'up-next',
          'chapters',
          'visualizer',
        ];
        setActiveTab('player');
        setPlayerViewMode(modes[Number(e.key) - 1]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleTogglePlay,
    handlePrevChapter,
    handleNextChapter,
    handleSkipSeconds,
    volume,
    currentBook.id,
    currentProgress,
    showToast,
    isSlickMode,
  ]);

  // Listen to Electron Global Media Keys & Tray actions
  useEffect(() => {
    if (!window.tideElectron?.onMediaKey) return;
    return window.tideElectron.onMediaKey((action) => {
      if (action === 'play-pause') handleTogglePlay();
      else if (action === 'next-chapter') handleNextChapter();
      else if (action === 'prev-chapter') handlePrevChapter();
      else if (action === 'toggle-slick') {
        setActiveTab('player');
        setIsSlickMode((s) => !s);
      }
    });
  }, [handleTogglePlay, handleNextChapter, handlePrevChapter]);

  // Register Windows SMTC / FluentFlyout / OS MediaSession transport handlers
  useEffect(() => {
    registerMediaSessionHandlers({
      onPlay: () => {
        if (!isPlaying) handleTogglePlay();
      },
      onPause: () => {
        if (isPlaying) handleTogglePlay();
      },
      onPrevChapter: () => handlePrevChapter(),
      onNextChapter: () => handleNextChapter(),
      onSeekBackward: (sec) => handleSkipSeconds(-Math.abs(sec || 15)),
      onSeekForward: (sec) => handleSkipSeconds(Math.abs(sec || 30)),
      onSeekTo: (posSec) => handleSeek(Math.round(posSec * 1000)),
    });
  }, [
    isPlaying,
    handleTogglePlay,
    handlePrevChapter,
    handleNextChapter,
    handleSkipSeconds,
    handleSeek,
  ]);

  // Synchronize actual book cover (rasterized 512x512 PNG) & book/chapter title with Windows SMTC & FluentFlyout
  const activeChapterObj =
    currentBook.chapters[
      findActiveChapterIndex(currentBook.chapters, currentProgress.positionMs)
    ] || currentBook.chapters[0];

  useEffect(() => {
    syncFluentFlyoutMediaSession({
      book: currentBook,
      chapter: activeChapterObj,
      isPlaying,
      positionMs: currentProgress.positionMs,
      durationMs: currentBook.durationMs,
      playbackRate: currentProgress.speed || 1,
    });
  }, [
    currentBook,
    activeChapterObj,
    isPlaying,
    Math.floor(currentProgress.positionMs / 2000),
    currentProgress.speed,
  ]);

  const fontClass =
    fontFamily === 'newsreader'
      ? 'font-[Newsreader,serif]'
      : fontFamily === 'jakarta'
      ? 'font-[Plus_Jakarta_Sans,sans-serif]'
      : fontFamily === 'instrument'
      ? 'font-[Instrument_Sans,sans-serif]'
      : 'font-[Satoshi,sans-serif]';

  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';
  const radiusClass = squareCorners ? 'rounded-none' : 'rounded-3xl';

  // Mini Player Floating Island (`M`)
  if (isMiniPlayer) {
    const pct = Math.min(
      1,
      currentProgress.positionMs / Math.max(1, currentBook.durationMs)
    );
    return (
      <div
        className={`h-screen w-screen bg-black flex items-center justify-center p-6 ${fontClass}`}
      >
        <DynamicBackground
          config={bgConfig}
          palette={activePalette}
          coverUrl={currentBook.cover}
          isPlaying={isPlaying}
        />
        <div
          className={`relative z-20 flex items-center gap-4 px-5 py-3.5 ${
            squareCorners ? 'rounded-none' : 'rounded-full'
          } ambient-popover max-w-sm w-full`}
        >
          <div className="relative w-11 h-11 shrink-0">
            <svg className="w-11 h-11 -rotate-90" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="22"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="2.5"
              />
              <circle
                cx="24"
                cy="24"
                r="22"
                fill="none"
                stroke={activePalette.vibrant}
                strokeWidth="2.5"
                strokeDasharray={`${pct * 138} 138`}
              />
            </svg>
            <img
              src={currentBook.cover}
              alt=""
              className="w-8 h-8 rounded-full object-cover absolute top-1.5 left-1.5"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white truncate">
              {currentBook.title}
            </p>
            <p className="text-[11px] font-mono text-white/45">
              {formatDurationNumeric(currentProgress.positionMs)}
            </p>
          </div>

          <button
            onClick={handleTogglePlay}
            className="w-9 h-9 rounded-full flex items-center justify-center text-black shrink-0"
            style={{ backgroundColor: activePalette.vibrant }}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={() => setIsMiniPlayer(false)}
            className="p-1.5 rounded-full text-white/45 hover:text-white"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const isSidebarOpen = sidebarPinned || sidebarVisible;

  return (
    <ReactBitsClickSpark
      sparkColor={activePalette.vibrant}
      sparkSize={11}
      sparkRadius={22}
      sparkCount={8}
      duration={440}
      disabled={!clickSparkEnabled}
    >
      <div
        className={`h-screen w-screen overflow-hidden flex flex-col relative ${fontClass} ${
          colorScheme === 'light' ? 'invert hue-rotate-180' : ''
        }`}
        style={{
          backgroundColor: colorScheme === 'oled' ? '#000000' : activePalette.dark,
        }}
      >
      {/* Dynamic Audio-Reactive Background Layer */}
      <DynamicBackground
        config={bgConfig}
        palette={activePalette}
        coverUrl={currentBook.cover}
        isPlaying={isPlaying}
      />

      {/* Frameless Electron Desktop Title Bar */}
      <ElectronTitleBar visible={!isSlickMode && !isImmersive} />

      {/* Minimal Toast */}
      {toastText && (
        <div
          className={`fixed top-5 right-16 z-50 px-4 py-2 ${pillRadius} ambient-popover text-xs font-mono text-white flex items-center gap-2 animate-enter`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: activePalette.vibrant }}
          />
          <span>{toastText}</span>
        </div>
      )}

      {/* Main Layout */}
      <div className="relative z-10 flex-1 flex overflow-hidden min-h-0">
        {/* Left-edge subtle hover handle indicator when sidebar is auto-hidden */}
        {shellMode === 'sidebar' &&
          !isImmersive &&
          !isSlickMode &&
          activeTab !== 'landing' &&
          !isSidebarOpen && (
            <div
              onMouseEnter={() => setSidebarVisible(true)}
              className="fixed left-0 top-0 bottom-0 w-5 z-40 flex items-center justify-center group cursor-pointer"
            >
              <div className="w-1 h-12 rounded-full bg-white/15 group-hover:bg-white/45 transition-all" />
            </div>
          )}

        {/* Auto-Hiding ICON-ONLY Sidebar (No words, ONE single + button with NO background) */}
        {shellMode === 'sidebar' &&
          !isImmersive &&
          !isSlickMode &&
          activeTab !== 'landing' && (
          <aside
            onMouseEnter={() => setSidebarVisible(true)}
            onMouseLeave={() => {
              if (!sidebarPinned && !showAddPopover) {
                setSidebarVisible(false);
              }
            }}
            className={`fixed left-0 top-0 bottom-0 z-40 w-16 flex flex-col items-center justify-between py-4 select-none transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              sidebarFrosted
                ? 'backdrop-blur-3xl bg-white/[0.08] shadow-[16px_0_60px_rgba(0,0,0,0.45)]'
                : 'backdrop-blur-xl bg-black/80'
            } ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
          >
            {/* Top: THE ONE SINGLE PLUS BUTTON (Zero Background!) */}
            <div className="flex flex-col items-center gap-2 relative">
              <button
                onClick={() => {
                  setShowAddPopover((s) => !s);
                  setAddingKind(null);
                }}
                className={`w-10 h-10 ${pillRadius} flex items-center justify-center bg-transparent transition-transform active:scale-90 ${
                  showAddPopover
                    ? 'text-white scale-110'
                    : 'text-white/55 hover:text-white'
                }`}
                title="Add Root Folder, Book Folder, Author, Playlist, or Tag"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Unified Add Popover Menu anchored next to the single + icon */}
              {showAddPopover && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`fixed left-20 top-4 z-50 w-64 p-2 ${pillRadius} backdrop-blur-3xl bg-zinc-950/90 shadow-2xl space-y-1 text-xs animate-enter`}
                >
                  {!addingKind ? (
                    <>
                      <button
                        onClick={() => {
                          setShowAddPopover(false);
                          setActiveTab('library');
                          setExternalScannerMode('auto-root');
                        }}
                        className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/10 flex items-center gap-2.5 text-white/90`}
                      >
                        <Folders
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: activePalette.vibrant }}
                        />
                        <span>Add Root Folder (Child = Book)</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowAddPopover(false);
                          setActiveTab('library');
                          setExternalScannerMode('single-book');
                        }}
                        className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/10 flex items-center gap-2.5 text-white/85`}
                      >
                        <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                        <span>Add Single Book Folder</span>
                      </button>
                      <button
                        onClick={() => setAddingKind('folder-path')}
                        className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/10 flex items-center gap-2.5 text-white/85`}
                      >
                        <Folder className="w-3.5 h-3.5 shrink-0" />
                        <span>Quick Path Scan</span>
                      </button>
                      <button
                        onClick={() => setAddingKind('author')}
                        className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/10 flex items-center gap-2.5 text-white/85`}
                      >
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span>Author</span>
                      </button>
                      <button
                        onClick={() => setAddingKind('playlist')}
                        className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/10 flex items-center gap-2.5 text-white/85`}
                      >
                        <Layers className="w-3.5 h-3.5 shrink-0" />
                        <span>Playlist</span>
                      </button>
                      <button
                        onClick={() => setAddingKind('tag')}
                        className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/10 flex items-center gap-2.5 text-white/85`}
                      >
                        <Tag className="w-3.5 h-3.5 shrink-0" />
                        <span>Tag</span>
                      </button>
                      <button
                        onClick={() => {
                          handleLoadRealLibriVox('time_machine_librivox');
                          setShowAddPopover(false);
                        }}
                        className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/10 flex items-center gap-2.5 text-white/65`}
                      >
                        <Headphones className="w-3.5 h-3.5 shrink-0" />
                        <span>LibriVox Stream</span>
                      </button>
                    </>
                  ) : (
                    <form onSubmit={handleConfirmSidebarAdd} className="p-1 space-y-2">
                      <input
                        type="text"
                        autoFocus
                        value={addingInput}
                        onChange={(e) => setAddingInput(e.target.value)}
                        placeholder={
                          addingKind === 'folder-path'
                            ? '/path/to/audiobooks'
                            : addingKind === 'author'
                            ? 'Author name'
                            : addingKind === 'playlist'
                            ? 'Playlist name'
                            : 'Tag'
                        }
                        className={`w-full px-3 py-2 ${pillRadius} bg-white/10 text-white text-xs`}
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAddingKind(null)}
                          className="px-2.5 py-1 text-white/50 hover:text-white"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          className={`px-3 py-1 ${pillRadius} bg-white text-black font-medium`}
                        >
                          Add
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Center: Pure Icon-Only Navigation Rail (NO words!) */}
            <nav className="flex-1 w-full flex flex-col items-center justify-center gap-2 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-2">
              {(
                [
                  { id: 'player', label: 'Player', icon: Waves },
                  { id: 'library', label: 'Library', icon: Grid },
                  { id: 'queue', label: 'Queue', icon: Layers },
                  { id: 'abb-search', label: 'AudioBookBay', icon: Search },
                  { id: 'downloads', label: 'Transfers', icon: ArrowDownToLine },
                  { id: 'stats', label: 'Stats', icon: Activity },
                  { id: 'customize', label: 'Settings', icon: Sliders },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id && !libraryFilter;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setLibraryFilter(null);
                    }}
                    title={item.label}
                    className={`w-10 h-10 ${pillRadius} flex items-center justify-center transition-all ${
                      active
                        ? 'bg-white/20 text-white shadow-lg scale-105'
                        : 'text-white/50 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={active ? { color: activePalette.vibrant } : undefined}
                    />
                  </button>
                );
              })}

              {/* User-added custom items as pure icons with tooltips */}
              {sidebarItems.map((item) => {
                const Icon =
                  item.kind === 'author'
                    ? User
                    : item.kind === 'folder'
                    ? Folder
                    : item.kind === 'playlist'
                    ? Layers
                    : Tag;
                const isActive =
                  activeTab === 'library' &&
                  libraryFilter?.type === item.kind &&
                  libraryFilter?.value === item.value;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setLibraryFilter({ type: item.kind, value: item.value });
                      setActiveTab('library');
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSidebarItems((prev) =>
                        prev.filter((x) => x.id !== item.id)
                      );
                    }}
                    title={`${item.label} (Right-click to remove)`}
                    className={`w-10 h-10 ${pillRadius} flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-white/45 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </nav>

            {/* Bottom: Dividing Line + Generous Space + Hover-Only Pin + Mini Cover Avatar */}
            <div className="flex flex-col items-center gap-3.5 pt-2">
              <div className="w-6 h-[1px] bg-white/[0.12] rounded-full" />

              <div className="group/pin py-1.5 px-2.5 -my-1 flex items-center justify-center">
                <button
                  onClick={() => setSidebarPinned((p) => !p)}
                  className={`w-8 h-8 ${pillRadius} flex items-center justify-center transition-all duration-300 opacity-0 group-hover/pin:opacity-35 hover:!opacity-65 ${
                    sidebarPinned
                      ? 'text-white bg-white/15'
                      : 'text-white/75 bg-white/[0.04] hover:bg-white/[0.1]'
                  }`}
                  title={sidebarPinned ? 'Auto-hide sidebar' : 'Pin sidebar'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleTogglePlay}
                title={currentBook.title}
                className="relative w-10 h-10 rounded-xl overflow-hidden group shadow-lg"
              >
                <img
                  src={currentBook.cover}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </div>
              </button>
            </div>
          </aside>
        )}

        {/* Active Screen Page Container (No black bottom player bar!) */}
        <main
          className={`flex-1 h-full overflow-hidden flex flex-col relative min-w-0 transition-all duration-500 ${
            shellMode === 'sidebar' &&
            sidebarPinned &&
            !isImmersive &&
            activeTab !== 'landing'
              ? 'pl-16'
              : ''
          }`}
        >
          <div className="flex-1 overflow-hidden min-h-0">
            {activeTab === 'landing' && (
              <LandingPage
                books={books}
                currentBook={currentBook}
                palette={activePalette}
                progressMap={progressMap}
                isPlaying={isPlaying}
                positionMs={currentProgress.positionMs}
                onSelectBook={handleSelectBook}
                onTogglePlay={handleTogglePlay}
                onSeek={handleSeek}
                bgConfig={bgConfig}
                onChangeBgType={(t) =>
                  setBgConfig((prev) => ({ ...prev, type: t }))
                }
                vizConfig={vizConfig}
                onChangeVizType={(v) =>
                  setVizConfig((prev) => ({ ...prev, type: v }))
                }
                onLaunchApp={(tab) => setActiveTab(tab || 'player')}
              />
            )}

            {activeTab === 'player' && (
              <PlayerView
                book={currentBook}
                books={books}
                palette={activePalette}
                isPlaying={isPlaying}
                onTogglePlay={handleTogglePlay}
                positionMs={currentProgress.positionMs}
                onSeek={handleSeek}
                onSkipSeconds={handleSkipSeconds}
                onPrevChapter={handlePrevChapter}
                onNextChapter={handleNextChapter}
                speed={currentProgress.speed}
                onChangeSpeed={(spd) => {
                  audioEngine.setSpeed(spd);
                  setProgressMap((prev) => ({
                    ...prev,
                    [currentBook.id]: { ...currentProgress, speed: spd },
                  }));
                }}
                volume={volume}
                muted={muted}
                onChangeVolume={(v) => {
                  setVolume(v);
                  setMuted(false);
                  audioEngine.setMuted(false);
                  audioEngine.setVolume(v);
                }}
                onToggleMute={() => {
                  const next = !muted;
                  setMuted(next);
                  audioEngine.setMuted(next);
                }}
                viewMode={playerViewMode}
                onChangeViewMode={setPlayerViewMode}
                progressBarStyle={progressBarStyle}
                onCycleProgressBarStyle={() => {
                  const next =
                    ALL_PROGRESS_STYLES[
                      (ALL_PROGRESS_STYLES.indexOf(progressBarStyle) + 1) %
                        ALL_PROGRESS_STYLES.length
                    ];
                  setProgressBarStyle(next);
                }}
                onChangeProgressBarStyle={setProgressBarStyle}
                timeMode={timeMode}
                onCycleTimeMode={() => {
                  const next =
                    ALL_TIME_MODES[
                      (ALL_TIME_MODES.indexOf(timeMode) + 1) %
                        ALL_TIME_MODES.length
                    ];
                  setTimeMode(next);
                }}
                coverShape={coverShape}
                onChangeCoverShape={setCoverShape}
                vizConfig={vizConfig}
                onCycleVisualizer={() => {
                  const next =
                    ALL_VIZ_TYPES[
                      (ALL_VIZ_TYPES.indexOf(vizConfig.type) + 1) %
                        ALL_VIZ_TYPES.length
                    ];
                  setVizConfig({ ...vizConfig, type: next });
                }}
                onChangeVizType={(vt) => setVizConfig({ ...vizConfig, type: vt })}
                bookmarks={bookmarks}
                onAddBookmark={(note) => {
                  const bm: Bookmark = {
                    id: `bm-${Date.now()}`,
                    bookId: currentBook.id,
                    positionMs: currentProgress.positionMs,
                    note,
                    createdAt: Date.now(),
                  };
                  setBookmarks((prev) => [...prev, bm]);
                  showToast(formatDurationNumeric(currentProgress.positionMs));
                }}
                onDeleteBookmark={(id) =>
                  setBookmarks((prev) => prev.filter((b) => b.id !== id))
                }
                sleepTimerMin={sleepTimerMin}
                onSetSleepTimer={(val) => {
                  setSleepTimerMin(val);
                  showToast(val ? `${val}` : 'Off');
                }}
                chapterLoop={chapterLoop}
                onToggleChapterLoop={() => setChapterLoop((l) => !l)}
                eqBands={eqBands}
                preampDb={preampDb}
                voiceBoost={voiceBoost}
                skipSilence={skipSilence}
                normalizeLoudness={normalizeLoudness}
                onChangeEq={(bands, preamp) => {
                  setEqBands(bands);
                  setPreampDb(preamp);
                  audioEngine.setEqualizer(bands, preamp);
                }}
                onToggleVoiceBoost={() => {
                  const next = !voiceBoost;
                  setVoiceBoost(next);
                  audioEngine.setVoiceBoost(next);
                }}
                onToggleSkipSilence={() => setSkipSilence((s) => !s)}
                onToggleNormalize={() => setNormalizeLoudness((n) => !n)}
                outputDevice={outputDevice}
                onChangeOutputDevice={setOutputDevice}
                queue={queue}
                onSelectBook={handleSelectBook}
                onOpenMetadataEditor={() =>
                  setEditingBook({ book: currentBook, tab: 'core' })
                }
                onOpenTranscript={() => setTranscriptBook(currentBook)}
                isImmersive={isImmersive}
                onToggleImmersive={() => setIsImmersive((i) => !i)}
                isSlickMode={isSlickMode}
                onToggleSlickMode={() => setIsSlickMode((s) => !s)}
                slickTextSpeed={bgConfig.slickTextSpeed ?? 18}
                fullScreenSeekbar={bgConfig.fullScreenSeekbar ?? true}
                chapterOnlySeekbar={bgConfig.chapterOnlySeekbar ?? false}
                onToggleChapterOnlySeekbar={() =>
                  setBgConfig((prev) => ({
                    ...prev,
                    chapterOnlySeekbar: !(prev.chapterOnlySeekbar ?? false),
                  }))
                }
                seekbarWidthPct={bgConfig.seekbarWidthPct ?? 88}
                squareCorners={squareCorners}
              />
            )}

            {activeTab === 'library' && (
              <LibraryView
                books={books}
                progressMap={progressMap}
                currentBookId={currentBook.id}
                isPlaying={isPlaying}
                palette={activePalette}
                playlists={playlists}
                activeFilter={libraryFilter}
                onClearFilter={() => setLibraryFilter(null)}
                onSelectBook={(book) => {
                  handleSelectBook(book);
                  setActiveTab('player');
                }}
                onPlayNext={(book) => {
                  setQueue((prev) => [
                    { id: `q-${Date.now()}`, kind: 'book', bookId: book.id },
                    ...prev.filter((q) => q.bookId !== book.id),
                  ]);
                  showToast(book.title);
                }}
                onAddToQueue={(book) => {
                  setQueue((prev) =>
                    prev.some((q) => q.bookId === book.id)
                      ? prev
                      : [
                          ...prev,
                          { id: `q-${Date.now()}`, kind: 'book', bookId: book.id },
                        ]
                  );
                  showToast(book.title);
                }}
                onAddToPlaylist={(playlistId, bookId) => {
                  setPlaylists((prev) =>
                    prev.map((pl) =>
                      pl.id === playlistId && !pl.bookIds.includes(bookId)
                        ? { ...pl, bookIds: [...pl.bookIds, bookId] }
                        : pl
                    )
                  );
                }}
                onToggleFavorite={(bookId) => {
                  setBooks((prev) =>
                    prev.map((b) =>
                      b.id === bookId ? { ...b, favorite: !b.favorite } : b
                    )
                  );
                }}
                onMoveBookOrder={(bookId, dir) => {
                  setBooks((prev) => {
                    const idx = prev.findIndex((b) => b.id === bookId);
                    if (idx === -1) return prev;
                    const copy = [...prev];
                    const [item] = copy.splice(idx, 1);
                    if (dir === 'top') copy.unshift(item);
                    else if (dir === 'up')
                      copy.splice(Math.max(0, idx - 1), 0, item);
                    else copy.splice(Math.min(copy.length, idx + 1), 0, item);
                    return copy;
                  });
                }}
                onOpenMetadataEditor={(book, tab) =>
                  setEditingBook({ book, tab })
                }
                onOpenTranscript={(book) => setTranscriptBook(book)}
                onRemoveBook={(bookId) => {
                  setBooks((prev) => prev.filter((b) => b.id !== bookId));
                }}
                onImportBooks={(newBooks) => {
                  setBooks((prev) => [...newBooks, ...prev]);
                  if (newBooks[0]) setCurrentBookId(newBooks[0].id);
                  showToast('Saved to ~/.tide/all.json');
                }}
                onUpdateBook={(updated) => {
                  setBooks((prev) =>
                    prev.map((b) => (b.id === updated.id ? updated : b))
                  );
                  fetch('/api/chapters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      bookId: updated.id,
                      title: updated.title,
                      folderPath: updated.folderPath,
                      durationMs: updated.durationMs,
                      chapters: updated.chapters,
                    }),
                  }).catch(() => {});
                  showToast(`Saved ${updated.title} · chapters.json`);
                }}
                onLoadRealLibriVox={handleLoadRealLibriVox}
                externalOpenScannerMode={externalScannerMode}
                onClearExternalScannerMode={() => setExternalScannerMode(null)}
                squareCorners={squareCorners}
              />
            )}

            {activeTab === 'queue' && (
              <QueueView
                currentBook={currentBook}
                currentChapterIndex={currentChapterIndex}
                books={books}
                queue={queue}
                playlists={playlists}
                palette={activePalette}
                autoAdvance={autoAdvance}
                onChangeAutoAdvance={setAutoAdvance}
                onSelectBook={(book) => {
                  handleSelectBook(book);
                  setActiveTab('player');
                }}
                onJumpToChapter={(idx) => {
                  const ch = currentBook.chapters[idx];
                  if (ch) {
                    handleSeek(ch.startMs);
                    setActiveTab('player');
                  }
                }}
                onMoveQueueItem={(id, dir) => {
                  setQueue((prev) => {
                    const idx = prev.findIndex((q) => q.id === id);
                    if (idx === -1) return prev;
                    const copy = [...prev];
                    const [item] = copy.splice(idx, 1);
                    if (dir === 'top') copy.unshift(item);
                    else if (dir === 'up')
                      copy.splice(Math.max(0, idx - 1), 0, item);
                    else copy.splice(Math.min(copy.length, idx + 1), 0, item);
                    return copy;
                  });
                }}
                onRemoveQueueItem={(id) => {
                  setRemovedQueueHistory((h) => [...h, queue]);
                  setQueue((prev) => prev.filter((q) => q.id !== id));
                }}
                onUndoRemoveQueue={() => {
                  const last =
                    removedQueueHistory[removedQueueHistory.length - 1];
                  if (last) {
                    setQueue(last);
                    setRemovedQueueHistory((h) => h.slice(0, -1));
                  }
                }}
                hasUndoQueue={removedQueueHistory.length > 0}
                onCreatePlaylist={(name, color) => {
                  setPlaylists((prev) => [
                    ...prev,
                    {
                      id: `pl-${Date.now()}`,
                      name,
                      icon: 'Folder',
                      color,
                      bookIds:
                        currentBook.id !== 'empty-state'
                          ? [currentBook.id]
                          : [],
                    },
                  ]);
                }}
                onAddBookToQueue={(book) => {
                  setQueue((prev) =>
                    prev.some((q) => q.bookId === book.id)
                      ? prev
                      : [
                          ...prev,
                          { id: `q-${Date.now()}`, kind: 'book', bookId: book.id },
                        ]
                  );
                  showToast(book.title);
                }}
                squareCorners={squareCorners}
              />
            )}

            {activeTab === 'abb-search' && (
              <AudioBookBayView
                palette={activePalette}
                searchHistory={searchHistory}
                onAddSearchHistory={(q) =>
                  setSearchHistory((prev) =>
                    [
                      q,
                      ...prev.filter(
                        (item) => item.toLowerCase() !== q.toLowerCase()
                      ),
                    ].slice(0, 10)
                  )
                }
                onRemoveSearchHistory={(q) =>
                  setSearchHistory((prev) => prev.filter((item) => item !== q))
                }
                onClearSearchHistory={() => setSearchHistory([])}
                qbitConfig={qbitConfig}
                onUpdateQbitConfig={setQbitConfig}
                transfers={transfers}
                onSendToQbittorrent={handleSendToQbittorrent}
                onOpenDownloads={() => setActiveTab('downloads')}
                squareCorners={squareCorners}
              />
            )}

            {activeTab === 'downloads' && (
              <DownloadsView
                palette={activePalette}
                transfers={transfers}
                qbitConfig={qbitConfig}
                onPauseResume={async (hash) => {
                  const target = transfers.find((t) => t.hash === hash);
                  if (!target) return;
                  const nextAction =
                    target.state === 'pausedDL' ? 'resume' : 'pause';
                  fetch('/api/qbit/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      url: qbitConfig.url,
                      username: qbitConfig.username,
                      password: qbitConfig.password,
                      action: nextAction,
                      hash,
                    }),
                  }).catch(() => {});

                  setTransfers((prev) =>
                    prev.map((t) =>
                      t.hash === hash
                        ? {
                            ...t,
                            state:
                              t.state === 'pausedDL'
                                ? 'downloading'
                                : 'pausedDL',
                          }
                        : t
                    )
                  );
                }}
                onRemove={(hash) => {
                  fetch('/api/qbit/action', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      url: qbitConfig.url,
                      username: qbitConfig.username,
                      password: qbitConfig.password,
                      action: 'delete',
                      hash,
                      deleteFiles: false,
                    }),
                  }).catch(() => {});
                  setTransfers((prev) => prev.filter((t) => t.hash !== hash));
                }}
                onImportFinished={handleImportFinishedTorrent}
                onPlaySequentialPreview={(tr) => {
                  handleImportFinishedTorrent(tr);
                  setActiveTab('player');
                }}
                onFastForwardTransfer={(hash) => {
                  setTransfers((prev) =>
                    prev.map((t) =>
                      t.hash === hash
                        ? {
                            ...t,
                            progress: 1.0,
                            state: 'completed',
                            dlspeed: 0,
                            etaSec: 0,
                            files: t.files.map((f) => ({
                              ...f,
                              progress: 1.0,
                            })),
                          }
                        : t
                    )
                  );
                }}
                onOpenSearch={() => setActiveTab('abb-search')}
                onSelectBookById={(bookId) => {
                  const found = books.find((b) => b.id === bookId);
                  if (found) {
                    handleSelectBook(found);
                    setActiveTab('player');
                  }
                }}
                squareCorners={squareCorners}
              />
            )}

            {activeTab === 'stats' && (
              <StatsView
                books={books}
                progressMap={progressMap}
                listeningHistory={listeningHistory}
                bookmarks={bookmarks}
                palette={activePalette}
                onSelectBook={(book) => {
                  handleSelectBook(book);
                  setActiveTab('player');
                }}
                squareCorners={squareCorners}
              />
            )}

            {activeTab === 'customize' && (
              <CustomizeView
                palette={activePalette}
                coverUrl={currentBook.cover}
                bgConfig={bgConfig}
                onChangeBg={setBgConfig}
                vizConfig={vizConfig}
                onChangeViz={setVizConfig}
                themeMode={themeMode}
                onChangeThemeMode={setThemeMode}
                colorScheme={colorScheme}
                onChangeColorScheme={setColorScheme}
                coverShape={coverShape}
                onChangeCoverShape={setCoverShape}
                progressBarStyle={progressBarStyle}
                onChangeProgressBarStyle={setProgressBarStyle}
                squareCorners={squareCorners}
                onToggleSquareCorners={() => setSquareCorners((s) => !s)}
                lockTheme={lockTheme}
                onToggleLockTheme={() => {
                  if (!lockTheme) setLockedPalette(currentBook.palette);
                  setLockTheme((l) => !l);
                }}
                onSelectOverridePalette={(p) => {
                  setLockedPalette(p);
                  setLockTheme(true);
                  showToast('Theme override applied');
                }}
                customThemes={customThemes}
                onSaveCustomTheme={(th) => {
                  setCustomThemes((prev) => [...prev, th]);
                  showToast(`Saved ${th.name}`);
                }}
                onDeleteCustomTheme={(id) => {
                  setCustomThemes((prev) => prev.filter((t) => t.id !== id));
                }}
                sidebarFrosted={sidebarFrosted}
                onToggleSidebarFrosted={() => setSidebarFrosted((f) => !f)}
                fontFamily={fontFamily}
                onChangeFontFamily={setFontFamily}
                shellMode={shellMode}
                onChangeShellMode={setShellMode}
                onApplyScene={(scene: ScenePreset) => {
                  setBgConfig(scene.bg);
                  setVizConfig(scene.viz);
                  setThemeMode(scene.themeMode);
                  setColorScheme(scene.colorScheme);
                  setCoverShape(scene.coverShape);
                  setProgressBarStyle(scene.progressBarStyle);
                  setFontFamily(scene.fontFamily);
                }}
                books={books}
                watchedRoots={watchedRoots}
                onForceIndex={handleForceIndex}
                onRepairLibrary={handleRepairLibrary}
                onResetLibrary={handleResetLibrary}
                clickSparkEnabled={clickSparkEnabled}
                onToggleClickSpark={() => setClickSparkEnabled((c) => !c)}
              />
            )}
          </div>

          {/* Floating Icon-Only Dock when shellMode === 'dock' */}
          {shellMode === 'dock' &&
            !isImmersive &&
            !isSlickMode &&
            activeTab !== 'landing' && (
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
              <div
                className={`flex items-center gap-1.5 px-3 py-2 ${radiusClass} ambient-popover`}
              >
                {(
                  [
                    { id: 'player', icon: Waves, tip: 'Player' },
                    { id: 'library', icon: Grid, tip: 'Library' },
                    { id: 'queue', icon: Layers, tip: 'Queue' },
                    { id: 'abb-search', icon: Search, tip: 'AudioBookBay' },
                    { id: 'downloads', icon: ArrowDownToLine, tip: 'Transfers' },
                    { id: 'stats', icon: Activity, tip: 'Stats' },
                    { id: 'customize', icon: Sliders, tip: 'Settings' },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`p-2.5 ${pillRadius} transition-all ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'text-white/45 hover:text-white'
                      }`}
                      title={item.tip}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={
                          active ? { color: activePalette.vibrant } : undefined
                        }
                      />
                    </button>
                  );
                })}
                <button
                  onClick={() =>
                    setEditingBook({ book: currentBook, tab: 'core' })
                  }
                  className={`p-2.5 ${pillRadius} text-white/45 hover:text-white`}
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Metadata & Chapter Editor Modal */}
      {editingBook && (
        <MetadataEditorModal
          book={editingBook.book}
          initialTab={editingBook.tab}
          palette={activePalette}
          onSave={(updated) => {
            setBooks((prev) =>
              prev.map((b) => (b.id === updated.id ? updated : b))
            );
            fetch('/api/chapters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookId: updated.id,
                title: updated.title,
                folderPath: updated.folderPath,
                durationMs: updated.durationMs,
                chapters: updated.chapters,
              }),
            }).catch(() => {});
            setEditingBook(null);
            showToast(`${updated.title} · chapters.json`);
          }}
          onClose={() => setEditingBook(null)}
          squareCorners={squareCorners}
        />
      )}

      {/* Local Whisper Transcription Modal */}
      {transcriptBook && (
        <TranscriptModal
          book={transcriptBook}
          palette={activePalette}
          onJumpToTimestamp={(ms) => {
            if (transcriptBook.id !== currentBook.id) {
              handleSelectBook(transcriptBook);
            }
            handleSeek(ms);
            setActiveTab('player');
          }}
          onUpdateBookTranscript={(
            bookId: string,
            segments: TranscriptSegment[]
          ) => {
            setBooks((prev) =>
              prev.map((b) =>
                b.id === bookId ? { ...b, transcript: segments } : b
              )
            );
          }}
          onClose={() => setTranscriptBook(null)}
          squareCorners={squareCorners}
        />
      )}
      </div>
    </ReactBitsClickSpark>
  );
};
export default App;
