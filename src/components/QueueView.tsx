import React, { useState } from 'react';
import {
  Play,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Book, QueueItem, Playlist, Palette } from '../types';
import { formatDurationNumeric } from './ProgressBar';

interface QueueViewProps {
  currentBook: Book;
  currentChapterIndex: number;
  books: Book[];
  queue: QueueItem[];
  playlists: Playlist[];
  palette: Palette;
  autoAdvance: 'next-queue' | 'next-series' | 'stop' | 'repeat-book' | 'shuffle';
  onChangeAutoAdvance: (
    mode: 'next-queue' | 'next-series' | 'stop' | 'repeat-book' | 'shuffle'
  ) => void;
  onSelectBook: (book: Book) => void;
  onJumpToChapter: (index: number) => void;
  onMoveQueueItem: (id: string, dir: 'up' | 'down' | 'top') => void;
  onRemoveQueueItem: (id: string) => void;
  onUndoRemoveQueue: () => void;
  hasUndoQueue: boolean;
  onCreatePlaylist: (name: string, color: string) => void;
  onAddBookToQueue?: (book: Book) => void;
  squareCorners: boolean;
}

export const QueueView: React.FC<QueueViewProps> = ({
  currentBook,
  currentChapterIndex,
  books,
  queue,
  palette,
  autoAdvance,
  onChangeAutoAdvance,
  onSelectBook,
  onJumpToChapter,
  onMoveQueueItem,
  onRemoveQueueItem,
  onUndoRemoveQueue,
  hasUndoQueue,
  onAddBookToQueue,
  squareCorners,
}) => {
  const [expandedBookIds, setExpandedBookIds] = useState<Record<string, boolean>>({});

  const radiusClass = squareCorners ? 'rounded-none' : 'rounded-2xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  const toggleExpandBook = (id: string) => {
    setExpandedBookIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Deduplicate/group queue items by Book so the Queue is strictly grouped by Book
  const groupedQueueBooks = React.useMemo(() => {
    const seen = new Set<string>();
    const list: { queueItem: QueueItem; book: Book }[] = [];
    for (const item of queue) {
      if (seen.has(item.bookId)) continue;
      const found = books.find((b) => b.id === item.bookId);
      if (found) {
        seen.add(found.id);
        list.push({ queueItem: item, book: found });
      }
    }
    return list;
  }, [queue, books]);

  const unqueuedBooks = books.filter(
    (b) =>
      b.id !== currentBook.id &&
      !groupedQueueBooks.some((g) => g.book.id === b.id)
  );

  return (
    <div className="h-full overflow-y-auto px-8 py-6 space-y-6 select-none max-w-4xl mx-auto w-full animate-enter">
      {/* Top Bar: Auto-Advance Mode & Undo */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs font-mono uppercase tracking-wider text-white/45">
          Queue (Grouped by Book)
        </div>

        <div className="flex items-center gap-2">
          {hasUndoQueue && (
            <button
              onClick={onUndoRemoveQueue}
              className={`px-3 py-1.5 ${pillRadius} bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-white flex items-center gap-1.5`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl">
            {(
              [
                { id: 'next-queue', label: 'Queue' },
                { id: 'next-series', label: 'Series' },
                { id: 'repeat-book', label: 'Repeat' },
                { id: 'shuffle', label: 'Shuffle' },
                { id: 'stop', label: 'Stop' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeAutoAdvance(m.id)}
                className={`px-2.5 py-1 ${pillRadius} text-[11px] font-mono transition-all ${
                  autoAdvance === m.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Currently Playing Book Card */}
      <div className={`p-4 ${radiusClass} bg-white/[0.05] space-y-3`}>
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">
          Now Playing Book
        </div>

        <div className="flex items-center gap-4">
          <img
            src={currentBook.cover}
            alt={currentBook.title}
            className={`w-14 h-14 ${pillRadius} object-cover shrink-0 shadow-lg`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white truncate">
              {currentBook.title}
            </div>
            <div className="text-xs font-mono text-white/50 mt-0.5">
              {currentBook.authors.filter(Boolean).join(', ') || 'Audiobook'} ·{' '}
              {currentBook.chapters.length} chapters ·{' '}
              {formatDurationNumeric(currentBook.durationMs)}
            </div>
          </div>

          <button
            onClick={() => toggleExpandBook(currentBook.id)}
            className={`px-3 py-2 ${pillRadius} bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-white/75 flex items-center gap-1.5`}
          >
            <span>Chapters ({currentBook.chapters.length})</span>
            {expandedBookIds[currentBook.id] ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {expandedBookIds[currentBook.id] && (
          <div className="pt-2 space-y-1 max-h-56 overflow-y-auto pr-1">
            {currentBook.chapters.map((ch, idx) => {
              const isCurrent = idx === currentChapterIndex;
              return (
                <button
                  key={ch.id}
                  onClick={() => onJumpToChapter(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 ${pillRadius} text-xs transition-all ${
                    isCurrent
                      ? 'bg-white/15 text-white font-medium'
                      : 'bg-white/[0.03] text-white/55 hover:text-white'
                  }`}
                >
                  <span className="truncate">
                    {idx + 1}. {ch.title}
                  </span>
                  <span className="font-mono text-[11px] opacity-55 ml-3 shrink-0">
                    {formatDurationNumeric(ch.endMs - ch.startMs)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Vertical List of Queued Books (Grouped by Book) */}
      <div className="space-y-2.5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-1">
          Up Next Books ({groupedQueueBooks.length})
        </div>

        {groupedQueueBooks.length > 0 ? (
          <div className="space-y-2">
            {groupedQueueBooks.map(({ queueItem, book }, index) => {
              const isExpanded = Boolean(expandedBookIds[book.id]);
              return (
                <div
                  key={queueItem.id}
                  className={`p-3.5 ${radiusClass} bg-white/[0.03] hover:bg-white/[0.06] transition-all space-y-3`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-white/35 w-5 text-center">
                      {index + 1}
                    </span>

                    <img
                      src={book.cover}
                      alt={book.title}
                      onClick={() => onSelectBook(book)}
                      className={`w-12 h-12 ${pillRadius} object-cover shrink-0 cursor-pointer`}
                    />

                    <div
                      onClick={() => onSelectBook(book)}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="text-sm font-medium text-white truncate">
                        {book.title}
                      </div>
                      <div className="text-xs font-mono text-white/45 mt-0.5">
                        {book.authors.filter(Boolean).join(', ') || 'Audiobook'} ·{' '}
                        {book.chapters.length} ch ·{' '}
                        {formatDurationNumeric(book.durationMs)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleExpandBook(book.id)}
                        className="p-2 rounded-lg text-white/45 hover:text-white"
                        title="Show book chapters"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onMoveQueueItem(queueItem.id, 'up')}
                        className="p-2 rounded-lg text-white/45 hover:text-white"
                        title="Move Book Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onMoveQueueItem(queueItem.id, 'down')}
                        className="p-2 rounded-lg text-white/45 hover:text-white"
                        title="Move Book Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectBook(book)}
                        className="p-2 rounded-lg text-white/65 hover:text-white"
                        title="Play Book Now"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        onClick={() => onRemoveQueueItem(queueItem.id)}
                        className="p-2 rounded-lg text-white/40 hover:text-rose-400"
                        title="Remove Book from Queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pl-9 pr-2 space-y-1 max-h-44 overflow-y-auto">
                      {book.chapters.map((ch, idx) => (
                        <div
                          key={ch.id}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.025] text-xs text-white/60"
                        >
                          <span className="truncate">
                            {idx + 1}. {ch.title}
                          </span>
                          <span className="font-mono text-[11px] text-white/40 ml-3 shrink-0">
                            {formatDurationNumeric(ch.endMs - ch.startMs)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`p-8 ${radiusClass} bg-white/[0.025] text-center text-xs font-mono text-white/35`}>
            No additional books in queue
          </div>
        )}
      </div>

      {/* Quick Add Books from Library to Queue */}
      {unqueuedBooks.length > 0 && onAddBookToQueue && (
        <div className="space-y-2.5 pt-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-1">
            Add Books from Library
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {unqueuedBooks.map((b) => (
              <div
                key={b.id}
                className={`p-3 ${pillRadius} bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-between gap-3 transition-all`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={b.cover}
                    alt=""
                    className={`w-10 h-10 ${pillRadius} object-cover shrink-0`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white truncate">
                      {b.title}
                    </div>
                    <div className="text-[11px] font-mono text-white/40">
                      {b.chapters.length} ch
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onAddBookToQueue(b)}
                  className={`p-2 ${pillRadius} bg-white/[0.08] hover:bg-white text-white hover:text-black transition-all shrink-0`}
                  title="Add Book to Queue"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
