import React from 'react';
import {
  Play,
  Pause,
  ArrowRight,
  Grid,
  Layers,
  Search,
  Activity,
  Sliders,
  Headphones,
  Clock,
} from 'lucide-react';
import {
  Book,
  Palette,
  Progress,
  BgConfig,
  BgType,
  VizConfig,
  VizType,
  NavigationTab,
} from '../types';
import {
  formatDurationNumeric,
  findActiveChapterIndex,
} from './ProgressBar';

interface LandingPageProps {
  books: Book[];
  currentBook: Book;
  palette?: Palette;
  progressMap?: Record<string, Progress>;
  isPlaying: boolean;
  positionMs: number;
  onSelectBook: (book: Book) => void;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  bgConfig: BgConfig;
  onChangeBgType: (type: BgType) => void;
  vizConfig: VizConfig;
  onChangeVizType: (type: VizType) => void;
  onLaunchApp: (initialTab?: NavigationTab) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  books,
  currentBook,
  palette: propPalette,
  progressMap = {},
  isPlaying,
  positionMs,
  onSelectBook,
  onTogglePlay,
  onSeek,
  onLaunchApp,
}) => {
  const palette = propPalette || currentBook.palette;
  const safeDuration = Math.max(1, currentBook.durationMs);
  const progressRatio = Math.max(0, Math.min(1, positionMs / safeDuration));
  const progressPct = Math.round(progressRatio * 100);
  const remainingMs = Math.max(0, safeDuration - positionMs);

  const activeChapterIdx = findActiveChapterIndex(
    currentBook.chapters,
    positionMs
  );
  const activeChapter =
    currentBook.chapters[activeChapterIdx] || currentBook.chapters[0];

  const handleContinue = () => {
    if (!isPlaying) {
      onTogglePlay();
    }
    onLaunchApp('player');
  };

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden relative z-10 text-white select-none px-6 sm:px-10 py-8 pb-24">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Minimal Top Header */}
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: palette.vibrant,
                boxShadow: `0 0 12px ${palette.vibrant}`,
              }}
            />
            <span className="text-base font-semibold tracking-tight text-white/95">
              Tide
            </span>
          </div>

          <nav className="flex items-center gap-1.5">
            {(
              [
                { id: 'library', label: 'Library', icon: Grid },
                { id: 'queue', label: 'Queue', icon: Layers },
                { id: 'abb-search', label: 'Discover', icon: Search },
                { id: 'stats', label: 'Stats', icon: Activity },
                { id: 'customize', label: 'Settings', icon: Sliders },
              ] as { id: NavigationTab; label: string; icon: React.FC<any> }[]
            ).map((nav) => {
              const Icon = nav.icon;
              return (
                <button
                  key={nav.id}
                  onClick={() => onLaunchApp(nav.id)}
                  className="px-3.5 py-2 rounded-xl ambient-surface ambient-surface-hover text-xs font-medium text-white/75 hover:text-white flex items-center gap-2 transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{nav.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {/* Smart Continue Listening Hero Card */}
        <section className="rounded-3xl ambient-surface p-6 sm:p-8 transition-all">
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-7">
            {/* Active Book Cover */}
            <div
              onClick={handleContinue}
              className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shrink-0 cursor-pointer group shadow-2xl"
            >
              <img
                src={currentBook.cover}
                alt={currentBook.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-black shadow-lg"
                  style={{ backgroundColor: palette.vibrant }}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </div>
              </div>
            </div>

            {/* Active Book Details & Smart Continue Controls */}
            <div className="flex-1 min-w-0 flex flex-col justify-between text-center sm:text-left w-full">
              <div className="space-y-1.5">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-[11px] font-mono uppercase tracking-wider text-white/50">
                  <Headphones
                    className="w-3.5 h-3.5"
                    style={{ color: palette.vibrant }}
                  />
                  <span>
                    {positionMs > 0 ? 'Continue Listening' : 'Ready to Play'}
                  </span>
                  <span>·</span>
                  <span>
                    Ch {activeChapterIdx + 1} / {currentBook.chapters.length}
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white truncate">
                  {currentBook.title}
                </h1>

                <p className="text-sm text-white/60 truncate">
                  {currentBook.authors.join(', ')}
                  {activeChapter?.title ? ` · ${activeChapter.title}` : ''}
                </p>
              </div>

              {/* Scrubber & Time Telemetry */}
              <div className="my-5 space-y-2">
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = Math.max(
                      0,
                      Math.min(1, (e.clientX - rect.left) / rect.width)
                    );
                    onSeek(Math.round(ratio * safeDuration));
                  }}
                  className="h-2 w-full rounded-full bg-white/10 overflow-hidden cursor-pointer group"
                >
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${Math.max(2, progressPct)}%`,
                      backgroundColor: palette.vibrant,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-white/45">
                  <span>{formatDurationNumeric(positionMs)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDurationNumeric(remainingMs)} left ({progressPct}%)
                  </span>
                </div>
              </div>

              {/* Primary Continue Button + Player Open Button */}
              <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
                <button
                  onClick={handleContinue}
                  className="px-6 py-3 rounded-2xl text-xs font-semibold text-black flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ backgroundColor: palette.vibrant }}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>{isPlaying ? 'Now Playing' : 'Continue'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onLaunchApp('player')}
                  className="px-5 py-3 rounded-2xl text-xs font-medium ambient-surface ambient-surface-hover text-white/80 hover:text-white transition-all"
                >
                  Open Player
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Smart Shelf: Your Audiobooks */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/70">Library</h2>
            <button
              onClick={() => onLaunchApp('library')}
              className="text-xs font-mono text-white/45 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>All ({books.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {books.slice(0, 8).map((book) => {
              const savedProg = progressMap[book.id];
              const bookPos =
                book.id === currentBook.id
                  ? positionMs
                  : savedProg?.positionMs || 0;
              const bookDur = Math.max(1, book.durationMs);
              const bookPct = Math.min(
                100,
                Math.round((bookPos / bookDur) * 100)
              );
              const isCurrent = book.id === currentBook.id;

              return (
                <div
                  key={book.id}
                  onClick={() => {
                    onSelectBook(book);
                    onLaunchApp('player');
                  }}
                  className="group rounded-2xl p-3 ambient-surface ambient-surface-hover cursor-pointer transition-all flex flex-col gap-3"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden">
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-black"
                        style={{
                          backgroundColor:
                            book.palette?.vibrant || palette.vibrant,
                        }}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>

                    {isCurrent && (
                      <span
                        className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono text-black font-semibold"
                        style={{ backgroundColor: palette.vibrant }}
                      >
                        Active
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {book.title}
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-mono text-white/45">
                      <span className="truncate">
                        {book.chapters.length} ch
                      </span>
                      <span>{bookPct > 0 ? `${bookPct}%` : formatDurationNumeric(book.durationMs)}</span>
                    </div>

                    {bookPct > 0 && (
                      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${bookPct}%`,
                            backgroundColor:
                              book.palette?.vibrant || palette.vibrant,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
