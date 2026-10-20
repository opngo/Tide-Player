export type Palette = {
  dominant: string;
  vibrant: string;
  muted: string;
  dark: string;
  light: string;
  bg: string;
  surface: string;
  surface2: string;
  accent: string;
  accentSoft: string;
  text: string;
  textDim: string;
  glow: string;
};

export type Chapter = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  streamUrl?: string;
  art?: string;
};

export type AudioFile = {
  path: string;
  name: string;
  format: string;
  sizeBytes: number;
  durationMs: number;
  bitrateKbps: number;
  objectUrl?: string;
};

export type TranscriptSegment = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
};

export type Book = {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  narrators: string[];
  series?: { name: string; index: number };
  publisher?: string;
  year?: number;
  language?: string;
  isbn?: string;
  description?: string;
  tags: string[];
  genres: string[];
  rating?: number;
  favorite?: boolean;
  group?: string;
  folderPath: string;
  importMode?: 'single-book' | 'separate-books' | 'root-library';
  cover: string;
  icon?: { glyph: string; tint: string };
  palette: Palette;
  files: AudioFile[];
  chapters: Chapter[];
  peaks: number[];
  durationMs: number;
  addedAt: number;
  bgOverride?: BgType;
  vizOverride?: VizType;
  transcript?: TranscriptSegment[];
  voiceProfile?: { basePitchHz: number; cadenceSpeed: number; warmth: number };
};

export type Progress = {
  bookId: string;
  positionMs: number;
  speed: number;
  finished: boolean;
  updatedAt: number;
};

export type Bookmark = {
  id: string;
  bookId: string;
  positionMs: number;
  note?: string;
  createdAt: number;
};

export type QueueItem = {
  id: string;
  kind: 'book' | 'chapter' | 'range';
  bookId: string;
  chapterId?: string;
  startMs?: number;
  endMs?: number;
};

export type Playlist = {
  id: string;
  name: string;
  icon: string;
  color: string;
  bookIds: string[];
  isSmart?: boolean;
  smartRule?: { field: 'unfinished' | 'genre' | 'author' | 'series' | 'recent'; value: string };
};

export type SidebarCustomItem = {
  id: string;
  kind: 'author' | 'folder' | 'playlist' | 'series' | 'tag';
  label: string;
  value: string;
  color?: string;
};

export type BgType =
  | 'aurora'
  | 'mesh'
  | 'silk'
  | 'dither'
  | 'crt-warp'
  | 'balatro'
  | 'iridescence'
  | 'ripple'
  | 'particles'
  | 'grain'
  | 'blurred-cover'
  | 'solid'
  | 'oled';

export type BgConfig = {
  type: BgType;
  intensity: number;
  speed: number;
  scale: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  accentCount?: 0 | 1 | 2 | 3;
  slickTextSpeed?: number;
  fullScreenSeekbar?: boolean;
  chapterOnlySeekbar?: boolean;
  screenVeilOpacity?: number;
  seekbarWidthPct?: number;
  reactivity: 'off' | 'low' | 'high';
  colorSource: 'cover' | 'custom' | 'mono';
  customColor: string;
  blend: 'normal' | 'screen' | 'overlay';
  fpsCap: 30 | 60;
};

export type VizType =
  | 'chatgpt-orb'
  | 'chatgpt-dots'
  | 'fluid-wave'
  | 'cover-outline'
  | 'halo'
  | 'bars'
  | 'mirrored-bars'
  | 'aurora-ribbons'
  | 'orb'
  | 'oscilloscope'
  | 'dots'
  | 'constellation'
  | 'spectrogram'
  | 'breath'
  | 'none';

export type VizConfig = {
  type: VizType;
  secondaryLayers: VizType[];
  placement: 'behind-cover' | 'around-cover' | 'below-cover' | 'full-screen' | 'bottom-edge';
  lineCount: number;
  thickness: number;
  offset: number;
  sensitivity: number;
  smoothing: number;
  opacity: number;
  glowStrength: number;
  mirrored: boolean;
  fill: boolean;
  peakCaps: boolean;
  reflection: boolean;
  speechMode: boolean;
  flatMode?: boolean;
  accentCount?: 0 | 1 | 2 | 3;
};

