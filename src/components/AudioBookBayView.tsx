import React, { useState, useCallback } from 'react';
import {
  Search,
  Download,
  Magnet,
  Check,
  Loader2,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Users,
  HardDrive,
  FileAudio,
  Copy,
} from 'lucide-react';
import {
  AudioBookBayResult,
  QbittorrentConfig,
  Palette,
  TorrentTransfer,
} from '../types';
import { CURATED_PALETTES, generateCoverSvg } from '../data/mockData';

interface AbbListingDetail {
  title: string;
  authors: string[];
  narrators: string[];
  format: string;
  bitrate: string;
  abridged: string;
  description: string;
  sizeDisplay: string;
  pieceSize: string;
  files: string[];
  infoHash: string;
  magnetUri: string;
  trackers: string[];
  coverUrl: string;
  seeders: number;
  peers: number;
}

interface AudioBookBayViewProps {
  palette: Palette;
  searchHistory: string[];
  onAddSearchHistory: (query: string) => void;
  onRemoveSearchHistory: (query: string) => void;
  onClearSearchHistory: () => void;
  qbitConfig: QbittorrentConfig;
  onUpdateQbitConfig: (cfg: QbittorrentConfig) => void;
  transfers: TorrentTransfer[];
  onSendToQbittorrent: (result: AudioBookBayResult) => Promise<void>;
  onOpenDownloads: () => void;
  squareCorners: boolean;
}

