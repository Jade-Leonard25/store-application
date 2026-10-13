import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron/simple';
import { fileURLToPath } from 'node:url';

/** Absolute path from the project root (this file lives in the root). */
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Vitest sets VITEST; skip launching/bundling Electron while testing. */
const isTest = Boolean(process.env.VITEST);

export default defineConfig({
  // Required: the packaged app loads index.html over file://, so asset URLs
  // must be relative (./assets/x.js), not absolute (/assets/x.js).
  base: './',

  resolve: {
    alias: { '@': r('./src') }
  },

  plugins: [
    tailwindcss(),

    ...(isTest
      ? []
      : [
          electron({
            // Main process -> dist-electron/main.js (ESM, because package.json has "type": "module")
            main: {
              entry: r('./src/main/index.ts'),
              vite: {
                build: {
                  outDir: r('./dist-electron'),
                  lib: {
                    entry: r('./src/main/index.ts'),
                    formats: ['es'],
                    fileName: () => 'main.js'
                  }
                }
              }
            },

            // Preload -> dist-electron/preload.cjs
            // Must be CommonJS: sandboxed preload scripts cannot be ES modules.
            preload: {
              input: r('./src/preload/index.ts'),
              vite: {
                build: {
                  outDir: r('./dist-electron'),
                  rollupOptions: {
                    output: {
                      format: 'cjs',
                      entryFileNames: 'preload.cjs'
                    }
                  }
                }
              }
            }
            // No `renderer` option: contextIsolation is on, so the renderer
            // never gets Node APIs and needs no polyfills.
          })
        ])
  ],

  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    sourcemap: true
  },

  test: {
    // Vite's root is src/renderer, so point Vitest back at the project root.
    root: r('./'),
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});