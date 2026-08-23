import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

/**
 * Vite is configured in **library mode**: the output of this project is an
 * installable npm package (`@cashgear/ui`), never a standalone SPA.
 *
 * Key decisions:
 * - ESM only. Every CashGear client app is Vite/ESM based, so a CJS build
 *   would be dead weight.
 * - `preserveModules` keeps one output file per source module, which lets a
 *   consuming bundler drop untouched components at build time (tree-shaking)
 *   and keeps stack traces readable.
 * - React is external. It is a peer dependency and must resolve to the single
 *   copy owned by the consuming application.
 * - `src` is published alongside `dist` so the emitted `.d.ts.map` files
 *   resolve and "go to definition" lands on real source in consuming apps.
 * - CSS is emitted as one stylesheet (`dist/cashgear-ui.css`) exposed as
 *   `@cashgear/ui/styles.css`, so apps opt in explicitly and can order it
 *   against their own cascade.
 */
export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: fileURLToPath(new URL('./tsconfig.build.json', import.meta.url)),
      // Mirror the source tree in dist so each `.d.ts` sits next to its `.js`.
      // (`bundleTypes` would flatten everything into one file and needs
      // @microsoft/api-extractor — unnecessary weight for this library.)
      bundleTypes: false,
      entryRoot: 'src',
      insertTypesEntry: true,
      copyDtsFiles: false,
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: false, // Consuming apps minify; readable output aids debugging.
    cssMinify: true, // The stylesheet ships as-is, so it is worth compressing.
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      cssFileName: 'cashgear-ui',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  css: {
    modules: {
      // Stable, greppable class names in dev; hashed suffix guarantees scoping.
      generateScopedName: 'cg-[local]-[hash:base64:5]',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/index.ts', 'src/index.ts'],
    },
  },
});
