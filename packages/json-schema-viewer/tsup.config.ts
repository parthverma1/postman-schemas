import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Emit .d.ts so the package is consumable with full types.
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // react/react-dom are peers; all runtime deps (from package.json `dependencies`)
  // are externalized by tsup automatically, so consumers dedupe a single copy.
  external: ['react', 'react-dom'],
});
