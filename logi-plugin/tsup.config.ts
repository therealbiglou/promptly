import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
  outDir: 'dist',
  clean: true,
  target: 'node22',
  // Bundle our deps (including ws) into the single output file so Logi Plugin
  // Service can load the plugin without a separate node_modules tree.
  noExternal: ['ws'],
  // Leave the SDK as an external — Logi Plugin Service provides the runtime.
  external: ['@logitech/plugin-sdk'],
  sourcemap: true
});
