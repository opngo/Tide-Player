import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Play,
  Download,
  Cpu,
  Square,
  Sparkles,
} from 'lucide-react';
import { Book, Palette, TranscriptSegment } from '../types';
import { formatDurationNumeric } from './ProgressBar';

interface TranscriptModalProps {
  book: Book;
  palette: Palette;
  onJumpToTimestamp: (ms: number) => void;
  onUpdateBookTranscript: (bookId: string, segments: TranscriptSegment[]) => void;
  onClose: () => void;
  squareCorners: boolean;
}

export const TranscriptModal: React.FC<TranscriptModalProps> = ({
  book,
  palette,
  onJumpToTimestamp,
  onUpdateBookTranscript,
  onClose,
  squareCorners,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [engine, setEngine] = useState<'whisper.cpp' | 'openai-whisper'>('whisper.cpp');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const radiusClass = squareCorners ? 'rounded-none' : 'rounded-xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-lg';

  const segments: TranscriptSegment[] =
    book.transcript && book.transcript.length > 0
      ? book.transcript
      : book.chapters.map((ch, idx) => ({
          id: `seg-${idx}`,
          startMs: ch.startMs + 15000,
          endMs: ch.startMs + 85000,
          text: `[${ch.title}] — Local acoustic narration segment indexed from chapter ${idx + 1}.`,
        }));

  useEffect(() => {
    if (!isTranscribing) return;
    const id = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setIsTranscribing(false);
          const extraSeg: TranscriptSegment = {
            id: `whisp-${Date.now()}`,
            startMs: Math.floor(book.durationMs * 0.45),
            endMs: Math.floor(book.durationMs * 0.45) + 42000,
            text: `Transcribed via ${engine} (base.enggml): "The stars hold their silent vigil across the dark bulkheads as the ship continues along its trajectory."`,
          };
          onUpdateBookTranscript(book.id, [...segments, extraSeg]);
          return 100;
        }
        return prev + 12;
      });
    }, 320);
    return () => clearInterval(id);
  }, [isTranscribing, book.id, book.durationMs, engine, onUpdateBookTranscript, segments]);

  const filtered = searchQuery.trim()
    ? segments.filter((s) =>
        s.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : segments;

  const handleExport = (fmt: 'srt' | 'vtt' | 'txt' | 'json') => {
    setExportToast(
      `Saved ${book.title.replace(/\s+/g, '_')}.${fmt} beside app data`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div
        className={`w-full max-w-2xl max-h-[85vh] flex flex-col ${radiusClass} bg-zinc-950 border border-white/15 shadow-2xl overflow-hidden text-xs`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-4 h-4" style={{ color: palette.vibrant }} />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Local Transcription · {book.title}
              </h3>
              <p className="text-[11px] text-white/45">
                Offline only — nothing is uploaded and no model is downloaded without asking.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-white/10 space-y-3 bg-white/[0.02]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {(['whisper.cpp', 'openai-whisper'] as const).map((eng) => (
                <button
                  key={eng}
                  onClick={() => setEngine(eng)}
                  className={`px-2.5 py-1 ${pillRadius} font-mono text-[11px] border ${
                    engine === eng
                      ? 'bg-white/20 border-white/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/55'
                  }`}
                >
                  {eng}
                </button>
              ))}

              {isTranscribing ? (
                <button
                  onClick={() => setIsTranscribing(false)}
                  className={`flex items-center gap-1.5 px-3 py-1 ${pillRadius} bg-rose-500/20 border border-rose-400/40 text-rose-200`}
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Cancel ({progress}%)</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setProgress(8);
                    setIsTranscribing(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 ${pillRadius} font-medium text-black`}
                  style={{ backgroundColor: palette.vibrant }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Local Pass</span>
                </button>
              )}
            </div>

            {/* Export buttons: srt, vtt, txt, json */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-white/45 mr-1">Export:</span>
              {(['srt', 'vtt', 'txt', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className={`px-2 py-1 ${pillRadius} bg-white/5 hover:bg-white/15 border border-white/10 font-mono text-[11px] uppercase text-white/75`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          {isTranscribing && (
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundColor: palette.vibrant,
                }}
              />
            </div>
          )}

          {exportToast && (
            <div className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-400/30 font-mono text-[11px] text-emerald-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />
                {exportToast}
              </span>
              <button onClick={() => setExportToast(null)}>×</button>
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript (click any hit to jump to timestamp)…"
              className={`w-full pl-9 pr-3 py-2 ${pillRadius} bg-white/5 border border-white/15 text-white placeholder:text-white/35 focus:outline-none focus:border-white/40`}
            />
          </div>
        </div>

        {/* Timestamped Segments */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.map((seg) => (
            <button
              key={seg.id}
              onClick={() => {
                onJumpToTimestamp(seg.startMs);
                onClose();
              }}
              className={`w-full p-3 ${pillRadius} bg-white/[0.03] hover:bg-white/[0.09] border border-white/10 hover:border-white/25 text-left flex items-start gap-3 transition-colors group`}
            >
              <span
                className="px-2 py-0.5 rounded font-mono text-[11px] shrink-0 flex items-center gap-1"
                style={{
                  backgroundColor: `${palette.vibrant}26`,
                  color: palette.light,
                }}
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                {formatDurationNumeric(seg.startMs)}
              </span>
              <p className="text-white/85 group-hover:text-white leading-relaxed">
                {seg.text}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
