import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tideApiPlugin } from './server/apiPlugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), tideApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    watch: {
      ignored: ['**/.tide/**', '**/Audiobooks/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
});
