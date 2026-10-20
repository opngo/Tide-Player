import React, { useMemo, useState, useEffect } from 'react';
import {
  Flame,
  Clock,
  BookOpen,
  Award,
  TrendingUp,
  Calendar,
  HardDrive,
  Bookmark as BookmarkIcon,
} from 'lucide-react';
import {
  Book,
  Progress,
  Bookmark,
  Palette,
  ListeningDayRecord,
} from '../types';
import { formatDurationNumeric } from './ProgressBar';
import { ReactBitsSpotlightCard } from './ReactBitsComponents';

interface StatsViewProps {
  books: Book[];
  progressMap: Record<string, Progress>;
  listeningHistory?: Record<string, ListeningDayRecord>;
  bookmarks: Bookmark[];
  palette: Palette;
  onSelectBook: (book: Book) => void;
  squareCorners: boolean;
}

type DayCell = {
  date: string;
  seconds: number;
  minutes: number;
  level: 0 | 1 | 2 | 3 | 4;
  bookTitle?: string;
};

function toDateKey(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatRealListeningTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export const StatsView: React.FC<StatsViewProps> = ({
  books,
  progressMap,
  listeningHistory = {},
  bookmarks,
  palette,
  onSelectBook,
  squareCorners,
}) => {
  const [hoveredDay, setHoveredDay] = useState<DayCell | null>(null);
  const [animProgress, setAnimProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 750);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimProgress(eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const stats = useMemo(() => {
    const bookById = new Map<string, Book>(books.map((b) => [b.id, b]));

    // Combine real listeningHistory from ~/.tide/all.json with real progressMap positions
    const dayMap = new Map<
      string,
      { seconds: number; bookIds: Set<string>; hourly: number[] }
    >();

    Object.entries(listeningHistory).forEach(([dateKey, rec]) => {
      if (!rec || rec.seconds <= 0) return;
      dayMap.set(dateKey, {
        seconds: rec.seconds,
        bookIds: new Set(rec.bookIds || []),
        hourly:
          rec.hourlySeconds && rec.hourlySeconds.length === 24
            ? [...rec.hourlySeconds]
            : new Array(24).fill(0),
      });
    });

    // Reconcile with real progressMap entries so any book with positionMs > 0 is reflected on its real updatedAt date
    Object.values(progressMap).forEach((p) => {
      if (!p || p.positionMs <= 0) return;
      const posSec = Math.round(p.positionMs / 1000);
      if (posSec <= 0) return;
      const ts = p.updatedAt || Date.now();
      const dateKey = toDateKey(ts);
      const hour = new Date(ts).getHours();
      const existing = dayMap.get(dateKey) || {
        seconds: 0,
        bookIds: new Set<string>(),
        hourly: new Array(24).fill(0),
      };
      existing.bookIds.add(p.bookId);
      if (posSec > existing.seconds) {
        const diff = posSec - existing.seconds;
        existing.seconds = posSec;
        existing.hourly[hour] = (existing.hourly[hour] || 0) + diff;
      }
      dayMap.set(dateKey, existing);
    });

    const totalLibraryMs = books.reduce((acc, b) => acc + b.durationMs, 0);
    const totalProgressMs = books.reduce((acc, b) => {
      const p = progressMap[b.id];
      if (!p) return acc;
      return acc + Math.min(b.durationMs, p.positionMs);
    }, 0);

    const totalHistorySec = Array.from(dayMap.values()).reduce(
      (acc, d) => acc + d.seconds,
      0
    );
    const totalRealSeconds = Math.max(
      Math.round(totalProgressMs / 1000),
      totalHistorySec
    );

    const completedBooks = books.filter((b) => {
      const p = progressMap[b.id];
      return p?.finished || (p && p.positionMs >= b.durationMs * 0.95);
    }).length;

    const inProgressBooks = books.filter((b) => {
      const p = progressMap[b.id];
      return p && p.positionMs > 0 && !p.finished && p.positionMs < b.durationMs * 0.95;
    }).length;

    const totalSizeBytes = books.reduce(
      (acc, b) => acc + b.files.reduce((s, f) => s + (f.sizeBytes || 0), 0),
      0
    );

    const totalChapters = books.reduce((acc, b) => acc + b.chapters.length, 0);

    const speeds = Object.values(progressMap)
      .map((p) => p?.speed)
      .filter((s): s is number => typeof s === 'number' && s > 0);
    const avgSpeed =
      speeds.length > 0
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : 1.0;

    // Build 52 weeks x 7 days (364 days) strictly from real dayMap records
    const totalDays = 364;
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const dayMs = 86400 * 1000;

    // Find max daily seconds for relative heatmap scaling
    const maxDaySec = Math.max(
      60,
      ...Array.from(dayMap.values()).map((d) => d.seconds)
    );

    const days: DayCell[] = [];
    let activeDaysCount = 0;

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(todayStart - i * dayMs);
      const iso = toDateKey(d.getTime());
      const rec = dayMap.get(iso);
      const sec = rec ? rec.seconds : 0;
      const mins = Math.round((sec / 60) * 10) / 10;

      if (sec > 0) activeDaysCount++;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (sec > 0) {
        const ratio = sec / maxDaySec;
        if (ratio < 0.25) level = 1;
        else if (ratio < 0.5) level = 2;
        else if (ratio < 0.8) level = 3;
        else level = 4;
      }

      const firstBookId = rec ? Array.from(rec.bookIds)[0] : undefined;
      const bTitle = firstBookId ? bookById.get(firstBookId)?.title : undefined;

      days.push({
        date: iso,
        seconds: sec,
        minutes: mins,
        level,
        bookTitle: bTitle,
      });
    }

    // Calculate real current streak (consecutive days ending today or yesterday with seconds > 0)
    let currentStreak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].seconds > 0) {
        currentStreak++;
      } else if (i === days.length - 1) {
        continue;
      } else {
        break;
      }
    }

    const weeks: DayCell[][] = [];
    for (let w = 0; w < 52; w++) {
      weeks.push(days.slice(w * 7, w * 7 + 7));
    }

    // Real 24-hour distribution summed across dayMap
    const hourlySeconds = new Array(24).fill(0);
    dayMap.forEach((rec) => {
      rec.hourly.forEach((sec, hr) => {
        hourlySeconds[hr] += sec;
      });
    });
    const maxHourSec = Math.max(1, ...hourlySeconds);
    const hourlyBars = hourlySeconds.map((sec, hr) => ({
      hour: hr,
      seconds: sec,
      ratio: sec / maxHourSec,
    }));

    return {
      totalRealSeconds,
      totalLibraryMs,
      totalProgressMs,
      completedBooks,
      inProgressBooks,
      totalSizeBytes,
      totalChapters,
      avgSpeed,
      activeDaysCount,
      currentStreak,
      weeks,
      hourlyBars,
    };
  }, [books, progressMap, listeningHistory]);

  const cardRadius = squareCorners ? 'rounded-none' : 'rounded-2xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  return (
    <div className="h-full overflow-y-auto px-6 sm:px-10 py-8 pb-24 max-w-6xl mx-auto space-y-6 select-none">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Stats</h1>
      </div>

      {/* Real KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ReactBitsSpotlightCard
          spotlightColor={`${palette.vibrant}28`}
          className={`p-4 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between text-white/45 mb-1">
              <span className="text-[11px] font-medium">Listened</span>
              <Clock className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {formatRealListeningTime(stats.totalRealSeconds * animProgress)}
            </div>
            <div className="text-[11px] text-white/40 font-mono">
              {formatDurationNumeric(stats.totalLibraryMs)} total library
            </div>
          </div>
        </ReactBitsSpotlightCard>

        <ReactBitsSpotlightCard
          spotlightColor={`${palette.vibrant}28`}
          className={`p-4 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between text-white/45 mb-1">
              <span className="text-[11px] font-medium">Streak</span>
              <Flame className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {Math.round(stats.currentStreak * animProgress)}d
            </div>
            <div className="text-[11px] text-white/40 font-mono">
              {stats.activeDaysCount} active day{stats.activeDaysCount === 1 ? '' : 's'}
            </div>
          </div>
        </ReactBitsSpotlightCard>

        <ReactBitsSpotlightCard
          spotlightColor={`${palette.vibrant}28`}
          className={`p-4 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between text-white/45 mb-1">
              <span className="text-[11px] font-medium">Library</span>
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {books.length}
            </div>
            <div className="text-[11px] text-white/40 font-mono">
              {stats.inProgressBooks} active · {stats.completedBooks} done ·{' '}
              {stats.totalChapters} ch
            </div>
          </div>
        </ReactBitsSpotlightCard>

        <ReactBitsSpotlightCard
          spotlightColor={`${palette.vibrant}28`}
          className={`p-4 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl`}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between text-white/45 mb-1">
              <span className="text-[11px] font-medium">Disk & Speed</span>
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {(stats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB
            </div>
            <div className="text-[11px] text-white/40 font-mono">
              {stats.avgSpeed.toFixed(2)}× speed · {bookmarks.length} marks
            </div>
          </div>
        </ReactBitsSpotlightCard>
      </div>

      {/* 365-Day Real Activity Heatmap */}
      <div className={`p-5 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
            <Calendar className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
            <span>365-Day Activity</span>
          </div>

          <div className="text-xs font-mono text-white/60 h-4">
            {hoveredDay ? (
              <span>
                {hoveredDay.date} · {formatRealListeningTime(hoveredDay.seconds)}
                {hoveredDay.bookTitle ? ` · ${hoveredDay.bookTitle}` : ''}
              </span>
            ) : (
              <span className="text-white/35">Hover a day</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-[3.5px] min-w-max">
            {stats.weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3.5px]">
                {week.map((day) => {
                  const bgStyle =
                    day.level === 0
                      ? { backgroundColor: 'rgba(255,255,255,0.05)' }
                      : day.level === 1
                        ? { backgroundColor: `${palette.vibrant}38` }
                        : day.level === 2
                          ? { backgroundColor: `${palette.vibrant}6e` }
                          : day.level === 3
                            ? { backgroundColor: `${palette.vibrant}ad` }
                            : {
                                backgroundColor: palette.vibrant,
                                boxShadow: `0 0 8px ${palette.vibrant}55`,
                              };

                  return (
                    <div
                      key={day.date}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className="w-3 h-3 rounded-[3px] transition-transform duration-150 hover:scale-125 cursor-pointer"
                      style={{
                        ...bgStyle,
                        transform: `scale(${Math.min(
                          1,
                          Math.max(0.2, animProgress * 1.15 - (wIdx / 52) * 0.15)
                        )})`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real 24-Hour Distribution + Book Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={`p-5 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
              <span>Hourly Activity (24h)</span>
            </div>
            <span className="text-[11px] font-mono text-white/40">Real Sessions</span>
          </div>

          <div className="h-40 flex items-stretch gap-1.5 pt-2">
            {stats.hourlyBars.map((item) => {
              const hPct =
                item.seconds > 0
                  ? Math.max(10, Math.round(item.ratio * 100 * animProgress))
                  : 4;
              return (
                <div
                  key={item.hour}
                  className="flex-1 flex flex-col items-center h-full group"
                  title={`${String(item.hour).padStart(2, '0')}:00 — ${formatRealListeningTime(
                    item.seconds
                  )}`}
                >
                  {/* Equal-height bar track container so every bar sits on the exact same baseline */}
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full rounded-t transition-all duration-300"
                      style={{
                        height: `${hPct}%`,
                        backgroundColor:
                          item.seconds > 0
                            ? palette.vibrant
                            : 'rgba(255,255,255,0.06)',
                      }}
                    />
                  </div>
                  {/* Fixed-height bottom timestamp row so labels never push bars up */}
                  <div className="h-5 flex items-center justify-center pt-1">
                    {item.hour % 6 === 0 && (
                      <span className="text-[9px] font-mono text-white/35 leading-none">
                        {String(item.hour).padStart(2, '0')}h
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

            <div className={`p-5 ${cardRadius} bg-white/[0.04] backdrop-blur-2xl space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
                  <Award className="w-3.5 h-3.5" style={{ color: palette.vibrant }} />
                  <span>Book Progress</span>
                </div>
                <span className="text-[11px] font-mono text-white/40">
                  <BookmarkIcon className="w-3 h-3 inline mr-1" />
                  {bookmarks.length}
                </span>
              </div>

              <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                {books.map((b) => {
                  const p = progressMap[b.id];
                  const posMs = p ? Math.min(b.durationMs, p.positionMs) : 0;
                  const ratio =
                    b.durationMs > 0 ? Math.min(1, posMs / b.durationMs) : 0;
                  const pct = Math.round(ratio * 100 * animProgress);
                  return (
                    <div
                      key={b.id}
                      onClick={() => onSelectBook(b)}
                      className={`p-2.5 ${pillRadius} bg-white/[0.03] hover:bg-white/[0.08] transition-all cursor-pointer flex items-center gap-3`}
                    >
                      <img
                        src={b.cover}
                        alt={b.title}
                        className={`w-9 h-9 ${pillRadius} object-cover shrink-0`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-white truncate">
                            {b.title}
                          </span>
                          <span className="font-mono text-white/55 shrink-0">
                            {formatDurationNumeric(posMs)} /{' '}
                            {formatDurationNumeric(b.durationMs)} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: palette.vibrant,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
    </div>
  );
};
