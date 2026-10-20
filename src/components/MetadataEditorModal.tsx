import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  BookOpen,
  User,
  Mic,
  Layers,
  Tag,
  Scissors,
  Plus,
  Merge,
  Search,
  Sparkles,
  Save,
  RotateCcw,
  HardDriveDownload,
  Wand2,
  Star,
  Loader2,
  FolderKanban,
  Check,
  Clock,
  FileAudio,
} from 'lucide-react';
import { Book, Chapter, Palette, MetadataSearchResult, CoverMotif } from '../types';
import { formatDurationNumeric } from './ProgressBar';
import {
  generateCoverSvg,
  makePalette,
  extractPaletteFromImage,
} from '../data/mockData';

interface MetadataEditorModalProps {
  book: Book;
  initialTab?: 'core' | 'chapters' | 'cover';
  palette: Palette;
  onSave: (updated: Book, writeToFile: boolean) => void;
  onClose: () => void;
  squareCorners: boolean;
}

interface AudnexusChapterEdition {
  asin: string;
  title: string;
  author: string;
  narrator: string;
  runtimeLengthMs: number;
  isAccurate: boolean;
  coverUrl: string;
  chapterCount: number;
  chapters: {
    id: string;
    title: string;
    startOffsetMs: number;
    lengthMs: number;
    startMs: number;
    endMs: number;
  }[];
}

const COVER_MOTIFS: CoverMotif[] = [
  'orbit',
  'dunes',
  'waves',
  'monolith',
  'grid',
  'eclipse',
  'prism',
  'botanical',
  'bauhaus',
  'vinyl-grooves',
  'topography',
  'pulsar',
  'cathedral',
  'totem',
  'horizon',
  'constellation',
];

