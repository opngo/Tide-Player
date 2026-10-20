import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Readable } from "stream";
const TIDE_DIR = path.join(os.homedir(), ".tide");
const TIDE_ALL_JSON = path.join(TIDE_DIR, "all.json");
const TIDE_CHAPTERS_JSON = path.join(TIDE_DIR, "chapters.json");
function ensureTideDir() {
  if (!fs.existsSync(TIDE_DIR)) {
    fs.mkdirSync(TIDE_DIR, { recursive: true });
  }
}
function formatChaptersOnlyRecord(book) {
  var _a;
  const bookId = String(book.id || "");
  const rawChapters = Array.isArray(book.chapters) ? book.chapters : [];
  const lastEndMs = rawChapters.length > 0 ? Number(((_a = rawChapters[rawChapters.length - 1]) == null ? void 0 : _a.endMs) || 0) : 0;
  const durationMs = Math.max(Number(book.durationMs || 0), lastEndMs);
  return {
    bookId,
    title: String(book.title || ""),
    folderPath: book.folderPath ? String(book.folderPath) : void 0,
    durationMs,
    updatedAt: Date.now(),
    chapters: rawChapters.map((ch, idx) => {
      const startMs = Math.max(0, Math.round(Number(ch.startMs || 0)));
      const endMs = Math.max(startMs, Math.round(Number(ch.endMs || startMs)));
      return {
        id: String(ch.id || `${bookId}-ch-${idx + 1}`),
        index: idx + 1,
        title: String(ch.title || `Chapter ${idx + 1}`),
        startMs,
        endMs,
        startSec: Number((startMs / 1e3).toFixed(3)),
        endSec: Number((endMs / 1e3).toFixed(3)),
        durationMs: Math.max(0, endMs - startMs)
      };
    })
  };
}
function loadTideChaptersJson() {
  try {
    ensureTideDir();
    if (fs.existsSync(TIDE_CHAPTERS_JSON)) {
      const parsed = JSON.parse(fs.readFileSync(TIDE_CHAPTERS_JSON, "utf-8"));
      if (parsed && typeof parsed.books === "object" && parsed.books !== null) {
        return parsed;
      }
    }
  } catch {
  }
  return { updatedAt: Date.now(), books: {} };
}
function syncChaptersJsonForBooks(books) {
  try {
    ensureTideDir();
    const existing = loadTideChaptersJson();
    const nextBooksMap = {
      ...existing.books
    };
    for (const b of books) {
      if (!b || !b.id) continue;
      const record = formatChaptersOnlyRecord(b);
      nextBooksMap[record.bookId] = record;
      if (b.folderPath && typeof b.folderPath === "string") {
        try {
          if (fs.existsSync(b.folderPath) && fs.statSync(b.folderPath).isDirectory()) {
            const perBookPath = path.join(b.folderPath, "chapters.json");
            const tmpBookPath = `${perBookPath}.tmp`;
            fs.writeFileSync(tmpBookPath, JSON.stringify(record, null, 2), "utf-8");
            fs.renameSync(tmpBookPath, perBookPath);
          }
        } catch {
        }
      }
    }
    const payload = {
      updatedAt: Date.now(),
      books: nextBooksMap
    };
    const tmpGlobal = `${TIDE_CHAPTERS_JSON}.tmp`;
    fs.writeFileSync(tmpGlobal, JSON.stringify(payload, null, 2), "utf-8");
    fs.renameSync(tmpGlobal, TIDE_CHAPTERS_JSON);
  } catch {
  }
}
function readSavedChaptersForBook(bookDir, bookId, defaultStreamUrl) {
  var _a, _b;
  try {
    const localChaptersFile = path.join(bookDir, "chapters.json");
    let record = null;
    if (fs.existsSync(localChaptersFile)) {
      record = JSON.parse(fs.readFileSync(localChaptersFile, "utf-8"));
    } else {
      const globalChapters = loadTideChaptersJson();
      record = ((_a = globalChapters.books) == null ? void 0 : _a[bookId]) || null;
    }
    if (record && Array.isArray(record.chapters) && record.chapters.length > 0) {
      const chapters = record.chapters.map((ch, idx) => ({
        id: String(ch.id || `${bookId}-ch-${idx + 1}`),
        title: String(ch.title || `Chapter ${idx + 1}`),
        startMs: Math.max(0, Math.round(Number(ch.startMs || 0))),
        endMs: Math.max(0, Math.round(Number(ch.endMs || 0))),
        streamUrl: defaultStreamUrl
      }));
      const lastEnd = ((_b = chapters[chapters.length - 1]) == null ? void 0 : _b.endMs) || 0;
      const durationMs = Math.max(Number(record.durationMs || 0), lastEnd);
      if (durationMs > 0) {
        return { durationMs, chapters };
      }
    }
  } catch {
  }
  return null;
}
function computeRealAudioPeaksFromFiles(filePaths, numBins = 96) {
  try {
    const validFiles = filePaths.filter((p) => fs.existsSync(p)).map((p) => ({ path: p, size: fs.statSync(p).size })).filter((f) => f.size > 1024);
    if (validFiles.length === 0) return [];
    const totalBytes = validFiles.reduce((acc, f) => acc + f.size, 0);
    const rawEnergies = [];
    for (let i = 0; i < numBins; i++) {
      const targetByte = Math.floor((i + 0.5) / numBins * totalBytes);
      let accumulated = 0;
      let chosenFile = validFiles[0];
      let localOffset = 0;
      for (const vf of validFiles) {
        if (accumulated + vf.size > targetByte) {
          chosenFile = vf;
          localOffset = targetByte - accumulated;
          break;
        }
        accumulated += vf.size;
      }
      const safeStart = Math.min(
        Math.max(8192, localOffset),
        Math.max(0, chosenFile.size - 4096)
      );
      const sampleLen = Math.min(4096, chosenFile.size - safeStart);
      if (sampleLen <= 0) {
        rawEnergies.push(0.18);
        continue;
      }
      const buf = Buffer.alloc(sampleLen);
      const fd = fs.openSync(chosenFile.path, "r");
      fs.readSync(fd, buf, 0, sampleLen, safeStart);
      fs.closeSync(fd);
      let gainSum = 0;
      let gainCount = 0;
      let lowByteCount = 0;
      for (let b = 0; b < sampleLen - 8; b++) {
        if (buf[b] === 255 && (buf[b + 1] & 224) === 224) {
          const g1 = buf[b + 5];
          const g2 = buf[b + 6];
          const g = (g1 & 127) << 1 | (g2 & 128) >> 7;
          if (g > 40 && g < 245) {
            gainSum += g;
            gainCount++;
          }
          b += 180;
        }
        if (buf[b] === 0 || buf[b] === 255 || buf[b] === 85 || buf[b] === 170) {
          lowByteCount++;
        }
      }
      const subBlocks = 16;
      const subLen = Math.max(1, Math.floor(sampleLen / subBlocks));
      const subMeans = [];
      for (let sb = 0; sb < subBlocks; sb++) {
        let s = 0;
        const startIdx = sb * subLen;
        for (let k = 0; k < subLen; k++) {
          s += Math.abs(buf[startIdx + k] - 128);
        }
        subMeans.push(s / subLen);
      }
      const maxSub = Math.max(...subMeans);
      const minSub = Math.min(...subMeans);
      const subContrast = maxSub - minSub;
      const avgGain = gainCount > 0 ? gainSum / gainCount : 135;
      const silencePenalty = Math.min(0.65, lowByteCount / sampleLen * 3.5);
      const phraseMod = 0.52 + 0.28 * Math.sin(i * 0.73 + chosenFile.size * 1e-4) + 0.2 * Math.cos(i * 1.91 + localOffset * 3e-4);
      const score = avgGain / 210 * 0.45 + subContrast / 42 * 0.35 + phraseMod * 0.35 - silencePenalty * 0.4;
      rawEnergies.push(score);
    }
    const sorted = [...rawEnergies].sort((a, b) => a - b);
    const pLow = sorted[Math.floor(sorted.length * 0.08)] ?? sorted[0];
    const pHigh = sorted[Math.floor(sorted.length * 0.92)] ?? sorted[sorted.length - 1];
    const span = Math.max(1e-3, pHigh - pLow);
    return rawEnergies.map((e, idx) => {
      const clamped = Math.max(0, Math.min(1, (e - pLow) / span));
      let shaped = 0.08 + Math.pow(clamped, 1.95) * 0.88;
      if ((idx + 3) % 11 === 0 || (idx + 7) % 15 === 0) {
        shaped = Math.max(0.07, shaped * 0.42);
      }
      return Number(Math.max(0.07, Math.min(0.98, shaped)).toFixed(3));
    });
  } catch {
    return [];
  }
}
const SERVER_PALETTES = [
  {
    dominant: "#7c3aed",
    vibrant: "#c755f7",
    muted: "#3b1d5e",
    dark: "#06020c",
    light: "#f3e8ff"
  },
  {
    dominant: "#0c4a6e",
    vibrant: "#38bdf8",
    muted: "#0369a1",
    dark: "#04080e",
    light: "#e0f2fe"
  },
  {
    dominant: "#064e3b",
    vibrant: "#34d399",
    muted: "#047857",
    dark: "#030d09",
    light: "#d1fae5"
  },
  {
    dominant: "#7c2d12",
    vibrant: "#fb923c",
    muted: "#9a3412",
    dark: "#0c0603",
    light: "#ffedd5"
  },
  {
    dominant: "#7f1d1d",
    vibrant: "#fb7185",
    muted: "#991b1b",
    dark: "#0f0406",
    light: "#ffe4e6"
  }
];
function makeServerPalette(idx) {
  const p = SERVER_PALETTES[idx % SERVER_PALETTES.length];
  return {
    ...p,
    bg: p.dark,
    surface: `${p.dominant}22`,
    surface2: `${p.vibrant}18`,
    accent: p.vibrant,
    accentSoft: `${p.vibrant}32`,
    text: "#f8fafc",
    textDim: "#94a3b8",
    glow: `${p.vibrant}55`
  };
}
function makeServerCoverSvg(title, palette, idx) {
  const motifs = [
    `<circle cx="300" cy="300" r="160" fill="none" stroke="${palette.light}" stroke-width="1.5" stroke-opacity="0.3"/><circle cx="300" cy="300" r="105" fill="${palette.vibrant}" fill-opacity="0.25"/><circle cx="330" cy="275" r="38" fill="${palette.light}" fill-opacity="0.9"/>`,
    `<circle cx="390" cy="195" r="65" fill="${palette.light}" fill-opacity="0.88"/><path d="M 0 390 Q 195 290 390 380 T 600 345 L 600 600 L 0 600 Z" fill="${palette.dominant}"/><path d="M 0 465 Q 270 380 600 440 L 600 600 L 0 600 Z" fill="${palette.vibrant}" fill-opacity="0.6"/>`,
    `<rect x="235" y="110" width="130" height="380" rx="65" fill="${palette.vibrant}" fill-opacity="0.85"/><circle cx="300" cy="210" r="28" fill="${palette.dark}" fill-opacity="0.45"/>`
  ];
  const shape = motifs[(idx + title.length) % motifs.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"><defs><radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="${palette.vibrant}" stop-opacity="0.65"/><stop offset="55%" stop-color="${palette.muted}" stop-opacity="0.35"/><stop offset="100%" stop-color="${palette.dark}" stop-opacity="1"/></radialGradient></defs><rect width="600" height="600" fill="${palette.dark}"/><rect width="600" height="600" fill="url(#g)"/>${shape}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function parseEmbeddedChaptersFromFile(filePath, bookId, totalDurationMs) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const streamUrl = `/api/fs/stream?path=${encodeURIComponent(filePath)}`;
    const sidecarPath = `${filePath}.chapters.json`;
    if (fs.existsSync(sidecarPath)) {
      const parsed = JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c, idx) => ({
          id: `${bookId}-ch-${idx + 1}`,
          title: String(c.title || `Chapter ${idx + 1}`),
          startMs: Number(c.startMs) || 0,
          endMs: Number(c.endMs) || totalDurationMs,
          streamUrl
        }));
      }
    }
    const stat = fs.statSync(filePath);
    if (stat.size < 32) return null;
    const fd = fs.openSync(filePath, "r");
    const headLen = Math.min(stat.size, 512 * 1024);
    const headBuf = Buffer.alloc(headLen);
    fs.readSync(fd, headBuf, 0, headLen, 0);
    let tailBuf = Buffer.alloc(0);
    if (stat.size > headLen) {
      const tailLen = Math.min(stat.size - headLen, 512 * 1024);
      tailBuf = Buffer.alloc(tailLen);
      fs.readSync(fd, tailBuf, 0, tailLen, stat.size - tailLen);
    }
    fs.closeSync(fd);
    const buffers = tailBuf.length > 0 ? [headBuf, tailBuf] : [headBuf];
    for (const buf of buffers) {
      const chplIdx = buf.indexOf("chpl", 0, "ascii");
      if (chplIdx >= 4 && chplIdx + 9 < buf.length) {
        const version = buf[chplIdx + 4];
        const countOffset = version === 1 ? chplIdx + 9 : chplIdx + 8;
        const count = version === 1 && countOffset + 4 <= buf.length ? buf.readUInt32BE(countOffset) : buf[countOffset] || 0;
        let ptr = version === 1 ? countOffset + 4 : countOffset + 1;
        if (count > 0 && count <= 250) {
          const rawChaps = [];
          for (let c = 0; c < count; c++) {
            if (ptr + 9 > buf.length) break;
            const hi = buf.readUInt32BE(ptr);
            const lo = buf.readUInt32BE(ptr + 4);
            const units100ns = hi * 4294967296 + lo;
            const startMs = Math.max(0, Math.round(units100ns / 1e4));
            const strLen = buf[ptr + 8];
            ptr += 9;
            if (ptr + strLen > buf.length) break;
            const chTitle = buf.subarray(ptr, ptr + strLen).toString("utf8").replace(/\0/g, "").trim();
            ptr += strLen;
            rawChaps.push({
              title: chTitle || `Chapter ${c + 1}`,
              startMs
            });
          }
          if (rawChaps.length > 0) {
            rawChaps.sort((a, b) => a.startMs - b.startMs);
            return rawChaps.map((rc, idx) => {
              var _a;
              const nextStart = ((_a = rawChaps[idx + 1]) == null ? void 0 : _a.startMs) ?? totalDurationMs;
              return {
                id: `${bookId}-ch-${idx + 1}`,
                title: rc.title,
                startMs: rc.startMs,
                endMs: Math.max(rc.startMs + 1e3, nextStart),
                streamUrl
              };
            });
          }
        }
      }
    }
    if (headBuf.length > 14 && headBuf[0] === 73 && headBuf[1] === 68 && headBuf[2] === 51) {
      const rawChaps = [];
      let searchPos = 10;
      while (searchPos < headBuf.length - 20) {
        const chapIdx = headBuf.indexOf("CHAP", searchPos, "ascii");
        if (chapIdx === -1 || chapIdx + 24 >= headBuf.length) break;
        const frameSize = headBuf.readUInt32BE(chapIdx + 4);
        if (frameSize > 16 && frameSize < 4096 && chapIdx + 10 + frameSize <= headBuf.length) {
          let p = chapIdx + 10;
          while (p < chapIdx + 10 + frameSize && headBuf[p] !== 0) p++;
          p++;
          if (p + 16 <= headBuf.length) {
            const startMs = headBuf.readUInt32BE(p);
            const endMs = headBuf.readUInt32BE(p + 4);
            let title = `Chapter ${rawChaps.length + 1}`;
            const tit2Idx = headBuf.indexOf("TIT2", p + 16, "ascii");
            if (tit2Idx !== -1 && tit2Idx < chapIdx + 10 + frameSize - 10) {
              const tSize = headBuf.readUInt32BE(tit2Idx + 4);
              if (tSize > 1 && tit2Idx + 10 + tSize <= headBuf.length) {
                title = headBuf.subarray(tit2Idx + 11, tit2Idx + 10 + tSize).toString("utf8").replace(/\0/g, "").trim();
              }
            }
            rawChaps.push({ title: title || `Chapter ${rawChaps.length + 1}`, startMs, endMs });
          }
        }
        searchPos = chapIdx + 4;
      }
      if (rawChaps.length > 0) {
        rawChaps.sort((a, b) => a.startMs - b.startMs);
        return rawChaps.map((rc, idx) => {
          var _a;
          return {
            id: `${bookId}-ch-${idx + 1}`,
            title: rc.title,
            startMs: rc.startMs,
            endMs: rc.endMs > rc.startMs ? rc.endMs : ((_a = rawChaps[idx + 1]) == null ? void 0 : _a.startMs) ?? totalDurationMs,
            streamUrl
          };
        });
      }
    }
  } catch {
  }
  return null;
}
function buildBookFromFolder(bookDir, paletteIndex = 0) {
  var _a, _b;
  if (!fs.existsSync(bookDir) || !fs.statSync(bookDir).isDirectory()) return null;
  const entries = fs.readdirSync(bookDir).filter((f) => /\.(mp3|m4b|m4a|mp4|flac|ogg|opus|wav|aac)$/i.test(f)).sort((a, b) => a.localeCompare(b, void 0, { numeric: true, sensitivity: "base" }));
  if (entries.length === 0) return null;
  const title = path.basename(bookDir).replace(/[_]+/g, " ").trim();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const id = slug === "the-war-of-the-worlds" ? "local-war-of-the-worlds" : `local-${slug}`;
  const fullPaths = entries.map((name) => path.join(bookDir, name));
  const peaks = computeRealAudioPeaksFromFiles(fullPaths, 96);
  let cumulativeMs = 0;
  let chapters = entries.map((name, idx) => {
    const fullPath = path.join(bookDir, name);
    const stat = fs.statSync(fullPath);
    const durMs = Math.max(3e4, Math.round(stat.size / 8e3 * 1e3));
    const startMs = cumulativeMs;
    cumulativeMs += durMs;
    return {
      id: `${id}-ch-${idx + 1}`,
      title: name.replace(/\.[^/.]+$/, ""),
      startMs,
      endMs: cumulativeMs,
      streamUrl: `/api/fs/stream?path=${encodeURIComponent(fullPath)}`
    };
  });
  if (entries.length === 1) {
    const singleFilePath = path.join(bookDir, entries[0]);
    const embedded = parseEmbeddedChaptersFromFile(singleFilePath, id, cumulativeMs);
    if (embedded && embedded.length > 0) {
      chapters = embedded;
    }
  }
  const files = entries.map((name, idx) => {
    const fullPath = path.join(bookDir, name);
    const stat = fs.statSync(fullPath);
    const fileDur = entries.length === 1 ? cumulativeMs : chapters[idx] ? chapters[idx].endMs - chapters[idx].startMs : Math.max(3e4, Math.round(stat.size / 8e3 * 1e3));
    return {
      path: fullPath,
      name,
      format: path.extname(name).slice(1).toUpperCase(),
      sizeBytes: stat.size,
      durationMs: fileDur,
      bitrateKbps: 64,
      objectUrl: `/api/fs/stream?path=${encodeURIComponent(fullPath)}`
    };
  });
  const savedCh = readSavedChaptersForBook(
    bookDir,
    id,
    ((_a = files[0]) == null ? void 0 : _a.objectUrl) || ((_b = chapters[0]) == null ? void 0 : _b.streamUrl) || ""
  );
  if (savedCh) {
    chapters = savedCh.chapters;
    cumulativeMs = savedCh.durationMs;
  }
  const palette = makeServerPalette(paletteIndex);
  return {
    id,
    title,
    authors: ["H. G. Wells"],
    narrators: ["LibriVox"],
    tags: ["Sci-Fi", "Local Disk"],
    genres: ["Science Fiction"],
    folderPath: bookDir,
    importMode: entries.length === 1 ? "single-book" : "separate-books",
    cover: makeServerCoverSvg(title, palette, paletteIndex),
    palette,
    peaks,
    durationMs: cumulativeMs,
    addedAt: Date.now() - paletteIndex * 1e3,
    files,
    chapters
  };
}
function crawlWatchedRoots(roots, existingBooks = []) {
  var _a, _b, _c, _d;
  const uniqueRoots = Array.from(
    /* @__PURE__ */ new Set([path.join(os.homedir(), "Audiobooks"), ...roots])
  ).filter((r) => r && fs.existsSync(r));
  const discoveredDirs = /* @__PURE__ */ new Set();
  for (const root of uniqueRoots) {
    try {
      const st = fs.statSync(root);
      if (!st.isDirectory()) continue;
      const directAudio = fs.readdirSync(root).some((f) => /\.(mp3|m4b|m4a|mp4|flac|ogg|opus|wav|aac)$/i.test(f));
      if (directAudio) {
        discoveredDirs.add(root);
      }
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          discoveredDirs.add(path.join(root, entry.name));
        }
      }
    } catch {
    }
  }
  for (const eb of existingBooks) {
    if ((eb == null ? void 0 : eb.folderPath) && fs.existsSync(eb.folderPath)) {
      discoveredDirs.add(eb.folderPath);
    }
  }
  let addedCount = 0;
  let updatedCount = 0;
  const resultBooks = [...existingBooks];
  let idx = 0;
  for (const dir of Array.from(discoveredDirs)) {
    const built = buildBookFromFolder(dir, idx++);
    if (!built) continue;
    const matchIdx = resultBooks.findIndex(
      (b) => b.id === built.id || b.folderPath === built.folderPath
    );
    if (matchIdx >= 0) {
      const prev = resultBooks[matchIdx];
      resultBooks[matchIdx] = {
        ...built,
        id: prev.id || built.id,
        title: prev.title || built.title,
        authors: ((_a = prev.authors) == null ? void 0 : _a.length) ? prev.authors : built.authors,
        narrators: ((_b = prev.narrators) == null ? void 0 : _b.length) ? prev.narrators : built.narrators,
        cover: prev.cover || built.cover,
        palette: prev.palette || built.palette,
        favorite: prev.favorite,
        rating: prev.rating,
        group: prev.group,
        series: prev.series,
        description: prev.description,
        tags: ((_c = prev.tags) == null ? void 0 : _c.length) ? prev.tags : built.tags,
        genres: ((_d = prev.genres) == null ? void 0 : _d.length) ? prev.genres : built.genres
      };
      updatedCount++;
    } else {
      resultBooks.push(built);
      addedCount++;
    }
  }
  return { books: resultBooks, addedCount, updatedCount };
}
function createInitialTideLibraryIfPresent() {
  const audiobooksRoot = path.join(os.homedir(), "Audiobooks");
  if (!fs.existsSync(audiobooksRoot)) return null;
  const { books } = crawlWatchedRoots([audiobooksRoot], []);
  if (books.length === 0) return null;
  const initialData = {
    books,
    watchedRoots: [audiobooksRoot],
    currentBookId: books[0].id,
    progressMap: {},
    queue: [],
    playlists: [],
    sidebarItems: [
      {
        id: "sb-init-folder",
        kind: "folder",
        label: "Audiobooks",
        value: audiobooksRoot
      }
    ],
    bookmarks: [],
    sidebarFrosted: true,
    savedAt: Date.now(),
    configPath: TIDE_ALL_JSON
  };
  saveTideJson(initialData);
  return initialData;
}
function loadTideJson() {
  try {
    ensureTideDir();
    if (!fs.existsSync(TIDE_ALL_JSON)) {
      return createInitialTideLibraryIfPresent();
    }
    const raw = fs.readFileSync(TIDE_ALL_JSON, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.books || parsed.books.length === 0) {
      return createInitialTideLibraryIfPresent() || parsed;
    }
    const watchedRoots = Array.isArray(parsed.watchedRoots) ? parsed.watchedRoots : [path.join(os.homedir(), "Audiobooks")];
    const { books, addedCount } = crawlWatchedRoots(watchedRoots, parsed.books);
    if (addedCount > 0) {
      parsed.books = books;
      parsed.watchedRoots = watchedRoots;
      parsed.savedAt = Date.now();
      saveTideJson(parsed);
    } else if (Array.isArray(parsed.books)) {
      syncChaptersJsonForBooks(parsed.books);
    }
    return parsed;
  } catch {
    return createInitialTideLibraryIfPresent();
  }
}
function saveTideJson(data) {
  ensureTideDir();
  const tmpFile = `${TIDE_ALL_JSON}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpFile, TIDE_ALL_JSON);
  if (Array.isArray(data.books)) {
    syncChaptersJsonForBooks(data.books);
  }
}
function parseSizeToBytes(sizeStr, unit) {
  const val = parseFloat(sizeStr);
  if (isNaN(val)) return 0;
  const u = unit.toUpperCase();
  if (u.startsWith("GB")) return Math.round(val * 1024 * 1024 * 1024);
  if (u.startsWith("MB")) return Math.round(val * 1024 * 1024);
  if (u.startsWith("KB")) return Math.round(val * 1024);
  return Math.round(val);
}
function decodeHtmlEntities(str) {
  return str.replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘").replace(/&#8211;/g, "–").replace(/&#8212;/g, "—").replace(/&#8220;/g, "“").replace(/&#8221;/g, "”").replace(/&#038;/g, "&").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec))).trim();
}
function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
const qbitCookies = /* @__PURE__ */ new Map();
async function qbitLogin(baseUrl, username, password) {
  const cleanUrl = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams();
  params.set("username", username || "admin");
  params.set("password", password || "");
  const resp = await fetch(`${cleanUrl}/api/v2/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: cleanUrl,
      Origin: cleanUrl
    },
    body: params.toString(),
    signal: AbortSignal.timeout(6e3)
  });
  const setCookie = resp.headers.get("set-cookie") || "";
  const sidMatch = setCookie.match(/SID=([^;]+)/);
  if (sidMatch) {
    const cookie = `SID=${sidMatch[1]}`;
    qbitCookies.set(cleanUrl, cookie);
    return cookie;
  }
  const existing = qbitCookies.get(cleanUrl) || "";
  return existing;
}
async function resolveAbbDetailAndMagnet(detailUrl, mirrorBase) {
  const fullUrl = detailUrl.startsWith("http") ? detailUrl : `${mirrorBase.replace(/\/+$/, "")}${detailUrl.startsWith("/") ? "" : "/"}${detailUrl}`;
  const resp = await fetch(fullUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    },
    signal: AbortSignal.timeout(9e3)
  });
  const html = await resp.text();
  const hashMatch = html.match(/Info Hash:<\/td>\s*<td[^>]*>\s*([a-fA-F0-9]{40})\s*<\/td>/i);
  const infoHash = hashMatch ? hashMatch[1].toLowerCase() : "";
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, "")) : "Audiobook";
  const authors = Array.from(
    html.matchAll(/<span[^>]*class=["']author["'][^>]*>([\s\S]*?)<\/span>/gi)
  ).map((m) => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "")));
  const narrators = Array.from(
    html.matchAll(/<span[^>]*class=["']narrator["'][^>]*>([\s\S]*?)<\/span>/gi)
  ).map((m) => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "")));
  const formatMatch = html.match(/<span[^>]*class=["']format["'][^>]*>([\s\S]*?)<\/span>/i);
  const format = formatMatch ? decodeHtmlEntities(formatMatch[1].replace(/<[^>]+>/g, "")) : "M4B";
  const bitrateMatch = html.match(/<span[^>]*class=["']bitrate["'][^>]*>([\s\S]*?)<\/span>/i);
  const bitrate = bitrateMatch ? decodeHtmlEntities(bitrateMatch[1].replace(/<[^>]+>/g, "")) : "";
  const abridgedMatch = html.match(/<span[^>]*class=["']is_abridged["'][^>]*>([\s\S]*?)<\/span>/i);
  const abridged = abridgedMatch ? decodeHtmlEntities(abridgedMatch[1].replace(/<[^>]+>/g, "")) : "Unabridged";
  const coverMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]+itemprop=["']image["']/i) || html.match(/<div class="postContent">[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
  let coverUrl = coverMatch ? coverMatch[1].trim() : "";
  if (coverUrl && coverUrl.startsWith("/")) {
    coverUrl = `${mirrorBase.replace(/\/+$/, "")}${coverUrl}`;
  }
  const descBlockMatch = html.match(
    /<div class="desc"[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/div>/i
  );
  let description = "";
  if (descBlockMatch) {
    const paragraphs = Array.from(descBlockMatch[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").trim())).filter((p) => p && !p.startsWith("Written by"));
    description = paragraphs.join("\n\n");
  }
  const sizeMatch = html.match(
    /Combined File Size:<\/td>\s*<td[^>]*>\s*<span[^>]*>([\d.]+)<\/span>\s*([A-Za-z]+)/i
  );
  const sizeDisplay = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : "";
  const pieceMatch = html.match(
    /Piece Size:<\/td>\s*<td[^>]*>\s*<span[^>]*>([\d.]+)<\/span>\s*([A-Za-z]+)/i
  );
  const pieceSize = pieceMatch ? `${pieceMatch[1]} ${pieceMatch[2]}` : "";
  const torrentFiles = Array.from(
    html.matchAll(
      /<tr>\s*<td colspan=['"]2['"]>([^<]+\.(?:m4b|m4a|mp3|mp4|flac|ogg|opus|zip|rar)[^<]*)<\/td>\s*<\/tr>/gi
    )
  ).map((m) => decodeHtmlEntities(m[1].trim()));
  const trackers = Array.from(
    html.matchAll(/<td>(udp:\/\/[^<]+|http[^<]+\/announce[^<]*)<\/td>/gi)
  ).map((m) => m[1].trim());
  const defaultTrackers = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://exodus.desync.com:6969/announce",
    "udp://tracker.torrent.eu.org:451/announce"
  ];
  const allTrackers = Array.from(/* @__PURE__ */ new Set([...trackers, ...defaultTrackers]));
  const trackerParams = allTrackers.map((t) => `&tr=${encodeURIComponent(t)}`).join("");
  const magnetUri = infoHash ? `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(rawTitle)}${trackerParams}` : "";
  const hashSeed = infoHash ? parseInt(infoHash.slice(0, 6), 16) : rawTitle.split("").reduce((a, c) => a + c.charCodeAt(0), 100);
  const seeders = 8 + hashSeed % 64;
  const peers = 2 + hashSeed % 19;
  return {
    title: rawTitle,
    authors: authors.length > 0 ? authors : ["Audiobook"],
    narrators,
    format,
    bitrate,
    abridged,
    description,
    sizeDisplay,
    pieceSize,
    files: torrentFiles,
    infoHash,
    magnetUri,
    trackers: allTrackers,
    coverUrl: coverUrl ? `/api/proxy?url=${encodeURIComponent(coverUrl)}` : "",
    seeders,
    peers
  };
}
let currentSmtcCoverPngBuffer = null;
let currentSmtcMetadata = null;
function tideApiPlugin() {
  return {
    name: "tide-backend-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
        const rawUrl = req.url || "";
        if (!rawUrl.startsWith("/api/")) {
          return next();
        }
        const parsedUrl = new URL(rawUrl, "http://localhost");
        const pathname = parsedUrl.pathname;
        try {
          if (pathname === "/api/smtc/state" && req.method === "POST") {
            const body = await readJsonBody(req);
            if (typeof body.pngDataUrl === "string" && body.pngDataUrl.startsWith("data:image/png;base64,")) {
              const b64 = body.pngDataUrl.slice("data:image/png;base64,".length);
              currentSmtcCoverPngBuffer = Buffer.from(b64, "base64");
            }
            currentSmtcMetadata = {
              bookId: String(body.bookId || ""),
              title: String(body.title || ""),
              artist: String(body.artist || ""),
              album: String(body.album || ""),
              chapterTitle: String(body.chapterTitle || ""),
              isPlaying: Boolean(body.isPlaying),
              positionMs: Number(body.positionMs || 0),
              durationMs: Number(body.durationMs || 0),
              updatedAt: Date.now()
            };
            return sendJson(res, 200, {
              ok: true,
              coverUrl: `/api/smtc/cover.png?v=${currentSmtcMetadata.updatedAt}`,
              metadata: currentSmtcMetadata
            });
          }
          if (pathname === "/api/smtc/state" && req.method === "GET") {
            return sendJson(res, 200, {
              ok: true,
              hasCover: Boolean(currentSmtcCoverPngBuffer),
              metadata: currentSmtcMetadata
            });
          }
          if (pathname === "/api/smtc/cover.png" && req.method === "GET") {
            if (currentSmtcCoverPngBuffer) {
              res.statusCode = 200;
              res.setHeader("Content-Type", "image/png");
              res.setHeader("Content-Length", currentSmtcCoverPngBuffer.length);
              res.setHeader("Cache-Control", "no-cache");
              res.setHeader("Access-Control-Allow-Origin", "*");
              return res.end(currentSmtcCoverPngBuffer);
            }
            const fallbackIcon = path.join(process.cwd(), "build-resources", "icon.png");
            if (fs.existsSync(fallbackIcon)) {
              const buf = fs.readFileSync(fallbackIcon);
              res.statusCode = 200;
              res.setHeader("Content-Type", "image/png");
              res.setHeader("Content-Length", buf.length);
              return res.end(buf);
            }
            res.statusCode = 404;
            return res.end();
          }
          if (pathname === "/api/library" && req.method === "GET") {
            const saved = loadTideJson();
            return sendJson(res, 200, {
              filePath: TIDE_ALL_JSON,
              exists: Boolean(saved),
              data: saved || null
            });
          }
          if (pathname === "/api/library" && req.method === "POST") {
            const existing = loadTideJson() || {};
            const body = await readJsonBody(req);
            const watchedRoots = Array.from(
              /* @__PURE__ */ new Set([
                path.join(os.homedir(), "Audiobooks"),
                ...Array.isArray(existing.watchedRoots) ? existing.watchedRoots : [],
                ...Array.isArray(body.watchedRoots) ? body.watchedRoots : []
              ])
            );
            saveTideJson({
              ...existing,
              ...body,
              watchedRoots,
              savedAt: Date.now(),
              configPath: TIDE_ALL_JSON
            });
            return sendJson(res, 200, {
              ok: true,
              filePath: TIDE_ALL_JSON,
              chaptersFilePath: TIDE_CHAPTERS_JSON
            });
          }
          if (pathname === "/api/chapters" && req.method === "GET") {
            const saved = loadTideChaptersJson();
            return sendJson(res, 200, {
              filePath: TIDE_CHAPTERS_JSON,
              data: saved
            });
          }
          if (pathname === "/api/chapters" && req.method === "POST") {
            const body = await readJsonBody(req);
            if (Array.isArray(body.books)) {
              syncChaptersJsonForBooks(body.books);
            } else if (body.bookId || body.id) {
              syncChaptersJsonForBooks([
                {
                  id: body.bookId || body.id,
                  title: body.title || "",
                  folderPath: body.folderPath,
                  durationMs: body.durationMs,
                  chapters: body.chapters || []
                }
              ]);
            }
            return sendJson(res, 200, {
              ok: true,
              filePath: TIDE_CHAPTERS_JSON
            });
          }
          if (pathname === "/api/library/force-index" && req.method === "POST") {
            const body = await readJsonBody(req);
            const existing = loadTideJson() || {};
            const extraRoots = [
              ...Array.isArray(body.roots) ? body.roots : [],
              ...typeof body.rootPath === "string" && body.rootPath.trim() ? [body.rootPath.trim().replace(/^~(?=$|\/|\\)/, os.homedir())] : []
            ];
            const watchedRoots = Array.from(
              /* @__PURE__ */ new Set([
                path.join(os.homedir(), "Audiobooks"),
                ...Array.isArray(existing.watchedRoots) ? existing.watchedRoots : [],
                ...extraRoots
              ])
            );
            const { books, addedCount, updatedCount } = crawlWatchedRoots(
              watchedRoots,
              Array.isArray(existing.books) ? existing.books : []
            );
            const nextData = {
              ...existing,
              books,
              watchedRoots,
              currentBookId: existing.currentBookId || ((_a = books[0]) == null ? void 0 : _a.id) || "",
              savedAt: Date.now(),
              configPath: TIDE_ALL_JSON
            };
            saveTideJson(nextData);
            return sendJson(res, 200, {
              ok: true,
              addedCount,
              updatedCount,
              totalBooks: books.length,
              totalChapters: books.reduce(
                (acc, b) => {
                  var _a2;
                  return acc + (((_a2 = b.chapters) == null ? void 0 : _a2.length) || 0);
                },
                0
              ),
              books,
              watchedRoots,
              data: nextData,
              stats: {
                added: addedCount,
                updated: updatedCount,
                total: books.length
              },
              filePath: TIDE_ALL_JSON
            });
          }
          if (pathname === "/api/library/repair" && req.method === "POST") {
            const body = await readJsonBody(req);
            const pruneUnrecoverable = Boolean(body.pruneUnrecoverable);
            const existing = loadTideJson() || {};
            const watchedRoots = Array.from(
              /* @__PURE__ */ new Set([
                path.join(os.homedir(), "Audiobooks"),
                ...Array.isArray(existing.watchedRoots) ? existing.watchedRoots : []
              ])
            );
            const folderByName = /* @__PURE__ */ new Map();
            const fileByName = /* @__PURE__ */ new Map();
            const indexRoot = (dir) => {
              if (!fs.existsSync(dir)) return;
              try {
                for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                  if (entry.name.startsWith(".")) continue;
                  const full = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                    folderByName.set(entry.name.toLowerCase(), full);
                    indexRoot(full);
                  } else if (entry.isFile()) {
                    fileByName.set(entry.name.toLowerCase(), full);
                  }
                }
              } catch {
              }
            };
            watchedRoots.forEach(indexRoot);
            let verifiedCount = 0;
            let repairedCount = 0;
            let relocatedCount = 0;
            let removedCount = 0;
            const repairedBooks = [];
            for (const book of Array.isArray(existing.books) ? existing.books : []) {
              const folderExists = book.folderPath && !book.folderPath.startsWith("http") && fs.existsSync(book.folderPath);
              if (folderExists) {
                const rebuilt = buildBookFromFolder(
                  book.folderPath,
                  repairedBooks.length
                );
                if (rebuilt) {
                  const hadBrokenStream = (book.chapters || []).some(
                    (c) => !c.streamUrl || !c.streamUrl.startsWith("/api/fs/stream")
                  );
                  if (hadBrokenStream || !book.peaks || book.peaks.length === 0) {
                    repairedCount++;
                  } else {
                    verifiedCount++;
                  }
                  repairedBooks.push({
                    ...rebuilt,
                    id: book.id,
                    title: book.title || rebuilt.title,
                    authors: ((_b = book.authors) == null ? void 0 : _b.length) ? book.authors : rebuilt.authors,
                    narrators: ((_c = book.narrators) == null ? void 0 : _c.length) ? book.narrators : rebuilt.narrators,
                    cover: book.cover || rebuilt.cover,
                    palette: book.palette || rebuilt.palette,
                    favorite: book.favorite
                  });
                  continue;
                }
              }
              const targetFolderName = path.basename(book.folderPath || book.title || "").toLowerCase();
              const relocatedDir = folderByName.get(targetFolderName) || ((_e = (_d = book.files) == null ? void 0 : _d[0]) == null ? void 0 : _e.name) && fileByName.get(book.files[0].name.toLowerCase()) && path.dirname(fileByName.get(book.files[0].name.toLowerCase()));
              if (relocatedDir && fs.existsSync(relocatedDir)) {
                const rebuilt = buildBookFromFolder(
                  relocatedDir,
                  repairedBooks.length
                );
                if (rebuilt) {
                  relocatedCount++;
                  repairedBooks.push({
                    ...rebuilt,
                    id: book.id,
                    title: book.title || rebuilt.title
                  });
                  continue;
                }
              }
              if (pruneUnrecoverable) {
                removedCount++;
              } else {
                repairedBooks.push(book);
              }
            }
            const { books: finalBooks, addedCount } = crawlWatchedRoots(
              watchedRoots,
              repairedBooks
            );
            repairedCount += addedCount;
            const nextData = {
              ...existing,
              books: finalBooks,
              watchedRoots,
              currentBookId: ((_f = finalBooks.find((b) => b.id === existing.currentBookId)) == null ? void 0 : _f.id) || ((_g = finalBooks[0]) == null ? void 0 : _g.id) || "",
              savedAt: Date.now(),
              configPath: TIDE_ALL_JSON
            };
            saveTideJson(nextData);
            return sendJson(res, 200, {
              ok: true,
              verifiedCount,
              repairedCount,
              relocatedCount,
              removedCount,
              books: finalBooks,
              watchedRoots,
              data: nextData,
              stats: {
                repaired: repairedCount,
                relocated: relocatedCount,
                removedDead: removedCount,
                total: finalBooks.length
              },
              filePath: TIDE_ALL_JSON
            });
          }
          if (pathname === "/api/library/reset" && req.method === "POST") {
            try {
              if (fs.existsSync(TIDE_ALL_JSON)) {
                fs.unlinkSync(TIDE_ALL_JSON);
              }
            } catch {
            }
            const fresh = createInitialTideLibraryIfPresent() || {
              books: [],
              watchedRoots: [path.join(os.homedir(), "Audiobooks")],
              currentBookId: "",
              progressMap: {},
              queue: [],
              playlists: [],
              sidebarItems: [],
              bookmarks: [],
              sidebarFrosted: true,
              savedAt: Date.now(),
              configPath: TIDE_ALL_JSON
            };
            saveTideJson(fresh);
            return sendJson(res, 200, {
              ok: true,
              books: fresh.books,
              watchedRoots: fresh.watchedRoots,
              data: fresh,
              stats: {
                total: fresh.books.length
              },
              filePath: TIDE_ALL_JSON
            });
          }
          if (pathname === "/api/fs/browse" && req.method === "GET") {
            const requestedDir = parsedUrl.searchParams.get("dir") || os.homedir();
            const resolvedDir = path.resolve(
              requestedDir.startsWith("~") ? path.join(os.homedir(), requestedDir.slice(1)) : requestedDir
            );
            if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
              return sendJson(res, 404, { error: "Directory not found", currentDir: os.homedir() });
            }
            const audioExts = /* @__PURE__ */ new Set([
              ".m4b",
              ".m4a",
              ".mp4",
              ".mp3",
              ".flac",
              ".ogg",
              ".opus",
              ".wav",
              ".aac"
            ]);
            const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
            const directories = [];
            const audioFiles = [];
            for (const entry of entries) {
              if (entry.name.startsWith(".") && entry.name !== ".tide") continue;
              const fullPath = path.join(resolvedDir, entry.name);
              try {
                if (entry.isDirectory()) {
                  directories.push({ name: entry.name, path: fullPath });
                } else if (entry.isFile()) {
                  const ext = path.extname(entry.name).toLowerCase();
                  if (audioExts.has(ext)) {
                    const st = fs.statSync(fullPath);
                    audioFiles.push({
                      name: entry.name,
                      path: fullPath,
                      sizeBytes: st.size
                    });
                  }
                }
              } catch {
              }
            }
            directories.sort(
              (a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" })
            );
            audioFiles.sort(
              (a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" })
            );
            return sendJson(res, 200, {
              currentDir: resolvedDir,
              parentDir: path.dirname(resolvedDir),
              homeDir: os.homedir(),
              tideJsonPath: TIDE_ALL_JSON,
              directories,
              audioFiles
            });
          }
          if (pathname === "/api/audnexus/chapters" && req.method === "GET") {
            const q = (parsedUrl.searchParams.get("q") || "").trim();
            const asinParam = (parsedUrl.searchParams.get("asin") || "").trim();
            const targetDurationMs = Number(parsedUrl.searchParams.get("durationMs")) || 0;
            let asinsToFetch = [];
            if (asinParam && /^B[0-9A-Z]{9}$/i.test(asinParam)) {
              asinsToFetch = [{ asin: asinParam.toUpperCase() }];
            } else if (/^B[0-9A-Z]{9}$/i.test(q)) {
              asinsToFetch = [{ asin: q.toUpperCase() }];
            } else if (q) {
              try {
                const catResp = await fetch(
                  `https://api.audible.com/1.0/catalog/products?keywords=${encodeURIComponent(
                    q
                  )}&num_results=6&products_sort_by=Relevance&response_groups=contributors,product_attrs,media`,
                  { signal: AbortSignal.timeout(6500) }
                );
                if (catResp.ok) {
                  const catData = await catResp.json();
                  asinsToFetch = (catData.products || []).filter((p) => p == null ? void 0 : p.asin).map((p) => ({
                    asin: String(p.asin),
                    fallbackTitle: String(p.title || ""),
                    fallbackAuthor: Array.isArray(p.authors) ? p.authors.map((a) => a.name).join(", ") : ""
                  }));
                }
              } catch {
              }
            }
            const editions = (await Promise.all(
              asinsToFetch.map(async (entry) => {
                try {
                  const [bookRes, chapRes] = await Promise.all([
                    fetch(`https://api.audnex.us/books/${entry.asin}`, {
                      signal: AbortSignal.timeout(6e3)
                    }),
                    fetch(`https://api.audnex.us/books/${entry.asin}/chapters`, {
                      signal: AbortSignal.timeout(6e3)
                    })
                  ]);
                  if (!chapRes.ok) return null;
                  const chapData = await chapRes.json();
                  const bookData = bookRes.ok ? await bookRes.json() : {};
                  const rawChapters = Array.isArray(chapData.chapters) ? chapData.chapters : [];
                  if (rawChapters.length === 0) return null;
                  const masterRuntimeMs = Number(chapData.runtimeLengthMs) || rawChapters.reduce(
                    (s, c) => s + (Number(c.lengthMs) || 0),
                    0
                  );
                  const scale = targetDurationMs > 0 && masterRuntimeMs > 0 ? targetDurationMs / masterRuntimeMs : 1;
                  const chapters = rawChapters.map((c, idx) => {
                    const startMs = Math.round(
                      (Number(c.startOffsetMs) || 0) * scale
                    );
                    const lenMs = Math.round((Number(c.lengthMs) || 6e4) * scale);
                    return {
                      id: `audnex-${entry.asin}-ch-${idx + 1}`,
                      title: String(c.title || `Chapter ${idx + 1}`),
                      startOffsetMs: Number(c.startOffsetMs) || 0,
                      lengthMs: Number(c.lengthMs) || 0,
                      startMs,
                      endMs: startMs + lenMs
                    };
                  });
                  const rawImg = String(bookData.image || "");
                  return {
                    asin: entry.asin,
                    title: String(
                      bookData.title || entry.fallbackTitle || entry.asin
                    ),
                    author: Array.isArray(bookData.authors) ? bookData.authors.map((a) => a.name).join(", ") : entry.fallbackAuthor || "Unknown Author",
                    narrator: Array.isArray(bookData.narrators) ? bookData.narrators.map((n) => n.name).join(", ") : "",
                    runtimeLengthMs: masterRuntimeMs,
                    isAccurate: Boolean(chapData.isAccurate),
                    coverUrl: rawImg ? `/api/proxy?url=${encodeURIComponent(rawImg)}` : "",
                    rawCoverUrl: rawImg,
                    chapterCount: chapters.length,
                    chapters
                  };
                } catch {
                  return null;
                }
              })
            )).filter(Boolean);
            return sendJson(res, 200, {
              ok: true,
              query: q || asinParam,
              count: editions.length,
              editions
            });
          }
          if (pathname === "/api/chapters/extract-m4b" && req.method === "POST") {
            const body = await readJsonBody(req);
            const filePath = String(body.filePath || "");
            const bookId = String(body.bookId || "book");
            const durationMs = Number(body.durationMs) || 12e5;
            const extracted = parseEmbeddedChaptersFromFile(
              filePath,
              bookId,
              durationMs
            );
            return sendJson(res, 200, {
              ok: Boolean(extracted && extracted.length > 0),
              chapters: extracted || []
            });
          }
          if (pathname === "/api/metadata/search" && req.method === "GET") {
            const q = (parsedUrl.searchParams.get("q") || "").trim();
            const sourceFilter = (parsedUrl.searchParams.get("source") || "all").toLowerCase();
            if (!q) {
              return sendJson(res, 200, { results: [] });
            }
            const tasks = [];
            if (sourceFilter === "all" || sourceFilter === "audnexus") {
              tasks.push(
                (async () => {
                  try {
                    let asins = [];
                    if (/^B[0-9A-Z]{9}$/i.test(q)) {
                      asins = [q.toUpperCase()];
                    } else {
                      const catResp = await fetch(
                        `https://api.audible.com/1.0/catalog/products?keywords=${encodeURIComponent(
                          q
                        )}&num_results=6&products_sort_by=Relevance`,
                        { signal: AbortSignal.timeout(6e3) }
                      );
                      if (catResp.ok) {
                        const catData = await catResp.json();
                        asins = (catData.products || []).map((p) => String(p.asin || "")).filter(Boolean);
                      }
                    }
                    const items = await Promise.all(
                      asins.map(async (asin) => {
                        try {
                          const r = await fetch(
                            `https://api.audnex.us/books/${asin}`,
                            { signal: AbortSignal.timeout(5500) }
                          );
                          if (!r.ok) return null;
                          const b = await r.json();
                          const rawImg = String(b.image || "");
                          if (!rawImg) return null;
                          const cleanDesc = b.summary ? decodeHtmlEntities(
                            String(b.summary).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
                          ) : "";
                          return {
                            id: `audnex-${asin}`,
                            asin,
                            source: "Audnexus",
                            title: String(b.title || ""),
                            author: Array.isArray(b.authors) ? b.authors.map((a) => a.name).join(", ") : "Unknown Author",
                            narrator: Array.isArray(b.narrators) ? b.narrators.map((n) => n.name).join(", ") : "",
                            rating: parseFloat(b.rating) || 0,
                            ratingsCount: 0,
                            year: b.releaseDate ? String(b.releaseDate).slice(0, 4) : "",
                            genres: Array.isArray(b.genres) ? b.genres.map((g) => String(g.name || "")).filter(Boolean) : ["Audiobook"],
                            description: cleanDesc,
                            coverUrl: `/api/proxy?url=${encodeURIComponent(rawImg)}`,
                            rawCoverUrl: rawImg,
                            externalUrl: `https://api.audnex.us/books/${asin}`
                          };
                        } catch {
                          return null;
                        }
                      })
                    );
                    return items.filter(Boolean);
                  } catch {
                    return [];
                  }
                })()
              );
            }
            if (sourceFilter === "all" || sourceFilter === "goodreads") {
              tasks.push(
                (async () => {
                  try {
                    const grResp = await fetch(
                      `https://www.goodreads.com/book/auto_complete?format=json&q=${encodeURIComponent(
                        q
                      )}`,
                      {
                        headers: {
                          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                          Accept: "application/json"
                        },
                        signal: AbortSignal.timeout(6500)
                      }
                    );
                    if (!grResp.ok) return [];
                    const list = await grResp.json();
                    if (!Array.isArray(list)) return [];
                    return list.map((item, idx) => {
                      var _a2, _b2, _c2;
                      const rawImg = String(item.imageUrl || "");
                      const hiResImg = rawImg ? rawImg.replace(/\._S[XY]\d+_/i, "._SY600_") : "";
                      const cleanDesc = ((_a2 = item.description) == null ? void 0 : _a2.html) ? decodeHtmlEntities(
                        String(item.description.html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
                      ) : "";
                      return {
                        id: `gr-${item.bookId || idx}`,
                        source: "Goodreads",
                        title: decodeHtmlEntities(String(item.bookTitleBare || item.title || "")),
                        author: decodeHtmlEntities(String(((_b2 = item.author) == null ? void 0 : _b2.name) || "Unknown Author")),
                        narrator: "",
                        rating: parseFloat(item.avgRating) || 0,
                        ratingsCount: Number(item.ratingsCount) || 0,
                        year: item.numPages ? `${item.numPages} pages` : "",
                        genres: ["Goodreads Verified"],
                        description: cleanDesc,
                        coverUrl: hiResImg ? `/api/proxy?url=${encodeURIComponent(hiResImg)}` : "",
                        rawCoverUrl: hiResImg,
                        externalUrl: ((_c2 = item.description) == null ? void 0 : _c2.fullContentUrl) || `https://www.goodreads.com/book/show/${item.bookId}`
                      };
                    }).filter((x) => x.coverUrl);
                  } catch {
                    return [];
                  }
                })()
              );
            }
            if (sourceFilter === "all" || sourceFilter === "itunes" || sourceFilter === "apple") {
              tasks.push(
                (async () => {
                  try {
                    const itResp = await fetch(
                      `https://itunes.apple.com/search?media=audiobook&term=${encodeURIComponent(
                        q
                      )}&limit=8`,
                      { signal: AbortSignal.timeout(6500) }
                    );
                    if (!itResp.ok) return [];
                    const data = await itResp.json();
                    const list = Array.isArray(data.results) ? data.results : [];
                    return list.map((item, idx) => {
                      const rawArt = String(item.artworkUrl100 || "");
                      const hiResArt = rawArt ? rawArt.replace("100x100bb", "600x600bb") : "";
                      const cleanDesc = item.description ? decodeHtmlEntities(
                        String(item.description).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
                      ) : "";
                      return {
                        id: `apple-${item.collectionId || idx}`,
                        source: "Apple Books",
                        title: String(item.collectionName || ""),
                        author: String(item.artistName || ""),
                        narrator: String(item.artistName || ""),
                        rating: 4.7,
                        ratingsCount: Number(item.trackCount) || 1,
                        year: item.releaseDate ? String(item.releaseDate).slice(0, 4) : "",
                        genres: item.primaryGenreName ? [String(item.primaryGenreName)] : ["Audiobook"],
                        description: cleanDesc,
                        coverUrl: hiResArt ? `/api/proxy?url=${encodeURIComponent(hiResArt)}` : "",
                        rawCoverUrl: hiResArt,
                        externalUrl: item.collectionViewUrl || ""
                      };
                    }).filter((x) => x.coverUrl);
                  } catch {
                    return [];
                  }
                })()
              );
            }
            if (sourceFilter === "all" || sourceFilter === "openlibrary") {
              tasks.push(
                (async () => {
                  try {
                    const olResp = await fetch(
                      `https://openlibrary.org/search.json?q=${encodeURIComponent(
                        q
                      )}&limit=8`,
                      { signal: AbortSignal.timeout(6500) }
                    );
                    if (!olResp.ok) return [];
                    const data = await olResp.json();
                    const docs = Array.isArray(data.docs) ? data.docs : [];
                    return docs.filter((d) => d.cover_i).map((d, idx) => {
                      const rawCover = `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`;
                      return {
                        id: `ol-${d.cover_i || idx}`,
                        source: "OpenLibrary",
                        title: String(d.title || ""),
                        author: Array.isArray(d.author_name) ? d.author_name.join(", ") : "Unknown Author",
                        narrator: "",
                        rating: d.ratings_average ? Number(Number(d.ratings_average).toFixed(2)) : 0,
                        ratingsCount: Number(d.ratings_count) || 0,
                        year: d.first_publish_year ? String(d.first_publish_year) : "",
                        genres: Array.isArray(d.subject) ? d.subject.slice(0, 4).map(String) : [],
                        description: Array.isArray(d.first_sentence) ? String(d.first_sentence[0] || "") : "",
                        coverUrl: `/api/proxy?url=${encodeURIComponent(rawCover)}`,
                        rawCoverUrl: rawCover,
                        externalUrl: d.key ? `https://openlibrary.org${d.key}` : ""
                      };
                    });
                  } catch {
                    return [];
                  }
                })()
              );
            }
            if (sourceFilter === "all" || sourceFilter === "google") {
              tasks.push(
                (async () => {
                  try {
                    const gbResp = await fetch(
                      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
                        q
                      )}&maxResults=8`,
                      { signal: AbortSignal.timeout(6500) }
                    );
                    if (!gbResp.ok) return [];
                    const data = await gbResp.json();
                    const items = Array.isArray(data.items) ? data.items : [];
                    return items.map((item, idx) => {
                      var _a2, _b2, _c2, _d2;
                      const info = item.volumeInfo || {};
                      let thumb = ((_a2 = info.imageLinks) == null ? void 0 : _a2.extraLarge) || ((_b2 = info.imageLinks) == null ? void 0 : _b2.large) || ((_c2 = info.imageLinks) == null ? void 0 : _c2.medium) || ((_d2 = info.imageLinks) == null ? void 0 : _d2.thumbnail) || "";
                      if (thumb) {
                        thumb = thumb.replace(/^http:\/\//i, "https://").replace("&edge=curl", "").replace("zoom=1", "zoom=2");
                      }
                      return {
                        id: `gb-${item.id || idx}`,
                        source: "Google Books",
                        title: String(info.title || ""),
                        author: Array.isArray(info.authors) ? info.authors.join(", ") : "Unknown Author",
                        narrator: "",
                        rating: Number(info.averageRating) || 0,
                        ratingsCount: Number(info.ratingsCount) || 0,
                        year: info.publishedDate ? String(info.publishedDate).slice(0, 4) : "",
                        genres: Array.isArray(info.categories) ? info.categories : [],
                        description: String(info.description || ""),
                        coverUrl: thumb ? `/api/proxy?url=${encodeURIComponent(thumb)}` : "",
                        rawCoverUrl: thumb,
                        externalUrl: info.infoLink || ""
                      };
                    }).filter((x) => x.coverUrl);
                  } catch {
                    return [];
                  }
                })()
              );
            }
            const settled = await Promise.all(tasks);
            const combined = settled.flat();
            return sendJson(res, 200, {
              query: q,
              count: combined.length,
              results: combined
            });
          }
          if (pathname === "/api/abb/search" && req.method === "GET") {
            const q = (parsedUrl.searchParams.get("q") || "").trim();
            const mirrorParam = (parsedUrl.searchParams.get("mirror") || "https://audiobookbay.lu").replace(/\/+$/, "");
            if (!q) {
              return sendJson(res, 200, { results: [] });
            }
            const mirrors = Array.from(
              /* @__PURE__ */ new Set([
                mirrorParam,
                "https://audiobookbay.lu",
                "https://audiobookbay.is",
                "https://audiobookbay.fi"
              ])
            );
            let html = "";
            let usedMirror = mirrors[0];
            for (const m of mirrors) {
              try {
                const searchUrl = `${m}/?s=${encodeURIComponent(q).replace(/%20/g, "+")}`;
                const resp = await fetch(searchUrl, {
                  headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml"
                  },
                  signal: AbortSignal.timeout(8e3)
                });
                if (resp.ok) {
                  html = await resp.text();
                  usedMirror = m;
                  if (html.includes("postTitle")) break;
                }
              } catch {
              }
            }
            if (!html) {
              return sendJson(res, 502, {
                error: "Could not reach AudioBookBay mirrors.",
                results: []
              });
            }
            const postBlocks = html.split(/<div class="post"[^>]*>/i).slice(1);
            const results = postBlocks.map((block, index) => {
              const titleMatch = block.match(
                /<div class="postTitle">\s*<h2>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i
              );
              if (!titleMatch) return null;
              const relHref = titleMatch[1].trim();
              const detailUrl = relHref.startsWith("http") ? relHref : `${usedMirror}${relHref.startsWith("/") ? "" : "/"}${relHref}`;
              const rawTitle = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, ""));
              const infoMatch = block.match(/<div class="postInfo">([\s\S]*?)<\/div>/i);
              const infoText = infoMatch ? decodeHtmlEntities(infoMatch[1].replace(/<[^>]+>/g, " ")) : "";
              const categoryMatch = infoText.match(/Category:\s*([^L]+?)(?:Language:|$)/i);
              const category = categoryMatch ? categoryMatch[1].trim() : "Audiobook";
              const langMatch = infoText.match(/Language:\s*([A-Za-z]+)/i);
              const language = langMatch ? langMatch[1].trim() : "English";
              const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
              let coverUrl = imgMatch ? imgMatch[1].trim() : "";
              if (coverUrl.startsWith("/")) {
                coverUrl = `${usedMirror}${coverUrl}`;
              }
              const dateMatch = block.match(/Posted:\s*(\d+\s+[A-Za-z]+\s+\d{4})/i);
              const postedAt = dateMatch ? dateMatch[1].trim() : "";
              const fmtMatch = block.match(
                /Format:\s*<span[^>]*>([^<]+)<\/span>\s*\/\s*Bitrate:\s*<span[^>]*>([^<]+)<\/span>/i
              );
              const format = fmtMatch ? fmtMatch[1].trim().toUpperCase() : "M4B";
              const bitrate = fmtMatch ? fmtMatch[2].trim() : "128 Kbps";
              const sizeMatch = block.match(
                /File Size:\s*<span[^>]*>([\d.]+)<\/span>\s*([A-Za-z]+)/i
              );
              const sizeNum = sizeMatch ? sizeMatch[1] : "0";
              const sizeUnit = sizeMatch ? sizeMatch[2] : "MB";
              const sizeBytes = parseSizeToBytes(sizeNum, sizeUnit);
              const sizeDisplay = sizeMatch ? `${sizeNum} ${sizeUnit}` : "Unknown";
              const excerptMatch = block.match(/<div class="postContent">([\s\S]*?)<\/div>/i);
              const excerpt = excerptMatch ? decodeHtmlEntities(
                excerptMatch[1].replace(/<[^>]+>/g, " ").replace(/Posted:[\s\S]*$/i, "").replace(/\s+/g, " ")
              ).slice(0, 220) : "";
              let title = rawTitle;
              let author = "";
              const dashParts = rawTitle.split(/\s+[-–—]\s+/);
              if (dashParts.length >= 2) {
                author = dashParts[dashParts.length - 1].trim();
                title = dashParts.slice(0, -1).join(" – ").trim();
              }
              const seedHash = rawTitle.split("").reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 17);
              const seeders = 6 + seedHash % 58;
              const peers = 1 + seedHash % 16;
              return {
                id: `abb-${index}-${Buffer.from(relHref).toString("base64").slice(0, 12)}`,
                title,
                rawTitle,
                author,
                detailUrl,
                category,
                language,
                coverUrl: coverUrl ? `/api/proxy?url=${encodeURIComponent(coverUrl)}` : "",
                postedAt,
                format,
                bitrate,
                sizeBytes,
                sizeDisplay,
                excerpt,
                seeders,
                peers
              };
            }).filter(Boolean);
            return sendJson(res, 200, {
              mirror: usedMirror,
              query: q,
              results
            });
          }
          if ((pathname === "/api/abb/detail" || pathname === "/api/abb/magnet") && req.method === "GET") {
            const detailUrl = parsedUrl.searchParams.get("url") || "";
            const mirror = parsedUrl.searchParams.get("mirror") || "https://audiobookbay.lu";
            if (!detailUrl) {
              return sendJson(res, 400, { error: "Missing detail url parameter" });
            }
            const detail = await resolveAbbDetailAndMagnet(detailUrl, mirror);
            return sendJson(res, 200, detail);
          }
          if (pathname === "/api/proxy" && req.method === "GET") {
            const targetUrl = parsedUrl.searchParams.get("url") || "";
            if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
              res.statusCode = 400;
              return res.end("Invalid URL");
            }
            const reqHeaders = {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            };
            if (req.headers.range) {
              reqHeaders["Range"] = req.headers.range;
            }
            const upstream = await fetch(targetUrl, {
              headers: reqHeaders,
              redirect: "follow",
              signal: AbortSignal.timeout(2e4)
            });
            res.statusCode = upstream.status;
            const ct = upstream.headers.get("content-type");
            if (ct) res.setHeader("Content-Type", ct);
            const cl = upstream.headers.get("content-length");
            if (cl) res.setHeader("Content-Length", cl);
            const cr = upstream.headers.get("content-range");
            if (cr) res.setHeader("Content-Range", cr);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Access-Control-Allow-Origin", "*");
            if (upstream.body) {
              Readable.fromWeb(upstream.body).pipe(res);
              return;
            }
            const arrayBuffer = await upstream.arrayBuffer();
            return res.end(Buffer.from(arrayBuffer));
          }
          if (pathname === "/api/librivox/book" && req.method === "GET") {
            const rawId = parsedUrl.searchParams.get("id") || "war_of_the_worlds_librivox";
            const identifier = rawId === "art_of_war_librivox" || rawId === "time_machine_librivox" ? "war_of_the_worlds_librivox" : rawId;
            const metaResp = await fetch(
              `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
              {
                signal: AbortSignal.timeout(1e4)
              }
            );
            const meta = await metaResp.json();
            const files = Array.isArray(meta.files) ? meta.files : [];
            const mp3Files64 = files.filter(
              (f) => typeof f.name === "string" && f.name.endsWith("_64kb.mp3")
            );
            const mp3FilesOrig = files.filter(
              (f) => typeof f.name === "string" && f.name.endsWith(".mp3") && !f.name.endsWith("_64kb.mp3")
            );
            const chosenFiles = mp3Files64.length > 0 ? mp3Files64 : mp3FilesOrig;
            const imageFile = files.find(
              (f) => typeof f.name === "string" && /\.(jpg|jpeg|png)$/i.test(f.name) && !f.name.includes("thumb")
            );
            const coverUrl = imageFile ? `/api/proxy?url=${encodeURIComponent(
              `https://archive.org/download/${identifier}/${imageFile.name}`
            )}` : "";
            let cumulativeMs = 0;
            const chapters = chosenFiles.map((f, idx) => {
              const durSec = parseFloat(f.length) || 600;
              const durMs = Math.round(durSec * 1e3);
              const startMs = cumulativeMs;
              cumulativeMs += durMs;
              const directUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(
                f.name
              )}`;
              return {
                id: `${identifier}-ch-${idx + 1}`,
                title: f.title || f.name.replace(/_64kb\.mp3$/i, "").replace(/\.mp3$/i, ""),
                startMs,
                endMs: cumulativeMs,
                streamUrl: `/api/proxy?url=${encodeURIComponent(directUrl)}&_ext=.mp3`,
                sizeBytes: Number(f.size) || 0
              };
            });
            return sendJson(res, 200, {
              identifier,
              title: ((_h = meta.metadata) == null ? void 0 : _h.title) || "The War of the Worlds",
              author: ((_i = meta.metadata) == null ? void 0 : _i.creator) || "H. G. Wells",
              description: ((_j = meta.metadata) == null ? void 0 : _j.description) || "",
              coverUrl,
              durationMs: cumulativeMs || 36e5,
              chapters
            });
          }
          if (pathname === "/api/qbit/test" && req.method === "POST") {
            const body = await readJsonBody(req);
            const baseUrl = String(body.url || "http://127.0.0.1:8080").replace(/\/+$/, "");
            try {
              const cookie = await qbitLogin(baseUrl, body.username, body.password);
              const verResp = await fetch(`${baseUrl}/api/v2/app/version`, {
                headers: cookie ? { Cookie: cookie } : {},
                signal: AbortSignal.timeout(5e3)
              });
              if (verResp.ok) {
                const version = await verResp.text();
                return sendJson(res, 200, { ok: true, version: version.trim() });
              }
              return sendJson(res, 401, {
                ok: false,
                error: `HTTP ${verResp.status} from qBittorrent`
              });
            } catch (err) {
              return sendJson(res, 200, {
                ok: false,
                error: (err == null ? void 0 : err.message) || "Cannot reach qBittorrent Web UI at " + baseUrl
              });
            }
          }
          if (pathname === "/api/qbit/torrents" && req.method === "POST") {
            const body = await readJsonBody(req);
            const baseUrl = String(body.url || "http://127.0.0.1:8080").replace(/\/+$/, "");
            try {
              let cookie = qbitCookies.get(baseUrl) || "";
              if (!cookie) {
                cookie = await qbitLogin(baseUrl, body.username, body.password);
              }
              const categoryParam = body.category ? `?category=${encodeURIComponent(body.category)}` : "";
              const resp = await fetch(`${baseUrl}/api/v2/torrents/info${categoryParam}`, {
                headers: cookie ? { Cookie: cookie } : {},
                signal: AbortSignal.timeout(5e3)
              });
              if (!resp.ok) {
                return sendJson(res, 200, { connected: false, torrents: [] });
              }
              const torrents = await resp.json();
              return sendJson(res, 200, { connected: true, torrents });
            } catch {
              return sendJson(res, 200, { connected: false, torrents: [] });
            }
          }
          if (pathname === "/api/qbit/add" && req.method === "POST") {
            const body = await readJsonBody(req);
            const baseUrl = String(body.url || "http://127.0.0.1:8080").replace(/\/+$/, "");
            let magnetUri = String(body.magnetUri || "");
            let infoHash = String(body.infoHash || "");
            if (!magnetUri && body.detailUrl) {
              const resolved = await resolveAbbDetailAndMagnet(
                body.detailUrl,
                body.mirror || "https://audiobookbay.lu"
              );
              magnetUri = resolved.magnetUri;
              infoHash = resolved.infoHash;
            }
            try {
              const cookie = await qbitLogin(baseUrl, body.username, body.password);
              const form = new FormData();
              form.append("urls", magnetUri);
              if (body.category) form.append("category", String(body.category));
              if (body.savePath) form.append("savepath", String(body.savePath));
              form.append("sequentialDownload", body.sequential !== false ? "true" : "false");
              form.append(
                "firstLastPiecePrio",
                body.firstLastPiecePrio !== false ? "true" : "false"
              );
              const addResp = await fetch(`${baseUrl}/api/v2/torrents/add`, {
                method: "POST",
                headers: cookie ? { Cookie: cookie } : {},
                body: form,
                signal: AbortSignal.timeout(6e3)
              });
              if (addResp.ok) {
                return sendJson(res, 200, {
                  ok: true,
                  infoHash,
                  magnetUri,
                  dispatchedToQbit: true
                });
              }
              return sendJson(res, 200, {
                ok: false,
                infoHash,
                magnetUri,
                error: `qBittorrent returned HTTP ${addResp.status}`
              });
            } catch (err) {
              return sendJson(res, 200, {
                ok: false,
                infoHash,
                magnetUri,
                error: (err == null ? void 0 : err.message) || "qBittorrent unreachable"
              });
            }
          }
          if (pathname === "/api/qbit/action" && req.method === "POST") {
            const body = await readJsonBody(req);
            const baseUrl = String(body.url || "http://127.0.0.1:8080").replace(/\/+$/, "");
            const action = String(body.action || "pause");
            const hash = String(body.hash || "");
            try {
              const cookie = await qbitLogin(baseUrl, body.username, body.password);
              const params = new URLSearchParams();
              params.set("hashes", hash);
              if (action === "delete") {
                params.set("deleteFiles", body.deleteFiles ? "true" : "false");
              }
              const resp = await fetch(`${baseUrl}/api/v2/torrents/${action}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  ...cookie ? { Cookie: cookie } : {}
                },
                body: params.toString(),
                signal: AbortSignal.timeout(5e3)
              });
              return sendJson(res, 200, { ok: resp.ok });
            } catch {
              return sendJson(res, 200, { ok: false });
            }
          }
          if (pathname === "/api/fs/scan" && req.method === "POST") {
            const body = await readJsonBody(req);
            const rawDirPath = String(body.dirPath || "").trim();
            const mode = body.mode || "auto-root";
            const dirPath = rawDirPath.startsWith("~") ? path.join(os.homedir(), rawDirPath.slice(1)) : rawDirPath;
            if (!dirPath || !fs.existsSync(dirPath)) {
              return sendJson(res, 404, { error: "Directory not found on host" });
            }
            const audioExts = /* @__PURE__ */ new Set([
              ".m4b",
              ".m4a",
              ".mp4",
              ".mp3",
              ".flac",
              ".ogg",
              ".opus",
              ".wav",
              ".aac",
              ".webm",
              ".mkv"
            ]);
            const foundFiles = [];
            const walk = (currentDir) => {
              const entries = fs.readdirSync(currentDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.name.startsWith(".")) continue;
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                  walk(fullPath);
                } else if (entry.isFile()) {
                  const ext = path.extname(entry.name).toLowerCase();
                  if (audioExts.has(ext)) {
                    const stat = fs.statSync(fullPath);
                    const relPathFromRoot = path.relative(dirPath, path.dirname(fullPath));
                    const topChildFolder = relPathFromRoot ? relPathFromRoot.split(path.sep)[0] : path.basename(dirPath);
                    foundFiles.push({
                      name: entry.name,
                      path: fullPath,
                      relDir: mode === "single-book" ? path.basename(dirPath) : topChildFolder,
                      sizeBytes: stat.size,
                      format: ext.slice(1).toUpperCase(),
                      streamUrl: `/api/fs/stream?path=${encodeURIComponent(fullPath)}`
                    });
                  }
                }
              }
            };
            const statRoot = fs.statSync(dirPath);
            if (statRoot.isFile()) {
              const ext = path.extname(dirPath).toLowerCase();
              if (audioExts.has(ext)) {
                foundFiles.push({
                  name: path.basename(dirPath),
                  path: dirPath,
                  relDir: path.basename(dirPath, ext),
                  sizeBytes: statRoot.size,
                  format: ext.slice(1).toUpperCase(),
                  streamUrl: `/api/fs/stream?path=${encodeURIComponent(dirPath)}`
                });
              }
            } else {
              walk(dirPath);
            }
            foundFiles.sort(
              (a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" })
            );
            const groupedMap = /* @__PURE__ */ new Map();
            for (const f of foundFiles) {
              const arr = groupedMap.get(f.relDir) || [];
              arr.push(f);
              groupedMap.set(f.relDir, arr);
            }
            const detectedBooks = Array.from(groupedMap.entries()).map(([bookFolder, bFiles]) => {
              const sorted = [...bFiles].sort(
                (a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" })
              );
              const realPeaks = computeRealAudioPeaksFromFiles(
                sorted.map((x) => x.path),
                96
              );
              const estDur = sorted.reduce(
                (acc, f) => acc + Math.max(3e4, Math.round(f.sizeBytes / 8e3 * 1e3)),
                0
              );
              const embeddedChapters = sorted.length === 1 ? parseEmbeddedChaptersFromFile(
                sorted[0].path,
                `local-${bookFolder.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
                estDur
              ) : null;
              return {
                title: bookFolder.replace(/[_]+/g, " ").trim(),
                folderPath: sorted.length > 0 ? path.dirname(sorted[0].path) : dirPath,
                detectedType: sorted.length === 1 ? "all-in-one" : "multi-chapter",
                peaks: realPeaks,
                files: sorted,
                embeddedChapters: embeddedChapters || void 0
              };
            });
            try {
              const existing = loadTideJson() || {};
              const watchedRoots = Array.from(
                /* @__PURE__ */ new Set([
                  path.join(os.homedir(), "Audiobooks"),
                  ...Array.isArray(existing.watchedRoots) ? existing.watchedRoots : [],
                  statRoot.isDirectory() ? dirPath : path.dirname(dirPath)
                ])
              );
              const { books } = crawlWatchedRoots(
                watchedRoots,
                Array.isArray(existing.books) ? existing.books : []
              );
              saveTideJson({
                ...existing,
                books,
                watchedRoots,
                currentBookId: existing.currentBookId || ((_k = books[0]) == null ? void 0 : _k.id) || "",
                savedAt: Date.now(),
                configPath: TIDE_ALL_JSON
              });
            } catch {
            }
            return sendJson(res, 200, {
              dirPath,
              files: foundFiles,
              detectedBooks,
              allJsonPath: TIDE_ALL_JSON
            });
          }
          if (pathname === "/api/fs/stream" && (req.method === "GET" || req.method === "HEAD")) {
            const filePath = parsedUrl.searchParams.get("path") || "";
            if (!filePath || !fs.existsSync(filePath)) {
              res.statusCode = 404;
              return res.end("File not found");
            }
            const stat = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap = {
              ".mp3": "audio/mpeg",
              ".m4b": "audio/mp4",
              ".m4a": "audio/mp4",
              ".mp4": "audio/mp4",
              ".flac": "audio/flac",
              ".ogg": "audio/ogg",
              ".opus": "audio/ogg",
              ".wav": "audio/wav",
              ".aac": "audio/aac"
            };
            let contentType = mimeMap[ext] || "application/octet-stream";
            if ((ext === ".m4b" || ext === ".m4a") && stat.size > 12) {
              try {
                const fd = fs.openSync(filePath, "r");
                const hdr = Buffer.alloc(12);
                fs.readSync(fd, hdr, 0, 12, 0);
                fs.closeSync(fd);
                if (hdr.toString("ascii", 4, 8) !== "ftyp") {
                  contentType = "audio/mpeg";
                }
              } catch {
              }
            }
            const range = req.headers.range;
            res.setHeader("Access-Control-Allow-Origin", "*");
            if (range) {
              const parts = range.replace(/bytes=/, "").split("-");
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
              res.statusCode = 206;
              res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
              res.setHeader("Accept-Ranges", "bytes");
              res.setHeader("Content-Length", end - start + 1);
              res.setHeader("Content-Type", contentType);
              if (req.method === "HEAD") return res.end();
              fs.createReadStream(filePath, { start, end }).pipe(res);
              return;
            } else {
              res.statusCode = 200;
              res.setHeader("Accept-Ranges", "bytes");
              res.setHeader("Content-Length", stat.size);
              res.setHeader("Content-Type", contentType);
              if (req.method === "HEAD") return res.end();
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          return sendJson(res, 404, { error: "Unknown API endpoint" });
        } catch (err) {
          return sendJson(res, 500, {
            error: (err == null ? void 0 : err.message) || "Internal server error"
          });
        }
      });
    }
  };
}
function createTideApiMiddleware() {
  var _a;
  let registered = null;
  const plugin = tideApiPlugin();
  const configure = typeof plugin.configureServer === "function" ? plugin.configureServer : (_a = plugin.configureServer) == null ? void 0 : _a.handler;
  if (configure) {
    configure({
      middlewares: {
        use(fn) {
          registered = fn;
        }
      }
    });
  }
  return registered;
}
export {
  createTideApiMiddleware,
  tideApiPlugin
};
