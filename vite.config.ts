import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro({
      // Deploy target is driven by NITRO_PRESET so local `dev`/`build` stay on
      // the Node preset, while `build:cf` (and CI) set `cloudflare_pages` to emit
      // a Cloudflare Pages bundle (dist/ + dist/_worker.js, _routes.json, etc.).
      preset: process.env.NITRO_PRESET,
      // Required by the Cloudflare (workerd) runtime; also enables nodejs_compat.
      compatibilityDate: '2025-09-14',
    }),
  ],
});