export const MetadataEditorModal: React.FC<MetadataEditorModalProps> = ({
  book,
  initialTab = 'core',
  palette,
  onSave,
  onClose,
  squareCorners,
}) => {
  const [tab, setTab] = useState<'core' | 'chapters' | 'cover'>(initialTab);
  const [draft, setDraft] = useState<Book>(() =>
    JSON.parse(JSON.stringify(book))
  );
  const [coverSearchQuery, setCoverSearchQuery] = useState(
    `${book.title} ${book.authors[0] || ''}`.trim()
  );
  const [sourceFilter, setSourceFilter] = useState<
    'all' | 'audnexus' | 'goodreads' | 'apple' | 'openlibrary' | 'google'
  >('all');
  const [apiResults, setApiResults] = useState<MetadataSearchResult[]>([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);

  // Audnexus Chapter Times Search state
  const [chapterQuery, setChapterQuery] = useState(
    `${book.title} ${book.authors[0] || ''}`.trim()
  );
  const [audnexusEditions, setAudnexusEditions] = useState<
    AudnexusChapterEdition[]
  >([]);
  const [isSearchingChapters, setIsSearchingChapters] = useState(false);

  const [wroteToast, setWroteToast] = useState<string | null>(null);

  const radiusClass = squareCorners ? 'rounded-none' : 'rounded-2xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  const handleSearchCovers = useCallback(
    async (queryOverride?: string, srcOverride?: string) => {
      const q = (queryOverride ?? coverSearchQuery).trim() || draft.title;
      const src = srcOverride ?? sourceFilter;
      setIsSearchingApi(true);
      try {
        const resp = await fetch(
          `/api/metadata/search?q=${encodeURIComponent(
            q
          )}&source=${encodeURIComponent(src)}`
        );
        const data = await resp.json();
        if (Array.isArray(data.results)) {
          setApiResults(data.results);
        }
      } catch {
        setApiResults([]);
      } finally {
        setIsSearchingApi(false);
      }
    },
    [coverSearchQuery, draft.title, sourceFilter]
  );

  const handleSearchAudnexusChapters = useCallback(
    async (queryOverride?: string) => {
      const q = (queryOverride ?? chapterQuery).trim() || draft.title;
      setIsSearchingChapters(true);
      try {
        const resp = await fetch(
          `/api/audnexus/chapters?q=${encodeURIComponent(q)}&durationMs=${
            draft.durationMs || 1200000
          }`
        );
        const data = await resp.json();
        if (Array.isArray(data.editions)) {
          setAudnexusEditions(data.editions);
        }
      } catch {
        setAudnexusEditions([]);
      } finally {
        setIsSearchingChapters(false);
      }
    },
    [chapterQuery, draft.title, draft.durationMs]
  );

  useEffect(() => {
    if (tab === 'cover' && apiResults.length === 0 && !isSearchingApi) {
      handleSearchCovers();
    }
  }, [tab, apiResults.length, isSearchingApi, handleSearchCovers]);

  useEffect(() => {
    if (
      tab === 'chapters' &&
      audnexusEditions.length === 0 &&
      !isSearchingChapters
    ) {
      handleSearchAudnexusChapters();
    }
  }, [
    tab,
    audnexusEditions.length,
    isSearchingChapters,
    handleSearchAudnexusChapters,
  ]);

  const handleApplyAudnexusChapters = (edition: AudnexusChapterEdition) => {
    const primaryStreamUrl =
      draft.chapters[0]?.streamUrl || draft.files[0]?.objectUrl;
    const mapped: Chapter[] = edition.chapters.map((ch, idx) => ({
      id: `${draft.id}-audnex-ch-${idx + 1}`,
      title: ch.title,
      startMs: ch.startMs,
      endMs: ch.endMs,
      streamUrl:
        draft.files.length === 1
          ? primaryStreamUrl
          : draft.chapters[idx]?.streamUrl || primaryStreamUrl,
    }));
    setDraft((prev) => ({
      ...prev,
      chapters: mapped,
      narrators: edition.narrator ? [edition.narrator] : prev.narrators,
    }));
    setWroteToast(
      `Applied ${mapped.length} chapter times from Audnexus (${edition.asin})`
    );
  };

  const handleExtractEmbeddedM4bChapters = async () => {
    const firstFile = draft.files[0]?.path;
    if (!firstFile) {
      setWroteToast('No local file path found on this book');
      return;
    }
    try {
      const resp = await fetch('/api/chapters/extract-m4b', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: firstFile,
          bookId: draft.id,
          durationMs: draft.durationMs,
        }),
      });
      const data = await resp.json();
      if (data.ok && Array.isArray(data.chapters) && data.chapters.length > 0) {
        setDraft((prev) => ({
          ...prev,
          chapters: data.chapters,
        }));
        setWroteToast(
          `Extracted ${data.chapters.length} embedded chapters from ${draft.files[0]?.name}`
        );
      } else {
        setWroteToast(
          'No embedded M4B/CHAP atoms found in file — use Audnexus Chapter Search below'
        );
      }
    } catch {
      setWroteToast('Could not read embedded chapters');
    }
  };

  const handleApplyResult = async (
    item: MetadataSearchResult,
    includeMetadata: boolean
  ) => {
    setWroteToast(`Extracting palette from ${item.source} cover...`);
    const extractedPalette = await extractPaletteFromImage(item.coverUrl);

    setDraft((prev) => ({
      ...prev,
      cover: item.coverUrl,
      palette: extractedPalette,
      ...(includeMetadata
        ? {
            title: item.title || prev.title,
            authors: item.author ? [item.author] : prev.authors,
            narrators: item.narrator ? [item.narrator] : prev.narrators,
            rating: item.rating || prev.rating,
            description: item.description || prev.description,
            genres:
              item.genres && item.genres.length > 0 ? item.genres : prev.genres,
          }
        : {}),
    }));
    setWroteToast(
      includeMetadata
        ? `Applied ${item.source} cover, palette, narrator & synopsis`
        : `Applied ${item.source} high-res cover & dynamic palette`
    );
  };

  const handleAutoFillFromFilename = () => {
    const folderParts = draft.folderPath.split('/').filter(Boolean);
    const inferredTitle = folderParts[folderParts.length - 1] || draft.title;
    const inferredAuthor =
      folderParts[folderParts.length - 2] || draft.authors[0];
    setDraft({
      ...draft,
      title: inferredTitle,
      authors: [inferredAuthor],
    });
    setWroteToast('Auto-filled from folder path');
  };

  const handleSplitChapter = (idx: number) => {
    const target = draft.chapters[idx];
    if (!target) return;
    const mid = Math.floor((target.startMs + target.endMs) / 2);
    const chA: Chapter = {
      ...target,
      id: `${target.id}-a`,
      title: `${target.title} (Part 1)`,
      endMs: mid,
    };
    const chB: Chapter = {
      id: `${target.id}-b-${Date.now()}`,
      title: `${target.title} (Part 2)`,
      startMs: mid,
      endMs: target.endMs,
      streamUrl: target.streamUrl,
    };
    const nextChapters = [...draft.chapters];
    nextChapters.splice(idx, 1, chA, chB);
    setDraft({ ...draft, chapters: nextChapters });
  };

  const handleMergeChapterWithNext = (idx: number) => {
    if (idx >= draft.chapters.length - 1) return;
    const curr = draft.chapters[idx];
    const next = draft.chapters[idx + 1];
    const merged: Chapter = {
      ...curr,
      title: `${curr.title} + ${next.title}`,
      endMs: next.endMs,
    };
    const nextChapters = [...draft.chapters];
    nextChapters.splice(idx, 2, merged);
    setDraft({ ...draft, chapters: nextChapters });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl max-h-[88vh] flex flex-col ${radiusClass} ambient-popover shadow-2xl overflow-hidden animate-enter`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'core', label: 'Metadata' },
                {
                  id: 'chapters',
                  label: `Chapters & Audnexus (${draft.chapters.length})`,
                },
                {
                  id: 'cover',
                  label: 'Cover Search (Audnexus · Goodreads)',
                },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 ${pillRadius} text-xs font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-white text-black'
                    : 'bg-white/[0.05] text-white/65 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/50 hover:text-white bg-white/[0.04]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast banner */}
        {wroteToast && (
          <div className="px-6 py-2 bg-emerald-500/20 text-xs font-mono text-emerald-200 flex items-center justify-between">
            <span>{wroteToast}</span>
            <button onClick={() => setWroteToast(null)}>×</button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {tab === 'core' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-white/45 truncate">
                  {draft.folderPath}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setTab('chapters')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${pillRadius} bg-white/[0.07] hover:bg-white/[0.14] text-white/90`}
                  >
                    <Clock
                      className="w-3.5 h-3.5"
                      style={{ color: palette.vibrant }}
                    />
                    <span>Chapter Times</span>
                  </button>
                  <button
                    onClick={() => setTab('cover')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${pillRadius} bg-white/[0.07] hover:bg-white/[0.14] text-white/90`}
                  >
                    <Search
                      className="w-3.5 h-3.5"
                      style={{ color: palette.vibrant }}
                    />
                    <span>Search Covers</span>
                  </button>
                  <button
                    onClick={handleAutoFillFromFilename}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${pillRadius} bg-white/[0.05] hover:bg-white/[0.12] text-white/80`}
                  >
                    <Wand2
                      className="w-3.5 h-3.5"
                      style={{ color: palette.vibrant }}
                    />
                    <span>Path</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <BookOpen className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    placeholder="Title"
                    className={`w-full pl-9 pr-3 py-2.5 ${pillRadius} bg-white/[0.05] text-white`}
                  />
                </div>

                <div className="relative">
                  <User className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={draft.authors.join(', ')}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        authors: e.target.value.split(',').map((s) => s.trim()),
                      })
                    }
                    placeholder="Author(s)"
                    className={`w-full pl-9 pr-3 py-2.5 ${pillRadius} bg-white/[0.05] text-white`}
                  />
                </div>

                <div className="relative">
                  <Mic className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={draft.narrators.join(', ')}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        narrators: e.target.value
                          .split(',')
                          .map((s) => s.trim()),
                      })
                    }
                    placeholder="Narrator(s)"
                    className={`w-full pl-9 pr-3 py-2.5 ${pillRadius} bg-white/[0.05] text-white`}
                  />
                </div>

                <div className="relative">
                  <FolderKanban className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={draft.group || ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        group: e.target.value || undefined,
                      })
                    }
                    placeholder="Group (e.g. Sci-Fi, Classics, 2026)"
                    className={`w-full pl-9 pr-3 py-2.5 ${pillRadius} bg-white/[0.05] text-white`}
                  />
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Layers className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={draft.series?.name || ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          series: {
                            name: e.target.value,
                            index: draft.series?.index || 1,
                          },
                        })
                      }
                      placeholder="Series"
                      className={`w-full pl-9 pr-3 py-2.5 ${pillRadius} bg-white/[0.05] text-white`}
                    />
                  </div>
                  <input
                    type="number"
                    value={draft.series?.index || 1}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        series: {
                          name: draft.series?.name || 'Series',
                          index: Number(e.target.value),
                        },
                      })
                    }
                    className={`w-16 px-2.5 py-2.5 ${pillRadius} bg-white/[0.05] text-white font-mono text-center`}
                  />
                </div>

                <div className="relative">
                  <Tag className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={draft.tags.join(', ')}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tags: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Tags"
                    className={`w-full pl-9 pr-3 py-2.5 ${pillRadius} bg-white/[0.05] text-white`}
                  />
                </div>
              </div>

              <div>
                <textarea
                  rows={4}
                  value={draft.description || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  placeholder="Book synopsis..."
                  className={`w-full p-3.5 ${pillRadius} bg-white/[0.05] text-white/85 leading-relaxed`}
                />
              </div>
            </div>
          )}

          {tab === 'chapters' && (
            <div className="space-y-4">
              {/* Audnexus (audnex.us) Chapter Times Search + M4B Embedded Atom Reader */}
              <div className={`p-4 ${pillRadius} bg-white/[0.04] space-y-3`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-white/85">
                    <Clock
                      className="w-3.5 h-3.5"
                      style={{ color: palette.vibrant }}
                    />
                    <span>Search Chapter Times (audnex.us & M4B)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExtractEmbeddedM4bChapters}
                    className={`flex items-center gap-1.5 px-3 py-1.5 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-medium text-white`}
                  >
                    <FileAudio
                      className="w-3.5 h-3.5"
                      style={{ color: palette.light }}
                    />
                    <span>Read M4B Chapters</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchAudnexusChapters();
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-2.5" />
                    <input
                      type="text"
                      value={chapterQuery}
                      onChange={(e) => setChapterQuery(e.target.value)}
                      placeholder="Title, Author, or Audible ASIN (e.g. B002V0KHZA)..."
                      className={`w-full pl-9 pr-3 py-2 ${pillRadius} bg-white/[0.06] text-white`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingChapters}
                    className={`px-4 py-2 ${pillRadius} text-black font-semibold flex items-center gap-1.5`}
                    style={{ backgroundColor: palette.vibrant }}
                  >
                    {isSearchingChapters ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Find Times</span>
                  </button>
                </form>

                {isSearchingChapters ? (
                  <div className="py-4 flex items-center justify-center gap-2 text-white/50 font-mono text-[11px]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Fetching chapter offsets from api.audnex.us...</span>
                  </div>
                ) : audnexusEditions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto pr-1">
                    {audnexusEditions.map((ed) => (
                      <div
                        key={ed.asin}
                        className={`flex items-center justify-between gap-3 p-2.5 ${pillRadius} bg-white/[0.04] hover:bg-white/[0.09] transition-all`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {ed.coverUrl && (
                            <img
                              src={ed.coverUrl}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">
                              {ed.title}
                            </div>
                            <div className="text-[10px] font-mono text-white/50 truncate">
                              {ed.chapterCount} ch · {ed.narrator || ed.author} ·{' '}
                              {ed.asin}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyAudnexusChapters(ed)}
                          className={`px-2.5 py-1.5 ${pillRadius} text-[10px] font-mono font-semibold text-black shrink-0`}
                          style={{ backgroundColor: palette.vibrant }}
                        >
                          Apply ({ed.chapterCount})
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Active Chapters List */}
              <div className="flex items-center justify-between">
                <span className="text-white/50 font-mono text-[11px]">
                  {draft.chapters.length} Chapters ·{' '}
                  {formatDurationNumeric(draft.durationMs)}
                </span>
                <button
                  onClick={() => {
                    const last = draft.chapters[draft.chapters.length - 1];
                    const start = last ? last.endMs : 0;
                    setDraft({
                      ...draft,
                      chapters: [
                        ...draft.chapters,
                        {
                          id: `ch-${Date.now()}`,
                          title: `Chapter ${draft.chapters.length + 1}`,
                          startMs: start,
                          endMs: Math.max(start + 300000, draft.durationMs),
                          streamUrl: last?.streamUrl,
                        },
                      ],
                    });
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.15] text-white`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Chapter</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {draft.chapters.map((ch, idx) => (
                  <div
                    key={ch.id}
                    className={`flex items-center gap-2 p-2 ${pillRadius} bg-white/[0.03] hover:bg-white/[0.07]`}
                  >
                    <span className="w-6 text-center font-mono text-white/40">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={ch.title}
                      onChange={(e) => {
                        const next = [...draft.chapters];
                        next[idx] = { ...ch, title: e.target.value };
                        setDraft({ ...draft, chapters: next });
                      }}
                      className="flex-1 bg-transparent text-white px-2 py-1 rounded bg-white/[0.04]"
                    />
                    <span className="font-mono text-[11px] text-white/45 w-28 text-right">
                      {formatDurationNumeric(ch.startMs)} →{' '}
                      {formatDurationNumeric(ch.endMs)}
                    </span>
                    <button
                      onClick={() => handleSplitChapter(idx)}
                      className="p-1.5 rounded hover:bg-white/10 text-white/55 hover:text-white"
                      title="Split chapter"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>
                    {idx < draft.chapters.length - 1 && (
                      <button
                        onClick={() => handleMergeChapterWithNext(idx)}
                        className="p-1.5 rounded hover:bg-white/10 text-white/55 hover:text-white"
                        title="Merge with next"
                      >
                        <Merge className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'cover' && (
            <div className="space-y-5">
              {/* Current Cover + Extracted Palette Preview */}
              <div className="flex flex-col sm:flex-row gap-5 items-center bg-white/[0.03] p-4 rounded-2xl">
                <img
                  src={draft.cover}
                  alt=""
                  className={`w-24 h-24 ${radiusClass} object-cover shadow-2xl shrink-0`}
                />

                <div className="flex-1 space-y-2.5 w-full">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-white/45">
                      Active Cover & Palette
                    </span>
                    {draft.rating ? (
                      <span className="flex items-center gap-1 text-amber-400 font-mono text-xs">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {draft.rating}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(
                      [
                        { key: 'dominant', label: 'Dom' },
                        { key: 'vibrant', label: 'Vib' },
                        { key: 'muted', label: 'Mut' },
                        { key: 'dark', label: 'Drk' },
                        { key: 'light', label: 'Lgt' },
                      ] as const
                    ).map((sw) => (
                      <label
                        key={sw.key}
                        className={`flex items-center gap-2 px-2.5 py-1.5 ${pillRadius} bg-white/[0.05] cursor-pointer`}
                      >
                        <input
                          type="color"
                          value={draft.palette[sw.key]}
                          onChange={(e) => {
                            const updatedP = makePalette(
                              sw.key === 'dominant'
                                ? e.target.value
                                : draft.palette.dominant,
                              sw.key === 'vibrant'
                                ? e.target.value
                                : draft.palette.vibrant,
                              sw.key === 'muted'
                                ? e.target.value
                                : draft.palette.muted,
                              sw.key === 'dark'
                                ? e.target.value
                                : draft.palette.dark,
                              sw.key === 'light'
                                ? e.target.value
                                : draft.palette.light
                            );
                            setDraft({
                              ...draft,
                              palette: updatedP,
                            });
                          }}
                          className="w-4 h-4 rounded cursor-pointer bg-transparent"
                        />
                        <span className="font-mono text-[10px] text-white/75">
                          {sw.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Multi-API Search Bar (Audnexus, Goodreads, Apple Books, OpenLibrary, Google Books) */}
              <div className="space-y-2.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchCovers();
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-white/40 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={coverSearchQuery}
                      onChange={(e) => setCoverSearchQuery(e.target.value)}
                      placeholder="Search Audnexus, Goodreads, Apple Audiobooks, OpenLibrary..."
                      className={`w-full pl-9 pr-3 py-2.5 ${pillRadius} bg-white/[0.06] text-white`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingApi}
                    className={`px-4 py-2.5 ${pillRadius} text-black font-medium flex items-center gap-1.5`}
                    style={{ backgroundColor: palette.vibrant }}
                  >
                    {isSearchingApi ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Search</span>
                  </button>
                </form>

                {/* API Provider Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'all', label: 'All APIs' },
                      { id: 'audnexus', label: 'Audnexus (audnex.us)' },
                      { id: 'goodreads', label: 'Goodreads' },
                      { id: 'apple', label: 'Apple Audiobooks' },
                      { id: 'openlibrary', label: 'OpenLibrary' },
                      { id: 'google', label: 'Google Books' },
                    ] as const
                  ).map((prov) => (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => {
                        setSourceFilter(prov.id);
                        handleSearchCovers(coverSearchQuery, prov.id);
                      }}
                      className={`px-3 py-1.5 ${pillRadius} text-[11px] font-mono transition-all ${
                        sourceFilter === prov.id
                          ? 'bg-white text-black font-medium'
                          : 'bg-white/[0.04] text-white/55 hover:text-white'
                      }`}
                    >
                      {prov.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Cover & Metadata Results Grid */}
              {isSearchingApi ? (
                <div className="py-10 flex flex-col items-center justify-center gap-2 text-white/50">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="font-mono text-xs">
                    Querying Audnexus, Goodreads, Apple Books & OpenLibrary...
                  </span>
                </div>
              ) : apiResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {apiResults.map((res) => (
                    <div
                      key={res.id}
                      className={`flex gap-3.5 p-3 ${pillRadius} bg-white/[0.04] hover:bg-white/[0.08] transition-all group`}
                    >
                      <img
                        src={res.coverUrl}
                        alt={res.title}
                        className="w-20 h-20 rounded-xl object-cover shadow-lg shrink-0 bg-zinc-900"
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono"
                              style={{
                                backgroundColor: `${palette.vibrant}25`,
                                color: palette.light,
                              }}
                            >
                              {res.source}
                            </span>
                            {res.rating ? (
                              <span className="flex items-center gap-0.5 text-[11px] font-mono text-amber-400">
                                ★ {res.rating}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs font-medium text-white truncate mt-1">
                            {res.title}
                          </p>
                          <p className="text-[11px] text-white/50 truncate">
                            {res.author}
                            {res.narrator ? ` · ${res.narrator}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2">
                          <button
                            type="button"
                            onClick={() => handleApplyResult(res, false)}
                            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-mono text-white"
                          >
                            Cover Only
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyResult(res, true)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-mono text-black font-medium flex items-center gap-1"
                            style={{ backgroundColor: palette.vibrant }}
                          >
                            <Check className="w-3 h-3" />
                            <span>Cover + Info</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-white/40 font-mono text-xs">
                  No results found.
                </div>
              )}

              {/* Minimal Geometric Vector Cover Generator Option (16 Visual Cover Designs) */}
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">
                    Procedural Vector Cover Designs (16 Motifs)
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {COVER_MOTIFS.map((m) => {
                    const previewSvg = generateCoverSvg(
                      draft.title,
                      draft.authors.join(', '),
                      draft.palette,
                      m
                    );
                    const isSelected = draft.cover === previewSvg;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            cover: previewSvg,
                          })
                        }
                        className={`group flex flex-col items-center gap-1 p-1.5 ${pillRadius} transition-all ${
                          isSelected
                            ? 'bg-white/20 scale-[1.03]'
                            : 'bg-white/[0.04] hover:bg-white/[0.1]'
                        }`}
                        title={m}
                      >
                        <img
                          src={previewSvg}
                          alt={m}
                          className="w-12 h-12 rounded-lg object-cover shadow-md group-hover:scale-105 transition-transform"
                        />
                        <span className="text-[9px] font-mono text-white/65 group-hover:text-white capitalize truncate w-full text-center">
                          {m.replace('-', ' ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.03]">
          <button
            onClick={() => setDraft(JSON.parse(JSON.stringify(book)))}
            className={`flex items-center gap-1.5 px-3.5 py-2 ${pillRadius} bg-white/[0.05] text-white/65 hover:text-white text-xs`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSave(draft, true)}
              className={`flex items-center gap-1.5 px-4 py-2 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.15] text-white text-xs font-medium`}
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>Save to ~/.tide/all.json</span>
            </button>

            <button
              onClick={() => onSave(draft, false)}
              className={`flex items-center gap-1.5 px-5 py-2 ${pillRadius} text-black text-xs font-semibold`}
              style={{ backgroundColor: palette.vibrant }}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
