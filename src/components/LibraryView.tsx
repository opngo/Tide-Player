import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Play,
  Pause,
  Heart,
  FolderPlus,
  Plus,
  Edit3,
  Trash2,
  X,
  Headphones,
  Folders,
  Folder,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Check,
  CornerLeftUp,
  Loader2,
  FileAudio,
  Info,
  Layers,
  Sparkles,
  Tag,
  HardDrive,
  Clock,
  FolderKanban,
} from 'lucide-react';
import { Book, Progress, Palette, Playlist } from '../types';
import {
  CURATED_PALETTES,
  generateCoverSvg,
  generatePeaks,
} from '../data/mockData';
import { formatDurationNumeric } from './ProgressBar';

export interface ScannedBookCandidate {
  id: string;
  title: string;
  folderPath: string;
  detectedType: 'multi-chapter' | 'all-in-one';
  peaks: number[];
  embeddedChapters?: {
    id: string;
    title: string;
    startMs: number;
    endMs: number;
    streamUrl: string;
  }[];
  files: {
    name: string;
    chapterTitle: string;
    path: string;
    format: string;
    sizeBytes: number;
    streamUrl: string;
  }[];
}

interface LibraryViewProps {
  books: Book[];
  progressMap: Record<string, Progress>;
  currentBookId: string;
  isPlaying: boolean;
  palette: Palette;
  playlists: Playlist[];
  activeFilter: { type: string; value: string } | null;
  onClearFilter: () => void;
  onSelectBook: (book: Book) => void;
  onPlayNext: (book: Book) => void;
  onAddToQueue: (book: Book) => void;
  onAddToPlaylist: (playlistId: string, bookId: string) => void;
  onToggleFavorite: (bookId: string) => void;
  onMoveBookOrder: (bookId: string, dir: 'up' | 'down' | 'top') => void;
  onOpenMetadataEditor: (
    book: Book,
    initialTab?: 'core' | 'chapters' | 'cover'
  ) => void;
  onOpenTranscript: (book: Book) => void;
  onRemoveBook: (bookId: string) => void;
  onImportBooks: (newBooks: Book[]) => void;
  onUpdateBook?: (updated: Book) => void;
  onLoadRealLibriVox?: (identifier: string) => void;
  externalOpenScannerMode?: 'auto-root' | 'single-book' | null;
  onClearExternalScannerMode?: () => void;
  squareCorners: boolean;
}

