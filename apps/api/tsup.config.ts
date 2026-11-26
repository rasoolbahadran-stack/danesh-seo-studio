import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  // esbuild doesn't know node:sqlite as a builtin yet — keep it external
  external: ['node:sqlite'],
});