export type ListeningDayRecord = {
  date: string; // YYYY-MM-DD
  seconds: number;
  bookIds: string[];
  hourlySeconds?: number[]; // 24 slots (0..23)
};

export type ProgressBarStyle =
  | 'simple'
  | 'simple-chapter'
  | 'screen-veil'
  | 'wave'
  | 'line'
  | 'chaptered'
  | 'stepped'
  | 'minimal-ticks'
  | 'ring'
  | 'dots'
  | 'book-wide'
  | 'chapter-only'
  | 'dual';

export type TimeDisplayMode =
  | 'elapsed'
  | 'remaining'
  | 'chapter-remaining'
  | 'finish-clock';

export type CoverShape =
  | 'rounded'
  | 'square'
  | 'circle'
  | 'vinyl'
  | 'tape'
  | 'cd-jewel'
  | 'hardcover'
  | 'floating-glass'
  | 'polaroid'
  | 'octagon';

export type CoverMotif =
  | 'orbit'
  | 'dunes'
  | 'waves'
  | 'monolith'
  | 'grid'
  | 'eclipse'
  | 'prism'
  | 'botanical'
  | 'bauhaus'
  | 'vinyl-grooves'
  | 'topography'
  | 'pulsar'
  | 'cathedral'
  | 'totem'
  | 'horizon'
  | 'constellation';

export type ThemeMode = 'vivid' | 'soft' | 'mono' | 'cinema';
export type ColorScheme = 'dark' | 'light' | 'oled';
export type FontChoice = 'geist' | 'jakarta' | 'instrument' | 'newsreader';

export type PlayerViewMode = 'focus' | 'full-cover' | 'up-next' | 'chapters' | 'visualizer';

export type NavigationTab =
  | 'landing'
  | 'player'
  | 'library'
  | 'queue'
  | 'abb-search'
  | 'downloads'
  | 'stats'
  | 'customize';

export type MetadataSearchResult = {
  id: string;
  asin?: string;
  source: 'Audnexus' | 'Goodreads' | 'Apple Books' | 'OpenLibrary' | 'Google Books';
  title: string;
  author: string;
  narrator?: string;
  rating?: number;
  ratingsCount?: number;
  year?: string;
  genres?: string[];
  description?: string;
  coverUrl: string;
  rawCoverUrl?: string;
  externalUrl?: string;
};

export type AudioBookBayResult = {
  id: string;
  title: string;
  author?: string;
  narrator?: string;
  detailUrl: string;
  sizeBytes: number;
  sizeFormatted?: string;
  sizeDisplay?: string;
  seeders?: number;
  leechers?: number;
  description?: string;
  format: string;
  bitrate: string;
  category: string;
  language?: string;
  postedAt: string;
  infoHash?: string;
  magnetUri?: string;
  coverUrl?: string;
  cover: string;
  palette: Palette;
};

export type TorrentState =
  | 'downloading'
  | 'stalledDL'
  | 'pausedDL'
  | 'completed'
  | 'queuedDL'
  | 'checkingDL'
  | 'uploading'
  | 'pausedUP';

export type TorrentTransfer = {
  hash: string;
  name: string;
  author: string;
  narrator: string;
  format: string;
  bitrate: string;
  sizeBytes: number;
  progress: number;
  dlspeed: number;
  etaSec: number;
  state: TorrentState;
  sequential: boolean;
  firstLastPiecePrio: boolean;
  category: string;
  savePath: string;
  addedOn: number;
  cover: string;
  palette: Palette;
  durationMs: number;
  importedBookId?: string;
  pieces: number[];
  files: { name: string; sizeBytes: number; progress: number }[];
};

export type QbittorrentConfig = {
  url: string;
  username: string;
  password: string;
  category: string;
  savePath: string;
  abbMirror: string;
  sequentialByDefault: boolean;
  firstLastPiecePrio: boolean;
  connected: boolean;
  version?: string;
};

export type EqualizerBand = {
  freq: number;
  label: string;
  gainDb: number;
};

export type ScenePreset = {
  id: string;
  name: string;
  bg: BgConfig;
  viz: VizConfig;
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  coverShape: CoverShape;
  progressBarStyle: ProgressBarStyle;
  fontFamily: FontChoice;
};