function cleanChapterTitle(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  progressMap,
  currentBookId,
  isPlaying,
  palette,
  playlists,
  activeFilter,
  onClearFilter,
  onSelectBook,
  onAddToQueue,
  onToggleFavorite,
  onOpenMetadataEditor,
  onRemoveBook,
  onImportBooks,
  onUpdateBook,
  onLoadRealLibriVox,
  externalOpenScannerMode,
  onClearExternalScannerMode,
  squareCorners,
}) => {
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<
    'none' | 'group' | 'author' | 'format' | 'status'
  >('none');
  const [propertiesBook, setPropertiesBook] = useState<Book | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    book: Book;
    x: number;
    y: number;
  } | null>(null);

  // Dropdown on the Library + icon
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  // Local Filesystem Folder Browser & Auto-Detector Modal (No file uploads — saves paths to ~/.tide/all.json)
  const [scannerMode, setScannerMode] = useState<'auto-root' | 'single-book' | null>(
    null
  );
  const [browseDir, setBrowseDir] = useState<string>('~');
  const [parentDir, setParentDir] = useState<string>('');
  const [subDirs, setSubDirs] = useState<{ name: string; path: string }[]>([]);
  const [dirAudioFiles, setDirAudioFiles] = useState<
    { name: string; path: string; sizeBytes: number }[]
  >([]);
  const [tideJsonPath, setTideJsonPath] = useState<string>('~/.tide/all.json');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Pending Scanned Books (with optional chapter reordering before saving to ~/.tide/all.json)
  const [pendingImports, setPendingImports] = useState<
    ScannedBookCandidate[] | null
  >(null);
  const [activePendingIdx, setActivePendingIdx] = useState(0);

  // 3D Card Tilt state per card
  const [hoveredCard, setHoveredCard] = useState<{
    id: string;
    rx: number;
    ry: number;
    gx: number;
    gy: number;
  } | null>(null);

  const radiusClass = squareCorners ? 'rounded-none' : 'rounded-2xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  // Load directory listing when Folder Browser opens
  const fetchDirectoryListing = async (targetPath: string) => {
    setScanError(null);
    try {
      const resp = await fetch(
        `/api/fs/browse?dir=${encodeURIComponent(targetPath)}`
      );
      const data = await resp.json();
      if (resp.ok) {
        setBrowseDir(data.currentDir);
        setParentDir(data.parentDir);
        setSubDirs(data.directories || []);
        setDirAudioFiles(data.audioFiles || []);
        if (data.tideJsonPath) setTideJsonPath(data.tideJsonPath);
      } else {
        setScanError(data.error || 'Directory not found');
      }
    } catch {
      setScanError('Could not browse directory');
    }
  };

  useEffect(() => {
    if (externalOpenScannerMode) {
      setScannerMode(externalOpenScannerMode);
      fetchDirectoryListing(browseDir || '~');
      if (onClearExternalScannerMode) onClearExternalScannerMode();
    }
  }, [externalOpenScannerMode]);

  const openFolderScanner = (mode: 'auto-root' | 'single-book') => {
    setScannerMode(mode);
    setPendingImports(null);
    fetchDirectoryListing(browseDir || '~');
  };

  const handleScanDirectoryPath = async (
    dirPathToScan: string,
    mode: 'auto-root' | 'single-book'
  ) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const resp = await fetch('/api/fs/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dirPath: dirPathToScan, mode }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setScanError(data.error || 'Could not scan directory');
        return;
      }

      const detected: any[] = data.detectedBooks || [];
      if (detected.length === 0) {
        setScanError(
          'No audio or .mp4/.m4b/.mp3 files found in this folder or its child folders.'
        );
        return;
      }

      const candidates: ScannedBookCandidate[] = detected.map((d, idx) => ({
        id: `scan-${Date.now()}-${idx}`,
        title: d.title || 'Audiobook',
        folderPath: d.folderPath || dirPathToScan,
        detectedType: d.detectedType || 'multi-chapter',
        peaks:
          Array.isArray(d.peaks) && d.peaks.length > 0
            ? d.peaks
            : generatePeaks(Date.now() + idx),
        embeddedChapters: Array.isArray(d.embeddedChapters)
          ? d.embeddedChapters
          : undefined,
        files: (d.files || []).map((f: any) => ({
          name: f.name,
          chapterTitle: cleanChapterTitle(f.name),
          path: f.path,
          format: f.format || 'MP4',
          sizeBytes: f.sizeBytes || 0,
          streamUrl: f.streamUrl,
        })),
      }));

      setPendingImports(candidates);
      setActivePendingIdx(0);
    } catch {
      setScanError('Failed to scan folder');
    } finally {
      setIsScanning(false);
    }
  };

  const finalizePendingImport = () => {
    if (!pendingImports || pendingImports.length === 0) return;

    const shapes: Array<'orbit' | 'waves' | 'grid' | 'eclipse' | 'prism' | 'dunes'> = [
      'orbit',
      'waves',
      'grid',
      'eclipse',
      'prism',
      'dunes',
    ];

    const createdBooks: Book[] = pendingImports.map((pending, idx) => {
      const bookId = `book-${Date.now()}-${idx}`;
      const bookPalette =
        CURATED_PALETTES[(books.length + idx) % CURATED_PALETTES.length];
      const shape = shapes[(books.length + idx) % shapes.length];

      const chapters = pending.files.map((f, chIdx) => {
        const estDurMs = Math.max(
          60000,
          Math.round((f.sizeBytes / (64 * 125)) * 1000)
        );
        return {
          id: `${bookId}-ch-${chIdx + 1}`,
          title:
            pending.detectedType === 'all-in-one'
              ? pending.title
              : f.chapterTitle || `Chapter ${chIdx + 1}`,
          durMs: estDurMs,
          streamUrl: f.streamUrl,
          sizeBytes: f.sizeBytes,
          format: f.format,
          path: f.path,
          rawName: f.name,
        };
      });

      let cumulativeMs = 0;
      const fileChapters = chapters.map((ch) => {
        const startMs = cumulativeMs;
        cumulativeMs += ch.durMs;
        return {
          id: ch.id,
          title: ch.title,
          startMs,
          endMs: cumulativeMs,
          streamUrl: ch.streamUrl,
        };
      });

      const finalChapters =
        pending.embeddedChapters && pending.embeddedChapters.length > 0
          ? pending.embeddedChapters
          : fileChapters;

      return {
        id: bookId,
        title: pending.title,
        authors: ['Local Library'],
        narrators: [''],
        tags: [
          pending.detectedType === 'all-in-one' ? 'Single-File' : 'Multi-Chapter',
        ],
        genres: ['Audiobook'],
        folderPath: pending.folderPath,
        importMode:
          pending.detectedType === 'all-in-one' ? 'single-book' : 'root-library',
        cover: generateCoverSvg(pending.title, '', bookPalette, shape),
        palette: bookPalette,
        peaks: pending.peaks,
        durationMs: cumulativeMs || 3600000,
        addedAt: Date.now(),
        files: pending.files.map((f, i) => ({
          path: f.path,
          name: f.name,
          format: f.format,
          sizeBytes: f.sizeBytes,
          durationMs:
            fileChapters[i]?.endMs - fileChapters[i]?.startMs || cumulativeMs,
          bitrateKbps: 128,
          objectUrl: f.streamUrl,
        })),
        chapters: finalChapters,
      };
    });

    onImportBooks(createdBooks);
    setPendingImports(null);
    setScannerMode(null);
  };

  const movePendingChapter = (bookIdx: number, chIdx: number, dir: 'up' | 'down') => {
    if (!pendingImports) return;
    const copy = [...pendingImports];
    const target = { ...copy[bookIdx], files: [...copy[bookIdx].files] };
    const swapIdx = dir === 'up' ? chIdx - 1 : chIdx + 1;
    if (swapIdx < 0 || swapIdx >= target.files.length) return;
    const temp = target.files[chIdx];
    target.files[chIdx] = target.files[swapIdx];
    target.files[swapIdx] = temp;
    copy[bookIdx] = target;
    setPendingImports(copy);
  };

  const reversePendingChapters = (bookIdx: number) => {
    if (!pendingImports) return;
    const copy = [...pendingImports];
    copy[bookIdx] = {
      ...copy[bookIdx],
      files: [...copy[bookIdx].files].reverse(),
    };
    setPendingImports(copy);
  };

  const naturalSortPendingChapters = (bookIdx: number) => {
    if (!pendingImports) return;
    const copy = [...pendingImports];
    copy[bookIdx] = {
      ...copy[bookIdx],
      files: [...copy[bookIdx].files].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      ),
    };
    setPendingImports(copy);
  };

  const filteredBooks = useMemo(() => {
    let list = [...books];

    if (activeFilter) {
      if (activeFilter.type === 'author') {
        list = list.filter((b) => b.authors.includes(activeFilter.value));
      } else if (activeFilter.type === 'series') {
        list = list.filter((b) => b.series?.name === activeFilter.value);
      } else if (activeFilter.type === 'tag') {
        list = list.filter(
          (b) =>
            b.tags.includes(activeFilter.value) ||
            b.genres.includes(activeFilter.value)
        );
      } else if (activeFilter.type === 'playlist') {
        const pl = playlists.find((p) => p.id === activeFilter.value);
        if (pl) list = list.filter((b) => pl.bookIds.includes(b.id));
      } else if (activeFilter.type === 'folder') {
        list = list.filter((b) => b.folderPath.startsWith(activeFilter.value));
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.authors.some((a) => a.toLowerCase().includes(q)) ||
          (b.series?.name && b.series.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [books, search, activeFilter, playlists]);

  const groupedSections = useMemo(() => {
    if (groupBy === 'none') {
      return [{ title: 'All Books', items: filteredBooks }];
    }
    const map = new Map<string, Book[]>();
    for (const b of filteredBooks) {
      let key = 'General';
      if (groupBy === 'group') {
        if (b.group) key = b.group;
        else if (b.favorite) key = 'Favorites';
        else if (b.genres[0]) key = b.genres[0];
        else if (b.tags[0]) key = b.tags[0];
        else key = 'Library Collection';
      } else if (groupBy === 'author') {
        key = b.authors[0] || 'Unknown Author';
      } else if (groupBy === 'format') {
        const fmt = b.files[0]?.format || 'MP3';
        const mode =
          b.chapters.length > 1 ? 'Multi-Chapter' : 'Single-File';
        key = `${fmt.toUpperCase()} · ${mode}`;
      } else if (groupBy === 'status') {
        const p = progressMap[b.id];
        if (p?.finished) key = 'Finished';
        else if (p && p.positionMs > 5000) key = 'In Progress';
        else key = 'Unplayed';
      }
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([title, items]) => ({
      title,
      items,
    }));
  }, [filteredBooks, groupBy, progressMap]);

  return (
    <div
      onClick={() => {
        setContextMenu(null);
        setShowPlusMenu(false);
      }}
      className="h-full overflow-y-auto px-8 py-6 space-y-6 select-none relative max-w-6xl mx-auto w-full animate-enter"
    >
      {/* Top Bar: Search + Group By Pills + Plus Dropdown Menu */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-white/35 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter library..."
            className={`w-full pl-11 pr-9 py-3 ${pillRadius} ambient-surface text-sm text-white placeholder:text-white/30 focus:bg-white/[0.08] transition-all`}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Library Group By Selector */}
          <div className={`flex items-center gap-1 p-1 ${pillRadius} ambient-surface`}>
            {(
              [
                { id: 'none', label: 'All' },
                { id: 'group', label: 'Groups' },
                { id: 'author', label: 'Author' },
                { id: 'format', label: 'Format' },
                { id: 'status', label: 'Status' },
              ] as const
            ).map((g) => (
              <button
                key={g.id}
                onClick={() => setGroupBy(g.id)}
                className={`px-3 py-1.5 ${pillRadius} text-xs font-mono transition-all ${
                  groupBy === g.id
                    ? 'bg-white text-black font-medium'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          {activeFilter && (
            <button
              onClick={onClearFilter}
              className={`px-3.5 py-2.5 ${pillRadius} ambient-surface text-xs text-white/80 flex items-center gap-2`}
            >
              <span>{activeFilter.value}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Plus Icon with Dropdown Menu in Library */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowPlusMenu((s) => !s)}
              className={`p-3 ${pillRadius} text-black transition-transform active:scale-95 flex items-center gap-1.5`}
              style={{ backgroundColor: palette.vibrant }}
              title="Add folder path to ~/.tide/all.json"
            >
              <Plus className="w-4 h-4" />
            </button>

            {showPlusMenu && (
              <div
                className={`absolute right-0 mt-2 w-76 p-2 ${radiusClass} backdrop-blur-3xl bg-zinc-950/90 shadow-2xl space-y-1 text-xs z-50 animate-enter`}
              >
                <button
                  onClick={() => {
                    openFolderScanner('auto-root');
                    setShowPlusMenu(false);
                  }}
                  className={`w-full px-3.5 py-2.5 ${pillRadius} hover:bg-white/10 text-left flex items-start gap-3 transition-colors`}
                >
                  <Folders
                    className="w-4 h-4 mt-0.5 shrink-0"
                    style={{ color: palette.vibrant }}
                  />
                  <div>
                    <div className="font-medium text-white">
                      Add Root Folder (Child Folders = Books)
                    </div>
                    <div className="text-[11px] text-white/45 mt-0.5">
                      Auto-detects child folders (chap1.mp4... or single mp4) & saves paths to .tide/all.json
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    openFolderScanner('single-book');
                    setShowPlusMenu(false);
                  }}
                  className={`w-full px-3.5 py-2.5 ${pillRadius} hover:bg-white/10 text-left flex items-start gap-3 transition-colors`}
                >
                  <FolderPlus className="w-4 h-4 mt-0.5 shrink-0 text-white/70" />
                  <div>
                    <div className="font-medium text-white">
                      Add Single Book Folder
                    </div>
                    <div className="text-[11px] text-white/45 mt-0.5">
                      Treat selected directory as one book & save location to .tide/all.json
                    </div>
                  </div>
                </button>

                {onLoadRealLibriVox && (
                  <button
                    onClick={() => {
                      onLoadRealLibriVox('art_of_war_librivox');
                      setShowPlusMenu(false);
                    }}
                    className={`w-full px-3.5 py-2.5 ${pillRadius} hover:bg-white/10 text-left flex items-center gap-3 transition-colors`}
                  >
                    <Headphones className="w-4 h-4 shrink-0 text-white/70" />
                    <span className="font-medium text-white/80">
                      Add Public-Domain Stream
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cover Grid (with Optional Grouping) & 3D Cursor-Reactive Tilt */}
      {filteredBooks.length > 0 ? (
        <div className="space-y-8">
          {groupedSections.map((section) => (
            <div key={section.title} className="space-y-3.5">
              {groupBy !== 'none' && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: palette.vibrant }}
                    />
                    <h3 className="text-xs font-mono uppercase tracking-wider text-white/80">
                      {section.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-[10px] font-mono text-white/45">
                      {section.items.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-white/35">
                    {formatDurationNumeric(
                      section.items.reduce((a, b) => a + b.durationMs, 0)
                    )}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {section.items.map((book) => {
                  const prog = progressMap[book.id];
                  const pct = prog
                    ? Math.min(
                        100,
                        Math.round((prog.positionMs / book.durationMs) * 100)
                      )
                    : 0;
                  const isCurrent = book.id === currentBookId;
                  const cardTilt =
                    hoveredCard && hoveredCard.id === book.id
                      ? hoveredCard
                      : null;

                  return (
                    <div
                      key={book.id}
                      onClick={() => onSelectBook(book)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ book, x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = (e.clientX - rect.left) / rect.width;
                        const y = (e.clientY - rect.top) / rect.height;
                        setHoveredCard({
                          id: book.id,
                          rx: (0.5 - y) * 18,
                          ry: (x - 0.5) * 18,
                          gx: Math.round(x * 100),
                          gy: Math.round(y * 100),
                        });
                      }}
                      onMouseLeave={() => setHoveredCard(null)}
                      style={{ perspective: '700px' }}
                      className="group relative cursor-pointer"
                    >
                      <div
                        className={`relative aspect-square overflow-hidden ${radiusClass} bg-white/[0.03] shadow-2xl`}
                        style={{
                          transform: cardTilt
                            ? `rotateX(${cardTilt.rx.toFixed(
                                1
                              )}deg) rotateY(${cardTilt.ry.toFixed(
                                1
                              )}deg) translateY(-4px) scale3d(1.03, 1.03, 1.03)`
                            : 'rotateX(0deg) rotateY(0deg) translateY(0px) scale3d(1, 1, 1)',
                          transition: cardTilt
                            ? 'transform 70ms cubic-bezier(0.22, 1, 0.36, 1)'
                            : 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
                        }}
                      >
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />

                        {book.group && (
                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full backdrop-blur-xl bg-black/65 text-[10px] font-mono text-white/85">
                            {book.group}
                          </div>
                        )}

                        <div
                          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                          style={{
                            opacity: cardTilt ? 1 : 0,
                            background: cardTilt
                              ? `radial-gradient(circle at ${cardTilt.gx}% ${cardTilt.gy}%, rgba(255,255,255,0.22) 0%, transparent 65%)`
                              : 'none',
                          }}
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                          <p className="text-xs font-medium text-white line-clamp-2 leading-snug">
                            {book.title}
                          </p>
                          <p className="text-[11px] text-white/55 truncate mt-0.5">
                            {book.chapters.length} ch ·{' '}
                            {formatDurationNumeric(book.durationMs)}
                          </p>

                          <div className="mt-3 flex items-center justify-between">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-black shadow-lg"
                              style={{ backgroundColor: book.palette.vibrant }}
                            >
                              {isCurrent && isPlaying ? (
                                <Pause className="w-4 h-4 fill-current" />
                              ) : (
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPropertiesBook(book);
                                }}
                                className="p-1.5 rounded-full bg-black/50 text-white/80 hover:text-white"
                                title="Properties (Format, Size, Tags, Chapters)"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFavorite(book.id);
                                }}
                                className="p-1.5 rounded-full bg-black/50 text-white/80 hover:text-rose-400"
                              >
                                <Heart
                                  className={`w-3.5 h-3.5 ${
                                    book.favorite
                                      ? 'fill-rose-500 text-rose-500'
                                      : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {pct > 0 && (
                          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/50">
                            <div
                              className="h-full"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: book.palette.vibrant,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-28 flex flex-col items-center justify-center text-center space-y-5">
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={() => openFolderScanner('auto-root')}
              className={`px-5 py-3 ${pillRadius} text-xs font-medium text-black flex items-center gap-2 transition-transform active:scale-95`}
              style={{ backgroundColor: palette.vibrant }}
            >
              <Folders className="w-4 h-4" />
              <span>Add Root Folder</span>
            </button>

            <button
              onClick={() => openFolderScanner('single-book')}
              className={`px-5 py-3 ${pillRadius} ambient-surface ambient-surface-hover text-xs font-medium text-white/85 flex items-center gap-2`}
            >
              <FolderPlus className="w-4 h-4" />
              <span>Add Book Folder</span>
            </button>
          </div>
        </div>
      )}

      {/* Local Filesystem Folder Browser & Chapter Order Modal (Saves to ~/.tide/all.json, zero uploading!) */}
      {scannerMode && (
        <div
          onClick={() => {
            setScannerMode(null);
            setPendingImports(null);
          }}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-2xl flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl p-6 ${radiusClass} backdrop-blur-3xl bg-zinc-950/90 shadow-2xl space-y-5 text-xs animate-enter max-h-[85vh] flex flex-col`}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">
                  {pendingImports
                    ? `Detected Books (${pendingImports.length})`
                    : scannerMode === 'auto-root'
                    ? 'Add Root Folder (Each Child Folder = 1 Book)'
                    : 'Add Single Book Folder'}
                </h3>
                <p className="text-[11px] font-mono text-white/40 mt-0.5">
                  Saved to {tideJsonPath} (No file upload)
                </p>
              </div>
              <button
                onClick={() => {
                  setScannerMode(null);
                  setPendingImports(null);
                }}
                className="p-1.5 rounded-full text-white/45 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!pendingImports ? (
              <>
                {/* Path Input + Mode Switcher */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={browseDir}
                    onChange={(e) => setBrowseDir(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        fetchDirectoryListing(browseDir);
                      }
                    }}
                    placeholder="/path/to/audiobooks"
                    className={`flex-1 px-3.5 py-2.5 ${pillRadius} bg-white/[0.06] text-white font-mono text-xs`}
                  />
                  <button
                    onClick={() => fetchDirectoryListing(browseDir)}
                    className={`px-3.5 py-2.5 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.15] text-white font-mono`}
                  >
                    Browse
                  </button>
                  <button
                    onClick={() =>
                      setScannerMode((m) =>
                        m === 'auto-root' ? 'single-book' : 'auto-root'
                      )
                    }
                    className={`px-3 py-2.5 ${pillRadius} bg-white/[0.05] text-white/70 font-mono`}
                    title="Switch between Root Folder (child folders = books) and Single Book Folder"
                  >
                    {scannerMode === 'auto-root' ? 'Root Mode' : 'Single Book'}
                  </button>
                </div>

                {scanError && (
                  <div className="px-3.5 py-2 rounded-xl bg-rose-500/15 text-rose-300 font-mono text-[11px]">
                    {scanError}
                  </div>
                )}

                {/* Directory Browser List */}
                <div className="flex-1 overflow-y-auto space-y-1 max-h-64 pr-1 bg-white/[0.02] p-2 rounded-2xl">
                  {parentDir && parentDir !== browseDir && (
                    <button
                      onClick={() => fetchDirectoryListing(parentDir)}
                      className={`w-full px-3 py-2 ${pillRadius} hover:bg-white/[0.07] flex items-center gap-2.5 text-white/60`}
                    >
                      <CornerLeftUp className="w-3.5 h-3.5" />
                      <span className="font-mono">.. (Parent Directory)</span>
                    </button>
                  )}

                  {subDirs.map((d) => (
                    <div
                      key={d.path}
                      className={`px-3 py-2 ${pillRadius} hover:bg-white/[0.07] flex items-center justify-between gap-2 transition-colors`}
                    >
                      <button
                        onClick={() => fetchDirectoryListing(d.path)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left text-white/85"
                      >
                        <Folder
                          className="w-4 h-4 shrink-0"
                          style={{ color: palette.vibrant }}
                        />
                        <span className="truncate">{d.name}</span>
                      </button>
                      <button
                        onClick={() => handleScanDirectoryPath(d.path, scannerMode)}
                        className={`px-2.5 py-1 ${pillRadius} bg-white/[0.07] hover:bg-white text-white/80 hover:text-black font-mono text-[11px]`}
                      >
                        Select
                      </button>
                    </div>
                  ))}

                  {dirAudioFiles.map((af) => (
                    <div
                      key={af.path}
                      className="px-3 py-1.5 flex items-center justify-between text-white/45 font-mono text-[11px]"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FileAudio className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{af.name}</span>
                      </span>
                      <span className="shrink-0 ml-2">
                        {(af.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setScannerMode(null)}
                    className={`px-4 py-2.5 ${pillRadius} bg-white/[0.06] text-white/70 hover:text-white`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleScanDirectoryPath(browseDir, scannerMode)}
                    disabled={isScanning}
                    className={`px-5 py-2.5 ${pillRadius} text-black font-medium flex items-center gap-2`}
                    style={{ backgroundColor: palette.vibrant }}
                  >
                    {isScanning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Scan Current Folder</span>
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: Review Auto-Detected Books & Optionally Reorder Chapters */
              <>
                {pendingImports.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {pendingImports.map((pb, idx) => (
                      <button
                        key={pb.id}
                        onClick={() => setActivePendingIdx(idx)}
                        className={`px-3 py-1.5 ${pillRadius} font-mono text-[11px] shrink-0 transition-all ${
                          activePendingIdx === idx
                            ? 'bg-white/20 text-white font-medium'
                            : 'bg-white/[0.04] text-white/50 hover:text-white'
                        }`}
                      >
                        {pb.title} ({pb.files.length})
                      </button>
                    ))}
                  </div>
                )}

                {pendingImports[activePendingIdx] && (
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        value={pendingImports[activePendingIdx].title}
                        onChange={(e) => {
                          const copy = [...pendingImports];
                          copy[activePendingIdx] = {
                            ...copy[activePendingIdx],
                            title: e.target.value,
                          };
                          setPendingImports(copy);
                        }}
                        className={`flex-1 px-3.5 py-2 ${pillRadius} bg-white/[0.06] text-white text-sm font-medium`}
                      />

                      <span
                        className={`px-3 py-2 ${pillRadius} font-mono text-[11px] ${
                          pendingImports[activePendingIdx].detectedType ===
                          'all-in-one'
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {pendingImports[activePendingIdx].detectedType ===
                        'all-in-one'
                          ? 'Auto: Single All-in-One File'
                          : `Auto: ${pendingImports[activePendingIdx].files.length} Chapters`}
                      </span>
                    </div>

                    {pendingImports[activePendingIdx].files.length > 1 && (
                      <div className="flex items-center justify-between text-[11px] text-white/45 px-1">
                        <span>Chapters (Optional Reorder)</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              naturalSortPendingChapters(activePendingIdx)
                            }
                            className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/75 flex items-center gap-1"
                          >
                            <ArrowUpDown className="w-3 h-3" />
                            <span>Natural Sort (1→9)</span>
                          </button>
                          <button
                            onClick={() => reversePendingChapters(activePendingIdx)}
                            className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/75"
                          >
                            Reverse
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {pendingImports[activePendingIdx].files.map((chFile, chIdx) => (
                        <div
                          key={`${chFile.path}-${chIdx}`}
                          className={`px-3 py-2 ${pillRadius} bg-white/[0.04] flex items-center justify-between gap-3`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="font-mono text-[11px] text-white/35 w-6">
                              {chIdx + 1}.
                            </span>
                            <input
                              type="text"
                              value={chFile.chapterTitle}
                              onChange={(e) => {
                                const copy = [...pendingImports];
                                const filesCopy = [
                                  ...copy[activePendingIdx].files,
                                ];
                                filesCopy[chIdx] = {
                                  ...filesCopy[chIdx],
                                  chapterTitle: e.target.value,
                                };
                                copy[activePendingIdx] = {
                                  ...copy[activePendingIdx],
                                  files: filesCopy,
                                };
                                setPendingImports(copy);
                              }}
                              className="bg-transparent text-white text-xs flex-1 min-w-0"
                            />
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[10px] text-white/35">
                              {chFile.format}
                            </span>
                            {pendingImports[activePendingIdx].files.length > 1 && (
                              <>
                                <button
                                  onClick={() =>
                                    movePendingChapter(
                                      activePendingIdx,
                                      chIdx,
                                      'up'
                                    )
                                  }
                                  disabled={chIdx === 0}
                                  className="p-1 text-white/45 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    movePendingChapter(
                                      activePendingIdx,
                                      chIdx,
                                      'down'
                                    )
                                  }
                                  disabled={
                                    chIdx ===
                                    pendingImports[activePendingIdx].files.length - 1
                                  }
                                  className="p-1 text-white/45 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setPendingImports(null)}
                    className={`px-4 py-2.5 ${pillRadius} bg-white/[0.06] text-white/70 hover:text-white`}
                  >
                    Back
                  </button>
                  <button
                    onClick={finalizePendingImport}
                    className={`px-5 py-2.5 ${pillRadius} text-black font-medium flex items-center gap-1.5`}
                    style={{ backgroundColor: palette.vibrant }}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      Save {pendingImports.length}{' '}
                      {pendingImports.length === 1 ? 'Book' : 'Books'} to .tide/all.json
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upgraded Context Menu with Properties, Goodreads Cover Search & Group Assignment */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            top: Math.min(window.innerHeight - 330, contextMenu.y),
            left: Math.min(window.innerWidth - 235, contextMenu.x),
          }}
          className={`fixed z-50 w-56 p-2 ${radiusClass} ambient-popover text-xs space-y-1 animate-enter`}
        >
          <button
            onClick={() => {
              onSelectBook(contextMenu.book);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white font-medium"
          >
            <Play
              className="w-3.5 h-3.5 fill-current"
              style={{ color: palette.vibrant }}
            />
            <span>Play Now</span>
          </button>

          <button
            onClick={() => {
              onAddToQueue(contextMenu.book);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/85"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Queue Book</span>
          </button>

          <button
            onClick={() => {
              onOpenMetadataEditor(contextMenu.book, 'cover');
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/85"
          >
            <Sparkles
              className="w-3.5 h-3.5"
              style={{ color: palette.vibrant }}
            />
            <span>Find Cover (Audnexus / Goodreads)</span>
          </button>

          <button
            onClick={() => {
              onOpenMetadataEditor(contextMenu.book, 'chapters');
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 font-medium"
          >
            <Clock
              className="w-3.5 h-3.5"
              style={{ color: palette.light }}
            />
            <span>Search Chapter Times (Audnexus / M4B)</span>
          </button>

          <button
            onClick={() => {
              onOpenMetadataEditor(contextMenu.book, 'core');
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/85"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Metadata</span>
          </button>

          {/* Quick Assign Group */}
          <div className="px-3 py-1.5 space-y-1.5 bg-white/[0.03] rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <FolderKanban className="w-3 h-3" />
              <span>Assign Group</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {['Sci-Fi', 'Classics', 'Favorites', '2026', 'None'].map((grp) => (
                <button
                  key={grp}
                  onClick={() => {
                    if (onUpdateBook) {
                      onUpdateBook({
                        ...contextMenu.book,
                        group: grp === 'None' ? undefined : grp,
                      });
                    }
                    setContextMenu(null);
                  }}
                  className={`px-2 py-0.5 rounded-md font-mono text-[10px] ${
                    (contextMenu.book.group || 'None') === grp
                      ? 'bg-white text-black font-medium'
                      : 'bg-white/[0.06] text-white/65 hover:text-white'
                  }`}
                >
                  {grp}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setPropertiesBook(contextMenu.book);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-white/90 font-medium"
          >
            <Info className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
            <span>Properties (Format, Size, Tags)</span>
          </button>

          <button
            onClick={() => {
              onRemoveBook(contextMenu.book.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 rounded-xl hover:bg-rose-500/20 flex items-center gap-2.5 text-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      )}

      {/* Book Properties Inspector Modal (Format, Size, Bitrate, Tags, Files, Folder Path) */}
      {propertiesBook && (
        <div
          onClick={() => setPropertiesBook(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl p-6 ${radiusClass} ambient-popover space-y-5 text-xs animate-enter max-h-[86vh] overflow-y-auto`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={propertiesBook.cover}
                  alt={propertiesBook.title}
                  className={`w-20 h-20 ${pillRadius} object-cover shadow-2xl shrink-0`}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-black font-semibold"
                      style={{ backgroundColor: propertiesBook.palette.vibrant }}
                    >
                      {propertiesBook.files[0]?.format || 'MP3'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-white/80">
                      {propertiesBook.files[0]?.bitrateKbps || 64} kbps · 44.1 kHz
                    </span>
                    {propertiesBook.group && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-white/80">
                        Group: {propertiesBook.group}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-medium text-white truncate">
                    {propertiesBook.title}
                  </h3>
                  <p className="text-xs text-white/55 truncate">
                    {propertiesBook.authors.join(', ') || 'Unknown Author'}
                    {propertiesBook.narrators[0]
                      ? ` · Narrated by ${propertiesBook.narrators.join(', ')}`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPropertiesBook(null)}
                className="p-2 rounded-xl bg-white/[0.05] text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Key Technical Specs Grid */}
            {(() => {
              const totalBytes = propertiesBook.files.reduce(
                (acc, f) => acc + (f.sizeBytes || 0),
                0
              );
              const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className={`p-3.5 ${pillRadius} bg-white/[0.04] space-y-1`}>
                    <div className="text-[10px] font-mono uppercase text-white/40 flex items-center gap-1.5">
                      <FileAudio className="w-3 h-3" />
                      <span>Format & Codec</span>
                    </div>
                    <div className="text-sm font-mono text-white">
                      {propertiesBook.files[0]?.format || 'MP3'} ·{' '}
                      {propertiesBook.files[0]?.bitrateKbps || 64}k
                    </div>
                  </div>

                  <div className={`p-3.5 ${pillRadius} bg-white/[0.04] space-y-1`}>
                    <div className="text-[10px] font-mono uppercase text-white/40 flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3" />
                      <span>Total File Size</span>
                    </div>
                    <div className="text-sm font-mono text-white">
                      {totalMb} MB
                    </div>
                    <div className="text-[10px] font-mono text-white/35">
                      {totalBytes.toLocaleString()} bytes
                    </div>
                  </div>

                  <div className={`p-3.5 ${pillRadius} bg-white/[0.04] space-y-1`}>
                    <div className="text-[10px] font-mono uppercase text-white/40 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>Duration</span>
                    </div>
                    <div className="text-sm font-mono text-white">
                      {formatDurationNumeric(propertiesBook.durationMs)}
                    </div>
                    <div className="text-[10px] font-mono text-white/35">
                      {propertiesBook.chapters.length} chapters
                    </div>
                  </div>

                  <div className={`p-3.5 ${pillRadius} bg-white/[0.04] space-y-1`}>
                    <div className="text-[10px] font-mono uppercase text-white/40 flex items-center gap-1.5">
                      <Layers className="w-3 h-3" />
                      <span>Structure</span>
                    </div>
                    <div className="text-sm font-mono text-white">
                      {propertiesBook.files.length > 1
                        ? 'Multi-File'
                        : 'Single-File'}
                    </div>
                    <div className="text-[10px] font-mono text-white/35">
                      {propertiesBook.files.length} audio{' '}
                      {propertiesBook.files.length === 1 ? 'file' : 'files'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tags, Genres & Group */}
            <div className={`p-4 ${pillRadius} bg-white/[0.03] space-y-2.5`}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                <span>Tags, Genres & Collection Group</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {propertiesBook.group && (
                  <span
                    className="px-2.5 py-1 rounded-lg font-mono text-[11px] text-black font-medium"
                    style={{ backgroundColor: propertiesBook.palette.vibrant }}
                  >
                    Group: {propertiesBook.group}
                  </span>
                )}
                {propertiesBook.genres.map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 rounded-lg bg-white/10 font-mono text-[11px] text-white/85"
                  >
                    {g}
                  </span>
                ))}
                {propertiesBook.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] font-mono text-[11px] text-white/70"
                  >
                    #{t}
                  </span>
                ))}
                {propertiesBook.genres.length === 0 &&
                  propertiesBook.tags.length === 0 &&
                  !propertiesBook.group && (
                    <span className="text-white/35 font-mono text-[11px]">
                      No tags assigned
                    </span>
                  )}
              </div>
            </div>

            {/* Disk Path & Chapter Files Breakdown */}
            <div className={`p-4 ${pillRadius} bg-white/[0.03] space-y-2.5`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                  Filesystem Location (~/.tide/all.json)
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  Direct HTTP 206 Range Stream
                </span>
              </div>
              <div className="font-mono text-[11px] text-white/80 bg-black/40 px-3 py-2 rounded-xl break-all">
                {propertiesBook.folderPath}
              </div>

              <div className="space-y-1 max-h-44 overflow-y-auto pt-1">
                {propertiesBook.files.map((f, idx) => (
                  <div
                    key={`${f.path}-${idx}`}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.03] font-mono text-[11px]"
                  >
                    <span className="text-white/80 truncate pr-3">
                      {idx + 1}. {f.name}
                    </span>
                    <span className="text-white/45 shrink-0">
                      {f.format} · {((f.sizeBytes || 0) / (1024 * 1024)).toFixed(2)} MB ·{' '}
                      {formatDurationNumeric(f.durationMs)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  const target = propertiesBook;
                  setPropertiesBook(null);
                  onOpenMetadataEditor(target, 'cover');
                }}
                className={`px-4 py-2 ${pillRadius} bg-white/[0.07] hover:bg-white/[0.14] text-white flex items-center gap-2`}
              >
                <Sparkles
                  className="w-3.5 h-3.5"
                  style={{ color: propertiesBook.palette.vibrant }}
                />
                <span>Search Cover (Goodreads / APIs)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const target = propertiesBook;
                    setPropertiesBook(null);
                    onOpenMetadataEditor(target, 'core');
                  }}
                  className={`px-4 py-2 ${pillRadius} bg-white/[0.07] hover:bg-white/[0.14] text-white flex items-center gap-1.5`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Metadata</span>
                </button>
                <button
                  onClick={() => {
                    const target = propertiesBook;
                    setPropertiesBook(null);
                    onSelectBook(target);
                  }}
                  className={`px-5 py-2 ${pillRadius} text-black font-semibold flex items-center gap-1.5`}
                  style={{ backgroundColor: propertiesBook.palette.vibrant }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
