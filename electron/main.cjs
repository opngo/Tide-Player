const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  globalShortcut,
  shell,
  Menu,
  Tray,
  nativeImage,
} = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

let mainWindow = null;
let tray = null;
let localServer = null;
let localServerPort = 0;
let savedBoundsBeforeMini = null;

const isSmokeTest = process.argv.includes('--smoke-test');

// Enable Windows SystemMediaTransportControls (SMTC) & FluentFlyout integration
try {
  app.commandLine.appendSwitch(
    'enable-features',
    'HardwareMediaKeyHandling,MediaSessionService,SystemMediaTransportControls'
  );
  if (process.platform === 'win32') {
    app.setAppUserModelId('dev.tide.audiobook');
  }
} catch {
  // ignore
}

const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.m4b': 'audio/mp4',
  '.m4a': 'audio/mp4',
};

async function startEmbeddedTideServer() {
  const distDir = path.join(__dirname, '..', 'dist');
  const apiModulePath = path.join(__dirname, '..', 'dist-server', 'apiPlugin.mjs');

  let apiMiddleware = null;
  if (fs.existsSync(apiModulePath)) {
    const imported = await import(pathToFileURL(apiModulePath).href);
    if (typeof imported.createTideApiMiddleware === 'function') {
      apiMiddleware = imported.createTideApiMiddleware();
    }
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const rawUrl = req.url || '/';

      if (rawUrl.startsWith('/api/') && apiMiddleware) {
        return apiMiddleware(req, res, () => {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not found' }));
        });
      }

      // Serve static built frontend from dist/
      const cleanPath = decodeURIComponent(rawUrl.split('?')[0]);
      let filePath = path.join(
        distDir,
        cleanPath === '/' ? 'index.html' : cleanPath
      );

      if (!filePath.startsWith(distDir)) {
        res.statusCode = 403;
        return res.end('Forbidden');
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        return res.end('dist/index.html not found');
      }

      const ext = path.extname(filePath).toLowerCase();
      res.setHeader(
        'Content-Type',
        MIME_MAP[ext] || 'application/octet-stream'
      );
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      localServerPort = typeof addr === 'object' && addr ? addr.port : 0;
      localServer = server;
      resolve(localServerPort);
    });

    server.on('error', reject);
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'build-resources', 'icon.png');
    const img = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
      : nativeImage.createEmpty();
    tray = new Tray(img);
    tray.setToolTip('Tide · Audiobook Player');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Play / Pause',
        click: () => mainWindow?.webContents.send('tide:media-key', 'play-pause'),
      },
      {
        label: 'Previous Chapter',
        click: () =>
          mainWindow?.webContents.send('tide:media-key', 'prev-chapter'),
      },
      {
        label: 'Next Chapter',
        click: () =>
          mainWindow?.webContents.send('tide:media-key', 'next-chapter'),
      },
      {
        label: 'Minimal Slick Mode (L)',
        click: () =>
          mainWindow?.webContents.send('tide:media-key', 'toggle-slick'),
      },
      { type: 'separator' },
      {
        label: 'Show Tide',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: 'Quit Tide',
        click: () => app.quit(),
      },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) mainWindow.focus();
        else mainWindow.show();
      }
    });
  } catch {
    // Ignore tray creation errors on headless Linux environments
  }
}

async function createMainWindow() {
  const port = await startEmbeddedTideServer();
  const startUrl =
    process.env.VITE_DEV_SERVER_URL || `http://127.0.0.1:${port}`;

  if (isSmokeTest) {
    // Verify embedded server responds 200 OK on /api/library and exit 0
    const resp = await fetch(`http://127.0.0.1:${port}/api/library`);
    if (!resp.ok) {
      console.error('Smoke test failed: /api/library returned', resp.status);
      process.exit(1);
    }
    console.log(
      `[Tide Electron Smoke Test] Embedded server listening on 127.0.0.1:${port} — /api/library 200 OK`
    );
    app.quit();
    return;
  }

  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 540,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 16, y: 14 } : undefined,
    backgroundColor: '#04060c',
    show: false,
    icon: path.join(__dirname, '..', 'build-resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('tide:window-state', {
      isMaximized: true,
      isAlwaysOnTop: mainWindow.isAlwaysOnTop(),
    });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('tide:window-state', {
      isMaximized: false,
      isAlwaysOnTop: mainWindow.isAlwaysOnTop(),
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(startUrl);
}

function registerIpcAndShortcuts() {
  ipcMain.handle('tide:window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('tide:window:toggleMaximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  });

  ipcMain.handle('tide:window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('tide:window:setAlwaysOnTop', (_evt, enabled) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(Boolean(enabled));
    return mainWindow.isAlwaysOnTop();
  });

  ipcMain.handle('tide:window:setMiniPlayer', (_evt, enabled) => {
    if (!mainWindow) return false;
    if (enabled) {
      savedBoundsBeforeMini = mainWindow.getBounds();
      mainWindow.setMinimumSize(360, 96);
      mainWindow.setSize(420, 128, true);
      mainWindow.setAlwaysOnTop(true);
    } else {
      mainWindow.setMinimumSize(820, 540);
      if (savedBoundsBeforeMini) {
        mainWindow.setBounds(savedBoundsBeforeMini, true);
      } else {
        mainWindow.setSize(1280, 820, true);
      }
      mainWindow.setAlwaysOnTop(false);
    }
    return Boolean(enabled);
  });

  ipcMain.handle('tide:dialog:openDirectory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Audiobook Folder',
      defaultPath: path.join(os.homedir(), 'Audiobooks'),
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('tide:app:getInfo', () => ({
    name: 'Tide · Amp',
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    homedir: os.homedir(),
    tideJsonPath: path.join(os.homedir(), '.tide', 'all.json'),
  }));

  ipcMain.handle('tide:smtc:update', (_evt, meta) => {
    try {
      if (!meta) return false;
      const displayTitle = meta.artist
        ? `${meta.title} — ${meta.artist}`
        : String(meta.title || '');
      if (mainWindow && displayTitle) {
        mainWindow.setTitle(displayTitle);
      }
      if (tray && displayTitle) {
        tray.setToolTip(displayTitle);
      }
      if (
        mainWindow &&
        typeof meta.pngDataUrl === 'string' &&
        meta.pngDataUrl.startsWith('data:image/png;base64,')
      ) {
        const img = nativeImage.createFromDataURL(meta.pngDataUrl);
        if (!img.isEmpty() && process.platform === 'win32') {
          mainWindow.setOverlayIcon(
            img.resize({ width: 16, height: 16 }),
            displayTitle
          );
        }
      }
      return true;
    } catch {
      return false;
    }
  });

  // Only register fallback globalShortcuts on Linux where Windows SMTC / macOS NowPlaying isn't used
  if (process.platform === 'linux') {
    try {
      globalShortcut.register('MediaPlayPause', () => {
        mainWindow?.webContents.send('tide:media-key', 'play-pause');
      });
      globalShortcut.register('MediaNextTrack', () => {
        mainWindow?.webContents.send('tide:media-key', 'next-chapter');
      });
      globalShortcut.register('MediaPreviousTrack', () => {
        mainWindow?.webContents.send('tide:media-key', 'prev-chapter');
      });
    } catch {
      // ignore in headless environments
    }
  }
}

app.whenReady().then(async () => {
  registerIpcAndShortcuts();
  if (!isSmokeTest) {
    createTray();
  }
  await createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isSmokeTest) {
    app.quit();
  }
});

app.on('will-quit', () => {
  try {
    globalShortcut.unregisterAll();
  } catch {
    // ignore
  }
  if (localServer) {
    localServer.close();
  }
});
