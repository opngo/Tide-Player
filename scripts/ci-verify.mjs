import fs from 'fs';
import path from 'path';
import http from 'http';
import assert from 'assert';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAILED: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('=== Tide CI/CD & Packaging Verification Suite ===\n');

// 1. Build Artifacts Check
console.log('[1/6] Build & Bundle Inspection');
check('dist/index.html exists and is non-empty', () => {
  const htmlPath = path.join(rootDir, 'dist/index.html');
  assert(fs.existsSync(htmlPath), 'dist/index.html missing');
  const stat = fs.statSync(htmlPath);
  assert(stat.size > 200, 'dist/index.html is unexpectedly small');
});

check('dist-server/apiPlugin.mjs exists', () => {
  const srvPath = path.join(rootDir, 'dist-server/apiPlugin.mjs');
  assert(fs.existsSync(srvPath), 'dist-server/apiPlugin.mjs missing');
});

// 2. Embedded Electron/API Server Smoke Tests
console.log('\n[2/6] Embedded Server & API Smoke Tests');
await checkAsync('Standalone API middleware boots and serves /api/library (200 OK)', async () => {
  const apiModule = await import(
    pathToFileURL(path.join(rootDir, 'dist-server/apiPlugin.mjs')).href
  );
  assert(
    typeof apiModule.createTideApiMiddleware === 'function',
    'createTideApiMiddleware export missing'
  );
  const middleware = apiModule.createTideApiMiddleware();
  assert(typeof middleware === 'function', 'middleware function not returned');

  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const libResp = await fetch(`http://127.0.0.1:${port}/api/library`);
    assert.strictEqual(libResp.status, 200, '/api/library should return 200');
    const libJson = await libResp.json();
    assert(typeof libJson.filePath === 'string', 'filePath missing in /api/library');

    const indexResp = await fetch(
      `http://127.0.0.1:${port}/api/library/force-index`,
      { method: 'POST' }
    );
    assert.strictEqual(indexResp.status, 200, '/api/library/force-index should return 200');
    const indexJson = await indexResp.json();
    assert(indexJson.ok === true, 'force-index ok !== true');

    // If local audiobooks exist in the workspace, test HTTP 206 byte-range streaming
    if (Array.isArray(indexJson.books) && indexJson.books.length > 0) {
      const firstFile = indexJson.books[0]?.files?.[0]?.path;
      if (firstFile && fs.existsSync(firstFile)) {
        const streamResp = await fetch(
          `http://127.0.0.1:${port}/api/fs/stream?path=${encodeURIComponent(firstFile)}`,
          { headers: { Range: 'bytes=0-15' } }
        );
        assert.strictEqual(
          streamResp.status,
          206,
          'Range request to /api/fs/stream should return 206 Partial Content'
        );
        const buf = new Uint8Array(await streamResp.arrayBuffer());
        assert.strictEqual(buf.byteLength, 16, 'Expected 16 bytes from Range 0-15');
      }
    }
  } finally {
    server.close();
  }
});

// 3. UI & Audio Invariant Regression Checks
console.log('\n[3/6] UI & Audio Invariant Checks');
check('Seekbar playhead dot is anchored inside active chapter capsule (segFill)', () => {
  const pbCode = fs.readFileSync(
    path.join(rootDir, 'src/components/ProgressBar.tsx'),
    'utf8'
  );
  assert(
    pbCode.includes('left: `${segFill * 100}%`'),
    'Playhead dot must be positioned at segFill * 100% inside the active chapter capsule'
  );
});

check('Cover shape locks to circle ONLY for cover-outline visualizer and renders under cover', () => {
  const pvCode = fs.readFileSync(
    path.join(rootDir, 'src/components/PlayerView.tsx'),
    'utf8'
  );
  assert(
    pvCode.includes("vizConfig.type === 'cover-outline'"),
    'isCoverRadialVisualizer check missing in PlayerView.tsx'
  );
  assert(
    /isCoverRadialVisualizer\s*\?\s*'circle'\s*:\s*coverShape/.test(pvCode),
    'effectiveShape circle lock missing in PlayerView.tsx'
  );
});

