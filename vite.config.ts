/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config — also powers Vitest (test block) via vitest/config types pulled
// in through the triple-slash reference above.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Playwright E2E lives in `e2e/` and uses @playwright/test's `test()`, NOT
    // Vitest's — exclude it so `vitest run` doesn't try to collect those files.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'playwright-report/**', 'test-results/**'],
  },
});