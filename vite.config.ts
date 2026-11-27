import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ mode }) => ({
  // `--mode artifact` (claude.ai Artifact) and `--mode itch` (itch.io HTML5 zip): relative paths so the
  // build works from any folder or CDN subpath
  base: mode === 'artifact' || mode === 'itch' ? './' : '/',
  plugins: [preact()],
  esbuild: { charset: 'ascii' },
  // agent worktrees live under .claude/: never scan, watch or serve them as part of this app
  server: { host: true, port: 5173, watch: { ignored: ['**/.claude/**', '**/dist*/**'] } },
  optimizeDeps: { entries: ['index.html', 'dev-*.html'] },
  build: { target: 'es2022', outDir: mode === 'artifact' ? 'dist-artifact' : mode === 'itch' ? 'dist-itch' : 'dist', chunkSizeWarningLimit: 4000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
