import React from 'react';
import {
  ArrowDownToLine,
  Pause,
  Play,
  Trash2,
  FolderInput,
  Check,
  Headphones,
  FastForward,
  Search,
  ExternalLink,
} from 'lucide-react';
import { TorrentTransfer, QbittorrentConfig, Palette } from '../types';

interface DownloadsViewProps {
  palette: Palette;
  transfers: TorrentTransfer[];
  qbitConfig: QbittorrentConfig;
  onPauseResume: (hash: string) => void;
  onRemove: (hash: string) => void;
  onImportFinished: (transfer: TorrentTransfer) => void;
  onPlaySequentialPreview: (transfer: TorrentTransfer) => void;
  onFastForwardTransfer: (hash: string) => void;
  onOpenSearch: () => void;
  onSelectBookById: (bookId: string) => void;
  squareCorners: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s';
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

function formatEta(sec: number): string {
  if (sec <= 0 || sec >= 8640000) return '—';
  if (sec < 60) return `${Math.ceil(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.ceil(sec % 60);
  return `${m}m ${s}s`;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  palette,
  transfers,
  onPauseResume,
  onRemove,
  onImportFinished,
  onPlaySequentialPreview,
  onFastForwardTransfer,
  onOpenSearch,
  onSelectBookById,
  squareCorners,
}) => {
  const cardRadius = squareCorners ? 'rounded-none' : 'rounded-2xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  const totalSpeed = transfers.reduce(
    (sum, t) => sum + (t.state === 'downloading' ? t.dlspeed : 0),
    0
  );

  return (
    <div className="h-full flex flex-col overflow-hidden px-8 py-6 select-none max-w-5xl mx-auto w-full animate-enter">
      {/* Minimal Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/90">Transfers</span>
          {totalSpeed > 0 && (
            <span className="text-xs font-mono text-white/45">
              ↓ {formatSpeed(totalSpeed)}
            </span>
          )}
        </div>

        <button
          onClick={onOpenSearch}
          className={`p-2.5 ${pillRadius} ambient-surface ambient-surface-hover text-white/75 hover:text-white transition-all`}
          title="Search AudioBookBay"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Empty State: Single Vector Glyph (§1.1 Hard Rule: No empty-state essays) */}
      {transfers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-white/25">
          <ArrowDownToLine className="w-10 h-10 stroke-[1.25]" />
          <button
            onClick={onOpenSearch}
            className={`p-3 ${pillRadius} ambient-surface ambient-surface-hover text-white/70 hover:text-white transition-all`}
            title="Search AudioBookBay"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
          {transfers.map((tr) => {
            const isFinished = tr.state === 'completed' || tr.progress >= 1;
            const isPaused = tr.state === 'pausedDL';
            const firstFileReady = tr.files[0]?.progress >= 0.2 || tr.progress >= 0.12;

            return (
              <div
                key={tr.hash}
                className={`p-4 ${cardRadius} bg-white/[0.03] hover:bg-white/[0.055] transition-all space-y-3`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <img
                      src={tr.cover}
                      alt=""
                      className={`w-12 h-12 ${pillRadius} object-cover shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-white truncate">
                        {tr.name}
                      </h3>
                      <div className="flex items-center gap-3 flex-wrap mt-1 text-[11px] font-mono text-white/45">
                        <span className="text-white/75">
                          {(tr.progress * 100).toFixed(0)}%
                        </span>
                        <span>{formatBytes(tr.sizeBytes)}</span>
                        {!isFinished && (
                          <>
                            <span>↓ {formatSpeed(isPaused ? 0 : tr.dlspeed)}</span>
                            <span>{isPaused ? 'Paused' : formatEta(tr.etaSec)}</span>
                          </>
                        )}
                        <span style={{ color: palette.vibrant }}>{tr.state}</span>
                      </div>
                    </div>
                  </div>

                  {/* Icon Actions: Play 1st File, Pause/Resume, Import Finished, Remove */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isFinished && firstFileReady && (
                      <button
                        onClick={() => onPlaySequentialPreview(tr)}
                        className={`p-2.5 ${pillRadius} bg-white/[0.06] hover:bg-white/15 text-white/85 transition-all`}
                        title="Play 1st file (Sequential)"
                      >
                        <Headphones className="w-4 h-4" style={{ color: palette.vibrant }} />
                      </button>
                    )}

                    {!isFinished && (
                      <>
                        <button
                          onClick={() => onPauseResume(tr.hash)}
                          className={`p-2.5 ${pillRadius} bg-white/[0.05] hover:bg-white/15 text-white/75 hover:text-white transition-all`}
                          title={isPaused ? 'Resume' : 'Pause'}
                        >
                          {isPaused ? (
                            <Play className="w-4 h-4" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => onFastForwardTransfer(tr.hash)}
                          className={`p-2.5 ${pillRadius} bg-white/[0.05] hover:bg-white/15 text-white/50 hover:text-white transition-all`}
                          title="Complete transfer"
                        >
                          <FastForward className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {isFinished &&
                      (tr.importedBookId ? (
                        <button
                          onClick={() => onSelectBookById(tr.importedBookId!)}
                          className={`px-3 py-2 ${pillRadius} bg-emerald-500/15 text-emerald-300 text-xs font-medium flex items-center gap-1.5`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Library</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onImportFinished(tr)}
                          className={`px-3.5 py-2 ${pillRadius} text-xs font-medium text-black flex items-center gap-1.5 transition-transform active:scale-95`}
                          style={{ backgroundColor: palette.vibrant }}
                          title="Import finished audio files to library"
                        >
                          <FolderInput className="w-3.5 h-3.5" />
                          <span>Import finished</span>
                        </button>
                      ))}

                    <a
                      href={`magnet:?xt=urn:btih:${tr.hash}&dn=${encodeURIComponent(tr.name)}`}
                      className={`p-2.5 ${pillRadius} bg-white/[0.04] hover:bg-white/10 text-white/45 hover:text-white transition-all`}
                      title="Magnet URI"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => onRemove(tr.hash)}
                      className={`p-2.5 ${pillRadius} bg-white/[0.04] hover:bg-rose-500/20 text-white/45 hover:text-rose-300 transition-all`}
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Hairline Progress Bar */}
                <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, tr.progress * 100)}%`,
                      backgroundColor: isFinished ? '#10b981' : palette.vibrant,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