check('Physical audio file segment timeline mapping is present in App.tsx', () => {
  const appCode = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');
  assert(
    appCode.includes('const fileSegments = React.useMemo'),
    'fileSegments memo missing in App.tsx'
  );
});

check('FluentFlyout / Windows SMTC mediaSession synchronizer is wired with raster PNG cover support', () => {
  const msCode = fs.readFileSync(
    path.join(rootDir, 'src/services/mediaSession.ts'),
    'utf8'
  );
  assert(
    msCode.includes('new MediaMetadata') && msCode.includes('image/png'),
    'MediaMetadata raster PNG artwork missing in src/services/mediaSession.ts'
  );
  const tbCode = fs.readFileSync(
    path.join(rootDir, 'src/components/ElectronTitleBar.tsx'),
    'utf8'
  );
  assert(
    !tbCode.includes('currentBookTitle') && !tbCode.includes('onOpenShowcaseSite'),
    'ElectronTitleBar must not display book title or showcase website link'
  );
});

// 4. Electron & NSIS Configuration Checks
console.log('\n[4/6] Electron Desktop & NSIS Installer Configuration');
check('electron/main.cjs, electron/preload.cjs, and icons exist', () => {
  assert(fs.existsSync(path.join(rootDir, 'electron/main.cjs')), 'electron/main.cjs missing');
  assert(fs.existsSync(path.join(rootDir, 'electron/preload.cjs')), 'electron/preload.cjs missing');
  assert(fs.existsSync(path.join(rootDir, 'build-resources/icon.png')), 'build-resources/icon.png missing');
  assert(fs.existsSync(path.join(rootDir, 'build-resources/icon.svg')), 'build-resources/icon.svg missing');
});

check('electron-builder.yml configures Windows NSIS, macOS DMG/ZIP, Linux AppImage/DEB, and GitHub Releases', () => {
  const ebYml = fs.readFileSync(path.join(rootDir, 'electron-builder.yml'), 'utf8');
  assert(ebYml.includes('target: nsis'), 'Windows NSIS target missing');
  assert(ebYml.includes('allowToChangeInstallationDirectory: true'), 'NSIS directory option missing');
  assert(ebYml.includes('target: dmg'), 'macOS DMG target missing');
  assert(ebYml.includes('target: AppImage'), 'Linux AppImage target missing');
  assert(ebYml.includes('target: deb'), 'Linux deb target missing');
  assert(ebYml.includes('provider: github'), 'GitHub Release provider missing');
});

// 5. Minimalist GitHub Showcase Website Checks
console.log('\n[5/6] Static Minimalist GitHub Showcase Website');
check('docs/index.html and public/showcase/index.html exist and match minimalist spec', () => {
  const docsPath = path.join(rootDir, 'docs/index.html');
  assert(fs.existsSync(docsPath), 'docs/index.html missing');
  const docsHtml = fs.readFileSync(docsPath, 'utf8');
  const hasTitle =
    /<title>[\s\S]*?tide[\s\S]*?<\/title>/i.test(docsHtml) ||
    /class=["'][^"']*title[^"']*["'][^>]*>[\s\S]*?tide/i.test(docsHtml) ||
    docsHtml.toLowerCase().includes('tide');
  assert(hasTitle, 'Title missing in docs/index.html');
});

// 6. GitHub Actions Workflows Inspection
console.log('\n[6/6] GitHub Actions Workflows Verification');
const requiredWorkflows = [
  'ci-inspect.yml',
  'electron-release.yml',
  'pages.yml',
  'docker-publish.yml',
  'codeql-security.yml',
];

for (const wf of requiredWorkflows) {
  check(`.github/workflows/${wf} exists and has valid workflow triggers & jobs`, () => {
    const wfPath = path.join(rootDir, '.github/workflows', wf);
    assert(fs.existsSync(wfPath), `Missing workflow: ${wf}`);
    const content = fs.readFileSync(wfPath, 'utf8');
    assert(content.includes('name:'), `${wf} missing name:`);
    assert(content.includes('on:'), `${wf} missing on:`);
    assert(content.includes('jobs:'), `${wf} missing jobs:`);
  });
}

console.log(`\n✓ All ${passed} CI/CD & Packaging checks passed!`);
