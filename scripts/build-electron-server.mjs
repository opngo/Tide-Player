import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

await build({
  root: rootDir,
  configFile: false,
  build: {
    ssr: path.resolve(rootDir, 'server/apiPlugin.ts'),
    outDir: path.resolve(rootDir, 'dist-server'),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: 'apiPlugin.mjs',
        format: 'es',
      },
    },
  },
});

console.log('[build-electron-server] Built dist-server/apiPlugin.mjs successfully');
