import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ mode }) => ({
  // `--mode artifact`: relative paths so the build can be opened from any static host
  base: mode === 'artifact' ? './' : '/',
  plugins: [preact()],
  esbuild: { charset: 'ascii' },
  server: { host: true, port: 5173 },
  build: { target: 'es2022', outDir: mode === 'artifact' ? 'dist-artifact' : 'dist', chunkSizeWarningLimit: 4000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
