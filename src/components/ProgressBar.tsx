import React, { useRef, useState } from 'react';
import {
  ProgressBarStyle,
  TimeDisplayMode,
  Chapter,
  Palette,
  Bookmark,
} from '../types';

interface ProgressBarProps {
  style: ProgressBarStyle;
  onCycleStyle: () => void;
  timeMode?: TimeDisplayMode;
  onCycleTimeMode?: () => void;
  positionMs: number;
  durationMs: number;
  chapters: Chapter[];
  currentChapter?: Chapter;
  peaks: number[];
  palette: Palette;
  speed?: number;
  bookmarks: Bookmark[];
  onSeek: (ms: number) => void;
  large?: boolean;
}

export function findActiveChapterIndex(
  chapters: Chapter[],
  positionMs: number
): number {
  if (!chapters || chapters.length <= 1) return 0;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (positionMs >= chapters[i].startMs - 5) {
      return i;
    }
  }
  return 0;
}

export function formatDurationNumeric(ms: number, negative = false): string {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const prefix = negative ? '-' : '';
  if (hrs > 0) {
    return `${prefix}${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${prefix}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatFinishClockTime(remainingMs: number, speed: number): string {
  const realWaitMs = remainingMs / Math.max(0.5, speed);
  const finishDate = new Date(Date.now() + realWaitMs);
  const hh = String(finishDate.getHours()).padStart(2, '0');
  const mm = String(finishDate.getMinutes()).padStart(2, '0');
  return `⇥ ${hh}:${mm}`;
}

export function formatTimeDisplay(
  positionMs: number,
  durationMs: number,
  currentChapter: Chapter,
  speed: number,
  mode: TimeDisplayMode
): string {
  if (mode === 'elapsed') {
    return `${formatDurationNumeric(positionMs)} / ${formatDurationNumeric(durationMs)}`;
  }
  if (mode === 'chapter-remaining') {
    return `${formatDurationNumeric(currentChapter.endMs - positionMs, true)} ch`;
  }
  if (mode === 'finish-clock') {
    return formatFinishClockTime(durationMs - positionMs, speed);
  }
  return formatDurationNumeric(durationMs - positionMs, true);
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  style,
  positionMs,
  durationMs,
  chapters,
  currentChapter: propCurrentChapter,
  peaks,
  palette,
  bookmarks,
  onSeek,
  large = false,
}) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const [hoveredTimeMs, setHoveredTimeMs] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const lastChEnd =
    chapters.length > 0 ? chapters[chapters.length - 1].endMs : 0;
  const safeDuration = Math.max(1, durationMs, lastChEnd);
  const bookProgress = Math.max(0, Math.min(1, positionMs / safeDuration));

  // Normalize chapters for divided seekbars (or 6 synthetic parts if 1-chapter book in simple-chapter mode)
  const displayChapters: Chapter[] = React.useMemo(() => {
    if (chapters.length > 1) return chapters;
    if (style === 'simple-chapter' || style === 'chaptered') {
      if (chapters.length === 1) return chapters;
    }
    return [
      chapters[0] || {
        id: 'ch-0',
        title: '',
        startMs: 0,
        endMs: safeDuration,
      },
    ];
  }, [chapters, style, safeDuration]);

  const activeChapterIdx = findActiveChapterIndex(displayChapters, positionMs);
  const currentChapter =
    propCurrentChapter ||
    displayChapters[activeChapterIdx] ||
    displayChapters[0] || {
      id: 'ch-0',
      title: '',
      startMs: 0,
      endMs: safeDuration,
    };

  const chDur = Math.max(1, currentChapter.endMs - currentChapter.startMs);
  const chElapsed = Math.max(0, positionMs - currentChapter.startMs);
  const chProgress = Math.max(0, Math.min(1, chElapsed / chDur));

  // Computes both visual cursor ratio (for tooltip placement) AND exact targetMs (accounting for chapter gaps & segment widths!)
  const resolvePointerTarget = (
    clientX: number,
    clientY?: number
  ): { visualRatio: number; targetMs: number } | null => {
    const el = barRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;

    const visualRatio = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width)
    );

    if (style === 'chapter-only') {
      return {
        visualRatio,
        targetMs: Math.round(currentChapter.startMs + visualRatio * chDur),
      };
    }

    // In 'dual' mode, check if pointer is over the top current-chapter zoom bar
    if (style === 'dual' && typeof clientY === 'number') {
      const topBar = el.querySelector<HTMLElement>('[data-dual-top="true"]');
      if (topBar) {
        const topRect = topBar.getBoundingClientRect();
        if (clientY <= topRect.bottom + 4) {
          const topRatio = Math.max(
            0,
            Math.min(1, (clientX - topRect.left) / Math.max(1, topRect.width))
          );
          return {
            visualRatio: topRatio,
            targetMs: Math.round(currentChapter.startMs + topRatio * chDur),
          };
        }
      }
    }

    // For chapter-divided seekbars ('simple-chapter', 'chaptered', 'book-wide', 'dual'),
    // map clientX directly against the rendered DOM bounding boxes of each chapter capsule!
    const segEls = el.querySelectorAll<HTMLElement>('[data-chapter-idx]');
    if (segEls.length > 0) {
      let matchedIdx = 0;
      let matchedSegRatio = 0;
      let bestDist = Infinity;

      segEls.forEach((segEl) => {
        const idxAttr = Number(segEl.getAttribute('data-chapter-idx') || '0');
        const sRect = segEl.getBoundingClientRect();
        if (sRect.width <= 0) return;

        if (clientX >= sRect.left && clientX <= sRect.right) {
          matchedIdx = idxAttr;
          matchedSegRatio = Math.max(
            0,
            Math.min(1, (clientX - sRect.left) / sRect.width)
          );
          bestDist = 0;
        } else if (bestDist > 0) {
          const dist =
            clientX < sRect.left
              ? sRect.left - clientX
              : clientX - sRect.right;
          if (dist < bestDist) {
            bestDist = dist;
            matchedIdx = idxAttr;
            matchedSegRatio = clientX < sRect.left ? 0 : 1;
          }
        }
      });

      const segList =
        segEls.length === 6 && displayChapters.length <= 1
          ? Array.from({ length: 6 }).map((_, i) => ({
              id: `seg-${i}`,
              title: `Part ${i + 1}`,
              startMs: (i / 6) * safeDuration,
              endMs: ((i + 1) / 6) * safeDuration,
            }))
          : displayChapters;

      const targetCh = segList[matchedIdx] || segList[0];
      if (targetCh) {
        const span = Math.max(1, targetCh.endMs - targetCh.startMs);
        const targetMs = Math.round(targetCh.startMs + matchedSegRatio * span);
        return { visualRatio, targetMs };
      }
    }

    return {
      visualRatio,
      targetMs: Math.round(visualRatio * safeDuration),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const res = resolvePointerTarget(e.clientX, e.clientY);
    if (!res) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(true);
    setHoverRatio(res.visualRatio);
    setHoveredTimeMs(res.targetMs);
    onSeek(res.targetMs);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const res = resolvePointerTarget(e.clientX, e.clientY);
    if (!res) return;
    setHoverRatio(res.visualRatio);
    setHoveredTimeMs(res.targetMs);
    if (isDragging || e.buttons === 1) {
      onSeek(res.targetMs);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);
    }
  };

  const hoveredChapterIndex =
    hoveredTimeMs !== null
      ? findActiveChapterIndex(chapters, hoveredTimeMs)
      : -1;
  const hoveredChapter =
    hoveredChapterIndex >= 0 ? chapters[hoveredChapterIndex] : null;

  // Chapter boundary ratios (works for both multi-file books and single-file .m4b embedded chapters)
  const chapterDividerRatios = chapters
    .slice(1)
    .map((ch) => Math.max(0, Math.min(1, ch.startMs / safeDuration)));

  // Normalize & expand dynamic range of waveform peaks so low notes/pauses and high notes visibly vary
  const dynamicPeaks = React.useMemo(() => {
    const raw = peaks && peaks.length > 0 ? peaks : [0.2, 0.5, 0.8, 0.3, 0.6];
    const sorted = [...raw].sort((a, b) => a - b);
    const pLow = sorted[Math.floor(sorted.length * 0.08)] ?? sorted[0] ?? 0.1;
    const pHigh =
      sorted[Math.floor(sorted.length * 0.94)] ??
      sorted[sorted.length - 1] ??
      0.9;
    const span = Math.max(0.05, pHigh - pLow);

    return raw.map((pk, idx) => {
      const norm = Math.max(0, Math.min(1, (pk - pLow) / span));
      let shaped = 0.07 + Math.pow(norm, 2.2) * 0.91;
      const prev = raw[idx - 1] ?? pk;
      const next = raw[idx + 1] ?? pk;
      if (Math.abs(pk - prev) < 0.04 && Math.abs(pk - next) < 0.04) {
        const wave =
          0.38 +
          0.35 * Math.sin(idx * 0.85) +
          0.27 * Math.cos(idx * 2.15);
        shaped = 0.08 + Math.pow(norm * 0.55 + wave * 0.45, 2.1) * 0.88;
      }
      return Math.max(0.07, Math.min(1, shaped));
    });
  }, [peaks]);

  // Segments list for simple-chapter (uses real chapters when >1, or 6 equal segments if 1-chapter book)
  const simpleChapterSegments = React.useMemo(() => {
    if (chapters.length > 1) return chapters;
    return Array.from({ length: 6 }).map((_, idx) => ({
      id: `seg-${idx}`,
      title: `Part ${idx + 1}`,
      startMs: (idx / 6) * safeDuration,
      endMs: ((idx + 1) / 6) * safeDuration,
    }));
  }, [chapters, safeDuration]);

  const activeSimpleSegIdx = findActiveChapterIndex(
    simpleChapterSegments,
    positionMs
  );

  return (
    <div className="w-full select-none">
      <div
        ref={barRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (!isDragging) {
            setHoverRatio(null);
            setHoveredTimeMs(null);
          }
        }}
        className="relative w-full py-3 cursor-pointer group touch-none"
        aria-label="Audio progress scrubber"
      >
        {/* Floating Glass Chapter & Timestamp Tooltip */}
        {hoverRatio !== null && hoveredTimeMs !== null && (
          <div
            className="absolute -top-8 -translate-x-1/2 px-3 py-1 rounded-xl backdrop-blur-2xl bg-black/85 text-[11px] font-mono tabular-nums text-white pointer-events-none z-30 whitespace-nowrap shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center gap-2"
            style={{
              left: `${Math.max(8, Math.min(92, hoverRatio * 100))}%`,
            }}
          >
            {hoveredChapter && chapters.length > 1 && (
              <span
                className="font-sans font-semibold truncate max-w-[160px]"
                style={{ color: palette.light }}
              >
                {hoveredChapter.title}
              </span>
            )}
            <span>{formatDurationNumeric(hoveredTimeMs)}</span>
            <span className="text-white/40">
              {Math.round((hoveredTimeMs / safeDuration) * 100)}%
            </span>
          </div>
        )}

        {/* Style A: SIMPLE — Clean Flat Solid Bar (No Gradients, No Glow) */}
        {style === 'simple' && (
          <div
            className={`relative ${
              large ? 'h-3.5' : 'h-2.5'
            } w-full rounded-full bg-white/[0.14] overflow-visible`}
          >
            <div className="w-full h-full rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${bookProgress * 100}%`,
                  backgroundColor: palette.vibrant,
                }}
              />
              {hoverRatio !== null && (
                <div
                  className="absolute top-0 bottom-0 left-0 rounded-full pointer-events-none opacity-20"
                  style={{
                    width: `${hoverRatio * 100}%`,
                    backgroundColor: '#ffffff',
                  }}
                />
              )}
            </div>
            {/* Flat Playhead Dot Pinned Directly to Fill Tip */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white pointer-events-none transition-transform duration-150 group-hover:scale-125 z-20"
              style={{
                left: `${bookProgress * 100}%`,
              }}
            />
          </div>
        )}

        {/* Style B: SIMPLE CHAPTER SPLIT — Flat Solid Chapter Segments (No Gradients, Crisp Gaps, Dot Pinned to Active Segment Fill Tip!) */}
        {style === 'simple-chapter' && (
          <div
            className={`relative flex items-center gap-1.5 ${
              large ? 'h-3.5' : 'h-2.5'
            } w-full`}
          >
            {simpleChapterSegments.map((ch, idx) => {
              const segWeight = Math.max(
                0.015,
                (ch.endMs - ch.startMs) / safeDuration
              );
              const segFill =
                idx < activeSimpleSegIdx
                  ? 1
                  : idx > activeSimpleSegIdx
                  ? 0
                  : Math.max(
                      0,
                      Math.min(
                        1,
                        (positionMs - ch.startMs) /
                          Math.max(1, ch.endMs - ch.startMs)
                      )
                    );

              const isCurrentSeg = idx === activeSimpleSegIdx;
              const isHoveredSeg =
                hoveredTimeMs !== null &&
                idx ===
                  findActiveChapterIndex(simpleChapterSegments, hoveredTimeMs);

              return (
                <div
                  key={ch.id || idx}
                  data-chapter-idx={idx}
                  style={{ flex: segWeight }}
                  className="h-full relative overflow-visible"
                >
                  <div
                    className={`w-full h-full rounded-full overflow-hidden relative transition-transform duration-150 ${
                      isHoveredSeg ? 'scale-y-125 bg-white/25' : 'bg-white/[0.14]'
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-75"
                      style={{
                        width: `${segFill * 100}%`,
                        backgroundColor: palette.vibrant,
                      }}
                    />
                  </div>

                  {/* Flat Playhead Dot Pinned to Exact Tip of Active Segment Fill (0px offset!) */}
                  {isCurrentSeg && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white pointer-events-none transition-transform duration-150 group-hover:scale-125 z-20"
                      style={{
                        left: `${segFill * 100}%`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Style C: STEPPED EQUALIZER BLOCKS — Flat Solid Discrete Blocks */}
        {style === 'stepped' && (
          <div
            className={`flex items-center justify-between gap-1 ${
              large ? 'h-5' : 'h-3.5'
            } w-full`}
          >
            {Array.from({ length: 36 }).map((_, idx) => {
              const r = idx / 35;
              const isPlayed = r <= bookProgress;
              const isCurrent = Math.abs(r - bookProgress) < 0.65 / 35;
              const isChBoundary = chapterDividerRatios.some(
                (cr) => Math.abs(cr - r) < 0.55 / 35
              );
              return (
                <div
                  key={idx}
                  className={`flex-1 rounded-sm transition-all duration-75 ${
                    isCurrent ? 'h-full' : isChBoundary ? 'h-[95%]' : 'h-[75%]'
                  }`}
                  style={{
                    backgroundColor: isCurrent
                      ? '#ffffff'
                      : isPlayed
                      ? palette.vibrant
                      : isChBoundary
                      ? 'rgba(255,255,255,0.35)'
                      : 'rgba(255,255,255,0.13)',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Style D: MINIMAL TICKS — Precision Field-Recorder Ruler Ticks (No Gradients) */}
        {style === 'minimal-ticks' && (
          <div
            className={`relative flex items-center justify-between ${
              large ? 'h-8' : 'h-6'
            } w-full`}
          >
            {Array.from({ length: 64 }).map((_, idx) => {
              const r = idx / 63;
              const isPlayed = r <= bookProgress;
              const isMajor = idx % 8 === 0;
              const isChTick = chapterDividerRatios.some(
                (cr) => Math.abs(cr - r) < 0.55 / 63
              );
              return (
                <div
                  key={idx}
                  className="w-[2px] rounded-full transition-all duration-75"
                  style={{
                    height: isChTick ? '100%' : isMajor ? '72%' : '42%',
                    backgroundColor: isPlayed
                      ? palette.vibrant
                      : isChTick
                      ? palette.light
                      : 'rgba(255,255,255,0.18)',
                  }}
                />
              );
            })}
            {/* Crisp Flat Playhead Needle */}
            <div
              className="absolute top-0 bottom-0 w-[2.5px] rounded-full bg-white pointer-events-none"
              style={{ left: `${bookProgress * 100}%` }}
            />
          </div>
        )}

        {/* Style 1: WAVE — Neon Soundwave + Mirrored Sub-Reflection + Cursor Proximity Magnification */}
        {style === 'wave' && (
          <div className="relative w-full">
            <div
              className={`relative flex items-end justify-between ${
                large ? 'gap-[3.5px] h-16' : 'gap-[2.5px] h-11'
              } w-full`}
            >
              {dynamicPeaks.map((pk, idx) => {
                const barRatio = idx / dynamicPeaks.length;
                const isPlayed = barRatio <= bookProgress;
                const isCurrentBar =
                  Math.abs(barRatio - bookProgress) < 0.8 / dynamicPeaks.length;
                const isHovered = hoverRatio !== null && barRatio <= hoverRatio;

                // Cursor proximity swell (macOS Dock / field recorder feel)
                const cursorDist =
                  hoverRatio !== null ? Math.abs(barRatio - hoverRatio) : 1;
                const hoverBoost =
                  cursorDist < 0.08
                    ? 1 + Math.cos((cursorDist / 0.08) * (Math.PI / 2)) * 0.28
                    : 1;

                const isChapterBoundary = chapterDividerRatios.some(
                  (r) => Math.abs(r - barRatio) < 0.55 / dynamicPeaks.length
                );

                const barH = Math.max(
                  10,
                  Math.min(100, pk * 100 * hoverBoost)
                );

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full relative"
                  >
                    {/* Upper Main Soundwave Bar */}
                    <div
                      className="w-full rounded-full transition-all duration-75"
                      style={{
                        height: `${barH}%`,
                        background: isCurrentBar
                          ? palette.light
                          : isPlayed
                          ? `linear-gradient(180deg, ${palette.light} 0%, ${palette.vibrant} 100%)`
                          : isHovered
                          ? `${palette.light}80`
                          : 'rgba(255,255,255,0.16)',
                        boxShadow: isCurrentBar
                          ? `0 0 14px ${palette.light}, 0 0 8px ${palette.vibrant}`
                          : isPlayed
                          ? `0 0 8px ${palette.vibrant}50`
                          : 'none',
                      }}
                    />

                    {/* Chapter Boundary Marker Dot */}
                    {isChapterBoundary && (
                      <div
                        className="absolute -top-1.5 w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: palette.light,
                          boxShadow: `0 0 6px ${palette.vibrant}`,
                        }}
                      />
                    )}
                  </div>
                );
              })}

              {/* Glowing Vertical Laser Playhead Needle */}
              <div
                className="absolute top-0 bottom-0 w-[2px] rounded-full pointer-events-none z-20 transition-all duration-75"
                style={{
                  left: `${bookProgress * 100}%`,
                  backgroundColor: '#ffffff',
                  boxShadow: `0 0 14px #ffffff, 0 0 22px ${palette.vibrant}`,
                }}
              />
            </div>

            {/* Mirrored Translucent Reflection Below Waveform */}
            <div
              className={`flex items-start justify-between ${
                large ? 'gap-[3.5px] h-4' : 'gap-[2.5px] h-3'
              } w-full mt-[2px] opacity-30 pointer-events-none`}
            >
              {dynamicPeaks.map((pk, idx) => {
                const barRatio = idx / dynamicPeaks.length;
                const isPlayed = barRatio <= bookProgress;
                return (
                  <div key={idx} className="flex-1 h-full flex items-start">
                    <div
                      className="w-full rounded-full"
                      style={{
                        height: `${Math.max(12, Math.min(100, pk * 85))}%`,
                        backgroundColor: isPlayed
                          ? palette.vibrant
                          : 'rgba(255,255,255,0.12)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Style 2: CHAPTERED GLASS CAPSULES (Playhead Jewel Pinned Directly inside Active Chapter Segment at segFill * 100%!) */}
        {(style === 'chaptered' || style === 'book-wide') && (
          <div
            className={`relative flex items-center gap-1.5 ${
              large ? 'h-4' : 'h-3'
            } w-full`}
          >
            {displayChapters.length > 1 ? (
              displayChapters.map((ch, idx) => {
                const segWeight = Math.max(
                  0.015,
                  (ch.endMs - ch.startMs) / safeDuration
                );
                const segFill =
                  idx < activeChapterIdx
                    ? 1
                    : idx > activeChapterIdx
                    ? 0
                    : Math.max(
                        0,
                        Math.min(
                          1,
                          (positionMs - ch.startMs) /
                            Math.max(1, ch.endMs - ch.startMs)
                        )
                      );

                const isCurrentSeg = idx === activeChapterIdx;
                const isHoveredSeg =
                  hoveredTimeMs !== null &&
                  idx === findActiveChapterIndex(displayChapters, hoveredTimeMs);

                return (
                  <div
                    key={ch.id || idx}
                    data-chapter-idx={idx}
                    style={{ flex: segWeight }}
                    className="h-full relative overflow-visible"
                  >
                    <div
                      className={`w-full h-full rounded-full overflow-hidden relative transition-all duration-150 ${
                        isHoveredSeg
                          ? 'scale-y-125 bg-white/25'
                          : isCurrentSeg
                          ? 'bg-white/20'
                          : 'bg-white/10'
                      }`}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-75"
                        style={{
                          width: `${segFill * 100}%`,
                          background: `linear-gradient(90deg, ${palette.vibrant} 0%, ${palette.light} 100%)`,
                          boxShadow:
                            segFill > 0
                              ? `0 0 12px ${palette.vibrant}`
                              : 'none',
                        }}
                      />
                    </div>

                    {/* Floating Glowing Playhead Jewel Pinned to Exact Tip of Active Chapter Fill (0px offset!) */}
                    {isCurrentSeg && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none transition-transform duration-150 group-hover:scale-125 z-20"
                        style={{
                          left: `${segFill * 100}%`,
                          backgroundColor: '#ffffff',
                          boxShadow: `0 0 14px #ffffff, 0 0 24px ${palette.vibrant}`,
                        }}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="relative h-full w-full rounded-full bg-white/12 overflow-visible">
                <div
                  className="h-full rounded-full transition-[width] duration-75"
                  style={{
                    width: `${bookProgress * 100}%`,
                    background: `linear-gradient(90deg, ${palette.dominant} 0%, ${palette.vibrant} 70%, ${palette.light} 100%)`,
                    boxShadow: `0 0 16px ${palette.vibrant}`,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none transition-transform duration-150 group-hover:scale-125 z-20"
                  style={{
                    left: `${bookProgress * 100}%`,
                    backgroundColor: '#ffffff',
                    boxShadow: `0 0 14px #ffffff, 0 0 24px ${palette.vibrant}`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Style 3: LASER HORIZON LINE / FULL-SCREEN WIPE RAIL */}
        {(style === 'line' || style === 'screen-veil' || style === 'ring') && (
          <div
            className={`relative ${
              large ? 'h-3' : 'h-2'
            } w-full rounded-full bg-white/12 overflow-visible`}
          >
            {/* Chapter Micro-Ticks */}
            {chapterDividerRatios.map((r, i) => (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 rounded-full bg-white/35 z-10 pointer-events-none"
                style={{ left: `${r * 100}%` }}
              />
            ))}

            {/* Glowing Comet Tail Fill */}
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{
                width: `${bookProgress * 100}%`,
                background: `linear-gradient(90deg, ${palette.dominant}66 0%, ${palette.vibrant} 75%, #ffffff 100%)`,
                boxShadow: `0 0 18px ${palette.vibrant}`,
              }}
            />

            {/* Laser Playhead Orb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none transition-transform group-hover:scale-125 z-20"
              style={{
                left: `${bookProgress * 100}%`,
                backgroundColor: '#ffffff',
                boxShadow: `0 0 16px #ffffff, 0 0 28px ${palette.vibrant}`,
              }}
            />
          </div>
        )}

        {/* Style 4: LED MATRIX DOTS */}
        {style === 'dots' && (
          <div className="flex items-center justify-between gap-1.5 h-6 w-full">
            {Array.from({ length: 44 }).map((_, idx) => {
              const r = idx / 43;
              const active = r <= bookProgress;
              const isCurrent = Math.abs(r - bookProgress) < 1 / 43;
              const dist = hoverRatio !== null ? Math.abs(r - hoverRatio) : 1;
              const scale = dist < 0.07 ? 1.45 : isCurrent ? 1.35 : 1;
              return (
                <div
                  key={idx}
                  className="w-2 h-2 rounded-full transition-all duration-100"
                  style={{
                    transform: `scale(${scale})`,
                    backgroundColor: isCurrent
                      ? '#ffffff'
                      : active
                      ? palette.vibrant
                      : 'rgba(255,255,255,0.16)',
                    boxShadow: isCurrent
                      ? `0 0 12px #ffffff, 0 0 18px ${palette.vibrant}`
                      : active
                      ? `0 0 8px ${palette.vibrant}80`
                      : 'none',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Style 5: DUAL (Top Current-Chapter Zoom + Bottom Full-Book Chapters) */}
        {(style === 'dual' || style === 'chapter-only') && (
          <div className="space-y-2.5 w-full">
            <div
              data-dual-top="true"
              className="h-2.5 w-full rounded-full bg-white/15 overflow-visible relative"
            >
              <div className="w-full h-full rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-75"
                  style={{
                    width: `${chProgress * 100}%`,
                    backgroundColor: palette.vibrant,
                  }}
                />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white pointer-events-none z-20"
                style={{ left: `${chProgress * 100}%` }}
              />
            </div>
            {style === 'dual' && (
              <div className="flex items-center gap-1.5 h-2 w-full opacity-85">
                {displayChapters.map((ch, idx) => {
                  const w = Math.max(
                    0.015,
                    (ch.endMs - ch.startMs) / safeDuration
                  );
                  const segFill =
                    idx < activeChapterIdx
                      ? 1
                      : idx > activeChapterIdx
                      ? 0
                      : chProgress;
                  return (
                    <div
                      key={ch.id || idx}
                      data-chapter-idx={idx}
                      style={{ flex: w }}
                      className="h-full rounded-full bg-white/12 overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-75"
                        style={{
                          width: `${segFill * 100}%`,
                          backgroundColor: palette.vibrant,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bookmark Pins */}
        {bookmarks.map((bm) => {
          const bmRatio = Math.max(0, Math.min(1, bm.positionMs / safeDuration));
          return (
            <div
              key={bm.id}
              title={bm.note || formatDurationNumeric(bm.positionMs)}
              className="absolute -bottom-1.5 -translate-x-1/2 w-2 h-2 rounded-full pointer-events-none z-20"
              style={{
                left: `${bmRatio * 100}%`,
                backgroundColor: palette.light,
                boxShadow: `0 0 8px ${palette.vibrant}`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