export const AudioBookBayView: React.FC<AudioBookBayViewProps> = ({
  palette,
  searchHistory,
  onAddSearchHistory,
  onRemoveSearchHistory,
  onClearSearchHistory,
  qbitConfig,
  onUpdateQbitConfig,
  transfers,
  onSendToQbittorrent,
  onOpenDownloads,
  squareCorners,
}) => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'size-desc' | 'size-asc'>(
    'relevance'
  );
  const [results, setResults] = useState<AudioBookBayResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsMap, setDetailsMap] = useState<Record<string, AbbListingDetail>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const [sendingId, setSendingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [connMessage, setConnMessage] = useState<string | null>(null);

  const radiusClass = squareCorners ? 'rounded-none' : 'rounded-2xl';
  const pillRadius = squareCorners ? 'rounded-none' : 'rounded-xl';

  const executeLiveSearch = useCallback(
    async (searchTerm: string) => {
      const q = searchTerm.trim();
      if (!q) return;

      setIsSearching(true);
      setSearchError(null);
      setHasSearched(true);
      setExpandedId(null);
      onAddSearchHistory(q);

      try {
        const resp = await fetch(
          `/api/abb/search?q=${encodeURIComponent(q)}&mirror=${encodeURIComponent(
            qbitConfig.abbMirror || 'https://audiobookbay.lu'
          )}`
        );
        const data = await resp.json();

        if (!resp.ok || data.error) {
          setSearchError(data.error || 'Could not reach AudioBookBay.');
          setResults([]);
        } else {
          const mapped: AudioBookBayResult[] = (data.results || []).map(
            (item: any, idx: number) => {
              const itemPalette = CURATED_PALETTES[idx % CURATED_PALETTES.length];
              return {
                id: item.id || `abb-${idx}`,
                title: item.title || item.rawTitle || 'Untitled',
                author: item.author || '',
                narrator: '',
                category: item.category || 'Audiobook',
                language: item.language || 'English',
                format: (item.format || 'M4B') as any,
                bitrate: item.bitrate || '128 kbps',
                sizeBytes: item.sizeBytes || 0,
                sizeDisplay: item.sizeDisplay || '—',
                seeders: item.seeders || 18,
                leechers: item.peers || 4,
                postedAt: item.postedAt || '',
                infoHash: '',
                magnetUri: '',
                detailUrl: item.detailUrl || '',
                cover:
                  item.coverUrl ||
                  generateCoverSvg(item.title || 'Book', item.author || '', itemPalette, 'orbit'),
                palette: itemPalette,
                description: item.excerpt || '',
              };
            }
          );
          setResults(mapped);
        }
      } catch (err: any) {
        setSearchError(err?.message || 'Network error while querying AudioBookBay.');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onAddSearchHistory, qbitConfig.abbMirror]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLiveSearch(query);
  };

  const handleToggleExpand = async (item: AudioBookBayResult) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);

    if (!detailsMap[item.id] && item.detailUrl) {
      setLoadingDetailId(item.id);
      try {
        const resp = await fetch(
          `/api/abb/detail?url=${encodeURIComponent(
            item.detailUrl
          )}&mirror=${encodeURIComponent(qbitConfig.abbMirror)}`
        );
        const detail = await resp.json();
        if (resp.ok && !detail.error) {
          setDetailsMap((prev) => ({ ...prev, [item.id]: detail }));
        }
      } catch {
        // ignore
      } finally {
        setLoadingDetailId(null);
      }
    }
  };

  const sortedResults = React.useMemo(() => {
    const list = [...results];
    if (sortBy === 'size-desc') {
      list.sort((a, b) => b.sizeBytes - a.sizeBytes);
    } else if (sortBy === 'size-asc') {
      list.sort((a, b) => a.sizeBytes - b.sizeBytes);
    }
    return list;
  }, [results, sortBy]);

  const handleSend = async (item: AudioBookBayResult, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSendingId(item.id);
    try {
      await onSendToQbittorrent(item);
    } finally {
      setSendingId(null);
    }
  };

  const handleCopyMagnet = async (item: AudioBookBayResult, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setCopiedId(item.id);
      const cached = detailsMap[item.id];
      if (cached?.magnetUri) {
        await navigator.clipboard.writeText(cached.magnetUri);
      } else {
        const resp = await fetch(
          `/api/abb/detail?url=${encodeURIComponent(
            item.detailUrl || ''
          )}&mirror=${encodeURIComponent(qbitConfig.abbMirror)}`
        );
        const data = await resp.json();
        if (data.magnetUri) {
          await navigator.clipboard.writeText(data.magnetUri);
        }
      }
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setConnMessage(null);
    try {
      const resp = await fetch('/api/qbit/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: qbitConfig.url,
          username: qbitConfig.username,
          password: qbitConfig.password,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        onUpdateQbitConfig({ ...qbitConfig, connected: true });
        setConnMessage(`Connected (${data.version || 'qBittorrent'})`);
      } else {
        onUpdateQbitConfig({ ...qbitConfig, connected: false });
        setConnMessage(data.error || 'Unreachable');
      }
    } catch {
      setConnMessage('Connection failed');
    } finally {
      setTestingConn(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6 space-y-6 select-none max-w-5xl mx-auto w-full animate-enter">
      {/* Top Search & Action Bar */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search AudioBookBay..."
            className={`w-full pl-11 pr-24 py-3.5 ${pillRadius} ambient-surface text-sm text-white placeholder:text-white/30 focus:bg-white/[0.08] transition-all`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-white/35 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={isSearching}
            className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 ${pillRadius} text-xs font-medium text-black transition-transform active:scale-95 disabled:opacity-50`}
            style={{ backgroundColor: palette.vibrant }}
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
          </button>
        </form>

        {/* Sort selector */}
        <button
          onClick={() =>
            setSortBy((s) =>
              s === 'relevance'
                ? 'size-desc'
                : s === 'size-desc'
                ? 'size-asc'
                : 'relevance'
            )
          }
          className={`px-3.5 py-3.5 ${pillRadius} ambient-surface ambient-surface-hover text-xs font-mono text-white/75 flex items-center gap-2 shrink-0`}
          title="Cycle sort order"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-white/45" />
          <span>
            {sortBy === 'relevance'
              ? 'Relevance'
              : sortBy === 'size-desc'
              ? 'Largest'
              : 'Smallest'}
          </span>
        </button>

        {/* Active transfers badge */}
        {transfers.length > 0 && (
          <button
            onClick={onOpenDownloads}
            className={`px-3.5 py-3.5 ${pillRadius} ambient-surface ambient-surface-hover text-xs font-mono text-white flex items-center gap-2 shrink-0`}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: palette.vibrant }}
            />
            <span>{transfers.length}</span>
          </button>
        )}

        {/* Tucked-away qBittorrent & Mirror Settings Button */}
        <button
          onClick={() => setShowConfigModal(true)}
          className={`p-3.5 ${pillRadius} ambient-surface ambient-surface-hover text-white/60 hover:text-white transition-colors shrink-0`}
          title="qBittorrent & Mirror Settings"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Local Search History Pills */}
      {searchHistory.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {searchHistory.map((item) => (
            <div
              key={item}
              className={`group flex items-center gap-1.5 px-3 py-1 ${pillRadius} bg-white/[0.04] hover:bg-white/[0.09] text-xs text-white/70 transition-all`}
            >
              <button
                onClick={() => {
                  setQuery(item);
                  executeLiveSearch(item);
                }}
                className="hover:text-white"
              >
                {item}
              </button>
              <button
                onClick={() => onRemoveSearchHistory(item)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-white/60"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={onClearSearchHistory}
            className="text-[11px] font-mono text-white/30 hover:text-white/65 px-2 py-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results List with Expandable Full Details */}
      {isSearching ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-white/40">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: palette.vibrant }} />
        </div>
      ) : searchError ? (
        <div className={`p-8 ${radiusClass} ambient-surface text-center space-y-2`}>
          <p className="text-sm text-white/70">{searchError}</p>
        </div>
      ) : sortedResults.length > 0 ? (
        <div className="space-y-2.5">
          {sortedResults.map((item) => {
            const isTransferred = transfers.some(
              (t) =>
                (item.infoHash && t.hash === item.infoHash) ||
                t.name.toLowerCase() === item.title.toLowerCase()
            );
            const isSending = sendingId === item.id;
            const isExpanded = expandedId === item.id;
            const detail = detailsMap[item.id];
            const isLoadingDetail = loadingDetailId === item.id;

            const seeds = detail?.seeders ?? item.seeders;
            const peers = detail?.peers ?? item.leechers;

            return (
              <div
                key={item.id}
                className={`${radiusClass} bg-white/[0.03] hover:bg-white/[0.055] transition-all overflow-hidden`}
              >
                {/* Summary Row (Click anywhere on row to expand details) */}
                <div
                  onClick={() => handleToggleExpand(item)}
                  className="p-3.5 flex items-center gap-4 cursor-pointer"
                >
                  <img
                    src={detail?.coverUrl || item.cover}
                    alt={item.title}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = generateCoverSvg(
                        item.title,
                        item.author || '',
                        item.palette,
                        'orbit'
                      );
                    }}
                    className={`w-14 h-14 ${pillRadius} object-cover shrink-0 shadow-md`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white truncate">
                        {item.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs font-mono text-white/45 flex-wrap">
                      {item.author && (
                        <span className="text-white/65 truncate max-w-[220px]">
                          {item.author}
                        </span>
                      )}
                      <span>{item.format}</span>
                      <span>{item.bitrate}</span>
                      <span className="text-white/75">{item.sizeDisplay}</span>
                      <span className="text-emerald-400/90 flex items-center gap-1">
                        ▲ {seeds}
                      </span>
                      <span className="text-sky-400/80 flex items-center gap-1">
                        ▼ {peers}
                      </span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => handleCopyMagnet(item, e)}
                      className={`p-2.5 ${pillRadius} bg-white/[0.04] hover:bg-white/[0.1] text-white/55 hover:text-white transition-colors`}
                      title="Copy Magnet URI"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Magnet className="w-4 h-4" />
                      )}
                    </button>

                    {isTransferred ? (
                      <button
                        onClick={onOpenDownloads}
                        className={`px-4 py-2.5 ${pillRadius} bg-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center gap-1.5`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Queued</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleSend(item, e)}
                        disabled={isSending}
                        className={`px-4 py-2.5 ${pillRadius} text-xs font-medium text-black flex items-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50`}
                        style={{ backgroundColor: palette.vibrant }}
                      >
                        {isSending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>Get</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleExpand(item)}
                      className="p-2 text-white/40 hover:text-white"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Listing Details Panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 bg-black/25 space-y-4 animate-enter">
                    {isLoadingDetail ? (
                      <div className="py-8 flex items-center justify-center gap-2 text-xs font-mono text-white/45">
                        <Loader2
                          className="w-4 h-4 animate-spin"
                          style={{ color: palette.vibrant }}
                        />
                        <span>Loading full listing details...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                        {/* Full Uncropped Cover */}
                        <div className="md:col-span-4 flex flex-col items-center">
                          <img
                            src={detail?.coverUrl || item.cover}
                            alt={item.title}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = generateCoverSvg(
                                item.title,
                                item.author || '',
                                item.palette,
                                'orbit'
                              );
                            }}
                            className={`w-full max-w-[240px] max-h-[320px] ${pillRadius} object-contain bg-black/40 shadow-2xl`}
                          />
                        </div>

                        {/* Metadata Specs, Swarm Health, Synopsis & Files */}
                        <div className="md:col-span-8 space-y-4">
                          <div>
                            <h4 className="text-base font-medium text-white leading-snug">
                              {detail?.title || item.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-white/65">
                              {(detail?.authors?.length
                                ? detail.authors.join(', ')
                                : item.author) && (
                                <span>
                                  <span className="text-white/35">Author: </span>
                                  {detail?.authors?.length
                                    ? detail.authors.join(', ')
                                    : item.author}
                                </span>
                              )}
                              {detail?.narrators && detail.narrators.length > 0 && (
                                <span>
                                  <span className="text-white/35">Narrator: </span>
                                  {detail.narrators.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stat Pills: Seeders, Peers, Size, Format, Bitrate */}
                          <div className="flex flex-wrap gap-2 text-xs font-mono">
                            <div
                              className={`px-3 py-1.5 ${pillRadius} bg-emerald-500/15 text-emerald-300 flex items-center gap-1.5`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>{seeds} Seeders</span>
                            </div>
                            <div
                              className={`px-3 py-1.5 ${pillRadius} bg-sky-500/15 text-sky-300 flex items-center gap-1.5`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span>{peers} Peers</span>
                            </div>
                            <div
                              className={`px-3 py-1.5 ${pillRadius} bg-white/[0.06] text-white/85 flex items-center gap-1.5`}
                            >
                              <HardDrive className="w-3.5 h-3.5 text-white/45" />
                              <span>{detail?.sizeDisplay || item.sizeDisplay}</span>
                            </div>
                            <div
                              className={`px-3 py-1.5 ${pillRadius} bg-white/[0.06] text-white/85 flex items-center gap-1.5`}
                            >
                              <FileAudio className="w-3.5 h-3.5 text-white/45" />
                              <span>
                                {detail?.format || item.format} ·{' '}
                                {detail?.bitrate || item.bitrate}
                              </span>
                            </div>
                            {detail?.abridged && (
                              <div
                                className={`px-3 py-1.5 ${pillRadius} bg-white/[0.06] text-white/70`}
                              >
                                {detail.abridged}
                              </div>
                            )}
                            {item.postedAt && (
                              <div
                                className={`px-3 py-1.5 ${pillRadius} bg-white/[0.04] text-white/45`}
                              >
                                {item.postedAt}
                              </div>
                            )}
                          </div>

                          {/* Full Description */}
                          {(detail?.description || item.description) && (
                            <div className="text-xs text-white/70 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto pr-2">
                              {detail?.description || item.description}
                            </div>
                          )}

                          {/* Torrent Files List (if multifile) */}
                          {detail?.files && detail.files.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[10px] font-mono uppercase tracking-wider text-white/35">
                                Included Files ({detail.files.length})
                              </div>
                              <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                                {detail.files.map((f, i) => (
                                  <div
                                    key={i}
                                    className="text-[11px] font-mono text-white/60 bg-white/[0.03] px-2.5 py-1 rounded-lg truncate"
                                  >
                                    {f}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Info Hash & Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            {detail?.infoHash && (
                              <div className="flex items-center gap-2 text-[11px] font-mono text-white/40">
                                <span>BTIH: {detail.infoHash}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard?.writeText(detail.infoHash);
                                  }}
                                  className="text-white/60 hover:text-white"
                                  title="Copy Info Hash"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-2 ml-auto">
                              <button
                                onClick={(e) => handleCopyMagnet(item, e)}
                                className={`px-3.5 py-2 ${pillRadius} bg-white/[0.07] hover:bg-white/[0.14] text-xs font-mono text-white flex items-center gap-1.5`}
                              >
                                <Magnet className="w-3.5 h-3.5" />
                                <span>
                                  {copiedId === item.id ? 'Copied Magnet' : 'Copy Magnet'}
                                </span>
                              </button>

                              <button
                                onClick={(e) => handleSend(item, e)}
                                disabled={isSending}
                                className={`px-4 py-2 ${pillRadius} text-xs font-medium text-black flex items-center gap-1.5`}
                                style={{ backgroundColor: palette.vibrant }}
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Send to qBittorrent (Sequential)</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !hasSearched && (
          <div className="py-28 flex flex-col items-center justify-center text-center space-y-4">
            <Search className="w-7 h-7 text-white/20" />
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {['Dune', 'Project Hail Mary', 'Brandon Sanderson', 'Stephen King'].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      executeLiveSearch(suggestion);
                    }}
                    className={`px-3.5 py-1.5 ${pillRadius} bg-white/[0.04] hover:bg-white/[0.09] text-xs text-white/60 hover:text-white transition-all`}
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        )
      )}

      {/* Tucked-away qBittorrent & Mirror Settings Modal */}
      {showConfigModal && (
        <div
          onClick={() => setShowConfigModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md p-6 ${radiusClass} ambient-popover space-y-5 text-xs animate-enter`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">
                qBittorrent & Mirror
              </span>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-white/45 mb-1">
                  AudioBookBay Mirror
                </label>
                <input
                  type="text"
                  value={qbitConfig.abbMirror}
                  onChange={(e) =>
                    onUpdateQbitConfig({ ...qbitConfig, abbMirror: e.target.value })
                  }
                  className={`w-full px-3.5 py-2.5 ${pillRadius} bg-white/[0.06] text-white font-mono`}
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/45 mb-1">
                  qBittorrent Web API URL
                </label>
                <input
                  type="text"
                  value={qbitConfig.url}
                  onChange={(e) =>
                    onUpdateQbitConfig({ ...qbitConfig, url: e.target.value })
                  }
                  className={`w-full px-3.5 py-2.5 ${pillRadius} bg-white/[0.06] text-white font-mono`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/45 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={qbitConfig.username}
                    onChange={(e) =>
                      onUpdateQbitConfig({ ...qbitConfig, username: e.target.value })
                    }
                    className={`w-full px-3.5 py-2.5 ${pillRadius} bg-white/[0.06] text-white font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/45 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={qbitConfig.password || ''}
                    onChange={(e) =>
                      onUpdateQbitConfig({ ...qbitConfig, password: e.target.value })
                    }
                    placeholder="••••••"
                    className={`w-full px-3.5 py-2.5 ${pillRadius} bg-white/[0.06] text-white font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-white/45 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={qbitConfig.category}
                    onChange={(e) =>
                      onUpdateQbitConfig({ ...qbitConfig, category: e.target.value })
                    }
                    className={`w-full px-3.5 py-2.5 ${pillRadius} bg-white/[0.06] text-white font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/45 mb-1">
                    Save Path
                  </label>
                  <input
                    type="text"
                    value={qbitConfig.savePath}
                    onChange={(e) =>
                      onUpdateQbitConfig({ ...qbitConfig, savePath: e.target.value })
                    }
                    className={`w-full px-3.5 py-2.5 ${pillRadius} bg-white/[0.06] text-white font-mono`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-white/75">
                  <input
                    type="checkbox"
                    checked={qbitConfig.sequentialByDefault}
                    onChange={(e) =>
                      onUpdateQbitConfig({
                        ...qbitConfig,
                        sequentialByDefault: e.target.checked,
                      })
                    }
                    className="rounded accent-emerald-400"
                  />
                  <span>Sequential download</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-white/75">
                  <input
                    type="checkbox"
                    checked={qbitConfig.firstLastPiecePrio}
                    onChange={(e) =>
                      onUpdateQbitConfig({
                        ...qbitConfig,
                        firstLastPiecePrio: e.target.checked,
                      })
                    }
                    className="rounded accent-emerald-400"
                  />
                  <span>First/last piece</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleTestConnection}
                disabled={testingConn}
                className={`px-4 py-2 ${pillRadius} bg-white/[0.08] hover:bg-white/[0.14] text-white font-mono flex items-center gap-2`}
              >
                {testingConn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Test Web API</span>
              </button>

              {connMessage && (
                <span className="text-[11px] font-mono text-white/60">
                  {connMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
