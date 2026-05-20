import { defineConfig } from 'tsup';
import { postBuildProcessing } from '@logitech/plugin-toolkit';
import { esmShimPlugin } from '@logitech/plugin-toolkit/esbuild';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch') || process.argv.includes('-w');

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm'],
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  bundle: true,
  platform: 'node',
  target: 'es2022',
  noExternal: [/.*/],
  external: ['@logitech/plugin-sdk'],
  shims: true,
  sourcemap: !isWatch,
  esbuildPlugins: [esmShimPlugin({ require: true })],
  onSuccess: async () => {
    // Copies package/metadata + package/actionicons into dist/ so the built
    // folder is a self-sufficient Logi Plugin Service plugin directory.
    await postBuildProcessing(__dirname, false);
  },
  watch: isWatch
});
